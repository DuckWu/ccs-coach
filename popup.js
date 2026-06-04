const apiKeyInput = document.getElementById("apiKey");
const providerSelect = document.getElementById("provider");
const languageSelect = document.getElementById("language");
const modelSelect = document.getElementById("model");
const baseUrlInput = document.getElementById("baseUrl");
const customModelField = document.getElementById("customModelField");
const customModelInput = document.getElementById("customModel");
const coachToggle = document.getElementById("coachToggle");
const modelSummary = document.getElementById("modelSummary");
const statusEl = document.getElementById("status");
const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MODEL_PRESETS = {
  anthropic: [
    ["claude-sonnet-4-20250514", "Claude Sonnet 4"],
    ["claude-opus-4-20250514", "Claude Opus 4"],
    ["claude-3-5-haiku-latest", "Claude Haiku"]
  ],
  glm: [
    ["glm-5v-turbo", "GLM-5V Turbo"],
    ["glm-4.6v", "GLM-4.6V"],
    ["glm-4.6v-flash", "GLM-4.6V Flash"],
    ["glm-4.7", "GLM-4.7 Text"]
  ],
  minimax: [
    ["MiniMax-M2.7", "MiniMax M2.7"],
    ["MiniMax-M3.0", "MiniMax M3.0"]
  ]
};
const DEFAULT_BASE_URLS = {
  anthropic: "https://api.anthropic.com",
  glm: "https://open.bigmodel.cn/api/paas/v4",
  minimax: "https://minnimax.chat"
};

function getDefaultModel(provider) {
  return MODEL_PRESETS[provider]?.[0]?.[0] || DEFAULT_MODEL;
}

function renderModelOptions(provider) {
  modelSelect.replaceChildren();
  for (const [value, label] of MODEL_PRESETS[provider] || MODEL_PRESETS.anthropic) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    modelSelect.append(option);
  }

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom model";
  modelSelect.append(customOption);
}

function getPresetModelValues() {
  return Array.from(modelSelect.options)
    .map((option) => option.value)
    .filter((value) => value !== "custom");
}

function syncCustomModelVisibility() {
  customModelField.classList.toggle("hidden", modelSelect.value !== "custom");
}

function syncApiKeyPlaceholder() {
  const placeholders = {
    anthropic: "sk-ant-...",
    glm: "BigModel API key",
    minimax: "MiniMax API key"
  };
  apiKeyInput.placeholder = placeholders[providerSelect.value] || "API key";
}

function syncBaseUrlPlaceholder() {
  baseUrlInput.placeholder = DEFAULT_BASE_URLS[providerSelect.value] || "https://api.example.com";
}

function updateModelSummary() {
  const providerLabel = providerSelect.selectedOptions[0]?.textContent || providerSelect.value;
  const model = getSelectedModel() || getDefaultModel(providerSelect.value);
  const baseUrl = baseUrlInput.value.trim() || DEFAULT_BASE_URLS[providerSelect.value] || "";
  modelSummary.textContent = `${providerLabel} · ${model}${baseUrl ? ` · ${baseUrl.replace(/^https?:\/\//, "")}` : ""}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setStatusState(state, message) {
  statusEl.className = `status ${state}`;
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get(["apiKey", "provider", "language", "model", "baseUrl"]);
  apiKeyInput.value = settings.apiKey || "";
  providerSelect.value = settings.provider || DEFAULT_PROVIDER;
  languageSelect.value = settings.language || "zh";
  baseUrlInput.value = settings.baseUrl || DEFAULT_BASE_URLS[providerSelect.value] || "";
  renderModelOptions(providerSelect.value);

  const savedModel = settings.model || getDefaultModel(providerSelect.value);
  if (getPresetModelValues().includes(savedModel)) {
    modelSelect.value = savedModel;
    customModelInput.value = "";
  } else {
    modelSelect.value = "custom";
    customModelInput.value = savedModel;
  }

  syncCustomModelVisibility();
  syncApiKeyPlaceholder();
  syncBaseUrlPlaceholder();
  updateModelSummary();
}

async function saveSettings() {
  const selectedModel = modelSelect.value === "custom"
    ? customModelInput.value.trim()
    : modelSelect.value;

  if (!selectedModel) {
    setStatusState("error", "Enter a custom model ID.");
    return false;
  }

  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    provider: providerSelect.value,
    language: languageSelect.value,
    model: selectedModel,
    baseUrl: baseUrlInput.value.trim()
  });
  setStatusState("success", "Settings saved.");
  updateModelSummary();
  return true;
}

async function openPanel() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.windowId) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
}

async function sendBackgroundMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function sendTabMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function getCoachStateOnTab(tabId) {
  try {
    const response = await sendTabMessage(tabId, { type: "PING" });
    return {
      available: Boolean(response?.ok),
      enabled: Boolean(response?.widgetEnabled)
    };
  } catch (_error) {
    return {
      available: false,
      enabled: false
    };
  }
}

async function ensureCoachScript(tabId) {
  try {
    const ping = await sendTabMessage(tabId, { type: "PING" });
    if (ping?.ok) return;
  } catch (_error) {
    // Continue and inject the content script.
  }

  if (!chrome.scripting?.executeScript) {
    throw new Error("Coach script is not active yet. Refresh the extension, then refresh this Primum page.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function syncCoachToggleFromActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    coachToggle.checked = false;
    return;
  }

  const state = await getCoachStateOnTab(tab.id);
  coachToggle.checked = state.enabled;
}

async function setCoachOnTab(tabId, enabled) {
  await ensureCoachScript(tabId);
  const response = await sendTabMessage(tabId, {
    type: "SET_WIDGET_ENABLED",
    enabled
  });

  if (!response?.ok) {
    throw new Error("The page did not accept the coach toggle.");
  }
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function getSelectedModel() {
  return modelSelect.value === "custom"
    ? customModelInput.value.trim()
    : modelSelect.value;
}

async function testAnthropicCompatible(settings) {
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
      max_tokens: 64,
      system: "You are a connection test assistant. Keep replies short.",
      messages: [
        {
          role: "user",
          content: "Reply exactly: OK - CCS Coach model test passed."
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }

  return data.content?.find((item) => item.type === "text")?.text || "OK";
}

async function testGlm(settings) {
  const response = await fetch(joinUrl(settings.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 64,
      stream: false,
      messages: [
        {
          role: "system",
          content: "You are a connection test assistant. Keep replies short."
        },
        {
          role: "user",
          content: "Reply exactly: OK - CCS Coach model test passed."
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }

  return data.choices?.[0]?.message?.content || "OK";
}

async function testModelFromPopup() {
  const settings = {
    apiKey: apiKeyInput.value.trim(),
    provider: providerSelect.value,
    language: languageSelect.value,
    model: getSelectedModel(),
    baseUrl: baseUrlInput.value.trim() || DEFAULT_BASE_URLS[providerSelect.value]
  };

  if (!settings.apiKey) throw new Error("Enter an API key first.");
  if (!settings.model) throw new Error("Enter a model ID first.");
  if (!settings.baseUrl) throw new Error("Enter a Base URL first.");

  const startedAt = performance.now();
  const reply = settings.provider === "glm"
    ? await testGlm(settings)
    : await testAnthropicCompatible(settings);

  return {
    ok: true,
    model: settings.model,
    latencyMs: Math.round(performance.now() - startedAt),
    reply
  };
}

document.getElementById("saveSettings").addEventListener("click", saveSettings);
modelSelect.addEventListener("change", () => {
  syncCustomModelVisibility();
  updateModelSummary();
});
baseUrlInput.addEventListener("input", updateModelSummary);
customModelInput.addEventListener("input", updateModelSummary);
providerSelect.addEventListener("change", () => {
  renderModelOptions(providerSelect.value);
  modelSelect.value = getDefaultModel(providerSelect.value);
  customModelInput.value = "";
  baseUrlInput.value = DEFAULT_BASE_URLS[providerSelect.value] || "";
  syncCustomModelVisibility();
  syncApiKeyPlaceholder();
  syncBaseUrlPlaceholder();
  updateModelSummary();
});

document.getElementById("openPanel").addEventListener("click", async () => {
  await openPanel();
  setStatusState("neutral", "Panel opened.");
});

coachToggle.addEventListener("change", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) {
    coachToggle.checked = false;
    setStatusState("error", "No active tab found.");
    return;
  }

  const enabled = coachToggle.checked;
  setStatusState("pending", enabled ? "Starting page coach..." : "Hiding page coach...");

  try {
    await setCoachOnTab(tab.id, enabled);
    setStatusState("success", enabled ? "Coach enabled on this page." : "Coach hidden on this page.");
  } catch (error) {
    coachToggle.checked = !enabled;
    setStatusState("error", error instanceof Error ? error.message : String(error));
  }
});

document.getElementById("testModel").addEventListener("click", async () => {
  const saved = await saveSettings();
  if (!saved) return;
  setStatusState("pending", "Testing model connection...");
  try {
    const response = await testModelFromPopup();
    if (response?.ok) {
      setStatusState(
        "success",
        `Model OK · ${response.model} · ${response.latencyMs} ms`
      );
    } else {
      setStatusState("error", `Test failed · ${response?.latencyMs || 0} ms · ${response?.error || "No response from extension worker"}`);
    }
  } catch (error) {
    setStatusState("error", `Test failed · ${error instanceof Error ? error.message : String(error)}`);
  }
});

loadSettings().then(syncCoachToggleFromActiveTab);
