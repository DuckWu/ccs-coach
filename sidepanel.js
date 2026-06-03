const messagesEl = document.getElementById("messages");
const summaryEl = document.getElementById("summary");
const tokenUsageEl = document.getElementById("tokenUsage");

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function appendList(container, items, ordered = false) {
  const list = document.createElement(ordered ? "ol" : "ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = renderInlineMarkdown(item);
    list.append(li);
  }
  container.append(list);
}

function appendTable(container, lines) {
  const table = document.createElement("table");
  const rows = lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  for (const [rowIndex, row] of rows.entries()) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const el = document.createElement(rowIndex === 0 ? "th" : "td");
      el.innerHTML = renderInlineMarkdown(cell);
      tr.append(el);
    }
    table.append(tr);
  }
  container.append(table);
}

function renderMarkdown(container, text) {
  const lines = String(text || "").split(/\r?\n/);
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let table = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    p.innerHTML = renderInlineMarkdown(paragraph.join(" "));
    container.append(p);
    paragraph = [];
  }

  function flushList() {
    if (list.length) appendList(container, list, false);
    if (orderedList.length) appendList(container, orderedList, true);
    list = [];
    orderedList = [];
  }

  function flushTable() {
    if (table.length) appendTable(container, table);
    table = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (/^\|.+\|$/.test(line)) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }

    flushTable();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 2, 4);
      const h = document.createElement(`h${level}`);
      h.innerHTML = renderInlineMarkdown(heading[2]);
      container.append(h);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      orderedList = [];
      list.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      list = [];
      orderedList.push(numbered[1]);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      const hr = document.createElement("hr");
      container.append(hr);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushTable();
}

function renderMessage(item) {
  const article = document.createElement("article");
  article.className = `message ${item.role}`;

  const title = document.createElement("h2");
  title.textContent = item.role === "assistant" ? "Coach" : "Captured";
  article.append(title);

  const body = document.createElement("div");
  body.className = "message-body";
  if (item.role === "assistant") {
    renderMarkdown(body, item.text);
  } else {
    body.textContent = item.text;
  }
  article.append(body);

  return article;
}

function renderState(state) {
  messagesEl.replaceChildren();
  const eventCount = state.caseEventsCount || 0;
  summaryEl.textContent = state.isLoading
    ? "Analyzing..."
    : `${state.items.length} updates · ${eventCount} recorded`;

  if (!state.items.length && !state.isLoading) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Open a CCS case and analyze the current screen.";
    messagesEl.append(empty);
  }

  for (const item of state.items) {
    messagesEl.append(renderMessage(item));
  }

  if (state.isLoading) {
    const loading = document.createElement("div");
    loading.className = "loading";
    loading.textContent = "Analyzing screenshot...";
    messagesEl.append(loading);
  }

  const usage = state.usage || {};
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  tokenUsageEl.textContent = input || output ? `${input} in / ${output} out` : "";
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  renderState(state);
}

document.getElementById("analyze").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "ANALYZE_SCREENSHOT" });
});

document.getElementById("feedback").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CASE_FEEDBACK" });
});

document.getElementById("newCase").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "NEW_CASE" });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE_UPDATED") {
    renderState(message.state);
  }
});

refresh();
