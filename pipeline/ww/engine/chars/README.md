# 角色模块（engine/chars/）

每个角色一个文件，文件名 `<id>_<拼音>.js`，UMD：浏览器里先加载 `ww_engine.js` 和 `_common.js`，再加载各模块（会调用 `WWEngine.registerChar`）；Node 下 `require('engine/chars')` 会加载引擎和全部 `^\d+_*.js` 模块，并返回引擎对象。

没有模块的角色：手动序列照常运行（使用通用 kit：A1..An/H/E/R/Q/I/O/X#）；自动搜索被禁用，`simulate()` 返回 `searchable:false` 和 `searchDisabledReason`，同时给出警告；`toView()` 中 `searchable:false`，`searchDisabled:{reason}`，`team[i].noModule:true` 并附 `reason`。成员配置 `module:false` 可以强制不用模块。

## 接口

```js
WWEngine.registerChar({
  id: 1304, name: '今汐', version: '0.1', confidence: 'medium', notes: ['...'],
  resources: [ { key, name, max, segmented, confidence, basis, get?(cs, t) } ],  // UI 量表；默认取 cs[key]
  kit(H)        -> { key: act }      // 额外/改写动作；H.act(spec) 建动作，从 ww.json 的 hit 行按 label 选
  init(api)     -> cs                // 角色状态（可 JSON 克隆）；成员 module.start 可覆盖初值
  resolve(api, btn) -> {act, meta} | {blocked: '原因'} | null   // 按键 A/H/E/R/Q/I/O → 当前形态的动作；null = 用通用 kit
  actionStats(api, act, meta) -> [{key, value}]   // 只作用于这次动作的额外属性
  apply(api, act, meta)          // 动作结算后：状态迁移、资源增减、协同伤害（api.deal）、触发增益（api.fireBuff）
  auras(api, targetMi) -> [{key, value}]          // 依赖状态的光环（如守岸人星域）
  onTeam(api, ev)                // 队伍事件：damage / intro / outro / swap（ev.mi, ev.el, ev.coord, ev.t ...）
  swapOut(api, toMi) -> {force}  // 离场：force=true 表示协奏未满也打延奏（今汐同奏）
  onOutro(api, toMi)             // 自己的延奏结算后
  potential(api) -> number       // 搜索启发式：未兑现资源的估值（伤害单位）
});
```

`H`（模块帮助对象，按成员）：`R`（ww.json 角色）、`mem`、`kit`、`chain`、`weaponId`、`weaponRank`、`opts`（成员配置里的 `module` 对象）、`level`、`act(spec)`、`skill(sel)`、`param(sel, label, levelKey)`（百分比转小数）、`findBuff(pred)`、`patchBuff(pred, patch, why)`（改写文本解析出的增益触发条件，记录在 `patchedBy`）、`buff(def)`（模块自有增益）。

`H.act(spec)`：`{key, cls, skill, labels[], hits?, count?, levelKey, concertoParam, concerto, cooldown, cdKey, cost, dur, durKey, ownStage, forceCrit, scale{label|'*':倍数}, label, inferred, includeAlt}`。
- 伤害只来自 ww.json 的 hit 行（倍率、元素、类型、能量、协奏）；`scale` 用于描述中“提升 x%”这类修正，必须在注释里引用描述原文。
- `includeAlt`：是否包含 build 拆分出的 `alt` hit（同一描述项在另一状态下的命中行），默认不含。
- `dur` 是模块估计时长，标记为 `durSource:'module-estimate'`、`est:true`。

`api`（每次回调新建）：`ctx s mi mem H t tEnd cs active onField member(j) est(act) cdReady(key) deal(act,{count,stats,noGain}) addEnergy addConcerto staticPanel livePanel buffInst fireBuff(id,target,{duration,stacks}) endBuff`。

规则：
- 每条规则在注释里引用 ww.json 描述原文；推断规则标 `confidence`（`high`/`medium`/`low`）和 `inferred` 说明，会出现在时间轴动作的 `inferred` 字段和 `warnings` 中。
- 合法性只在 `resolve` 里判断（返回 `blocked`），beam search 和手动序列走同一条路径。
- 触发型增益从下一次命中开始生效（引擎先结算伤害，再 fire）。

## 动作时长

优先级：`member.durations` / `config.durations`（`config`）> `config.actionFrames`（`frames`；CLI 自动读 `validation/action_frames.json`）> 模块估计（`module-estimate`，est）> 默认（`default`，est）。

`actionFrames` 可接受的形状：
`{version, source, fps, characters: {<id|中文名|英文名>: {actions: {<动作key>: 秒 | {duration|seconds|frames, fps, source}}}}}`，或 `{entries: [{charId|name, action, duration|frames, fps, source}]}`。
动作 key：通用 `A1..A5 H E R Q I O`，模块动作见各模块 `kit`（如今汐 `shenni lxA1..4 zhutian jinglong`）。

## 已实现

| id | 角色 | 资源（UI） | 关键状态/动作 | 主要推断（置信度） |
|---|---|---|---|---|
| 1304 | 今汐 | 韶光 0–50（连续）、形态 0–3 | A4/变奏→神霓飞芒窗口 5s → 乘岁凌霄（凌霄普攻 4 段、逐天）→ 游龙 → 惊龙破空（按韶光加倍率、消耗韶光）；同奏强制延奏；驭时 | 开局韶光 50（可设 `module.start.shaoguang`，中）；韶光获取按队友元素命中、每 3s 一次（中）|
| 1205 | 长离 | 离火 0–4、赫羽三相次数 0–2（12s 充能）、心眼 0–1 | 心眼·劫/征、焚身以火（4 离火）、潜谋/散势/焰羽 | 散势按自身施放 R/焚身触发（中）；灼羽为近似（低）；心眼·冲未建模 |
| 1105 | 折枝 | 灵韵 0–90、鹤影、极意、墨鹤剩余 | 构形 → 神来之笔 → 极意（普攻伤害+18%）；墨鹤协同 1/s；点睛 +15 能量 | 灵韵获取 变奏 45 / 普攻 15（社区，低，可设 `module.gain`）；构形窗口 1.5s（低）；墨鹤节奏（低）|
| 1505 | 守岸人 | 实论数据 0–5、坍缩核 0–5、星域 0–3 | 普攻攒数据/核 → 演绎、星域分阶段（变奏推进）、洞悉必暴、耀星·蝶协同 | 黯星·蝶 5 段（低）；重击蓄力、延奏蝶未建模 |
| 1107 | 珂莱塔 | 灵萃 0–120、可塑晶质 0–6、终幕(揭幕者) | 必要性手段 3 段、蓄力 限制/末路、示我以华、枪花（死兆 ×N + 致死以终）；延奏 rowHit | 晶质 10 s 到期近似（中）；搜索 potential 计入致死以终价值（启发式）|
| 1506 | 菲比 | 祈愿 0–120、福音 0–60、状态（赦罪/告解） | 镜环 → 圣咏普攻、星辉（耗福音）、告解、默祷延奏（全队）| 光噪层数衰减 1/3s（低）；`module.frazzle='external'` 表示队友常驻 10 层；延奏倍率取描述 528.41%（低）|
| 1503 | 维里奈 | 光合能量 0–4、光合标记 | A5/E 充能 → 星星花绽放（重击/空中）、R 标记 12 s、协同攻击（全队非协同伤害触发，1/s）| 固有/链4 仅由星星花绽放与延奏触发（parser 误判修正，中）；链6 改为模块处理 |
| 1409 | 卡提希娅 | 决意 0–120、剑 3 种、风蚀层数、显化 | 本体 A1–4/重击/下落 P1–3（按剑数）、E、R→芙露德莉斯 12 s（fA1–5、fH/fHH、fE1→fE2、看潮）| 决意获取为逐动作估计（低）；风蚀伤害未计（见 CORE_CHANGES 1）|
| 1210 | 爱弥斯 | 同步率 0–200、共振次数、形态 P/M、于此释放 | 形态切换、合击/光翼、瞬响重击、过载 → 终曲；爆发/调律模式（`module.mode`）| 同步率表取原始 SpecialEnergy2（高）；爆发叠层 `module.burstAppliers`（中）|
| 1311 | 心 | 照世心 0–300、敕令、形态 应世/照世、统御 | 应世/照世普攻、万象·临寰、步/真·寰尘、临/真·寰宇、转相（敕令 45 s）、万象·承天、飞阙协同；同奏响应 | 计量获取为逐动作估计（低）；响应判定靠“延奏后协奏>0”（变通，见 CORE_CHANGES 2）|
| 1306 | 奥古斯塔 | 战势 0–100、权炳、威慑 0–2、以众愿为冕（链 1/2/4 上限） | 鸣铁/后撤→回旋斩、强化 E/A、斩锋、xj→yk→lx（+威慑、耗权炳）、誓锋不殒、烈阳×9+不朽者之肃（威慑≥2，含时停）；获得护盾触发 | 战势获取按 Prydwen 最快循环校准到 100（中）；延奏给下一位（onTeam）|
| 1208 | 嘉贝莉娜 | 罪烬 SIN、炼羽 PF、余火（全伤加深 1.5%/点，上限 60%）、死运既定（按 I/A/F/E/R 计） | 本体 A1–4/H1–3 → 恶魔形态 dA1–5/dH1–3/掠袭；恶翼扬升；R 14 s 倍率提升 +85% | 获取/消耗按 Prydwen 标准循环校准（低）；帧数据为 WuWaSim 3.6（可接下一动作口径），解放无帧条目（模块估计）|
| 1102 | 散华 | 冰棱/冰川/冰棱爆裂（冰造物 0–2）、透视 | 寒光 A1–5 → E 冰棱、重击冰川、引爆（det）；每次冰造物爆炸 +15 协奏 | 链 1/4/5/6 模块处理，链 3（生命<70%）条件关闭；chainModeled 6；多数动作无帧数据（默认时长 84%，审计 WARN）|
| 1206 | 布兰特 | 意气（Bravo）、焚躯 | 空中 a1–a4 / 变奏 / E 攒意气（焚躯 ×2）→ 回路 fz；能量回复折算攻击 | chainModeled 1（链 2 延奏爆炸未建模）；专武排名第 1 |
| 1302 | 吟霖 | 审判值（I 10 / H 10 / E 30 / E2 30 / R 10 / A 每段 5）、惩罚印记 | 审判 → 回路 cipher；印记目标受伤触发惩罚落雷（onTeam，≤1 次/s），专武后台 +12% 计入落雷 | chainModeled 5（链 6 未建模）|

**核心钩子（stream A，2026-10-09 17:00）**：`chainModeled`（模块声明，见 MECHANICS §11）；`hold(api, act, remaining)`（搜索前瞻：露西、丹瑾）；搜索辅助轮转（非 dps 角色 R 可放时先放 R 再切出）；onTeam 事件新增 `echoCast` / `shield` / `tune`；`frames` 中数组标签按段相加。

示例配置：`chars/examples/`（各角色 solo 与公开配队 team_*）。核心引擎需改动项：`CORE_CHANGES_NEEDED.md`。

## 动作帧映射（`frames`）

模块可声明 `frames: { <动作key>: '<action_frames.json 中的完整条目名>' | RegExp }`，把模块动作对到 `validation/action_frames.json` 的具体条目；没有声明的模块动作（key 与按键类别不同）不会继承通用类别的时长，会退回模块估计 `dur`。视图里 `dur:'frames'|'config'|'default'`，`default` 附 `durReason`。

| 模块 | 映射（推断置信度） |
|---|---|
| 今汐 | shenni→Skill 2: Overflowing Radiance；lxA1–4→Basic: Incarnation 1–4；zhutian→Skill 3: Crescent Divinity；jinglong→Skill 4: Illuminous Epiphany（中：按招式顺序/英文名对应） |
| 长离 | E→Skill: Tripartite Flames；zheng→True Sight: Conquest；fenshen→Forte: Flaming Sacrifice（高） |
| 折枝 | E→Skill 1: Manifestation；gouxing→Heavy: Conjuration；shenlai→Skill 2: Stroke of Genius；jiyi→Skill 3: Creation's Zenith；R→Liberation: Living Canvas（高） |
| 守岸人 | I→Intro: Enlightenment；dongxi→Intro 2: Discernment；yanyi→Forte: Illation（中：Illation=演绎 按词义） |
| 珂莱塔 | A1–2→Silent Execution；bA1–3→Necessary Measures；xianzhi/molu→Heavy 2/3；shiwo→Skill 2；sizhao/zhisi→Liberation 2/3（高）|
| 菲比 | xA1–3→Chamuel's Star；shengdao→Absolution Litany；xinghui→Starflash；gaojie→Utter Confession（高）|
| 维里奈 | A1–5→Cultivation；hua→Starflower Blooms；huaAir 无对应帧条目，时长 1.2 s 估计（低）|
| 卡提希娅 | A/H/P1–3→Sword to Carve My Forms/Plunging；fA1–5/fH/fHH→Tempest；fE1/fE2→Skill 2/3；kanchao→Blade of Howling Squall（高）|
| 爱弥斯 | pA/mA→Aemeath/Mech；pH2/mH2→Instant Response；heP/heM→Sync Strike；gyP/gyM→Seraphic Duet；R/fin→Overdrive/Finale；fsP1/fsM1 复用 1 段（低：形态切换无单独帧）|
| 心 | yA/zA/tA→Answering/Illumining/Pillars Aligned；buhc/zhenhc/linhy/zhenhy/wqlh→各 Forte 条目（高）|
| 奥古斯塔 | 动作帧 WuwaLAB；sublime 按 8.38 s（含时停）模块合并（中）|
| 嘉贝莉娜 | A1–4/H1–3/dA1–5/dH1–3/E/eyi/dE/I → WuWaSim `[WuWaSim]` 条目（durSource 标签 wuwasim，可接下一动作时刻）；R 无条目 2.3 s 估计（低）|


## 搜索与开局模式（核心，2026-10-09）
| 选项 | 默认 | 作用 |
|---|---|---|
| `search.residual` | auto（队伍开） | 残值引导：窗口外仍生效的增益按剩余时长×对队伍的每秒价值计入搜索目标（权重 0.5，上限 15 s），**不计入报告伤害**；模块钩子 `residual(api, D, H)` |
| `start.steady` | 关 | 稳态开局：以上一轮结束状态开局（`steadyLoops` 默认 2）；模块钩子 `carry(api, cs, D)` 负责平移计时字段 |
| `timeStop` | exclude | 时停帧不消耗战斗时间（计时冻结，社区口径）；`"include"` = 旧口径 |
| 队伍预设窗口 | 原 25/30 s | exclude 下辅助在原窗口已会放 R/变奏/延奏，40 s 撤回（MECHANICS.md §10）|
