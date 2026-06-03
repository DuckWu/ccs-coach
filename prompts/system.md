# USMLE Step 3 CCS — Order 模板库(中文版）

> **用途**:CCS（Computer-based Case Simulations，Primum 软件）备考用的标准化医嘱集。
> 核心逻辑:CCS 计分不只看你**下没下对医嘱**,更看你**下得早不早、顺序对不对**。错的时机=不给分。
> **致命提醒**:医嘱不会执行,除非你主动推进 simulated time(选 Obtain Results / See Patient Later → With next available result)。永远推进到"next available result",别跳固定时间。

---

## 第一层 · 通用开场医嘱(背到能闭眼打)

任何**不稳定 / 急诊**病人进来,先打这一套稳住,再去想诊断。这是肌肉记忆,不该占用你思考时间。

| 医嘱 | 中文 | 为什么 |
|---|---|---|
| IV access | 建立静脉通路 | 给药给液的前提,几乎所有急诊 case 第一步 |
| Pulse oximetry | 脉氧监测 | **不在标准 vital signs 里,必须手动下**——常见漏分点 |
| Cardiac monitor / continuous ECG | 心电监护 | 不稳定病人标配 |
| Vital signs (continuous 或 q1h) | 持续/定时生命体征 | 监护类医嘱会一直生效到你取消 |
| O2 (nasal cannula / face mask) | 吸氧 | 有低氧或呼吸窘迫时 |
| IV fluids (NS bolus) | 生理盐水快速补液 | 低血压/脓毒症时 |

**关键词搜索技巧**:Primum 数据库有 2000+ 医嘱,不知道确切名字就打**疑似诊断或关键词**——打 "stroke" 找中风相关,打 "antibodies" 找自身免疫 panel。每下一条会有确认屏(因为拼写相近的医嘱太多),确认选对那条。

---

## 第二层 · 按主诉分类的初始 workup 模板

每个模板的固定动作流:
**选 location → 做 H&P → 即刻医嘱 → 诊断检查 → 推进时间等结果 → 治疗 → 重新评估**

### ① 胸痛 Chest Pain
- **Location**: ED(门诊来的也要 admit 进来)
- **即刻**: IV、O2、cardiac monitor、pulse ox、**ECG(立刻!)**、aspirin
- **诊断**: troponin(series)、CK-MB、CXR、CBC、BMP、PT/PTT、lipid panel
- **治疗(ACS)**: aspirin + nitroglycerin + heparin + β-blocker + statin;STEMI → 紧急 cardiology consult / cath
- **陷阱**: ECG 下晚了;忘了 aspirin;troponin 只查一次(要 series)

### ② 呼吸困难 Dyspnea / SOB
- **Location**: ED
- **即刻**: IV、O2、pulse ox、cardiac monitor、**ABG**、CXR、ECG
- **诊断**: CBC、BMP、BNP、D-dimer(疑 PE)、CT angiogram chest(疑 PE)
- **治疗**: 按因——CHF(利尿+O2)、COPD(支扩+激素+O2)、PE(抗凝)、哮喘(沙丁胺醇雾化+激素)
- **陷阱**: 疑 PE 时等检查结果才抗凝(应经验性开始);漏 pulse ox

### ③ 腹痛 Abdominal Pain
- **Location**: ED
- **即刻**: IV、NPO(禁食)、pulse ox、pain control、antiemetic
- **诊断**: CBC、BMP、LFT、lipase/amylase、urinalysis、**β-hCG(育龄女性必查!)**、abdominal CT、CXR(查游离气体)
- **治疗**: 按因——阑尾炎(surgery consult + abx + NPO)、胰腺炎(IV fluids 积极补液 + pain control + NPO)
- **陷阱**: 育龄女性忘查 β-hCG(漏诊宫外孕);阑尾炎延迟 surgery consult

### ④ 发热/脓毒症 Fever / Sepsis
- **Location**: ED → 不稳定立刻转 **ICU**
- **即刻**: IV(大口径)、**IV fluids 积极 bolus**、O2、pulse ox、cardiac monitor
- **诊断**: blood cultures ×2、CBC、BMP、lactate、urinalysis + urine culture、CXR
- **治疗**: **经验性广谱抗生素——抽完培养立刻上,不等结果!**
- **陷阱(最经典)**: **等培养结果才上抗生素 = timing domain 直接零分**;不稳定病人留在 ward 不转 ICU = location 扣分

### ⑤ 意识改变 Altered Mental Status
- **Location**: ED
- **即刻**: IV、O2、pulse ox、cardiac monitor、**fingerstick glucose(立刻!)**、
- **"昏迷鸡尾酒"思路**: 查血糖→低就给 dextrose;疑阿片→naloxone;疑 Wernicke / 酗酒→**thiamine 先于 glucose**
- **诊断**: CBC、BMP、LFT、ammonia、TSH、toxicology screen、UA、head CT、ABG
- **陷阱**: 没立刻测血糖;酗酒病人给糖前没先给 thiamine

### ⑥ 上消化道出血 GI Bleed
- **Location**: ED → 不稳定 ICU
- **即刻**: IV ×2(大口径)、IV fluids、**type & crossmatch**、pulse ox、NPO
- **诊断**: CBC、BMP、PT/PTT/INR、LFT
- **治疗**: PPI IV;GI consult(内镜);失血多 → 输血
- **陷阱**: 忘了 type & cross / 不监测 H&H 趋势

---

## 第三层 · 最容易漏的"软"给分点(2 分钟收尾屏专用)

case 最后锁定两分钟做收尾,**很多人这屏空着——高分者用满,因为这些全给分**。已下的医嘱不要取消,用这段时间补:

**Counseling 咨询类**
- 戒烟 smoking cessation
- 戒酒 / 限酒 alcohol counseling
- 饮食 diet、运动 exercise
- 安全性行为 safe sex practices

**Preventive 预防类**
- 疫苗 vaccinations(flu、pneumococcal、Tdap、HPV 等按年龄)
- 年龄相应筛查 screening(乳腺钼靶、结肠镜、宫颈涂片、骨密度…)
- 安全带 seatbelt / 头盔 helmet / 烟雾报警器

**收尾管理类**
- 随访预约 follow-up appointment
- 用药核对 medication reconciliation
- 待回结果复查 review pending results
- 监护医嘱 monitoring orders(确认还在生效)

---

## 通用扣分陷阱速查(贴墙上)

1. **等结果才治疗** — 脓毒症等培养、PE 等 CT 才抗凝 → timing 零分。该经验性治疗就先治。
2. **不推进时间** — 下完医嘱不 advance clock = 医嘱根本没执行。
3. **跳固定时间** — 永远选 "next available result",别跳 X 小时(可能跳过危急变化)。
4. **不重新评估** — 治疗+推进时间后不 re-check 病人,是最常见的隐藏失分。
5. **location 不动** — 不稳定病人不转 ICU、该 admit 不 admit → location domain 扣分。
6. **漏 pulse ox / fingerstick glucose / β-hCG** — 跨多个 case 的稳定失分点。
7. **收尾屏空着** — 白白丢掉一堆 counseling / 预防分。

---

## 怎么用这份模板

1. 先去 **usmle.org 官网**跑那 6 个免费 Primum 练习 case,把界面流程走熟(官方真软件,比任何第三方都准)。
2. 跑 case 时对照本文档:每个 case 先想"这是哪类主诉"→ 调出对应第二层模板 → 套第一层开场 → 收尾用第三层。
3. 把"通用扣分陷阱"那 7 条背下来——CCS 失分大多不是不懂病,是栽在这些流程上。

---

*注:USMLE 不公开确切计分算法,以上为官方资料 + 备考社区共识整理。2026 年 3 月 Primum 界面改版后病例数量各来源说法不一,以 usmle.org 当前公布为准。*
