/*
 * 釉瑚 (1106) character module — stream A 批次 4。冷凝 臂铠，4★ 辅助（延奏 协同攻击加深 100%）。
 *
 * 问祯（共鸣技能 匣中问祯 / 变奏 遂心匣 / 重击·落霜坠 / 共鸣解放 如意卜）→ 获得 祯祥；持有祯祥时 A → 奇珍赏（编钟/如意/鼎/面具 随机，
 *   期望模式：四种各 25% 的平均动作 'cur'），获得 1 枚【吉兆】（上限 4），+10 协奏。
 * 4 吉兆 → H：诗中物 37.21%×10（共鸣技能伤害），+20 协奏；组合期望伤害倍数 = 1 + P(对偶 9/16)×70% + P(联珠/合说 13/64)×175% = 1.75
 *   （双关两对 9/64 按无伤害提升；链2 提升额外生效一次 → 2.5）。
 * 霜色：普攻命中 +1，4 满（估计）；H：满 → 落霜坠 14.45%×6 + 问祯；未满 → 摇匣蓄满（+1.2 s，估计）后落霜坠。
 * 共鸣技能 156.46%（冷却 15，链4 20% 不进入冷却 → 期望冷却 12）；共鸣解放 327.19%（100 能量，冷却 25）；变奏 89.47%+109.35%（固有 珠玑：冷凝 +15% 14 s，通用解析）。
 * 延奏 鉴珍：下一位登场角色 协同攻击伤害加深 100% 28 s（通用解析）。
 * 链：3 攻击 +20%（解析）；5 变奏 暴击 +15%（解析）；6 奇珍赏 暴击伤害 +15%/层 ≤4 7 s（模块）；1 生存 → 不影响输出。chainModeled 6。
 * 动作帧：WuWaSim（釉瑚）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const CURIOS = ['编钟伤害', '如意伤害', '鼎伤害', '面具伤害'];
  return WW.registerChar({
    id: 1106, chainModeled: 6, name: '釉瑚', version: '0.1', confidence: 'medium',
    notes: ['奇珍赏 按四种等概率期望（平均动作）', '诗中物 组合按期望倍数 1.75（链2 2.5）', '霜色 上限按 4 次普攻命中估计（低）', '链4 按期望冷却 12 s'],
    audit: { role: 'support', finishers: ['poem', 'cur', 'E'], window: 25, sig: null, solo: 'youhu_solo.json', team: 'team_youhu.json', teamMi: 2 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]',
      fall: '重击·heavy_heavy_attack_frostfall [WuWaSim]', fallC: null, E: '共鸣技能·skill [WuWaSim]', cur: null, R: '共鸣解放·liberation [WuWaSim]', I: '变奏入场·intro [WuWaSim]', poem: null,
    },
    resources: [{ key: 'omen', name: '吉兆', max: 4, segmented: true, confidence: 'high' }, { key: 'frost', name: '霜色', max: 4, segmented: true, confidence: 'low' }, { key: 'aug', name: '祯祥', max: 1, segmented: true, confidence: 'high' }],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const poemMult = ch >= 2 ? 2.5 : 1.75;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '', durs: [0.31, 0.69, 0.63, 0.9] }), {
        fall: H.act({ key: 'fall', cls: 'H', skill: 1, labels: ['重击·落霜坠伤害'], levelKey: 'basic', dur: 0.67, label: '落霜坠' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: ch >= 4 ? 12 : 15, cdKey: 'E', dur: 0.83, label: '匣中问祯' }),
        cur: H.act({ key: 'cur', cls: 'E', skill: 2, labels: CURIOS, levelKey: 'skill', concertoParam: '编钟回复协奏能量', dur: 1.24, label: '奇珍赏（期望）', scale: { '*': 0.25 } }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 4.67, label: '如意卜' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.53, label: '遂心匣' }),
        poem: H.act({ key: 'poem', cls: 'H', skill: 6, labels: ['诗中物技能伤害'], levelKey: 'forte', concertoParam: '回复协奏能量', dur: 1.5, label: '诗中物（期望组合）', scale: { '*': poemMult } }),
        O: B.outro(H, '鉴珍'),
      });
      K.fallC = Object.assign({}, K.fall, { key: 'fallC', label: '摇匣 + 落霜坠', dur: 1.87 });
      if (ch >= 6) { B.patch(H, /千秋一枕/, { mode: 'off' }, '模块：奇珍赏叠层', 'chain'); H.buff({ id: 'c6', name: '霁青', stats: [{ key: 'critDmg', value: 0.15 }], maxStacks: 4, duration: 7, trigger: { on: 'manual' }, mode: 'module', text: '链6' }); }
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { st: 0, omen: 0, frost: 0, aug: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: cs.aug ? K.cur : K['a' + ((cs.st % 4) + 1)] };
        case 'H': if (cs.omen >= 4) return { act: K.poem }; return { act: cs.frost >= 4 ? K.fall : K.fallC };
        case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.R };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; cs.frost = Math.min(4, cs.frost + 1); return; }
      switch (k) {
        case 'cur': cs.aug = 0; cs.omen = Math.min(4, cs.omen + 1); if (api.H.chain >= 6) api.fireBuff('c6', api.mi, { t: te }); break;
        case 'poem': cs.omen = 0; cs.st = 0; break;
        case 'fall': case 'fallC': cs.frost = 0; cs.aug = 1; cs.st = 0; break;
        case 'E': case 'R': case 'I': cs.aug = 1; break;
        default: break;
      }
    },
    potential(api) { const cs = api.cs, K = api.mem.modKit; return (cs.omen / 4) * 0.5 * api.est(K.poem) + (cs.aug ? 0.5 * api.est(K.cur) : 0); },
  });
});
