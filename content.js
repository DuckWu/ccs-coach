if (window.__ccsCoachContentLoaded) {
  // MV3 can inject the content script manually after declarative injection.
} else {
window.__ccsCoachContentLoaded = true;

let lastShortcutAt = 0;
let coachWidget;
let recordTimer;
let lastRecordedSignature = "";
let widgetEnabled = false;
const isTopFrame = window.top === window;

function sendMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function createCoachWidget() {
  if (coachWidget) return;

  coachWidget = document.createElement("div");
  coachWidget.id = "ccs-coach-widget";
  coachWidget.className = "ccs-coach-disabled ccs-coach-collapsed";
  coachWidget.innerHTML = `
    <button class="ccs-coach-tab" type="button" data-action="toggle" aria-label="Toggle CCS Coach">CCS</button>
    <section class="ccs-coach-panel" aria-label="CCS Coach controls">
      <div class="ccs-coach-head">
        <strong>CCS Coach</strong>
        <button type="button" data-action="toggle" aria-label="Collapse CCS Coach">×</button>
      </div>
      <p>Record the case quietly. Ask only when you need help.</p>
      <button type="button" data-action="new-case">New Case</button>
      <button type="button" data-action="analyze">Ask Coach</button>
      <button type="button" data-action="feedback">End Case & Feedback</button>
    </section>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #ccs-coach-widget {
      position: fixed;
      left: 0;
      top: 54%;
      transform: translateY(-50%);
      z-index: 2147483647;
      display: grid;
      grid-template-columns: auto auto;
      align-items: stretch;
      font: 12px/1.2 "SF Pro Display", "Geist Sans", "Helvetica Neue", Arial, sans-serif;
    }

    #ccs-coach-widget.ccs-coach-disabled {
      display: none;
    }

    #ccs-coach-widget.ccs-coach-hidden {
      visibility: hidden;
    }

    #ccs-coach-widget .ccs-coach-tab {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      min-width: 42px;
      min-height: 106px;
      border-radius: 0 8px 8px 0;
      border: 1px solid #1d7564;
      border-left: 0;
      background: #1d7564;
      color: white;
      box-shadow: 0 14px 30px rgba(47, 52, 55, 0.16);
      letter-spacing: 0.08em;
    }

    #ccs-coach-widget .ccs-coach-panel {
      width: 218px;
      padding: 12px;
      border: 1px solid #e7e3dc;
      border-left: 0;
      border-radius: 0 10px 10px 0;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 16px 36px rgba(47, 52, 55, 0.12);
      backdrop-filter: blur(12px);
    }

    #ccs-coach-widget.ccs-coach-collapsed .ccs-coach-panel {
      display: none;
    }

    #ccs-coach-widget .ccs-coach-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    #ccs-coach-widget strong {
      color: #171717;
      font-size: 15px;
      letter-spacing: -0.01em;
    }

    #ccs-coach-widget p {
      margin: 0 0 10px;
      color: #6f6e69;
      line-height: 1.35;
    }

    #ccs-coach-widget button {
      width: 100%;
      min-height: 34px;
      margin-top: 7px;
      border: 1px solid #1d7564;
      border-radius: 6px;
      background: #1d7564;
      color: white;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      transition: background 180ms ease, transform 120ms ease, border-color 180ms ease;
    }

    #ccs-coach-widget .ccs-coach-head button {
      width: 28px;
      min-height: 28px;
      margin: 0;
      border-color: #e7e3dc;
      background: white;
      color: #6f6e69;
      font-size: 18px;
      line-height: 1;
    }

    #ccs-coach-widget button[data-action="new-case"] {
      background: white;
      color: #9f2f2d;
      border-color: #f1c9cc;
    }

    #ccs-coach-widget button[data-action="feedback"] {
      background: #111111;
      border-color: #111111;
    }

    #ccs-coach-widget button:hover {
      background: #155d50;
      border-color: #155d50;
    }

    #ccs-coach-widget button[data-action="new-case"]:hover {
      background: #fdebec;
      border-color: #e9babd;
    }

    #ccs-coach-widget button:active {
      transform: translateY(1px) scale(0.98);
    }

  `;

  document.documentElement.append(style, coachWidget);
  coachWidget.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.action === "toggle") {
      coachWidget.classList.toggle("ccs-coach-collapsed");
    } else if (button.dataset.action === "analyze") {
      sendMessage({ type: "ANALYZE_SCREENSHOT", openPanel: true });
    } else if (button.dataset.action === "feedback") {
      sendMessage({ type: "CASE_FEEDBACK", openPanel: true });
    } else if (button.dataset.action === "new-case") {
      sendMessage({ type: "NEW_CASE" });
    }
  });
}

function setWidgetHidden(isHidden) {
  if (!isTopFrame) return;
  coachWidget?.classList.toggle("ccs-coach-hidden", isHidden);
}

function setWidgetEnabled(enabled) {
  if (!isTopFrame) return;
  widgetEnabled = enabled;
  createCoachWidget();
  coachWidget.classList.toggle("ccs-coach-disabled", !enabled);
  if (enabled) {
    coachWidget.classList.remove("ccs-coach-collapsed");
    scheduleRecord("coach-start");
  }
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== "hidden"
    && style.display !== "none"
    && Number(style.opacity) !== 0
    && rect.width > 0
    && rect.height > 0;
}

function extractVisibleText() {
  const candidates = Array.from(document.body.querySelectorAll("body, dialog, [role='dialog'], div, table, td, th, p, span, button"));
  const visibleText = candidates
    .filter(isVisible)
    .map((element) => element.innerText || element.textContent || "")
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return Array.from(new Set(visibleText))
    .join("\n")
    .slice(0, 5000);
}

function getTextSignature(text) {
  return text.replace(/\W+/g, "").slice(0, 240);
}

function recordVisibleContext(source = "auto") {
  const text = extractVisibleText();
  if (text.length < 20) return;

  const signature = getTextSignature(text);
  if (signature === lastRecordedSignature) return;
  lastRecordedSignature = signature;

  sendMessage({
    type: "RECORD_CONTEXT",
    event: {
      source,
      title: document.title,
      url: location.href,
      text
    }
  });
}

function scheduleRecord(source = "auto") {
  clearTimeout(recordTimer);
  recordTimer = setTimeout(() => recordVisibleContext(source), 700);
}

if (isTopFrame) {
  document.addEventListener("keydown", (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || !event.shiftKey || event.key.toLowerCase() !== "s") return;

    const now = Date.now();
    if (now - lastShortcutAt < 1500) return;
    lastShortcutAt = now;

    event.preventDefault();
    sendMessage({ type: "ANALYZE_SCREENSHOT", openPanel: true });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SET_WIDGET_ENABLED") {
    setWidgetEnabled(Boolean(message.enabled));
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SET_WIDGET_HIDDEN") {
    setWidgetHidden(Boolean(message.hidden));
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "EXTRACT_PAGE_CONTEXT") {
    sendResponse({
      ok: true,
      title: document.title,
      url: location.href,
      text: extractVisibleText()
    });
    return false;
  }

  return false;
});

scheduleRecord("page-load");

const observer = new MutationObserver(() => scheduleRecord("page-change"));
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["style", "class", "hidden", "aria-hidden"]
});

document.addEventListener("click", () => scheduleRecord("click"), true);
}
