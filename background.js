const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_PROVIDER = "anthropic";
const MAX_HISTORY_MESSAGES = 10;
const MAX_CASE_EVENTS = 80;
const ASK_MEMORY_CHAR_LIMIT = 18000;
const STORAGE_STATE_KEY = "ccsCoachRuntimeState";
const MAX_PANEL_ITEMS = 80;

let items = [];
let conversationHistory = [];
let caseEvents = [];
let lastCaseEventSignature = "";
let usage = {};
let isLoading = false;
let runtimeStateLoaded = false;
let runtimeStateLoadPromise = null;

async function loadSystemPrompt() {
  const response = await fetch(chrome.runtime.getURL("prompts/system.md"));
  return response.text();
}

async function getSettings() {
  const settings = await chrome.storage.local.get(["apiKey", "provider", "language", "model", "baseUrl"]);
  const provider = settings.provider || DEFAULT_PROVIDER;
  const defaultModels = {
    anthropic: DEFAULT_MODEL,
    glm: "glm-5v-turbo",
    minimax: "MiniMax-M2.7"
  };
  const defaultBaseUrls = {
    anthropic: "https://api.anthropic.com",
    glm: "https://open.bigmodel.cn/api/paas/v4",
    minimax: "https://minnimax.chat"
  };
  return {
    apiKey: settings.apiKey || "",
    provider,
    language: settings.language || "zh",
    model: settings.model || defaultModels[provider] || DEFAULT_MODEL,
    baseUrl: settings.baseUrl || defaultBaseUrls[provider] || defaultBaseUrls.anthropic
  };
}

function getState() {
  return {
    items,
    usage,
    isLoading,
    caseEventsCount: caseEvents.length,
    recentCaseEvents: caseEvents.slice(-5)
  };
}

function normalizeStoredArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimRuntimeState() {
  items = items.slice(-MAX_PANEL_ITEMS);
  conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  caseEvents = caseEvents.slice(-MAX_CASE_EVENTS);
}

function serializeRuntimeState() {
  trimRuntimeState();
  return {
    items,
    conversationHistory,
    caseEvents,
    lastCaseEventSignature,
    usage,
    savedAt: new Date().toISOString()
  };
}

async function loadRuntimeState() {
  if (runtimeStateLoaded) return;
  if (runtimeStateLoadPromise) return runtimeStateLoadPromise;

  runtimeStateLoadPromise = chrome.storage.local.get(STORAGE_STATE_KEY)
    .then((stored) => {
      const state = stored[STORAGE_STATE_KEY];
      if (state && typeof state === "object") {
        items = normalizeStoredArray(state.items);
        conversationHistory = normalizeStoredArray(state.conversationHistory);
        caseEvents = normalizeStoredArray(state.caseEvents);
        lastCaseEventSignature = state.lastCaseEventSignature
          || (caseEvents.length ? getEventSignature(caseEvents.at(-1).text) : "");
        usage = state.usage && typeof state.usage === "object" ? state.usage : {};
        isLoading = false;
        trimRuntimeState();
      }
      runtimeStateLoaded = true;
    })
    .finally(() => {
      runtimeStateLoadPromise = null;
    });

  return runtimeStateLoadPromise;
}

function saveRuntimeState() {
  chrome.storage.local.set({
    [STORAGE_STATE_KEY]: serializeRuntimeState()
  }).catch(() => {});
}

function broadcastState() {
  saveRuntimeState();
  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: getState() }).catch(() => {});
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) throw new Error("No active tab found.");

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTabMessage(tabId, message) {
  if (!tabId) return null;
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_error) {
    return null;
  }
}

async function ensureContentScript(tabId) {
  let response = await sendTabMessage(tabId, { type: "PING" });
  if (response?.ok) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (_error) {
    return false;
  }

  response = await sendTabMessage(tabId, { type: "PING" });
  return Boolean(response?.ok);
}

async function setPageCoach(tabId, enabled) {
  const ready = await ensureContentScript(tabId);
  if (!ready) return { ok: false, error: "Could not inject coach into this page. Refresh the page and try again." };

  const response = await sendTabMessage(tabId, {
    type: "SET_WIDGET_ENABLED",
    enabled
  });
  return response?.ok ? { ok: true } : { ok: false, error: "Could not update coach widget." };
}

async function openSidePanelForSender(sender) {
  const tabId = sender?.tab?.id;
  const windowId = sender?.tab?.windowId;
  if (!windowId) return { ok: false, error: "No sender window." };

  try {
    if (tabId) {
      // 注意：不要 await setOptions，避免把 open() 推出用户手势窗口。
      chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true }).catch(() => {});
    }
    await chrome.sidePanel.open({ windowId });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractFrameContextInPage() {
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden"
      && style.display !== "none"
      && Number(style.opacity) !== 0
      && rect.width > 0
      && rect.height > 0;
  }

  function normalizeExtractedText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function isScrollableElement(element) {
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const canScroll = overflowY === "auto" || overflowY === "scroll";
    return canScroll && element.scrollHeight > element.clientHeight + 24;
  }

  function looksLikeVirtualScroll(element) {
    const visibleRatio = element.clientHeight / Math.max(1, element.scrollHeight);
    if (visibleRatio >= 0.85) return false;
    const cls = (element.className || "").toString().toLowerCase();
    const hasVirtualHint = /virtual|rv-|reactvirtualized|cdk-virtual|vue-recycle|infinite/i.test(cls)
      || element.querySelector?.("[data-virtual-scroll], .cdk-virtual-scroll-content-wrapper");
    return Boolean(hasVirtualHint);
  }

  function getElementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value || element.placeholder || "";
    }
    if (element instanceof HTMLSelectElement) {
      return element.selectedOptions?.[0]?.textContent || "";
    }
    return element.innerText || element.textContent || "";
  }

  const selectors = [
    "body",
    "dialog",
    "[role='dialog']",
    "form",
    "table",
    "td",
    "th",
    "div",
    "p",
    "span",
    "button",
    "input",
    "textarea",
    "select"
  ].join(",");

  const nodes = Array.from(document.body?.querySelectorAll(selectors) || []);
  const visibleText = nodes
    .filter(isVisible)
    .map(getElementText)
    .map(normalizeExtractedText)
    .filter(Boolean);

  const scrollableText = nodes
    .filter((element) => isVisible(element) && isScrollableElement(element))
    .map((element, index) => {
      const text = normalizeExtractedText(element.textContent || getElementText(element));
      if (!text) return "";
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const remaining = Math.max(0, maxScroll - element.scrollTop);
      const virtual = looksLikeVirtualScroll(element);
      let note;
      if (virtual) {
        note = remaining > 24
          ? "可能为虚拟滚动，未显示部分可能未被抓取，建议滚动到底部后再 Ask Coach"
          : "可能为虚拟滚动，已滚到底部";
      } else {
        note = "完整文本（含当前未显示在视口内的部分）已抓取，可直接使用";
      }
      return `[Scrollable window ${index + 1}: ${note}]\n${text}`;
    })
    .filter(Boolean);

  return {
    title: document.title,
    url: location.href,
    text: Array.from(new Set([...visibleText, ...scrollableText])).join("\n").slice(0, 9000)
  };
}

async function extractAllFrameContext(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: extractFrameContextInPage
    });

    const frames = results
      .map((result) => result.result)
      .filter((frame) => frame?.text?.trim());

    return {
      ok: true,
      title: frames[0]?.title || "",
      url: frames[0]?.url || "",
      text: frames
        .map((frame, index) => `Frame ${index + 1}: ${frame.title || frame.url}\n${frame.text}`)
        .join("\n\n")
        .slice(0, 18000)
    };
  } catch (_error) {
    return null;
  }
}

async function captureCurrentTabWithContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) throw new Error("No active tab found.");

  await sendTabMessage(tab.id, { type: "SET_WIDGET_HIDDEN", hidden: true });
  await delay(240);

  try {
    const pageContext = await extractAllFrameContext(tab.id)
      || await sendTabMessage(tab.id, { type: "EXTRACT_PAGE_CONTEXT" });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    return {
      base64Image: dataUrl.replace(/^data:image\/png;base64,/, ""),
      pageContext
    };
  } finally {
    await sendTabMessage(tab.id, { type: "SET_WIDGET_HIDDEN", hidden: false });
  }
}

function extractText(responseJson) {
  const block = responseJson.content?.find((item) => item.type === "text");
  return block?.text || "No text response returned.";
}

function extractOpenAiText(responseJson) {
  return responseJson.choices?.[0]?.message?.content || "No text response returned.";
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getEventSignature(text) {
  return normalizeText(text).replace(/\W+/g, "").slice(0, 240);
}

function addCaseEvent(event) {
  const text = normalizeText(event?.text);
  if (text.length < 20) return false;

  const signature = getEventSignature(text);
  if (signature === lastCaseEventSignature) return false;
  lastCaseEventSignature = signature;

  caseEvents.push({
    at: new Date().toISOString(),
    source: event.source || "manual",
    title: event.title || "",
    url: event.url || "",
    text: text.slice(0, 5000)
  });

  if (caseEvents.length > MAX_CASE_EVENTS) {
    caseEvents = caseEvents.slice(-MAX_CASE_EVENTS);
  }

  broadcastState();
  return true;
}

function buildLanguageInstruction(language) {
  if (language === "en") return "Reply in English.";
  if (language === "bilingual") {
    return "请用中英双语回答。每条建议先写中文，再用括号补充 concise English version。医学 order 名称保持英文。";
  }
  return "请用中文回答。医学 order 名称保持英文。";
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function getStateChangeScore(event) {
  const text = normalizeText(event.text).toLowerCase();
  const hasNegativeResultLanguage = includesAny(text, [
    /\b(no acute abnormality|within normal limits|normal limits|negative|ruled out|unremarkable|no evidence of)\b/i
  ]);

  const hasAbnormalResult = !hasNegativeResultLanguage && includesAny(text, [
    /\b(high|low|critical|positive|elevated|increased|decreased|abnormal)\b/i,
    /\b(h|l)\s*$/i,
    /\btroponin\b.*\b(positive|elevated|high|abnormal)\b/i,
    /\blactate\b.*\b(elevated|high|increased|abnormal)\b/i,
    /\babg\b.*\b(acidosis|hypox|hypercap|low|high|abnormal)\b/i,
    /\bct\b.*\b(dissection|bleed|embol|infarct|mass|rupture|abnormal)\b/i,
    /\bcxr\b.*\b(pneumothorax|infiltrate|edema|effusion|abnormal)\b/i,
    /\becg\b.*\b(stemi|ischemia|arrhythmia|tachycardia|abnormal)\b/i
  ]);

  const hasLocationChange = includesAny(text, [
    /\b(change location|emergency department|intensive care|icu|ward|operating room|admit|transfer)\b/i
  ]);

  const hasNewTreatment = includesAny(text, [
    /\b(start|administer|give|begin|ordered|order placed)\b.*\b(antibiotic|antibiotics|ceftriaxone|azithromycin|vancomycin|piperacillin|insulin|heparin|aspirin|nitroglycerin|beta.?blocker|magnesium|morphine|naloxone|dextrose|thiamine|oxygen|iv fluids|normal saline|saline|vasopressor|needle thoracostomy|chest tube)\b/i,
    /\b(antibiotic|antibiotics|ceftriaxone|azithromycin|vancomycin|piperacillin|insulin|heparin|aspirin|nitroglycerin|magnesium sulfate|mgso4|oxygen|iv fluids|normal saline|chest tube|needle thoracostomy)\b/i
  ]);

  const hasCriticalTimingAnchor = includesAny(text, [
    /\b(blood cultures?|urine culture|sputum culture|cultures? x ?2)\b/i,
    /\b(potassium replacement|potassium repletion|k replacement)\b/i
  ]);

  const hasDeterioration = includesAny(text, [
    /\b(worse|worsening|unresponsive|confused|obtunded|syncope|seizure|shock|distress|hypotension|hypoxic|cyanotic|tachypnea|tachycardia|chest pain|respiratory distress)\b/i,
    /\bblood pressure\b.*\b([0-8]?\d\/|systolic.*[0-8]?\d)\b/i
  ]);

  if (hasDeterioration) return 4;
  if (hasNewTreatment) return 3;
  if (hasCriticalTimingAnchor) return 3;
  if (hasLocationChange) return 2;
  if (hasAbnormalResult) return 1;
  return 0;
}

function isStateChangeEvent(event) {
  return getStateChangeScore(event) > 0;
}

function uniqueEvents(events) {
  const seen = new Set();
  const result = [];
  for (const event of events) {
    const signature = getEventSignature(event.text);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(event);
  }
  return result;
}

function formatMemoryEvent(event, index, label, textLimit) {
  const text = event.text.length > textLimit
    ? `${event.text.slice(0, textLimit)}\n[Event text clipped]`
    : event.text;
  return `${label} ${index + 1} [${event.source}] ${event.at}\n${text}`;
}

function buildMemoryText(eventsWithLabels, textLimits) {
  return eventsWithLabels
    .filter((entry) => textLimits[entry.label] > 0)
    .map((entry, index) => formatMemoryEvent(entry.event, index, entry.label, textLimits[entry.label]))
    .join("\n\n---\n\n");
}

function buildRecentCaseMemory() {
  const header =
    "【本 case 记忆】事件时间戳是用户真实操作时间（墙钟），不是 case 内 simulated time；"
    + "timing/sequencing 判断以截图里的 simulated time 为准。"
    + "Opening=开场原文（完整、最可信）；State-change=中途改变病情或处理方向的事件；Recent=最近上下文。\n\n";

  if (!caseEvents.length) {
    return header
      + "目前没有记录到病例时间线。若用户已经点过最开始的弹窗，说明插件启动太晚，"
      + "不能假装知道之前内容，应说明信息不足。";
  }

  const opening = caseEvents.slice(0, 6);
  const recent = caseEvents.slice(-20);
  const recentSet = new Set(recent);
  const openingSet = new Set(opening);

  const middleCandidates = caseEvents
    .filter((event) => !openingSet.has(event) && !recentSet.has(event))
    .filter(isStateChangeEvent)
    .map((event) => ({ event, score: getStateChangeScore(event), index: caseEvents.indexOf(event) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, 18)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.event);

  const selected = uniqueEvents([...opening, ...middleCandidates, ...recent])
    .sort((a, b) => caseEvents.indexOf(a) - caseEvents.indexOf(b));

  const eventsWithLabels = selected.map((event) => ({
    event,
    label: openingSet.has(event)
      ? "Opening"
      : recentSet.has(event)
        ? "Recent"
        : "State-change"
  }));

  const OPENING_FULL = 5000;
  const limitProfiles = [
    { Opening: OPENING_FULL, "State-change": 300, Recent: 450 },
    { Opening: OPENING_FULL, "State-change": 220, Recent: 360 },
    { Opening: OPENING_FULL, "State-change": 160, Recent: 300 },
    { Opening: OPENING_FULL, "State-change": 0, Recent: 260 },
    { Opening: OPENING_FULL, "State-change": 0, Recent: 200 }
  ];

  for (const profile of limitProfiles) {
    const memoryText = buildMemoryText(eventsWithLabels, profile);
    if ((header + memoryText).length <= ASK_MEMORY_CHAR_LIMIT) return header + memoryText;
  }

  const openingOnly = eventsWithLabels.filter((entry) => entry.label !== "State-change");
  const fallbackText = buildMemoryText(openingOnly, {
    Opening: OPENING_FULL,
    "State-change": 0,
    Recent: 160
  });

  if ((header + fallbackText).length <= ASK_MEMORY_CHAR_LIMIT) {
    return header + fallbackText;
  }

  const openingEntries = eventsWithLabels.filter((entry) => entry.label === "Opening");
  const openingText = buildMemoryText(openingEntries, { Opening: OPENING_FULL, "State-change": 0, Recent: 0 });
  const budgetLeft = ASK_MEMORY_CHAR_LIMIT - header.length - openingText.length - 64;

  if (budgetLeft <= 0) {
    const clipped = (header + openingText).slice(0, ASK_MEMORY_CHAR_LIMIT);
    return `${clipped}\n\n[警告：Opening 过长被截断，开场信息可能不完整，回答时需说明。]`;
  }

  const recentEntries = eventsWithLabels.filter((entry) => entry.label === "Recent");
  let recentText = buildMemoryText(recentEntries, { Opening: 0, "State-change": 0, Recent: 200 });
  if (recentText.length > budgetLeft) {
    recentText = `${recentText.slice(0, budgetLeft)}\n[Recent clipped]`;
  }

  return `${header}${openingText}\n\n---\n\n${recentText}`;
}

function buildScreenshotPrompt(language, pageContext) {
  const visibleText = pageContext?.text
    ? `\n\n【当前页面/弹窗/滚动窗口文字】优先结合这些文字与截图判断：\n${pageContext.text}`
    : "";
  const caseMemory = buildRecentCaseMemory();

  return `${buildLanguageInstruction(language)}

【模式：Ask Coach】请按 system prompt 中 "Ask Coach 输出" 的固定结构，给出"此刻下一步"建议，不要复盘整场。结合下面的记忆与当前截图/页面文字回答；信息不足时说明，不要编造未记录的 order、结果或诊断。

${caseMemory}

${visibleText}`;
}

function buildCaseFeedbackPrompt(language) {
  const timeline = caseEvents
    .map((event, index) => `#${index + 1} [${event.source}] ${event.at}\n${event.text}`)
    .join("\n\n---\n\n");

  const timeNote =
    "（注：时间戳为真实操作时间，非 case 内 simulated time。）\n\n";

  return `${buildLanguageInstruction(language)}

【模式：End Case & Feedback】用户想要整场复盘，不是当前一屏的下一步。请严格按 system prompt 中 "End Case & Feedback 输出" 的结构作答，只基于下面的时间线，不要编造未记录内容，不要列不适用于本患者的模板项。

${timeNote}【完整时间线】
${timeline || "No recorded events yet."}`;
}

function getRecentTextHistory() {
  return conversationHistory.slice(-MAX_HISTORY_MESSAGES);
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function buildAnthropicScreenshotMessage(base64Image, language, pageContext) {
  return {
    role: "user",
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: base64Image
        }
      },
      {
        type: "text",
        text: buildScreenshotPrompt(language, pageContext)
      }
    ]
  };
}

async function analyzeWithAnthropic(base64Image, settings, systemPrompt, pageContext) {
  const userMessage = buildAnthropicScreenshotMessage(base64Image, settings.language, pageContext);

  const history = getRecentTextHistory().map((message) => ({
    role: message.role,
    content: message.content
  }));

  const response = await fetch(joinUrl(settings.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2200,
      system: systemPrompt,
      messages: [
        ...history,
        userMessage
      ]
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(responseJson.error?.message || `Anthropic API error ${response.status}`);
  }

  return {
    text: extractText(responseJson),
    usage: responseJson.usage || {}
  };
}

async function analyzeWithGlm(base64Image, settings, systemPrompt, pageContext) {
  const history = getRecentTextHistory().map((message) => ({
    role: message.role,
    content: message.content
  }));

  const response = await fetch(joinUrl(settings.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2200,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...history,
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildScreenshotPrompt(settings.language, pageContext)
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(responseJson.error?.message || `GLM API error ${response.status}`);
  }

  return {
    text: extractOpenAiText(responseJson),
    usage: responseJson.usage || {}
  };
}
async function analyzeWithMiniMax(base64Image, settings, systemPrompt, pageContext) {
  const userMessage = buildAnthropicScreenshotMessage(base64Image, settings.language, pageContext);
  const history = getRecentTextHistory().map((message) => ({
    role: message.role,
    content: message.content
  }));

  const response = await fetch(joinUrl(settings.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2200,
      system: systemPrompt,
      messages: [
        ...history,
        userMessage
      ]
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    const message = responseJson.error?.message || responseJson.base_resp?.status_msg || `MiniMax API error ${response.status}`;
    throw new Error(message);
  }

  return {
    text: extractText(responseJson),
    usage: responseJson.usage || {}
  };
}

async function sendTextToAnthropicCompatible(settings, systemPrompt, prompt, label) {
  const response = await fetch(joinUrl(settings.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(responseJson.error?.message || `${label} API error ${response.status}`);
  }

  return {
    text: extractText(responseJson),
    usage: responseJson.usage || {}
  };
}

async function sendTextToGlm(settings, systemPrompt, prompt) {
  const response = await fetch(joinUrl(settings.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2000,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(responseJson.error?.message || `GLM API error ${response.status}`);
  }

  return {
    text: extractOpenAiText(responseJson),
    usage: responseJson.usage || {}
  };
}

async function generateCaseFeedback() {
  await loadRuntimeState();
  if (isLoading) return { ok: false, error: "Analysis already in progress." };
  if (!caseEvents.length) return { ok: false, error: "No case events recorded yet." };

  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("Please save your API key first.");

  isLoading = true;
  items.push({ role: "user", text: `Generating case feedback from ${caseEvents.length} recorded events...` });
  broadcastState();

  try {
    const systemPrompt = await loadSystemPrompt();
    const prompt = buildCaseFeedbackPrompt(settings.language);
    let result;

    if (settings.provider === "glm") {
      result = await sendTextToGlm(settings, systemPrompt, prompt);
    } else if (settings.provider === "minimax") {
      result = await sendTextToAnthropicCompatible(settings, systemPrompt, prompt, "MiniMax");
    } else {
      result = await sendTextToAnthropicCompatible(settings, systemPrompt, prompt, "Anthropic");
    }

    usage = result.usage;
    items.push({ role: "assistant", text: result.text });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    items.push({ role: "assistant", text: `Error: ${message}` });
    return { ok: false, error: message };
  } finally {
    isLoading = false;
    broadcastState();
  }
}

async function testModelConnection() {
  await loadRuntimeState();
  const startedAt = performance.now();
  let settings;

  try {
    settings = await getSettings();
    if (!settings.apiKey) throw new Error("Please save your API key first.");

    const systemPrompt = "You are a connection test assistant. Keep replies short.";
    const prompt = "Reply exactly: OK - CCS Coach model test passed.";
    const result = settings.provider === "glm"
      ? await sendTextToGlm(settings, systemPrompt, prompt)
      : await sendTextToAnthropicCompatible(settings, systemPrompt, prompt, settings.provider);

    return {
      ok: true,
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      latencyMs: Math.round(performance.now() - startedAt),
      reply: result.text,
      usage: result.usage
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      provider: settings?.provider,
      model: settings?.model,
      baseUrl: settings?.baseUrl,
      latencyMs: Math.round(performance.now() - startedAt),
      error: message
    };
  }
}

async function analyzeScreenshot(base64Image, pageContext) {
  await loadRuntimeState();
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("Please save your API key first.");

  const systemPrompt = await loadSystemPrompt();

  let result;
  if (settings.provider === "glm") {
    result = await analyzeWithGlm(base64Image, settings, systemPrompt, pageContext);
  } else if (settings.provider === "minimax") {
    result = await analyzeWithMiniMax(base64Image, settings, systemPrompt, pageContext);
  } else {
    result = await analyzeWithAnthropic(base64Image, settings, systemPrompt, pageContext);
  }

  conversationHistory.push({
    role: "user",
    content: pageContext?.text
      ? `Screenshot analyzed for the current CCS screen. Visible text:\n${pageContext.text.slice(0, 1200)}`
      : "Screenshot analyzed for the current CCS screen."
  }, {
    role: "assistant",
    content: result.text
  });
  conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  usage = result.usage;

  return result.text;
}

async function runAnalysis() {
  await loadRuntimeState();
  if (isLoading) return { ok: false, error: "Analysis already in progress." };

  isLoading = true;
  items.push({ role: "user", text: "Analyzing current Primum window..." });
  broadcastState();

  try {
    const { base64Image, pageContext } = await captureCurrentTabWithContext();
    if (pageContext?.text) {
      addCaseEvent({
        ...pageContext,
        source: "analyze"
      });
    }
    const text = await analyzeScreenshot(base64Image, pageContext);
    items.push({ role: "assistant", text });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    items.push({ role: "assistant", text: `Error: ${message}` });
    return { ok: false, error: message };
  } finally {
    isLoading = false;
    broadcastState();
  }
}

function resetCase() {
  items = [];
  conversationHistory = [];
  caseEvents = [];
  lastCaseEventSignature = "";
  usage = {};
  isLoading = false;
  broadcastState();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let responded = false;
  function safeSendResponse(response) {
    if (responded) return;
    responded = true;
    sendResponse(response);
  }

  // 关键修复：sidePanel.open() 必须在用户手势"新鲜"时调用。
  // 在任何 await（包括 loadRuntimeState）之前同步发起开 panel，拿到 promise，
  // 后面在对应分支里再 await 结果。否则手势会在 await 期间过期，open() 被拒。
  const panelPromise = (message.openPanel
    && (message.type === "ANALYZE_SCREENSHOT" || message.type === "CASE_FEEDBACK"))
    ? openSidePanelForSender(_sender)
    : Promise.resolve({ ok: false });
  panelPromise.catch(() => {});

  (async () => {
    await loadRuntimeState();

    if (message.type === "GET_STATE") {
      safeSendResponse(getState());
      return;
    }

    if (message.type === "NEW_CASE") {
      resetCase();
      safeSendResponse({ ok: true });
      return;
    }

    if (message.type === "SET_PAGE_COACH") {
      safeSendResponse(await setPageCoach(message.tabId, Boolean(message.enabled)));
      return;
    }

    if (message.type === "ANALYZE_SCREENSHOT") {
      const panel = await panelPromise;
      const result = await runAnalysis();
      safeSendResponse({ ...result, panelOpened: Boolean(panel.ok), panelError: panel.error || "" });
      return;
    }

    if (message.type === "TEST_MODEL") {
      safeSendResponse(await testModelConnection());
      return;
    }

    if (message.type === "CASE_FEEDBACK") {
      const panel = await panelPromise;
      const result = await generateCaseFeedback();
      safeSendResponse({ ...result, panelOpened: Boolean(panel.ok), panelError: panel.error || "" });
      return;
    }

    if (message.type === "RECORD_CONTEXT") {
      const recorded = addCaseEvent(message.event);
      safeSendResponse({ ok: true, recorded, count: caseEvents.length });
      return;
    }

    safeSendResponse({ ok: false, error: "Unknown message type." });
  })().catch((error) => {
    safeSendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  });
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "analyze-screenshot") {
    runAnalysis();
  }
});
