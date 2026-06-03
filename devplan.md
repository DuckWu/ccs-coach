# CCS Coach — Chrome Extension 开发测试计划

## 项目概述

一个 Chrome 浏览器插件，在用户练习 USMLE Step 3 CCS 模拟 case 时，截取当前屏幕信息发送给 Claude，实时返回中文辅导建议（该下什么医嘱、别忘了什么、是否该转 location 等）。

**目标用户**：使用官方 Primum 练习 case（starttest.com）或第三方 CCS 模拟器备考的中文母语考生。

**核心价值**：相当于一个"背了所有考试评分套路的老师在旁边看你练"，练完每步都能拿到即时反馈，而不是做完一整个 case 才看结果。

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                 │
│                                                 │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Popup     │  │  Content   │  │  Side      │ │
│  │  (开关+   │  │  Script    │  │  Panel     │ │
│  │   设置)    │  │  (截图)    │  │  (对话UI)  │ │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘ │
│        │              │               │         │
│        └──────┬───────┘               │         │
│               ▼                       │         │
│        ┌─────────────┐               │         │
│        │  Background  │◄──────────────┘         │
│        │  Service     │                         │
│        │  Worker      │                         │
│        └──────┬───────┘                         │
└───────────────┼─────────────────────────────────┘
                │
                ▼  HTTPS
        ┌───────────────┐
        │ Anthropic API │
        │ (Claude       │
        │  Sonnet 4     │
        │  + Vision)    │
        └───────────────┘
```

**核心文件清单**

| 文件 | 职责 |
|---|---|
| `manifest.json` | Extension 配置，权限声明 |
| `popup.html` + `popup.js` | 点击图标弹出的控制面板（开关、API key 输入、语言选择） |
| `background.js` | Service worker，管理截图、调 API、维护对话历史 |
| `sidepanel.html` + `sidepanel.js` | 侧边栏 UI，显示 Claude 的实时建议 |
| `content.js` | Content script，注入快捷键监听（可选：DOM 抓取增强） |
| `prompts/system.md` | System prompt，内含三层 Order 模板库 + 扣分陷阱 + 评分标准 |

---

## 开发阶段

### Phase 0 — 环境准备（Day 1 上午，~2h）

**做什么：**
- [ ] 创建项目目录结构
- [ ] 写 `manifest.json`（Manifest V3，声明 `activeTab`、`sidePanel`、`storage` 权限）
- [ ] 搭好空壳 popup + side panel + background，确认 `chrome://extensions` 加载无报错
- [ ] 申请或准备好 Anthropic API key
- [ ] 打开 https://www.starttest.com/custom/usmle/?stpf3 跑一个 case，手动截 3-4 张屏，存下来当测试素材

**验收标准：**
Extension 能加载，点击图标弹出 popup，side panel 能打开显示空白页面。手里有 3-4 张官方 case 截图备用。

---

### Phase 1 — 截图 + API 调通（Day 1 下午，~4h）

这是整个项目的技术风险最高的一步，先打通再说别的。

**做什么：**
- [ ] `background.js` 实现截图功能：`chrome.tabs.captureVisibleTab()` 获取当前 tab 截图（base64 PNG）
- [ ] popup 上加一个"截图并分析"按钮，点击后触发截图
- [ ] `background.js` 拿到截图后，调 Anthropic Messages API（model: `claude-sonnet-4-20250514`），用 vision 能力发送图片
- [ ] System prompt 先用一句话简版："你是 USMLE Step 3 CCS 辅导教练。看截图，用中文告诉用户当前该做什么。"
- [ ] 把 Claude 的返回结果显示在 side panel 里

**关键代码逻辑：**

```javascript
// background.js — 核心调用
async function analyzeScreenshot(base64Image, conversationHistory) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,               // 从 chrome.storage 读
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        ...conversationHistory,           // 之前的截图+回复
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: base64Image } },
            { type: "text", text: "这是当前 CCS 界面截图，请分析并给出下一步建议。" }
          ]
        }
      ]
    })
  });
  return await response.json();
}
```

**测试方法：**
1. 打开之前存的官方 case 截图（在新 tab 里打开图片）
2. 点"截图并分析"
3. 确认 side panel 能显示 Claude 的中文建议
4. 检查建议内容是否合理（跟你的 Order 模板对得上）

**验收标准：**
截图 → API 调用 → side panel 显示建议，整条链路跑通。延迟 < 5 秒。

---

### Phase 2 — 对话历史 + System Prompt 完善（Day 2 上午，~3h）

**做什么：**
- [ ] `background.js` 维护一个 `conversationHistory` 数组，每次截图分析的 user message 和 assistant response 都追加进去
- [ ] 加"新 Case"按钮，点击清空对话历史（开始新 case 时用）
- [ ] 写完整版 system prompt，把以下内容塞进去：
  - 三层 Order 模板库（你已经做好的那份）
  - 扣分陷阱速查 7 条
  - 官方 6 个 case 的评分标准摘要
  - 输出格式要求（见下）

**System Prompt 输出格式设计：**

```
要求 Claude 每次返回以下结构：

## 当前阶段判断
（开场/检查中/等结果/治疗中/收尾）

## 即刻该做的
- 具体医嘱 1（英文医嘱名 + 中文解释为什么）
- 具体医嘱 2
...

## 别忘了
- 容易漏的给分点

## 陷阱提醒
- 当前阶段最容易犯的错

## Location 建议
- 是否需要转移病人，转去哪
```

**测试方法：**
1. 打开 starttest.com，跑 Case 1（张力性气胸）
2. 开场屏截图 → 看建议是否提到 needle thoracostomy 的紧迫性
3. 做完体检后再截图 → 看建议是否更新、是否基于之前的上下文
4. 连续截 3-4 次，确认对话历史正常累积、建议前后一致

**验收标准：**
Claude 能基于对话历史给出连贯建议（比如第二次截图时说"你已经做了 XX，现在该做 YY"），而不是每次都从零开始分析。

---

### Phase 3 — 快捷键 + UI 打磨（Day 2 下午，~3h）

**做什么：**
- [ ] 添加键盘快捷键支持（`Ctrl+Shift+S` 或 `Cmd+Shift+S`）触发截图分析，不用每次去点按钮
- [ ] Side panel UI 打磨：
  - 加载中显示 spinner + "正在分析..."
  - 建议卡片用清晰的分区（即刻该做 / 别忘了 / 陷阱）
  - 历史建议可滚动查看
  - 深色/浅色主题跟随系统
- [ ] popup 设置页：
  - API key 输入框（保存到 `chrome.storage.local`）
  - 语言切换（中文/英文）
  - 模型选择（Sonnet 默认，可选 Haiku 省钱）
- [ ] Token 用量显示（每次调用大概花了多少，累计多少）

**测试方法：**
1. 快捷键在 starttest.com 上能正常触发
2. 连续快速按两次，不会重复发送（加 debounce）
3. API key 保存后刷新页面仍在
4. 切换语言后建议确实变成英文

**验收标准：**
操作流畅——快捷键截图 → 2-4 秒后 side panel 更新建议，不打断用户在 Primum 里的操作。

---

### Phase 4 — 真实 Case 端到端测试（Day 3，~4h）

用官方 6 个免费 case 做完整的端到端测试。这是最关键的一步——检验 Claude 给的建议到底靠不靠谱。

**测试矩阵：**

| Case | 疾病 | 重点验证 |
|---|---|---|
| Case 1 | 张力性气胸 | timing 紧迫性：Claude 是否在第一时间强调 needle thoracostomy，而不是先查 ECG |
| Case 2 | 类风湿关节炎 | 克制型 case：Claude 是否不过度下医嘱，是否提到 DMARD + NSAID 联合 |
| Case 3 | 升主动脉夹层 | sequencing：是否先 β-blocker 降压再影像，是否警告不要给 heparin/溶栓 |
| Case 4 | 哮喘（儿科） | 是否用吸入给药而非口服/肌注，是否提醒 counseling |
| Case 5 | DKA + 脓毒症 | 经典"先治再等结果"：是否强调抽培养后立刻上抗生素 + IV insulin |
| Case 6 | 子痫 | 是否第一时间 MgSO4（不是苯巴比妥），是否提到胎儿监护 + 分娩 |

**每个 case 的测试步骤：**
1. 点"新 Case"清空历史
2. 开场屏截图 → 记录建议 → 对照官方评分标准打分（命中 / 遗漏 / 错误）
3. 按 Claude 建议操作 + 自己的判断
4. 每做一步截图 → 记录建议
5. 收尾屏截图 → 看是否提醒 Layer C 给分点
6. Case 结束后对照官方 feedback，统计 Claude 的命中率

**记录模板：**

```
Case X — [疾病名]
截图次数：
Claude 正确建议数：
Claude 遗漏的关键步骤：
Claude 给出的错误建议：
延迟（平均秒数）：
总 token 消耗：
改进点：
```

**验收标准：**
6 个 case 跑完，Claude 对"即刻该做的"建议命中率 > 80%，没有给出会导致扣分的错误建议（比如脓毒症让你等培养结果）。

---

### Phase 5 — 迭代优化（Day 4+，持续）

根据 Phase 4 测试结果，按优先级修：

**优先级 1 — 准确性问题**
- 调 system prompt 里的措辞和优先级权重
- 对特定 case 类型加 few-shot example
- 如果截图识别不准（比如化验数字读错），考虑针对 starttest.com 加 DOM 抓取增强（路线 A + B 混合）

**优先级 2 — 体验优化**
- 加"一键复制医嘱"按钮（复制英文医嘱名，直接粘贴到 Primum 的 order entry）
- 加 case 回顾模式（case 结束后回看所有截图 + 建议的时间线）
- Side panel 里加"为什么"展开按钮（解释为什么建议这个医嘱）

**优先级 3 — 扩展**
- 支持 MasterCCS / CCScases.com / UWorld 等第三方平台
- 支持桌面版 Primum（需要用系统级截图 API，不是 Chrome extension 能做的，可能需要做成 Electron 或 Tauri app）

---

## 技术风险 & 对策

| 风险 | 影响 | 对策 |
|---|---|---|
| starttest.com 禁止 extension 截图 | 截图返回空白 | 测试发现后改用 DOM 抓取；或用 `desktopCapture` API |
| Claude Vision 读不准截图里的小字/数字 | 建议不准 | 截图前 zoom in 浏览器；或裁剪关键区域单独发；或改 DOM 抓取 |
| 对话历史太长导致 token 爆炸 | API 费用高 + 响应慢 | 每个 case 限制最近 10 轮；旧轮次只保留 Claude 的摘要 |
| API 延迟 > 5 秒影响练习节奏 | 用户体验差 | 用 streaming；或改 Haiku 模型减少延迟 |
| Anthropic API 的 CORS / 浏览器直连限制 | 请求被拒 | 加 `anthropic-dangerous-direct-browser-access` header；如不行则搭一个最小的 proxy（Cloudflare Worker，10 行代码） |

---

## 项目时间线总览

| 时间 | 阶段 | 产出 |
|---|---|---|
| Day 1 上午 | Phase 0 环境准备 | 空壳 extension + 测试截图 |
| Day 1 下午 | Phase 1 截图+API 调通 | 核心链路跑通 |
| Day 2 上午 | Phase 2 对话历史+Prompt | 完整对话能力 |
| Day 2 下午 | Phase 3 快捷键+UI | 可用的 MVP |
| Day 3 | Phase 4 端到端测试 | 6 个 case 测试报告 |
| Day 4+ | Phase 5 迭代优化 | 根据测试结果持续改进 |

**3 天出 MVP，第 4 天给朋友用。**

---

## 成本估算

| 项目 | 费用 |
|---|---|
| Chrome Developer 账号（发布到商店用） | $5 一次性 |
| Anthropic API（Sonnet，练习阶段） | ~$0.10-0.20 / case，60 个 case ≈ $6-12 |
| Anthropic API（如改 Haiku 省钱） | ~$0.02-0.05 / case，60 个 case ≈ $1-3 |
| 服务器（如需 proxy） | Cloudflare Worker 免费额度内 |
| **总计** | **< $20 覆盖整个备考周期** |