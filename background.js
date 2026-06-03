const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_PROVIDER = "anthropic";
const MAX_HISTORY_MESSAGES = 10;
const MAX_CASE_EVENTS = 80;

let items = [];
let conversationHistory = [];
let caseEvents = [];
let lastCaseEventSignature = "";
let usage = {};
let isLoading = false;

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

function broadcastState() {
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
  const windowId = sender?.tab?.windowId;
  if (!windowId) return;
  try {
    await chrome.sidePanel.open({ windowId });
  } catch (_error) {
    // Side panel opening is best-effort; analysis should still run.
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
    .map((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value || element.placeholder || "";
      }
      if (element instanceof HTMLSelectElement) {
        return element.selectedOptions?.[0]?.textContent || "";
      }
      return element.innerText || element.textContent || "";
    })
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    title: document.title,
    url: location.href,
    text: Array.from(new Set(visibleText)).join("\n").slice(0, 5000)
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
        .slice(0, 12000)
    };
  } catch (_error) {
    return null;
  }
}

async function captureCurrentTabWithContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) throw new Error("No active tab found.");

  const pageContext = await extractAllFrameContext(tab.id)
    || await sendTabMessage(tab.id, { type: "EXTRACT_PAGE_CONTEXT" });
  await sendTabMessage(tab.id, { type: "SET_WIDGET_HIDDEN", hidden: true });
  await delay(120);

  try {
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

function buildRecentCaseMemory() {
  if (!caseEvents.length) {
    return "目前没有记录到病例时间线。若用户已经点过最开始弹窗，说明插件启动太晚，不能假装知道之前内容。";
  }

  return caseEvents
    .slice(-20)
    .map((event, index) => {
      return `Memory ${index + 1} [${event.source}] ${event.at}\n${event.text.slice(0, 1800)}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 18000);
}

function buildScreenshotPrompt(language, pageContext) {
  const visibleText = pageContext?.text
    ? `\n\n当前页面可见文字/弹窗文字如下，优先结合这些文字判断：\n${pageContext.text}`
    : "";
  const caseMemory = buildRecentCaseMemory();

  return `${buildLanguageInstruction(language)}
这是当前 USMLE Step 3 CCS / Primum 界面截图。请给用户“此刻下一步”建议，而不是复盘。

重要规则：
- 你必须结合“本 case 已记录时间线”和当前画面回答，不要只看当前弹窗。
- 只有当画面明确是 Help / About / Exam Interface / Timer Info / Question Status / Answering Questions 这种软件说明弹窗时，才提示关闭。
- Reevaluate、Obtain Results、See Patient Later、With next available result、Order Entry、Location、History、Physical、Vitals、Labs 都是病例操作窗口，必须给医学和流程建议。
- 不要告诉用户点击不存在的 Start Case。插件只有 New Case，且只应在新病例开始前使用。
- 输出要清楚，不能只给一句话。用下面固定结构：
  ## 当前判断
  说明当前 case 最可能的问题、稳定性、你已经知道的关键信息。
  ## 现在该做
  给 3-8 条具体动作或 order，按优先级排列。
  ## 为什么
  简短说明 timing / sequencing / location 的理由。
  ## 别踩坑
  提醒当前界面最容易扣分的 1-3 个点。
- 每个 order 用英文名称，后面用中文解释。
- 不要输出 Markdown 表格。

本 case 已记录时间线：
${caseMemory}

${visibleText}`;
}

function buildCaseFeedbackPrompt(language) {
  const timeline = caseEvents
    .map((event, index) => {
      return `#${index + 1} [${event.source}] ${event.at}\n${event.text}`;
    })
    .join("\n\n---\n\n");

  return `${buildLanguageInstruction(language)}
你现在不是只给下一步建议，而是做 CCS case 复盘教练。下面是本 case 自动记录到的页面/弹窗/医嘱/结果时间线。

请分析用户的选择和操作习惯，输出：

## Case 判断
- 最可能诊断/主问题
- 当前病人稳定性和关键危险点

## 用户已经做对的
- 按 timing / sequencing / location / workup / treatment 分类

## 用户可能漏掉或做晚的
- 具体 order 名称
- 为什么会扣分
- 应该在什么时机做

## 用户特点
- 例如：是否过度检查、是否治疗太晚、是否忘记监测、是否 location 不果断、是否收尾空白

## 下一步建议
- 现在立刻该做的 3-8 个具体 order 或操作

## 训练重点
- 这位用户后面练 CCS 时最该盯住的 3 个习惯

如果时间线信息不足，请明确说“不足”，不要编造用户已经做过的 order。

时间线：
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

function buildOpenAiVisionMessages(base64Image, settings, systemPrompt, pageContext) {
  const history = getRecentTextHistory().map((message) => ({
    role: message.role,
    content: message.content
  }));

  return [
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
  ];
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
  const startedAt = performance.now();

  try {
    const settings = await getSettings();
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
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      latencyMs: Math.round(performance.now() - startedAt),
      error: message
    };
  }
}

async function analyzeScreenshot(base64Image, pageContext) {
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
  usage = result.usage;

  return result.text;
}

async function runAnalysis() {
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
  if (message.type === "GET_STATE") {
    sendResponse(getState());
    return false;
  }

  if (message.type === "NEW_CASE") {
    resetCase();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SET_PAGE_COACH") {
    setPageCoach(message.tabId, Boolean(message.enabled)).then(sendResponse);
    return true;
  }

  if (message.type === "ANALYZE_SCREENSHOT") {
    if (message.openPanel) openSidePanelForSender(_sender);
    runAnalysis().then(sendResponse);
    return true;
  }

  if (message.type === "TEST_MODEL") {
    testModelConnection().then(sendResponse).catch((error) => {
      sendResponse({
        ok: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    });
    return true;
  }

  if (message.type === "CASE_FEEDBACK") {
    if (message.openPanel) openSidePanelForSender(_sender);
    generateCaseFeedback().then(sendResponse);
    return true;
  }

  if (message.type === "RECORD_CONTEXT") {
    const recorded = addCaseEvent(message.event);
    sendResponse({ ok: true, recorded, count: caseEvents.length });
    return false;
  }

  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "analyze-screenshot") {
    runAnalysis();
  }
});
