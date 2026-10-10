/*
 * 坎特蕾拉 (1607) character module — worker-B.
 *
 * 普攻 虚像陷落 (1003101): 3 段；「重击·浮潜幻海：拥有【迷离】时，重击替换为浮潜幻海…并进入蜃境状态」
 * 共鸣技能 幽影共舞 (1003102): 翩跹（冷却 6，回复协奏 10）；
 *   「斑驳幻梦：处于蜃境状态时，共鸣技能替换为斑驳幻梦，施放此技能时，同时视为施放声骸技能…使目标进入迷梦」（冷却 12）
 *   「迷梦…目标受到伤害时，将触发一次惊醒，造成湮灭伤害，并清除迷梦，此次伤害为普攻伤害。队伍中其他角色攻击处于迷梦的目标时，无法触发惊醒，并清除迷梦。」
 *   → 迷梦后坎特蕾拉的下一个有伤害动作附带惊醒 198.81%；其他角色的伤害清除迷梦（高）
 * 共鸣解放 海面之下 (1003103): 陷溺 376%（普攻伤害，视为声骸技能），冷却 25，消耗 125
 *   「弥漫：队伍中在场角色造成伤害时，会召唤织梦水母对目标进行协同攻击…造成伤害的接下来3秒内，每秒可召唤1只织梦水母…共可召唤21只。效果持续30秒」
 *   → 任一在场角色的非协同伤害动作覆盖 [t, t+dur+3] 内每秒 1 只（_common.perSecond，上限 21，链5 +5；中）
 * 变奏 游弋 (1003106): 点水；「处于蜃境状态时，变奏技能替换为逐浪」
 * 共鸣回路 虚实之间 (1003107):
 *   「蜃境状态·普攻替换为普攻蛰幻，进行最多3段…普攻蛰幻命中目标时，消耗1点【迷离】，获得1点【颤栗】…蜃境状态持续8秒；消耗完所有【迷离】时结束蜃境状态。」
 *   「处于蜃境状态时，若持有3点【颤栗】，共鸣技能替换为感知汲取…消耗所有【颤栗】…此次伤害为普攻伤害，使敌人进入迷梦…同时视为施放声骸技能。」（冷却 18）
 *   「迷离：上限5点。施放变奏技能时 +1；普攻第三段命中 +1；施放共鸣技能翩跹 +1；施放共鸣解放陷溺 +3。」「颤栗：上限3点。普攻蛰幻命中时 +1。」
 *   「溟海苏生：施放变奏技能后，队伍中的角色施放声骸技能时，坎特蕾拉回复6点协奏能量…最多可触发6次，持续25秒」→ 模块（队员 Q / 本人视为声骸的技能各计一次，中）
 * 延奏 柔软触手 (1003109): 「下一位登场角色湮灭伤害加深20%，共鸣技能伤害加深25%，效果持续14秒，若切换至其他角色则该效果提前结束。」（解析自动，incoming）
 * 固有 「毒」：「施放声骸技能时，自身的湮灭伤害加成提升6%…可叠加2层」→ 触发改为 Q + 陷溺 / 斑驳幻梦 / 感知汲取（「视为施放声骸技能」）
 * 共鸣链：1 E 系 ×1.5、E +1 迷离；2 陷溺附加迷梦、惊醒 ×3.45；3 陷溺 ×4.7、R 直接进入蜃境；6 蛰幻 ×1.8、R 后无视防御 30%（解析）。
 * 专武 海的呢喃 (21050056)：「施放变奏技能或普攻后10秒内，施放声骸技能时，获得1层【柔软的梦】…最多可叠加2层，持续10秒…若切换至其他角色则该效果提前结束。
 *   第1层：普攻伤害加成提升40%；第2层：无视目标12%湮灭属性抗性。」→ 模块计层（视为声骸技能的动作也计入，中）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on, perSecond } = C;
  const SIG = 21050056;
  const ECHOISH = ['Q', 'R', 'E2', 'drain'];
  return WW.registerChar({
    id: 1607, chainModeled: 6, name: '坎特蕾拉', version: '0.1', confidence: 'medium',
    notes: ['弥漫（织梦水母）：任一在场角色非协同伤害后 3 秒内每秒 1 只，上限 21（中）', '惊醒：迷梦后坎特蕾拉下一个有伤害的动作附带；其他角色伤害清除迷梦',
      '陷溺/斑驳幻梦/感知汲取视为声骸技能（固有「毒」、专武、溟海苏生计入）', '治疗量不计入伤害'],
    audit: { role: 'subdps', finishers: ['R'], window: 25, sig: 21050056, alts: [21050015, 21050045, 21050074], solo: 'cantarella_solo.json', team: 'team_phrolova_cantarella.json', teamMi: 1 },
    frames: {
      A1: '普攻·Basic: Illusion Collapse 1', A2: '普攻·Basic: Illusion Collapse 2', A3: '普攻·Basic: Illusion Collapse 3',
      H: '重击·Heavy 1: Illusion Collapse', dive: '重击·Heavy 2: Delusive Dive', zA1: '普攻·Basic: Phantom Sting 1', zA2: '普攻·Basic: Phantom Sting 2', zA3: '普攻·Basic: Phantom Sting 3',
      E: '共鸣技能·Skill 1: Graceful Step', E2: '共鸣技能·Skill 2: Flickering Reverie', drain: '共鸣回路·Forte: Perception Drain',
      R: '共鸣解放·Liberation: Beneath the Sea', I: '变奏入场·Intro: Ripple', I2: '变奏入场·Intro 2: Tidal Surge',
    },
    resources: [
      { key: 'ml', name: '迷离', max: 5, segmented: true, confidence: 'high' },
      { key: 'zl', name: '颤栗', max: 3, segmented: true, confidence: 'high' },
      { key: 'sj', name: '蜃境（秒）', max: 8, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.sjUntil, t).toFixed(2) },
      { key: 'jf', name: '织梦水母剩余', max: 26, segmented: false, confidence: 'medium', get: (cs, t) => (on(cs.mm.until, t) ? cs.mm.left : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 3, durs: [0.45, 0.75, 0.83] });
      const z6 = ch >= 6 ? { '*': 1.8 } : null;
      for (let k = 1; k <= 3; k++) K['zA' + k] = H.act({ key: 'zA' + k, cls: 'A', skill: 6, labels: ['蛰幻第' + B.CN[k - 1] + '段伤害'], levelKey: 'forte', ownStage: true, dur: [0.78, 0.68, 1.37][k - 1], scale: z6 });
      const c1 = ch >= 1 ? { '*': 1.5 } : null;
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.83 }),
        dive: H.act({ key: 'dive', cls: 'H', skill: 1, labels: ['浮潜幻海伤害'], levelKey: 'basic', dur: 0.72 }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['翩跹伤害'], levelKey: 'skill', concertoParam: '翩跹回复协奏能量', cooldown: 6, cdKey: 'E', dur: 0.63, scale: c1 }),
        E2: H.act({ key: 'E2', cls: 'E', skill: 2, labels: ['斑驳幻梦伤害'], levelKey: 'skill', concertoParam: '斑驳幻梦回复协奏能量', cooldown: 12, cdKey: 'E2', dur: 0.47, scale: c1 }),
        jx: H.act({ key: 'jx', cls: 'A', skill: 2, labels: ['惊醒伤害'], levelKey: 'skill', label: '惊醒', scale: ch >= 2 ? { '*': 3.45 } : null }),
        drain: H.act({ key: 'drain', cls: 'E', skill: 6, labels: ['感知汲取伤害'], levelKey: 'forte', concertoParam: '感知汲取回复协奏能量', cooldown: 18, cdKey: 'drain', dur: 1.33, scale: c1 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['陷溺伤害'], levelKey: 'liberation', concertoParam: '陷溺回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 3.57, scale: ch >= 3 ? { '*': 4.7 } : null }),
        jelly: H.act({ key: 'jelly', cls: 'A', skill: 3, labels: ['弥漫伤害'], levelKey: 'liberation', count: 1, label: '弥漫·织梦水母（协同）' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['点水伤害'], levelKey: 'intro', concertoParam: '点水回复协奏能量', dur: 1.27 }),
        I2: H.act({ key: 'I2', cls: 'I', skill: 5, labels: ['逐浪伤害'], levelKey: 'intro', concertoParam: '逐浪回复协奏能量', dur: 1.38 }),
        O: B.outro(H, '柔软触手'),
      });
      const echoTrig = { on: 'any', any: [{ on: 'cast', kinds: ['Q'] }, { on: 'act', keys: ['R', 'E2', 'drain'] }] };
      B.patch(H, /「毒」/, { trigger: echoTrig, mode: 'auto' }, '模块：声骸技能 + 视为声骸技能的陷溺/斑驳幻梦/感知汲取', 'inherent');
      if (H.weaponId === SIG) {
        B.patch(H, /第1层：普攻伤害加成提升40%|第2层：无视目标12%/, { mode: 'module', duration: 10, endsOnSwap: true }, '模块：变奏/普攻后 10 秒内施放声骸技能（含视为声骸技能的动作）计层', 'weapon');
        H.mem._sw = H.findBuff((b) => b.kind === 'weapon' && /第[12]层/.test(b.text || '')).map((b) => b.id);
      }
      B.patch(H, /蜃境状态期间，治疗效果加成/, { mode: 'off' }, '治疗不计入伤害', 'chain');
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'zA1', 'zA2', 'zA3'],
    init(api) { const st = api.H.opts.start || {}; return { ml: st.ml != null ? st.ml : 0, zl: 0, sjUntil: null, st: 0, zs: 0, dream: null, mm: { until: null, left: 0, next: 0 }, sw: 0, swUntil: null, swWin: null, ech: 0, echUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const sj = on(cs.sjUntil, t) && cs.ml > 0;
      switch (btn) {
        case 'A': return { act: sj ? K['zA' + ((cs.zs % 3) + 1)] : K['A' + ((cs.st % 3) + 1)] };
        case 'H': return { act: cs.ml > 0 && !sj ? K.dive : K.H };
        case 'E':
          if (sj && cs.zl >= 3 && api.cdReady('drain')) return { act: K.drain };
          if (sj) return api.cdReady('E2') ? { act: K.E2 } : { blocked: '斑驳幻梦冷却中' };
          return api.cdReady('E') ? { act: K.E } : { blocked: '翩跹冷却中' };
        case 'R': return { act: K.R };
        case 'I': return { act: sj ? K.I2 : K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api) { return []; },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd, ch = api.H.chain;
      const addMl = (n) => { cs.ml = Math.min(5, cs.ml + n); };
      // 惊醒：迷梦后自己的下一个有伤害动作（施加迷梦的动作本身除外）
      if (cs.dream && on(cs.dream, t) && act.hits.length && !['E2', 'drain'].includes(k) && !(k === 'R' && ch >= 2)) { api.deal(api.mem.modKit.jx, { coord: false }); cs.dream = null; }
      if (/^A\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (n === 3) addMl(1); } else if (k !== 'zA1' && k !== 'zA2' && k !== 'zA3') cs.st = 0;
      if (/^zA\d$/.test(k)) { const n = +k.slice(2); cs.zs = n % 3; cs.ml = Math.max(0, cs.ml - 1); cs.zl = Math.min(3, cs.zl + 1); if (cs.ml <= 0) cs.sjUntil = te; }
      switch (k) {
        case 'dive': if (!on(cs.sjUntil, t)) { cs.sjUntil = te + 8; cs.zs = 0; } break;
        case 'E': addMl(1 + (ch >= 1 ? 1 : 0)); break;
        case 'E2': cs.dream = te + 6.5; if (ch >= 1) addMl(1); break;
        case 'drain': cs.zl = 0; cs.dream = te + 6.5; if (ch >= 1) addMl(1); break;
        case 'R':
          addMl(3); cs.mm = { until: te + 30, left: 21 + (ch >= 5 ? 5 : 0), next: te };
          if (ch >= 2) cs.dream = te + 6.5;
          if (ch >= 3 && !on(cs.sjUntil, t)) { cs.sjUntil = te + 8; cs.zs = 0; }
          break;
        case 'I': case 'I2': addMl(1); cs.swWin = te + 10; cs.ech = 6; cs.echUntil = te + 25; if (k === 'I2') cs.zs = 0; break;
        default: break;
      }
      if (/^A\d$/.test(k) || /^zA\d$/.test(k)) cs.swWin = te + 10;
      // 专武「柔软的梦」
      if (api.mem._sw && ECHOISH.includes(k) && on(cs.swWin, t)) {
        const n = Math.min(2, (on(cs.swUntil, t) ? cs.sw : 0) + 1);
        if (!(cs.sw >= 2 && on(cs.swUntil, t))) { cs.sw = n; cs.swUntil = te + 10; api.mem._sw.slice(0, n).forEach((id) => api.fireBuff(id, api.mi, { duration: 10 })); }
      }
      // 溟海苏生（自身视为声骸技能的动作）
      if (ECHOISH.includes(k) && on(cs.echUntil, t) && cs.ech > 0) { cs.ech -= 1; api.addConcerto(api.mi, 6); }
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'damage' && !ev.coord && ev.mi !== api.mi && cs.dream) cs.dream = null; // 其他角色清除迷梦
      if (ev.type === 'damage' && !ev.coord && ev.mi === api.s.active) {
        const n = perSecond(cs.mm, ev.t, ev.dur || 0, 3, api.ctx.duration);
        if (n) api.deal(api.mem.modKit.jelly, { count: n });
      }
      // 溟海苏生：队员施放声骸技能
      if (ev.type === 'damage' && ev.mi !== api.mi && ev.act && ev.act.cls === 'Q' && on(cs.echUntil, ev.t) && cs.ech > 0) { cs.ech -= 1; api.addConcerto(api.mi, 6); }
    },
    swapOut(api) { api.cs.sjUntil = null; return {}; },
    // search heuristic (not a game rule): remaining jellyfish, stored 颤栗/迷离 toward 感知汲取
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const jf = on(cs.mm.until, t) ? Math.min(cs.mm.left, Math.max(0, Math.min(cs.mm.until, api.duration) - t) * 0.8) : 0;
      return jf * api.est(K.jelly) * 0.8 + (cs.zl / 3) * 0.4 * api.est(K.drain) + (cs.dream && on(cs.dream, t) ? 0.8 * api.est(K.jx) : 0);
    },
  });
});
