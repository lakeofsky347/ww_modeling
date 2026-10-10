# 鸣潮（Wuthering Waves）伤害机制说明（数据管线 step 1）

数据源：`Arikatsu/WutheringWaves_Data` @ `9218d612ad815e398e064e577e42aaf878899968`（Global / GameVer 3.7.0 / ResVer 3.7.8 / CL 8975829，提交时间 2026-09-30 04:35 SGT）。
补充与核对：encore.moe API（`https://api-v2.encore.moe/api/zh-Hans/`，最新 `Release_3.7.8`，与 repo 同版本）。
产物：`out/ww.json`（`build_ww.py`），自检：`selftest_ww.py` → `out/ww_selftest.txt`。

置信度含义：
- **高**：数值或结构直接由表格得出，并与 encore.moe 的展示或游戏内文本逐项核对一致。
- **中**：表格中有该字段，但公式位置或单位来自社区资料，或只做过间接验证。
- **低**：推测，或社区说法彼此矛盾。

引擎 `MECH` 表中的机制来源标记（`mech`）：
- `table`：直接由表格得出并已核对。
- `corroborated`：社区规则，且被两份独立参考计算器的逐例结果同时印证（见 `validation/REPORT.md`：参考 A wuwa-tools 10/10、参考 B 结构一致），尚未游戏内实测。
- `community`：只有社区说法，或两份参考给出不同结果，需要实测。
- `unsolved`：引擎默认值或估计，没有可靠来源。

---

## 1. 伤害公式总览

```
DMG = 基础区 × 倍率 × 加成区 × 加深区 × 暴击区 × 防御区 × 抗性区 × 减伤区 (× 其它特殊乘区)
```

| 乘区 | 公式 | 来源 | 置信度 |
|---|---|---|---|
| 基础区 | `Σ(属性 × 倍率) + 固定值`。属性取 ATK、HP 或 DEF，由每段命中行的 `damage.RelatedProperty` 决定（7=ATK，2=HP，10=DEF；另有 3/4/11 少量）。 | `damage/damage.json`。ww.json 中每段 hit 的 `scaling` 字段 | 高 |
| 倍率 | `RateLv[技能等级-1] / 10000`。少数 `FormulaType=1` 的声骸行 `RateLv` 全为 0，此时倍率取 `FormulaParam7/10000`，并加固定值 `FormulaParam10`（显示为“48.00%+96”）。 | damage.json，与描述串逐级匹配。encore 385/385 行一致 | 高 |
| 治疗/护盾 | `CalculateType=1` 为治疗：`HP × RateLv/10000 + CureBaseValue[lv]`（显示为“575+2.90%”） | damage.json + skilldescription | 高 |
| 加成区 | `1 + 属性伤害加成 + 技能类型伤害加成 + 通用伤害加成`，同区内相加。 | 属性字段见 `baseproperty`：`DamageChange`（通用）、`DamageChangePhys`、`DamageChangeElement1..6`、`DamageChangeAuto`（普攻）、`DamageChangeCast`（重击）、`DamageChangeNormalSkill`（共鸣技能）、`DamageChangeUltra`（解放）、`DamageChangeQte`（变奏）。社区：fandom “Damage”；两份参考印证（REPORT C7，`corroborated`） | 字段为高；加算方式为中（corroborated） |
| 技能类型归属 | 加成按 `damage.Type` 归类，与技能所在栏位无关：0 普攻，1 重击，2 共鸣解放，3 变奏，4 共鸣技能，5 声骸技能，7 延奏，12 震谐·偏移。 | 与 encore 的 DamageList `Type` 标签比对，384/384 一致 | 0–7 为高，12 为中 |
| 加深区（加深/Amplify） | `1 + Σ加深(攻击方)`，攻击方加深同区相加，与伤害加成分属不同乘区。主要来自延奏、套装和武器文本中的“加深”。目标侧易伤（引擎输入 `enemy.damageTaken`）目前按同区相加：`1 + Σ加深 + Σ易伤`。 | 社区：fandom “DMG Deepen”；9game、gamersky 测试。攻击方加深相加由两份参考印证（REPORT C5，`corroborated`）；易伤是否同区两份参考不一致（C6：相加 1.25 vs 相乘 1.265，`community`，引擎此时把该乘区标为 `deepenTarget`） | 攻击方为中（corroborated）；易伤同区为低（community） |
| 暴击区 | 暴击时乘 `CritDamage`，期望值为 `1 + CR × (CD − 1)`。基础暴击率 5%、暴击伤害 150%。 | `baseproperty.Crit=500`、`CritDamage=15000`（÷10000）。所有角色相同 | 高 |
| 防御区 | `(800 + 8·Lv攻) / (800 + 8·Lv攻 + DEF敌 × (1 − 无视防御) × (1 − 减防))`。按此式，防御区的值恒在 (0, 1] 内（无视+减防到 100% 时为 1），reddit 帖提到的“上限 2”在这一写法下不可能达到，引擎不设该上限。 | 社区：fandom “Damage”、reddit r/WutheringWaves “DMG formula explained”、巴哈姆特 sn=32003；两份参考印证（REPORT C2/C3/C10，`corroborated`） | 中（corroborated） |
| 敌人防御 | `DEF敌(Lv) = baseproperty.Def × monsterpropertygrowth.DefRatio(Lv)/10000 = 800 × (1 + 0.01(Lv−1)) = 792 + 8·Lv` | 表格推导。build 中对曲线 0 的全部等级都做了断言（`meta.enemyDefFormulaCheck`）；曲线 3001 的 DEF 与之相同 | 高 |
| 无视防御 / 抗性穿透 | 属性字段存在：`IgnoreDefRate`、`IgnoreDamageResistancePhys/Element1..6`。减抗与穿透都从基础抗性中直接减去（`res = 基础 − 减抗 − 穿透`）。 | baseproperty 列。位置采用社区说法；减法写法由两份参考印证（REPORT C2/C3，`corroborated`） | 字段为高；位置为中（corroborated） |
| 抗性区 | `res<0：1 − res/2`；`0 ≤ res < 0.8：1 − res`；`res ≥ 0.8：1/(1 + 5·res)`。其中 `res = 基础抗性 − 减抗 − 穿透`。 | 社区：fandom “Damage”、reddit。巴哈姆特帖写的是负抗减半，与 fandom 一致。负抗减半与线性段由两份参考印证（REPORT C1/C3，`corroborated`）；≥80% 段只有参考 A 采用，参考 B 无此分段（C4，`community`，引擎此时把该乘区标为 `resistanceHigh`） | <0.8 为中（corroborated）；≥0.8 为低（community） |
| 敌人基础抗性 | 表内只有三种值：0.1（1694 项）、0.4（240 项）、1.0（5 项，即免疫）。来源是 `baseproperty.DamageResistancePhys/Element1..6 / 10000`。 | 表格。与社区“大世界全抗 10%、对应属性 40%”一致 | 高 |
| 减伤区 | 目标侧 `DamageReduce*`（通用、物理、各元素），推测为 `1 − Σ` | baseproperty 字段 | 字段为高；公式为低 |
| 其它 | `SpecialDamageChange` 列，以及 commonparam 的 `AddDamageRatio=15000`、`OtherAddDamageRatio=5000`、`AddDamageList`、`OtherAddDamageList`，用途未知（疑似评分权重） | 表格 | 低 |

**属性计算**
- 角色在（等级, 突破）下的白值：`base × rolepropertygrowth.{LifeMax,Atk,Def}Ratio / 10000`。共 96 个点（突破节点处有两档）。与 encore 的 6 名角色×3 项×96 点全部一致。置信度高。
- 武器：`FirstPropId.Value × weaponpropertygrowth(FirstCurve, lv, breach) / 10000`，副属性同理。百分比属性的 `Value` 已经是小数，例如 0.081。与 encore 的 2 把武器×2 条×96 点一致。置信度高。
- 最终 ATK：`(角色白值 + 武器白值) × (1 + ATK%) + 固定 ATK`。这是社区通行写法，置信度中。

---

## 2. 能量与轮转

| 项 | 规则 | 来源 | 置信度 |
|---|---|---|---|
| 共鸣能量上限 / 解放消耗 | 上限 = `baseproperty.EnergyMax/100`，与解放描述“消耗共鸣能量”完全一致（62/62）。洛瑟菈、弗洛洛的 `EnergyMax=0`，解放不消耗共鸣能量，靠专属资源（`energy.note`）。 | 表格互证 | 高 |
| 每段命中回能 | `damage.Energy/100`（例：秧秧普攻一段 0.75）。实际获得量 × 共鸣效率（`EnergyEfficiency`，基础 100%）。 | 数值为表格（encore 显示一致）；乘共鸣效率是社区说法 | 数值为高；效率为中 |
| 协奏能量 | 上限 `ElementEnergyMax/100 = 100`。普攻、重击类命中带 `ElementPower/100`（例：2.4）。共鸣技能、解放、变奏的命中行多为 0，其协奏回复取技能参数“回复协奏能量”（`skill.concertoGain`，例：秧秧技能 15、解放 20），推测在施放时由 buff 结算。`ElementPowerType` 在 93% 的命中行上等于角色属性，是标签而非单位。 | 表格。逐段求和与描述值只在 11/217 个技能上吻合 | 数值为中；结算时机为低 |
| 延奏 / 变奏 | 协奏能量满 100 时切人：当前角色释放延奏（Type 7），入场角色释放变奏（Type 3），之后协奏清零。延奏效果见技能类型 11 的描述（多为加深或回能）。 | 社区：fandom “Concerto”、游戏内教学文本。表中没有找到切人冷却常量 | 中 |
| 声骸技能 CD | `phantomskill.SkillCD`（秒），按声骸种类给出；只有首位（主位）声骸的技能可主动释放。 | 表格（encore 2/2 一致）。“只有主位”是游戏文本加社区说法 | CD 为高；主位规则为中 |
| 共振度 / 偏谐值 | 每段命中：`toughness = ToughLv/10000`，`offTune = WeaknessLvl/10000`，`hardness = HardnessLv/10000`。敌人有 `ToughMax`、`HardnessMax`、`WeaknessBuildUpMax`。 | 单位采用 encore 的显示，385/385 一致；游戏内如何换算未验证 | 中 |
| 谐度破坏 / 震谐·偏移 | 技能类型 12（谐度破坏），以及 Type 12 的伤害；commonparam 中的 `WeaknessDamageBaseValue`、`WeaknessDamageBreakRate`、`WeaknessDamageMonsterTypeRate` 未解码。 | 表格 | 低 |

---

## 3. 表格常量（ww.json `meta.constants`）

| 常量 | 值 | 来源 |
|---|---|---|
| 比率刻度 | 10000（Crit 500 = 5%） | baseproperty / propertyindex.IsPercent |
| 能量刻度 | 100 | EnergyMax 10000 ↔ 消耗 100 |
| 协奏刻度 | 100 | ElementEnergyMax 10000，encore 显示 |
| 韧性刻度 | 10000 | encore 显示 |
| 敌防曲线 | 792 + 8·Lv | monsterpropertygrowth 推导，已断言 |
| 角色防御常数 | 800 + 8·Lv | 社区，两份参考印证（中，corroborated） |
| 抗性分段 | 0 / 0.8 | 0 分段 corroborated；0.8 分段 community（中/低） |
| 声骸主词条 | `StandardProperty × phantomgrowth(GrowthId, L)/10000`。L = 0..25，+25 时为 5 倍，例如 4C 攻击% 6.6% → 33%，1C 固定生命 456 → 2280。 | phantommainprop* |
| 声骸 COST | Rarity 0/1/2/3 → COST 1/3/4/4 | phantomrarity |
| 声骸品质上限等级 | 品质 2/3/4/5 → 10/15/20/25 | phantomquality |
| 声骸副词条 | `phantomsubproperty.SubStandardProperty`。各档具体值未解码（见下文“待解决问题”）。 | 表格 |

---

## 4. 命中（hit）归属方法与置信度

- 技能描述行来自 `skilldescription`（例：`23.55%*2+39.81%`），拆成若干项 `x%*n`，并识别固定加值。
- 某一项在每个技能等级上的 `round(x×100)` 都等于某行 `damage.RateLv`（容差 ±1）时，判为匹配，`confidence: 'high'`。
- 搜索范围：先在本技能的 `DamageList` 中找；找不到再扩大到该角色所有技能；声骸则在 `SettleIds` 中找。
- 以下情况标为 `'low'` 并写明 `lowReason`：
  - 多个候选行的类型、元素或缩放属性不一致；
  - 描述中混有文本；
  - 没有任何行能匹配。
- 只要命中了 damage 行，就会带上该行的 `energy`、`concerto`、`toughness`、`offTune`、`type`、`element` 等字段。多行匹配时，其余行放在 `variants` 中。
- 同一描述项匹配到多行、且这些行的类型/元素/缩放/计算方式不同时，按 `(type, element, scaling, calc)` 分组拆成多个 hit，每个 hit 带自己的 `type` 和 `damageIds`（同组的其余行仍放在 `variants`）。第一组为主 hit（`splitGroup: 0`）；其余组标 `alt: true`、`splitGroup: n`、`splitOf: N`，表示同一描述项在另一状态下的命中行（例：同一“空中攻击”分别属于普攻与共鸣技能行）。引擎默认不把 `alt` hit 计入伤害，避免重复计数；角色模块可显式选用（`includeAlt`）。3.7.8 中共 31 个描述项被拆分，产生 33 个 alt hit；与 wuwa-tools 按 damageId 比对类型不一致数从 22 降到 0。
- 技能 `DamageList` 中未被任何描述引用的行放在 `unlinkedDamage`，标 low。这类多为条件段、变体或连携段。
- 标签中不含“伤害”、或属于加成/护盾/减伤的百分比行，不计入 hits，只作为参数，标记为 `kind: nonDamagePercent`。
- 武器被动和套装文本用关键词词典解析出 `effects`：
  - 无条件的数值类效果为高；
  - 带触发条件的（“施放…时”“…后”等）为低，并记录 `maxStacks` 和 `duration`；
  - 套装中的 `AddProp`（例：2 件套 10% 属性伤害）直接取自表格，为高。

---

## 5. 待解决问题

1. **协奏结算时机**：共鸣技能、解放、变奏的命中行 `ElementPower=0`，描述中的“回复协奏能量”是一次性给出还是按段给出？逐段求和只在 11/217 处与描述一致。
2. **共振度 / 偏谐值的真实单位**，以及谐度破坏、震谐伤害公式（commonparam `WeaknessDamage*`）。
3. **damage.Type 中 6、9、10、11、14 的含义**（共约 160 行，多为治疗或特殊机制）。encore 对 14 显示为空。
4. **怪物等级曲线**：模板未指定时默认用曲线 0；encore 对示例怪选了 3001。两者 DEF 相同，HP 不同。在 310 个怪中，33 个找不到对应模板（多为“异相”系），没有属性数据。
5. **一怪多属性行 / 实际关卡加成**：3.7.8 中每个 blueprint 的全部刷新模板都指向同一 PropertyId（0 例冲突，`propertyVariants` 保留以备将来）；但关卡等级与 `WorldLevelBonusId` / `MonsterPropExtraRateId` 加成未建模。
6. **声骸副词条档位值**：`phantomsubpropaction` 是二进制 BinData，未解码。
7. **抗性高区 `1/(1+5res)`**（有效抗性 ≥80%）：只有社区与参考 A，参考 B 不采用，需要游戏内实测（免疫档敌人才会触发）。原先列出的“防御区上限 2”已删除：按现行防御公式，防御区恒 ≤1，这个上限不可能触发。减防与无视防御的乘法位置已由两份参考印证（corroborated）。
8. **加深区内部**：攻击方加深同区相加已印证（corroborated）；受击方易伤是否与攻击方加深同区（fandom 写相加）仍有分歧（community）。
9. **“异相”系声骸**（6020xxx 等）的技能文本与 `SettleIds` 不对应，共 121 项 echo hit 为 low。3 个条目缺少中文名：60200501、60200613、怪物 340000111。
10. **少数声骸展示倍率与 damage 行不一致**（例：异相·无常凶鹭，显示 310.56%，而行值为 43.24% 与 240.96%）。可能是分段合并显示，尚未确认。
11. **切人冷却、变奏/延奏的触发条件常量**未在表中定位。
12. **异常效应乘区与 GE 枚举解读**：只有 wuwa-calc-site 一份参考，没有实测；暂不确定守岸人延奏这类“全伤害加深”是否作用于异常效应（引擎不计入）。
13. **耐力常量**：数据坞 +100、1.5 s 回复延迟、全队共用都来自社区说法，表里没有找到。

---

## 6. 异常效应（风蚀 / 光噪 / 电磁 / 聚爆 / 霜渐 / 虚湮）——引擎 ww-engine-0.2

数据：`ww.json.anomalies`（`build_ww.py anomalies()`）。原始来源 `buff.json` 的 GE 字段 + `AbnormalDamage/abnormaldamageconfig`。

| 效应 | buffId | 持续 | 周期 | 规则（表格字段解读） | 上限 |
|---|---|---|---|---|---|
| 风蚀 erosion | 10040000 | 14.8 s，附加即刷新 | 3 s | 附加即跳一次；到期全部移除 | 3（模块可改，卡提希娅链2 +3） |
| 光噪 frazzle | 10050000 | 3 s，不刷新 | 3 s | 每跳后 −1 层并续 3 s（RemoveNumber=1） | 10 |
| 电磁 flare | 10030000 | 15 s | 5 s | 每跳后层数 ×0.5（decayRatio）；溢出部分记为电磁爆发（burstTable）；减半是否续时见 §6.1（unsolved） | 10 |
| 聚爆 burst | 10020000 | — | — | 满层（或模块的 detonateAbove）按层数引爆并清空 | 10 |
| 霜渐 chafe | 10011000 | 15 s | — | 附加时结算；满层冻结并清空 | 10 |
| 虚湮 bane | 10060000 | 25 s | — | 每层减防 2%（defReduceTable） | 3 |

- **基础值（表格，high）**：附加者等级的 AbnormalDamage 值（Lv90 = 3674）× 每层倍率表（ExtraEffectParameters “层#值”/10000），超出表尾按最后一级步长外推。
- **乘区（社区，low）**：不暴击；不吃攻击、属性、技能类型加成；只吃 `dmg:anomaly[:type]` / `deep:anomaly[:type]` 与目标侧效果（受伤加深、减抗、减防、虚湮减防）；防御按附加者等级。模块可以通过 `anomalyCrit` 钩子把暴击改成固定值（爱弥斯链6 80%/275%，心链6 80%/230%）。
- **时序（low）**：GE 枚举按 UE GAS 解读（StackDurationRefreshPolicy 0=附加刷新，StackPeriodResetPolicy 1=不重置，StackExpirationRemoveNumber 0=全清 / 1=减一层）。同一时刻先跳伤再到期。动作伤害使用动作开始时的异常状态；动作期间的跳伤按时间顺序结算；模块在动作结束（tEnd）附加层数。
- **wuwa-calc-site `negativeStatus.ts` 交叉核对**：六种每层倍率表逐项一致；乘区结构（不暴击、只吃专属加成/加深与目标侧效果）一致（单一参考，未实测）。不一致或参考未覆盖的地方：
  - 霜渐另有一个 10010000 变体，倍率 1225，只有 10011000 的 2450 与参考一致，引擎用 2450，已在 `tableVariants` 中标出；
  - 光噪“每跳减一层”、电磁“每跳减半”、风蚀“附加即跳”取自 GE 字段，参考按固定跳数估算，未逐跳模拟。
  - wuwa-tools 没有实现异常效应。
- **引擎接口**：
  - `api.addAnomaly(type, n, {cap, external, noDecay, detonateAbove, periodScale})`、`api.detonateAnomaly(type, {stacks:'cap'|n, scale, remove})`、`api.clearAnomaly`、`api.anomaly(type)`、`api.anomalyMult`；
  - 模块钩子 `anomalyPeriodScale` / `anomalyStats` / `anomalyCrit`；
  - 触发器 `anomaly`（自己附加）、`anomalyTeam`（任一队员附加）、静态条件 `targetAnomaly {kinds, minStacks}`。
  - external = 队友维持的层数，只用于条件判定，不产生伤害（菲比 `frazzle:'external'`）。
- **输出**：
  - 伤害记在附加者名下，类型 `anomaly:<type>`；
  - timeline 中的状态条目为 `cls 'Z', status: true`；
  - `result.anomalies.log`；
  - 视图字段：`timeline.status`（层数段、跳伤、引爆）、`share.byType[].status`、`breakdown.rows[].status`、摘要卡“异常效应伤害”。
- **CLI 探针**：`case.probe = {member, anomaly, stacks, ticks, cap, noDecay, detonate, scale, crit, extraStats, electroRefreshOnHalve}`，逐跳打印乘区；检查项为 `expect.{first, sum, count, ticks[]}`。示例见 `validation/anomaly_probes.example.json`（Lv90 对 Lv90、抗 10%）：
  - 风蚀 3 层每跳 3,729.7（5 跳）；
  - 光噪 10 层首跳 4,136.0；
  - 电磁 10 层首跳 6,893.4，之后 5 层、2 层；
  - 聚爆 10 层引爆 11,580.9。

### 6.1 两条未定规则（REPORT §9.4，保留引擎现状，可切换/已标注）

- **电磁减半是否续时（`MECH.electroDecay`，unsolved / low）**：
  - 读法 A（引擎默认）：15 s 持续时间从首次附加起算，减半不刷新 → 10 层 10→5→2 共 3 跳（N4：6,893.4 / 3,524.2 / 1,502.7，合计 11,920.2）。
  - 读法 B（wuwa-calc-site）：每次到期减半并刷新持续 → 10/5/2/1 共 4 跳，多一跳 1 层 828.8（合计 12,749.1，+6.5%；N4b）。
  - 原始数据 `StackDurationRefreshPolicy=0` 只说明“附加时刷新”，减半是否续时无法判定，需实测 10 层电磁总跳数。
  - 切换：`config.electroRefreshOnHalve = true`（页面“设置 → 电磁效应减半”，CLI 探针同名字段）。
- **目标侧受伤加深（`MECH.deepenTarget`，community / low）**：引擎把 `enemy.damageTaken` 与攻击方加深相加放在同一加深区（直伤与异常效应同一口径）；另一读法（wuwa-calc-site）为独立乘区 (1+加深)×(1+受伤)。差异：直伤 C6 1.25 vs 1.265；异常 N8 风蚀 3 层 + 加深 50% + 受伤 10% 为 5,967.6 vs 6,154.1（−3.03%）。保留相加，异常乘区明细里同时给出相乘读法的数值。
- **虚湮探针**：`probe = {anomaly:'bane', stacks:3}` 不产生伤害，逐层输出减防 / 敌方有效防御 / 防御区 / 相对 0 层的增伤（`expect.defReduce / defZone / defZones[]`）。Lv90 心 → Lv90 敌人：防御区 0.501319 → 0.506370 → 0.511523 → 0.516782（3 层 +3.08%），见 cases.json N12（`MECH.bane`，table / medium）。虚湮减防同时作用于直伤与其它异常效应（并入 defReduce）。

## 7. 耐力（community / medium）

- 上限 240：baseproperty StrengthMax 14000/100 = 140（表），加上数据坞 +100（社区）。
- 回复 25/秒：StrengthRecover 250，与 fandom 一致。停止消耗 1.5 s 后开始回复（fandom）。全队共用（社区）。
- 重击消耗取技能参数「重击…耐力消耗」，按动作标签匹配（例：心「重击·应世相」20、维里奈 30），每秒消耗类按时长计；找不到时用 25。
- 耐力不足时动作被拒（`steps[].noStamina`，视图 `lanes[].rejected`）。`config.stamina=false` 可关闭；`config.stamina={max,regen,delay,heavyCost}` 可覆盖；`start.stamina` 设定开局耐力。
- 效果（单人自动搜索）：
  - 心：重击 44/50 → 23/44；
  - 维里奈：28/31 → 14/34（最长连击 8 次，即 240/30）。

## 8. 延奏 forced 标记与搜索估值

- `swapOut` 返回 `{force:true, reason}` 时，延奏动作带 `forced` / `forceReason`，`outro` 事件带 `forced` / `reason`。今汐、心的同奏用的是 `reason:'tongzou'`。
- 搜索启发式在原有内容之外，再加入以下估值：
  - 未结算异常的价值；
  - 生效中增益的剩余价值：剩余时长 × 目标单位时间伤害 × 增益比例 × `search.buffWeight`（默认 0.5），在场成员全额，离场成员减半；
  - 队伍（≥2 人）的 IO 潜力 = 入场 + 延奏伤害 + 延奏增益价值；单人为 0；
  - 模块可用 `api.teamStatValue(stats, dur)` 估算光环价值（守岸人星域）。
- `compareGear({researchRotation:true})` 会把每个变体放到其他变体的最优序列上重放（cross-seed），取较高值，避免 beam 漏解造成误判。

## 9. 搜索估值修正与窗口末尾（0.3 前修复，2026-10-09）

- **估值缓存键冲突（bug，已修）**：`estimate()` 原按 `成员|动作 key|scale` 缓存，模块动作与通用 kit 动作同 key 时互相覆盖。卡提希娅的模块 R（化身，无命中）与通用 kit.R（看潮 7 段）同为 `R`，导致“满能量”被估成看潮伤害、而施放 R 得 0 → 搜索永不放 R。现键含标签 + 命中行签名 + 等级。
- **能量价值**：`potential.R` 改用模块自己的 R（`modKit.R`，没有时用通用 kit.R）；模块也可提供 `energyValue(ctx, mi, est)`。
- **常规输出速率 `baseRate`**：搜索启发式用“剩余时长 × 常规输出速率”做时间归一化。原取通用 kit 的普攻段与 kit.H；心的通用 kit.H 是「重击·应世相·闲中御」（单段 15,397 / 0.73 s，约为真实重击的 6 倍），使无伤害的转相（4.2 s）被严重扣分 → 心从不转相。模块现可声明 `fillerKeys`（心：yA1–4、yH）。
- **窗口末尾动作（`config.endCredit`，`MECH.endCredit` unsolved，2026-10-09 起默认 `'prorate'`）**：时长结束时仍在进行的动作，伤害和能量都按窗口内时长占动作时长的比例计入。没有逐段命中时间表，所以按线性计算。`'full'` 为旧行为（全额计入），保留在 config 和页面设置“窗口末尾动作”里。全额口径下，搜索会把长动画大招放在窗口末尾（爱弥斯终结技 29.87 s 开始、只有 0.13 s 在窗口内仍计 6.2 万；卡提希娅看潮 0.13 s 计 10.5 万）。视图输出：越界动作带 `truncated / credit`（页面 `.ww-act[data-truncated][data-credit]`），breakdown 行带 `tr[data-truncated]`，第一条时间轴上画窗口结束线 `i.ww-window-end`；同时给出 warning `code:'end-credit'`。
- **（已过时，见 §10/§11）时停未建模（`MECH.timeStop` unsolved）**：action_frames 的 `time_stop` 帧（多数共鸣解放动画全程时停，例如卡提希娅 R 3.3 s、看潮 5.0 s）期间，游戏内的增益、异常、冷却计时是否暂停没有建模。引擎按实际动作时长推进所有计时，对所有角色口径相同。时间轴里出现含时停的动作时给出 warning `code:'time-stop'`，动作提示里也会注明。
- **R 使用审计**（全部 19 个示例 / 10 个模块）：修复前，卡提希娅（R 0 次）和心（转相/万阙垂天 0 次）从不放 R。其余模块均使用 R 及专属终结技（珂莱塔 致死以终、菲比 赦罪/星辉、爱弥斯 终结、今汐 惊龙破空、长离、折枝、维里奈）。守岸人 R 在单人和 25 s 队伍窗口内不放：单人时星域二阶段需要变奏，无法生效；手动插入 R 后菲比队 373,106 → 344,545~361,943。属于窗口长度造成的结果，不是模块缺陷。

## 10. 窗口与残值引导 / 稳态开局 / 帧源口径（2026-10-09 16:30 SGT）

**残值引导（MECH.residual，heuristic，只影响搜索，不改报告伤害）**
- 终值项 = Σ 窗口结束后仍生效的增益实例 × min(剩余时长, `search.residualHorizon`，默认 min(窗口, 15 s)) × 持有者持续输出速率 × 增益相对收益（在场 ×1、后台 ×0.5），再加模块 `residual(api, D, H)` 钩子：守岸人星域（剩余时间 × 当前阶段暴击/暴伤光环；1 阶按半值）、维里奈光合标记（剩余协同次数 × 单次估值）。
- 用在两处：beam 启发式与最终选序（damage + 0.5 × 残值）。`r.residual.value` 与 `ranked[].residual` 单独报告，`r.total` 不含它。
- `search.residual`: `auto`（≥2 人队伍开，单人关）/ true / false；`search.residualWeight` 默认 0.5。权重 1–2 时搜索会为窗口外增益牺牲 20–45% 窗口内伤害（今汐/心 510k→287k、珂莱塔 566k→392k），因此定为 0.5。
- `search.calibrate=true`（默认关）：先搜一次，用各角色实际“伤害/在场秒”（夹在 [filler, 3×filler]）重估增益价值再搜。测试中会放大残值、让预设不稳（珂莱塔 566k→400k），只作为可选项。

**稳态开局（MECH.steady，`start.steady`, `start.steadyLoops` 默认 2）**
- 先冷启动跑一轮；之后每轮都从上一轮的结束状态开始，所有时间 −D。继承的状态包括：在场角色、能量、协奏、连段、冷却、增益实例、异常效应、耐力，以及模块状态（有 `carry(api, cs, D)` 钩子时由模块平移计时字段，例如守岸人、维里奈；没有时只继承非派生资源，计时窗口重置）。报告最后一轮的结果。
- 稳态的各轮还会把结束时的能量、协奏、模块潜力作为终值参与选序，避免某一轮把资源打空。
- 视图：`summary.runMode` {kind, label, reason}；`lanes[i].carry`（能量、协奏、冷却、剩余增益、资源、title）；`r.runMode.history` 记录每轮的序列和总伤。

**时停（MECH.timeStop，community，默认 `timeStop: "exclude"`，16:28 团队决定）**
- 游戏中共鸣解放等动作的时停帧期间，增益、冷却、异常的计时冻结，也不消耗战斗时间。因此引擎把 action_frames 的 time_stop 帧从该动作的战斗时长中扣除；伤害照常结算，切人/取消点夹在剩余时长内。
- WuWaSim 条目的 freezeTime 与 stepDuration 的关系未明，暂不扣除。
- `timeStop: "include"` 是旧口径（按完整动画推进所有计时），页面设置里可以切换。
- 持续输出速率（filler rate，用于搜索估值）仍用完整动画时长计算，避免时停动作被当成近乎瞬发的输出（否则心的速率会算成 24 万/秒）。
- **整段时停的动作计 0.05 s（B1，确认是期望口径）**：time_stop ≥ 动作时长时，动作在战斗时钟上只占 0.05 s（`max(0.05, dur − timeStop)`），`durationFull` 保留完整时长。伤害照常结算；动作结束时触发的增益从时停结束后开始计时、按自身时长持续（test/timestop.test.js 验证弗洛洛圆舞曲之后的增益 > 5 s）。
- **防刷（lead 16:41）**：整段时停的动作全部受冷却/能量/模块资源门控，搜索无法连放：珂莱塔 zhisi、心 linhy/zhenhy、清宵 天极·无相（tj，需心剑 xj 一次）/共鸣解放、赞妮 zj、弗洛洛 圆舞曲（需定音 coda 一次）/R、爱弥斯 fin（cd 25）、卡提希娅 看潮（cd 25）、守岸人 洞悉（每个解限星域 1 次）。实测 25/40 s 每个时停动作 ≤ floor(d/12)+1 次、间隔 > 5 s、伤害占比 < 60%；未发现无门控的动作，所以没有加“实时下限”。测试：test/timestop.test.js（门控逐个按资源次数断言）。
- **17:20 起改为 WuWaSim `toa` 口径（lead 基准 validation/TEAM_BENCHMARK.md）**：
  1. 默认只扣除**消耗能量的共鸣解放（cls R 且 cost>0）主镜头**的时停。其他时停（共鸣回路/强化动作、谐振破坏、不耗能量的解放/续接）按完整动画计时，除非帧条目或模块动作带 `tsVerified`（字符串 = 实测来源；`tsSource` 同义）。随附的 action_frames.json **没有任何 tsVerified 条目**（测试只在 fixture 里加）。页面 runtime 精简帧保留 tsVerified/tsSource。
     时间轴记录 `tsBasis`：`liberation` / `verified:<来源>` / `not-liberation`；页面 freeze 标记对后者显示“非耗能解放，按完整动画计时”，警告分别列出“已扣除”和“按完整动画计时”的动作。
     `config.timeStopScope:'all'` = 17:20 前口径（所有时停都扣），只用于对照/复现（team_benchmark `--scope all` 逐值复现 lead 表）。
  2. 组合动作（模块 frames 映射为标签数组）时停取各段最大值，只扣一次（WuWaSim resolveFreezeSchedule），时长照旧相加。注：奥古斯塔「赫日威临」实为单标签（503f 时停），lead 表中 8.38 s/次 的节省来自“非耗能解放也扣”，现在按完整 8.38 s 计时。
  3. 时停期间增益/冷却/异常计时冻结（WuWaSim、calc-site）。**Prydwen 2024 称增益计时不冻结——待验证**；引擎维持冻结。
  4. 更新后的整段时停动作清单（原 10 项，门控测试仍在 test/timestop.test.js）：仍扣除 = 各角色耗能 R（清宵/心 wqct/露西 dd、nr/爱弥斯 R/守岸人 R…）；改为完整计时 = 珂莱塔 zhisi、心 zx/zhenhy/wqlh、清宵 天钧荡煞 tj、赞妮 zj、弗洛洛 圆舞曲、爱弥斯 fin/gyM/gyP、卡提希娅 看潮、守岸人 洞悉、今汐 惊龙破空、露西 dl、奥古斯塔 赫日威临。
     冲突待核：arabwuwa 实测奥古斯塔整套（含赫日威临）场上 11.58 s，与“赫日威临 8.38 s 全计时”难以同时成立 → 有实测来源后可给该帧条目加 tsVerified。
  5. 期望值变更（全部可用 timeStopScope:'all' 复现旧值）：页面预设 默认今汐 524056→516794、珂莱塔 504211→458629、卡提希娅 542382→460077、心 700115→500029、爱弥斯 546007→496412、奥古斯塔 567878→420089、清宵 650776→621789，菲比/长离/折枝/守岸人单人不变。测试：今汐 惊龙破空 exclude 下 2.9 s（原 0.7 s）；弗洛洛单人 30 s 搜索不再放圆舞曲（完整 4 s、无伤害），队伍 team_phrolova 仍放；圆舞曲后增益保持完整时长的测试改用 tsVerified fixture；卡提希娅 kanchao 断言忽略异常状态行。cases.json 无时停相关期望（76 项全部 OK）。
- 输出：`result.timeStopSaved`（秒，= Σ(durationFull − duration)，include 下为 0）、`result.timeStopMode`；`view.summary.timeStopSaved`；时间轴动作 `freeze {sec, excluded, leftPct, widthPct}`（exclude 时 widthPct 0，只画细标记）。页面：汇总卡 `.ww-tag.timestop`（为 0 时加 `.zero`），设置区 `.ww-seg.timestop-seg`（时停不计时 / 按完整动画），时间轴 `<i class="ww-freeze">`。

**队伍预设窗口（exclude 下重新评估）：恢复各预设原来的 25/30 秒**
- exclude 之后，守岸人/维里奈/心在原窗口内就会放 R 并做变奏/延奏（按原窗口实测）：
  - 奥古斯塔队 25 s：守岸人 R1 I1 O1。
  - 菲比队 25 s：守岸人 R1 I1 O1。
  - 珂莱塔队 25 s：守岸人 R1 O1。
  - 卡提希娅队 25 s：守岸人 R1 I1 O1。
  - 今汐/心队 30 s：心 R2，守岸人 R1。
  - 椿队 30 s：守岸人 R1 O1。
- 40 秒只会抬高总量，DPS 反而下降，且与社区 25–30 s 轴的口径不一致，所以撤回。
- 卡提希娅队保持 25 s：在 40 s 下守岸人反而 R×0。
- `search.residualWeight` 仍为 0.5。exclude 下，各预设残值关闭 / 0.25 / 0.5 / 1 的总伤（单位：万）：

  | 预设 | 关闭 | 0.25 | 0.5 | 1 |
  |---|---|---|---|---|
  | 珂莱塔队 | 43.3 | 45.0 | 48.4 | 48.8 |
  | 卡提希娅/千咲队 | 86.6 | 86.2 | 88.1 | 83.2 |
  | 爱弥斯队 | 52.8 | 52.0 | 54.6 | 52.0 |
  | 奥古斯塔队 | 57.4 | 57.4 | 56.8 | 57.0 |

  多数预设在 ±3% 内，0.5 是较稳的折中；千咲队只有在 0.5 时守岸人才放 R。报告伤害始终不含残值。

**帧源口径（action_frames 第 3 轮）**

| 来源 | 时长口径 | 取消帧 | 置信 / 处理 |
|---|---|---|---|
| WuwaLAB | total_frames/60，完整动作 | earliest_cancel / no_swap | est |
| wuwa-calc-data | actionDuration/60 | swap 9f | est |
| WuWaSim（3.6 客户端） | `duration_s` = stepDuration，即可以开始下一动作的时刻 | 无（cancel null，切人就绪按全时长）；`markers_s.freezeTime` 记作时停 | 比 WuwaLAB 中位短 0.083 s；该角色只要有 WuwaLAB 条目就不使用 WuWaSim |
| Riley31415/wuwa_calc（锁暝） | animFrames/60 | 无 | 低置信，`frames-lowconf` 警告 |

- 每个角色的通用映射只用一个主来源（WuwaLAB > calc > WuWaSim > Riley）。时间轴 title 显示来源标签（`durSrcTag`）。
- 声骸：`echoes` 字段中的 5 个声骸取帧数据（多段相加，例如燎照之骑 1+2+3），其余声骸用默认值。
- `discrepancies`：只要与队员实际用到的动作相关，就输出 `frames-discrepancy` 警告。

## 11. 共鸣链覆盖 / 搜索资源前瞻 / 辅助轮转（2026-10-09 17:00 SGT，stream A）

**共鸣链覆盖 `chainModeled`**
- 每个成员：`chainModeled = max(模块声明 chainModeled, 通用解析从 1 链起连续可建模的链数)`；无模块时为 null（通用解析，不截断）。
- 配置链数 > chainModeled 时，按 chainModeled 计算，并给出 warning `{code:'chain-unmodeled', chainModeled, chainCfg, text:'<名字>: 共鸣链未建模，按 N 链计算（配置 M 链；…未计入）'}`。
- 字段：`result.members[i].chainModeled` / `chainCfg` / `chain`（实际计算的链数）；`view.team[i]` 同名字段；`WW.chainModeledOf(data, id)` 供页面在运行前判断。页面：超出的链节点 `<i class="on unmodeled">`，卡位与共鸣链下拉旁 `.ww-tag.chain-cap`。
- 模块声明值来自模块代码里实际处理到的最高链（部分链只建了一部分时仍按该链计，模块 notes 里写明）。布兰特 1、守岸人 1、吟霖 5、折枝 2、菲比 3、陆·赫斯 2 等；无声明的模块（长离、秧秧、露西等）只认通用解析的链。

**搜索资源前瞻（B12a，只影响搜索）**
- 模块钩子 `hold(api, act, remaining)`：强化版本在剩余时间内可达时，不让搜索放弱版本。露西：暗网深潜可达时不放网络行者；丹瑾：120 彤华可达时不放 60 彤华的缭乱。`search.hold: false` 关闭。手动序列不受影响。
- 效果：露西单人 25.6 万→31.2 万，露西队 49.1 万→59.3 万；丹瑾单人 18.0 万→21.6 万，丹瑾队 22.6 万→25.3 万。

**辅助轮转（B12b，只影响搜索）**
- 非 dps 模块角色在场且能量够放 R（cost > 0）、剩余时间足够时，搜索不允许切出，直到放完 R（变奏 → 技能 → R → 延奏）。`search.supportCycle: false` 关闭。
- 约束会缩小束搜索，所以同时跑一遍不加约束的搜索；它的结果如果本身满足约束（回放检查），就一起参与排名。代价是队伍搜索耗时约 ×2（页面预设 ≤ 0.7 s）。
- 结果：所有公开配队里的辅助都至少放 1 次 R（秋水、秧秧、吟霖、维里奈原来 0 次）。代价：忌炎/秋水队 35.3→33.4 万、秧秧队 34.4→32.4 万、吟霖队 34.7→31.7 万、维里奈/珂莱塔队 40.9→39.8 万（强制放 R 占用场上时间）；尤诺队 61.5→74.4 万、赞妮队 45.0→51.4 万、陆·赫斯队 41.6→44.8 万。

**其它核心项（stream B 移交）**
- B3：幽夜隐匿之帷 5 件的 480% 湮灭延奏伤害作为额外延奏行（sideDamage，计入延奏）；属性加成解析修正。
- B9：`echoCast`（声骸技能与模块 `echoCast` 动作）、`shield`（获得护盾，含给予者 `by`）事件派发到 onTeam。
- B11：套装 32「普攻伤害加成和重击伤害加成」并列解析；「击败/击杀…」条件的效果默认关闭（木桩不触发，可手动开启）。露西模块里的对应补丁已删除。
- B4 偏谐（谐度/偏移）：**仍未建模**（MECH.tune unsolved）。核心只提供最小状态钩子 `api.applyTune / tune / clearTune` 和触发类型 `tune` / `tuneTeam`。

## 12. 霜渐/霜冻规则 · 奥古斯塔时停 · 安可黑咩（2026-10-09 18:xx SGT，stream A）

**霜渐 chafe（`MECH.chafe`）**
| 规则 | 引擎读法 | 依据 | 置信度 |
|---|---|---|---|
| 每次附加按当前层数结算一次（不是按上限，不是周期跳伤） | `tickOnApply`，按附加后的层数查 `table` | ww.json `anomalies.chafe`（GE tickOnApply）+ 绯雪文本「被附加在目标上时，会按照目标当前【霜冻效应】上限层数结算一次」 | 霜渐 high；霜冻「上限层数」见下 medium |
| 霜冻（绯雪 霜渐 变体）按**当前上限层数**结算 | 绯雪/穗穗队中 `detonateAnomaly('chafe',{stacks:'cap'})`；上限默认 10 | 1108 游戏文本（原文「上限层数」） | medium（社区未见独立实测） |
| 层数叠加/衰减 | 持续 15 s，附加刷新；满层（溢出）冻结并清空（`clearOnOverflow`）；冻结时长 `freezeTable` 1–10 层 4 s，11/12/13 层 4.5/5/5.5 s；冻结期间仍可附加（1108 文本） | ww.json GE + freezeTable | high |
| 穗穗 康衢之谣 上限 +3 | 附加或造成霜渐时把上限 +3、持续 15 s；**不叠加**，重复触发只刷新（来源键 `suisui:chafe` 替换） | 1110 文本「该效果无法叠加」 | high（修复前错误叠到 16 层） |
| 13 层上限的作用 | 霜冻按 13 层倍率表结算（407.53% vs 10 层 203.77%）+ 冻结 5.5 s | anomalies.chafe.table / freezeTable | high |
| 雪锈 2 层额外段 | 平 102% 异常倍率（链3 再 +488%），**不按层数表放大** | 1108 文本「额外附加一段102%异常倍率的【霜冻效应】伤害」 | high（修复前误为层表×1.02） |
| 雪锈 1/3 层、洛瑟菈 霜渐加深 | 霜冻加深 +30%×2；洛瑟菈 +60%/+80%（胶卷 每 0.5 s 附加 2 次） | 1108/1109 文本 | high |
| 霜结 | 见心/居合 命中 ≥10 层目标消耗 10 层进入霜结状态；**不造成伤害**，白玉切 移除 | 1108 文本 | high |
- 核心：`raiseAnomalyCap(type,n,until,src)` 同来源替换；`detonateAnomaly(...,{addMult})`；`scale:0` 现在真正为 0（旧代码 `o.scale||1` 把 0 当 1 → 漂泊者·气动 1406/1408 的 `scale:0` 转化原先误产生伤害，已修正）。
- 结果：绯雪/洛瑟菈/穗穗 30 s 872,640 → 634,519（清宵队 621,789 的 1.40× → 1.02×；40 s 806,948 vs 628,022 = 1.28×）。社区 arabwuwa 101,029 vs 93,893 = 1.076×（https://arabwuwa.com/teams/hiyuki-lucilla-suisui-152/ ，轴 https://arabwuwa.com/rotations/hiyuki-lucilla-and-suisui-rotation-114/ ）。洛瑟菈占比 5%，社区 12.7–15%，偏低（audit WARN）。

**奥古斯塔 赫日威临（tsVerified，medium）**
- 游戏文本 1306「进入7秒的俯首之刻，俯首之刻持续期间时间暂时停止」；wutheringlab.com/character/augusta-build/、wuwalabo.com/en/characters/augusta-guide/ 称倒计时/计时器停止；arabwuwa augusta-iuno-shorekeeper-35 整套 11.58 s 只有在扣除俯首之刻时才对得上 → 帧条目加 `tsVerified`（503f time_stop 从战斗时间扣除）。
- 副作用：team_augusta 25 s 420,089 → 567,878；40 s 基准尤诺队 1,108,644（尤诺/清宵 1.765，社区 0.758；40 s 内放 2 次，第 2 次在 39.9 s 起手也全额计入）。基准排名受此口径影响，`timeStopScope`/`timeStop:'include'` 可对照。

**安可 黑咩（search hold）**
- 公开轴（Prydwen/Game8）黑咩大暴走内失序满即放 黑咩·暴走之炎（774%，重击出手 0.93 s 后可切人）。原搜索从不放黑咩（宁可继续 f1–f4），模块加 `hold`：狂热内失序满 100 时不放 f/fh/fe。`finishers` 恢复 ['white','black','lib']，audit PASS。
- 使用次数（white/black/lib）：单人 30 s 冷 0/1/1、稳态 1/1/1；队伍 25/30/40 s 冷启动 均 black 1；40 s 单人稳态 0/0/1（未进狂热满失序）。安可队 30 s 455,218 → 438,692。

**尾段时停（MECH.tailFreeze，heuristic，只标记）**
- 定义：被扣除时停的动作（timeStopSaved>0），若按完整动画会越过窗口末尾，记为尾段时停；红利 = Σ 伤害 × (1 − (D−t)/完整时长)，占总伤百分比 = `summary.tailFreezePct`。游戏中计时冻结期间命中照常结算，所以不改伤害，只出 warning `ts-window-edge` 与页面标签。现有 endCredit=prorate 已按“非冻结剩余时长”截断（赫日威临 非冻结部分仅 0.05 s）。
- 现状：页面预设全部 0%；40 s 基准尤诺队 12.3%。

## 社区来源
- https://wutheringwaves.fandom.com/wiki/Damage
- https://wutheringwaves.fandom.com/wiki/DMG_Deepen
- https://www.reddit.com/r/WutheringWaves/comments/1q2jtcw/how_good_is_def_ignore_res_reduction_dmg_formula/
- https://forum.gamer.com.tw/Co.php?bsn=74934&sn=32003（巴哈姆特：防御区与负抗）
- https://www.9game.cn/mingchao/10708299.html 、 https://www.gamersky.com/handbook/202406/1769273.shtml（乘区测试）
- encore.moe API（数值显示核对，缓存在 `cache/encore/3.7.8/`）
- wuwa-calc-site `negativeStatus.ts` / CombatCalculator（异常效应表与乘区交叉核对）
- https://wutheringwaves.fandom.com/wiki/Stamina（耐力回复与延迟）
- https://arabwuwa.com/teams/hiyuki-lucilla-suisui-152/ 、https://arabwuwa.com/teams/augusta-iuno-shorekeeper-35/
- https://wutheringlab.com/character/augusta-build/ 、https://wuwalabo.com/en/characters/augusta-guide/
- https://game8.co/games/Wuthering-Waves/archives/585681（达妮娅队）、https://thegameslayer.com/guides/wuthering-waves-the-best-teams-for-jingran/（露帕/今然队）
