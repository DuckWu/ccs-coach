# Privacy Policy

**Last updated:** June 2, 2026

## Overview

CCS Coach ("the Extension") is a Chrome browser extension designed to provide real-time AI coaching assistance for USMLE Step 3 CCS practice. This privacy policy explains what data the Extension collects, how it is used, and your rights regarding that data.

## Data Collection

### What We Collect

The Extension operates **entirely on your local machine** and communicates only with the AI model provider you explicitly configure (Anthropic, GLM, or MiniMax). We do not operate any servers, and we do not collect, store, or transmit any data to third parties beyond what you explicitly authorize.

Specifically, the Extension may process the following types of data:

| Data Type | Description | Storage / Transmission |
|---|---|---|
| **Screenshots** | When you trigger an analysis (via shortcut or button), the Extension captures a screenshot of your current browser tab. This image is sent to the AI model provider you configured for analysis. | Sent only to your configured API endpoint. Never stored locally after analysis. |
| **Page text content** | Visible text from the current page is extracted alongside screenshots to improve analysis accuracy. | Sent to your configured API endpoint with the screenshot. |
| **API credentials** | Your API key (for Anthropic, GLM, or MiniMax) is entered manually by you in the Extension's settings. | Stored locally via `chrome.storage.local`. Never transmitted outside of API calls to your configured provider. |
| **Preferences** | Language selection (Chinese/English/Bilingual), model choice, and provider selection. | Stored locally via `chrome.storage.local`. |
| **Conversation history** | Previous analysis requests and AI responses within a single case session. | Held in memory during your session. Cleared when you start a "New Case" or close the browser. |

### What We Do NOT Collect

- ❌ **No personal identification data** — we do not collect your name, email, or any personally identifiable information
- ❌ **No browsing history** — we do not track which websites you visit (except the active tab when you trigger analysis)
- ❌ **No analytics or telemetry** — we do not use analytics SDKs, cookies, or tracking pixels
- ❌ **No advertising** — we do not serve ads or share data with ad networks
- ❌ **No background data collection** — data is only captured when you explicitly trigger an analysis or enable the coaching widget

## Data Storage

### Local Storage

The following data is stored locally in your browser using `chrome.storage.local`:

- **API key**: Encrypted at rest by Chrome's storage system. You can delete it at any time via the Extension's settings.
- **Language preference**: Stored as a simple string.
- **Model/provider configuration**: Your selected model and provider settings.

This data never leaves your browser except when making API calls to your configured provider.

### Data Transmitted to Third Parties

When you use the analysis feature, the following is sent to the **AI model provider you configured** (Anthropic, GLM, or MiniMax):

- The screenshot of your current browser tab
- Visible text content from the page
- A system prompt containing USMLE Step 3 CCS coaching templates
- Prior conversation history within the current case session

This transmission is governed by the privacy policy and terms of service of the respective provider:

- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [GLM / BigModel Privacy Policy](https://open.bigmodel.cn/privacy)
- [MiniMax Privacy Policy](https://api.minimax.chat/privacy)

### What We Recommend You Do Not Capture

- Do not capture screenshots containing personal information (passwords, financial data, etc.)
- Do not enter real patient data into CCS simulators during practice sessions
- Use the "New Case" button to clear conversation history between sessions

## Data Security

- All API communications use **HTTPS encryption** (TLS 1.2/1.3)
- No data is stored on any server operated by the Extension developer
- The Extension does not use any third-party analytics, monitoring, or crash-reporting services
- API keys are stored using Chrome's built-in secure storage (`chrome.storage.local`)

## Your Rights and Choices

- **You control your API key**: You can remove it at any time via the Extension settings
- **You control when data is sent**: Analysis only happens when you explicitly trigger it
- **You can clear all data**: Click "New Case" to clear conversation history, or remove the Extension entirely to delete all locally stored data
- **You can choose your AI provider**: The Extension supports multiple providers, each with their own data handling practices

## Children's Privacy

The Extension is intended for medical professionals and students preparing for the USMLE Step 3 examination. It is not intended for use by individuals under the age of 18.

## Changes to This Policy

If this privacy policy is updated, the "Last updated" date at the top of this document will be revised. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository:

https://github.com/DuckWu/ccs-coach

---

## 隐私政策（中文摘要）

CCS Coach 是一款本地运行的 Chrome 浏览器插件，**不运营任何服务器**，**不收集任何个人身份信息**。

### 数据处理说明

- **截图**：仅在您主动触发分析时截取当前标签页画面，发送给您配置的 AI 模型提供商
- **API Key**：存储在本地浏览器中，仅用于向您配置的提供商发起 API 请求
- **偏好设置**：语言、模型选择等存储在本地
- **对话记录**：仅在本次 case 会话期间保存在内存中，点击"New Case"或关闭浏览器即清除

### 不收集的数据

不收集浏览历史、个人身份信息、分析统计数据。不使用广告、跟踪器或第三方分析服务。

### 您的选择

可随时在设置中删除 API Key、清除对话历史、或卸载插件删除所有本地数据。
