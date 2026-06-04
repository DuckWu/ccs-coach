if (window.__ccsCoachContentLoaded) {
  // MV3 can inject the content script manually after declarative injection.
} else {
window.__ccsCoachContentLoaded = true;

let coachWidget;
let recordTimer;
let lastRecordedSignature = "";
let widgetEnabled = false;
const isTopFrame = window.top === window;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }));
}

function createCoachWidget() {
  if (coachWidget) return;

  coachWidget = document.createElement("div");
  coachWidget.id = "ccs-coach-widget";
  coachWidget.className = "ccs-coach-disabled";
  coachWidget.innerHTML = `
    <button class="ccs-coach-tab" type="button" aria-label="Open CCS Coach">CCS</button>
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
  const closeButton = coachWidget.querySelector('[aria-label="Collapse CCS Coach"]');
  if (closeButton) {
    closeButton.dataset.action = "close";
    closeButton.setAttribute("aria-label", "Close CCS Coach");
    closeButton.textContent = "x";
  }

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
      display: none;
    }

    #ccs-coach-widget:not(:hover) .ccs-coach-panel,
    #ccs-coach-widget.ccs-coach-hover-closed .ccs-coach-panel {
      display: none;
    }

    #ccs-coach-widget:not(:hover) .ccs-coach-tab,
    #ccs-coach-widget.ccs-coach-hover-closed .ccs-coach-tab {
      opacity: 0.92;
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

    if (button.dataset.action === "toggle" || button.dataset.action === "close") {
      coachWidget.classList.add("ccs-coach-hover-closed");
      if (button === document.activeElement) button.blur();
    } else if (button.dataset.action === "analyze") {
      sendMessage({ type: "ANALYZE_SCREENSHOT", openPanel: true });
    } else if (button.dataset.action === "feedback") {
      sendMessage({ type: "CASE_FEEDBACK", openPanel: true });
    } else if (button.dataset.action === "new-case") {
      sendMessage({ type: "NEW_CASE" });
    }
  });

  coachWidget.addEventListener("mouseleave", () => {
    coachWidget.classList.remove("ccs-coach-hover-closed");
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
    coachWidget.classList.remove("ccs-coach-hover-closed");
    // 打开开关 = 开始一个全新 case，先清空历史（等同 New Case）
    lastRecordedSignature = "";              // 清掉本地去重签名，确保开场能被记录
    sendMessage({ type: "NEW_CASE" }).then(() => {
      scheduleRecord("coach-start");          // reset 完成后再记录开场
    });
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

function normalizeExtractedText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function isScrollableElement(element) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const canScroll = overflowY === "auto" || overflowY === "scroll";
  return canScroll && element.scrollHeight > element.clientHeight + 24;
}
function looksLikeVirtualScroll(element, capturedTextLength) {
  const visibleRatio = element.clientHeight / Math.max(1, element.scrollHeight);
  // 可见区只占很小一部分，但抓到的文本量却和可见区差不多 → 怀疑虚拟滚动。
  // 估算：如果非虚拟，capturedTextLength 应大致覆盖全部高度对应的文本。
  // 用一个保守阈值：可见比例 < 0.5（说明有大量内容在视口外），
  // 且抓到的文本"密度"看起来只对应可见区。
  // 实战中很难精确，这里只做保守提示，不影响主流程。
  if (visibleRatio >= 0.85) return false; // 几乎全可见，无所谓
  // 没有更强信号时，默认认为是普通 overflow（textContent 全量），
  // 仅当元素带有常见虚拟滚动标记时才判为虚拟滚动。
  const cls = (element.className || "").toString().toLowerCase();
  const hasVirtualHint = /virtual|rv-|ReactVirtualized|cdk-virtual|vue-recycle|infinite/i.test(cls)
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
function extractScrollableText(candidates) {
  return candidates
    .filter((element) => isVisible(element) && isScrollableElement(element))
    .map((element, index) => {
      const text = normalizeExtractedText(element.textContent || getElementText(element));
      if (!text) return "";
 
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const remaining = Math.max(0, maxScroll - element.scrollTop);
      const virtual = looksLikeVirtualScroll(element, text.length);
 
      let note;
      if (virtual) {
        // 真有丢内容风险：提示用户滚动。
        note = remaining > 24
          ? "可能为虚拟滚动，未显示部分可能未被抓取，建议滚动到底部后再 Ask Coach"
          : "可能为虚拟滚动，已滚到底部";
      } else {
        // 普通 overflow：textContent 已含全文，明确告诉模型可放心使用全文。
        note = "完整文本（含当前未显示在视口内的部分）已抓取，可直接使用";
      }
 
      return `[Scrollable window ${index + 1}: ${note}]\n${text}`;
    })
    .filter(Boolean);
}
function extractVisibleText() {
  const candidates = Array.from(document.body.querySelectorAll(
    "body, dialog, [role='dialog'], form, div, table, td, th, p, span, button, input, textarea, select"
  ));
  const visibleText = candidates
    .filter(isVisible)
    .map(getElementText)
    .map(normalizeExtractedText)
    .filter(Boolean);
 
  const scrollableText = extractScrollableText(candidates);
 
  return Array.from(new Set([...visibleText, ...scrollableText]))
    .join("\n")
    .slice(0, 9000);
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true, widgetEnabled });
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
