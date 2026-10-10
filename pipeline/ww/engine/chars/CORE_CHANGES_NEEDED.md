# 需要改动核心引擎的地方（ww_engine.js / cli.js / 页面）

> **状态（2026-10-09，ww-engine-0.2）：下列 1–9 已在核心实现，模块中的变通写法已移除。** 细节见 `../../MECHANICS.md` §6–8。
> 1. 异常效应层：`ww.json.anomalies` + 引擎 `addAnomaly/detonateAnomaly/advanceAnomalies`，作为一等伤害来源（timeline/share/breakdown/status lanes），CLI 探针 `probe.anomaly`。卡提希娅/菲比/爱弥斯/心 已迁移。
> 2. `forced` / `forceReason` 写入延奏动作与 outro 事件；心用 `ev.forced && ev.reason==='tongzou'`。
> 3. 目标 `'others'`（除自身以外）；菲比/卡提希娅延奏改由解析器 + 模块 patch 处理。
> 4. 解析器：剔除招式名后再匹配属性词（空中攻击/星星花绽放）、「受到【X效应】伤害」、目标异常条件 `targetAnomaly`、武器第二句条件、`普攻·<形态>第N段`。
> 5. 通用 kit：形态段落识别；模块提供 A 时不再警告；frames 只对实际用到的 key 警告。
> 6. `build_ww.py link_outro`：延奏伤害行关联到 type 11（9 条，2 条按描述倍率为 low）。珂莱塔/菲比/心 的 O 改用技能 11 命中。
> 7. `defIgnore:<dmgType>` / `resPen:<el>:<dmgType>` / `resPen:all:<dmgType>`。
> 8. 耐力：上限 240、25/秒、1.5 s 延迟、全队共用；重击消耗按标签匹配技能参数。
> 9. 页面打包顺序 ww_engine → _common → 模块（build_page.py 已如此）；第五批组件已渲染。


本批模块（珂莱塔 1107、菲比 1506、维里奈 1503、卡提希娅 1409、爱弥斯 1210、心 1311）没有改动 `ww_engine.js` 和 `cli.js`。下面列出的问题目前都在模块内用变通方式处理，模块里的变通处都有注释和 `notes` 标记。按影响从大到小排列。

## 1. 异常效应层（风蚀 / 光噪 / 聚爆 / 电磁）：最大缺口
- 现状：引擎没有目标状态层，也不计算异常效应伤害。各模块只在自己的 `cs` 里记录“自己附加的层数”，用来判断条件增益。
  - 卡提希娅：固有伤害提升、武器加深、看潮按层加深。
  - 菲比：星辉 ×(1+2.56)、和光回唱。
  - 爱弥斯：武器窗口、星与星之间。
- 影响：卡提希娅（风蚀 DoT）、菲比告解、爱弥斯聚爆引爆、心电磁模态的总伤都明显偏低，而且偏低的程度不一样。卡提希娅的自动搜索因此不进入芙露德莉斯形态，因为不计风蚀伤害时它比基础形态弱。
- 需要：
  1. 增加目标级 `anomaly[type] = {stacks, cap, until, owner}`。
     - 规则：附加时刷新共享计时，到时全部移除。风蚀 15 秒，见 Game8 *Aero Erosion Explained*。
     - 由 `api.addAnomaly(type, n, {cap})` 写入，供所有模块读取。这样也能解决“队友维持光噪”的问题，目前要靠 `module.frazzle='external'` 手工指定。
  2. 结算伤害。等级基础值来自原始 `BinData/AbnormalDamage/abnormaldamageconfig.json`，例如 Lv90 为 3674。
     - 每层倍率和触发间隔还没有找到。风蚀约每 2 秒一跳（Game8）。
     - 加深类效果需要新的区：`deep:anomaly:<type>`。涉及：神权之意 +50%、默祷 +100%、和光回唱 +30%、玉阙玄华对电磁 +30%。
  3. 事件 `{type:'anomaly', mi, kind, stacks}`，供“附加 X 效应时”类增益触发。涉及：声骸套 16/17/27/28/36/37、珂莱塔链 4、卡提希娅链 4、爱弥斯固有、心固有。

## 2. 延奏事件缺少 `forced` 标记
- `applySwap` 的第 1150 行把 `n.action.forced = ...` 写进了注释（`// ... n.action.forced = !!so.force && !full;`），所以实际没有赋值；`dispatch(..., {type:'outro'})` 里也没有这个字段。
- 心的“响应同奏”目前用变通方式判断：延奏后离场角色的协奏能量仍大于 0，就视为同奏强制延奏。如果协奏原本就是 0，这个判断会失效。
- 需要：
  - 把 1150 行的赋值移出注释。
  - 在 outro 事件里带上 `forced`，以及原因 `reason:'tongzou'`（由 swapOut 返回）。

## 3. “队伍中除自己以外”的增益目标
- 文本解析器把以下延奏都解析成了 `target:'self'`：
  - 心「除心之外」、爱弥斯「除爱弥斯以外」、卡提希娅「除卡提希娅、芙露德莉斯以外」。
  - 菲比默祷「队伍中登场角色」也受影响。
- 模块目前设成 `mode:'module'`，在 `onOutro` 里对每个队员 `fireBuff`。
- 需要：
  - 增益目标增加 `'others'`。
  - parser 识别「除…以外/之外」。

## 4. 文本解析误匹配
- `'空中攻击'` 被 STATLEX 的 `'攻击'` 匹配。
  - 维里奈链 6「重击星星花绽放及空中攻击星星花绽放的伤害提升20%」被解析成全队常驻攻击 +20%，模块已关闭。
  - 建议在匹配属性词前先剔除「空中攻击 / 普攻 / 重击」等招式名。
- “施放重击时”被解析成 `cast H`，导致任何重击都会触发。维里奈固有、链 4 已在模块中改为只由星星花绽放触发。
- 武器条件句只解析了第一句，或者漏掉了条件：
  - 不屈命定之冠：缺 8% 无视防御，风蚀条件也丢失。
  - 永远的启明星：第二句整句丢失。
  - 和光回唱：只解析出“重击”，漏了“普攻”。
  - 玉阙玄华：`deep:skill` 改为由模块判定。
  - 以上都已由模块接管。
- 菲比 `o0_1`「光噪效应伤害加深100%」被解析成 `deep:all 1.0`，作用于 self，已关闭。
- 需要：parser 识别「对附加了【X效应】的目标」「目标拥有【X效应】时」这类条件，并标成 `manual` 或 `anomaly` 触发。

## 5. 通用 kit 的段落识别
- `STAGE_RE` / `NOT_STAGE_RE` 处理不了以下标签：
  - 心「普攻·应世相第一段伤害」：含 `·`，被排除。
  - 爱弥斯「普攻·爱弥斯第一段伤害」：同样含 `·`。
  - 珂莱塔把普攻和「必要性手段」的段落混在一起。
- 心和爱弥斯因此会出现警告「未识别普攻段落，A 动作不可用」，模块已经自建了全部段落动作。
- 需要：
  - 模块提供了按键解析（resolve 'A'）时，不再发这条警告。
  - 识别 `普攻·<形态名>第N段`。
- 类似地，爱弥斯的通用 E 会在 action_frames 中命中 null 条目「Skill: Form Switch (Mech)」并发出警告。模块提供了 E 时应跳过通用 E 的帧查询。

## 6. 延奏伤害行没有关联
- 菲比、珂莱塔、心的延奏伤害只出现在 `skill.unlinkedDamage` 里（只有 `rate`，没有 `multiplier`），由模块用 `_common.rowHit` 对应：
  - 珂莱塔：110708501 = 794.2%，和描述一致。
  - 菲比：1506201011，rate 2.345；描述总计 528.41%，与行值对不上，倍率取描述值，低置信。
  - 心：1311291301，rate 0.5；描述 100%，倍率取描述值，低置信。
- 需要：`build_ww` 把 outro 类型的 damage 行关联到延奏技能（type 11）。

## 7. 按伤害类型生效的穿透 / 无视防御
- 永远的启明星「共鸣解放伤害无视…」、玉阙玄华「共鸣技能伤害无视…」、心链 6「共鸣技能伤害无视防御」都只对某一类伤害生效。
- 目前由模块在 `actionStats` 里按动作 key 判断。一个动作里如果混有不同类型的 hit，会被一并计入；本批模块里没有遇到这种情况。
- 需要：支持 `resPen:<el>:<dmgType>`、`defIgnore:<dmgType>` 这类按伤害类型细分的 key。

## 8. 耐力
- 引擎没有耐力模型。数据里有 `重击耐力消耗`，原始 `BinData/property/baseproperty.json` 里有 `StrengthMax=14000`、`StrengthRecover=250`，单位未确认。
- 后果：重击帧较短的角色在单人搜索里会连续重击：
  - 心：应世相重击 0.73 s，6 段。
  - 维里奈：重击 0.8 s。
- 菲比在不挂光噪时也会偏向重击。
- 这些角色在队伍搜索里正常，测试只对队伍场景检查“不是单一动作刷屏”。
- 需要：在成员状态里加入耐力，由按键扣除，并按时间回复，常量要先确认。

## 9. 页面（给页面 worker）
- 浏览器需要按顺序加载 `chars/_common.js`，再加载新增的 6 个模块：
  - `1107_carlotta.js`、`1210_aemeath.js`、`1311_hsin.js`、`1409_cartethyia.js`、`1503_verina.js`、`1506_phoebe.js`
- `_common.js` 新增了导出 `rowHit`、`perSecond`，原有导出不变。
- 示例配置放在 `engine/chars/examples/`（遵守只改 chars/ 的约束）。如果需要放进 `engine/examples/`，直接移动即可，测试中的路径要相应修改。

# worker-B（全 64 角色范围，我负责的 27 个 id）

## B1. 时停（time_stop）未建模 → 全程时停的解放被搜索放弃
- 弗洛洛「往日深渊的圆舞曲」：action_frames 4s，time_stop [0,240] = 全程时停，本身无伤害。按 4s 计时，搜索在 25/30/40s 窗口都不放 R（审计 FAIL 的根因）。
- 工作区（1608_phrolova.js，已标注）：该动作 key 改为 `waltz`，按 `opts.waltzDur`（默认 0.25s）计入时间。
- 同类：忌炎「后动」（WuWaSim freezeTime 2.93s）、椿/夏空/洛可可的解放也含长时停，搜索偏向不放或推迟。
- 需要：resolveAct 时把 time_stop 帧从“战斗时间”中扣除（或把 buff/冷却/异常计时在时停帧内暂停），统一口径后可去掉弗洛洛的工作区。
- **完成（stream A，16:30 SGT 起默认 exclude）**：原为可选 `config.timeStop: "exclude"`，时停帧不再消耗战斗时间（时长取帧数据时，duration 减去 timeStop，cancel/noSwap 夹到新时长内）。开启后，19 个队伍预设中有 18 个的辅助会放 R。**16:28 起默认 exclude**（团队决定）。
- **确认（stream A，16:5x）**：整段时停的动作计 0.05 s 是期望口径；伤害照常结算，动作结束时触发的增益在时停结束后按自身时长持续（test/timestop.test.js）。所有整段时停动作都有冷却/能量/资源门控（清宵 tj≤心剑次数、弗洛洛 圆舞曲≤定音次数、守岸人 洞悉≤每星域 1 次，均有测试），没有加实时下限。新增 `result.timeStopSaved` 与页面时停标签/开关。见 MECHANICS.md §10。

## B2. 模块 key 与通用 key 同名时继承通用帧
- 例：夏空 `R` 继承「Improvised Symphonic Poem」37.33s（整个演绎状态，不是施放时长）；千咲 `n1/n2` 的帧为 null 时回落到默认时长而不是模块 dur。
- 工作区：模块改用不同 key（`lib`、`n1..n4`、`hc`、`waltz`）。
- 需要：模块 `frames` 里显式写 `KEY: null` 时表示“不用帧数据、用模块 dur”；帧条目为 null 时优先用模块 dur（标“模块估计”），而不是默认时长。
- **完成（stream A）**：模块 `frames` 中写 `KEY: null` 表示该动作不取帧数据，直接用模块 dur，durReason 会注明。帧条目为 null 时本来就先回落到模块 dur（`defDur`），再回落到默认时长；千咲 n1/n2 的情况请确认 H.act 是否传了 `dur`。

## B3. 声骸套 12 幽夜隐匿之帷：解析错误
- 5 件「湮灭属性伤害加成提升15%」被解析成 `dmg:allElement`（对受击的反向加成），480% 湮灭延奏伤害未建模。需要修正解析器并补延奏伤害行。
- **完成（stream A）**：5 件湮灭加成解析为 `dmg:havoc`；480% 湮灭延奏伤害作为额外延奏行（`mem.veilAct`，sideDamage，计延奏伤害）。

## B4. 偏移状态（集谐·偏移 / 震谐·偏移 / 骇破·偏移）
- 清宵（云琅）、露西/陆·赫斯（蜃影/碎骨）、尤诺、西格莉卡、仇远等的机制依赖“偏谐值/偏移”状态；引擎没有该状态层。批次 2/3 的模块会用模块计数器近似（已标注）。需要：引擎增加 tune 状态（附加、持续、触发事件 `tuneShift`）。
- **保持“未建模”（lead 16:41 决定）**：MECH.tune = unsolved。核心只加了最小钩子：`api.applyTune(kind, state, dur)` / `api.tune(kind)` / `api.clearTune(kind)`，触发类型 `tune`（自己）与 `tuneTeam`（全队），onTeam 事件 `{type:'tune'}`；谐度/偏移的数值规则不建模。露西的骇破·偏移已改用钩子。

## B5. 异常层数上限加成
- 千咲延奏「拖曳终焉之弦：使目标【异常效应】层数上限增加3层」。工作区：1508_chisa.js 在延奏后 15 秒内的 `anomaly` 事件里直接改 `s.an[type].cap += 3`（已标注）。
- 需要：`api.raiseAnomalyCap(type, n, until)`，到期回落；与卡提希娅的 erosionCap 合并取值。
- **完成（stream A）**：新增 `api.raiseAnomalyCap(type, n, until)`，可叠加多个临时上限。实际上限 = max(表上限, 模块传入的 cap，例如卡提希娅 erosionCap) + 未到期的加成之和；到期后回落，层数夹到新上限。千咲可以去掉直接改 `cap` 的工作区。

## B6. 微光（光噪不衰减）的定时结束
- 漂泊者·衍射「微光 9 秒：光噪层数不因原本的减少效果而减少」。`addAnomaly({noDecay:true})` 没有到期时间；工作区：模块 9 秒后直接把 `s.an.frazzle.noDecay=false`。需要：`noDecayUntil`。
- **完成（stream A）**：`addAnomaly(type, n, { noDecayUntil: t })`。另外修了一个问题：以前 `noDecay` 对“到期减 1 层”的异常（光噪）不生效，现在生效。漂泊者·衍射的数值可能因此变化，请改用 noDecayUntil 后复核。

## B7. 审计工具（validation/tools/module_audit.js，lead）
- 虚湮（bane）只减防、不造成伤害，`anomaly` 检查对只施加 bane 的角色（千咲、秧秧·玄翎）必然 FAIL「异常伤害占比 0%」。建议：bane 施加者改看“虚湮层数/在场时间”，或把 bane 的减防收益折算。
- 洛可可当前数据（1606）没有虚湮机制（技能描述无「虚湮」），审计说明里“洛可可 havoc bane”应为误记。
- lead 负责，stream A 未改动。
- （批次 2 补充）**条件施加者**：漂泊者·气动 1406 只通过「碧霄断行」把其它异常（光噪/虚湮/聚爆/霜渐/电磁）转成风蚀，公开配队（卡提希娅+夏空+气漂）里没有可转化的异常 → 本人异常占比 0 属实，但源码含 `addAnomaly('erosion'` 被判施加者 → FAIL。建议：audit 元数据支持 `anomalyConditional: true`（只 WARN）。
- （批次 2 补充）一个文件注册两个 id 时（1406/1408、1501/1502、1604/1605）`modFiles` 只认文件名首个数字，另一个 id 读源码时 path 为 undefined → `[errors] The "path" argument must be of type string`。工作区：新增无代码的别名文件 `1408_alias_of_1406.js`、`1502_alias_of_1501.js`、`1605_alias_of_1604.js`（只含注释）。建议工具改为按 `registerChar` 的 id 反查文件（例如在 chars/index.js 记录 require 时新注册的 id）。

## B8. 浏览器加载
- 新增 `chars/0_wb_lib.js`（worker-B 辅助库，全局 `WWKitB`，不注册角色），文件名以数字开头会被 build_page.py / index.js 按排序先于角色模块加载；页面需要它在 `_common.js` 之后、任何 `1xxx_*.js` 之前加载。
- `1501_rover_spectro.js` 一个文件注册 1501 和 1502（同一套技能）；1406/1408、1604/1605 同理。
- **完成（已满足）**：build_page.py / index.js 按文件名排序加载，`0_wb_lib.js` 排在 `_common.js` 之后、所有 `1xxx_*.js` 之前（dist 模块列表首项为 0）。一个文件注册多个 id 也已支持。

## B9. 队友事件：护盾获得 / 施放声骸技能（批次 2）
- 尤诺 满月领域：「处于领域中的登场角色获得护盾时，可获得一层苍白死光的祝颂」。`api.shield()` 只触发该成员自己的「获得护盾时」增益，不派发 onTeam 事件。工作区：1410_iuno.js 在 onTeam `damage` 事件里把奥古斯塔（1306，固有「造成伤害时获得护盾」）当作护盾来源（`opts.fieldShieldIds` 可加），每 0.5 秒 +1 层。需要：`api.shield` 派发 `{type:'shield', mi, t}` 事件。
- 西格莉卡 语义共鸣/日灵能量：「队伍中的角色施放声骸技能时…同名声骸仅可触发一次」；仇远的答剑「视为施放声骸技能」。工作区：模块动作 `extra: { echoCast: true }`，西格莉卡在 onTeam `damage` 事件里识别 `act.cls === 'Q' || act.echoCast`，同名 = 同一队员同一动作 key。需要：引擎统一的 `echoCast` 事件（含声骸名），并让「施放声骸技能时」类增益（例如 昭日译注、裁竹 解竹）也响应模块动作。
- 仇远 专武 裁竹「施放变奏技能或普攻后10秒内，施放声骸技能时，获得1层【解竹】」解析为 cast Q/A 触发；模块改为 manual，由本模块 echoCast 动作 fireBuff。

- **完成（stream A）**：`api.shield` 派发 `{type:'shield', mi:受盾者, by:给予者, n, t, t1}`；施放声骸技能（cls Q）与带 `echoCast` 的模块动作（含 sideDamage）派发 `{type:'echoCast', mi, key, echo, t, tEnd}`，`echo` 为同名判定用的名字。尤诺/西格莉卡的 damage 事件近似可以改用这两个事件（模块未改，worker-B 已结束，留作后续）。

## B10. 已完成核心接口的接入（批次 2）
- B5 `raiseAnomalyCap`：千咲（延奏 15 秒内队伍附加的异常 +3）与 漂泊者·气动（蚀境象 风蚀 +3，10 秒不可叠加）已改用，去掉直接改 `s.an[type].cap` 的工作区。
- B6 `noDecayUntil`：漂泊者·衍射 微光已改用。


## B11. 批次 3（worker-B）
- **B1 跟进**：核心默认 `timeStop: "exclude"` 后，弗洛洛「往日深渊的圆舞曲」已改回取帧数据（4s 全程时停 → 计 0.05s），`opts.waltzDur` 只在没有帧数据时兜底。清宵「共鸣解放 Billows Beneath Heaven」（5s，时停 5s）与「天极·无相（Ephemeral Transcendence）」（3s，时停 3s）同样按 0.05s 计入战斗时间：是核心口径，模块不改。请确认「整段时停的动作计 0.05s」是期望结果（伤害照常结算，期间增益/冷却冻结）。
- **WuWaSim 条目 duration_s 为 null**（源作者注明 sequenceLength 不是时长）：秋水 瞄准完全蓄力 / 技能长按 / 迷雾潜行，鉴心 共鸣解放两条 → 模块估计（低，已在模块注释标注）。若加载器以后从 markers 推出可用时长，模块不需要改。
- **声骸套 32 碎梦亡鬼之魇（1 件套）解析不全**：原文「普攻伤害加成和重击伤害加成提升35%」只解析出 `dmg:basic`，且触发（附加骇破·偏移）未建模。工作区（1511_lucy.js，已标注）：patchBuff 补 `dmg:heavy 0.35`，改 manual，由有效载荷/死锁/多线程触发。需要：sonata 解析补全「A和B伤害加成」并列；偏移附加作为事件（同 B4）。
- **露西 固有「网络后门」**解析成常驻 `deep:all 10%`（原文需要击败怒涛级以上目标）→ 模块关闭。建议解析器把「击败…时获得」的效果默认关闭。
- **完成（stream A）**：sonata 解析补全「A和B伤害加成」并列（套装 32 现在给 basic+heavy 35%）；「击败/击杀」条件的效果默认关闭（trigger manual，可手动开启）。1511_lucy.js 的套装 32 / 专武 / 网络后门补丁已删除，骇破·偏移改用 B4 钩子。

## B12. 搜索：不会为强化解放保留能量 / 辅助在公开配队中上场太少（批次 3）
- 露西：暗网深潜（多线程后 8 秒内放 R，1789%）只在“开场能量不满”时被搜索选用（开场 60 能量：25s 29.3 万；满能量：开场直接放网络行者 25.6 万）。束搜索在开场看到 R 可用就放，不会持有能量等待更高价值版本。模块未做工作区（只在 audit.note 说明，finishers 改为 mt/nr）。建议：搜索对“同一按钮、状态相关的强化版本”给残值（例如 potential 中计入持有能量的期望），或支持模块声明 `holdFor: { btn: 'R', until: (cs) => cs.deep }`。
- 秧秧/秋水（忌炎队）、鉴心（丹瑾队）：搜索几乎不让辅助上场放 R，审计 WARN「队伍中也不放 R」。与批次 2 的尤诺/琳奈同类（B7 已记）。
- **完成（stream A，16:58 SGT）**：
  - (a) 模块钩子 `hold(api, act, remaining)`（只影响搜索；`search.hold:false` 关闭）。露西：暗网深潜可达时不放网络行者（单人 25.6→31.2 万，队伍 49.1→59.3 万，search 现在用 dd）；丹瑾：120 彤华可达时不放 60 彤华缭乱（单人 18.0→21.6 万，队伍 22.6→25.3 万，lrF 出现）。
  - (b) 辅助轮转：非 dps 模块角色在场且 R 可放时不允许切出（`search.supportCycle:false` 关闭）；同时跑无约束搜索，结果满足约束时也参与排名。所有公开配队的辅助都放 R（秋水/秧秧/吟霖/维里奈原 0 次）。代价见 MECHANICS.md §11。测试：test/b12.test.js。


## B13. 导电批次（worker-B，2026-10-09 17:xx SGT）：1301/1303/1305/1307/1308/1309/1310/1312/1504
- **心 1311 的 UNISON 列表应含锁暝 1312**（`1311_hsin.js` 第 49 行 `[1304, 1311]`）。现绕行：示例 team_suoming.json 用 `module.unisonIds:[1312]`（flag：模块内注释 WORKAROUND-B13）。
- **同奏增益跨提供者上限**：锁暝 tzzy（全伤加深 3%）与心/今汐的同奏增益是否叠加未定义；现按「每个提供者独立、各自 cap 1」处理（低置信）。
- **点按/长按区分**：漂泊者·导电 超载（E 长按 os 需协奏 ≥60 / H 点按 osT）、渊武 掀雷 需要按键时长区分；现用「满资源时 E=长按、H=点按」映射，掀雷未建模。
- **周期 tick 钩子**：卜灵 五雷荡煞阵（每 2s）只在队伍 damage 事件时补 tick（空窗期会漏 tick）；丽贝卡炮台同理。请求 `api.every(dt, fn, until)` 或 `onTick`。
- **丽贝卡 重机枪射速/骇破响应**：hmg 20 发按 5.0s 估计（帧源为 null），applyTune('hack') 的骇破结算依赖 B4 钩子（仍未建模）。
- **锁暝 帧**：仅 Riley 来源（置信低）；**漂泊者·导电 超载（长按）帧在所有来源中为 null**，用模块估计。
- **审计**：卜灵 公开配队若由折枝开轴，搜索从不让卜灵上场（FAIL「从未上场」）；示例改为卜灵开轴（startMember 2），与 B12 同类问题。

## A14. 时停改为 WuWaSim toa 口径（stream A，2026-10-09 17:2x SGT，lead 基准 TEAM_BENCHMARK.md）
- 默认只扣耗能 R（cls R 且 cost>0）的时停；其余时停按完整动画，除非帧条目/模块动作带 `tsVerified`（来源字符串）。随附帧数据没有 tsVerified。
- 组合帧（标签数组）时停取最大值，只扣一次。
- `config.timeStopScope:'all'` 复现旧口径（只作对照）。时间轴 `tsBasis`；页面 freeze 标题区分。
- 模块影响（模块无需修改）：弗洛洛 圆舞曲、珂莱塔 zhisi、赞妮 zj、爱弥斯 fin/gyM/gyP、卡提希娅 看潮、心 zx/zhenhy/wqlh、清宵 tj、守岸人 洞悉、今汐 惊龙破空、露西 dl、奥古斯塔 赫日威临 现在都按完整时长计时。若某条有实测来源（例如 arabwuwa 奥古斯塔整套 11.58 s），在 action_frames 条目上加 `"tsVerified": "<来源>"`。
- 1608 模块只改了注释（圆舞曲仍取帧数据，按完整 4 s）。

### B13 处理结果（stream A，2026-10-09 17:3x SGT）
- **完成**：心 1311 UNISON = [1304, 1311, 1312]；team_suoming.json 的 `unisonIds:[1312]` 已删，1312 注释中的 WORKAROUND-B13 已改为“已解决”。
- **完成**：同奏增益跨提供者共享上限 `_common.tzzyRoom(api, j, own)`：每个目标合计 ≤ 2，心在队 +1（信步拾清欢），心 S6 再 +1；心/锁暝施加前都检查（test/b13.test.js）。
- **完成**：周期钩子 `api.every(key, period, until, first)` / `api.cancelEvery(key)` → 模块 `tick(api, key, t)`；计时器存在 `cs._every`，随状态复制，在所有时间推进点（advanceAnomalies）结算，空窗期也会跳。卜灵 五雷荡煞阵已改用（删除 damage 事件补跳）。丽贝卡炮台未建模，可直接用这个钩子。
- **未做（需要新按钮语义）**：点按/长按区分。建议做法：手动序列 token `E~` / `H~` = 长按，resolveButton 传 `hold:true`，搜索把 hold 当成独立按钮；涉及页面按钮与搜索分支，没有在本轮改动。
- **证据不足，未改数值**：丽贝卡 31型重机枪射速。公开资料（arabwuwa / Prydwen / wuwabuild）只给出“最长 9.5 s、两次强化、20 发达到 90 过载自动大烟花”；arabwuwa 实测后续轮整套约 7.9 s（含变奏/普攻/技能/重击/解放）。按这个推算，机枪段 ToA 只有约 3 s，比现在的 5.0 s 估计短，但没有逐段帧数据，保持 5.0 s（低）。

## A15（stream A，2026-10-09 18:xx SGT，已完成）
- `raiseAnomalyCap(type, n, until, src)`：同来源替换不叠加（api 默认 src='m'+mi）；穗穗 用 'suisui:<kind>' 每次附加刷新。
- `detonateAnomaly(type, {addMult})`：平倍率附加（雪锈 102%/+488%）；`anomalyHit` 的 `scale:0` 不再被当作 1（影响 1406/1408 `scale:0` 转化，旧行为误伤害）。
- 奥古斯塔 赫日威临 帧条目 `tsVerified`（见 MECHANICS §12）。
- 安可 `hold`：狂热内失序满 100 时禁 f/fh/fe（search only）。
