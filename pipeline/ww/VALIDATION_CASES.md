# WW 引擎验证用例与配置格式（Step 2a + 2b：角色模块 / 动作帧）

引擎：`engine/ww_engine.js`（`ww-engine-0.1`，纯 JS，UMD，浏览器/Node 通用，无 DOM）  
数据：`out/ww.json`（ResVer 3.7.8，commit 9218d612）  
CLI：`node engine/cli.js <cases.json> [--data out/ww.json] [--frames validation/action_frames.json|none] [--case 名称|序号] [--rows N] [--timeline] [--json 结果.json]`  
测试：`node --test engine/test/`（32/32 通过：engine 18 + modules 14）  
角色模块接口：`engine/chars/README.md`（今汐 / 长离 / 折枝 / 守岸人）

CLI 默认读取 `validation/action_frames.json`（存在时），也可用 `--frames none` 关闭，或在用例里写 `actionFrames`（对象，或相对 cases 文件的路径）。

> 本文件中的数值均为**引擎自身输出**，还没有和外部计算器对过。项目负责人可以把外部计算器（或实机）的结果写进 `expect`，用 CLI 比对；超出容差的用例让 CLI 以退出码 1 结束。

---

## 1. cases 文件格式（`validation/cases.json`）

```jsonc
{
  "defaults": { /* 可选：每个用例先浅合并这些字段（与用例内同名字段：用例优先） */ },
  "cases": [ <Case>, ... ]
}
```
也可以直接写成 `[ <Case>, ... ]`，或者给一个单独的 `<Case>` 对象（顶层带 `team` 即可）。

### Case = 引擎配置 + 3 个 CLI 专用字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `name` | string | `case#i` | 用例名（CLI 专用） |
| `probe` | object | — | 有这个字段时**不跑循环**，只用静态面板算一个动作的全部命中（CLI 专用），见 §1.6 |
| `expect` | object | — | 期望值与容差（CLI 专用），见 §1.7 |
| `team` | Member[1..3] | **必填** | 编队；序号 1/2/3 就是序列里的 `1E`、`S2` 这些编号 |
| `enemy` | Enemy | 见下 | 目标 |
| `duration` | number(s) | 25 | 时间窗口；DPS = total / duration（即使序列提前结束也按这个算） |
| `mode` | `"expected"`\|`"crit"`\|`"noncrit"` | expected | 暴击口径 |
| `conditionals` | `"auto"`\|`"all-on"`\|`"off"` | auto | 条件增益：auto 表示能识别触发的按时间轴触发，识别不了的关闭；all-on 全部常驻（满层）；off 全部关闭 |
| `buffOverrides` | `{ [buffId]: "on"\|"off"\|"auto" }` | — | 逐条覆盖增益模式（buffId 见引擎输出 `members[].buffs[].id`，如 `w0_1`、`s0_5_5_0`、`o1_0`） |
| `start` | `{energy, concerto}` | 0/0 | 每项可以是数字、`"full"`，或按队员给的数组，如 `[0,100,100]` |
| `rotation` | Rotation | search | 见 §1.4 |
| `search` | Search | 见 §1.5 | 搜索预算 |
| `durations` | `{A,A1..A5,H,E,R,Q,I,S,X}` | 见 §3 | 动作时长覆盖（秒），全队生效 |
| `substatTiers` | object\|string | — | 副词条档位表；CLI 里可以写相对**cases 文件**的路径，例如 `"substat_tiers.json"` |
| `defaultBuffDuration` | number | 10 | 文本里解析不到持续时间的触发型增益，按这个值计（秒） |
| `actionFrames` | object\|string | CLI：`validation/action_frames.json` | 动作帧数据（见 §1.9）。引擎 API 直接传对象 |
| `swapRule` | `"cancel"`\|`"full"`\|`"swapTime"` | cancel | 切人就绪时刻（见 §1.9） |
| `modules` | bool | true | `false` 时全队不用角色模块（搜索随之禁用） |

### 1.1 Member

```jsonc
{
  "id": 1304,                    // 角色 id（out/ww.json resonators[].id）
  "level": 90, "ascended": true, // ascended=false 时取突破前那一行（只对 20/40/50/60/70/80 有意义）
  "chain": 0,                    // 共鸣链 0..6（只计入能解析出的面板效果）
  "skillLevels": {"basic":10,"skill":10,"liberation":10,"intro":10,"forte":10,"outro":1},
  "weapon": {"id": 21010016, "level": 90, "rank": 1},   // rank 1..5 是谐振等级
  "echoes": [ Echo × ≤5 ],       // 第 1 个声骸就是 Q 动作（主动声骸技能）
  "manualBuffs": [ {"name":"外部增益","stats":{"atkPct":0.2,"deep:all":0.1},"target":"self|team","from":0,"to":10} ],
  "durations": { "E": 1.3 },     // 只覆盖这个队员（键可以是通用键 A1/H/E/R/Q/I，也可以是模块动作键，如 jinglong）
  "module": {                    // 角色模块选项（可省略）；false = 不用模块（该角色不可搜索）
    "start": {"shaoguang": 50, "lingyun": 0},   // 资源初值（今汐 韶光、折枝 灵韵…，见各模块 init）
    "gain": {"intro": 45, "basic": 15}           // 折枝 灵韵获取（社区推断值，可改）
  }
}
```

### 1.2 Echo

```jsonc
{
  "echoId": 6000059,       // 可选；第 1 个声骸填了才有 Q；套装可以从 sonataGroups 推断（唯一时）
  "cost": 4,               // 4 | 3 | 1；全队员合计不能超过 12（超出时只报警告）
  "quality": 5, "level": 25, // 默认 5 星 / 25 级
  "rank": 5,               // 声骸技能等级（Q 倍率取这一级），默认 5
  "set": 5,                // 套装 id（sonatas[].id）
  "main": "CritDamage",    // 主词条，见下表；"elemDmg" = 本角色元素伤害
  "subs": [ {"stat":"critRate","value":0.081}, {"stat":"暴击伤害","tier":3}, {"stat":"atkPct","tier":"max"} ]
}
```
主词条（5 星，25 级数值，固定副主词条会自动附带）：
- COST 4：`Crit` 22%、`CritDamage` 44%、`Atk%` 33%、`LifeMax%` 33%、`Def%` 41.8%、`HealChange` 26.4%（+攻击 150）
- COST 3：`DamageChangeElement1..6`（冷凝/热熔/导电/气动/衍射/湮灭）30% 或 `elemDmg`、`Atk%` 30%、`LifeMax%` 30%、`Def%` 38%、`EnergyEfficiency` 32%（+攻击 100）
- COST 1：`Atk%` 18%、`LifeMax%` 22.8%、`Def%` 18%（+生命 2280）

副词条 `stat` 有三种写法：
- 引擎键：`critRate critDmg atkPct atkFlat hpPct hpFlat defPct defFlat energyRegen dmg:basic dmg:heavy dmg:skill dmg:liberation`；
- 数据键：`Crit`、`Atk%`……；
- 档位表里的中文名：`暴击`、`暴击伤害`、`攻击%`、`固定攻击`、`生命%`、`固定生命`、`防御%`、`固定防御`、`共鸣效率`、`普攻伤害加成`、`重击伤害加成`、`共鸣技能伤害加成`、`共鸣解放伤害加成`。

取值有两种方式：
- `value`：任意数值，不受档位限制。百分比属性可以写小数 0.081，也可以写 8.1（大于 1.5 的会自动除以 100）。
- `tier`：档位序号，0 起算，也可以写 `"min"` / `"max"`。需要提供 `substatTiers`。

`value` 不在档位表里时只给一条 info 警告，计算照常进行，不会被拦下。  
档位表 `validation/substat_tiers.json`（13 个副词条，来源是官方韩国公示和社区交叉核对）**只用作 UI 预设和配置校验，概率不参与伤害计算**。另外要注意，这张表的来源早于 3.7.8。  
`ww.substatTierTable(tiers)` 会把它转成 `[{key, zh, values(引擎单位), probabilities}]`，供前端的 `.ww-tiers` 按钮使用。

### 1.3 Enemy

```jsonc
{
  "level": 90,
  "resTier": 0.1,          // 基础抗性：0.1 / 0.4 / 免疫可写 1（≥0.8 走 1/(1+5res)）
  "resShred": 0.2,         // 额外减抗（小数，或写 20 表示 20%）；有效抗性 = 基础 − 减抗，可以为负
  "enemyId": null,         // 填了就用该敌人逐元素抗性（enemies[].res），覆盖 resTier
  "resByElement": {"spectro": 0.4},   // 手动覆盖单个元素
  "defIgnore": 0, "defReduce": 0,     // 无视防御 / 减防（小数）
  "def": null,             // 直接指定敌防（默认 792+8·Lv）
  "dmgReduce": 0           // 减伤区（unsolved，默认 0）
}
```

### 1.4 Rotation 与序列语法

```jsonc
{"mode": "manual" | "search", "sequence": "E A A A A H Q R", "start": 0, "onBlocked": "wait" | "skip"}
```
- `start`：开场在场队员的序号，从 0 起算。
- `search`：用 beam search 找最优序列，再按这条序列详细重放一遍。
- `manual`：按 `sequence` 执行。不合法的步骤会标记 `ok:false` 并附带原因，例如“共鸣能量不足（12.3/150）”“不在场”“冷却中”。
- `onBlocked`：遇到冷却时，`wait` 会自动插入等待（`W`），`skip` 跳过这一步。

| 记号 | 含义 |
|---|---|
| `A` `H` `E` `R` `Q` | 当前在场队员：普攻（段数自动循环，打出其他动作后重置）/ 重击 / 共鸣技能 / 共鸣解放（需能量满）/ 声骸技能 |
| `2E`、`3R` | 指定队员（必须在场） |
| `X<k>`、`2X3` | 额外动作 k，见输出 `members[].kit.extras[].xid`（空中攻击、闪避反击、技能的其余段、forte 段）；**不检查资源门槛**，置信度低 |
| `S<j>` | 切到 j 号。离场者协奏满 100 时自动打出延奏（伤害和 buff）→ 入场者变奏，协奏清零；不满时为普通切人，用时 0.25 s |
| `W<秒>` | 等待 |

分隔符可以是空格、逗号或 `>`。

### 1.5 Search

`{"beamWidth":96, "maxExpansions":120000, "topN":5, "potentialWeight":0.5, "allowExtras":false}`
- 只有全员都有角色模块时才能搜索；否则 `searchable:false`，结果附 `searchDisabledReason`，并给出 `search-disabled` 警告（手动序列不受影响）。
- 启发式按时间归一：已打出伤害 + 剩余时间 × 全队最佳持续输出速率 + 权重 × 未兑现资源（能量、协奏、模块 `potential`）。
- `potentialWeight`：启发式里“未兑现资源”的权重。计算方式是 能量占比 × R 伤害 + 协奏占比 × (变奏+延奏) 伤害。
- 剪枝：两次普通切人不能连在一起。
- 去重：按状态键（时间、在场者、能量、协奏、段数、CD、buff）去重。
- 平局按序列字符串排序打破，所以结果完全确定。

### 1.6 probe（只算单个动作）

```jsonc
"probe": {"member": 0, "action": "R" | "E" | "H" | "Q" | "I" | "O" | "A" | "X3", "stage": 1, "hit": "技能伤害",
          "buffs": ["w0_1", "s0_5_5_0"],                // 强制开启这些增益（满层）
          "extraStats": [{"key": "deep:all", "value": 0.15}]}
```
- 面板 = 静态面板 + `mode:on` 的常驻增益 + `buffs` 里列出的增益 + `extraStats`。
- 适合和外部计算器的“单技能伤害”逐项对比。
- 可以写的期望字段：`expect.expected` / `expect.crit` / `expect.noncrit`，对应该动作所有命中的合计。

### 1.7 expect

```jsonc
"expect": {"tolerancePct": 1, "total": 123456, "dps": 6000, "perMember": {"0": 100000},
           "panel": {"0": {"atk": 1916, "critRate": 0.211}}, "noInvalidSteps": true,
           "expected": 37097.6, "crit": 71912.8, "noncrit": 27787.0}
```

### 1.8 CLI 输出

每个用例输出以下内容：
- 序列；不合法的步骤；总伤害、DPS、切人次数、解放次数；
- 每个队员的面板、末态能量和协奏；
- 伤害类型占比；
- 代表命中（全程最大的一次命中），**逐乘区**列出 `key=值[T/K/C/U]`（T=table，K=corroborated，C=community，U=unsolved，取自引擎的单一 `MECH` 表）；
- 前 N 个动作/命中行及其乘区；
- `expect` 比对结果。

`--json` 会把同样的内容以 JSON 写出。乘区的完整对象是 `{key,mechKey,name,value,display,mech,basis,confidence,...}`；其中抗性区另含 `baseRes`、`shred`、`effectiveRes`、`neg`、`highSegment`。有效抗性 ≥80% 时 `mechKey='resistanceHigh'`（community）；敌人填了 `damageTaken`（目标受伤加深）时加深区 `mechKey='deepenTarget'`（community）。

### 1.9 动作时长与切人（action_frames）

优先级：`durations`（用户覆盖，`durSource:'config'`）> `actionFrames`（`'frames'`）> 模块估计（`'module-estimate'`）> 默认值（`'default'`）。
- `validation/action_frames.json`（WuwaLAB 社区测帧，按 60fps 换算，未标注测量版本）：取 `frames.total/fps` 作为动作时长。由于是社区数据，**仍标 `est:true`**；视图里 `dur:'frames'`，默认值为 `dur:'default'` 并附 `durReason`（例如“action_frames 无此角色（相里要）”“声骸技能不取 action_frames”“两个来源不一致”）。用户覆盖为 `dur:'config'`、`est:false`。
- 动作名映射：通用规则取每个类别的第一条（跳过空中/闪避反击/长按/链序变体）：`普攻·Basic: <招式> N → A{N}`、`重击 → H`、`共鸣技能 → E`、`共鸣解放·Liberation → R`、`变奏入场·Intro → I`、`延奏 → O`；角色模块用 `frames` 表把模块动作对到具体条目（如今汐 `jinglong → 共鸣技能·Skill 4: Illuminous Epiphany`）。
- 缺失：相里要、卡卡罗、漂泊者·湮灭等不在文件中的角色 → 全部默认值并警告 `frames-missing`；所有声骸技能 → 默认值。
- null / 冲突：源数据为 null，或注明“与 wuwa-calc-data 核对：不一致”（散华 8 项）/“内部矛盾”（漂泊者·导电 Skill 2）→ 默认值并警告 `frames-null`。
- 延奏：源数据为 null（不占独立动作时间）→ 离场方按 0 s，`est:true` 并附 `durReason`。
- 切人：`cancel_s` 是最早取消帧，不是最早切人帧。引擎默认规则 `swapRule:'cancel'`：切人就绪 = max(no_swap, earliest_cancel)，没有取消点时取完整时长；离场动作的伤害全部计入，剩余动画与入场方重叠，切人记录带 `swapCut:{from, at, rule}`。该规则是**引擎假设**（`MECH.swapTiming`，unsolved），可改为 `'full'`（等动作结束）或 `'swapTime'`（max(no_swap, 9f)，wuwa-calc-site 默认）。
- 简单形状也接受：`{characters: {<id|名>: {actions: {<键>: 秒 | {duration|frames, fps, cancel, noSwap}}}}}`，这种形状视为实测值（`est:false`）。

### 1.10 角色模块输出（视图 `toView`）

- `searchable`、`searchDisabled:{reason}`；`team[i]`：`{module, noModule, moduleVersion, confidence, reason}`。
- `resources[]`：`{member, key, label, max, segmented, value, pct, cells, confidence, series:[[t,v]...], path}`（`path` 为 viewBox 0 0 100 10 的 SVG 路径）。
- 时间轴动作：`est`、`dur`、`durReason`、`durSource`、`frameLabel`、`coord`（协同伤害）、`key`、`inferred`、`swapCut`；`seq` 步骤同样带 `est`/`dur`/`durReason`。
- 增益：`autoOff`（触发条件未识别、默认关闭）、`moduleManaged`、`patchedBy`。

---

## 2. 示例（`engine/examples/`；`cases.example.json` 可以直接运行）

共同前提：期望口径，木桩 Lv90，抗性 10%，角色 Lv90，技能 10 级，0 链，武器 R1，声骸 5 星 25 级；CLI 已加载 `validation/action_frames.json`（swapRule=cancel）。数值为引擎输出，不是实测。

| 示例 | 内容 | 结果 |
|---|---|---|
| `jinhsi_solo.json` | 今汐 时和岁稔，手动 `R A A A A E A A A A E E A A A A H` | 177,777（20 s）；惊龙破空（韶光 50）单发 78,973 |
| 同上 + `rotation.mode=search` | 自动搜索 | `E R E A A A A E E A A A A E E A H` = 192,324 |
| `changli_solo.json` | 长离 赫奕流明，手动 `E A E A Q R H A A A A H` | 145,652 |
| `changli_solo_search.json` | 长离 自动搜索 | `E H R H Q A E A H E A A A A A A A A H` = 210,115（动作：劫/征/焚身以火 交替，A 为普攻四段+心眼·征） |
| `zhezhi_solo.json` | 折枝 琼枝冰绡 自动搜索 | 119,377 |
| `shorekeeper_solo.json` | 守岸人 自动搜索（单人只算个人伤害） | 21,404 |
| `team_jinhsi.json` | 今汐/折枝/守岸人，暖开局（协奏满），25 s 搜索 | `S2 S1 R E E A A A A Q E H E H H H H` = 349,833 |
| `team_jinhsi_cold.json` | 同队冷开局 30 s 搜索 | `Q E S1 R A A A A E E A A A A E E S2 E H E S1 E H H E Q A A H` = 250,297 |
| `cases.example.json` | probe / 长离手动 / 团队搜索+减抗 | 见 `cases.example.out.txt` |

装备对比（`compareGear`，`researchRotation:true`，每个方案重新搜索）：

| 角色 | 结果 |
|---|---|
| 今汐（单人 20 s） | 时和岁稔 192,324 > 浩境粼光 −13.7% > 苍鳞千嶂 −17.2% > 焰痕 −17.9% |
| 长离（单人 20 s） | 赫奕流明 210,115 > 裁春 −9.2% > 千古洑流 −11.9% > 裁竹 −15.5% |
| 折枝（冷开局团队 30 s） | 琼枝冰绡 250,297 > 掣傀之手 −0.5% > 和光回唱 −1.7% > 漪澜浮录 −2.0%（单人时与掣傀之手相差 <1%，在搜索噪声内） |
| 守岸人（冷开局团队 30 s） | 星序协响 250,297 > 幽冥的忘忧章 −5.1% > 漪澜浮录/玻色星仪 −6.6%（单人个人伤害排最后：专武价值在共鸣效率与队伍增益） |

## 3. 机制可信度（引擎 `MECH` 表，乘区 `mech`/`basis` 由它驱动；验证后改成 `table` 即可）

| 键 | mech | 置信度 | 依据 |
|---|---|---|---|
| base | table | high | RelatedProperty × 倍率 + 固定值；encore.moe 385/385 行一致 |
| multiplier | table | high | RateLv/10000，与技能描述逐级匹配 |
| stats | community | medium | (白值角色+武器)×(1+%)+固定 |
| bonus | **corroborated** | medium | 1+元素+全属性（不含物理）+类型+通用，同区相加；两份参考印证 |
| deepen | **corroborated** | medium | 攻击方加深同区相加 1+Σ；两份参考印证 |
| deepenTarget | community | low | 目标受伤加深是否与攻击方加深同区（参考分歧），引擎按相加 |
| crit | table | high | 5%/150% 基础；期望 1+min(CR,1)(CD−1) |
| defense | **corroborated** | medium | (800+8L)/(800+8L+(792+8EL)(1−无视)(1−减防))；恒 ≤1，无“上限 2” |
| resistance | **corroborated** | medium | 有效抗性 = 基础 − 减抗 − 穿透；<0 减半；0≤r<0.8 线性 |
| resistanceHigh | community | low | r ≥ 0.8 时 1/(1+5r)（参考 B 无此分段） |
| dmgReduce | unsolved | low | (1−Σ)，默认 0 |
| energy | table | high | Energy/100 × 共鸣效率；解放消耗 = EnergyMax |
| concerto | community | medium | 命中行 ElementPower；为 0 时退回描述“回复协奏能量” |
| swap | community | medium | 协奏满 → 延奏 + 变奏，清零；模块可强制延奏（今汐同奏） |
| durations | unsolved | low | action_frames（社区测帧，est）> 模块估计 > 默认 A 0.55/段，H 1.1，E 1.0，R 2.0，Q 0.8，变奏 1.2，延奏 0，切人 0.25，X 1.0 |
| swapTiming | unsolved | low | 切人就绪 = max(no_swap, earliest_cancel)（引擎假设） |
| buffText | community | low | 描述文本关键词解析（触发条件、目标、层数、持续） |
| buffTable | table | high | AddProp / 技能树数值 |
| echoCd | table | high | phantomskill.SkillCD |
| sonataCount | community | medium | 同名声骸只计一次 |

## 4. 已知限制

1. 角色模块只有今汐、长离、折枝、守岸人；其他角色可手动排轴，但不可自动搜索。模块中的推断规则见 `engine/chars/README.md` 与各文件注释（灵韵获取量、黯星·蝶段数、构形窗口、墨鹤节奏等为低置信度）。
2. 动作时长来自社区测帧（未标注测量版本、按 60fps 换算），声骸技能、延奏和缺失角色仍为默认值；切人时机规则是引擎假设。
3. 增益来自文本解析：
   - “倍率提升”“护盾”“治疗量”这类效果不计入；
   - 无法识别的条件默认关闭（`autoOff`），需要用 `buffOverrides` 开启；
   - 常驻（`on`）的条件增益按满层计；
   - 触发型增益从**下一次命中**开始生效。
4. 声骸 Q 的部分命中标签是 `{1}`/`{2}` 这种数据占位符，只影响显示。
5. 治疗只统计总量，不参与伤害；护盾不计。
6. 只算单目标，不含异常 / 震谐偏移（tuneRupture）伤害累积。
7. 同一描述项被拆成多个 hit 时（build 的 `alt` hit），引擎默认只计主 hit；需要另一状态的命中行时由模块用 `includeAlt` 选用。
