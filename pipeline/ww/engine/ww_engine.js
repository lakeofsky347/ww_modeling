/*
 * Wuthering Waves (鸣潮) damage / rotation engine — core (step 2a).
 * Plain JS, no build step, no DOM. Works in browser (window.WWEngine) and node (require).
 * Consumes out/ww.json (schema ww-1). Pure functions: every public function takes data/config and returns new objects.
 *
 * Architecture (mirrors the Endfield engine):
 *   indexData(ww)                          -> lookup maps
 *   buildContext(config, data)             -> ctx (resolved team: panels, kits, buff defs, enemy, options)
 *   initialState / actionsFor / applyAction (persistent states linked by .prev)
 *   runSequence(ctx, text)                 -> manual rotation
 *   runPolicy / beamSearch(ctx, budget)    -> auto rotation
 *   simulate(config, data)                 -> full result (detail replay of the chosen sequence)
 *   compareGear(config, data, variants)    -> ranked gear variants
 *   toView(result)                         -> container-shaped view model (frontend COMPONENTS.md)
 * Mechanism provenance for every formula lives in ONE table: MECH (flip 'community' -> 'table' once validated).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WWEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 'ww-engine-0.2';
  const EPS = 1e-9;

  // ------------------------------------------------------------------ mechanism table (single source of truth)
  // mech: 'table' = derived from game tables and cross-checked; 'corroborated' = community rule independently matched by two
  // reference calculators (validation/REPORT.md: wuwa-tools + wuwa-calc-site), not yet measured in game;
  // 'community' = community formula, references disagree or unchecked, needs in-game validation;
  // 'unsolved' = engine estimate/default, no reliable source. confidence mirrors MECHANICS.md.
  const MECH = {
    residual:   { mech: 'heuristic', confidence: 'low', basis: '残值引导（搜索启发式，不计入报告伤害）：窗口结束时仍生效的增益/状态按 剩余时长（上限 search.residualHorizon）× 持有者持续输出速率 × 增益相对收益（在场×1、后台×0.5）计价，另加模块 residual(api,D,H) 钩子（守岸人星域、维里奈…），仅用于搜索排序与最终选序。search.residual: auto（队伍默认开）/true/false，search.residualWeight 默认 0.5，residualHorizon 默认 min(窗口,15 s)' },
    steady:     { mech: 'heuristic', confidence: 'medium', basis: '稳态开局（start.steady）：冷启动跑一轮后，以上一轮结束状态（在场角色、能量、协奏、冷却、增益实例、异常效应、耐力、模块资源/计时）平移 −D 作为开局，重复 start.steadyLoops 轮（默认 2）后报告最后一轮；模块无 carry 钩子时只继承非派生资源、计时窗口重置' },
    base:       { mech: 'table', confidence: 'high', basis: '基础区：damage.RelatedProperty 选 ATK/HP/DEF，×倍率，+FormulaParam10/CureBaseValue 固定值；encore.moe 385/385 行一致' },
    multiplier: { mech: 'table', confidence: 'high', basis: '倍率：damage.RateLv[技能等级]/10000，与 skilldescription 显示串逐级匹配' },
    stats:      { mech: 'community', confidence: 'medium', basis: '面板：(角色白值+武器白值)×(1+攻击%)+固定攻击；白值曲线来自 rolepropertygrowth/weaponpropertygrowth（表），合成方式为社区通行' },
    bonus:      { mech: 'corroborated', confidence: 'medium', basis: '加成区：1+属性伤害加成+技能类型加成+通用加成，同区相加；两份参考计算器印证（REPORT C7）' },
    deepen:     { mech: 'corroborated', confidence: 'medium', basis: '加深区：攻击方加深同区相加 1+Σ加深；两份参考计算器印证（REPORT C5）' },
    deepenTarget: { mech: 'community', confidence: 'low', basis: '加深区（含目标受伤加深 enemy.damageTaken）：受击方易伤与攻击方加深是否同区未定。引擎（直伤与异常效应同一口径）按同区相加 1+加深+受伤；另一读法（wuwa-calc-site）为独立乘区 (1+加深)×(1+受伤)：直伤 REPORT C6 相加 1.25 vs 相乘 1.265，异常 REPORT §9.4-4 / N8 风蚀 3 层 +加深 50% +受伤 10% 差 −3.03%。未实测，保留相加' },
    crit:       { mech: 'table', confidence: 'high', basis: '暴击区：基础暴击 5% / 暴伤 150%（baseproperty.Crit/CritDamage）；期望=1+min(CR,1)×(CD−1)' },
    defense:    { mech: 'corroborated', confidence: 'medium', basis: '防御区：(800+8·Lv攻)/(800+8·Lv攻+DEF敌×(1−无视防御)×(1−减防))；敌防 792+8·Lv 由表推导；两份参考印证（REPORT C2/C3/C10）' },
    resistance: { mech: 'corroborated', confidence: 'medium', basis: '抗性区：有效抗性 = 基础 − 减抗 − 穿透；<0 → 1−res/2；0≤res<0.8 → 1−res；两份参考印证（REPORT C1/C3）' },
    resistanceHigh: { mech: 'community', confidence: 'low', basis: '抗性区（有效抗性≥80%）：1/(1+5res)（fandom/参考 A）；参考 B 无此分段按 1−res（REPORT C4 差 82%），待实测' },
    dmgReduce:  { mech: 'unsolved', confidence: 'low', basis: '减伤区：目标 DamageReduce* 字段存在，乘区形式 (1−Σ) 未证实；默认 0' },
    energy:     { mech: 'table', confidence: 'high', basis: '共鸣能量：damage.Energy/100 × 共鸣效率；解放消耗 = EnergyMax/100（62/62 与描述一致）' },
    concerto:   { mech: 'community', confidence: 'medium', basis: '协奏能量：命中行 ElementPower/100；命中行为 0 时退回技能描述“回复协奏能量”（结算时机未证实）' },
    swap:       { mech: 'community', confidence: 'medium', basis: '切人：协奏满 100 → 离场者延奏 + 入场者变奏，协奏清零；切人冷却未在表中定位' },
    durations:  { mech: 'unsolved', confidence: 'low', basis: '动作时长：表中无动作时长；有 action_frames.json（社区测帧 WuwaLAB，按 60fps 换算）时取其 duration_s（仍标 est，dur=frames），否则用可调默认值（dur=default）；延奏按 0 s；声骸技能用默认值' },
    swapTiming: { mech: 'unsolved', confidence: 'low', basis: '切人就绪：max(no_swap, earliest_cancel)，无取消点时取完整时长（引擎假设，config.swapRule 可改 full/swapTime）' },
    buffText:   { mech: 'community', confidence: 'low', basis: '增益：由武器/套装/共鸣链/固有/延奏描述文本解析，触发条件为关键词推断' },
    buffTable:  { mech: 'table', confidence: 'high', basis: '增益：表内 AddProp / 技能树 Property，数值精确' },
    echoCd:     { mech: 'table', confidence: 'high', basis: '声骸技能冷却：phantomskill.SkillCD；仅首位声骸可主动施放（游戏文本）' },
    sonataCount:{ mech: 'community', confidence: 'medium', basis: '套装件数：同名声骸只计一次（游戏规则说明，社区确认）' },
    anomalyBase: { mech: 'table', confidence: 'high', basis: '异常效应基础：AbnormalDamage/abnormaldamageconfig 等级值（附加者等级，Lv90=3674）× 每层倍率表（buff.ExtraEffectParameters “层#值”/10000）；wuwa-calc-site negativeStatus.ts 六种表逐项一致' },
    anomalyZones: { mech: 'community', confidence: 'low', basis: '异常效应乘区：不暴击、不吃攻击/属性/技能类型加成，只吃该效应专属加成/加深与目标侧效果（受伤加深、减抗、减防），防御按附加者等级；与 wuwa-calc-site CombatCalculator 一致（单一参考，未实测）' },
    anomalyTiming: { mech: 'community', confidence: 'low', basis: '异常效应时序：buff.json GE 字段（持续/周期/附加即生效/层数上限/溢出清空/到期移除层数）按 UE GAS 枚举解读（StackDurationRefreshPolicy 0=附加刷新、StackPeriodResetPolicy 1=不重置、StackExpirationRemoveNumber 0=全清/1=减一层）；解读为假设' },
    electroDecay: { mech: 'unsolved', confidence: 'low', basis: '电磁效应减半后的持续时间（两种读法，未实测）：A（引擎默认）15 秒持续时间自首次附加起算、减半不刷新 → 10 层 10→5→2 共 3 跳；B（wuwa-calc-site negativeStatus.ts）每次到期减半并刷新持续时间 → 10/5/2/1 共 4 跳（多 1 层一跳，约占总量 6.5%）。原始数据 StackDurationRefreshPolicy=0 只说明附加时刷新，减半是否续时无法判定（REPORT §9.4-2）。config.electroRefreshOnHalve=true 切换为 B' },
    endCredit:  { mech: 'unsolved', confidence: 'low', basis: '窗口末尾：时长结束时仍在进行的动作按窗口内时长比例计入伤害与能量（默认 prorate；无逐段命中时间表，按线性）。config.endCredit=\'full\' 恢复全额计入（会让搜索把长动画大招放在窗口末尾）' },
    tune:       { mech: 'unsolved', confidence: 'low', basis: '偏谐（谐度/偏移）机制未建模（stream B B4 保持“未建模”）；引擎只提供最小状态钩子：目标的 集谐/震谐/骇破 ·偏移/干涉 状态由模块按技能文本附加（api.applyTune，持续时间取自模块），触发「为敌人添加【X·偏移】时」类增益与 onTeam tune 事件；偏谐值累积、谐度破坏伤害本身未建模（模块近似）' },
    timeStop:   { mech: 'community', confidence: 'medium', basis: '时停（默认 config.timeStop="exclude"，WuWaSim toa 口径）：只有消耗能量的共鸣解放主镜头的时停帧（action_frames time_stop）不消耗战斗时间，期间增益/冷却/异常计时冻结（增益冻结与 Prydwen 2024 说法相反，待验证）→ 引擎把这段时停从动作战斗时长中扣除（伤害照常结算，切人/取消点夹在剩余时长内）；组合动作只扣一次（各段最大值）；其他时停（共鸣回路、谐振破坏、不耗能量的解放等）按完整时长计，除非帧条目/模块带 tsVerified（实测来源）。WuWaSim 条目的 freezeTime 与 stepDuration 的关系未明，不扣除。config.timeStop="include" = 旧口径（按完整动画时长推进所有计时）' },
    bane:       { mech: 'table', confidence: 'medium', basis: '虚湮效应：buff.json 10060000 每层减防 2%，上限 3 层（6%）；减防并入防御区 defReduce（与 wuwa-calc-site 一致，单一参考）；不造成伤害' },
    stamina:    { mech: 'community', confidence: 'medium', basis: '耐力：baseproperty.StrengthMax 14000/100=140（初始，表）+ 数据坞 +100 → 240（社区）；StrengthRecover 250（/100 每 0.1 s → 25/秒，与 fandom 一致）；停止消耗 1.5 s 后开始回复（fandom，社区）；重击消耗取技能描述「重击耐力消耗」，缺省 25；全队共用（社区）' },
  };
  const ANOMALY_ZH = { erosion: '风蚀效应', frazzle: '光噪效应', flare: '电磁效应', burst: '聚爆效应', chafe: '霜渐效应', bane: '虚湮效应' };
  const ANOMALY_SHORT = { erosion: '风蚀', frazzle: '光噪', flare: '电磁', burst: '聚爆', chafe: '霜渐', bane: '虚湮' };
  const ANOMALY_BY_ZH = Object.fromEntries(Object.entries(ANOMALY_SHORT).map(([k, v]) => [v, k]));
  const STAMINA_DEFAULT = { enabled: true, max: 240, regen: 25, delay: 1.5, heavyCost: 25 };

  const ELEMENTS = ['physical', 'glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc'];
  const ELEMENT_ZH = { physical: '物理', glacio: '冷凝', fusion: '热熔', electro: '导电', aero: '气动', spectro: '衍射', havoc: '湮灭' };
  const DMG_TYPES = ['basic', 'heavy', 'skill', 'liberation', 'intro', 'outro', 'echo', 'tuneRupture'];
  const DMG_TYPE_ZH = { basic: '普攻', heavy: '重击', skill: '共鸣技能', liberation: '共鸣解放', intro: '变奏技能', outro: '延奏技能', echo: '声骸技能', tuneRupture: '震谐·偏移' };
  const ACTION_ZH = { A: '普攻', H: '重击', E: '共鸣技能', R: '共鸣解放', Q: '声骸技能', I: '变奏', O: '延奏', S: '切人', W: '等待', X: '额外' };

  // default action durations (seconds) — MECH.durations (unsolved); override via config.durations / member.durations
  const DEFAULT_DURATIONS = { A: 0.55, H: 1.1, E: 1.0, R: 2.0, Q: 0.8, I: 1.2, O: 0, S: 0.25, X: 1.0 };
  const DEFAULT_SEARCH = { beamWidth: 96, maxExpansions: 120000, topN: 5, potentialWeight: 0.5, allowExtras: false };

  // ------------------------------------------------------------------ stat keys
  const KEYMAP = {
    'Atk%': 'atkPct', Atk: 'atkFlat', 'LifeMax%': 'hpPct', LifeMax: 'hpFlat', 'Def%': 'defPct', Def: 'defFlat',
    Crit: 'critRate', CritDamage: 'critDmg', EnergyEfficiency: 'energyRegen', HealChange: 'healBonus',
    DamageChange: 'dmg:all', DamageChangePhys: 'dmg:physical', DamageChangeAllElement: 'dmg:allElement',
    DamageChangeAuto: 'dmg:basic', DamageChangeCast: 'dmg:heavy', DamageChangeNormalSkill: 'dmg:skill',
    DamageChangeUltra: 'dmg:liberation', DamageChangeQTE: 'dmg:intro', DamageChangeOutro: 'dmg:outro', DamageChangePhantom: 'dmg:echo',
    IgnoreDefRate: 'defIgnore', IgnoreDamageResistancePhys: 'resPen:physical',
  };
  for (let i = 1; i <= 6; i++) {
    KEYMAP['DamageChangeElement' + i] = 'dmg:' + ELEMENTS[i];
    KEYMAP['IgnoreDamageResistanceElement' + i] = 'resPen:' + ELEMENTS[i];
  }
  // friendly aliases accepted in configs (echo mains/subs, manual buffs)
  const ALIASES = {
    critRate: 'Crit', critDmg: 'CritDamage', atkPct: 'Atk%', atk: 'Atk', atkFlat: 'Atk', hpPct: 'LifeMax%', hp: 'LifeMax', hpFlat: 'LifeMax',
    defPct: 'Def%', def: 'Def', defFlat: 'Def', energyRegen: 'EnergyEfficiency', healBonus: 'HealChange',
    basicDmg: 'DamageChangeAuto', heavyDmg: 'DamageChangeCast', skillDmg: 'DamageChangeNormalSkill', libDmg: 'DamageChangeUltra',
    liberationDmg: 'DamageChangeUltra', introDmg: 'DamageChangeQTE', echoDmg: 'DamageChangePhantom',
  };
  const PERCENT_PANEL = new Set(['atkPct', 'hpPct', 'defPct', 'critRate', 'critDmg', 'energyRegen', 'healBonus', 'defIgnore', 'defReduce']);

  function panelKey(key, ownerElement) {
    if (key == null) return null;
    if (key === 'elemDmg') return 'dmg:' + ownerElement;
    if (/^(dmg|deep|resPen|resShred|defIgnore):/.test(key) || PERCENT_PANEL.has(key) || /Flat$/.test(key)) return key;
    let k = ALIASES[key] || key;
    if (/^Green/.test(k)) k = k.slice(5);
    return KEYMAP[k] || null;
  }
  function isPercentPanel(pk) { return !!pk && (PERCENT_PANEL.has(pk) || /^(dmg|deep|resPen|resShred|defIgnore):/.test(pk)); }
  function addStat(acc, pk, v) { acc[pk] = (acc[pk] || 0) + v; }

  // ------------------------------------------------------------------ data index
  function indexData(ww) {
    if (!ww || !ww.meta || !ww.resonators) throw new Error('ww.json missing meta/resonators');
    if (ww.res instanceof Map) return ww;
    const by = (arr) => { const m = new Map(); for (const x of arr) m.set(x.id, x); return m; };
    const idx = { ww, meta: ww.meta, res: by(ww.resonators), weapons: by(ww.weapons), echoes: by(ww.echoes), sonatas: by(ww.sonatas), enemies: by(ww.enemies) };
    const cnt = {};
    for (const e of ww.echoes) for (const it of e.items) {
      const k = e.cost + ':' + it.quality; cnt[k] = cnt[k] || {}; cnt[k][it.mainPropGroup] = (cnt[k][it.mainPropGroup] || 0) + 1;
    }
    idx.mainGroup = {};
    for (const k of Object.keys(cnt)) idx.mainGroup[k] = Object.entries(cnt[k]).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    return idx;
  }
  function ensureIndex(data) { return data && data.res instanceof Map ? data : indexData(data); }

  // ------------------------------------------------------------------ text effect parser (chains / inherents / outro / weapon / sonata text)
  const LEX = [
    ['协同攻击伤害', 'coord'], ['全属性伤害加成', 'allElement'], ['全属性伤害', 'allElement'], ['属性伤害加成', 'allElement'], ['全伤害', 'all'], ['所有伤害', 'all'],
    ['共鸣技能伤害', 'skill'], ['共鸣解放伤害', 'liberation'], ['普攻伤害', 'basic'], ['重击伤害', 'heavy'],
    ['变奏技能伤害', 'intro'], ['延奏技能伤害', 'outro'], ['声骸技能伤害', 'echo'],
    ['冷凝伤害', 'glacio'], ['热熔伤害', 'fusion'], ['导电伤害', 'electro'], ['气动伤害', 'aero'], ['衍射伤害', 'spectro'], ['湮灭伤害', 'havoc'],
    ['冷凝属性伤害', 'glacio'], ['热熔属性伤害', 'fusion'], ['导电属性伤害', 'electro'], ['气动属性伤害', 'aero'], ['衍射属性伤害', 'spectro'], ['湮灭属性伤害', 'havoc'],
    ['冷凝属性伤害加成', 'glacio'], ['热熔属性伤害加成', 'fusion'], ['导电属性伤害加成', 'electro'], ['气动属性伤害加成', 'aero'], ['衍射属性伤害加成', 'spectro'], ['湮灭属性伤害加成', 'havoc'],
    ['物理伤害', 'physical'],
    ['风蚀效应伤害', 'anomaly:erosion'], ['光噪效应伤害', 'anomaly:frazzle'], ['电磁效应伤害', 'anomaly:flare'], ['聚爆效应伤害', 'anomaly:burst'],
    ['霜渐效应伤害', 'anomaly:chafe'], ['虚湮效应伤害', 'anomaly:bane'], ['异常效应伤害', 'anomaly'],
  ].sort((a, b) => b[0].length - a[0].length);
  const STATLEX = [['暴击伤害', 'critDmg'], ['暴击率', 'critRate'], ['暴击', 'critRate'], ['共鸣效率', 'energyRegen'], ['治疗效果加成', 'healBonus'], ['治疗效果', 'healBonus'],
    ['攻击', 'atkPct'], ['生命', 'hpPct'], ['防御', 'defPct']];
  const COND_RE = /(时|后|期间|命中|施放|释放|造成|处于|拥有|当|每|若|如果|登场|离场|切换|附近|在场|状态)/;
  const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

  function detectTrigger(pre) {
    const any = [];
    if (/延奏/.test(pre)) any.push({ on: 'outro' });
    if (/变奏/.test(pre)) any.push({ on: 'intro' });
    // “获得护盾时” → shield event (fired by modules via api.shield, ICD from the text is applied by the caller window)
    if (/获得护盾(时|后)/.test(pre)) any.push({ on: 'shield' });
    // “造成治疗时 / 为队伍中角色提供治疗时 / 进行治疗后” → heal event: fired after an action with heal rows (calc 'heal') or by modules (api.heal)
    if (/(造成|提供|进行)治疗(时|后)|治疗队伍中.{0,8}(时|后)/.test(pre)) any.push(/共鸣技能造成治疗/.test(pre) ? { on: 'heal', kinds: ['E'] } : { on: 'heal' });
    const verb = /(施放|释放|使用|造成)/.test(pre);
    const kinds = [];
    if (verb) {
      if (/共鸣解放/.test(pre)) kinds.push('R');
      if (/共鸣技能/.test(pre)) kinds.push('E');
      if (/声骸技能/.test(pre)) kinds.push('Q');
    }
    // named moves (施放重击星星花绽放 / 普攻·夏弥尔之星) are specific skills, not every heavy/basic → leave to modules (manual)
    const named = (w) => new RegExp(w + '(?![时后或、，,与和及伤或])[·\\u4e00-\\u9fa5]').test(pre) && !new RegExp(w + '(时|后|或|、|伤害)').test(pre);
    if (/普攻或重击|普攻、重击/.test(pre)) kinds.push('A', 'H');
    else {
      if (/重击/.test(pre) && verb && !named('重击')) kinds.push('H');
      if (/普攻/.test(pre) && verb && !named('普攻')) kinds.push('A');
    }
    if (kinds.length) any.push({ on: 'cast', kinds });
    const an = anomalyApplyTrigger(pre);
    if (an) any.push(an);
    const tu = tuneApplyTrigger(pre);
    if (tu) any.push(tu);
    if (!any.length) return null;
    if (any.length === 1) return any[0];
    return { on: 'any', any };
  }
  function trigMatches(trig, on, kind) {
    if (!trig) return false;
    if (trig.on === 'any') return trig.any.some((x) => trigMatches(x, on, kind));
    if (trig.on !== on) return false;
    return on !== 'cast' || (trig.kinds || []).includes(kind);
  }
  // stream B B4: tune states (偏移 / 干涉). Kinds: concord 集谐 · tremor 震谐 · hack 骇破; states: shift 偏移 · interfere 干涉
  const TUNE_BY_ZH = { 集谐: 'concord', 震谐: 'tremor', 骇破: 'hack' };
  const TUNE_STATE_ZH = { 偏移: 'shift', 干涉: 'interfere' };
  function tuneApplyTrigger(pre) {
    const m = /(?:添加|附加)【?(集谐|震谐|骇破)·(偏移|干涉)】?(?:时|后)/.exec(pre);
    if (!m) return null;
    return { on: /队伍中(的)?角色/.test(pre.slice(0, m.index)) ? 'tuneTeam' : 'tune', kinds: [TUNE_BY_ZH[m[1]] + ':' + TUNE_STATE_ZH[m[2]]] };
  }
  // “为敌人添加【X效应】时 / 附加X效应后” → event trigger on the owner applying the status
  function anomalyApplyTrigger(pre) {
    const m = /(?:添加|附加)(?!了)([^时后，,。；]{0,64}?效应】?)(?:时|后)/.exec(pre);
    if (!m) return null;
    const names = (m[1].match(/[风光电聚霜虚异][蚀噪磁爆渐湮常](?=效应)/g) || []);
    if (!names.length) return null;
    // “队伍中的角色(为目标)附加…” → any member applying; “角色为敌人添加 / 附加…后”（装备者）→ owner only
    return { on: /队伍中(的)?角色/.test(pre.slice(0, m.index)) ? 'anomalyTeam' : 'anomaly', kinds: names.includes('异常') ? ['any'] : names.map((x) => ANOMALY_BY_ZH[x]).filter(Boolean) };
  }
  // “对附加了【X效应】的目标 / 存在【X效应】的敌人 / 目标的X效应不少于N层 / 带有【异常效应】的怪物” → static condition on the target state
  function targetAnomalyCond(clause) {
    const m = /(?:附加了|存在|带有|拥有|目标的|敌人的)\s*(\d+层)?\s*【?([风光电聚霜虚异][蚀噪磁爆渐湮常])效应】?(?:不少于(\d+)层)?/.exec(clause);
    if (!m) return null;
    const n = m[1] ? parseInt(m[1], 10) : m[3] ? parseInt(m[3], 10) : 1;
    return { on: 'targetAnomaly', kinds: m[2] === '异常' ? ['any'] : [ANOMALY_BY_ZH[m[2]]].filter(Boolean), minStacks: n };
  }
  function detectTarget(sent) {
    if (/除[^，。；]{1,20}?(以外|之外)/.test(sent)) return 'others';
    if (/下一位登场|下一个登场|下一名登场/.test(sent)) return 'incoming';
    if (/队伍中(的|所有)?角色|全队|附近队伍中所有角色|队伍中所有|队伍中登场角色/.test(sent)) return 'team';
    return 'self';
  }

  /** Parse "X提升N%" / "X加深N%" effects from a substituted Chinese description. Keyword heuristics (MECH.buffText). */
  function parseTextEffects(text) {
    const out = [], late = [];
    if (!text) return out;
    const sentences = String(text).replace(/\r/g, '').split(/(?<=[。；;\n])/);
    for (let i = sentences.length - 1; i > 0; i--) if (/^\s*(该效果|该状态|此效果)/.test(sentences[i])) { sentences[i - 1] += sentences[i]; sentences.splice(i, 1); }
    for (const sent of sentences) {
      const re = /([^，,。；;：:\n·]*?)(提升|提高|增加|加深)\s*(\d+(?:\.\d+)?)%/g;
      let m;
      while ((m = re.exec(sent))) {
        const head = m[1], verb = m[2], val = parseFloat(m[3]) / 100;
        const pre = sent.slice(0, m.index) + head;
        const headC = head.replace(/[【】]/g, '');
        // “目标受到【X效应】伤害加深N%” → target-side anomaly deepen (the only 受到… form that is modeled)
        const taken = /受到([风光电聚霜虚异][蚀噪磁爆渐湮常])效应伤害/.exec(headC);
        if (!taken && /倍率|抗性|受到|减免|耐力|速度|概率|冷却|回复|恢复|护盾|治疗量/.test(head)) {
          out.push({ key: null, unmodeled: true, text: sent.trim(), reason: '倍率/抗性/非面板效果未建模' });
          continue;
        }
        let key = null; const extraKeys = [];
        if (taken) key = (verb === '加深' ? 'deep:' : 'dmg:') + 'anomaly' + (taken[1] === '异常' ? '' : ':' + ANOMALY_BY_ZH[taken[1]]);
        if (!key) for (const [w, k] of LEX) if (headC.includes(w)) { key = (verb === '加深' ? 'deep:' : 'dmg:') + k; break; }
        // “普攻、重击伤害加成提升” → both types
        const TY = { 普攻: 'basic', 重击: 'heavy', 共鸣技能: 'skill', 共鸣解放: 'liberation', 变奏技能: 'intro', 声骸技能: 'echo' };
        const two = /(普攻|重击|共鸣技能|共鸣解放|变奏技能|声骸技能)(?:伤害加成|伤害)?[、和与及](普攻|重击|共鸣技能|共鸣解放|变奏技能|声骸技能)伤害/.exec(headC);
        if (two) { const ns = verb === '加深' ? 'deep:' : 'dmg:'; key = ns + TY[two[1]]; extraKeys.push(ns + TY[two[2]]); }
        if (!key && verb !== '加深') {
          // strip move names first: 空中攻击 / 下落攻击 must not read as ATK%
          const hs = headC.replace(/空中攻击|下落攻击|闪避反击|协同攻击|普攻|重击/g, '');
          for (const [w, k] of STATLEX) if (hs.includes(w)) { key = k; break; }
          if (key === 'atkPct' && /伤害/.test(hs)) key = null;
        }
        if (!key && verb === '加深' && /伤害/.test(head)) key = 'deep:all';
        const conditional = COND_RE.test(pre) || /附加了|存在|带有/.test(pre);
        const cm = /^(.*(?:时|后|期间|之后))/.exec(pre);
        const segs = pre.split(/[，,]/);
        const ta = targetAnomalyCond(pre);
        // stream B B11: “击败…时 / 击杀…后” buffs are off by default (kill triggers are not simulated)
        // (also when the kill condition sits in an earlier sentence and this effect has no condition of its own, e.g. 露西 网络后门 →「全伤害加深10%」)
        const kill = /击败|击杀/.test(pre) || (/击败|击杀/.test(String(text)) && !conditional);
        const trig = kill ? { on: 'manual' } : ta || (conditional ? detectTrigger(cm ? cm[1] : pre) : null);
        const after = sent.slice(m.index + m[0].length);
        const DUR = /(?:持续|存在)\s*(\d+(?:\.\d+)?)\s*秒/;
        const allDu = [...new Set((String(text).match(/(?:持续|存在)\s*\d+(?:\.\d+)?\s*秒/g) || []).map((x) => x.replace(/\D*?(\d+(?:\.\d+)?)\D*$/, '$1')))];
        const du = DUR.exec(after) || DUR.exec(sent) || (allDu.length === 1 ? DUR.exec(String(text)) : null);
        const st = /(?:可叠加|最多叠加|叠加至|上限为)\s*(\d+|[一二两三四五六七八九十])\s*层/.exec(sent);
        out.push({
          key, extraKeys: extraKeys.length ? extraKeys : undefined, verb, value: val, conditional: conditional || !!ta || kill, trigger: trig, kill: kill || undefined, target: taken ? 'team' : /^自身/.test(segs[segs.length - 1]) ? 'self' : detectTarget(sent),
          duration: du ? parseFloat(du[1]) : null, maxStacks: st ? (CN_NUM[st[1]] || parseInt(st[1], 10)) : 1,
          endsOnSwap: /提前结束|切换至其他角色/.test(sent), text: sent.trim(),
          unmodeled: !key, reason: key ? undefined : '未识别的属性词',
        });
      }
      // “(类型)伤害无视目标N%防御” / “无视目标N%X抗性” → defIgnore[:type] / resPen:el[:type] (appended after the main list: ids stay stable)
      const ig = /(?:(普攻|重击|共鸣技能|共鸣解放|变奏技能|声骸技能)伤害)?(?:能)?无视(?:目标|对方)?\s*(\d+(?:\.\d+)?)%(?:的)?防御/.exec(sent);
      const ip = /(?:(普攻|重击|共鸣技能|共鸣解放|变奏技能|声骸技能)伤害)?(?:能)?无视(?:目标)?\s*(\d+(?:\.\d+)?)%(?:的)?(冷凝|热熔|导电|气动|衍射|湮灭|物理)(?:属性)?(?:伤害)?抗性/.exec(sent);
      for (const [mm, isDef] of [[ig, true], [ip, false]]) {
        if (!mm) continue;
        const TYk = { 普攻: 'basic', 重击: 'heavy', 共鸣技能: 'skill', 共鸣解放: 'liberation', 变奏技能: 'intro', 声骸技能: 'echo' };
        const ty = mm[1] ? TYk[mm[1]] : null;
        const el = isDef ? null : Object.entries(ELEMENT_ZH).find(([, zh]) => zh === mm[3])[0];
        const k = isDef ? 'defIgnore' + (ty ? ':' + ty : '') : 'resPen:' + el + (ty ? ':' + ty : '');
        const pre = sent.slice(0, mm.index);
        const cond = COND_RE.test(pre);
        const cm = /^(.*(?:时|后|期间|之后|秒内))/.exec(pre);
        const du = /(?:持续|存在)\s*(\d+(?:\.\d+)?)\s*秒/.exec(sent) || /(\d+(?:\.\d+)?)\s*秒内/.exec(pre);
        late.push({ key: k, verb: '无视', value: parseFloat(mm[2]) / 100, conditional: cond, trigger: cond ? (anomalyApplyTrigger(pre) || detectTrigger(cm ? cm[1] : pre)) : null,
          target: 'self', duration: du ? parseFloat(du[1]) : null, maxStacks: 1, text: sent.trim() });
      }
      const rs = /抗性(?:减少|降低)\s*(\d+(?:\.\d+)?)%/.exec(sent);
      if (rs) {
        const el = Object.entries(ELEMENT_ZH).find(([, zh]) => sent.includes(zh));
        const du = /持续\s*(\d+(?:\.\d+)?)\s*秒/.exec(sent);
        out.push({ key: 'resShred:' + (el ? el[0] : 'all'), verb: '减抗', value: parseFloat(rs[1]) / 100, conditional: true, trigger: detectTrigger(sent),
          target: 'team', duration: du ? parseFloat(du[1]) : null, maxStacks: 1, text: sent.trim() });
      }
    }
    return out.concat(late);
  }

  // ------------------------------------------------------------------ helpers
  function levelRow(rows, level, ascended) {
    const c = rows.filter((r) => r[0] === level);
    if (!c.length) throw new Error('level ' + level + ' not in level table');
    return c.reduce((a, b) => (ascended ? (b[1] > a[1] ? b : a) : (b[1] < a[1] ? b : a)));
  }
  function pickLevel(arr, level) { if (!arr || !arr.length) return 0; return arr[Math.max(0, Math.min(arr.length - 1, level - 1))]; }
  function round(x, n) { const p = Math.pow(10, n == null ? 4 : n); return Math.round(x * p) / p; }
  function percentNormalize(pk, v, warn, where) {
    if (isPercentPanel(pk) && Math.abs(v) > 1.5) { if (warn) warn.push({ level: 'info', text: `${where}: ${pk}=${v} 视为百分数，按 ${v / 100} 计` }); return v / 100; }
    return v;
  }
  function statLabel(pk) {
    const [ns, k, k2] = pk.split(':');
    if (k === 'anomaly') return (k2 ? ANOMALY_ZH[k2] || k2 : '异常效应') + ({ dmg: '伤害加成', deep: '伤害加深' })[ns];
    if (ns === 'defIgnore' && k) return DMG_TYPE_ZH[k] + '无视防御';
    if (ns === 'resPen' && k2) return DMG_TYPE_ZH[k2] + (ELEMENT_ZH[k] || k) + '抗性穿透';
    const nm = { atkPct: '攻击%', hpPct: '生命%', defPct: '防御%', critRate: '暴击', critDmg: '暴击伤害', energyRegen: '共鸣效率', healBonus: '治疗加成', defIgnore: '无视防御', atkFlat: '攻击', hpFlat: '生命', defFlat: '防御' };
    if (!k) return nm[ns] || ns;
    const what = ELEMENT_ZH[k] || DMG_TYPE_ZH[k] || ({ all: '全', allElement: '全属性', coord: '协同攻击' })[k] || k;
    return what + ({ dmg: '伤害加成', deep: '伤害加深', resPen: '抗性穿透', resShred: '减抗' })[ns];
  }

  // ------------------------------------------------------------------ panel assembly
  /** substat: {stat, value} (value wins) or {stat, tier} resolved against config.substatTiers (validation/substat_tiers.json shape-tolerant) */
  // substat tier table (validation/substat_tiers.json): keys are Chinese names, values in table units (% for percent stats).
  // Tiers are UI presets / config validation only (MECH.stats); probabilities never affect damage.
  const TIER_ZH = { critRate: '暴击', critDmg: '暴击伤害', atkPct: '攻击%', atkFlat: '固定攻击', hpPct: '生命%', hpFlat: '固定生命',
    defPct: '防御%', defFlat: '固定防御', energyRegen: '共鸣效率', 'dmg:basic': '普攻伤害加成', 'dmg:heavy': '重击伤害加成',
    'dmg:skill': '共鸣技能伤害加成', 'dmg:liberation': '共鸣解放伤害加成' };
  const TIER_ZH_REV = Object.fromEntries(Object.entries(TIER_ZH).map(([k, v]) => [v, k]));
  function subKey(stat) { return TIER_ZH_REV[stat] || panelKey(stat); }
  function tierEntry(tiers, stat) {
    if (!tiers) return null;
    const root = tiers.substats || tiers;
    const pk = subKey(stat);
    const cands = [stat, pk, TIER_ZH[pk], ALIASES[stat]].filter(Boolean);
    let t = null;
    if (Array.isArray(root)) t = root.find((x) => cands.includes(x.stat) || cands.includes(x.key) || cands.includes(x.name) || cands.includes(x.id));
    else for (const c of cands) if (root[c]) { t = root[c]; break; }
    if (!t) return null;
    const arr = Array.isArray(t) ? t : (t.tiers || t.values);
    if (!Array.isArray(arr)) return null;
    const pct = (t.unit === '%') || (isPercentPanel(pk) && arr.some((v) => (typeof v === 'object' ? v.value : v) > 1.5));
    const vals = arr.map((v) => (typeof v === 'object' ? v.value : v)).map((v) => (pct ? round(v / 100, 6) : v));
    return { key: pk, zh: TIER_ZH[pk] || stat, values: vals, probabilities: t.probabilities || null, unit: pct ? 'fraction' : 'flat' };
  }
  /** UI preset table: [{key, zh, values(engine units), probabilities}] */
  function substatTierTable(tiers) {
    return Object.keys(TIER_ZH).map((k) => tierEntry(tiers, k)).filter(Boolean);
  }
  function resolveSubstat(sub, tiers, warn, where) {
    const te = tierEntry(tiers, sub.stat);
    if (sub.value != null) {
      if (te) {
        const v = isPercentPanel(te.key) && Math.abs(sub.value) > 1.5 ? sub.value / 100 : sub.value;
        if (!te.values.some((x) => Math.abs(x - v) <= Math.max(1e-4, Math.abs(x) * 0.002)))
          warn.push({ level: 'info', text: `${where}: 副词条 ${te.zh}=${sub.value} 不在档位表中（${te.values.join('/')}），按输入值计算` });
      }
      return sub.value;
    }
    if (sub.tier != null && te) {
      const i = sub.tier === 'max' ? te.values.length - 1 : sub.tier === 'min' ? 0 : Math.max(0, Math.min(te.values.length - 1, sub.tier | 0));
      return te.values[i];
    }
    warn.push({ level: 'warn', text: `${where}: 副词条 ${sub.stat} 未给数值且无可用档位表，按 0 计` });
    return 0;
  }

  function mkBuff(e, id, src, kind, owner) {
    const b = {
      id, name: e.key ? statLabel(e.key) : '未建模效果', src, kind, owner, text: e.text,
      stats: e.key ? [{ key: e.key, value: e.value }].concat((e.extraKeys || []).map((k) => ({ key: k, value: e.value }))) : [], target: e.target,
      trigger: e.conditional ? (e.trigger || { on: 'manual' }) : { on: 'always' },
      duration: e.duration, maxStacks: e.maxStacks || 1, endsOnSwap: !!e.endsOnSwap, unmodeled: !!e.unmodeled,
      mech: MECH.buffText.mech, confidence: e.conditional ? 'low' : 'medium', basis: MECH.buffText.basis,
    };
    b.mode = b.unmodeled ? 'off' : (!e.conditional ? 'on' : (e.trigger && e.trigger.on !== 'manual' ? 'auto' : 'off'));
    if (b.unmodeled) b.lowReason = e.reason;
    else if (e.kill) b.lowReason = '击败/击杀触发（木桩模拟不触发），默认关闭，可手动开启';
    else if (e.conditional) b.lowReason = e.trigger ? '触发条件由关键词推断' : '触发条件未识别，默认关闭，可手动开启';
    return b;
  }

  // chains 1..k whose text the generic parser fully models (every effect recognised and triggerable, or pure stat addProp); a module may declare more
  function genericChainCoverage(mem, idx, mi) {
    let k = 0;
    for (const C of mem.R.chains.slice(0, 6)) {
      const effs = parseTextEffects(C.desc);
      const ok = (C.addProp && C.addProp.length && !effs.length) || (effs.length && effs.every((e) => !e.unmodeled && e.key && (!e.conditional || (e.trigger && e.trigger.on !== 'manual'))));
      if (!ok) break;
      k = C.index || k + 1;
    }
    return k;
  }
  /** chainModeled for a resonator id (page badges): null = no module (generic parse, search disabled) */
  function chainModeledOf(data, id) {
    const idx = ensureIndex(data), R = idx.res.get(+id), mod = getChar(+id);
    if (!R || !mod) return null;
    return Math.max(mod.chainModeled != null ? mod.chainModeled : 0, genericChainCoverage({ R }, idx, 0));
  }
  function assembleMember(m, idx, opts, mi) {
    const warn = [];
    const R = idx.res.get(m.id);
    if (!R) throw new Error('unknown resonator id ' + m.id);
    const el = R.element;
    const level = m.level || 90, asc = m.ascended !== false;
    const row = levelRow(R.levelStats, level, asc);
    const acc = {};
    const sources = [];
    const buffDefs = [];
    const add = (src, key, v, mech, conf) => {
      const pk = panelKey(key, el);
      if (!pk) { warn.push({ level: 'info', text: `${src}: 未建模属性 ${key}` }); return; }
      addStat(acc, pk, v); sources.push({ src, key: pk, value: v, mech: mech || 'table', confidence: conf || 'high' });
    };
    const base = { hp: row[2], atk: row[3], def: row[4], charAtk: row[3], weaponAtk: 0 };
    add('角色基础', 'critRate', R.base.critRate); add('角色基础', 'critDmg', R.base.critDmg);
    addStat(acc, 'energyRegen', R.base.energyRegen);
    let W = null;
    if (m.weapon && m.weapon.id) {
      W = idx.weapons.get(m.weapon.id);
      if (!W) throw new Error('unknown weapon id ' + m.weapon.id);
      if (W.weaponType !== R.weaponType) warn.push({ level: 'warn', text: `${R.name}: 武器 ${W.name} 类型不符` });
      const wr = levelRow(W.levelStats, m.weapon.level || 90, m.weapon.ascended !== false);
      base.atk += wr[2]; base.weaponAtk = wr[2];
      add('武器副属性·' + W.name, W.subStat.key, wr[3]);
      const rank = Math.max(1, Math.min(5, m.weapon.rank || 1));
      const desc = W.passive.descByRank && W.passive.descByRank[rank - 1];
      parseTextEffects(desc).forEach((e, i) => buffDefs.push(mkBuff(e, `w${mi}_${i}`, `${W.name} R${rank}`, 'weapon', mi)));
    } else warn.push({ level: 'warn', text: `${R.name}: 未装备武器` });
    if (m.treeNodes !== false) for (const [k, v] of Object.entries(R.statNodeTotals || {})) add('技能树', k, v);
    const echoes = m.echoes || [];
    let cost = 0;
    const setCount = {};
    echoes.forEach((e, i) => {
      const where = `${R.name} 声骸#${i + 1}`;
      const E = e.echoId ? idx.echoes.get(e.echoId) : null;
      if (e.echoId && !E) throw new Error('unknown echo id ' + e.echoId);
      const c = e.cost || (E && E.cost);
      cost += c || 0;
      const q = e.quality || 5;
      const grp = idx.ww.echoMainStats[idx.mainGroup[c + ':' + q]];
      if (!grp) warn.push({ level: 'warn', text: `${where}: COST ${c} 品质 ${q} 无主词条表` });
      else if (e.main) {
        const want = e.main === 'elemDmg' ? 'DamageChangeElement' + ELEMENTS.indexOf(el) : (ALIASES[e.main] || e.main);
        const opt = grp.find((o) => o.main.key === want);
        if (!opt) warn.push({ level: 'warn', text: `${where}: COST ${c} 无主词条 ${e.main}（可选：${grp.map((o) => o.main.key).join('/')}）` });
        else {
          const lv = e.level == null ? 25 : e.level;
          add(where + ' 主词条', opt.main.key, opt.main.byLevel[Math.min(lv, opt.main.byLevel.length - 1)]);
          if (opt.fixed) add(where + ' 固定主词条', opt.fixed.key, opt.fixed.byLevel[Math.min(lv, opt.fixed.byLevel.length - 1)]);
        }
      }
      for (const s of e.subs || []) {
        const pk = subKey(s.stat);
        if (!pk) { warn.push({ level: 'warn', text: `${where}: 未知副词条 ${s.stat}` }); continue; }
        let v = resolveSubstat(s, opts.substatTiers, warn, where);
        v = percentNormalize(pk, v, null, where);
        add(where + ' 副词条', pk, v);
      }
      const set = e.set != null ? e.set : (E && E.sonataGroups.length === 1 ? E.sonataGroups[0] : null);
      if (set != null) { setCount[set] = setCount[set] || new Set(); setCount[set].add(e.echoId ? 'e' + e.echoId : 'slot' + i); }
    });
    if (cost > 12) warn.push({ level: 'err', text: `${R.name}: 声骸总 COST ${cost} > 12` });
    const sonataActive = [];
    for (const [sid, ids] of Object.entries(setCount)) {
      const S = idx.sonatas.get(+sid);
      if (!S) { warn.push({ level: 'warn', text: `${R.name}: 未知套装 ${sid}` }); continue; }
      const n = ids.size;
      for (const [pc, P] of Object.entries(S.pieces)) {
        if (n < +pc) continue;
        sonataActive.push({ id: S.id, name: S.name, pieces: +pc });
        if (P.addProp && P.addProp.length) P.addProp.forEach((p) => add(`${S.name} ${pc}件`, p.key, p.value));
        else parseTextEffects(P.desc).forEach((e, i) => buffDefs.push(mkBuff(e, `s${mi}_${S.id}_${pc}_${i}`, `${S.name} ${pc}件`, 'sonata', mi)));
      }
    }
    const chain = Math.max(0, Math.min(6, m.chain || 0));
    for (const C of R.chains.slice(0, chain)) {
      (C.addProp || []).forEach((p) => add(`共鸣链${C.index}`, p.key, p.value));
      parseTextEffects(C.desc).forEach((e, i) => buffDefs.push(mkBuff(e, `c${mi}_${C.index}_${i}`, `共鸣链${C.index}·${C.name}`, 'chain', mi)));
    }
    if (m.inherents !== false) for (const I of R.inherents) parseTextEffects(I.desc).forEach((e, i) => buffDefs.push(mkBuff(e, `i${mi}_${I.skillId}_${i}`, `固有·${I.name}`, 'inherent', mi)));
    for (const s of R.skills.filter((x) => x.type === 11)) parseTextEffects(s.desc).forEach((e, i) => {
      const b = mkBuff(e, `o${mi}_${i}`, `延奏·${s.name}`, 'outro', mi);
      if (!b.unmodeled) { b.trigger = { on: 'outro' }; b.mode = 'auto'; b.lowReason = '延奏描述解析'; }
      buffDefs.push(b);
    });
    (m.manualBuffs || []).forEach((mb, i) => {
      const stats = Object.entries(mb.stats || {}).map(([k, v]) => { const pk = panelKey(k, el); if (!pk) warn.push({ level: 'warn', text: `手动增益：未知属性 ${k}` }); return pk ? { key: pk, value: percentNormalize(pk, v, warn, '手动增益') } : null; }).filter(Boolean);
      buffDefs.push({ id: `m${mi}_${i}`, name: mb.name || '手动增益', src: '手动', kind: 'manual', owner: mi, stats, target: mb.target || 'self',
        trigger: { on: 'always' }, mode: 'on', from: mb.from || 0, to: mb.to == null ? Infinity : mb.to, duration: null, maxStacks: 1, mech: 'table', confidence: 'high', basis: '用户输入' });
    });
    const ov = Object.assign({}, opts.buffOverrides || {}, m.buffOverrides || {});
    for (const b of buffDefs) {
      if (ov[b.id]) b.mode = ov[b.id];
      else if (opts.conditionals === 'all-on' && b.mode !== 'on' && !b.unmodeled) b.mode = 'on';
      else if (opts.conditionals === 'off' && b.mode === 'auto') b.mode = 'off';
    }
    return { R, el, level, base, acc, sources, buffDefs, warn, weapon: W, chain, sonataActive, echoCost: cost };
  }

  /** final panel = static acc + extra stat list [{key,value}] */
  function finalPanel(mem, extra) {
    const a = Object.assign({}, mem.acc);
    for (const s of extra || []) addStat(a, s.key, s.value);
    const atk = mem.base.atk * (1 + (a.atkPct || 0)) + (a.atkFlat || 0);
    const hp = mem.base.hp * (1 + (a.hpPct || 0)) + (a.hpFlat || 0);
    const def = mem.base.def * (1 + (a.defPct || 0)) + (a.defFlat || 0);
    return { atk, hp, def, critRate: a.critRate || 0, critDmg: a.critDmg || 0, energyRegen: a.energyRegen || 1, healBonus: a.healBonus || 0, raw: a };
  }

  // ------------------------------------------------------------------ damage formula
  function defenseMultiplier(attackerLevel, enemyLevel, defIgnore, defReduce, enemyDefOverride) {
    const enemyDef = enemyDefOverride != null ? enemyDefOverride : 792 + 8 * enemyLevel;
    const a = 800 + 8 * attackerLevel;
    const effDef = Math.max(0, enemyDef * (1 - (defIgnore || 0)) * (1 - (defReduce || 0)));
    return { value: a / (a + effDef), enemyDef, effDef };
  }
  function resistanceMultiplier(res) {
    if (res < 0) return 1 - res / 2;
    if (res < 0.8) return 1 - res;
    return 1 / (1 + 5 * res);
  }
  function critMultiplier(cr, cd, mode) {
    if (mode === 'crit') return cd;
    if (mode === 'noncrit') return 1;
    return 1 + Math.max(0, Math.min(1, cr)) * (cd - 1);
  }
  function zone(key, name, value, display, extra) {
    const M = MECH[key] || MECH.base;
    return Object.assign({ key, mechKey: key, name, value, display: display == null ? String(round(value, 4)) : display, mech: M.mech, basis: M.basis, confidence: M.confidence }, extra || {});
  }

  /** Resolve one hit row against a panel/target. Returns per-hit & total {expected,crit,noncrit} plus zone breakdown. */
  function resolveHit(p) {
    const { panel, hit, level, attackerLevel, enemy } = p;
    const mode = p.mode || 'expected';
    const a = panel.raw;
    // multUp: module-scoped “伤害倍率提升X%” (relative, additive between sources) passed via actionStats for one action only
    const multUp = a.multUp || 0;
    const mult = pickLevel(hit.multiplier, level) * (1 + multUp);
    const flatArr = hit.flatAdd || hit.flat;
    const flat = flatArr ? pickLevel(flatArr, level) : 0;
    const stat = hit.scaling === 'hp' ? panel.hp : hit.scaling === 'def' ? panel.def : panel.atk;
    const statName = hit.scaling === 'hp' ? '生命' : hit.scaling === 'def' ? '防御' : '攻击';
    const base = stat * mult + flat;
    const count = hit.count || 1;
    if (hit.calc === 'heal') {
      const h = base * (1 + panel.healBonus) * count;
      const z = { expected: 0, crit: 0, noncrit: 0 };
      return { perHit: z, total: z, zones: [], heal: h, element: null, type: null, base };
    }
    const el = ELEMENTS.includes(hit.element) ? hit.element : null;
    const ty = DMG_TYPES.includes(hit.type) ? hit.type : null;
    const sumKeys = (ns) => (a[ns + ':all'] || 0) + (el ? a[ns + ':' + el] || 0 : 0) + (el && el !== 'physical' ? a[ns + ':allElement'] || 0 : 0) + (ty ? a[ns + ':' + ty] || 0 : 0);
    const bonus = 1 + sumKeys('dmg');
    const deepen = 1 + sumKeys('deep') + (enemy.damageTaken || 0);
    const critM = critMultiplier(panel.critRate, panel.critDmg, mode);
    // per-damage-type penetration: defIgnore:<type>, resPen:<el>:<type>, resPen:all:<type>
    const tyIg = ty ? a['defIgnore:' + ty] || 0 : 0;
    const tyPen = ty ? (el ? a['resPen:' + el + ':' + ty] || 0 : 0) + (a['resPen:all:' + ty] || 0) : 0;
    const d = defenseMultiplier(attackerLevel, enemy.level, (a.defIgnore || 0) + tyIg + (enemy.defIgnore || 0), (enemy.defReduce || 0) + (a.defReduce || 0), enemy.defOverride);
    const baseRes = enemy.resByElement && el && enemy.resByElement[el] != null ? enemy.resByElement[el] : enemy.resTier;
    const shred = (enemy.resShred || 0) + (a['resShred:all'] || 0) + (el ? a['resShred:' + el] || 0 : 0) + (el ? a['resPen:' + el] || 0 : 0) + tyPen;
    const effRes = baseRes - shred;
    const resM = resistanceMultiplier(effRes);
    const red = 1 - (enemy.dmgReduce || 0);
    const common = base * bonus * deepen * d.value * resM * red;
    const perHit = { expected: common * critMultiplier(panel.critRate, panel.critDmg, 'expected'), crit: common * panel.critDmg, noncrit: common };
    const total = { expected: perHit.expected * count, crit: perHit.crit * count, noncrit: perHit.noncrit * count };
    const zones = [
      zone('base', '基础区', stat, `${statName} ${Math.round(stat).toLocaleString('en-US')}${flat ? ' + ' + flat : ''}`, { stat: hit.scaling, flat }),
      zone('multiplier', '倍率', mult * count, `${round(mult * 100, 2)}%${count > 1 ? '×' + count : ''}${multUp ? `（含倍率提升 ${round(multUp * 100, 2)}%）` : ''}`),
      zone('bonus', '伤害加成', bonus),
      zone(enemy.damageTaken ? 'deepenTarget' : 'deepen', '加深', deepen, null, { key: 'deepen', targetTaken: enemy.damageTaken || 0 }),
      zone('crit', mode === 'crit' ? '暴击' : mode === 'noncrit' ? '不暴' : '暴击期望', critM, null, { critRate: panel.critRate, critDmg: panel.critDmg }),
      zone('defense', '防御', d.value, null, { enemyDef: d.enemyDef, effectiveDef: d.effDef }),
      zone(effRes >= 0.8 ? 'resistanceHigh' : 'resistance', '抗性', resM, `${round(resM, 4)}（有效抗性 ${round(effRes * 100, 2)}%）`, { key: 'resistance', baseRes, shred, effectiveRes: effRes, neg: effRes < 0, highSegment: effRes >= 0.8 }),
      zone('dmgReduce', '减伤', red),
    ];
    return { perHit, total, zones, effectiveRes: effRes, element: el, type: ty, base, heal: 0 };
  }

  // ------------------------------------------------------------------ kit (action catalog)
  const STAGE_RE = /第([一二三四五六七八九十\d]+)段/;
  const NOT_STAGE_RE = /空中|闪避|下落|重击|反击|强化|·/;
  function groupHits(skill) {
    const groups = [], byLabel = new Map();
    for (const h of skill.hits) {
      if (h.alt) continue; // alternative damage rows for the same description term (build_ww split); excluded from default sums
      const k = h.label || '?';
      if (!byLabel.has(k)) { const g = { label: k, hits: [] }; byLabel.set(k, g); groups.push(g); }
      byLabel.get(k).hits.push(h);
    }
    return groups;
  }
  function labelConcerto(skill, label, isPrimary) {
    const ps = skill.params || [];
    const own = ps.find((p) => {
      if (!p.label || !p.label.includes('回复协奏能量')) return false;
      const pre = p.label.replace('回复协奏能量', '');
      return pre && label && label.startsWith(pre);
    });
    if (own) return parseFloat(own.values[0]);
    if (isPrimary && skill.concertoGain != null) return skill.concertoGain;
    return null;
  }
  const SKILL_LV_DEFAULT = { basic: 10, skill: 10, liberation: 10, intro: 10, forte: 10, outro: 1 };

  /** Generic action template from hit rows. Used by buildKit and by character modules (H.act). */
  function makeAct(mem, spec) {
    const R = mem.R;
    const skill = spec.skillObj || (typeof spec.skill === 'number' && spec.skill < 100 ? R.skills.find((s) => s.type === spec.skill) : R.skills.find((s) => s.id === spec.skill));
    let hits = spec.hits || [];
    if (!spec.hits && skill) {
      const labs = spec.labels;
      hits = skill.hits.filter((h) => (spec.includeAlt || !h.alt) && (!labs || labs.some((l) => (l instanceof RegExp ? l.test(h.label) : h.label === l))));
      if (labs && !hits.length) mem.warn.push({ level: 'warn', text: `${R.name}: 模块动作 ${spec.key} 找不到命中行 ${labs.join('/')}` });
    }
    if (spec.count) hits = hits.map((h) => Object.assign({}, h, { count: spec.count }));
    const hitConc = hits.reduce((s, h) => s + ((h.concerto && h.concerto[0]) || 0) * (h.count || 1), 0);
    const hitEnergy = hits.reduce((s, h) => s + ((h.energy && h.energy[0]) || 0) * (h.count || 1), 0);
    let concerto = hitConc, concertoSource = 'hits';
    if (hitConc < EPS) {
      let desc = null;
      if (spec.concertoParam && skill) { const p = (skill.params || []).find((x) => x.label === spec.concertoParam); if (p) desc = parseFloat(p.values[0]); }
      if (desc == null && skill && !spec.noConcertoFallback) desc = labelConcerto(skill, spec.labels && typeof spec.labels[0] === 'string' ? spec.labels[0] : '', !!spec.primary);
      if (desc == null && spec.concerto != null) desc = spec.concerto;
      if (desc != null) { concerto = desc; concertoSource = 'description'; }
    }
    const lv = Object.assign({}, SKILL_LV_DEFAULT, (mem.cfg && mem.cfg.skillLevels) || {});
    const levelKey = spec.levelKey || 'basic';
    return Object.assign({
      key: spec.key, cls: spec.cls, label: spec.label || ((skill ? skill.name : '') + (spec.labels && typeof spec.labels[0] === 'string' && spec.labels[0] !== '技能伤害' ? '·' + spec.labels[0].replace(/伤害$/, '') : '')),
      skillId: skill ? skill.id : null, skillType: skill ? skill.type : null, hits, level: spec.level || lv[levelKey] || 1, levelKey,
      energy: hitEnergy, concerto, concertoSource, cooldown: spec.cooldown || 0, cdKey: spec.cdKey || null, cost: spec.cost,
      lowHits: hits.filter((h) => h.confidence !== 'high').length, defDur: spec.dur, durKey: spec.durKey || null,
      ownStage: !!spec.ownStage, forceCrit: !!spec.forceCrit, scale: spec.scale || null, module: !!spec.module, inferred: spec.inferred || null,
    }, spec.extra || {});
  }

  function buildKit(mem, member, echoCfg, idx) {
    const R = mem.R, warn = mem.warn;
    const kit = { stages: [], H: null, E: null, R: null, I: null, O: null, Q: null, extras: [] };
    const mk = (cls, skill, g, levelKey, extra) => makeAct(mem, Object.assign({ cls, skillObj: skill, hits: g ? g.hits : [], levelKey,
      label: (skill ? skill.name : '') + (g && g.label && g.label !== '技能伤害' ? '·' + g.label : ''), labels: g ? [g.label] : null }, extra || {}));
    const sk = (t) => R.skills.filter((s) => s.type === t);
    for (const s of sk(1)) {
      const groups = groupHits(s);
      // 普攻第N段 / 普攻·<形态名>第N段（只取第一个形态，如 心「普攻·应世相」、爱弥斯「普攻·爱弥斯」）
      const formOf = (lab) => { const m = /^普攻·([^第·]{1,8})第/.exec(lab); return m ? m[1] : ''; };
      let form0 = null;
      const stages = groups.filter((g) => {
        if (!STAGE_RE.test(g.label)) return false;
        const f = formOf(g.label);
        const rest = f ? g.label.replace('普攻·' + f, '') : g.label.replace(/^普攻/, '');
        if (NOT_STAGE_RE.test(rest) || /空中|闪避|下落|重击|反击|强化/.test(f)) return false;
        if (form0 == null) form0 = f;
        return f === form0;
      });
      stages.forEach((g, i) => kit.stages.push(mk('A', s, g, 'basic', { key: 'A' + (i + 1), extra: { stage: i + 1 } })));
      const h = groups.find((g) => /重击/.test(g.label) && !/空中/.test(g.label));
      if (h) kit.H = mk('H', s, h, 'basic', { key: 'H' });
      groups.filter((g) => !stages.includes(g) && g !== h).forEach((g) => kit.extras.push(mk(g.hits[0].type === 'heavy' ? 'H' : 'A', s, g, 'basic', { durKey: 'X', extra: { extra: true } })));
    }
    if (!kit.stages.length && !(mem.modResolvesA)) warn.push({ level: 'warn', text: `${R.name}: 未识别普攻段落，A 动作不可用` });
    const firstOf = (t, cls, key) => {
      for (const s of sk(t)) {
        const gs = groupHits(s);
        const a = mk(cls, s, gs[0] || null, key, { key: cls, primary: true, cooldown: s.cooldown || 0 });
        if (t === 3) a.cost = R.energy.liberationCost || 0;
        gs.slice(1).forEach((x) => kit.extras.push(mk(cls, s, x, key, { durKey: 'X', extra: { extra: true } })));
        return a;
      }
      return null;
    };
    kit.E = firstOf(2, 'E', 'skill');
    kit.R = firstOf(3, 'R', 'liberation');
    kit.I = firstOf(5, 'I', 'intro');
    const o = sk(11)[0];
    if (o) kit.O = mk('O', o, { label: '延奏', hits: o.hits }, 'outro', { key: 'O', primary: true });
    for (const s of sk(6)) groupHits(s).forEach((g) => {
      const t0 = g.hits[0].type; const cls = t0 === 'heavy' ? 'H' : t0 === 'basic' ? 'A' : t0 === 'liberation' ? 'R' : 'E';
      kit.extras.push(mk(cls, s, g, 'forte', { durKey: 'X', extra: { extra: true, forte: true } }));
    });
    if (echoCfg && echoCfg.echoId) {
      const E = idx.echoes.get(echoCfg.echoId);
      if (E && E.skill) {
        const q = makeAct(mem, { key: 'Q', cls: 'Q', hits: E.skill.hits.filter((h) => h.damageId), levelKey: 'echo', level: echoCfg.rank || 5, cooldown: E.skill.cooldown, label: '声骸·' + E.name, extra: { echoId: E.id } });
        if (E.skill.confidence !== 'high') warn.push({ level: 'info', text: `${R.name}: 声骸 ${E.name} 技能命中有低置信项` });
        kit.Q = q;
      }
    }
    kit.extras.forEach((x, i) => { x.xid = 'X' + i; x.key = x.key || x.xid; });
    return kit;
  }

  // ------------------------------------------------------------------ action durations (frames file > config > module estimate > default)
  // ---- action frames ---------------------------------------------------------------------------
  // Two accepted shapes:
  //  (1) scraper file validation/action_frames.json: { sources[], characters: { "今汐（Jinhsi）": { "<类别>·<English label>": {duration_s, cancel_s,
  //      frames:{total, earliest_cancel, no_swap, swap?}, fps, source, version, notes} | null } }, missing[], discrepancies[] }
  //      Labels are mapped to engine action keys by FRAME_RULES (generic) + module `frames` maps (exact labels).
  //  (2) simple: { characters|chars|resonators: {<id|name|nameEn>: {actions: {<key>: seconds | {duration|seconds|frames, fps, source}}}} } or {entries:[...]}
  // Durations from (1) are community measurements (WuwaLAB, fps 60 assumed): est stays true, estSource/dur = 'frames'.
  // cancel_s = earliest cancel (NOT earliest swap); swap readiness uses SWAP_RULE below.
  const SWAP_RULE = { id: 'cancel', mech: 'unsolved', confidence: 'low',
    basis: '切人就绪 = max(no_swap, earliest_cancel)；无取消点（cancel_s=null）时取完整时长；离场动作的伤害全部计入。cancel_s 是最早取消帧而非最早切人帧，此规则为引擎假设，可用 config.swapRule = "full"（等动作结束）或 "swapTime"（max(no_swap, 9f)，wuwa-calc-site 默认）切换' };
  const frameIdxCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const FRAME_SKIP = /Mid-?Air|Dodge Counter|\(Hold\)|\s-\sS\d|Unison|\(Tap\)|Buffer/i;
  function isScraperShape(frames) {
    const c = frames && frames.characters;
    if (!c || typeof c !== 'object') return false;
    const first = Object.values(c)[0];
    return !!first && typeof first === 'object' && !first.actions && Object.keys(first).some((k) => k.includes('·'));
  }
  // per-source semantics (action_frames round 3):
  //   wuwalab  — total_frames/60 = full action; earliest_cancel; no_swap (est, community measurement)
  //   calc     — wuwa-calc-data actionDuration (frames @60, stated)
  //   wuwasim  — WuWaSim 3.6 client export: duration_s = stepDuration = time until the NEXT action can start (not the full animation);
  //              other timings in markers_s; cancel_s null → mapped to the engine's next-action/chain time; never mixed with WuwaLAB totals
  //   riley    — Riley31415/wuwa_calc animFrames (unknown provenance/version) → low confidence
  function frameSrcKind(label, e) {
    const src = (e && e.source) || '';
    if (/WuWaSim/.test(label) || /WuWaSim/.test(src)) return 'wuwasim';
    if (/Riley31415/.test(label) || /Riley31415/.test(src)) return 'riley';
    if (/wuwa-calc-data/.test(label) || /wuwa-calc-data/.test(src)) return 'calc';
    return 'wuwalab';
  }
  const FRAME_SRC_ZH = { wuwalab: 'WuwaLAB 实测总帧', calc: 'wuwa-calc-data actionDuration', wuwasim: 'WuWaSim 3.6 客户端导出（可接下一动作时刻）', riley: 'Riley31415/wuwa_calc（版本/出处未知，低置信）' };
  const FRAME_SRC_RANK = { wuwalab: 0, calc: 1, wuwasim: 2, riley: 3 };
  function frameEntry(label, e) {
    if (!e) return { label, missing: true, reason: '源数据该项为 null（来源冲突或缺失）', srcKind: frameSrcKind(label, null) };
    const kind = frameSrcKind(label, e);
    if (kind === 'wuwasim') {
      const mk = e.markers_s || {};
      const out = { label, duration: e.duration_s, cancel: null, timeStop: mk.freezeTime > 0 ? mk.freezeTime : null, noSwap: null, swapAt: null, nextAction: true,
        markers: mk, source: e.source || null, version: e.version || null, srcKind: kind, calcData: false };
      if (e.duration_s == null) { out.missing = true; out.reason = (e.notes || 'WuWaSim stepDuration 为 null').slice(0, 160); }
      return out;
    }
    const fps = e.fps || 60;
    const fr = e.frames || {};
    // prefer exact frames/fps over the 4-decimal rounded seconds
    const dur = e.duration_s == null ? null : (fr.total > 0 ? fr.total / fps : e.duration_s);
    const cancel = e.cancel_s == null ? null : (typeof fr.earliest_cancel === 'number' ? fr.earliest_cancel / fps : e.cancel_s);
    const ts = Array.isArray(fr.time_stop) && fr.time_stop.length === 2 ? Math.max(0, fr.time_stop[1] - fr.time_stop[0]) / fps : 0;
    const out = { label, duration: dur, cancel, timeStop: ts > 0 ? ts : null,
      // MECH.timeStop (WuWaSim toa): non-liberation time stops only count when the entry carries a measured-source flag
      tsVerified: e.tsVerified ? (typeof e.tsVerified === 'string' ? e.tsVerified : (e.tsSource || true)) : null,
      noSwap: fr.no_swap != null ? fr.no_swap / fps : null, swapAt: fr.swap_resolved != null ? fr.swap_resolved / fps : null,
      source: e.source || null, version: e.version || null, calcData: /\[wuwa-calc-data\]/.test(label), srcKind: kind,
      lowConf: kind === 'riley' ? 'Riley31415/wuwa_calc：未注明游戏版本与帧数出处（源仓库称取自 WuwaLAB 或用户粘贴的帧数表）' : null };
    if (dur == null) { out.missing = true; out.reason = (e.notes || '源数据 duration 为 null').slice(0, 160); }
    else if (/核对：不一致|内部矛盾/.test(e.notes || '')) {
      // conflicting sources (散华: WuwaLAB vs wuwa-calc-data) or internally inconsistent entry (漂泊者·导电 Skill 2) → treat as null
      out.missing = true; out.conflict = true; out.sourceDuration = dur;
      out.reason = /内部矛盾/.test(e.notes) ? '源数据内部矛盾（earliest_cancel > total）' : `两个来源不一致（WuwaLAB ${round(dur, 3)}s vs wuwa-calc-data）`;
    }
    return out;
  }
  function indexScraperFrames(frames) {
    const byName = new Map();
    for (const [cname, acts] of Object.entries(frames.characters || {})) {
      const m = /^(.+?)（(.+)）$/.exec(cname);
      const zh = m ? m[1] : cname, en = m ? m[2] : null;
      const labels = {};
      for (const [lab, e] of Object.entries(acts || {})) labels[lab] = frameEntry(lab, e);
      // generic mapping: first matching label in file order; WuwaLAB entries preferred over [wuwa-calc-data] ones
      const generic = {};
      // source priority WuwaLAB > wuwa-calc-data > WuWaSim > Riley; one source per character for the generic map (never mix口径)
      const rank = (l) => FRAME_SRC_RANK[labels[l].srcKind] || 0;
      const order = Object.keys(labels).sort((a, b) => rank(a) - rank(b));
      const kinds = [...new Set(order.filter((l) => !labels[l].missing).map((l) => labels[l].srcKind))];
      const primary = kinds[0] || 'wuwalab';
      let family = null;
      for (const lab of order) {
        if (labels[lab].srcKind !== primary && labels[lab].srcKind !== 'calc' && primary !== 'calc') continue;
        if (labels[lab].srcKind === 'calc' && primary === 'wuwasim') continue;
        const clean = lab.replace(/\s*\[[^\]]+\]$/, '');
        if (FRAME_SKIP.test(clean)) continue;
        const dot = clean.indexOf('·'); const cat = dot >= 0 ? clean.slice(0, dot) : ''; const rest = dot >= 0 ? clean.slice(dot + 1) : clean;
        let mm;
        if (labels[lab].srcKind === 'wuwasim') {
          if (cat === '普攻' && (mm = /^basic_(\d)$/.exec(rest))) { if (!generic['A' + mm[1]]) generic['A' + mm[1]] = lab; }
          else if (cat === '重击' && /^heavy_heavy_attack$/.test(rest)) { if (!generic.H) generic.H = lab; }
          else if (cat === '共鸣技能' && /^skill/.test(rest)) { if (!generic.E) generic.E = lab; }
          else if (cat === '共鸣解放' && /^liberation$/.test(rest)) { if (!generic.R) generic.R = lab; }
          else if (cat === '变奏入场' && /^intro$/.test(rest)) { if (!generic.I) generic.I = lab; }
          continue;
        }
        if (cat === '普攻' && (mm = /^Basic: (.+?) (\d)$/.exec(rest) || /^Basic - (.+?) (\d)$/.exec(rest) || /^Basic Attack (\d)/.exec(rest))) {
          const fam = mm.length > 2 ? mm[1] : '*'; const n = +(mm.length > 2 ? mm[2] : mm[1]);
          if (family == null) family = fam;
          if (fam === family && !generic['A' + n]) generic['A' + n] = lab;
        } else if ((cat === '重击' && /^Heavy/.test(rest)) || (cat === '普攻' && /^Heavy Attack/.test(rest))) { if (!generic.H) generic.H = lab; }
        else if (cat === '共鸣技能' && /^Skill/.test(rest)) { if (!generic.E) generic.E = lab; }
        else if (cat === '共鸣解放' && /^Liberation( -|:)/.test(rest)) { if (!generic.R) generic.R = lab; }
        else if (cat === '变奏入场' && /^Intro( -|:)/.test(rest)) { if (!generic.I) generic.I = lab; }
        else if (cat === '延奏') { if (!generic.O) generic.O = lab; }
      }
      const rec = { name: zh, en, labels, generic, primary, kinds, key: cname };
      byName.set(zh, rec); if (en) byName.set(en, rec);
    }
    // echo skill frames (top-level `echoes`): numbered parts (燎照之骑 1/2/3) are summed into one Q action
    const echoes = new Map();
    for (const [ename, acts] of Object.entries(frames.echoes || {})) {
      const m = /^(.+?)（(.+)）$/.exec(ename);
      const ents = Object.entries(acts || {}).map(([l, e]) => frameEntry(l, e)).filter((x) => !x.missing && x.duration != null);
      if (!ents.length) continue;
      const rec = { label: ents.map((x) => x.label).join(' + '), duration: ents.reduce((a, x) => a + x.duration, 0), cancel: ents.length === 1 ? ents[0].cancel : null,
        swapAt: ents[ents.length - 1].swapAt, noSwap: null, srcKind: ents[0].srcKind, source: ents[0].source, version: ents[0].version, parts: ents.length, lowConf: ents[0].lowConf || null };
      echoes.set(m ? m[1] : ename, rec); if (m) echoes.set(m[2], rec);
    }
    const disc = (frames.discrepancies || []).filter((x) => x && (x.character || x.echo));
    const src = (frames.sources || [])[0] || {};
    return { scraper: true, byName, source: src.name || frames.source || 'action_frames', version: frames.target_version || frames.version || null,
      missing: (frames.missing || []).map((x) => x.character || x), echoes, disc };
  }
  function framesIndex(frames) {
    if (!frames) return null;
    if (frameIdxCache && frameIdxCache.has(frames)) return frameIdxCache.get(frames);
    const ix = isScraperShape(frames) ? indexScraperFrames(frames) : { scraper: false, raw: frames };
    if (frameIdxCache) frameIdxCache.set(frames, ix);
    return ix;
  }
  // returns {duration, cancel, noSwap, source, version, label} | {missing, reason, label} | null (character/action not covered)
  function frameLookup(frames, R, keys, modMap) {
    const ix = framesIndex(frames);
    if (!ix) return null;
    if (ix.scraper) {
      const c = ix.byName.get(R.name) || (R.nameEn && ix.byName.get(R.nameEn));
      if (!c) return { noChar: true, reason: `action_frames 无此角色（${R.name}）` };
      for (const k of keys) {
        const want = (modMap && modMap[k]) || c.generic[k] || (c.labels[k] ? k : null);
        if (!want) continue;
        // module frames map: an array of labels = one engine action made of several source actions (durations summed; cancel/noSwap from the last part)
        if (Array.isArray(want)) {
          const es = want.map((l) => c.labels[l]);
          if (es.some((e) => !e || e.missing || e.duration == null)) continue;
          const pre = es.slice(0, -1).reduce((x, e) => x + e.duration, 0), last = es[es.length - 1];
          return Object.assign({ source: last.source || ix.source, version: last.version || ix.version }, last, {
            duration: pre + last.duration, cancel: last.cancel != null ? pre + last.cancel : null, noSwap: last.noSwap != null ? pre + last.noSwap : null,
            // one animation's freeze counts once (WuWaSim resolveFreezeSchedule): max over parts, not the sum
            timeStop: es.reduce((x, e) => Math.max(x, e.timeStop || 0), 0) || null, tsVerified: es.find((e) => e.tsVerified) ? es.find((e) => e.tsVerified).tsVerified : null,
            label: want.join(' + '), parts: es.length });
        }
        const lab = want instanceof RegExp ? Object.keys(c.labels).find((l) => want.test(l)) : want;
        const e = lab && c.labels[lab];
        if (!e) continue;
        return Object.assign({ source: e.source || ix.source, version: e.version || ix.version }, e);
      }
      return null;
    }
    const root = frames.characters || frames.chars || frames.resonators || null;
    let c = root ? (root[R.id] || root[String(R.id)] || root[R.name] || (R.nameEn && root[R.nameEn])) : null;
    if (!c && Array.isArray(frames.entries)) {
      const es = frames.entries.filter((e) => e.charId === R.id || e.id === R.id || e.name === R.name || e.char === R.name);
      if (es.length) { c = {}; for (const e of es) c[e.action || e.key] = e; }
    }
    if (!c) return null;
    const acts = c.actions || c;
    for (const k of keys) {
      const v = acts[k];
      if (v == null) continue;
      if (typeof v === 'number') return { duration: v, source: c.source || frames.source || 'action_frames', version: frames.version };
      const d = v.duration != null ? v.duration : v.seconds != null ? v.seconds : v.frames != null ? v.frames / (v.fps || c.fps || frames.fps || 60) : null;
      if (d != null) return { duration: d, cancel: v.cancel != null ? v.cancel : null, noSwap: v.noSwap != null ? v.noSwap : null, source: v.source || c.source || frames.source || 'action_frames', version: v.version || c.version || frames.version };
    }
    return null;
  }
  function echoFrames(ctx, act) {
    const ix = framesIndex(ctx.frames);
    const eid = (act.extra && act.extra.echoId) || act.echoId;
    if (!ix || !ix.scraper || !ix.echoes || !eid) return null;
    const E = ctx.idx.echoes.get(eid);
    return (E && (ix.echoes.get(E.name) || (E.nameEn && ix.echoes.get(E.nameEn)))) || null;
  }
  function applyDuration(ctx, mem, act) {
    // module-specific actions (key ≠ button class) must not inherit the generic class duration (e.g. 神霓飞芒 ≠ E)
    const own = act.module && act.key && act.key !== act.cls;
    const keys = [...new Set([act.key, act.durKey, act.cls === 'A' && act.stage ? 'A' + act.stage : null, act.extra || own ? null : act.cls].filter(Boolean))];
    const user = Object.assign({}, ctx.cfg.durations || {}, (mem.cfg && mem.cfg.durations) || {});
    act.cancel = null; act.noSwap = null; act.durReason = null; act.frameLabel = null; act.timeStop = null;
    for (const k of keys) if (user[k] != null) { act.duration = user[k]; act.durSource = 'config'; act.est = false; return; }
    const modMap = mem.mod && mem.mod.frames ? mem.mod.frames : null;
    // echo skills are never taken from frames (team decision: echo durations stay default)
    // echo skills: only the echoes listed in action_frames.echoes (round 3: 5 echoes); others stay default
    // stream B B2: module frames map `KEY: null` = do not use frame data for this action (module dur)
    const optOut = modMap && keys.some((k) => Object.prototype.hasOwnProperty.call(modMap, k) && modMap[k] === null);
    const f = optOut ? null : act.cls === 'Q' ? echoFrames(ctx, act) : frameLookup(ctx.frames, mem.R, act.cls === 'O' ? ['O'] : keys, modMap);
    if (optOut && act.defDur != null) { act.duration = act.defDur; act.durSource = 'module-estimate'; act.est = true; act.durReason = '模块声明不取帧数据（frames.' + keys.find((k) => modMap[k] === null) + '=null）；使用模块估计值'; return; }
    if (f && !f.missing && !f.noChar && f.duration != null) {
      act.duration = f.duration; act.durSource = 'frames'; act.durRef = (f.source || '') + (f.version ? ' @' + f.version : '');
      act.cancel = f.cancel; act.noSwap = f.noSwap; act.frameLabel = f.label || null; act.timeStop = f.timeStop || null;
      act.frameSrc = f.srcKind || 'wuwalab'; act.frameSrcZh = FRAME_SRC_ZH[act.frameSrc] || null; act.nextAction = !!f.nextAction;
      act.frameLow = f.lowConf || null;
      if (f.parts > 1) act.durNote = (act.cls === 'Q' ? '声骸 ' : '模块组合 ') + f.parts + ' 段动作时长相加';
      // stream B B1 / MECH.timeStop (default 'exclude'): time-stop frames do not consume fight time (all timers frozen); 'include' = old behaviour
      // WuWaSim `toa` semantics: only energy-consuming liberation main cutscenes freeze the fight clock by default;
      // other time stops (forte circuit, tune break, 圆舞曲, 洞悉 …) count full duration unless the frame entry / module act carries tsVerified (measured source)
      act.tsEligible = act.timeStop > 0 ? ((act.cls === 'R' && act.cost > 0) || !!f.tsVerified || !!act.tsVerified || ctx.cfg.timeStopScope === 'all') : false; // timeStopScope:'all' = pre-17:20 behaviour (comparison only)
      act.tsBasis = act.timeStop > 0 ? (act.cls === 'R' && act.cost > 0 ? 'liberation' : (f.tsVerified || act.tsVerified) ? 'verified:' + (f.tsVerified || act.tsVerified) : 'not-liberation') : null;
      if ((ctx.cfg.timeStop || 'exclude') === 'exclude' && act.timeStop > 0 && act.tsEligible && act.duration > 0 && f.srcKind !== 'wuwasim') {
        act.durationFull = act.duration; act.duration = Math.max(0.05, act.duration - act.timeStop);
        if (act.cancel != null) act.cancel = Math.max(0, Math.min(act.cancel, act.duration));
        if (act.noSwap != null) act.noSwap = Math.max(0, Math.min(act.noSwap, act.duration));
      }
      act.est = framesIndex(ctx.frames).scraper ? true : false; // community measurements stay est:true
      return;
    }
    if (act.cls === 'O') {
      // outro: source gives total_frames 0 / null → occupies no time on the outgoing side
      act.duration = 0; act.durSource = 'default'; act.est = true;
      act.durReason = f && (f.missing) ? '延奏在源数据中为 null（不占独立动作时间），按 0 s 处理（引擎假设）' : '延奏按 0 s 处理（引擎假设）';
      return;
    }
    let reason;
    if (!ctx.frames) reason = '未加载 action_frames.json';
    else if (act.cls === 'Q') reason = '声骸技能：action_frames.echoes 未收录该声骸（默认值）';
    else if (f && f.noChar) reason = f.reason;
    else if (f && f.missing) { reason = `action_frames「${f.label}」：${f.reason}`; ctx._frameNull = ctx._frameNull || []; ctx._frameNull.push({ member: mem.idx, char: mem.R.name, key: act.key, label: f.label, reason: f.reason }); }
    else reason = `action_frames 未覆盖动作 ${act.key || act.cls}`;
    if (act.defDur != null) { act.duration = act.defDur; act.durSource = 'module-estimate'; act.est = true; act.durReason = reason + '；使用模块估计值'; return; }
    const dk = act.extra ? 'X' : act.cls;
    act.duration = DEFAULT_DURATIONS[dk] != null ? DEFAULT_DURATIONS[dk] : DEFAULT_DURATIONS.X;
    act.durSource = 'default'; act.est = true; act.durReason = reason + `；默认 ${act.duration}s`;
  }
  // swap readiness after an action started at t0 (seconds from action start)
  // view label for duration provenance: 'frames' (action_frames) | 'config' (user override) | 'default' (default / module estimate)
  function durKind(a) { if (!a || a.cls === 'W') return null; return a.durSource === 'frames' ? 'frames' : a.durSource === 'config' ? 'config' : 'default'; }
  function swapReadyOf(ctx, act) {
    if (!act || act.duration == null) return null;
    const rule = ctx.cfg.swapRule || SWAP_RULE.id;
    if (rule === 'full' || act.durSource !== 'frames') return act.duration;
    const ns = act.noSwap || 0;
    if (rule === 'swapTime') return Math.min(act.duration, Math.max(ns, 9 / 60));
    return Math.min(act.duration, Math.max(ns, act.cancel != null ? act.cancel : act.duration));
  }

  // ------------------------------------------------------------------ character modules (engine/chars/*.js register here)
  const CHARS = new Map();
  /**
   * Character module interface (see engine/chars/README.md):
   * { id, name, version, confidence, notes[],
   *   resources: [{key, name, max, segmented, get?(cs)}],
   *   kit(H) -> {key: actTemplate}            (H = helper: R, mem, kit, act(spec), param(), buff(def), patchBuff(), chain, weaponId, opts)
   *   init(api) -> cs                          (per-character mutable state; plain JSON)
   *   resolve(api, button) -> {act, meta} | {blocked: reason} | null      buttons: A H E R Q I O
   *   apply(api, act, meta)                    state transitions after the action's damage
   *   actionStats(api, act, meta) -> stats[]   per-action extra stats (stack-dependent bonuses)
   *   auras(api, targetMi) -> stats[]          stats this member provides to targetMi right now (fields, off-field auras)
   *   onTeam(api, ev)                          ev: {type:'damage'|'intro'|'outro'|'swap', mi, el, coord, t, dur, act}
   *   swapOut(api, toMi) -> {force}            force outro/intro without full concerto (e.g. 今汐 同奏)
   *   onOutro(api, toMi)                       owner-specific outro side effects
   *   potential(api) -> number                 search heuristic: damage-equivalent of stored resources
   *   hold(api, act, remaining) -> reason|null  search only (B12a): drop a weaker finisher while its strong version is reachable in time
   * }
   */
  function registerChar(mod) { if (!mod || !mod.id) throw new Error('module needs id'); CHARS.set(mod.id, mod); return mod; }
  function getChar(id) { return CHARS.get(id) || null; }
  function listChars() { return [...CHARS.values()].map((m) => ({ id: m.id, name: m.name, version: m.version, confidence: m.confidence })); }

  function moduleHelper(mem, idx, ctxOpts) {
    const R = mem.R;
    const lv = Object.assign({}, SKILL_LV_DEFAULT, (mem.cfg && mem.cfg.skillLevels) || {});
    const skillSel = (sel) => (typeof sel === 'number' && sel < 100 ? R.skills.find((s) => s.type === sel) : R.skills.find((s) => s.id === sel));
    const H = {
      R, mem, kit: mem.kit, chain: mem.chain || 0, weaponId: mem.weapon ? mem.weapon.id : null, weaponRank: (mem.cfg.weapon && mem.cfg.weapon.rank) || 1,
      opts: (mem.cfg && mem.cfg.module) || {}, level: lv,
      act: (spec) => makeAct(mem, Object.assign({ module: true }, spec)),
      skill: skillSel,
      /** numeric value of a description param at the given skill level (first number; % → fraction) */
      param: (sel, label, levelKey) => {
        const s = skillSel(sel); const p = s && (s.params || []).find((x) => x.label === label);
        if (!p) return null;
        const v = String(p.values[Math.min(p.values.length - 1, (lv[levelKey || 'skill'] || 1) - 1)] || p.values[0]);
        const m = /(-?\d+(?:\.\d+)?)(%?)/.exec(v); if (!m) return null;
        return m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
      },
      findBuff: (pred) => mem.buffDefs.filter(pred),
      /** override a parsed buff: patch {trigger, mode, stats, ...} */
      patchBuff: (pred, patch, why) => {
        const bs = mem.buffDefs.filter(pred);
        for (const b of bs) { Object.assign(b, typeof patch === 'function' ? patch(b) : patch); b.lowReason = why || b.lowReason; b.patchedBy = 'module'; }
        return bs.length;
      },
      /** module-defined buff (fired by trigger or api.fireBuff) */
      buff: (def) => {
        const b = Object.assign({ kind: 'module', owner: mem.idx, target: 'self', maxStacks: 1, endsOnSwap: false, unmodeled: false, mode: 'auto',
          mech: 'community', confidence: 'medium', basis: '角色模块：' + R.name }, def);
        b.id = 'm' + mem.idx + '_' + def.id; b.name = def.name || statLabel(def.stats[0].key);
        mem.buffDefs.push(b); return b;
      },
      buffId: (local) => 'm' + mem.idx + '_' + local,
    };
    return H;
  }

  // ------------------------------------------------------------------ context
  function defaultConfig() {
    return {
      duration: 25, mode: 'expected', conditionals: 'auto',
      enemy: { level: 90, resTier: 0.1, resShred: 0, enemyId: null, defIgnore: 0, defReduce: 0, dmgReduce: 0 },
      team: [], rotation: { mode: 'search', sequence: '', start: 0, onBlocked: 'wait' },
      search: Object.assign({}, DEFAULT_SEARCH), start: { energy: 0, concerto: 0 }, modules: true, endCredit: 'prorate',
    };
  }

  function buildContext(config, data) {
    const idx = ensureIndex(data);
    const d = defaultConfig();
    const cfg = Object.assign(d, JSON.parse(JSON.stringify(Object.assign({}, config || {}, { actionFrames: undefined }))));
    cfg.enemy = Object.assign(defaultConfig().enemy, (config && config.enemy) || {});
    cfg.search = Object.assign({}, DEFAULT_SEARCH, (config && config.search) || {});
    cfg.start = Object.assign({ energy: 0, concerto: 0 }, (config && config.start) || {});
    cfg.rotation = Object.assign(defaultConfig().rotation, (config && config.rotation) || {});
    if (!cfg.team || !cfg.team.length) throw new Error('config.team is empty');
    if (cfg.team.length > 3) throw new Error('team size > 3');
    if (!(cfg.duration > 0)) throw new Error('duration must be > 0');
    const opts = { conditionals: cfg.conditionals, buffOverrides: cfg.buffOverrides, durations: cfg.durations, substatTiers: cfg.substatTiers || (config && config.substatTiers) || null };
    const warnings = [];
    const ctx = { cfg, idx, enemy: null, duration: cfg.duration, mode: cfg.mode || 'expected', warnings, search: cfg.search, bd: new Map(),
      frames: (config && config.actionFrames) || null, estCache: new Map() };
    const members = cfg.team.map((m, i) => {
      const mod0 = cfg.modules === false || m.module === false ? null : getChar(m.id);
      let mem = assembleMember(m, idx, opts, i);
      // 共鸣链覆盖（lead 16:41）：chainModeled = max(模块声明 chainModeled, 通用解析从 1 链起连续可建模的链数)；配置链数更高时按 chainModeled 计算并告警
      const chainCfg = Math.max(0, Math.min(6, m.chain || 0));
      const gen = genericChainCoverage(mem, idx, i);
      const chainModeled = Math.max(mod0 && mod0.chainModeled != null ? mod0.chainModeled : 0, gen);
      if (mod0 && chainCfg > chainModeled) {
        mem = assembleMember(Object.assign({}, m, { chain: chainModeled }), idx, opts, i);
        mem.warn.push({ level: 'warn', code: 'chain-unmodeled', mech: 'unsolved', chainModeled, chainCfg,
          text: `${mem.R.name}: 共鸣链未建模，按 ${chainModeled} 链计算（配置 ${chainCfg} 链；第 ${chainModeled + 1 === chainCfg ? chainCfg : (chainModeled + 1) + "–" + chainCfg} 链效果未计入）` });
      }
      mem.chainModeled = mod0 ? chainModeled : null; mem.chainCfg = chainCfg; mem.chainGeneric = gen;
      mem.cfg = m; mem.idx = i;
      mem.modResolvesA = !!(mod0 && mod0.resolve);
      mem.kit = buildKit(mem, m, (m.echoes || [])[0], idx);
      // stream B B3: 幽夜隐匿之帷 5 件「角色触发延奏技能离场时，额外对周围敌人造成480%的湮灭伤害，该伤害为延奏技能伤害」→ extra outro row
      const veil = (mem.sonataActive || []).find((x) => x.id === 12 && x.pieces >= 5);
      if (veil) {
        const S12 = idx.sonatas.get(12), pv = S12 && S12.pieces['5'] && S12.pieces['5'].params ? parseFloat(S12.pieces['5'].params[0]) / 100 : 4.8;
        mem.veilAct = { key: 'veil', cls: 'O', label: '幽夜隐匿之帷 5件·延奏伤害', level: 1, levelKey: 'outro', energy: 0, concerto: 0, cooldown: 0, duration: 0,
          hits: [{ label: '幽夜隐匿之帷 5件 延奏伤害', multiplier: [pv || 4.8], count: 1, element: 'havoc', type: 'outro', scaling: 'atk',
            confidence: 'medium', lowReason: '套装文本「480%的湮灭伤害，该伤害为延奏技能伤害」→ 引擎补行（stream B B3）' }] };
      }
      mem.mod = mod0;
      mem.staCost = heavyStaminaCost(mem);
      if (mem.mod) {
        mem.H = moduleHelper(mem, idx, opts);
        mem.modKit = mem.mod.kit ? mem.mod.kit(mem.H) || {} : {};
        for (const [k, a] of Object.entries(mem.modKit)) if (a) a.key = a.key || k;
      }
      return mem;
    });
    ctx.members = members;
    // search terminal value (残值引导): 'auto' = on for teams. Search heuristic only — reported damage never includes it.
    const rs = cfg.search.residual == null ? 'auto' : cfg.search.residual;
    ctx.residualOn = rs === 'auto' ? members.length > 1 : !!rs;
    ctx.residualReason = rs === 'auto' ? (members.length > 1 ? '队伍配置默认开启（search.residual=auto）：窗口外仍生效的增益按剩余时长×对队友的每秒价值计入搜索目标' : null)
      : (rs ? '配置 search.residual=true' : null);
    for (const mem of members) {
      const all = [...mem.kit.stages, mem.kit.H, mem.kit.E, mem.kit.R, mem.kit.I, mem.kit.O, mem.kit.Q, ...mem.kit.extras, ...Object.values(mem.modKit || {})].filter(Boolean);
      for (const a of all) applyDuration(ctx, mem, a);
      // buff overrides again (module-created buffs) + autoOff flag
      const ov = opts.buffOverrides || {};
      for (const b of mem.buffDefs) {
        if (ov[b.id]) b.mode = ov[b.id];
        b.autoOff = b.mode === 'off' && !b.unmodeled && b.trigger && b.trigger.on === 'manual' && !ov[b.id];
      }
      warnings.push(...mem.warn.map((w) => Object.assign({ member: mem.idx }, w)));
    }
    const en = cfg.enemy;
    const enemy = { level: en.level, resTier: en.resTier == null ? 0.1 : en.resTier, resShred: en.resShred || 0, defIgnore: en.defIgnore || 0,
      defReduce: en.defReduce || 0, dmgReduce: en.dmgReduce || 0, damageTaken: en.damageTaken || 0, defOverride: en.def == null ? null : en.def, resByElement: null, name: '木桩' };
    if (en.enemyId) {
      const E = idx.enemies.get(en.enemyId);
      if (!E) throw new Error('unknown enemy id ' + en.enemyId);
      enemy.name = E.name;
      if (E.res) enemy.resByElement = Object.assign({}, E.res);
      else warnings.push({ level: 'warn', text: `敌人 ${E.name} 无属性数据，使用 resTier` });
    }
    if (en.resByElement) enemy.resByElement = Object.assign({}, enemy.resByElement || {}, en.resByElement);
    if (enemy.resShred > 1.5) enemy.resShred /= 100;
    ctx.enemy = enemy;
    members.forEach((m) => m.buffDefs.forEach((b) => ctx.bd.set(b.id, b)));
    const noMod = members.filter((m) => !m.mod);
    ctx.searchable = !noMod.length || !!cfg.search.force;
    ctx.searchReason = noMod.length ? `${noMod.map((m) => m.R.name).join('、')} 暂无角色模块（专属资源/强化动作未建模），自动搜索已禁用，仅支持手动序列` : null;
    // anomaly tables (ww.json anomalies; absent in old data → anomaly layer tracks stacks only, no damage)
    ctx.anom = idx.ww.anomalies || null;
    if (!ctx.anom) warnings.push({ level: 'warn', code: 'anomaly-data', text: 'ww.json 无 anomalies 表（旧数据），异常效应只记层数、不计伤害' });
    const sc = cfg.stamina === false ? { enabled: false } : Object.assign({}, STAMINA_DEFAULT, cfg.stamina || {});
    ctx.stamina = sc;
    // per-member sustained filler rate + representative filler (search heuristics: buff/outro valuation)
    ctx.rep = members.map((mem, i) => {
      const cands = [...mem.kit.stages, mem.kit.H].filter(Boolean).concat(Object.values(mem.modKit || {}).filter((a) => a && (a.cls === 'A' || a.cls === 'H') && a.hits && a.hits.length));
      let best = null, br = 0;
      for (const a of cands) { const r = estimate(ctx, i, a) / Math.max(0.1, a.durationFull || a.duration || 0.5); if (r > br) { br = r; best = a; } }
      return { act: best, rate: br };
    });
    ctx.rate = ctx.rep.map((r) => r.rate);
    ctx.buffGainCache = new Map();
    ctx.potential = members.map((mem, i) => ({
      // value of a full energy bar: the module's own R when it has one (transform R with no hits → 0; the module's potential() values the form)
      R: mem.mod && mem.mod.energyValue ? mem.mod.energyValue(ctx, i, (a) => estimate(ctx, i, a)) : ((mem.modKit && mem.modKit.R) || mem.kit.R) ? estimate(ctx, i, (mem.modKit && mem.modKit.R) || mem.kit.R) : 0,
      // solo: concerto never converts into intro/outro → no potential
      IO: members.length < 2 ? 0 : (mem.kit.I ? estimate(ctx, i, mem.kit.I) : 0) + (mem.kit.O ? estimate(ctx, i, mem.kit.O) : 0) + outroBuffValue(ctx, i),
    }));
    // sustained filler rate (time-normalisation of the search heuristic). A module may name its real filler actions (mod.fillerKeys):
    // the generic kit.H can be a special heavy the module never uses as filler (心: 重击·应世相·闲中御 ≈ 6× the real 重击 rate → 转相 never searched)
    const fillerOf = (mem) => (mem.mod && mem.mod.fillerKeys && mem.modKit ? mem.mod.fillerKeys.map((k) => mem.modKit[k]) : [...mem.kit.stages, mem.kit.H]).filter(Boolean);
    ctx.baseRate = Math.max(0, ...members.map((mem, i) => Math.max(0, ...fillerOf(mem).map((a) => estimate(ctx, i, a) / Math.max(0.1, a.durationFull || a.duration)))));
    return ctx;
  }

  function scaledHits(act) {
    if (!act.scale) return act.hits;
    return act.hits.map((h) => {
      const sc = act.scale[h.label] != null ? act.scale[h.label] : act.scale['*'];
      return sc == null || sc === 1 ? h : Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * sc), flatAdd: h.flatAdd ? h.flatAdd.map((x) => x * sc) : h.flatAdd });
    });
  }
  function actionDamage(ctx, mi, act, buffStats, withParts, times) {
    const mem = ctx.members[mi];
    const panel = finalPanel(mem, buffStats);
    if (act.forceCrit) panel.critRate = 1;
    const k = times || 1;
    let expected = 0, crit = 0, noncrit = 0, heal = 0;
    const parts = [];
    for (const h of scaledHits(act)) {
      const r = resolveHit({ panel, hit: h, level: act.level, attackerLevel: mem.level, enemy: ctx.enemy, mode: ctx.mode });
      expected += r.total.expected * k; crit += r.total.crit * k; noncrit += r.total.noncrit * k; heal += (r.heal || 0) * k;
      if (withParts) parts.push({ hit: h, r, times: k });
    }
    const value = ctx.mode === 'crit' ? crit : ctx.mode === 'noncrit' ? noncrit : expected;
    return { value, expected, crit, noncrit, heal, parts, panel };
  }
  /** static (no buffs) damage estimate, cached — used by search heuristics and modules */
  function estimate(ctx, mi, act) {
    if (!act) return 0;
    // key includes label + hit signature: a module action may share its key with a generic kit action (e.g. module R ≠ kit.R)
    const key = mi + '|' + (act.key || act.label) + '|' + (act.label || '') + '|' + (act.hits || []).map((h) => (h.label || '') + '*' + (h.count || 1)).join(',') + '|' + JSON.stringify(act.scale || '') + '|' + (act.level || '');
    if (!ctx.estCache.has(key)) ctx.estCache.set(key, actionDamage(ctx, mi, act, []).value);
    return ctx.estCache.get(key);
  }

  /** fractional damage gain of member j's representative filler from a buff (search heuristic only) */
  function buffGain(ctx, j, id, stacks) {
    const k = j + '|' + id + '|' + stacks;
    if (ctx.buffGainCache.has(k)) return ctx.buffGainCache.get(k);
    const b = ctx.bd.get(id), rep = ctx.rep[j] && ctx.rep[j].act;
    let g = 0;
    if (b && rep && b.stats.length) {
      const base = estimate(ctx, j, rep);
      if (base > 0) g = Math.max(0, actionDamage(ctx, j, rep, b.stats.map((x) => ({ key: x.key, value: x.value * (stacks || 1) }))).value / base - 1);
    }
    ctx.buffGainCache.set(k, g);
    return g;
  }
  /** relative damage gain of extra stats on member j's representative filler (cached) */
  function statGain(ctx, j, stats) {
    const k = j + '|s|' + JSON.stringify(stats);
    if (ctx.buffGainCache.has(k)) return ctx.buffGainCache.get(k);
    const rep = ctx.rep[j] && ctx.rep[j].act;
    let g = 0;
    if (rep && stats.length) { const base = estimate(ctx, j, rep); if (base > 0) g = Math.max(0, actionDamage(ctx, j, rep, stats).value / base - 1); }
    ctx.buffGainCache.set(k, g);
    return g;
  }
  /** search heuristic helper for modules: damage-equivalent of `stats` on the best other member (or `who`) for `dur` seconds */
  function teamStatValue(ctx, mi, stats, dur, who) {
    let best = 0;
    ctx.members.forEach((_, j) => {
      if (who === 'others' && j === mi) return;
      best = Math.max(best, (ctx.rate[j] || 0) * statGain(ctx, j, stats));
    });
    return best * Math.max(0, dur);
  }
  /**
   * MECH.residual (rate calibration, search heuristic): buff/state values use each member's sustained filler rate, which undervalues
   * buffs that cover burst windows (R/强化态). Opt-in (search.calibrate=true; off by default — inflated residual and destabilised presets in tests): re-search once with each member's realised damage per on-field second from a first
   * search (clamped to [filler, 3× filler]). Affects ranking only.
   */
  function realizedRates(ctx, st) {
    const on = ctx.members.map(() => 0);
    for (const g of timelineOf(st)) for (const a of (Array.isArray(g) ? g : [g])) if (a && !a.status && !a.coord && a.cls !== 'O' && a.cls !== 'S' && a.endT != null) on[a.mi] += Math.max(0, Math.min(a.endT, ctx.duration) - a.t);
    return ctx.members.map((_, i) => { const f = ctx.rate[i] || 0; const r = on[i] > 1 ? (st.perMember[i] || 0) / on[i] : f; return Math.max(f, Math.min(3 * f, r)); });
  }
  function calibrateRates(ctx, rates) {
    ctx.rateFiller = ctx.rate.slice();
    ctx.rate = rates.slice();
    ctx.potential.forEach((p, i) => { if (ctx.members.length > 1) p.IO = (ctx.members[i].kit.I ? estimate(ctx, i, ctx.members[i].kit.I) : 0) + (ctx.members[i].kit.O ? estimate(ctx, i, ctx.members[i].kit.O) : 0) + outroBuffValue(ctx, i); });
  }
  /** search heuristic: damage-equivalent of member i's outro buffs on the others (applied when its concerto is spent) */
  function outroBuffValue(ctx, i) {
    let v = 0;
    for (const b of ctx.members[i].buffDefs) {
      if (b.kind !== 'outro' || b.unmodeled || b.mode === 'off' || !b.stats.length) continue;
      const dur = Math.min(b.duration || 10, ctx.duration);
      let best = 0;
      ctx.members.forEach((_, j) => { if (j !== i) best = Math.max(best, (ctx.rate[j] || 0) * buffGain(ctx, j, b.id, 1)); });
      v += best * dur;
    }
    return v;
  }
  /** heavy-attack stamina costs from the skill param tables (「重击…耐力消耗」, any skill); matched per action by label parts */
  function heavyStaminaCost(mem) {
    const list = [];
    for (const sk of mem.R.skills || []) for (const p of sk.params || []) {
      const lb = p.label || '';
      if (!/重击.*耐力消耗/.test(lb) || /空中|下落|闪避/.test(lb)) continue;
      const v = parseFloat(String(p.values[0]).replace(/[^\d.].*$/, ''));
      if (!isFinite(v)) continue;
      const core = lb.replace(/耐力消耗$/, '').replace(/每秒$/, '').replace(/重击/, '');
      list.push({ skillType: sk.type, label: lb, cost: v, perSecond: /每秒/.test(lb), parts: core.split('·').map((x) => x.trim()).filter(Boolean) });
    }
    const gen = list.find((c) => c.skillType === 1 && !c.parts.length && !c.perSecond);
    return { cost: gen ? gen.cost : null, list, source: list.length ? 'table' : 'default', label: gen ? gen.label : null };
  }
  function actStaminaCost(ctx, mem, act) {
    if (!ctx.stamina.enabled || !act) return 0;
    if (act.stamina != null) return act.stamina;
    if (act.cls !== 'H') return 0;
    const c = mem.staCost || {};
    const text = [act.label || ''].concat((act.hits || []).map((h) => h.label || '')).join('|');
    let best = null, bs = -1e9;
    for (const x of c.list || []) {
      if (x.perSecond && !act.hold) continue;
      if (x.skillType !== act.skillType && x.skillType !== 1) continue;
      const m = x.parts.filter((q) => text.includes(q)).length, u = x.parts.length - m;
      if (x.parts.length && !m) continue;
      const sc = m * 2 - u + (x.skillType === act.skillType ? 0.5 : 0) + (x.parts.length ? 0 : 0.25);
      if (sc > bs) { bs = sc; best = x; }
    }
    if (!best && act.skillType != null && act.skillType !== 1) return 0;   // special heavy (forte etc.) without its own cost row
    const base = best ? best.cost : c.cost != null ? c.cost : ctx.stamina.heavyCost;
    return best && best.perSecond ? base * (act.duration || 1) : base;
  }
  function staminaAt(ctx, s, t) {
    if (!ctx.stamina.enabled) return null;
    return Math.min(ctx.stamina.max, s.sta + ctx.stamina.regen * Math.max(0, t - s.staFrom));
  }

  // ------------------------------------------------------------------ anomaly layer (target statuses: 风蚀/光噪/电磁/聚爆/霜渐/虚湮)
  function anomDef(ctx, type) { return ctx.anom && ctx.anom.types ? ctx.anom.types[type] || null : null; }
  /** per-stack multiplier (fraction); past the table end extrapolate with the last step (wuwa-calc-site does the same) */
  function anomMult(tab, stacks) {
    if (!tab || stacks <= 0) return 0;
    const n = Math.round(stacks);
    if (n <= tab.length) return tab[n - 1] / 10000;
    const d = tab[tab.length - 1] - tab[tab.length - 2];
    return (tab[tab.length - 1] + d * (n - tab.length)) / 10000;
  }
  function anomStacks(s, type, t) {
    if (type === 'any') return Math.max(0, ...Object.keys(s.an || {}).map((k) => anomStacks(s, k, t)));
    const a = s.an && s.an[type];
    if (!a || !a.n) return 0;
    if (a.ext) return a.n;
    if (t != null && a.until != null && a.until <= t + EPS && a.until > (s.anT || 0) + EPS) return 0;
    return a.n;
  }
  function anomLog(ctx, ev) { if (ctx._detail && ctx._anLog) ctx._anLog.push(ev); }
  /** target-side stats that reach anomaly damage: anomaly-specific dmg/deep, resShred, defReduce (each buff instance once) */
  function anomalyTargetStats(ctx, s, t, owner, type) {
    const acc = {};
    const take = (k, v) => { if (/^(dmg|deep):anomaly(:|$)/.test(k) || /^resShred:/.test(k) || k === 'defReduce') acc[k] = (acc[k] || 0) + v; };
    for (const mem of ctx.members) for (const b of mem.buffDefs) {
      if (b.unmodeled) continue;
      const tgtSide = b.target !== 'self' || b.owner === owner;
      if (!tgtSide) continue;
      if (b.mode === 'on') {
        if (b.kind === 'manual' && (t < b.from - EPS || t >= b.to)) continue;
        const k = b.trigger.on === 'always' ? 1 : (b.maxStacks || 1);
        for (const st of b.stats) take(st.key, st.value * k);
      } else if (b.mode === 'auto' && b.trigger && b.trigger.on === 'targetAnomaly' && targetAnomalyOn(s, b.trigger, t)) {
        for (const st of b.stats) take(st.key, st.value * (b.maxStacks || 1));
      }
    }
    const seen = new Map();
    for (const ab of s.buffs) {
      if (ab.until <= t + EPS || ab.start > t + EPS) continue;
      const b = ctx.bd.get(ab.id);
      if (!b || (b.target === 'self' && ab.target !== owner)) continue;
      const pv = seen.get(ab.id); if (!pv || ab.stacks > pv.stacks) seen.set(ab.id, ab);
    }
    for (const ab of seen.values()) for (const st of ctx.bd.get(ab.id).stats) take(st.key, st.value * ab.stacks);
    ctx.members.forEach((mem, j) => {
      if (!mem.mod) return;
      if (mem.mod.auras) for (const x of mem.mod.auras(mkApi(ctx, s, j), owner) || []) take(x.key, x.value);
      if (mem.mod.anomalyStats && !ctx.probeRaw) for (const x of mem.mod.anomalyStats(mkApi(ctx, s, j), type, owner) || []) acc[x.key] = (acc[x.key] || 0) + x.value;
    });
    for (const x of ctx.probeStats || []) take(x.key, x.value);   // CLI probe: extra target-side stats
    const bane = anomStacks(s, 'bane', t);
    if (bane && type !== 'bane') acc.defReduce = (acc.defReduce || 0) + baneDefReduce(ctx, bane);
    return acc;
  }
  function baneDefReduce(ctx, n) { const d = anomDef(ctx, 'bane'); const tab = d && d.defReduceTable; return tab ? tab[Math.min(tab.length, n) - 1] : 0.02 * n; }
  function targetAnomalyOn(s, trig, t) { return (trig.kinds || ['any']).some((k) => anomStacks(s, k, t) >= (trig.minStacks || 1)); }
  /** one settlement of an anomaly: value + zones (MECH.anomalyBase / anomalyZones) */
  function anomalyHit(ctx, s, type, owner, stacks, t, o) {
    o = o || {};
    const def = anomDef(ctx, type);
    const mem = ctx.members[owner];
    const lv = mem.level;
    const base = ctx.anom.levelBase[Math.max(0, Math.min(ctx.anom.levelBase.length - 1, lv - 1))];
    const tab = o.table || def.table;
    const mult = anomMult(tab, stacks) * (o.scale != null ? o.scale : 1) + (o.addMult || 0);
    const st = anomalyTargetStats(ctx, s, t, owner, type);
    const enemy = ctx.enemy;
    const bonus = 1 + (st['dmg:anomaly'] || 0) + (st['dmg:anomaly:' + type] || 0);
    const deepen = 1 + (st['deep:anomaly'] || 0) + (st['deep:anomaly:' + type] || 0) + (enemy.damageTaken || 0);
    const d = defenseMultiplier(lv, enemy.level, enemy.defIgnore || 0, (enemy.defReduce || 0) + (st.defReduce || 0), enemy.defOverride);
    const el = def.element;
    const baseRes = enemy.resByElement && enemy.resByElement[el] != null ? enemy.resByElement[el] : enemy.resTier;
    const shred = (enemy.resShred || 0) + (st['resShred:all'] || 0) + (st['resShred:' + el] || 0);
    const effRes = baseRes - shred;
    const resM = resistanceMultiplier(effRes);
    const red = 1 - (enemy.dmgReduce || 0);
    const cr = o.crit ? critMultiplier(o.crit.rate, o.crit.dmg, ctx.mode) : 1;
    const value = base * mult * bonus * deepen * d.value * resM * red * cr;
    const zones = [
      zone('anomalyBase', '异常基础', base, `Lv${lv} 基础值 ${base}`, { key: 'base', level: lv }),
      zone('anomalyBase', '每层倍率', mult, `${round(mult * 100, 2)}%（${stacks} 层${o.scale && o.scale !== 1 ? ' ×' + round(o.scale, 3) : ''}）`, { key: 'multiplier', stacks }),
      zone('anomalyZones', '效应加成', bonus, null, { key: 'bonus' }),
      zone(enemy.damageTaken ? 'deepenTarget' : 'anomalyZones', '加深', deepen, enemy.damageTaken ? `1 + 加深 ${round(deepen - 1 - enemy.damageTaken, 4)} + 目标受伤 ${round(enemy.damageTaken, 4)}（相加；另一读法相乘 ${round((deepen - enemy.damageTaken) * (1 + enemy.damageTaken), 4)}）` : null, { key: 'deepen', targetTaken: enemy.damageTaken || 0 }),
      zone('anomalyZones', o.crit ? '暴击期望（模块）' : '不暴击', cr, null, { key: 'crit' }),
      zone('defense', '防御', d.value, null, { enemyDef: d.enemyDef, effectiveDef: d.effDef }),
      zone(effRes >= 0.8 ? 'resistanceHigh' : 'resistance', '抗性', resM, `${round(resM, 4)}（有效抗性 ${round(effRes * 100, 2)}%）`, { key: 'resistance', baseRes, shred, effectiveRes: effRes, neg: effRes < 0, highSegment: effRes >= 0.8 }),
      zone('dmgReduce', '减伤', red),
    ];
    return { value, zones, el, mult, base };
  }
  /** settle once: book damage on the applier, record a status entry (timeline + breakdown) */
  function anomalySettle(ctx, s, type, t, o) {
    o = o || {};
    const a = s.an[type]; const def = anomDef(ctx, type);
    if (!a || !def || !ctx.anom || a.owner == null) return 0;
    const stacks = o.stacks != null ? o.stacks : a.n;
    if (stacks <= 0) return 0;
    const owner = o.owner != null ? o.owner : a.owner;
    if (!o.crit) ctx.members.forEach((mem, j) => { if (!o.crit && mem.mod && mem.mod.anomalyCrit) { const c = mem.mod.anomalyCrit(mkApi(ctx, s, j), type, t); if (c) o = Object.assign({}, o, { crit: c }); } });
    const h = anomalyHit(ctx, s, type, owner, stacks, t, o);
    if (h.value <= 0) return 0;
    s.damage += h.value; s.perMember[owner] += h.value;
    const ty = 'anomaly:' + type;
    if (ctx._detail) s.byType[ty] = (s.byType[ty] || 0) + h.value;
    const kind = o.kind || 'tick';
    const label = ANOMALY_ZH[type] + (kind === 'burst' ? '·引爆' : kind === 'settle' ? '·结算' : '');
    s.sides = (s.sides || []).concat([{ t, endT: t, mi: owner, cls: 'Z', status: true, anomaly: type, kind, stacks, label, key: ty,
      damage: h.value, heal: 0, coord: false, est: false, energyAfter: s.m[owner].energy, concertoAfter: s.m[owner].concerto,
      parts: ctx._detail ? [{ label: (o.label || (kind === 'burst' ? '引爆' : kind === 'settle' ? '结算' : '跳伤')) + ' ' + stacks + '层', element: h.el, type: ty, count: 1, value: h.value, zones: h.zones, confidence: 'low',
        lowReason: MECH.anomalyZones.basis }] : undefined }]);
    anomLog(ctx, { type, t, n: a.n, ev: kind, damage: h.value, stacks });
    return h.value;
  }
  /** period/decay scale: a.periodScale × module hooks (卡提希娅 芙露德莉斯 −50% / 菲比 默祷 +50%) */
  function anomPeriodScale(ctx, s, type, t) {
    let f = (s.an[type] && s.an[type].periodScale) || 1;
    ctx.members.forEach((mem, j) => { if (mem.mod && mem.mod.anomalyPeriodScale) { const x = mem.mod.anomalyPeriodScale(mkApi(ctx, s, j), type, t); if (x > 0) f *= x; } });
    return f;
  }
  function anomalyClear(ctx, s, type, t, why) {
    const a = s.an[type]; if (!a) return;
    a.n = 0; a.until = null; a.next = null; a.burst = 0; a.cap = (anomDef(ctx, type) || {}).cap || a.cap;
    anomLog(ctx, { type, t, n: 0, ev: why || 'clear' });
  }
  /** process periodic ticks / expirations in [s.anT, to) in time order */
  /** B13 periodic module hook: api.every(key, period, until, first?) stores a timer in the member's module state (cs._every, cloned/carried with cs);
   *  every due tick up to `to` calls mod.tick(api, key, t) with api.t = api.tEnd = tick time — fires in idle windows too (卜灵 五雷荡煞阵, 丽贝卡 炮台). */
  function advanceTimers(ctx, s, to) {
    if (s._inTimers || !s.m) return;
    s._inTimers = true;
    try {
      for (let guard = 0; guard < 2000; guard++) {
        let best = null;
        s.m.forEach((ms, mi) => { const ev = ms.cs && ms.cs._every; if (!ev) return;
          for (const [key, tm] of Object.entries(ev)) if (tm.next <= to + EPS && tm.next <= ctx.duration + EPS && (best == null || tm.next < best.t)) best = { mi, key, t: tm.next, tm }; });
        if (!best) break;
        const { mi, key, t, tm } = best, mod = ctx.members[mi].mod;
        tm.next = t + Math.max(0.05, tm.period);
        if (tm.until != null && t > tm.until + EPS) { delete s.m[mi].cs._every[key]; continue; }
        if (mod && mod.tick) { const api = mkApi(ctx, s, mi, t); api.t = t; mod.tick(api, key, t); }
        if (tm.until != null && tm.next > tm.until + EPS && s.m[mi].cs._every) delete s.m[mi].cs._every[key];
      }
    } finally { s._inTimers = false; }
  }
  function advanceAnomalies(ctx, s, to) {
    advanceTimers(ctx, s, to);
    const from = s.anT || 0;
    if (!s.an || to <= from + EPS) { if (to > from) s.anT = to; return; }
    for (let guard = 0; guard < 500; guard++) {
      let best = null;
      for (const k of Object.keys(s.an)) {
        const a = s.an[k];
        if (!a.n || a.ext) continue;
        for (const [kind, tt] of [['tick', a.next], ['expire', a.until]]) {
          if (tt == null || tt < from - EPS || tt >= to - EPS) continue;
          if (!best || tt < best.t - EPS || (Math.abs(tt - best.t) <= EPS && kind === 'tick' && best.kind !== 'tick')) best = { k, kind, t: tt, a };
        }
      }
      if (!best) break;
      const { k, a } = best, def = anomDef(ctx, k);
      if (a.capRaise) { a.cap = capAt(ctx, a, k, best.t); if (a.n > a.cap) a.n = a.cap; }
      if (best.kind === 'tick') {
        if (k === 'flare') {
          anomalySettle(ctx, s, k, best.t, { addMult: a.burst ? anomMult(def.burstTable, a.burst) : 0, label: a.burst ? '跳伤+电磁爆发' + a.burst : null });
          a.burst = 0;
          if (!noDecayAt(a, best.t)) {
            a.n = Math.floor(a.n * (def.decayRatio != null ? def.decayRatio : 0.5)); anomLog(ctx, { type: k, t: best.t, n: a.n, ev: 'decay' });
            // MECH.electroDecay 读法 B：减半时刷新持续时间（config.electroRefreshOnHalve，默认 false）
            if (ctx.cfg.electroRefreshOnHalve && a.n && def.duration > 0) a.until = best.t + def.duration;
          }
          if (!a.n) { anomalyClear(ctx, s, k, best.t, 'decay'); continue; }
        } else anomalySettle(ctx, s, k, best.t);
        a.next = def && def.period > 0 ? best.t + def.period * anomPeriodScale(ctx, s, k, best.t) : null;
      } else {
        if (def && def.stackExpirationRemoveNumber === 1) {
          if (!noDecayAt(a, best.t)) a.n -= 1;
          a.until = best.t + def.duration * anomPeriodScale(ctx, s, k, best.t);
          anomLog(ctx, { type: k, t: best.t, n: a.n, ev: 'decay' });
          if (a.n <= 0) anomalyClear(ctx, s, k, best.t, 'expire');
        } else anomalyClear(ctx, s, k, best.t, 'expire');
      }
    }
    s.anT = to;
  }
  /** stream B B6: noDecay with an optional end time (漂泊者·衍射 微光 9 s) */
  function noDecayAt(a, t) { return !!a.noDecay && (a.noDecayUntil == null || t < a.noDecayUntil - EPS); }
  /** stream B B5: temporary stack-cap raise (千咲 延奏 +3 for 15 s); expires back to the base cap (stacks clamped) */
  function capAt(ctx, a, type, t) {
    const base = Math.max((anomDef(ctx, type) || {}).cap || 0, a.capBase || 0);
    const r = (a.capRaise || []).filter((x) => t < x.until - EPS).reduce((m, x) => m + x.n, 0);
    return base + r;
  }
  function raiseAnomalyCap(ctx, s, type, n, until, src) {
    s.an = s.an || {};
    const def = anomDef(ctx, type) || { cap: 10 };
    const a = s.an[type] || (s.an[type] = { n: 0, cap: def.cap, owner: null, until: null, next: null, burst: 0 });
    // 「该效果无法叠加」: a raise from the same source (default: the calling member) refreshes instead of stacking
    a.capRaise = (a.capRaise || []).filter((x) => x.until > s.t + EPS && (src == null || x.src !== src)).concat([{ n, until, src }]);
    a.cap = capAt(ctx, a, type, s.t);
    return a.cap;
  }
  /** apply n stacks of an anomaly by member mi at time t. o: {cap, external, noDecay, noDecayUntil, detonateAbove, periodScale} */
  function addAnomaly(ctx, s, mi, type, n, o) {
    o = o || {};
    if (!ANOMALY_ZH[type] || !(n > 0)) return 0;
    const def = anomDef(ctx, type) || { cap: 10, duration: 15, period: 0 };
    s.an = s.an || {};
    const t = Math.max(o.t != null ? o.t : s.t, s.anT || 0);
    let a = s.an[type];
    const fresh = !a || !a.n;
    if (!a) a = s.an[type] = { n: 0, cap: def.cap, owner: mi, until: null, next: null, burst: 0 };
    if (o.external) { a.ext = true; a.n = Math.max(a.n, n); a.cap = Math.max(a.cap, n); a.owner = a.owner == null ? mi : a.owner; return a.n; }
    if (o.cap) a.capBase = Math.max(a.capBase || 0, o.cap);
    a.cap = a.capRaise ? capAt(ctx, a, type, t) : Math.max(def.cap, o.cap || 0, fresh ? 0 : a.cap || 0);
    if (o.noDecay != null) a.noDecay = !!o.noDecay;
    if (o.noDecayUntil != null) { a.noDecay = true; a.noDecayUntil = o.noDecayUntil; }
    if (o.periodScale) a.periodScale = o.periodScale;
    a.owner = mi;
    let nn = a.n + n;
    if (type === 'flare' && nn > a.cap) { a.burst = Math.min(10, (a.burst || 0) + nn - a.cap); nn = a.cap; }
    a.n = Math.min(a.cap, nn);
    const ps = def.stackExpirationRemoveNumber === 1 || def.period > 0 ? anomPeriodScale(ctx, s, type, t) : 1;
    if (fresh || def.stackDurationRefreshPolicy === 0) a.until = def.duration > 0 ? t + def.duration * (def.stackExpirationRemoveNumber === 1 ? ps : 1) : null;
    if (fresh) a.next = def.period > 0 ? (def.tickOnApply ? null : t + def.period * ps) : null;
    anomLog(ctx, { type, t, n: a.n, ev: 'apply', added: n, owner: mi });
    if (fresh && def.period > 0 && def.tickOnApply) { anomalySettle(ctx, s, type, t); a.next = t + def.period * ps; }
    // 霜冻效应（绯雪 万世霜天，模块声明 frostbite:true）：编队中有该模块时，霜渐附加改为霜冻——按上限层数结算一次，满层不冻结清空
    const frostbite = type === 'chafe' && (ctx.frostbite != null ? ctx.frostbite : (ctx.frostbite = ctx.members.some((m) => m.mod && m.mod.frostbite)));
    if (type === 'chafe' && ctx.anom) anomalySettle(ctx, s, type, t, frostbite ? { kind: 'tick', label: '霜冻效应', stacks: a.cap } : { kind: 'tick', label: '附加' });
    const above = o.detonateAbove != null ? o.detonateAbove : null;
    if ((def.clearOnOverflow && a.n >= a.cap && !frostbite) || (above != null && a.n > above)) {
      if (type === 'burst') anomalySettle(ctx, s, type, t, { kind: 'burst', stacks: above != null ? a.cap : a.n });
      anomalyClear(ctx, s, type, t, type === 'chafe' ? 'freeze' : 'overflow');
    }
    fire(ctx, s, mi, 'anomaly', type);
    ctx.members.forEach((_, j) => fire(ctx, s, j, 'anomalyTeam', type));
    dispatch(ctx, s, { type: 'anomaly', mi, kind: type, stacks: a.n, added: n, t });
    return a.n;
  }
  /** settle an anomaly on demand (卡提希娅 结算 / 爱弥斯 光翼共奏引爆): o {stacks:'cap'|n, scale, remove:'all'|n, kind, label, owner, crit} */
  function detonateAnomaly(ctx, s, mi, type, o) {
    o = o || {};
    const a = s.an && s.an[type];
    if (!a || !a.n) return 0;
    const t = Math.max(o.t != null ? o.t : s.t, s.anT || 0);
    const stacks = o.stacks === 'cap' ? a.cap : o.stacks != null ? o.stacks : a.n;
    const v = anomalySettle(ctx, s, type, t, { stacks, scale: o.scale, addMult: o.addMult, kind: o.kind || 'burst', label: o.label, owner: o.owner != null ? o.owner : mi, crit: o.crit }); // addMult: flat anomaly multiplier (e.g. 雪锈 102%) with scale:0
    if (o.remove === 'all') anomalyClear(ctx, s, type, t, 'consume');
    else if (o.remove > 0) { a.n = Math.max(0, a.n - o.remove); anomLog(ctx, { type, t, n: a.n, ev: 'consume' }); if (!a.n) anomalyClear(ctx, s, type, t, 'consume'); }
    return v;
  }

  /**
   * CLI/validation probe: apply `stacks` of an anomaly by member p.member at t=0 and settle it through the real anomaly layer.
   * p: { member, anomaly, stacks, ticks (max settlements, default 10), cap, noDecay, detonate (burst/settle once), scale, crit:{rate,dmg}, extraStats:[{key,value}] }
   * → { type, zh, def, ticks:[{t, kind, stacks, value, zones}], sum, log }
   */
  function probeAnomaly(config, data, p) {
    const idx = ensureIndex(data);
    const ctx = buildContext(config, idx);
    ctx._detail = true; ctx.probeStats = p.extraStats || [];
    // raw anomaly-table probe: module-level anomaly rewrites (绯雪 frostbite) only when the probe asks for them
    ctx.frostbite = !!p.frostbite; ctx.probeRaw = !p.moduleStats; // module anomalyStats (e.g. 绯雪 on-field 霜渐 +30%) only with probe.moduleStats
    const s = initialState(ctx);
    const mi = p.member || 0, type = p.anomaly, def = anomDef(ctx, type);
    if (!def) throw new Error('probe: unknown anomaly ' + type + ' (known: ' + Object.keys((ctx.anom && ctx.anom.types) || {}).join(', ') + ')');
    const stacks = p.stacks || 1, maxT = p.ticks || 10;
    if (p.electroRefreshOnHalve != null) ctx.cfg = Object.assign({}, ctx.cfg, { electroRefreshOnHalve: !!p.electroRefreshOnHalve });
    if (type === 'bane') {
      // 虚湮：不造成伤害，只减防 → 输出逐层防御区（附加者 = p.member，按其等级）
      const mem = ctx.members[mi], e = ctx.enemy, cap = Math.max(def.cap || 3, p.cap || 0);
      const d0 = defenseMultiplier(mem.level, e.level, e.defIgnore || 0, e.defReduce || 0, e.defOverride);
      const rows = [];
      for (let n = 0; n <= Math.max(stacks, 0); n++) {
        const nn = Math.min(cap, n), red = nn ? baneDefReduce(ctx, nn) : 0;
        const d = defenseMultiplier(mem.level, e.level, e.defIgnore || 0, (e.defReduce || 0) + red, e.defOverride);
        rows.push({ stacks: nn, defReduce: round(red, 4), enemyDef: round(d.enemyDef, 2), effectiveDef: round(d.effDef, 2), defZone: round(d.value, 6), gainPct: round((d.value / d0.value - 1) * 100, 3) });
      }
      return { type, zh: ANOMALY_ZH[type], member: mem.R.name, level: mem.level,
        def: { cap: def.cap, duration: def.duration, period: def.period, defReduceTable: def.defReduceTable || null }, ticks: [], sum: 0, bane: rows, log: [], mech: [MECH.bane] };
    }
    if (p.detonate || type === 'burst') {
      s.an[type] = { n: stacks, cap: Math.max(def.cap || 10, p.cap || 0), owner: mi, until: null, next: null, burst: 0 };
      detonateAnomaly(ctx, s, mi, type, { stacks: p.stacks === 'cap' ? 'cap' : stacks, scale: p.scale, crit: p.crit, kind: 'burst', remove: 'all', t: 0 });
    } else {
      if (p.crit) ctx.members[mi].mod = Object.assign({}, ctx.members[mi].mod || {}, { anomalyCrit: () => p.crit });
      addAnomaly(ctx, s, mi, type, stacks, { t: 0, cap: p.cap, noDecay: p.noDecay });
      for (let T = 1; T <= 600; T += 1) {
        advanceAnomalies(ctx, s, T);
        if ((s.sides || []).filter((x) => x.status).length >= maxT || !(s.an[type] && s.an[type].n)) break;
      }
    }
    const ticks = (s.sides || []).filter((x) => x.status).slice(0, maxT).map((x) => ({ t: round(x.t, 3), kind: x.kind, stacks: x.stacks, value: x.damage, zones: x.parts && x.parts[0] ? x.parts[0].zones : [] }));
    const pick = (k) => def[k];
    return { type, zh: ANOMALY_ZH[type], member: ctx.members[mi].R.name, level: ctx.members[mi].level,
      def: { cap: pick('cap'), duration: pick('duration'), period: pick('period'), tickOnApply: pick('tickOnApply'), decayRatio: pick('decayRatio'), stackExpirationRemoveNumber: pick('stackExpirationRemoveNumber'), clearOnOverflow: pick('clearOnOverflow') },
      ticks, sum: ticks.reduce((a, x) => a + x.value, 0), log: ctx._anLog || [], mech: [MECH.anomalyBase, MECH.anomalyZones, MECH.anomalyTiming].concat(type === 'flare' ? [MECH.electroDecay] : []),
      electroRefreshOnHalve: type === 'flare' ? !!ctx.cfg.electroRefreshOnHalve : undefined };
  }

  // ------------------------------------------------------------------ state machine
  function maxEnergy(mem) { return mem.R.energy.liberationCost || 0; }
  function deepCopy(o) {
    if (o == null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(deepCopy);
    const r = {}; for (const k in o) r[k] = deepCopy(o[k]); return r;
  }
  function initialState(ctx) {
    const s = ctx.cfg.start;
    const pick = (v, i, full) => (Array.isArray(v) ? v[i] || 0 : v === 'full' ? full : v || 0);
    const st = {
      t: 0, active: ctx.cfg.rotation.start || 0,
      m: ctx.members.map((mem, i) => ({ energy: Math.min(maxEnergy(mem), pick(s.energy, i, maxEnergy(mem))), concerto: Math.min(100, pick(s.concerto, i, 100)), cd: {}, stage: 0, cs: null })),
      buffs: [], damage: 0, heal: 0, perMember: ctx.members.map(() => 0), byType: {}, swaps: 0, libs: 0, prev: null, action: null, sides: null, n: 0,
      an: {}, anT: 0, sta: ctx.stamina.enabled ? (ctx.cfg.start.stamina != null ? Math.min(ctx.stamina.max, ctx.cfg.start.stamina) : ctx.stamina.max) : 0, staFrom: 0,
    };
    if (ctx._detail) ctx._anLog = [];
    ctx.members.forEach((mem, i) => { if (mem.mod && mem.mod.init) st.m[i].cs = mem.mod.init(mkApi(ctx, st, i)) || {}; });
    if (ctx.carryFrom) carryInto(ctx, st, ctx.carryFrom);
    return st;
  }
  /**
   * 稳态开局 (config.start.steady): state at the end of the previous identical loop, re-based to t=0.
   * Engine-level: on-field member, energy, concerto, combo stage, cooldowns, buff instances, target anomalies, stamina (times − D).
   * Module state: mod.carry(api, cs, D) when the module defines it (time fields shifted by the module); otherwise the module's
   * declared non-derived resources (resources without get) are carried and timed windows restart (conservative).
   */
  function carryInto(ctx, st, S) {
    const D = S.t;
    const sh = (x) => (x == null ? x : x - D);
    st.active = S.active;
    st.m.forEach((m, i) => {
      const o = S.m[i];
      m.energy = o.energy; m.concerto = o.concerto; m.stage = o.stage; m.cd = {};
      for (const [k, v] of Object.entries(o.cd || {})) if (v - D > EPS) m.cd[k] = v - D;
      const mem = ctx.members[i];
      if (mem.mod && o.cs) {
        const api = mkApi(ctx, st, i);
        if (mem.mod.carry) m.cs = mem.mod.carry(api, deepCopy(o.cs), D) || m.cs;
        else for (const r of mem.mod.resources || []) if (!r.get && o.cs[r.key] != null && typeof o.cs[r.key] !== 'object') m.cs[r.key] = o.cs[r.key];
      }
    });
    st.buffs = S.buffs.filter((b) => b.until > D + EPS).map((b) => Object.assign({}, b, { start: b.start - D, until: b.until - D, carried: true }));
    st.an = deepCopy(S.an || {});
    for (const a of Object.values(st.an)) { a.until = sh(a.until); a.next = sh(a.next); }
    st.anT = Math.max(0, (S.anT || 0) - D);
    st.sta = S.sta; st.staFrom = (S.staFrom || 0) - D;
  }
  /** carried-state summary for the view (稳态开局: .ww-carry markers) */
  function carrySummary(ctx, st) {
    return ctx.members.map((mem, i) => ({ member: i, energy: round(st.m[i].energy, 2), energyMax: maxEnergy(mem), concerto: round(st.m[i].concerto, 2), onField: st.active === i,
      cooldowns: Object.fromEntries(Object.entries(st.m[i].cd).filter(([k]) => k[0] !== '_').map(([k, v]) => [k, round(v, 2)])),
      buffs: st.buffs.filter((b) => b.target === i).map((b) => { const d = ctx.bd.get(b.id) || {}; return { id: b.id, name: d.name || b.id, src: d.src || null, remaining: round(b.until, 2), stacks: b.stacks }; }),
      resources: resSnapshot(ctx, st)[i], moduleCarry: !!(mem.mod && mem.mod.carry) }));
  }
  function clone(s) {
    return { t: s.t, active: s.active, m: s.m.map((x) => ({ energy: x.energy, concerto: x.concerto, cd: Object.assign({}, x.cd), stage: x.stage, cs: deepCopy(x.cs) })),
      buffs: s.buffs.map((b) => Object.assign({}, b)), damage: s.damage, heal: s.heal, perMember: s.perMember.slice(), byType: Object.assign({}, s.byType),
      swaps: s.swaps, libs: s.libs, prev: s, action: null, sides: null, n: s.n + 1, an: deepCopy(s.an), anT: s.anT, tune: s.tune ? deepCopy(s.tune) : undefined, sta: s.sta, staFrom: s.staFrom, swapCut: s.swapCut };
  }
  function mkApi(ctx, s, mi, tEnd) {
    const mem = ctx.members[mi];
    const api = {
      ctx, s, mi, mem, H: mem.H, t: s.t, tEnd: tEnd == null ? s.t : tEnd, ms: s.m[mi], cs: s.m[mi].cs, active: s.active, onField: s.active === mi,
      member: (j) => s.m[j], memberDef: (j) => ctx.members[j], teamSize: ctx.members.length,
      est: (act) => estimate(ctx, mi, act), duration: ctx.duration,
      teamStatValue: (stats, dur, who) => teamStatValue(ctx, mi, stats, dur, who),
      energyFrac: () => { const c = maxEnergy(ctx.members[mi]); return c ? Math.min(1, s.m[mi].energy / c) : 0; },
      cdReady: (key) => (s.m[mi].cd[key] || 0) <= s.t + EPS,
      deal: (act, o) => sideDamage(ctx, s, mi, act, o || {}),
      addEnergy: (j, v) => { const m = s.m[j]; m.energy = Math.max(0, Math.min(maxEnergy(ctx.members[j]), m.energy + v)); },
      addConcerto: (j, v) => { const m = s.m[j]; m.concerto = Math.max(0, Math.min(100, m.concerto + v)); },
      // B13 periodic hook (see advanceTimers): every(key, period, until, first = t + period); cancelEvery(key)
      every: (key, period, until, first) => { const cs = s.m[mi].cs; cs._every = cs._every || {}; cs._every[key] = { period, until: until == null ? null : until, next: first != null ? first : s.t + period }; },
      cancelEvery: (key) => { const cs = s.m[mi].cs; if (cs._every) delete cs._every[key]; },
      staticPanel: () => finalPanel(mem, []),
      /** panel incl. current buffs/auras (for stat-scaling auras like 守岸人 星域) */
      livePanel: () => finalPanel(mem, activeStats(ctx, s, mi, s.t, true)),
      buffInst: (id, target) => s.buffs.find((b) => b.id === id && b.target === (target == null ? mi : target) && b.until > s.t + EPS && b.start <= s.t + EPS) || null,
      fireBuff: (localOrId, target, o) => {
        o = o || {};
        const id = ctx.bd.has(localOrId) ? localOrId : 'm' + mi + '_' + localOrId;
        const b = ctx.bd.get(id); if (!b) return;
        const tg = target == null ? mi : target;
        const t0 = o.t != null ? o.t : s.t;
        const dur = o.duration || b.duration || 10;
        const ex = s.buffs.find((x) => x.id === id && x.target === tg && x.until > t0 + EPS);
        if (ex) { ex.stacks = Math.min(b.maxStacks || 1, o.stacks != null ? o.stacks : ex.stacks + 1); ex.until = t0 + dur; }
        else s.buffs.push({ id, target: tg, stacks: Math.min(b.maxStacks || 1, o.stacks || 1), start: t0, until: t0 + dur, endsOnSwap: b.endsOnSwap });
      },
      endBuff: (localOrId, target) => {
        const id = ctx.bd.has(localOrId) ? localOrId : 'm' + mi + '_' + localOrId;
        for (const b of s.buffs) if (b.id === id && (target == null || b.target === target) && b.until > s.t) b.until = s.t;
      },
      /** target anomaly layer: stacks now (type or 'any'), apply (default at tEnd), settle/detonate */
      anomaly: (type) => anomStacks(s, type, s.t),
      anomalyState: (type) => (s.an && s.an[type] ? Object.assign({}, s.an[type]) : null),
      anomalyCap: (type) => (s.an && s.an[type] && s.an[type].n ? s.an[type].cap : ((anomDef(ctx, type) || {}).cap || 10)),
      addAnomaly: (type, n, o) => addAnomaly(ctx, s, mi, type, n, Object.assign({ t: tEnd == null ? s.t : tEnd }, o || {})),
      /** stream B B4: target tune state. kind 'concord'|'tremor'|'hack', state 'shift' (偏移) | 'interfere' (干涉). Duration comes from the module (kit text). */
      applyTune: (kind, state, dur, o) => applyTune(ctx, s, mi, kind, state || 'shift', dur, Object.assign({ t: tEnd == null ? s.t : tEnd }, o || {})),
      tune: (kind, state, t) => tuneOn(s, kind, state || 'shift', t == null ? s.t : t),
      clearTune: (kind, state) => { if (s.tune && s.tune[kind + ':' + (state || 'shift')]) s.tune[kind + ':' + (state || 'shift')].until = s.t; },
      /** stream B B5: temporary anomaly stack-cap raise, falls back at `until` (stacks clamped) */
      raiseAnomalyCap: (type, n, until, src) => raiseAnomalyCap(ctx, s, type, n, until, src != null ? src : 'm' + mi),
      detonateAnomaly: (type, o) => detonateAnomaly(ctx, s, mi, type, Object.assign({ t: tEnd == null ? s.t : tEnd }, o || {})),
      clearAnomaly: (type) => anomalyClear(ctx, s, type, Math.max(tEnd == null ? s.t : tEnd, s.anT || 0), 'consume'),
      anomalyMult: (type, stacks) => anomMult((anomDef(ctx, type) || {}).table, stacks),
      stamina: () => staminaAt(ctx, s, s.t),
      /**
       * member j (default self) gains a shield repeatedly over [t0, t1] (e.g. “造成伤害时获得护盾，每0.5秒可生效1次”): fires j's
       * “获得护盾时” buffs once per gain; gains are spaced by `icd` (default 0.5 s) and tracked across actions (ms.cd._shield). Returns gains.
       */
      /** member j (default self) heals (periodic field heals etc.): fires j's “造成治疗时” buffs once */
      heal: (j, cls) => fire(ctx, s, j == null ? mi : j, 'heal', cls == null ? null : cls),
      shield: (o) => {
        o = o || {};
        const j = o.target == null ? mi : o.target, mj = s.m[j], icd = o.icd || 0.5;
        const t0 = Math.max(o.t0 != null ? o.t0 : s.t, mj.cd._shield || 0), t1 = o.t1 != null ? o.t1 : t0;
        if (t1 < t0 - EPS) return 0;
        const n = Math.min(o.max || 20, Math.floor((t1 - t0 + EPS) / icd) + 1);
        mj.cd._shield = t0 + n * icd;
        for (let k = 0; k < Math.min(n, 10); k++) fire(ctx, s, j, 'shield', null);
        // stream B B9: teammates see shield gains (尤诺 满月领域「登场角色获得护盾时」)
        dispatch(ctx, s, { type: 'shield', mi: j, by: mi, n, t: t0, t1 });
        return n;
      },
    };
    return api;
  }
  function staticOnBuffApplies(b, mi) {
    if (b.target === 'team') return true;
    if (b.target === 'incoming' || b.target === 'others') return b.owner !== mi;
    return b.owner === mi;
  }
  function activeStats(ctx, s, mi, t, noAuras) {
    const out = [];
    for (const mem of ctx.members) for (const b of mem.buffDefs) {
      if (b.unmodeled) continue;
      // static condition on the target state (“对附加了【X效应】的目标”): on while the target has the status
      if (b.mode === 'auto' && b.trigger && b.trigger.on === 'targetAnomaly') {
        if (staticOnBuffApplies(b, mi) && targetAnomalyOn(s, b.trigger, t)) for (const st of b.stats) out.push({ key: st.key, value: st.value * (b.maxStacks || 1) });
        continue;
      }
      if (b.mode !== 'on') continue;
      if (b.kind === 'manual' && (t < b.from - EPS || t >= b.to)) continue;
      if (!staticOnBuffApplies(b, mi)) continue;
      const k = b.trigger.on === 'always' ? 1 : (b.maxStacks || 1);
      for (const st of b.stats) out.push({ key: st.key, value: st.value * k });
    }
    const bane = anomStacks(s, 'bane', t);
    if (bane) out.push({ key: 'defReduce', value: baneDefReduce(ctx, bane) });
    for (const ab of s.buffs) {
      if (ab.target !== mi || ab.until <= t + EPS || ab.start > t + EPS) continue;
      const b = ctx.bd.get(ab.id);
      for (const st of b.stats) out.push({ key: st.key, value: st.value * ab.stacks });
    }
    if (!noAuras) ctx.members.forEach((mem, j) => { if (mem.mod && mem.mod.auras) out.push(...(mem.mod.auras(mkApi(ctx, s, j), mi) || [])); });
    return out;
  }
  function trigMatches(trig, on, kind, key) {
    if (!trig) return false;
    if (trig.on === 'any') return trig.any.some((x) => trigMatches(x, on, kind, key));
    if (trig.on === 'act') return on === 'cast' && (trig.keys || []).includes(key);
    if (trig.on !== on) return false;
    if (on === 'anomaly' || on === 'anomalyTeam') return (trig.kinds || []).includes('any') || (trig.kinds || []).includes(kind);
    if (on === 'tune' || on === 'tuneTeam') return (trig.kinds || []).includes('any') || (trig.kinds || []).includes(kind);
    if (on === 'heal') return !trig.kinds || kind == null || trig.kinds.includes(kind);
    return on !== 'cast' || (trig.kinds || []).includes(kind);
  }
  function fire(ctx, s, owner, on, kind, incoming, key) {
    for (const b of ctx.members[owner].buffDefs) {
      if (b.mode !== 'auto' || b.unmodeled || !trigMatches(b.trigger, on, kind, key)) continue;
      const targets = b.target === 'team' ? ctx.members.map((_, i) => i) : b.target === 'others' ? ctx.members.map((_, i) => i).filter((i) => i !== owner)
        : b.target === 'incoming' ? (incoming != null ? [incoming] : []) : [owner];
      const dur = b.duration || ctx.cfg.defaultBuffDuration || 10;
      for (const ti of targets) {
        const ex = s.buffs.find((x) => x.id === b.id && x.target === ti && x.until > s.t + EPS);
        if (ex) { ex.stacks = Math.min(b.maxStacks || 1, ex.stacks + 1); ex.until = s.t + dur; }
        else s.buffs.push({ id: b.id, target: ti, stacks: 1, start: s.t, until: s.t + dur, endsOnSwap: b.endsOnSwap });
      }
    }
  }
  function expireOnSwap(s, outgoing) { for (const b of s.buffs) if (b.endsOnSwap && b.target === outgoing && b.until > s.t) b.until = s.t; }
  function pruneBuffs(s, ctx) { if (!ctx._detail) s.buffs = s.buffs.filter((b) => b.until > s.t - EPS); }
  function cdKey(a) { return a.cdKey || a.key || (a.cls + (a.xid || '')); }
  // stream B B4: tune state layer (偏移/干涉 on the target). s.tune['kind:state'] = { until, by, n } ; events: 'tune' (owner buffs), 'tuneTeam' (all members' team-wide buffs), onTeam {type:'tune'}
  function tuneOn(s, kind, state, t) {
    if (!s.tune) return false;
    if (kind === 'any') return Object.entries(s.tune).some(([k, v]) => k.endsWith(':' + state) && v.until > t + EPS);
    const v = s.tune[kind + ':' + state];
    return !!(v && v.until > t + EPS);
  }
  function applyTune(ctx, s, mi, kind, state, dur, o) {
    const k = kind + ':' + state, t = o.t;
    s.tune = s.tune || {};
    const prev = s.tune[k];
    s.tune[k] = { until: t + (dur || 0), by: mi, n: prev && prev.until > t + EPS ? (prev.n || 1) + 1 : 1, from: prev && prev.until > t + EPS ? prev.from : t };
    const t0 = s.t; s.t = t;
    try {
      fire(ctx, s, mi, 'tune', k);
      ctx.members.forEach((_, j) => fire(ctx, s, j, 'tuneTeam', k));
      dispatch(ctx, s, { type: 'tune', mi, kind, state, key: k, t, until: s.tune[k].until });
    } finally { s.t = t0; }
    return s.tune[k].until;
  }
  function dispatch(ctx, s, ev) {
    if ((ctx._depth || 0) > 3) return;
    ctx._depth = (ctx._depth || 0) + 1;
    try { ctx.members.forEach((mem, j) => { if (mem.mod && mem.mod.onTeam) mem.mod.onTeam(mkApi(ctx, s, j), ev); }); }
    finally { ctx._depth -= 1; }
  }
  const BUTTONS = ['A', 'H', 'E', 'R', 'Q'];

  /** Resolve a button press for member mi in state s → {act, meta} | {blocked} | null. Applies generic cooldown/energy gating. */
  function resolveButton(ctx, s, mi, btn) {
    const mem = ctx.members[mi], ms = s.m[mi], k = mem.kit;
    let r;
    if (mem.mod && mem.mod.resolve) r = mem.mod.resolve(mkApi(ctx, s, mi), btn);
    else {
      const act = btn === 'A' ? k.stages[ms.stage % Math.max(1, k.stages.length)] : k[btn];
      r = act ? { act } : null;
    }
    if (!r) return { blocked: `${mem.R.name} 无 ${btn} 动作` };
    if (!r.act) return r;
    const act = r.act;
    if (act.cls === 'R' && act.cost && ms.energy < act.cost - EPS) return { blocked: `共鸣能量不足（${round(ms.energy, 1)}/${act.cost}）`, act };
    if (act.cooldown && (ms.cd[cdKey(act)] || 0) > s.t + EPS) return { blocked: `冷却中（剩 ${round(ms.cd[cdKey(act)] - s.t, 2)}s）`, cdWait: ms.cd[cdKey(act)] - s.t, act };
    const sc = actStaminaCost(ctx, mem, act);
    if (sc > 0) { const cur = staminaAt(ctx, s, s.t); if (cur < sc - EPS) return { blocked: `耐力不足（${round(cur, 1)}/${round(sc, 1)}）`, noStamina: true, act }; }
    return r;
  }

  function actionsFor(s, ctx) {
    const acts = [];
    const mi = s.active, mem = ctx.members[mi];
    const seen = new Set();
    for (const b of BUTTONS) {
      const r = resolveButton(ctx, s, mi, b);
      if (!r || !r.act || r.blocked) continue;
      const id = r.act.key + '|' + JSON.stringify(r.meta || '');
      if (seen.has(id)) continue; seen.add(id);
      acts.push({ tok: b, mi, act: r.act, meta: r.meta });
    }
    if (ctx._allowExtras) for (const x of mem.kit.extras) if (!x.cooldown || (s.m[mi].cd[cdKey(x)] || 0) <= s.t + EPS) acts.push({ tok: x.xid, mi, act: x });
    ctx.members.forEach((_, j) => { if (j !== mi) acts.push({ tok: 'S' + (j + 1), mi, swapTo: j }); });
    return acts;
  }

  function addDamage(ctx, s, mi, act, extraStats, o) {
    o = o || {};
    let bs = activeStats(ctx, s, mi, s.t).concat(extraStats || []);
    // 协同攻击伤害加成/加深（dmg:coord / deep:coord，如 釉瑚 延奏 鉴珍）只作用于协同攻击（sideDamage coord !== false）
    if (o.coordAtk) { const cx = bs.filter((x) => x && (x.key === 'dmg:coord' || x.key === 'deep:coord')); if (cx.length) bs = bs.concat(cx.map((x) => Object.assign({}, x, { key: x.key.replace(':coord', ':all') }))); }
    const d = actionDamage(ctx, mi, act, bs, !!ctx._detail, o.times || 1);
    s.damage += d.value; s.heal += d.heal; s.perMember[mi] += d.value;
    if (ctx._detail) for (const p of d.parts) {
      const ty = p.r.type || p.hit.type; if (!ty || p.hit.calc === 'heal') continue;
      s.byType[ty] = (s.byType[ty] || 0) + (ctx.mode === 'crit' ? p.r.total.crit : ctx.mode === 'noncrit' ? p.r.total.noncrit : p.r.total.expected) * (o.times || 1);
    }
    const mem = ctx.members[mi], ms = s.m[mi];
    const eBefore = ms.energy, cBefore = ms.concerto;
    if (!o.noGain) {
      ms.energy = Math.min(maxEnergy(mem), ms.energy + act.energy * (o.times || 1) * d.panel.energyRegen);
      ms.concerto = Math.min(100, ms.concerto + act.concerto * (o.times || 1));
    }
    const el = (act.hits.find((h) => h.calc !== 'heal' && ELEMENTS.includes(h.element)) || {}).element || null;
    if (d.value > 0 && !o.noEvent) dispatch(ctx, s, { type: 'damage', mi, el, coord: !!o.coord, t: s.t, dur: o.coord ? 0 : act.duration || 0, act });
    return { d, eBefore, cBefore };
  }
  /** off-field / coordinated damage dealt by module owner (墨鹤, 耀星·蝶 …) */
  function sideDamage(ctx, s, mi, act, o) {
    const times = o.count == null ? 1 : o.count;
    if (times <= 0) return 0;
    const extra = o.stats || [];
    const r = addDamage(ctx, s, mi, act, extra, { coord: o.coord !== false, coordAtk: o.coord !== false && o.coordAttack !== false, times, noGain: !!o.noGain });
    if (act.echoCast) dispatch(ctx, s, { type: 'echoCast', mi, key: act.key, echo: act.echoName || mi + ':' + act.key, t: o.t != null ? o.t : s.t, side: true });
    s.sides = (s.sides || []).concat([{ t: o.t != null ? o.t : s.t, endT: o.t != null ? o.t : s.t, mi, cls: act.cls, key: act.key, label: act.label + (times !== 1 ? ' ×' + round(times, 2) : ''),
      damage: r.d.value, heal: r.d.heal, coord: true, offfield: s.active !== mi, est: false, energyAfter: s.m[mi].energy, concertoAfter: s.m[mi].concerto,
      parts: ctx._detail ? r.d.parts.map((p) => ({ label: p.hit.label, element: p.r.element, type: p.r.type, count: (p.hit.count || 1) * times, value: (ctx.mode === 'crit' ? p.r.total.crit : ctx.mode === 'noncrit' ? p.r.total.noncrit : p.r.total.expected) * times, zones: p.r.zones, confidence: p.hit.confidence })) : undefined }]);
    return r.d.value;
  }

  function resSnapshot(ctx, s) {
    return ctx.members.map((mem, i) => {
      if (!mem.mod || !mem.mod.resources) return null;
      const cs = s.m[i].cs || {};
      const o = {}; for (const r of mem.mod.resources) o[r.key] = round(r.get ? r.get(cs, s.t) : cs[r.key] || 0, 3);
      return o;
    });
  }
  function record(ctx, s, mi, cls, act, t0, t1, r, tok) {
    const ms = s.m[mi];
    const pv = (p) => (ctx.mode === 'crit' ? p.r.total.crit : ctx.mode === 'noncrit' ? p.r.total.noncrit : p.r.total.expected);
    s.action = { t: t0, endT: t1, mi, cls, tok, key: act ? act.key : null, label: act ? act.label : ACTION_ZH[cls],
      damage: r ? r.d.value : 0, heal: r ? r.d.heal : 0, energyBefore: r ? r.eBefore : ms.energy, energyAfter: ms.energy,
      concertoBefore: r ? r.cBefore : ms.concerto, concertoAfter: ms.concerto,
      concertoSource: act ? act.concertoSource : null, lowHits: act ? act.lowHits : 0, extra: !!(act && act.extra),
      est: act ? !!act.est : (cls === 'S'), durSource: act ? act.durSource : 'default', durReason: act ? act.durReason || null : (cls === 'S' ? '切人时长：默认值' : null),
      frameLabel: act ? act.frameLabel || null : null, frameSrc: act ? act.frameSrc || null : null, frameLow: act ? act.frameLow || null : null, nextAction: act ? !!act.nextAction : false, timeStop: act ? act.timeStop || null : null, tsBasis: act ? act.tsBasis || null : null, timeStopSaved: act && act.durationFull > act.duration + EPS ? round(act.durationFull - act.duration, 4) : 0, endCut: act && act.duration > EPS && t0 + act.duration > ctx.duration + EPS ? round((ctx.duration - t0) / act.duration, 4) : null, swapReadyT: act && cls !== 'O' ? t0 + swapReadyOf(ctx, act) : null,
      module: !!(act && act.module), inferred: act ? act.inferred : null,
      stamina: ctx.stamina.enabled ? round(staminaAt(ctx, s, t1), 2) : null, staminaCost: s._staCost || 0 };
    s._staCost = 0;
    if (ctx._detail) {
      s.action.res = resSnapshot(ctx, s);
      if (r) {
        s.action.parts = r.d.parts.map((p) => ({ label: p.hit.label, element: p.r.element, type: p.r.type, count: p.hit.count || 1, value: pv(p), heal: p.r.heal, zones: p.r.zones, confidence: p.hit.confidence, lowReason: p.hit.lowReason }));
        s.action.panel = { atk: round(r.d.panel.atk, 2), hp: round(r.d.panel.hp, 2), critRate: round(r.d.panel.critRate, 4), critDmg: round(r.d.panel.critDmg, 4), energyRegen: round(r.d.panel.energyRegen, 4) };
      }
    }
  }

  /** Apply one action ({mi, act, meta} | {mi, swapTo} | {mi, wait}). Returns new state or null if illegal. */
  function applyAction(s, a, ctx) {
    const n = clone(s);
    const mi = a.mi;
    const mem = ctx.members[mi], ms = n.m[mi];
    if (a.wait != null) {
      n.t = Math.min(ctx.duration, s.t + a.wait); advanceAnomalies(ctx, n, n.t); pruneBuffs(n, ctx);
      n.action = { t: s.t, endT: n.t, mi, cls: 'W', tok: 'W' + round(a.wait, 2), label: '等待', damage: 0, energyBefore: ms.energy, energyAfter: ms.energy, concertoBefore: ms.concerto, concertoAfter: ms.concerto, est: false,
        stamina: ctx.stamina.enabled ? round(staminaAt(ctx, n, n.t), 2) : null };
      if (ctx._detail) n.action.res = resSnapshot(ctx, n);
      return n;
    }
    if (a.swapTo != null) return applySwap(n, s, a, ctx);
    const act = a.act, meta = a.meta || {};
    const e0 = ms.energy, c0 = ms.concerto;
    if (act.cls === 'R' && act.cost) {
      if (ms.energy < act.cost - EPS) return null;
      ms.energy -= act.cost;
      n.libs += 1;
    }
    if (act.cooldown) {
      if ((ms.cd[cdKey(act)] || 0) > s.t + EPS) return null;
      ms.cd[cdKey(act)] = s.t + act.cooldown;
    }
    const tEnd = Math.min(ctx.duration, s.t + act.duration);
    const sc = actStaminaCost(ctx, mem, act);
    if (sc > 0) {
      const cur = staminaAt(ctx, n, s.t);
      if (cur < sc - EPS) return null;
      n.sta = cur - sc; n.staFrom = tEnd + ctx.stamina.delay; n._staCost = sc;
    }
    const api = mkApi(ctx, n, mi, tEnd);
    const extra = mem.mod && mem.mod.actionStats ? mem.mod.actionStats(api, act, meta) || [] : [];
    // MECH.endCredit: an action cut by the fight window counts only its in-window fraction (no hit timings → linear); default 'prorate', config.endCredit='full' = old behaviour
    const frac = ctx.cfg.endCredit !== 'full' && act.duration > EPS ? Math.min(1, Math.max(0, (ctx.duration - s.t) / act.duration)) : 1;
    const r = addDamage(ctx, n, mi, act, extra, frac < 1 - EPS ? { times: frac } : undefined);
    // anomaly ticks during the action (applications by this action land at tEnd, after its damage)
    advanceAnomalies(ctx, n, tEnd);
    if (mem.mod && mem.mod.apply) mem.mod.apply(mkApi(ctx, n, mi, tEnd), act, meta);
    // triggered buffs apply from the NEXT hit (team decision): fire after damage
    fire(ctx, n, mi, 'cast', act.cls, null, act.key);
    // stream B B9: unified echo-cast event (echo skills and module actions flagged `echoCast`, e.g. 仇远 答剑); `echo` = name for “同名声骸仅一次”
    if (act.cls === 'Q' || act.echoCast) dispatch(ctx, n, { type: 'echoCast', mi, key: act.key, echo: act.echoName || (act.cls === 'Q' ? (act.label || act.key) : mi + ':' + act.key), t: n.t, tEnd });
    if ((act.hits || []).some((h) => h.calc === 'heal')) fire(ctx, n, mi, 'heal', act.cls);
    if (!act.ownStage) {
      if (act.cls === 'A' && act.stage) ms.stage = act.stage % Math.max(1, mem.kit.stages.length);
      else ms.stage = 0;
    }
    n.t = tEnd;
    record(ctx, n, mi, act.cls, act, s.t, n.t, r, a.tok);
    n.action.energyBefore = e0; n.action.concertoBefore = c0; if (act.cls === 'R' && act.cost) n.action.energyCost = act.cost;
    pruneBuffs(n, ctx);
    return n;
  }

  function applySwap(n, s, a, ctx) {
    const mi = a.mi, j = a.swapTo;
    if (j === mi || j >= ctx.members.length) return null;
    const mem = ctx.members[mi], ms = n.m[mi];
    // swap-cancel: the outgoing member's last action may be left at its swap-ready point (SWAP_RULE, engine assumption);
    // its damage is fully counted, the remaining animation overlaps the incoming member.
    const la = s.action;
    if (la && la.mi === mi && la.swapReadyT != null && la.endT === s.t && la.swapReadyT < s.t - EPS && la.cls !== 'W' && la.cls !== 'S') {
      n.t = Math.max(la.t, la.swapReadyT);
      n.swapCut = (n.swapCut || 0) + 1;
    }
    const swapCutFrom = n.t < s.t - EPS ? s.t : null;
    const full = ms.concerto >= 100 - EPS;
    const so = mem.mod && mem.mod.swapOut ? mem.mod.swapOut(mkApi(ctx, n, mi), j) || {} : {};
    const trig = full || !!so.force;
    let outroAction = null;
    n.swaps += 1;
    if (trig) {
      const rO0 = mem.mod && mem.mod.resolve ? mem.mod.resolve(mkApi(ctx, n, mi), 'O') : null;
      const O = (rO0 && rO0.act) || mem.kit.O;
      const c0 = ms.concerto;
      const rO = O && O.hits.length ? addDamage(ctx, n, mi, O) : null;
      if (mem.veilAct) sideDamage(ctx, n, mi, mem.veilAct, { coord: false, noGain: true });
      fire(ctx, n, mi, 'outro', 'O', j);
      if (mem.mod && mem.mod.onOutro) mem.mod.onOutro(mkApi(ctx, n, mi), j);
      if (!so.force) ms.concerto = 0; // 同奏-type forced outro keeps concerto (今汐: “只消耗同奏效果”)
      record(ctx, n, mi, 'O', O, n.t, n.t, rO, a.tok);
      n.action.concertoBefore = c0; n.action.concertoAfter = ms.concerto; n.action.est = true; // 0 s on the outgoing side (assumption, flagged via durReason)
      n.action.forced = !!so.force && !full; n.action.forceReason = n.action.forced ? (so.reason || 'module') : null;
      outroAction = n.action;
      dispatch(ctx, n, { type: 'outro', mi, to: j, t: n.t, forced: n.action.forced, reason: n.action.forceReason });
    }
    expireOnSwap(n, mi);
    n.active = j;
    const inc = ctx.members[j];
    const t0 = n.t;
    let I = null, meta = {};
    if (trig) {
      const rI = inc.mod && inc.mod.resolve ? inc.mod.resolve(mkApi(ctx, n, j), 'I') : null;
      I = (rI && rI.act) || inc.kit.I; meta = (rI && rI.meta) || {};
    }
    if (I) {
      const tEnd = Math.min(ctx.duration, t0 + I.duration);
      const extra = inc.mod && inc.mod.actionStats ? inc.mod.actionStats(mkApi(ctx, n, j, tEnd), I, meta) || [] : [];
      const rI = addDamage(ctx, n, j, I, extra);
      advanceAnomalies(ctx, n, tEnd);
      if (inc.mod && inc.mod.apply) inc.mod.apply(mkApi(ctx, n, j, tEnd), I, meta);
      fire(ctx, n, j, 'intro', 'I', null, I.key);
      n.m[j].stage = 0;
      n.t = tEnd;
      record(ctx, n, j, 'I', I, t0, n.t, rI, a.tok);
      dispatch(ctx, n, { type: 'intro', mi: j, t: t0 });
    } else {
      const sd = (ctx.cfg.durations && ctx.cfg.durations.S != null) ? ctx.cfg.durations.S : DEFAULT_DURATIONS.S;
      n.t = Math.min(ctx.duration, t0 + sd);
      advanceAnomalies(ctx, n, n.t);
      record(ctx, n, j, 'S', null, t0, n.t, null, a.tok);
      n.action.est = !(ctx.cfg.durations && ctx.cfg.durations.S != null);
      dispatch(ctx, n, { type: 'swap', mi: j, from: mi, t: t0 });
    }
    if (outroAction) n.action.pre = [outroAction];
    if (swapCutFrom != null) { n.action.swapCut = { from: swapCutFrom, at: t0, rule: ctx.cfg.swapRule || SWAP_RULE.id }; }
    pruneBuffs(n, ctx);
    return n;
  }

  // ------------------------------------------------------------------ manual sequences
  /**
   * Token grammar (whitespace/comma separated):
   *   [m]A [m]H [m]E [m]R [m]Q   button press of member m (1-based; omitted = on-field member).
   *                              With a character module the button resolves to the current form (e.g. 今汐 E → 神霓飞芒/逐天取月/惊龙破空).
   *   [m]X<k>                    generic extra action #k (no resource gating; low confidence)
   *   S<j>                       swap to member j (outro + intro when concerto full or module forces it)
   *   W<sec>                     wait
   */
  function parseSequence(text) {
    const toks = String(text || '').trim().split(/[\s,>]+/).filter(Boolean);
    return toks.map((tk) => {
      let m = /^([1-3])?(A|H|E|R|Q)$/i.exec(tk); if (m) return { m: m[1] ? +m[1] - 1 : null, t: m[2].toUpperCase(), raw: tk };
      m = /^([1-3])?X(\d+)$/i.exec(tk); if (m) return { m: m[1] ? +m[1] - 1 : null, t: 'X', x: +m[2], raw: tk };
      m = /^S([1-3])$/i.exec(tk); if (m) return { t: 'S', to: +m[1] - 1, raw: tk };
      m = /^W(\d+(?:\.\d+)?)$/i.exec(tk); if (m) return { t: 'W', w: +m[1], raw: tk };
      return { t: '?', raw: tk };
    });
  }

  function runSequence(ctx, text, opt) {
    opt = opt || {};
    const onBlocked = opt.onBlocked || 'wait';
    const plan = parseSequence(text);
    let s = initialState(ctx);
    const steps = [];
    for (const p of plan) {
      if (s.t >= ctx.duration - EPS) { steps.push({ raw: p.raw, ok: false, reason: '超出时长' }); continue; }
      let a = null, reason = null;
      if (p.t === '?') reason = '无法识别的指令';
      else if (p.t === 'W') a = { mi: s.active, wait: p.w };
      else if (p.t === 'S') {
        if (p.to >= ctx.members.length) reason = '编队无此位';
        else if (p.to === s.active) reason = '已在场';
        else a = { mi: s.active, swapTo: p.to, tok: 'S' + (p.to + 1) };
      } else {
        const mi = p.m == null ? s.active : p.m;
        if (mi >= ctx.members.length) reason = '编队无此位';
        else if (mi !== s.active) reason = `${ctx.members[mi].R.name} 不在场（先 S${mi + 1}）`;
        else if (p.t === 'X') {
          const act = ctx.members[mi].kit.extras[p.x];
          if (!act) reason = `${ctx.members[mi].R.name} 无 ${p.raw} 动作`;
          else a = { mi, act, tok: p.raw };
        } else {
          let r = resolveButton(ctx, s, mi, p.t);
          if (r.blocked && r.cdWait != null && onBlocked === 'wait') {
            s = applyAction(s, { mi, wait: r.cdWait }, ctx);
            steps.push({ raw: 'W' + round(r.cdWait, 2), ok: true, auto: true, reason: '等待冷却' });
            r = resolveButton(ctx, s, mi, p.t);
          }
          if (r.blocked) { reason = r.blocked; p.noStamina = !!r.noStamina; }
          else a = { mi, act: r.act, meta: r.meta, tok: p.raw };
        }
      }
      if (!a) { steps.push({ raw: p.raw, ok: false, reason, noStamina: !!p.noStamina, t: p.noStamina ? round(s.t, 3) : undefined, mi: p.noStamina ? s.active : undefined, stamina: p.noStamina ? round(staminaAt(ctx, s, s.t), 1) : undefined }); continue; }
      const n = applyAction(s, a, ctx);
      if (!n) { steps.push({ raw: p.raw, ok: false, reason: '非法动作' }); continue; }
      s = n; steps.push({ raw: p.raw, ok: true, key: a.act ? a.act.key : null, label: a.act ? a.act.label : null, est: n.action ? !!n.action.est : false,
        dur: n.action ? durKind(n.action) : null, durReason: n.action && durKind(n.action) === 'default' ? (n.action.durReason || '默认时长') : null });
    }
    return { state: s, steps };
  }

  // ------------------------------------------------------------------ search
  function stateKey(s, ctx) {
    return [Math.round(s.t * 100), s.active,
      s.m.map((x) => [Math.round(x.energy * 10), Math.round(x.concerto * 10), x.stage,
        Object.entries(x.cd).filter(([, v]) => v > s.t + EPS).map(([k, v]) => k + Math.round((v - s.t) * 10)).sort().join('.'),
        x.cs ? JSON.stringify(x.cs, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)) : ''].join('|')).join('/'),
      s.buffs.filter((b) => b.until > s.t + EPS).map((b) => b.id + '@' + b.target + 'x' + b.stacks + ':' + Math.round((b.until - s.t) * 10)).sort().join(','),
      Object.entries(s.an || {}).filter(([, a]) => a.n).map(([k, a]) => k + a.n + '/' + a.cap + (a.burst ? 'b' + a.burst : '') + ':' + (a.until == null ? '' : Math.round((a.until - s.t) * 10)) + ':' + (a.next == null ? '' : Math.round((a.next - s.t) * 10))).sort().join(','),
      s.sta != null && ctx ? Math.round(staminaAt(ctx, s, s.t) / 10) : ''].join('#');
  }
  /**
   * MECH.residual — search terminal value: buffs/states that persist past the window end, valued as remaining time (capped at
   * search.residualHorizon, default = window length) × the holder's sustained damage rate × the buff's relative gain (on-field ×1,
   * others ×0.5, same weights as the in-window buff term), plus module residual(api, D, H) hooks (守岸人 星域 …).
   * Used only to rank search candidates (heuristic + final pick); never added to reported damage.
   */
  const RESIDUAL_DEFAULT = { weight: 0.5, horizon: 15 };
  function residualValue(ctx, s) {
    if (!ctx.residualOn) return 0;
    const D = ctx.duration, H = residualHorizon(ctx);
    let v = 0; const seen = new Set();
    for (const ab of s.buffs) {
      if (ab.until <= D + EPS) continue;
      const kk = ab.id + '@' + ab.target; if (seen.has(kk)) continue; seen.add(kk);
      const rem = Math.min(ab.until - Math.max(D, ab.start), H);
      if (rem <= 0) continue;
      v += rem * (ctx.rate[ab.target] || 0) * buffGain(ctx, ab.target, ab.id, ab.stacks) * (ab.target === s.active ? 1 : 0.5);
    }
    ctx.members.forEach((mem, i) => { if (mem.mod && mem.mod.residual) v += Math.max(0, mem.mod.residual(mkApi(ctx, s, i), D, H) || 0); });
    return v;
  }
  function residualWeight(ctx) { return ctx.search.residualWeight == null ? RESIDUAL_DEFAULT.weight : ctx.search.residualWeight; }
  function residualHorizon(ctx) { return ctx.search.residualHorizon || Math.min(ctx.duration, RESIDUAL_DEFAULT.horizon); }
  /** 稳态开局 loops: end-of-loop energy / concerto / module resources carry into the next loop → terminal value (ranking only) */
  function carryValue(ctx, s) {
    const w = ctx.search.potentialWeight || 0; let v = 0;
    ctx.members.forEach((mem, i) => {
      const cost = maxEnergy(mem);
      if (cost) v += Math.min(1, s.m[i].energy / cost) * ctx.potential[i].R;
      v += (s.m[i].concerto / 100) * ctx.potential[i].IO;
      if (mem.mod && mem.mod.potential) v += (mem.mod.potential(mkApi(ctx, s, i)) || 0);
    });
    return w * v;
  }
  function heuristic(ctx, s) {
    const w = ctx.search.potentialWeight || 0;
    // time-normalised: remaining time valued at the best sustained filler rate, so fast and slow actions compare fairly
    let v = s.damage + Math.max(0, ctx.duration - s.t) * (ctx.baseRate || 0) * (ctx.search.timeWeight == null ? 1 : ctx.search.timeWeight);
    v += anomalyPending(ctx, s);
    if (ctx.residualOn) v += residualWeight(ctx) * residualValue(ctx, s);
    if (!w) return v;
    // active buffs: remaining time × target's filler rate × gain (on-field member counts fully, others half)
    const seenB = new Set();
    const bw = ctx.search.buffWeight == null ? 0.5 : ctx.search.buffWeight;
    if (bw) for (const ab of s.buffs) {
      if (ab.until <= s.t + EPS || ab.start > s.t + EPS) continue;
      const kk = ab.id + '@' + ab.target; if (seenB.has(kk)) continue; seenB.add(kk);
      const rem = Math.min(ab.until, ctx.duration) - s.t;
      if (rem <= 0) continue;
      v += w * bw * rem * (ctx.rate[ab.target] || 0) * buffGain(ctx, ab.target, ab.id, ab.stacks) * (ab.target === s.active ? 1 : 0.5);
    }
    ctx.members.forEach((mem, i) => {
      const cost = maxEnergy(mem);
      if (cost) v += w * Math.min(1, s.m[i].energy / cost) * ctx.potential[i].R;
      v += w * (s.m[i].concerto / 100) * ctx.potential[i].IO;
      if (mem.mod && mem.mod.potential) v += w * (mem.mod.potential(mkApi(ctx, s, i)) || 0);
    });
    return v;
  }
  /** search heuristic: damage of anomaly ticks still pending inside the fight window (static estimate, no buffs) */
  function anomalyEst(ctx, type, owner, stacks) {
    const k = type + '|' + owner + '|' + stacks;
    ctx.anEst = ctx.anEst || new Map();
    if (!ctx.anEst.has(k)) {
      const def = anomDef(ctx, type);
      let v = 0;
      if (def && ctx.anom && def.table) {
        const mem = ctx.members[owner];
        const base = ctx.anom.levelBase[Math.max(0, mem.level - 1)];
        const d = defenseMultiplier(mem.level, ctx.enemy.level, ctx.enemy.defIgnore, ctx.enemy.defReduce, ctx.enemy.defOverride).value;
        const r = ctx.enemy.resByElement && ctx.enemy.resByElement[def.element] != null ? ctx.enemy.resByElement[def.element] : ctx.enemy.resTier;
        v = base * anomMult(def.table, stacks) * d * resistanceMultiplier(r - (ctx.enemy.resShred || 0));
      }
      ctx.anEst.set(k, v);
    }
    return ctx.anEst.get(k);
  }
  function anomalyPending(ctx, s) {
    if (!s.an || !ctx.anom) return 0;
    let v = 0;
    const D = ctx.duration;
    for (const [k, a] of Object.entries(s.an)) {
      if (!a.n || a.ext || a.owner == null) continue;
      const def = anomDef(ctx, k); if (!def) continue;
      if (k === 'burst') { v += 0.5 * (a.n / a.cap) * anomalyEst(ctx, k, a.owner, a.cap); continue; }
      if (a.next == null || !(def.period > 0)) continue;
      let n = a.n, t = a.next, until = a.until == null ? D : a.until;
      for (let g = 0; g < 40 && t < Math.min(D, k === 'frazzle' ? Infinity : until) - EPS && n > 0; g++) {
        v += anomalyEst(ctx, k, a.owner, n);
        if (k === 'frazzle') { if (!noDecayAt(a, s.t)) n -= 1; } else if (k === 'flare' && !noDecayAt(a, s.t)) n = Math.floor(n * 0.5);
        t += def.period * (a.periodScale || 1);
      }
    }
    return v;
  }
  function tokensOf(s) { const out = []; let n = s; while (n) { if (n.action && n.action.tok) out.push(n.action.tok); n = n.prev; } return out.reverse(); }
  function timelineOf(s) {
    const out = []; let n = s;
    while (n) {
      if (n.action) {
        const grp = [];
        if (n.action.pre) grp.push(...n.action.pre);
        grp.push(n.action);
        if (n.sides) grp.push(...n.sides);
        out.push(grp);
      }
      n = n.prev;
    }
    return out.reverse().flat();
  }
  // B12b: non-dps module member on field whose real liberation (energy cost > 0) is castable with time to spare → must not swap out yet
  function supportHold(ctx, s, acts) {
    const mem = ctx.members[s.active];
    if (ctx.members.length < 2 || !mem.mod || (mem.mod.audit && mem.mod.audit.role === 'dps')) return false;
    return acts.some((a) => a.tok === 'R' && a.act && a.act.cls === 'R' && a.act.cost > 0 && ctx.duration - s.t > (a.act.duration || 0) + 1);
  }
  /** does a token sequence obey the support cycle? (replay; used to admit unconstrained-search results that happen to comply) */
  function supportCompliant(ctx, seq) {
    let s = initialState(ctx);
    const prevX = ctx._allowExtras; ctx._allowExtras = true;
    try {
      for (const tok of String(seq).split(/\s+/).filter(Boolean)) {
        const acts = actionsFor(s, ctx);
        const a = acts.find((x) => x.tok === tok);
        if (!a) return true; // replay diverged (wait / blocked tokens): do not judge
        if (a.swapTo != null && supportHold(ctx, s, acts)) return false;
        const n = applyAction(s, a, ctx); if (!n) return true;
        s = n;
      }
      return true;
    } finally { ctx._allowExtras = prevX; }
  }
  function searchActs(s, ctx) {
    const acts = actionsFor(s, ctx);
    const last = s.action;
    const mem = ctx.members[s.active];
    // stream B B12a (resource lookahead, search only): a module may hold back a weaker version of a finisher while its strong version is
    // reachable inside the remaining window — mod.hold(api, act, remaining) → reason string | falsy (露西 网络行者 vs 暗网深潜, 丹瑾 缭乱 60 vs 120 彤华).
    // Manual sequences are never affected; config.search.hold === false disables it.
    const hold = ctx.search.hold !== false && mem.mod && mem.mod.hold ? mem.mod.hold : null;
    let api = null;
    // stream B B12b (support cycle, search only): a non-dps member on field with its R castable must cast R before swapping out
    // (intro → skill → R → outro); config.search.supportCycle === false disables it
    const holdSwap = ctx.search.supportCycle !== false && supportHold(ctx, s, acts);
    return acts.filter((a) => {
      if (a.swapTo != null && last && last.cls === 'S') return false;
      if (holdSwap && a.swapTo != null) return false;
      if (hold && a.act && a.mi === s.active) { api = api || mkApi(ctx, s, s.active); if (hold(api, a.act, ctx.duration - s.t)) return false; }
      return true;
    });
  }

  /** Bounded beam search over action sequences. Deterministic (stable tie-break on token string). */
  function beamSearch(ctx, budget) {
    const B = Object.assign({}, ctx.search, budget || {});
    const prevExtras = ctx._allowExtras;
    ctx._allowExtras = !!B.allowExtras;
    const t0 = Date.now();
    let frontier = [initialState(ctx)];
    let expanded = 0, rounds = 0;
    const finals = [];
    while (frontier.length && expanded < B.maxExpansions && rounds < 1000) {
      rounds++;
      const cand = [];
      for (const s of frontier) {
        if (s.t >= ctx.duration - EPS) { finals.push(s); continue; }
        let any = false;
        for (const a of searchActs(s, ctx)) {
          const n = applyAction(s, a, ctx);
          if (!n) continue;
          expanded++; any = true; cand.push(n);
        }
        if (!any) finals.push(s);
      }
      if (!cand.length) break;
      const byKey = new Map();
      for (const c of cand) {
        const k = stateKey(c, ctx);
        const e = byKey.get(k);
        if (!e || c.damage > e.damage + EPS || (Math.abs(c.damage - e.damage) <= EPS && tokensOf(c).join(' ') < tokensOf(e).join(' '))) byKey.set(k, c);
      }
      const scored = [...byKey.values()].map((c) => ({ c, h: heuristic(ctx, c), k: tokensOf(c).join(' ') }));
      scored.sort((a, b) => (b.h - a.h) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
      frontier = scored.slice(0, B.beamWidth).map((x) => x.c);
    }
    finals.push(...frontier);
    ctx._allowExtras = prevExtras;
    const uniq = new Map();
    for (const f of finals) { const k = tokensOf(f).join(' '); if (!uniq.has(k) || uniq.get(k).damage < f.damage) uniq.set(k, f); }
    // final pick: damage (+ residual terminal value when on; ranking only)
    const rw = ctx.residualOn ? residualWeight(ctx) : 0;
    const scoreOf = (st) => { if (st._res == null) { st._res = rw ? residualValue(ctx, st) : 0; st._carry = ctx.steadyLoop ? carryValue(ctx, st) : 0; } return st.damage + rw * st._res + st._carry; };
    const ranked = [...uniq.entries()].sort((a, b) => (scoreOf(b[1]) - scoreOf(a[1])) || (a[0] < b[0] ? -1 : 1));
    return { ranked: ranked.slice(0, B.topN).map(([k, st]) => ({ sequence: k, damage: st.damage, dps: st.damage / ctx.duration, t: st.t, liberations: st.libs, swaps: st.swaps,
      residual: rw ? round(st._res, 1) : undefined })), residual: rw ? { weight: rw, horizon: residualHorizon(ctx) } : null,
      expanded, rounds, truncated: expanded >= B.maxExpansions, ms: Date.now() - t0, budget: { beamWidth: B.beamWidth, maxExpansions: B.maxExpansions, allowExtras: !!B.allowExtras } };
  }

  /** Greedy baseline policy: highest damage per second among non-swap actions. */
  function runPolicy(ctx) {
    let s = initialState(ctx); let guard = 0;
    while (s.t < ctx.duration - EPS && guard++ < 1000) {
      let best = null, bv = -1;
      for (const a of actionsFor(s, ctx)) {
        if (a.swapTo != null) continue;
        const n = applyAction(s, a, ctx); if (!n) continue;
        const v = (n.damage - s.damage) / Math.max(0.05, n.t - s.t);
        if (v > bv) { bv = v; best = n; }
      }
      if (!best) break;
      s = best;
    }
    return s;
  }

  // ------------------------------------------------------------------ simulate (full result)
  function buffUptime(ctx, finalState) {
    const res = new Map();
    for (const b of finalState.buffs) {
      const k = b.id + '@' + b.target;
      if (!res.has(k)) res.set(k, { id: b.id, target: b.target, intervals: [], maxStacks: 0 });
      const r = res.get(k);
      const a = Math.max(0, b.start), e = Math.min(ctx.duration, b.until);
      if (e > a) r.intervals.push([a, e]);
      // past the window end: not counted in damage (view: i.residual)
      if (b.until > ctx.duration + EPS && b.start < ctx.duration + EPS) { r.residual = r.residual || []; r.residual.push([round(Math.max(ctx.duration, b.start), 3), round(b.until, 3)]); }
      if (b.carried && b.start < 0) r.carried = true;
      r.maxStacks = Math.max(r.maxStacks, b.stacks);
    }
    for (const r of res.values()) {
      r.intervals.sort((x, y) => x[0] - y[0]);
      const m = [];
      for (const iv of r.intervals) { if (m.length && iv[0] <= m[m.length - 1][1] + EPS) m[m.length - 1][1] = Math.max(m[m.length - 1][1], iv[1]); else m.push(iv.slice()); }
      r.intervals = m.map(([a, b]) => [round(a, 3), round(b, 3)]);
      r.uptime = m.reduce((s2, iv) => s2 + iv[1] - iv[0], 0) / ctx.duration;
      if (r.residual) { r.residual.sort((x, y) => x[0] - y[0]); const q = []; for (const iv of r.residual) { if (q.length && iv[0] <= q[q.length - 1][1] + EPS) q[q.length - 1][1] = Math.max(q[q.length - 1][1], iv[1]); else q.push(iv.slice()); } r.residual = q; }
    }
    return [...res.values()];
  }

  function moduleInfo(m) {
    if (!m.mod) return { module: false, searchable: false, reason: '无角色模块：专属资源/强化动作未建模，仅支持手动序列', resources: [] };
    return { module: true, searchable: true, name: m.mod.name, version: m.mod.version, confidence: m.mod.confidence, notes: m.mod.notes || [],
      resources: (m.mod.resources || []).map((r) => ({ key: r.key, name: r.name, max: r.max, segmented: !!r.segmented, confidence: r.confidence || m.mod.confidence, basis: r.basis || null })) };
  }

  function simulate(config, data) {
    const idx = ensureIndex(data);
    const steady = !!(config && config.start && config.start.steady);
    let ctx = buildContext(config, idx);
    let seq = ctx.cfg.rotation.sequence || '';
    let search = null;
    const wantSearch = ctx.cfg.rotation.mode === 'search' || !seq;
    const pick = (c) => {
      if (!(wantSearch && c.searchable)) return { search: null, seq };
      let sr = beamSearch(c);
      // B12b: the support-cycle constraint narrows the beam; also search unconstrained and admit its results when they comply anyway
      if (c.members.length > 1 && c.cfg.search.supportCycle !== false) {
        const sv = c.search.supportCycle; c.search.supportCycle = false;
        const su = beamSearch(c); c.search.supportCycle = sv;
        const ok = su.ranked.filter((x) => supportCompliant(c, x.sequence));
        if (ok.length && (!sr.ranked.length || ok[0].damage > sr.ranked[0].damage + EPS)) {
          const seen = new Set(); sr.ranked = ok.concat(sr.ranked).filter((x) => !seen.has(x.sequence) && seen.add(x.sequence)).slice(0, Math.max(sr.ranked.length, ok.length));
          sr.supportCycle = 'unconstrained-compliant';
        } else sr.supportCycle = 'constrained';
        sr.expanded += su.expanded; sr.ms += su.ms;
      }
      // teams with residual guidance: re-search with realised per-member rates (search heuristic only)
      if (c.residualOn && c.members.length > 1 && c.cfg.search.calibrate === true && sr.ranked.length) {
        const rr = runSequence(c, sr.ranked[0].sequence, { onBlocked: c.cfg.rotation.onBlocked });
        const rates = realizedRates(c, rr.state);
        calibrateRates(c, rates);
        const sr2 = beamSearch(c);
        sr2.calibration = { filler: c.rateFiller.map((x) => round(x, 1)), realised: rates.map((x) => round(x, 1)), firstPass: sr.ranked[0].sequence };
        sr = sr2;
      }
      return { search: sr, seq: sr.ranked.length ? sr.ranked[0].sequence : '' };
    };
    // 稳态开局: loop k starts from loop k−1's end state (cold loop first); the last loop is reported
    let steadyInfo = null;
    if (steady) {
      const loops = Math.max(1, Math.min(4, config.start.steadyLoops || 2));
      let prev = null; const hist = [];
      for (let k = 0; k <= loops; k++) {
        const c = buildContext(config, idx);
        c.carryFrom = prev; c.steadyLoop = true;
        const p = pick(c);
        const rr = runSequence(c, p.seq, { onBlocked: c.cfg.rotation.onBlocked });
        hist.push({ loop: k, carried: !!prev, sequence: p.seq, total: round(rr.state.damage, 1) });
        if (k === loops) { ctx = c; search = p.search; seq = p.seq; break; }
        advanceAnomalies(c, rr.state, c.duration);
        rr.state.t = c.duration;
        prev = rr.state;
      }
      steadyInfo = { loops, history: hist, carried: carrySummary(ctx, (() => { const st0 = initialState(ctx); return st0; })()) };
    } else {
      const p = pick(ctx); search = p.search; seq = p.seq;
    }
    ctx._detail = true;
    const run = runSequence(ctx, seq, { onBlocked: ctx.cfg.rotation.onBlocked });
    const s = run.state;
    // anomaly ticks after the last action still fall inside the fight window
    if (s.t < ctx.duration - EPS && s.an && Object.values(s.an).some((a) => a.n && !a.ext)) {
      const before = s.sides ? s.sides.length : 0;
      advanceAnomalies(ctx, s, ctx.duration);
      if (s.sides && s.sides.length > before && !s.action) s.action = null;
    } else advanceAnomalies(ctx, s, ctx.duration);
    const up = buffUptime(ctx, s);
    const upOf = (id) => up.filter((u) => u.id === id);
    const timeline = timelineOf(s);
    return {
      engine: VERSION, dataVersion: idx.meta.version, sourceCommit: idx.meta.source_commit, config: ctx.cfg, mech: MECH,
      duration: ctx.duration, mode: ctx.mode, enemy: ctx.enemy, sequence: seq, steps: run.steps,
      searchable: ctx.searchable, searchDisabledReason: ctx.searchable ? null : ctx.searchReason, searchSkipped: wantSearch && !ctx.searchable,
      framesLoaded: !!ctx.frames, framesRef: ctx.frames ? (() => { const fx = framesIndex(ctx.frames); return { version: (fx && fx.version) || ctx.frames.version || null, source: (fx && fx.source) || ctx.frames.source || null, swapRule: ctx.cfg.swapRule || SWAP_RULE.id }; })() : null,
      swapRule: Object.assign({}, SWAP_RULE, { id: ctx.cfg.swapRule || SWAP_RULE.id }),
      total: s.damage, dps: s.damage / ctx.duration, heal: s.heal, perMember: s.perMember, byType: s.byType, swaps: s.swaps, liberations: s.libs, endT: s.t,
      timeline,
      // MECH.timeStop: seconds removed from the fight clock by timeStop='exclude' (Σ durationFull − duration over executed actions); 0 under 'include'
      timeStopSaved: round(timeline.reduce((acc, x) => acc + (x.timeStopSaved || 0), 0), 3), timeStopMode: ctx.cfg.timeStop || 'exclude',
      tailFreeze: tailFreezeOf(timeline, ctx.duration, s.damage),
      final: s.m.map((x, i) => ({ energy: x.energy, energyMax: maxEnergy(ctx.members[i]), concerto: x.concerto, resources: resSnapshot(ctx, s)[i] })),
      members: ctx.members.map((m, i) => Object.assign({ index: i, id: m.R.id, name: m.R.name, nameEn: m.R.nameEn, element: m.el, level: m.level, chain: m.chain,
        chainCfg: m.chainCfg, chainModeled: m.chainModeled,
        weapon: m.weapon ? { id: m.weapon.id, name: m.weapon.name } : null, sonatas: m.sonataActive, echoCost: m.echoCost,
        panel: summarizePanel(finalPanel(m, [])), sources: m.sources,
        buffs: m.buffDefs.map((b) => Object.assign({}, b, { uptime: b.mode === 'on' && !b.unmodeled && b.kind !== 'manual' ? 1 : upOf(b.id).reduce((mx, u) => Math.max(mx, u.uptime), 0), from: b.from === undefined ? undefined : b.from, to: b.to === Infinity ? null : b.to })),
        kit: kitSummary(m) }, { moduleInfo: moduleInfo(m) })),
      buffUptime: up,
      warnings: collectWarnings(ctx, run, timeline),
      search,
      // search/start mode (view: .ww-tag.mode.steady / .residual)
      runMode: steadyInfo ? { kind: 'steady', loops: steadyInfo.loops, history: steadyInfo.history, carried: steadyInfo.carried, residual: ctx.residualOn,
        reason: `稳态开局（start.steady）：先冷启动跑一轮，再以上一轮结束状态（在场角色、能量、协奏、冷却、增益、异常效应、模块资源）作为开局，重复 ${steadyInfo.loops} 轮，报告最后一轮` + (ctx.residualOn ? '；搜索同时使用残值引导' : '') }
        : ctx.residualOn && search ? { kind: 'residual', reason: ctx.residualReason, residual: true } : null,
      residual: ctx.residualOn ? { value: round(residualValue(ctx, s), 1), weight: residualWeight(ctx), horizon: residualHorizon(ctx), mech: MECH.residual } : null,
      anomalies: { log: ctx._anLog || [], types: ctx.anom ? Object.fromEntries(Object.entries(ctx.anom.types).map(([k, d]) => [k, { zh: ANOMALY_ZH[k], element: d.element, cap: d.cap, duration: d.duration, period: d.period }])) : {},
        mech: { base: MECH.anomalyBase, zones: MECH.anomalyZones, timing: MECH.anomalyTiming } },
      stamina: ctx.stamina.enabled ? { max: ctx.stamina.max, regen: ctx.stamina.regen, delay: ctx.stamina.delay, shared: true, mech: MECH.stamina, costs: ctx.members.map((m) => m.staCost) } : null,
    };
  }
  function summarizePanel(p) { return { atk: round(p.atk, 2), hp: round(p.hp, 2), def: round(p.def, 2), critRate: round(p.critRate, 4), critDmg: round(p.critDmg, 4), energyRegen: round(p.energyRegen, 4), healBonus: round(p.healBonus, 4), raw: p.raw }; }
  function kitSummary(m) {
    const k = m.kit;
    const f = (a) => a && { key: a.key, cls: a.cls, label: a.label, hits: a.hits.length, level: a.level, duration: a.duration, est: a.est, durSource: a.durSource, energy: round(a.energy, 3), concerto: round(a.concerto, 3),
      concertoSource: a.concertoSource, cooldown: a.cooldown, cost: a.cost, lowHits: a.lowHits, xid: a.xid, inferred: a.inferred || undefined };
    const out = { A: k.stages.map(f), H: f(k.H), E: f(k.E), R: f(k.R), I: f(k.I), O: f(k.O), Q: f(k.Q), extras: k.extras.map(f) };
    if (m.modKit) out.module = Object.values(m.modKit).map(f);
    return out;
  }
  function collectWarnings(ctx, run, timeline) {
    const w = ctx.warnings.map((x) => Object.assign({ mech: null }, x));
    const real = timeline.filter((a) => a.cls !== 'W' && !a.coord && !a.status);
    const defActs = real.filter((a) => a.est && a.durSource !== 'frames');
    const frActs = real.filter((a) => a.durSource === 'frames');
    if (defActs.length) {
      const D = Object.assign({}, DEFAULT_DURATIONS, ctx.cfg.durations || {});
      w.push({ level: 'info', mech: 'unsolved', code: 'dur-default', text: `${defActs.length}/${real.length} 个动作时长为默认/模块估计值（${ctx.frames ? 'action_frames 未覆盖或为 null' : '未加载 action_frames.json'}；默认 A ${D.A}s/段 · H ${D.H}s · E ${D.E}s · R ${D.R}s · Q ${D.Q}s · 变奏 ${D.I}s · 切人 ${D.S}s），时间轴以 est 标记，dur='default'，原因见 durReason` });
    }
    if (frActs.length) {
      const fx = framesIndex(ctx.frames);
      const kc = {}; frActs.forEach((a) => { const k = a.frameSrc || 'wuwalab'; kc[k] = (kc[k] || 0) + 1; });
      w.push({ level: 'info', mech: 'community', code: 'dur-frames', text: `${frActs.length}/${real.length} 个动作时长取自 action_frames（${Object.entries(kc).map(([k, n]) => `${FRAME_SRC_ZH[k] || k} ${n}`).join('、')}；WuwaLAB 按 60fps 换算、未标注测量版本；WuWaSim 为 3.6 客户端“可接下一动作”时刻），仍为社区数据，标 est、dur='frames'` });
      w.push({ level: 'info', mech: SWAP_RULE.mech, code: 'swap-rule', text: `切人时机（${ctx.cfg.swapRule || SWAP_RULE.id}）：${SWAP_RULE.basis}` + (run && run.state && run.state.swapCut ? `；本轮 ${run.state.swapCut} 次提前切人` : '') });
    }
    if (ctx.frames) {
      const fx = framesIndex(ctx.frames);
      ctx.members.forEach((m, i) => {
        if (fx && fx.scraper && !(fx.byName.get(m.R.name) || (m.R.nameEn && fx.byName.get(m.R.nameEn)))) w.push({ level: 'warn', member: i, mech: 'unsolved', code: 'frames-missing', text: `${m.R.name}: action_frames 中没有该角色，全部动作使用默认时长` });
      });
      // per-source semantics + low-confidence sources + relevant discrepancies (round 3)
      ctx.members.forEach((m, i) => {
        const acts = timeline.filter((a) => a.mi === i && !a.status && a.frameSrc);
        const kinds = [...new Set(acts.map((a) => a.frameSrc))];
        if (kinds.includes('wuwasim')) w.push({ level: 'info', member: i, mech: 'community', code: 'frames-wuwasim', text: `${m.R.name}: 动作时长取自 WuWaSim（3.6 客户端导出）：duration_s 为“可接下一动作”的时刻（非完整动画），无取消帧；与 WuwaLAB 同时存在的动作上平均短约 0.083 s（中位数），两者不混用` });
        if (kinds.includes('riley')) w.push({ level: 'warn', member: i, mech: 'unsolved', code: 'frames-lowconf', text: `${m.R.name}: 动作时长取自 Riley31415/wuwa_calc（未注明游戏版本与帧数出处），低置信` });
        if (fx && fx.disc) {
          const ds = fx.disc.filter((x) => x.character && (x.character.startsWith(m.R.name + '（') || x.character === m.R.name));
          const labs = new Set(acts.map((a) => (a.frameLabel || '').replace(/\s*\[[^\]]+\]$/, '')));
          const rel = ds.filter((x) => !x.action || labs.has(x.action) || [...labs].some((l) => l.endsWith(x.action)));
          if (rel.length) w.push({ level: 'warn', member: i, mech: 'unsolved', code: 'frames-discrepancy', text: `${m.R.name}: action_frames 来源冲突 ${rel.length} 项（${rel.slice(0, 3).map((x) => (x.action || x.field) + '：' + (x.detail || x.field)).join('；').slice(0, 220)}）` });
        }
      });
      const eq = timeline.filter((a) => !a.status && a.cls === 'Q' && a.frameSrc);
      if (eq.length) w.push({ level: 'info', mech: 'community', code: 'frames-echo', text: `声骸技能时长取自 action_frames.echoes（${[...new Set(eq.map((a) => a.frameLabel))].slice(0, 3).join('、')}）；其他声骸仍为默认值` });
      const seen = new Set();
      const used = new Set(timeline.filter((a) => !a.status).map((a) => a.mi + '|' + a.key));
      for (const x of ctx._frameNull || []) {
        if (!used.has(x.member + '|' + x.key)) continue; // only actions that actually appear (module-replaced generic E/A are skipped)
        const k = x.member + '|' + x.label; if (seen.has(k)) continue; seen.add(k);
        w.push({ level: 'warn', member: x.member, mech: 'unsolved', code: 'frames-null', text: `${x.char}: action_frames「${x.label}」为 null（${x.reason}），${x.key} 使用默认时长` });
      }
    }
    if (!ctx.searchable) w.push({ level: 'warn', mech: null, text: ctx.searchReason, code: 'search-disabled' });
    ctx.members.forEach((m, i) => {
      if (m.mod) for (const n of m.mod.notes || []) w.push({ level: 'info', member: i, mech: 'community', text: `${m.R.name} 模块：${n}` });
      else w.push({ level: 'info', member: i, mech: 'unsolved', text: `${m.R.name}: 无角色模块，专属资源/强化动作只能以 X 动作手动加入（不检查资源门槛）` });
      const un = m.buffDefs.filter((b) => b.unmodeled).length;
      if (un) w.push({ level: 'info', member: i, mech: 'unsolved', text: `${m.R.name}: ${un} 条描述效果未建模（倍率提升/护盾/特殊机制）` });
      const off = m.buffDefs.filter((b) => b.autoOff).length;
      if (off) w.push({ level: 'warn', member: i, mech: 'community', text: `${m.R.name}: ${off} 条条件效果触发未识别，默认关闭（可在增益列表开启）`, code: 'auto-off' });
      if (!maxEnergy(m)) w.push({ level: 'warn', member: i, mech: 'unsolved', text: `${m.R.name}: 解放不消耗共鸣能量（专属资源），R 无能量门槛` });
      const desc = ['E', 'R', 'I'].map((k) => m.kit[k]).filter((a) => a && a.concertoSource === 'description');
      if (desc.length) w.push({ level: 'info', member: i, mech: 'community', text: `${m.R.name}: ${desc.map((a) => a.cls).join('/')} 的协奏能量取自技能描述（命中行为 0，结算时机未证实）` });
      const lowA = ['E', 'R', 'I', 'O', 'Q', 'H'].map((k) => m.kit[k]).concat(m.kit.stages).filter((a) => a && a.lowHits);
      if (lowA.length) w.push({ level: 'warn', member: i, mech: 'unsolved', text: `${m.R.name}: ${lowA.map((a) => a.label).join('、')} 含低置信命中` });
    });
    for (const st of run.steps) if (!st.ok) w.push({ level: 'err', mech: null, text: `序列 ${st.raw}: ${st.reason}`, code: st.noStamina ? 'no-stamina' : undefined });
    if (timeline.some((a) => a.status)) w.push({ level: 'info', mech: MECH.anomalyZones.mech, code: 'anomaly', text: `异常效应伤害：${MECH.anomalyBase.basis}；${MECH.anomalyZones.basis}；${MECH.anomalyTiming.basis}` });
    const cut = timeline.find((a) => a.endCut != null && !a.status);
    if (cut) w.push({ level: 'info', mech: MECH.endCredit.mech, code: 'end-credit', text: `${cut.label} 超出时长，${ctx.cfg.endCredit === 'full' ? '全额计入（config.endCredit=full）' : '按窗口内比例 ' + round(cut.endCut * 100, 1) + '% 计入'}：${MECH.endCredit.basis}` });
    const tsActs = timeline.filter((a) => a.timeStop && !a.status);
    if (tsActs.length) {
      const saved = tsActs.filter((a) => a.timeStopSaved > 0), kept = tsActs.filter((a) => !(a.timeStopSaved > 0));
      const names = (xs) => [...new Set(xs.map((a) => a.label))].slice(0, 4).join('、');
      const parts = [];
      if (saved.length) parts.push(`${names(saved)} 时停合计 ${round(saved.reduce((x, a) => x + a.timeStopSaved, 0), 2)} 秒已从战斗时间扣除`);
      if (kept.length) parts.push(`${names(kept)} 时停合计 ${round(kept.reduce((x, a) => x + a.timeStop, 0), 2)} 秒按完整动画计时（${(ctx.cfg.timeStop || 'exclude') === 'exclude' ? '非耗能解放、无实测标记 tsVerified' : 'include'}）`);
      w.push({ level: 'info', mech: MECH.timeStop.mech, code: 'time-stop', text: parts.join('；') + '：' + MECH.timeStop.basis });
    }
    { const tf = tailFreezeOf(timeline, ctx.duration, timeline.reduce((x, a) => x + (a.damage || 0), 0));
      if (tf.idx.length) w.push({ level: tf.pct > 3 ? 'warn' : 'info', mech: 'heuristic', code: 'ts-window-edge', pct: tf.pct, idx: tf.idx,
        text: `${[...new Set(tf.labels)].join('、')} 在窗口最后 ${tf.sec} 秒起手，时停期间伤害按冻结时间全额计入（若按完整动画截断会少 ${tf.pct}% 总伤）：固定窗口对尾段时停大招有利，跨队比较请看每轮 DPS 或调整时长` }); }
    if (ctx.stamina.enabled && timeline.some((a) => a.staminaCost > 0)) w.push({ level: 'info', mech: MECH.stamina.mech, code: 'stamina', text: `耐力模型（上限 ${ctx.stamina.max}、回复 ${ctx.stamina.regen}/秒、停止消耗 ${ctx.stamina.delay}s 后回复，config.stamina 可改/关闭）：${MECH.stamina.basis}` });
    return w;
  }
  // ------------------------------------------------------------------ gear comparison
  /** variants: [{label, desc, patch(configClone)}]. Rotation fixed to the base sequence unless opts.researchRotation. */
  function compareGear(config, data, variants, opts) {
    opts = opts || {};
    const idx = ensureIndex(data);
    const base = simulate(config, idx);
    const fixed = (c) => { if (!opts.researchRotation) c.rotation = Object.assign({}, c.rotation, { mode: 'manual', sequence: base.sequence, onBlocked: 'wait' }); return c; };
    const baseFixed = simulate(fixed(JSON.parse(JSON.stringify(config))), idx);
    const rows = [{ label: opts.baseLabel || '当前配置', desc: base.sequence, total: baseFixed.total, dps: baseFixed.dps, cur: true, sequence: baseFixed.sequence, patch: null }];
    for (const v of variants) {
      const c = fixed(JSON.parse(JSON.stringify(config)));
      v.patch(c);
      let r;
      try { r = simulate(c, idx); } catch (e) { rows.push({ label: v.label, desc: '错误：' + e.message, total: 0, dps: 0, error: true }); continue; }
      rows.push({ label: v.label, desc: v.desc || '', total: r.total, dps: r.dps, invalidSteps: r.steps.filter((x) => !x.ok).length, sequence: r.sequence, patch: v.patch });
    }
    // researchRotation: beam search is not exhaustive, so every variant is also replayed on every other variant's best rotation
    // (cross-seeding); the best of its own search and the replays is kept (seededFrom names the source row)
    if (opts.researchRotation && opts.crossSeed !== false) {
      const seqs = rows.filter((r) => !r.error && r.sequence).map((r) => ({ label: r.label, seq: r.sequence }));
      for (const row of rows) {
        if (row.error) continue;
        for (const q of seqs) {
          if (q.seq === row.sequence) continue;
          const c = JSON.parse(JSON.stringify(config));
          if (row.patch) row.patch(c);
          c.rotation = Object.assign({}, c.rotation, { mode: 'manual', sequence: q.seq, onBlocked: 'wait' });
          let r; try { r = simulate(c, idx); } catch (e) { continue; }
          if (r.total > row.total + 1e-6) { row.total = r.total; row.dps = r.dps; row.seededFrom = q.label; row.invalidSteps = r.steps.filter((x) => !x.ok).length; }
        }
      }
    }
    rows.forEach((r) => { delete r.patch; delete r.sequence; });
    rows.sort((a, b) => (b.total - a.total) || (a.label < b.label ? -1 : 1));
    const best = rows[0].total || 1;
    const curRow = rows.find((r) => r.cur), curTotal = curRow ? curRow.total : baseFixed.total;
    rows.forEach((r, i) => { r.rank = i + 1; r.best = i === 0; r.gapPct = round((r.total / best - 1) * 100, 2); r.deltaVsCur = r.total - curTotal; r.deltaVsCurPct = round((r.total / (curTotal || 1) - 1) * 100, 2); });
    return { sequence: base.sequence, rows };
  }
  function weaponVariants(data, member, weaponIds, rank) {
    const idx = ensureIndex(data);
    return weaponIds.map((id) => ({ label: (idx.weapons.get(id) || {}).name || String(id), desc: `武器 R${rank || 1}`, patch: (c) => { c.team[member].weapon = Object.assign({}, c.team[member].weapon, { id, rank: rank || 1 }); } }));
  }
  function sonataVariants(data, member, setIds) {
    const idx = ensureIndex(data);
    return setIds.map((sid) => ({ label: (idx.sonatas.get(sid) || {}).name || String(sid), desc: '全部声骸改为该套装', patch: (c) => { c.team[member].echoes.forEach((e) => { e.set = sid; }); } }));
  }
  function echoMainVariants(member, slot, mains) {
    return mains.map((mk) => ({ label: `声骸#${slot + 1} 主词条 ${mk}`, desc: '', patch: (c) => { c.team[member].echoes[slot].main = mk; } }));
  }

  // ------------------------------------------------------------------ view model (frontend contract COMPONENTS.md)
  const TYPE_COLOR = { liberation: 'var(--gold)', skill: 'var(--cyan)', intro: '#9b8cff', heavy: '#e98a6b', basic: '#7aa2c8', echo: '#d9b75b', outro: '#c48bd6', tuneRupture: '#888',
    'anomaly:erosion': '#55c2a0', 'anomaly:frazzle': '#e8d17a', 'anomaly:flare': '#a77df0', 'anomaly:burst': '#f07a4f', 'anomaly:chafe': '#7cc6e8', 'anomaly:bane': '#b05a8a' };
  const typeZh = (k) => DMG_TYPE_ZH[k] || (/^anomaly:/.test(k) ? ANOMALY_ZH[k.slice(8)] : k);
  /** on-field intervals per member from the main action chain (swap/intro switch the on-field member) */
  function carryView(c) {
    if (!c) return null;
    const parts = [`能量 ${c.energy}/${c.energyMax}`, `协奏 ${c.concerto}`];
    if (c.resources) parts.push(Object.entries(c.resources).map(([k, v]) => `${k}=${v}`).join(' '));
    if (c.buffs.length) parts.push('增益：' + c.buffs.map((b) => `${b.src || b.name} 剩 ${b.remaining}s`).join('、'));
    const cds = Object.entries(c.cooldowns || {}); if (cds.length) parts.push('冷却：' + cds.map(([k, v]) => `${k} ${v}s`).join(' '));
    return Object.assign({}, c, { title: '承接上一轮结束状态：' + parts.join('；') + (c.moduleCarry ? '' : '（模块无 carry 钩子：计时窗口重置）') });
  }
  function onFieldIntervals(result) {
    const D = result.duration, out = result.members.map(() => []);
    let cur = result.config.rotation && result.config.rotation.start || 0, from = 0;
    for (const a of result.timeline) {
      if (a.status || a.coord || a.cls === 'O') continue;
      if (a.mi !== cur && (a.cls === 'S' || a.cls === 'I' || a.cls !== 'W')) { if (a.t > from + EPS) out[cur].push([from, a.t]); cur = a.mi; from = a.t; }
    }
    if (D > from + EPS) out[cur].push([from, D]);
    return out;
  }
  /** status lanes (.ww-lane.status): stack segments, tick markers, detonations (.burst) per anomaly type */
  function statusLanes(result, pct) {
    const log = (result.anomalies && result.anomalies.log) || [];
    const D = result.duration;
    const types = [...new Set(log.map((e) => e.type))];
    return types.map((type) => {
      const ev = log.filter((e) => e.type === type);
      const segs = [];
      let cur = 0, from = 0;
      for (const e of ev) {
        if (e.n === cur) continue;
        if (cur > 0 && e.t > from + EPS) segs.push({ t: round(from, 3), endT: round(e.t, 3), stacks: cur, leftPct: pct(from), widthPct: pct(e.t - from) });
        else if (cur > 0 && segs.length && Math.abs(segs[segs.length - 1].endT - from) < 1e-6) { /* zero-length */ }
        cur = e.n; from = e.t;
      }
      if (cur > 0 && D > from + EPS) segs.push({ t: round(from, 3), endT: round(D, 3), stacks: cur, leftPct: pct(from), widthPct: pct(D - from) });
      const ticks = ev.filter((e) => e.ev === 'tick' || e.ev === 'settle').map((e) => ({ t: round(e.t, 3), leftPct: pct(e.t), stacks: e.stacks, damage: e.damage, kind: e.ev }));
      const bursts = ev.filter((e) => e.ev === 'burst').map((e) => ({ t: round(e.t, 3), leftPct: pct(e.t), stacks: e.stacks, damage: e.damage }));
      const def = (result.anomalies.types || {})[type] || {};
      const total = ticks.concat(bursts).reduce((a, x) => a + (x.damage || 0), 0);
      return { type, zh: ANOMALY_ZH[type] || type, el: def.element || null, cap: def.cap || null, maxStacks: Math.max(0, ...segs.map((x) => x.stacks)), damage: total, segments: segs, ticks, bursts,
        mech: MECH.anomalyTiming.mech, confidence: MECH.anomalyTiming.confidence };
    });
  }
  /** shared team stamina series (.ww-stamina on every character card; rejected actions are listed via steps[].noStamina) */
  function staminaView(result, i) {
    if (!result.stamina) return null;
    const max = result.stamina.max;
    const st0 = result.config && result.config.start && result.config.start.stamina != null ? Math.min(max, result.config.start.stamina) : max;
    const series = [{ t: 0, v: st0 }].concat(result.timeline.filter((a) => a.stamina != null && !a.status && !a.coord).map((a) => ({ t: round(a.endT, 3), v: a.stamina })));
    const last = series[series.length - 1].v;
    const used = result.timeline.filter((a) => a.mi === i && a.staminaCost > 0).reduce((x, a) => x + a.staminaCost, 0);
    return { value: last, max, pct: round(100 * last / max, 1), shared: true, usedByMember: round(used, 1), series,
      path: series.length ? series.map((p, k) => `${k ? 'L' : 'M'}${round(100 * p.t / result.duration, 2)} ${round(10 - 10 * p.v / max, 2)}`).join(' ') : '' };
  }
  // MECH.tailFreeze: excluded time-stop casts (timeStopSaved>0) whose FULL animation would cross the window end — their frozen-time damage is
  // credited in full (game: timer frozen → hits land). Fixed windows therefore favour time-stop finishers at the tail. bonus = Σ damage × (1 − (D−t)/durationFull)
  // = what prorating by the full animation would have removed; pct = bonus / total. Marked only (summary.tailFreezePct, warning 'ts-window-edge'), not changed.
  function tailFreezeOf(timeline, D, total) {
    const out = { pct: 0, bonus: 0, damage: 0, idx: [], sec: null, labels: [] };
    timeline.forEach((a, i) => {
      if (!(a.timeStopSaved > 0) || a.status) return;
      const full = (a.endT - a.t) + a.timeStopSaved;
      if (a.t + full <= D + EPS) return;
      out.idx.push(i); out.damage += a.damage || 0; out.bonus += (a.damage || 0) * (1 - Math.max(0, (D - a.t) / full));
      out.sec = out.sec == null ? round(D - a.t, 3) : Math.max(out.sec, round(D - a.t, 3)); out.labels.push(a.label);
    });
    out.pct = total > 0 ? round(100 * out.bonus / total, 2) : 0; out.bonus = round(out.bonus, 1); out.damage = round(out.damage, 1);
    return out;
  }
  function toView(result) {
    const D = result.duration, mem = result.members;
    const pct = (t) => round((t / D) * 100, 3);
    // MECH.endCredit: fraction of a window-crossing action that is counted (prorate default; full → 1)
    const creditOf = (a) => (result.config && result.config.endCredit === 'full' ? 1 : a.endCut);
    const modeZh = { expected: '期望', crit: '暴击', noncrit: '不暴' }[result.mode];
    const tf = result.tailFreeze || { pct: 0, idx: [], sec: null };
    const summary = { total: result.total, dps: result.dps, duration: D, timeStopSaved: result.timeStopSaved || 0, tailFreezePct: tf.pct, tailFreeze: tf.idx.length ? { pct: tf.pct, sec: tf.sec, idx: tf.idx, bonus: tf.bonus } : null, mode: result.mode, swaps: result.swaps, liberations: result.liberations, heal: result.heal,
      cards: [
        { k: '总伤害 · ' + modeZh, v: Math.round(result.total), s: `${D} 秒 · 单目标 · ${result.enemy.name} Lv${result.enemy.level}`, hero: true },
        { k: 'DPS', v: Math.round(result.dps) }, { k: '切人次数', v: result.swaps }, { k: '解放次数', v: result.liberations }],
      // search/start mode tag (.ww-tag.mode.steady ⟳ 稳态开局 / .ww-tag.mode.residual ⇢ 含残值引导); reason → title
      runMode: result.runMode ? { kind: result.runMode.kind, label: result.runMode.kind === 'steady' ? '稳态开局' : '含残值引导' /* glyph ⟳/⇢ comes from ww.css ::before */, reason: result.runMode.reason,
        residual: result.residual ? result.residual.value : null } : null };
    const gauges = mem.map((m, i) => ({ member: i, name: m.name, el: m.element,
      energy: round(result.final[i].energy, 2), energyMax: result.final[i].energyMax, energyPct: result.final[i].energyMax ? round(100 * result.final[i].energy / result.final[i].energyMax, 1) : 0,
      concerto: round(result.final[i].concerto, 2), concertoPct: round(result.final[i].concerto, 1),
      series: result.timeline.filter((a) => a.mi === i && a.cls !== 'W' && !a.status).map((a) => ({ t: round(a.endT, 3), energy: round(a.energyAfter, 2), concerto: round(a.concertoAfter, 2) })),
      stamina: staminaView(result, i) }));
    const acts = result.timeline.filter((a) => a.cls !== 'W' && !a.status);
    const onf = onFieldIntervals(result);
    const lanes = mem.map((m, i) => ({ member: i, id: m.id, name: m.name, el: m.element,
      actions: acts.filter((a) => a.mi === i && a.cls !== 'S').map((a) => ({
        cls: a.cls === 'I' || a.cls === 'O' ? a.cls : a.cls, // A H E R Q, or I/O markers
        mark: a.cls === 'I' ? 'I' : a.cls === 'O' ? 'O' : null,
        label: a.label, t: round(a.t, 3), endT: round(a.endT, 3), leftPct: pct(a.t), widthPct: a.cls === 'O' ? 0 : Math.max(0.6, pct(a.endT - a.t)),
        damage: a.damage, low: (a.lowHits || 0) > 0 || !!a.extra, est: !!a.est, durSource: a.durSource || null,
        dur: a.coord ? null : durKind(a), durReason: !a.coord && durKind(a) === 'default' ? (a.durReason || '默认时长') : null, frameLabel: a.frameLabel || null,
        durSrcTag: a.frameSrc || null, durSrcZh: a.frameSrc ? FRAME_SRC_ZH[a.frameSrc] : null, frameLow: a.frameLow || null,
        swapCut: a.swapCut || null, coord: !!a.coord, offfield: !!a.offfield, forced: !!a.forced, key: a.key || null, inferred: a.inferred || null,
        truncated: a.endCut != null, credit: a.endCut != null ? creditOf(a) : null, timeStop: a.timeStop || null, tailFreeze: tf.idx.includes(result.timeline.indexOf(a)),
        // .ww-freeze: exclude → frozen seconds removed from the clock (thin marker, widthPct 0); include → occupies timeStop seconds from action start
        freeze: a.timeStop > 0 ? { sec: round(a.timeStop, 3), excluded: !!a.timeStopSaved, basis: a.tsBasis || null, leftPct: pct(a.t), widthPct: a.timeStopSaved ? 0 : pct(Math.min(a.timeStop, a.endT - a.t)) } : null,
        energyAfter: a.energyAfter, concertoAfter: a.concertoAfter, staminaCost: a.staminaCost || 0 })),
      onfield: onf[i].map(([a, b]) => ({ t: round(a, 3), endT: round(b, 3), leftPct: pct(a), widthPct: pct(b - a) })),
      // actions rejected for stamina (manual sequences): zero-length markers → .ww-act.no-stamina
      rejected: (result.steps || []).filter((x) => x.noStamina && x.mi === i && x.t != null).map((x) => ({ t: x.t, leftPct: pct(x.t), token: x.raw, reason: x.reason, stamina: x.stamina })),
      buffbars: result.buffUptime.filter((u) => u.target === i).map((u) => ({ id: u.id, segments: u.intervals.map(([a, b]) => ({ leftPct: pct(a), widthPct: pct(b - a) })),
        // buff time past the window end (not counted in damage) → i.residual; leftPct ≥ 100, may run past the track
        residual: (u.residual || []).map(([a, b]) => ({ t: a, endT: b, leftPct: pct(a), widthPct: pct(b - a), title: `窗口结束后仍剩 ${round(b - a, 2)} 秒（不计入伤害）` })), carried: !!u.carried })),
      // 稳态开局: carried-over state at t=0 → <i class="ww-carry">
      carry: result.runMode && result.runMode.kind === 'steady' ? carryView(result.runMode.carried[i]) : null }));
    const swaps = acts.filter((a) => a.cls === 'S' || a.cls === 'I').map((a) => ({ t: round(a.t, 3), leftPct: pct(a.t), to: a.mi }));
    const ruler = []; const step = D <= 30 ? 5 : D <= 60 ? 10 : 20; for (let t = 0; t <= D + EPS; t += step) ruler.push(t);
    const timeline = { duration: D, ruler, lanes, swaps, status: statusLanes(result, pct),
      windowEnd: { t: D, leftPct: pct(D), endCredit: result.config && result.config.endCredit === 'full' ? 'full' : 'prorate', truncated: acts.filter((a) => a.endCut != null).length } };
    let active = result.config.rotation && result.config.rotation.start || 0;
    const steps = result.steps.map((st) => {
      const p = parseSequence(st.raw)[0] || {};
      let member = p.m != null ? p.m : active;
      if (p.t === 'S') { member = p.to; if (st.ok) active = p.to; }
      return { est: !!st.est, dur: st.dur || null, durReason: st.durReason || null, key: st.key || null, actLabel: st.label || null, token: st.raw, cls: p.t, label: p.t === 'S' ? `切人 → ${mem[member] ? mem[member].name : '?'}` : (ACTION_ZH[p.t] || st.raw), member, el: mem[member] ? mem[member].element : null, invalid: !st.ok, noStamina: !!st.noStamina, auto: !!st.auto, reason: st.reason || null };
    });
    const palette = [];
    mem.forEach((m, i) => {
      ['A', 'H', 'E', 'R', 'Q'].forEach((c) => palette.push({ member: i, el: m.element, token: `${i + 1}${c}`, cls: c, label: `${m.name} · ${ACTION_ZH[c]}` }));
      m.kit.extras.forEach((x) => palette.push({ member: i, el: m.element, token: `${i + 1}${x.xid}`, cls: x.cls, label: `${m.name} · ${x.label}`, low: true }));
      palette.push({ member: i, el: m.element, token: `S${i + 1}`, cls: 'S', label: `切人 → ${m.name}` });
    });
    const seq = { text: result.sequence, steps, palette };
    const buffs = mem.flatMap((m) => m.buffs.filter((b) => !b.unmodeled).map((b) => ({ id: b.id, name: b.name, src: b.src, owner: m.index, el: m.element, target: b.target, kind: b.kind,
      stacks: b.maxStacks, mode: b.mode, off: b.mode === 'off', uptimePct: b.mode === 'on' ? 100 : round(100 * (b.uptime || 0), 1),
      mech: b.mech, basis: b.basis, confidence: b.confidence, lowReason: b.lowReason || null, text: b.text,
      autoOff: !!b.autoOff, moduleManaged: b.mode === 'module', patchedBy: b.patchedBy || null })));
    const tot = result.total || 1;
    const share = { byMember: mem.map((m, i) => ({ member: i, name: m.name, el: m.element, damage: result.perMember[i], pct: round(100 * result.perMember[i] / tot, 2) })),
      byType: Object.entries(result.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ type: k, zh: typeZh(k), damage: v, pct: round(100 * v / tot, 2), color: TYPE_COLOR[k] || '#666', status: /^anomaly:/.test(k) })) };
    let rep = null;
    for (const a of result.timeline) for (const p of a.parts || []) if (!a.status && p.zones && p.zones.length && (!rep || p.value > rep.p.value)) rep = { a, p };
    const rows = new Map();
    for (const a of result.timeline) for (const p of a.parts || []) {
      if (!p.zones || !p.zones.length) continue;
      const k = a.mi + '|' + a.label + '|' + p.label;
      if (!rows.has(k)) rows.set(k, { member: a.mi, name: mem[a.mi].name, cls: a.cls, action: a.label, hit: p.label, el: p.element, type: p.type, typeZh: typeZh(p.type), count: 0, hits: 0, damage: 0, zones: p.zones, confidence: p.confidence, lowReason: p.lowReason, status: !!a.status, anomaly: a.anomaly || null });
      const r = rows.get(k); r.count += 1; r.hits += p.count; r.damage += p.value;
      if (a.endCut != null && !a.status) { r.truncated = true; r.credit = creditOf(a); }
    }
    const breakdown = { representative: rep ? { member: rep.a.mi, action: rep.a.label, hit: rep.p.label, t: rep.a.t, value: rep.p.value, zones: rep.p.zones } : null,
      effectiveRes: rep ? rep.p.zones.find((z) => z.key === 'resistance').effectiveRes : null,
      rows: [...rows.values()].sort((a, b) => b.damage - a.damage) };
    const search = result.search ? { expanded: result.search.expanded, truncated: result.search.truncated, ms: result.search.ms, budget: result.search.budget,
      candidates: result.search.ranked.map((c, i) => ({ rank: i + 1, title: `候选 ${i + 1} · 解放 ${c.liberations} · 切人 ${c.swaps}`, desc: c.sequence, total: c.damage, dps: c.dps,
        gapPct: round((c.damage / (result.search.ranked[0].damage || 1) - 1) * 100, 2), best: i === 0, cur: c.sequence === result.sequence, sequence: c.sequence })) } : null;
    const team = mem.map((m) => ({ member: m.index, name: m.name, el: m.element, module: m.moduleInfo.module, noModule: !m.moduleInfo.module, chain: m.chain, chainCfg: m.chainCfg, chainModeled: m.chainModeled,
      moduleVersion: m.moduleInfo.version || null, confidence: m.moduleInfo.confidence || null, reason: m.moduleInfo.module ? null : m.moduleInfo.reason }));
    // character resources: defs + time series (+ svg path for .ww-lane.res, viewBox 0 0 100 10)
    const resources = [];
    mem.forEach((m) => (m.moduleInfo.resources || []).forEach((rd) => {
      const pts = [];
      let first = true;
      for (const a of result.timeline) {
        if (!a.res || !a.res[m.index]) continue;
        const v = a.res[m.index][rd.key];
        if (first) { pts.push({ t: round(a.t, 3), v }); first = false; }
        pts.push({ t: round(a.endT, 3), v });
      }
      const cur = result.final[m.index].resources ? result.final[m.index].resources[rd.key] : 0;
      const path = pts.length ? pts.map((p, i) => `${i ? 'L' : 'M'}${round(pct(p.t), 2)} ${round(10 - 10 * Math.max(0, Math.min(1, (p.v || 0) / (rd.max || 1))), 2)}`).join(' ') : '';
      resources.push({ member: m.index, name: m.name, el: m.element, key: rd.key, label: rd.name, max: rd.max, segmented: rd.segmented,
        value: cur, pct: round(100 * (cur || 0) / (rd.max || 1), 1), cells: rd.segmented ? Array.from({ length: rd.max }, (_, i) => i < (cur || 0)) : null,
        confidence: rd.confidence, series: pts, path });
    }));
    const anomalyTotal = Object.entries(result.byType).filter(([k]) => /^anomaly:/.test(k)).reduce((a, [, v]) => a + v, 0);
    if (anomalyTotal > 0) summary.cards.push({ k: '异常效应伤害', v: Math.round(anomalyTotal), s: round(100 * anomalyTotal / tot, 1) + '%', status: true });
    return { version: result.dataVersion, searchable: result.searchable, searchDisabled: result.searchable ? null : { reason: result.searchDisabledReason },
      team, resources, summary, gauges, timeline, seq, buffs, share, breakdown, warnings: result.warnings, search,
      stamina: result.stamina ? { max: result.stamina.max, regen: result.stamina.regen, delay: result.stamina.delay, shared: true, rejected: steps.filter((x) => x.noStamina).length, mech: result.stamina.mech.mech } : null };
  }

  return {
    VERSION, MECH, SWAP_RULE, framesIndex, ANOMALY_ZH, STAMINA_DEFAULT, probeAnomaly, anomalyHit, anomMult, addAnomaly, advanceAnomalies, ELEMENTS, ELEMENT_ZH, DMG_TYPES, DMG_TYPE_ZH, DEFAULT_DURATIONS, DEFAULT_SEARCH, ACTION_ZH,
    indexData, parseTextEffects, panelKey, assembleMember, finalPanel,
    defenseMultiplier, resistanceMultiplier, critMultiplier, resolveHit,
    buildKit, buildContext, defaultConfig, initialState, actionsFor, applyAction, parseSequence, runSequence,
    beamSearch, runPolicy, stateKey, tokensOf, timelineOf, simulate,
    substatTierTable, TIER_ZH,
    registerChar, getChar, listChars, makeAct, estimate, resolveButton, mkApi, BUTTONS,
    compareGear, weaponVariants, sonataVariants, echoMainVariants, toView, chainModeledOf,
    _frameLookup: frameLookup, // tests only
  };
});
