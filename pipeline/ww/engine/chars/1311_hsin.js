/*
 * 心 (1311, Hsin) character module. 默认共鸣模态·同奏（module.mode='unison'）；电磁模态（'flare'）只做部分建模。
 *
 * 常态攻击 万相生华 (1006101): 应世相 普攻 4 段 / 重击；照世相 普攻 3 段（第1段生成活字心锁，第2段/重击/共鸣技能令其崩解造成伤害）/ 重击；
 *   统御众机期间 普攻·照世相·万阙连衡 4 段。
 * 共鸣技能 踏月归心 (1006102): 应世相「施放该技能后…短按普攻，将会施放普攻·应世相第4段」冷却 12；照世相 冷却 20
 * 共鸣解放 引枢作清辉 (1006103):
 *   转相「施放重击·应世相·步红尘或重击·应世相·镇红尘后，解锁转相…心将转为照世相…进入心相心生状态。」转相冷却时间=25（无能量消耗）
 *   万阙垂天「施放重击·照世相·临寰宇或…镇寰宇后，处于照世相且共鸣能量满时，解锁万阙垂天…此次伤害为共鸣技能伤害…心将回到应世相，并退出心相心生状态。」消耗 125
 *   敕令「施放转相时…获得21层敕令…持续45秒…队伍中在场角色造成伤害后，心将在后续3秒内自动消耗敕令…每秒至多自动消耗1层…飞阙造成的伤害不会获得该效果。」
 *     → _common.perSecond（窗口 = 动作 + 3 秒，共 21 次；中）
 *   借相·应世 / 借相·照世：不建模（R 只在 转相 / 万阙垂天 可用时有效）
 * 共鸣回路 (1006107):
 *   「【应世心】达到100点时，重击·应世相替换为重击·应世相·步红尘…消耗…100点【应世心】…此次伤害为共鸣技能伤害。」
 *   「施放重击·应世相·步红尘时，心将获得了尘愿…替换为重击·应世相·镇红尘…每24秒仅可获得1次了尘愿。」（承天则 / 镇寰宇 同理）
 *   「【照世心】达到300点时…共鸣技能替换为共鸣技能·照世相·万阙连衡…进入统御众机状态。」「统御众机状态持续13秒」
 *   「普攻·照世相·万阙连衡…命中目标时…将消耗【照世心】。」「【照世心】被消耗至0时，重击·照世相替换为重击·照世相·临寰宇」「退出统御众机状态，解锁…万阙垂天」
 *   【应世心】:「常态攻击·应世相、共鸣技能·应世相、变奏技能…命中目标时…获得」「施放变奏技能·应世相…获得60点」
 *   【照世心】:「处于照世相时且不处于统御众机状态时，常态攻击·照世相、共鸣技能·照世相…命中目标时…获得」
 *     「处于共鸣模态·同奏时，施放变奏技能·照世相…将直接进入统御众机状态，并获得300点【照世心】」「电磁…额外获得150点【照世心】，可生效1次」
 *     每次命中的获取/消耗量不在数据中，公开指南（wuthering.gg / prydwen / wutheringlab）也只给循环不给数值 → 按动作估计（低；module.gain 覆盖）：
 *       应世心 A1 10 / A2 15 / A3 15 / A4 20 / 重击 10 / E 20；照世心 A1 30 / A2 30 / A3 60 / 重击 30 / E 60；统御 万阙连衡 1–4 段消耗 60/60/80/100
 *   共鸣模态·同奏:「心施放变奏技能·应世相…时，使下一次施放共鸣解放·转相时，心获得同奏，持续5秒。」
 *     「心响应同奏时，获得溯意，并使本次施放的变奏技能替换为变奏技能·诸相同奏…若未响应同奏且拥有溯意，则将消耗溯意…替换为…诸相同奏」
 *     「同奏：…若切换其他角色，登场角色将施放自身变奏技能，心则施放自身延奏技能…只消耗同奏效果。」（swapOut force，同今汐模块）
 *     「响应同奏：…队伍中的登场角色拥有同奏时，若切换至心，心施放变奏技能后响应同奏，队伍中的角色获得1层【同奏增益】，持续30秒。」
 *     「同奏增益：仅可响应同奏的角色可以获得该效果。每层…造成的最终伤害提升3%，可叠加2层。」 → deep:all 0.03/层（“最终伤害”按加深区，中）
 *     → 响应判定：引擎延奏事件 ev.forced && ev.reason === 'tongzou'（今汐/心 swapOut 返回 {force, reason:'tongzou'}）
 *     → 可响应同奏的角色：今汐(1304)、心(1311)（module.unisonIds 可追加）
 * 固有 循流引兴替:「心施放变奏技能·…诸相同奏时，自身攻击提升50%，持续8秒，切换至其他角色…提前结束。」（触发改为诸相同奏变奏）
 * 固有 信步拾清欢:「队伍中的角色【同奏增益】效果的层数上限增加1层。队伍中的角色响应同奏时，队伍中的角色获得1层【同奏增益】，持续30秒，该效果无法叠加。」
 * 延奏 身作千灯:「攻击目标，造成100%的导电伤害。心进入战斗状态或施放…万阙垂天时，将获得照夜明…同奏：队伍中除心之外的角色获得同奏时将获得灯同辉。
 *   心施放延奏技能后，拥有灯同辉的角色全伤害加深20%，持续30秒。电磁：队伍中除心之外的角色导电伤害加深20%，持续20秒。」
 *   → 延奏伤害：build_ww 关联的延奏行（倍率取描述 100%，低）；灯同辉 = 心在场期间观察到其他角色 cs.tongzou（今汐模块）即记录
 * 共鸣模态·电磁（module.mode='flare'）：转相/万阙连衡/镇寰宇 附加 5 层、变奏/镇红尘 附加 1 层【电磁效应】（引擎异常层，每 5 秒一跳；
 *   「心进入战斗状态时…【电磁效应】每次触发时不再减少层数」→ noDecay）；链6 电磁伤害可暴击（固定 80% / 230%）；玉阙玄华「目标受到电磁效应伤害加深30%」。
 *   霆霓/疾霆/霆心域/踏月归心主动触发 未建模。
 * 武器 玉阙玄华 (21050116):「附加电磁效应后或响应同奏时，共鸣技能伤害加深36%，共鸣技能伤害无视目标10%导电伤害抗性…持续30秒」 → 模块：仅共鸣技能伤害动作
 * 共鸣链: 1 诸相同奏变奏 ×(1.15+0.1×同奏增益层)；2 步/镇红尘、临/镇寰宇 ×1.6；3 万阙垂天 ×1.7，同奏下其暴击伤害 +20% +15%/层；
 *   4 获得同奏/响应同奏 → 全队全属性 +20% 30 秒；6 共鸣技能伤害 deep 40% + 无视防御 20%，同奏增益上限 +1 并额外 +1 层。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN, rowHit, perSecond, tzzyRoom } = C;
  const SIG = 21050116;
  const UNISON = [1304, 1311, 1312]; // B13: 锁暝 1312 responds to 同奏 too (was module.unisonIds workaround)
  // per-action gauge estimates (low): 社区只说明“命中获得”，无数值；按社区循环“变奏 → 普攻 → 长按重击步红尘”、“统御期间普攻 1–4 段后接临/镇寰宇”反推
  const GAIN = { ys: { yA1: 10, yA2: 15, yA3: 15, yA4: 20, yH: 10, yE: 20 }, zs: { zA1: 30, zA2: 30, zA3: 60, zH: 30, zE: 60 }, zsUse: { tA1: 60, tA2: 60, tA3: 80, tA4: 100 }, introYs: 60 };
  const SKILL_KEYS = new Set(['yE', 'zE', 'wqlh', 'buhc', 'zhenhc', 'linhy', 'zhenhy', 'wqct', 'yIz', 'zIz']);
  return WW.registerChar({
    id: 1311, chainModeled: 6, name: '心', version: '0.2', confidence: 'low',
    // audit: 心 is played as a 同奏 sub-DPS/support (Prydwen: 今汐/心 teams); 玉阙玄华's 共鸣技能加深 is gated on 同奏/电磁 → judged team-side
    audit: { role: 'subdps', sig: SIG, team: 'team_hsin_jinhsi.json', teamMi: 1, note: '专武效果需响应同奏，单人窗口无法触发 → 按队伍排名（modules2.test 同口径）' },
    notes: ['默认共鸣模态·同奏；电磁模态（module.mode=flare）电磁效应伤害由引擎异常层结算，霆心域/疾霆未建模', '应世心/照世心获取与消耗为按动作估计值（低，module.gain 覆盖）',
      '同奏响应判定：引擎延奏事件 forced 标记（reason tongzou）', '同奏增益“最终伤害 +3%”按全伤害加深计（中）', '借相不建模'],
    frames: {
      yA1: '普攻·Basic: Answering Form 1', yA2: '普攻·Basic: Answering Form 2', yA3: '普攻·Basic: Answering Form 3', yA4: '普攻·Basic: Answering Form 4',
      yH: '重击·Heavy: Answering Form', yE: '共鸣技能·Skill: Answering Form',
      buhc: '共鸣回路·Forte: Answering Form - Realm Wanderer', zhenhc: '共鸣回路·Forte: Answering Form - Realm Protector',
      zA1: '普攻·Basic: Illumining Form 1', zA2: '普攻·Basic: Illumining Form 2', zA3: '普攻·Basic: Illumining Form 3',
      zH: '重击·Heavy: Illumining Form', zE: '共鸣技能·Skill: Illumining Form', wqlh: '共鸣回路·Forte: Illumining Form - Pillars Aligned',
      tA1: '普攻·Basic: Illumining Form - Pillars Aligned 1', tA2: '普攻·Basic: Illumining Form - Pillars Aligned 2', tA3: '普攻·Basic: Illumining Form - Pillars Aligned 3', tA4: '普攻·Basic: Illumining Form - Pillars Aligned 4',
      linhy: '共鸣回路·Forte: Illumining Form - Beholding All Horizons', zhenhy: '共鸣回路·Forte: Illumining Form - Stilling All Horizons',
      zx: '共鸣解放·Liberation: Nexus Alight - Form Shift', wqct: '共鸣解放·Liberation: Pillars Across Heaven',
      yI: '变奏入场·Intro: Answering Form - Unison', yIz: '变奏入场·Intro: Answering Form - Manifold Unison',
      zI: '变奏入场·Intro: Illumining Form - Unison', zIz: '变奏入场·Intro: Illumining Form - Manifold Unison',
      yIf: '变奏入场·Intro: Answering Form - Electro Flare', zIf: '变奏入场·Intro: Illumining Form - Electro Flare',
    },
    resources: [
      { key: 'ys', name: '应世心', max: 100, segmented: false, confidence: 'low', basis: '上限 100；获取量估计' },
      { key: 'zs', name: '照世心', max: 300, segmented: false, confidence: 'low', basis: '上限 300；获取/消耗量估计' },
      { key: 'form', name: '相', max: 2, segmented: true, confidence: 'high', basis: '1 应世相 / 2 照世相', get: (cs) => (cs.form === 'Y' ? 1 : 2) },
      { key: 'tongyu', name: '统御众机（秒）', max: 13, segmented: false, confidence: 'high', get: (cs, t) => (on(cs.ty, t) ? +(cs.ty - t).toFixed(1) : 0) },
      { key: 'chiling', name: '敕令', max: 21, segmented: false, confidence: 'high', get: (cs, t) => (on(cs.cl.until, t) ? cs.cl.left : 0) },
    ],
    kit(H) {
      const ch = H.chain, K = {};
      const sc = (f, why) => (f !== 1 ? { scale: { '*': f }, inferred: why } : {});
      for (let k = 1; k <= 4; k++) {
        K['yA' + k] = H.act({ key: 'yA' + k, cls: 'A', skill: 1, labels: ['普攻·应世相第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.5, 1.07, 1.1, 1.48][k - 1] });
        K['tA' + k] = H.act({ key: 'tA' + k, cls: 'A', skill: 1, labels: ['普攻·照世相·万阙连衡第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.58, 0.82, 0.77, 1.5][k - 1] });
      }
      for (let k = 1; k <= 3; k++) K['zA' + k] = H.act({ key: 'zA' + k, cls: 'A', skill: 1, labels: ['普攻·照世相第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.75, 0.5, 1.63][k - 1] });
      const c2 = sc(ch >= 2 ? 1.6 : 1, '链2：倍率 ×1.6');
      Object.assign(K, {
        lock: H.act({ key: 'lock', cls: 'A', skill: 1, labels: ['普攻·照世相·活字心锁伤害'], levelKey: 'basic', label: '活字心锁崩解' }),
        yH: H.act({ key: 'yH', cls: 'H', skill: 1, labels: ['重击·应世相伤害'], levelKey: 'basic', dur: 0.73 }),
        zH: H.act({ key: 'zH', cls: 'H', skill: 1, labels: ['重击·照世相伤害'], levelKey: 'basic', dur: 0.72 }),
        yE: H.act({ key: 'yE', cls: 'E', skill: 2, labels: ['共鸣技能·应世相伤害'], levelKey: 'skill', cdKey: 'yE', cooldown: H.param(2, '共鸣技能·应世相冷却时间') || 12, dur: 1.58 }),
        zE: H.act({ key: 'zE', cls: 'E', skill: 2, labels: ['共鸣技能·照世相伤害'], levelKey: 'skill', cdKey: 'zE', cooldown: H.param(2, '共鸣技能·照世相冷却时间') || 20, dur: 1.67 }),
        wqlh: H.act({ key: 'wqlh', cls: 'E', skill: 6, labels: ['共鸣技能·照世相·万阙连衡伤害'], levelKey: 'forte', cdKey: 'wqlh', cooldown: H.param(6, '共鸣技能·照世相·万阙连衡冷却时间') || 12, dur: 2.53 }),
        buhc: H.act(Object.assign({ key: 'buhc', cls: 'H', skill: 6, labels: ['重击·应世相·步红尘伤害'], levelKey: 'forte', dur: 2.03 }, c2)),
        zhenhc: H.act(Object.assign({ key: 'zhenhc', cls: 'H', skill: 6, labels: ['重击·应世相·镇红尘伤害'], levelKey: 'forte', dur: 2.03 }, c2)),
        linhy: H.act(Object.assign({ key: 'linhy', cls: 'H', skill: 6, labels: ['重击·照世相·临寰宇伤害'], levelKey: 'forte', dur: 2.5 }, c2)),
        zhenhy: H.act(Object.assign({ key: 'zhenhy', cls: 'H', skill: 6, labels: ['重击·照世相·镇寰宇伤害'], levelKey: 'forte', dur: 2.5 }, c2)),
        zx: H.act({ key: 'zx', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', cdKey: 'zx', cooldown: H.param(3, '转相冷却时间') || 25, concertoParam: '转相回复协奏能量', label: '转相', dur: 4.23 }),
        wqct: H.act(Object.assign({ key: 'wqct', cls: 'R', skill: 3, labels: ['万阙垂天伤害'], levelKey: 'liberation', cost: H.R.energy.liberationCost, cdKey: 'wqct', cooldown: 0, concertoParam: '万阙垂天回复协奏能量', dur: 5.08 }, sc(ch >= 3 ? 1.7 : 1, '链3：万阙垂天 ×1.7'))),
        feique: H.act({ key: 'feique', cls: 'R', skill: 3, labels: ['飞阙伤害'], levelKey: 'liberation', label: '飞阙（敕令协同）' }),
        yI: H.act({ key: 'yI', cls: 'I', skill: 5, labels: ['共鸣模态·同奏下变奏技能·应世相伤害'], levelKey: 'intro', concertoParam: '变奏技能·应世相回复协奏能量', dur: 0.73 }),
        yIz: H.act({ key: 'yIz', cls: 'I', skill: 5, labels: ['变奏技能·应世相·诸相同奏伤害'], levelKey: 'intro', concertoParam: '变奏技能·应世相·诸相同奏回复协奏能量', dur: 0.73 }),
        zI: H.act({ key: 'zI', cls: 'I', skill: 5, labels: ['共鸣模态·同奏下变奏技能·照世相伤害'], levelKey: 'intro', concertoParam: '变奏技能·照世相回复协奏能量', dur: 2.53 }),
        zIz: H.act({ key: 'zIz', cls: 'I', skill: 5, labels: ['变奏技能·照世相·诸相同奏伤害'], levelKey: 'intro', concertoParam: '变奏技能·照世相·诸相同奏回复协奏能量', dur: 2.53 }),
        yIf: H.act({ key: 'yIf', cls: 'I', skill: 5, labels: ['共鸣模态·电磁下变奏技能·应世相伤害'], levelKey: 'intro', concertoParam: '变奏技能·应世相回复协奏能量', dur: 1.1 }),
        zIf: H.act({ key: 'zIf', cls: 'I', skill: 5, labels: ['共鸣模态·电磁下变奏技能·照世相伤害'], levelKey: 'intro', concertoParam: '变奏技能·照世相回复协奏能量', dur: 1.63 }),
      });
      const o11 = H.skill(11);
      const oh = o11 && o11.hits.length ? o11.hits : [rowHit(H, 5, 1311291301, { label: '身作千灯伤害', mult: 1.0, why: '延奏描述「造成100%的导电伤害」；倍率取描述值' })].filter(Boolean);
      K.O = H.act({ key: 'O', cls: 'O', skill: 11, hits: oh, levelKey: 'outro', label: '身作千灯', inferred: '延奏伤害：描述倍率 100%（低）' });
      H.patchBuff((b) => /循流引兴替/.test(b.src || '') && b.stats.some((s) => s.key === 'atkPct'), { trigger: { on: 'act', keys: ['yIz', 'zIz'] }, mode: 'auto' }, '模块：仅诸相同奏变奏触发');
      H.patchBuff((b) => /循流引兴替/.test(b.src || '') && b.stats.some((s) => s.key === 'dmg:electro'), { mode: 'module' }, '模块：电磁模态 / 漂泊者·导电（未建模）');
      H.patchBuff((b) => b.kind === 'outro', { mode: 'module' }, '模块：延奏按模态对其他角色施加');
      const outs = H.findBuff((b) => b.kind === 'outro' && b.stats.length);
      H.mem._hxOutro = { unison: (outs.find((b) => b.stats[0].key === 'deep:all') || {}).id, flare: (outs.find((b) => b.stats[0].key === 'deep:electro') || {}).id };
      H.patchBuff((b) => b.kind === 'chain' && /万阙垂天的暴击伤害|同奏增益】额外使其暴击伤害/.test(b.text || ''), { mode: 'module' }, '模块：仅万阙垂天');
      H.patchBuff((b) => b.kind === 'chain' && /全属性伤害加成提升20%/.test(b.text || ''), { mode: 'module' }, '模块：获得同奏/响应同奏时施加');
      H.mem._hxC4 = (H.findBuff((b) => b.kind === 'chain' && /全属性伤害加成提升20%/.test(b.text || ''))[0] || {}).id;
      if (H.weaponId === SIG) H.patchBuff((b) => b.kind === 'weapon' && /共鸣技能伤害加深/.test(b.text || ''), { mode: 'module' }, '模块：响应同奏/附加电磁后 30 秒，仅共鸣技能伤害');
      H.buff({ id: 'tzzy', name: '同奏增益', stats: [{ key: 'deep:all', value: 0.03 }], duration: 30, maxStacks: 2 + 1 + (ch >= 6 ? 1 : 0), trigger: { on: 'manual' }, mode: 'module', target: 'self',
        text: '每层【同奏增益】使队伍中可响应同奏的角色造成的最终伤害提升3%（信步拾清欢 +1 层上限）', confidence: 'medium' });
      return K;
    },
    // 搜索时间归一化用的常规输出动作（通用 kit.H 为「重击·应世相·闲中御」，不是常规重击）
    fillerKeys: ['yA1', 'yA2', 'yA3', 'yA4', 'yH'],
    init(api) {
      const o = api.H.opts, st = o.start || {};
      return { mode: o.mode === 'flare' ? 'flare' : 'unison', form: 'Y', st: 0, last: null, ys: st.ys || 0, zs: 0, ty: null, xx: null, zxUnlock: false, wqUnlock: false,
        lcyReady: 0, cttReady: 0, nextTz: false, tz: null, suyi: false, respond: false, forcedOut: false, lock: false, zyb: true, dth: {}, wUntil: null,
        cl: { until: null, left: 0, next: 0 }, flare150: false, appliers: {}, others: Math.max(0, o.flareAppliers || 0),
        unison: UNISON.concat(o.unisonIds || []) };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const Y = cs.form === 'Y', T = !Y && on(cs.ty, t);
      switch (btn) {
        case 'A':
          if (Y) return { act: K['yA' + ((cs.st % 4) + 1)] };
          if (T) return { act: K['tA' + ((cs.st % 4) + 1)] };
          return { act: K['zA' + ((cs.st % 3) + 1)] };
        case 'H':
          if (Y) return { act: cs.ys >= 100 - 1e-9 ? (t >= cs.lcyReady - 1e-9 ? K.zhenhc : K.buhc) : K.yH };
          if (T && cs.zs <= 1e-9) return { act: t >= cs.cttReady - 1e-9 ? K.zhenhy : K.linhy };
          return { act: K.zH };
        case 'E':
          if (Y) return { act: K.yE };
          if (!T && cs.zs >= 300 - 1e-9) return { act: K.wqlh };
          return T ? null : { act: K.zE };
        case 'R':
          if (Y) return cs.zxUnlock ? { act: K.zx } : null;
          return cs.wqUnlock ? { act: K.wqct } : null;
        case 'I': {
          if (cs.mode === 'flare') return { act: Y ? K.yIf : K.zIf };
          const z = cs.respond || cs.suyi;
          let act = Y ? (z ? K.yIz : K.yI) : (z ? K.zIz : K.zI);
          if (z && api.H.chain >= 1) { const f = 1.15 + 0.1 * Math.min(4, this.tzStacks(api)); act = Object.assign({}, act, { scale: { '*': f }, inferred: '链1：诸相同奏倍率 ×' + f.toFixed(2) }); }
          return { act, meta: { respond: cs.respond } };
        }
        case 'O': return { act: K.O };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    tzStacks(api) { const id = 'm' + api.mi + '_tzzy'; const b = api.buffInst(id, api.mi); return b ? b.stacks : 0; },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [], k = act.key, ch = api.H.chain;
      const skill = SKILL_KEYS.has(k);
      if (skill && api.H.weaponId === SIG && on(cs.wUntil, t)) out.push({ key: 'deep:all', value: 0.36 }, { key: 'resPen:electro', value: 0.1 });
      if (skill && ch >= 6) out.push({ key: 'deep:all', value: 0.4 }, { key: 'defIgnore', value: 0.2 });
      if (k === 'wqct' && ch >= 3 && cs.mode === 'unison') out.push({ key: 'critDmg', value: 0.2 + 0.15 * Math.min(4, this.tzStacks(api)) });
      const na = Object.keys(cs.appliers).length + cs.others;
      if (cs.mode === 'flare' && na) out.push({ key: 'dmg:electro', value: 0.25 * Math.min(2, na) });
      return out;
    },
    giveTzzy(api, n) {
      const id = 'm' + api.mi + '_tzzy';
      api.ctx.members.forEach((m, j) => {
        if (!api.cs.unison.includes(m.R.id)) return;
        const cur = api.buffInst(id, j), st = Math.min(Math.max(cur ? cur.stacks : 0, n), tzzyRoom(api, j, api.mi)); if (st > 0) api.fireBuff(id, j, { stacks: st, duration: 30 });
      });
    },
    c4(api) { if (api.H.chain >= 4 && api.mem._hxC4) api.ctx.members.forEach((_, j) => api.fireBuff(api.mem._hxC4, j, { duration: 30 })); },
    apply(api, act, meta) {
      const cs = api.cs, t = api.t, te = api.tEnd, k = act.key, ch = api.H.chain;
      const og = api.H.opts.gain || {}; const g = { ys: Object.assign({}, GAIN.ys, og.ys), zs: Object.assign({}, GAIN.zs, og.zs), zsUse: Object.assign({}, GAIN.zsUse, og.zsUse), introYs: og.introYs != null ? og.introYs : GAIN.introYs };
      const onField = api.active === api.mi;
      const m = /^([yzt])A(\d)$/.exec(k);
      cs.st = m ? +m[2] % (m[1] === 'z' ? 3 : 4) : 0;
      // gauges
      if (cs.form === 'Y' && g.ys[k] && onField) cs.ys = Math.min(100, cs.ys + g.ys[k]);
      if (cs.form === 'Z' && !on(cs.ty, t) && g.zs[k] && onField) cs.zs = Math.min(300, cs.zs + g.zs[k]);
      if (g.zsUse[k] && onField) cs.zs = Math.max(0, cs.zs - g.zsUse[k]);
      // 活字心锁
      if (k === 'zA1') cs.lock = true;
      else if (cs.lock && (k === 'zA2' || k === 'zH' || k === 'zE')) {
        cs.lock = false; api.deal(api.mem.modKit.lock, { count: 1 });
        if (cs.mode === 'flare' && !cs.flare150 && on(cs.xx, t) && !on(cs.ty, t)) { cs.zs = Math.min(300, cs.zs + 150); cs.flare150 = true; }
      }
      switch (k) {
        case 'yE': cs.st = 3; break;
        case 'yH': cs.st = 1; break;
        case 'zH': cs.st = 2; break;
        case 'buhc': case 'zhenhc':
          cs.ys -= 100; if (k === 'zhenhc') cs.lcyReady = t + 24;
          if (!on(cs.xx, t)) cs.zxUnlock = true;
          if (k === 'zhenhc' && cs.mode === 'flare') this.flareApply(api, te, 1);
          break;
        case 'wqlh': cs.ty = te + 13; if (cs.mode === 'flare') this.flareApply(api, te, 5); break;
        case 'linhy': case 'zhenhy':
          if (k === 'zhenhy') cs.cttReady = t + 24;
          cs.ty = null; cs.zs = 0; cs.wqUnlock = true;
          if (k === 'zhenhy' && cs.mode === 'flare') this.flareApply(api, te, 5);
          break;
        case 'zx':
          cs.form = 'Z'; cs.zxUnlock = false; cs.xx = te + 45; cs.zs = 0; cs.ty = null; cs.st = 0; cs.flare150 = false;
          cs.cl = { until: te + 45, left: 21, next: te };
          if (cs.mode === 'unison' && cs.nextTz) { cs.tz = te + 5; cs.nextTz = false; this.c4(api); }
          if (cs.mode === 'flare') this.flareApply(api, te, 5);
          break;
        case 'wqct': cs.form = 'Y'; cs.wqUnlock = false; cs.xx = null; cs.zyb = true; cs.ty = null; cs.zs = 0; cs.cl.until = Math.min(cs.cl.until || 0, te); break;
        case 'yI': case 'yIz': case 'yIf':
          cs.ys = Math.min(100, cs.ys + g.introYs); cs.st = 2; if (cs.mode === 'unison') cs.nextTz = true;
          if (k === 'yIf') { cs.st = 3; this.flareApply(api, te, 1); }
          break;
        case 'zI': case 'zIz': cs.ty = te + 13; cs.zs = 300; break;
        case 'zIf': this.flareApply(api, te, 1); break;
        default: break;
      }
      if (k === 'yIz' || k === 'zIz') {
        if (meta && meta.respond) {
          cs.suyi = true; cs.respond = false;
          this.giveTzzy(api, 2 + (ch >= 6 ? 1 : 0)); // 响应同奏 1 层 + 信步拾清欢 1 层（+链6 1 层）
          if (api.H.weaponId === SIG) cs.wUntil = te + 30;
          this.c4(api);
        } else cs.suyi = false;
      }
      cs.respond = false;
      cs.last = k;
    },
    flareApply(api, te, n) { const cs = api.cs; api.addAnomaly('flare', n || 1, { noDecay: true }); if (api.H.weaponId === SIG) cs.wUntil = te + 30; },
    // 链6「心附近…目标受到【电磁效应】的伤害可暴击，暴击固定为80%，暴击伤害固定为230%」（电磁模态）
    anomalyCrit(api, type) { return type === 'flare' && api.H.chain >= 6 && api.cs.mode === 'flare' ? { rate: 0.8, dmg: 2.3 } : null; },
    // 玉阙玄华「自身为登场角色时，一定范围内的目标受到电磁效应伤害加深30%」
    anomalyStats(api, type, owner) { return type === 'flare' && api.H.weaponId === SIG && on(api.cs.wUntil, api.t) && api.onField ? [{ key: 'deep:anomaly:flare', value: 0.3 }] : []; },
    swapOut(api) {
      const cs = api.cs;
      cs.lock = false;
      if (cs.mode === 'unison' && on(cs.tz, api.t)) { cs.tz = null; cs.forcedOut = true; return { force: true, reason: 'tongzou' }; }
      return {};
    },
    onOutro(api) {
      const cs = api.cs, o = api.mem._hxOutro;
      if (cs.mode === 'flare') { if (o.flare) api.ctx.members.forEach((_, j) => { if (j !== api.mi) api.fireBuff(o.flare, j, { duration: 20 }); }); return; }
      if (!cs.zyb || !o.unison) return;
      let any = false;
      api.ctx.members.forEach((_, j) => { if (j !== api.mi && cs.dth[j]) { api.fireBuff(o.unison, j, { duration: 30 }); any = true; } });
      if (any) { cs.zyb = false; cs.dth = {}; }
    },
    onTeam(api, ev) {
      const cs = api.cs;
      // 灯同辉：其他角色获得同奏（今汐模块 cs.tongzou）
      api.ctx.members.forEach((m, j) => { if (j !== api.mi) { const oc = api.member(j).cs; if (oc && on(oc.tongzou, ev.t != null ? ev.t : api.t)) cs.dth[j] = true; } });
      if (ev.type === 'outro' && ev.to === api.mi && ev.mi !== api.mi && cs.mode === 'unison' && ev.forced && ev.reason === 'tongzou') cs.respond = true; // 同奏强制延奏 → 响应同奏
      if (ev.type === 'anomaly' && ev.kind === 'flare') cs.appliers[ev.mi] = true;
      if (ev.type === 'intro' && ev.mi !== api.mi && cs.forcedOut) {
        cs.forcedOut = false;
        if (cs.unison.includes(api.memberDef(ev.mi).R.id)) { this.giveTzzy(api, 1); this.c4(api); } // 信步拾清欢：队友响应同奏
      }
      if (ev.type === 'damage' && !ev.coord && cs.mode && on(cs.cl.until, ev.t) && ev.mi === api.active) {
        const k = perSecond(cs.cl, ev.t, ev.dur || 0, 3, api.ctx.duration);
        if (k) api.deal(api.mem.modKit.feique, { count: k });
      }
    },
    // search heuristic (not a game rule): gauges toward 步红尘 / 万阙连衡 / 万阙垂天
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const wq = api.est(K.wqct), hy = api.est(K.zhenhy), lh = api.est(K.wqlh), hc = api.est(K.zhenhc);
      const VZ = wq + hy + lh;
      let v = (cs.ys / 100) * 0.5 * hc;
      // 注：此前引擎时间归一化误用通用 kit.H（闲中御）作常规输出 → 转相（无伤害 4.2 秒）被严重低估、搜索从不施放 R；已由 fillerKeys 修正
      if (cs.form === 'Y') v += cs.zxUnlock ? 0.5 * VZ : 0;
      else if (cs.wqUnlock) v += wq;
      else if (on(cs.ty, t)) v += wq + hy * (0.8 + 0.2 * (1 - cs.zs / 300));
      else v += (0.75 + 0.2 * cs.zs / 300) * VZ;
      if (on(cs.cl.until, t)) v += Math.min(cs.cl.left, cs.cl.until - t) * 0.5 * api.est(K.feique);
      return v;
    },
  });
});
