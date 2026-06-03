# 发布到 Chrome 网上应用店指南

> 将 CCS Coach 发布到 Chrome Web Store，让其他考生也能使用。

---

## 前置准备

1. **Chrome 开发者账号** — $5 一次性费用
   - 访问 https://chrome.google.com/webstore/devconsole
   - 用 Google 账号登录，支付 $5 注册费

2. **准备好以下素材**

| 素材 | 规格 | 说明 |
|---|---|---|
| 图标 (Icon) | 128×128 PNG | 扩展程序图标 |
| 小图标 | 16×16, 48×48 PNG | 工具栏和详情页用 |
| 截图 (Screenshots) | 1280×800 或 640×400 PNG | 至少 1 张，最多 5 张 |
| 宣传图 (Promo Tile) | 440×280 PNG | 可选，用于展示 |
| 应用说明 (Description) | 纯文本 / HTML | 中英文各一份 |

---

## 打包扩展

### 方法一：用 Chrome 打包（推荐）

1. 打开 `chrome://extensions`
2. 启用 **开发者模式**
3. 点击 **"打包扩展程序"**
4. 选择 `d:\claude_code\app\ccs-coach` 作为扩展程序目录
5. 首次发布时私钥留空，Chrome 会生成新的 `.pem` 文件
6. 点击 **"打包扩展程序"**
7. 生成 `.crx` 文件和 `.pem` 私钥文件
8. **⚠️ 务必备份 `.pem` 文件！** 更新版本时需要用它签名

### 方法二：手动打包 ZIP

```
# 在项目目录下执行
cd d:\claude_code\app\ccs-coach
# 只打包必需文件
git archive -o ccs-coach.zip HEAD
```

> 上传到 Chrome Web Store 时用 **ZIP 文件**，不是 .crx。

---

## 发布流程

### 1. 登录开发者控制台

访问 https://chrome.google.com/webstore/devconsole

### 2. 创建新项目

点击 **"New Item"** 按钮

### 3. 上传 ZIP 包

上传打包好的 `ccs-coach.zip`

### 4. 填写应用信息

| 字段 | 推荐内容 |
|---|---|
| **Name** | CCS Coach — USMLE Step 3 CCS Practice Assistant |
| **Description** | 见下方模板 |
| **Category** | Developer Tools → Education / Medical |
| **Language** | English (可额外添加中文) |
| **Icon** | 上传 128×128 图标 |

**Description 模板 (English):**

```
Real-time AI coaching for USMLE Step 3 CCS practice.

CCS Coach is a Chrome extension that provides instant, AI-powered coaching while you practice CCS cases on Primum (starttest.com) or other simulators.

FEATURES:
• Screenshot & Analyze — Capture any CCS screen with Ctrl+Shift+S
• AI-Powered Guidance — Claude / GLM Vision understands your screen and gives structured advice
• Conversation Memory — Coherent, context-aware suggestions across multiple screenshots
• Case Timeline — Automatically tracks your decisions throughout the case
• Case Debrief — End-of-case feedback analyzing your habits and missed items
• Multi-Provider — Supports Anthropic Claude, GLM (Zhipu AI), and MiniMax
• Bilingual Output — Chinese, English, or bilingual mode

HOW IT WORKS:
1. Start a CCS case on starttest.com or any simulator
2. Press Ctrl+Shift+S to capture the current screen
3. Get structured advice immediately in the side panel
4. Act on the guidance, take the next step, and capture again
5. At case end, get a full debrief report

Perfect for USMLE Step 3 test-takers who want a personal coach beside them during practice.
```

**Description 模板 (中文，可选加第二语言):**

```
USMLE Step 3 CCS 实时练习辅导工具。

CCS Coach 是一款 Chrome 浏览器插件，在你使用 Primum（starttest.com）等 CCS 模拟器练习时，提供即时的 AI 辅导建议。

功能：
• 一键截图分析 — Ctrl+Shift+S 截取当前画面
• AI 智能指导 — Claude / GLM Vision 理解界面并给出结构化建议
• 对话记忆 — 基于多轮截图给出连贯建议
• 病例时间线 — 自动记录操作过程
• 病例复盘 — 结束后分析操作习惯和漏分点
• 多模型支持 — 支持 Anthropic Claude、GLM、MiniMax
• 双语输出 — 中文 / English / 中英双语

使用方法：
1. 打开 CCS 模拟器开始练习
2. 按 Ctrl+Shift+S 截图分析当前画面
3. 在侧边栏查看实时指导
4. 根据建议操作，继续截图分析
5. Case 结束后获取完整复盘报告
```

### 5. 隐私与权限

在 **Privacy** 页面：

- **Single Purpose**: "Real-time coaching assistance for USMLE Step 3 CCS practice."
- **Permission Justification**: 逐条解释申请的权限

| 权限 | 理由 |
|---|---|
| `activeTab` | 仅在使用时截取当前页面截图进行分析 |
| `scripting` | 注入浮动教练按钮和页面变化监听 |
| `sidePanel` | 在侧边栏显示 AI 建议 |
| `storage` | 保存你的 API Key 和语言偏好设置 |
| `host_permissions` | 连接到你所选的 AI 模型 API，不会访问其他网站 |

- **Remote Code**: 声明未使用远程代码（不加载外部脚本）
- **Data Usage**: 所有数据仅在本地处理，截图只发送到你配置的 API

### 6. 提交审核

1. 填写完所有信息后，点击 **"Submit for Review"**
2. 审核通常需要 **几个小时到几天**（首次可能 1-3 个工作日）
3. 审核通过后自动发布

---

## 更新版本

1. 修改 `manifest.json` 中的 `version` 字段（遵循 [semver](https://semver.org/)）
2. 重新打包 ZIP
3. 在开发者控制台点击已有项目 → **Upload Updated Package**
4. 再次提交审核

> 小版本更新审核更快，通常 < 24 小时。

---

## 常见问题

### Q: 需要 .pem 文件吗？
**需要。** 首次打包时生成的 `.pem` 私钥文件必须保留，后续更新需要用它签名。**丢失 .pem 文件将无法更新已发布的扩展，只能重新发布一个新项目。**

### Q: 用户需要自己配置 API Key 吗？
**是的。** CCS Coach 不内置 API key，用户需要准备自己的 Anthropic / GLM / MiniMax API key。这是一个 conscious design choice——避免被认定为"收费服务"，也方便用户控制费用。

### Q: 审核可能被拒绝的原因？
- 权限申请过多（我们已经最小化到必需的权限）
- 缺乏隐私政策（如需要，可以简单在 GitHub Pages 上挂一个）
- 功能描述不清晰（按上面的模板填写即可）

### Q: 如何在描述中提到"USMLE"？
USMLE 是注册商标，可以提及作为兼容性说明（"for USMLE Step 3 CCS practice"），但不要误导用户认为这是官方产品。
