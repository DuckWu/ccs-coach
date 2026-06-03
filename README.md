# CCS Coach 🩺

> Real-time USMLE Step 3 CCS practice coach — a Chrome extension that screenshots your current screen and returns AI-powered coaching advice in seconds.

---

## Overview

**CCS Coach** is a Chrome Extension (Manifest V3) built for medical students preparing for the **USMLE Step 3 CCS** (Computer-based Case Simulations).

When you practice on the official Primum software (e.g., starttest.com) or third-party CCS simulators, CCS Coach lets you:

1. **Capture** the current screen with one click
2. Send the screenshot to a **Vision-capable LLM** (Claude, GLM, or MiniMax)
3. Get **structured coaching advice** in Chinese, English, or both — instantly

**Target users**: Chinese-native speakers using Primum to prepare for Step 3 CCS.

---

## Features

| Feature | Description |
|---|---|
| 📸 **Screenshot Analysis** | `Ctrl+Shift+S` captures the current CCS screen and sends it to AI for real-time analysis |
| 🧠 **Conversation Memory** | Remembers the last ~10 rounds of analysis for coherent, context-aware suggestions |
| 📋 **Case Timeline** | Automatically logs page changes and builds a complete timeline for the current case |
| 🔄 **Case Debrief** | Generates an end-of-case review report — analyzes your habits and missed scoring opportunities |
| 🌐 **Multi-Provider** | Supports Anthropic Claude, GLM (Zhipu AI), and MiniMax — pick your preferred model |
| 🌍 **Bilingual Output** | Chinese / English / Bilingual output modes |
| 🖱️ **Floating Widget** | A sidebar button on the target page for quick access: New Case / Ask Coach / End & Feedback |
| ⚡ **Keyboard Shortcut** | `Ctrl+Shift+S` (Win) / `Cmd+Shift+S` (Mac) triggers analysis from any page |

---

## Quick Start

### 1. Install

1. Navigate to `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **"Load unpacked"** and select the project directory

### 2. Configure

Click the CCS Coach icon in the Chrome toolbar to open the popup:

- **API Key**: Enter your model provider's API key (Anthropic / GLM / MiniMax)
- **Model**: Select from presets or enter a custom model ID
- **Language**: 中文 (Chinese) / English / 中英双语 (Bilingual)
- **Base URL**: Auto-populated per provider, or set a custom endpoint

Click **Save**, then **Test Model** to verify connectivity.

### 3. Practice Workflow

```
1. Open starttest.com (or any CCS simulator), start a case
2. Press Ctrl+Shift+S (or click "Ask Coach") to capture the screen
3. The side panel opens automatically with AI coaching suggestions
4. Act on the advice, take the next step, capture again → get updated guidance
5. When the case ends, click "Case Feedback" for a full debrief
6. Click "New Case" to reset and start fresh
```

### Advice Format

Each analysis returns structured guidance:

```
## Assessment
  (Opening / Working up / Awaiting results / Treating / Closing)

## Next Steps
  - Specific orders (English name + rationale)
  - Priority-ranked actions

## Don't Forget
  - Easy-to-miss scoring items

## Pitfalls
  - The most common mistakes at this stage
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                  │
│                                                  │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Popup     │  │  Content   │  │  Side      │  │
│  │  (Settings)│  │  Script    │  │  Panel     │  │
│  │  + Toggle) │  │ (Capture)  │  │  (Chat UI) │  │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  │
│        │              │               │          │
│        └──────┬───────┘               │          │
│               ▼                       │          │
│        ┌─────────────┐               │          │
│        │  Background  │◄──────────────┘          │
│        │  Service     │                          │
│        │  Worker      │                          │
│        └──────┬───────┘                          │
└───────────────┼──────────────────────────────────┘
                │
                ▼  HTTPS
        ┌───────────────┐
        │  LLM API      │
        │  (Claude /    │
        │  GLM /        │
        │  MiniMax)     │
        └───────────────┘
```

### File Structure

| File | Responsibility |
|---|---|
| `manifest.json` | Extension config & permissions (Manifest V3) |
| `popup.html` + `popup.js` | Popup UI — API key, language, model settings, toggle |
| `background.js` | Service worker — screenshot capture, API calls, conversation history & case timeline |
| `sidepanel.html` + `sidepanel.js` | Side panel UI — chat interface for AI advice display |
| `content.js` | Content script — floating widget, keyboard shortcut, auto page-change recording |
| `styles.css` | Global styles |
| `prompts/system.md` | System prompt — 3-tier Order template library, scoring traps, grading criteria |

---

## Configuration

### Supported Providers

| Provider | Default Base URL | Preset Models |
|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | Claude Sonnet 4 / Opus 4 / Haiku 3.5 |
| **GLM (Zhipu AI)** | `https://open.bigmodel.cn/api/paas/v4` | GLM-5V Turbo / GLM-4.6V / GLM-4.7 |
| **MiniMax** | `https://minnimax.chat` | MiniMax M2.7 / M3.0 |

> The extension automatically appends `/v1/messages` for Anthropic-compatible APIs and `/chat/completions` for OpenAI-compatible (GLM) APIs.

### Conversation & Memory Management

- Retains the last **10 rounds** of screenshot analysis in conversation history
- Case timeline stores the last **80 events** (auto-recorded page changes + manual captures)
- Older entries are truncated automatically to keep token usage manageable

---

## Development Status

| Phase | Status | Deliverable |
|---|---|---|
| Phase 0 — Environment Setup | ✅ Done | Skeleton extension + `manifest.json` |
| Phase 1 — Screenshot + API | ✅ Done | Core pipeline: capture → API → display |
| Phase 2 — History + Prompt | ✅ Done | Full conversation + Order template library |
| Phase 3 — Shortcuts + UI | ✅ Done | MVP ready |
| Phase 4 — End-to-End Testing | ⏳ In Progress | 6 official Practice Cases |
| Phase 5 — Iteration | ⏳ Planned | Improvements based on test results |

### Planned Test Cases

| Case | Disease | Key Validation |
|---|---|---|
| Case 1 | Tension Pneumothorax | Does the AI prioritize needle thoracostomy immediately? |
| Case 2 | Rheumatoid Arthritis | Avoids over-ordering, mentions DMARD + NSAID |
| Case 3 | Ascending Aortic Dissection | Sequencing: β-blocker before imaging |
| Case 4 | Asthma (Pediatric) | Inhaled route over IM/PO, counseling |
| Case 5 | DKA + Sepsis | Antibiotics immediately after cultures |
| Case 6 | Eclampsia | MgSO4 first, fetal monitoring + delivery |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` (Windows/Linux) / `Cmd+Shift+S` (Mac) | Capture & analyze current screen |
| Click floating `CCS` tab | Toggle floating coach widget |

---

## Cost Estimate

| Item | Cost |
|---|---|
| Chrome Web Developer account | $5 one-time |
| Anthropic API (Sonnet) | ~$0.10–0.20 / case |
| Anthropic API (Haiku) | ~$0.02–0.05 / case |
| Proxy server (if needed) | Free tier of Cloudflare Worker |
| **Total for prep cycle** | **< $20** |

---

## Order Template Library

The extension includes a comprehensive **3-tier Order template library** embedded in the system prompt:

1. **Tier 1** — Universal opening orders (muscle memory for any emergency case)
2. **Tier 2** — Chief-complaint-based initial workup templates (chest pain, dyspnea, abdominal pain, sepsis, altered mental status, GI bleed)
3. **Tier 3** — Closing screen scoring items (counseling, prevention, discharge management)

Plus 7 universal scoring trap checklists.

> See `prompts/system.md` for the full content.

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Screenshot blocked / returns blank | Fall back to DOM scraping or `desktopCapture` API |
| Vision misreads small text/numbers | Zoom in before capture + supplement with DOM text |
| Conversation history grows too large | Limit to last 10 rounds + older round summarization |
| API latency > 5 seconds | Switch to faster model (Haiku) for speed |
| CORS / browser direct-connection limits | `anthropic-dangerous-direct-browser-access` header or Cloudflare Worker proxy |

---

## Contributing

This project is open source under the MIT license. Issues and PRs are welcome.

---

## License

MIT

---

## Acknowledgments

- Inspired by the USMLE Step 3 CCS prep community
- Order templates based on official USMLE scoring guidelines and community consensus
- AI analysis powered by Claude Sonnet 4, GLM, and MiniMax models
