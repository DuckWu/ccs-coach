# CCS Coach 🩺

> 实时 USMLE Step 3 CCS 练习辅导浏览器插件。
> 截图即问，AI 实时反馈——相当于一位熟悉所有评分套路的教练在旁边陪你练。

---

## 项目简介

CCS Coach 是一款 Chrome 浏览器插件（Manifest V3），专为准备 **USMLE Step 3 CCS**（计算机模拟病例）的考生设计。

当你使用官方 Primum 软件（如 starttest.com）或第三方 CCS 模拟器练习时，CCS Coach 可以：

1. **一键截取**当前屏幕画面
2. 将截图发送给 **Claude**（支持 Vision 能力的 AI 模型）
3. **实时返回**结构化中文/英文辅导建议

目标用户：用 Primum 备考 Step 3 的中文母语考生。

---

## 核心特性

| 特性 | 说明 |
|---|---|
| 📸 **截图分析** | `Ctrl+Shift+S` 一键截图，AI 视觉理解当前界面 |
| 🧠 **对话记忆** | 记住前几轮分析，建议前后连贯（"你已经做了 XX，现在该做 YY"） |
| 📋 **病例时间线** | 自动记录页面变化，生成本 case 完整时间线 |
| 🔄 **病例复盘** | Case 结束后生成复盘报告，分析用户操作习惯和漏分点 |
| 🌐 **多模型支持** | 支持 Anthropic Claude、GLM（智谱）、MiniMax 三种模型提供商 |
| 🌍 **中英双语** | 中文 / English / 中英双语 三种输出模式 |
| 🖱️ **浮动教练按钮** | 页面左侧悬浮按钮，"新 Case / 问问教练 / 结束复盘" 一键操作 |
| ⚡ **快捷键** | `Ctrl+Shift+S`（Mac: `Cmd+Shift+S`）直接触发分析 |

---

## 使用方法

### 1. 安装

1. 在 Chrome 地址栏输入 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. 点击 **"加载已解压的扩展程序"**，选择本项目所在目录

### 2. 配置

点击工具栏的 CCS Coach 图标打开弹出面板：

- **API Key**：输入你的模型 API key（Anthropic / GLM / MiniMax）
- **模型选择**：选预设模型或自定义模型 ID
- **语言**：中文 / English / 中英双语
- **Base URL**：默认对应所选提供商，也可自定义

点击 **Save** 保存，点击 **Test Model** 测试连通。

### 3. 练习流程

```
1. 打开 starttest.com（或其它 CCS 模拟器），开始一个 Case
2. 按 Ctrl+Shift+S（或点"Ask Coach"）截取当前屏幕
3. 侧边栏自动打开，显示 Claude 的实时建议
4. 根据建议操作后，再次截图 → 获得下一步建议
5. Case 结束后，点 "Case Feedback" 获取全盘复盘
6. 开始新 Case 时，点 "New Case" 清空历史
```

### 建议输出格式

每次分析，CCS Coach 会返回结构化的指导：

```
## 当前判断
（开场/检查中/等结果/治疗中/收尾）

## 现在该做
- 具体医嘱 1（英文名 + 中文解释）
- 具体医嘱 2

## 别忘了
- 容易漏的给分点

## 别踩坑
- 当前阶段最容易犯的错
```

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                  │
│                                                  │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Popup     │  │  Content   │  │  Side      │  │
│  │  (开关+    │  │  Script    │  │  Panel     │  │
│  │   设置)    │  │  (截图)    │  │  (对话UI)  │  │
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

### 核心文件

| 文件 | 职责 |
|---|---|
| `manifest.json` | Extension 配置、权限声明（Manifest V3） |
| `popup.html` + `popup.js` | 弹出控制面板（API Key 输入、语言选择、开关） |
| `background.js` | Service worker，管理截图、调 API、维护对话历史与时间线 |
| `sidepanel.html` + `sidepanel.js` | 侧边栏 UI，显示 AI 实时建议与对话记录 |
| `content.js` | 内容脚本，注入浮动按钮 + 快捷键监听 + 自动记录页面变化 |
| `styles.css` | 全局样式 |
| `prompts/system.md` | 系统提示词，内含三层 Order 模板库 + 扣分陷阱 + 评分标准 |

---

## 配置详情

### 支持的模型提供商

| 提供商 | 默认 Base URL | 预设模型 |
|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | Claude Sonnet 4 / Opus 4 / Haiku 3.5 |
| **GLM (智谱)** | `https://open.bigmodel.cn/api/paas/v4` | GLM-5V Turbo / GLM-4.6V / GLM-4.7 |
| **MiniMax** | `https://minnimax.chat` | MiniMax M2.7 / M3.0 |

> 提示：Base URL 末尾自动补 `/v1/messages`（Anthropic 兼容 API）或 `/chat/completions`（GLM OpenAI 兼容 API）。

### 对话历史管理

- 保留最近 **10 轮** 截图分析记录
- 病例时间线保留最近 **80 条** 事件记录
- 旧轮次自动截断，控制 token 消耗

---

## 开发状态

| 阶段 | 状态 | 产出 |
|---|---|---|
| Phase 0 — 环境准备 | ✅ 完成 | 空壳 extension + manifest.json |
| Phase 1 — 截图 + API 调通 | ✅ 完成 | 核心链路跑通 |
| Phase 2 — 对话历史 + Prompt | ✅ 完成 | 完整对话能力 + Order 模板库 |
| Phase 3 — 快捷键 + UI | ✅ 完成 | 可用的 MVP |
| Phase 4 — 真实 Case 端到端测试 | ⏳ 进行中 | 6 个官方 Case 测试 |
| Phase 5 — 迭代优化 | ⏳ 待开始 | 根据测试结果改进 |

### 计划验证的 6 个官方 Case

| Case | 疾病 | 重点验证 |
|---|---|---|
| Case 1 | 张力性气胸 | 是否第一时间强调 needle thoracostomy |
| Case 2 | 类风湿关节炎 | 是否过度下医嘱、是否提到 DMARD + NSAID |
| Case 3 | 升主动脉夹层 | Sequencing：先 β-blocker 再影像 |
| Case 4 | 哮喘（儿科） | 吸入给药 vs 口服/肌注，counseling |
| Case 5 | DKA + 脓毒症 | 抽培养后立刻上抗生素 |
| Case 6 | 子痫 | 第一时间 MgSO4 + 胎儿监护 |

---

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Shift+S` (Win) / `Cmd+Shift+S` (Mac) | 截图并分析 |
| 点击浮动按钮 `CCS` | 展开/收起浮动面板 |

---

## 成本估算

| 项目 | 费用 |
|---|---|
| Chrome 开发者账号 | $5 一次性 |
| Anthropic API（Sonnet） | ~$0.10-0.20 / case |
| Anthropic API（Haiku） | ~$0.02-0.05 / case |
| 服务器（如需代理） | Cloudflare Worker 免费额度内 |
| **总计（备考周期）** | **< $20** |

---

## Order 模板库（prompts/system.md）

项目中内置了一份 **三层 CCS Order 模板库**：

1. **第一层** — 通用开场医嘱（肌肉记忆集，任何急诊 case 第一步）
2. **第二层** — 按主诉分类的初始 workup 模板（胸痛、呼吸困难、腹痛、脓毒症、意识改变、上消化道出血）
3. **第三层** — 收尾屏给分点（Counseling、预防、收尾管理）

外加 7 条通用扣分陷阱速查。

> 详见 `prompts/system.md`

---

## 技术风险

| 风险 | 对策 |
|---|---|
| 截图被禁止/返回空白 | 测试发现后改用 DOM 抓取或 `desktopCapture` API |
| Vision 读不准小字/数字 | 截图前 zoom in 浏览器 + DOM 抓取辅助 |
| 对话历史 token 膨胀 | 限制最近 10 轮 + 旧轮摘要压缩 |
| API 延迟 > 5 秒 | 可切换 Haiku 模型降低延迟 |
| CORS / 浏览器直连限制 | 加 `anthropic-dangerous-direct-browser-access` header；或搭 Cloudflare Worker proxy |

---

## 贡献

本项目基于 MIT 许可证开源。欢迎提交 Issue 和 PR。

---

## 致谢

- 灵感来自 USMLE Step 3 备考社区
- Order 模板参考官方评分标准与备考社区共识
- 由 Claude Sonnet 4 提供 AI 分析能力
