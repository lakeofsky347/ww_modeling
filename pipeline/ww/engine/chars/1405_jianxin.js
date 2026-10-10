/*
 * 鉴心 (1405) character module — worker-B.
 *
 * 普攻 风仪拳术 (1001901): 普攻 4 段；重击 126.07%
 * 共鸣技能 静气循行 (1001902): 架势 → 行气反击 334.60%（受击时）/ 降气反击 258.73%（松开）；冷却 12；协奏 施放 8 + 反击 14
 *   → 木桩不出手 → 默认 E = 降气反击；opts.counter=true 时 E = 行气反击（中）
 * 共鸣解放 涤净力场 (1001903): 持续伤害 29.83%（风场 3.12 秒，跳数未公开 → 估计 6 跳，低）+ 炸裂 636.20%；冷却 20；150 能量
 * 共鸣回路 混元气旋 (1001907):「当【气】达到上限时，按住普攻，将会施放混元气旋，进入运气状态…小周天 / 大周天·内 / 大周天·外…」
 *   → 模块：气满时 H = 完整运气到大周天·外后松开（WuWaSim forte_heavy_* 6.34s），伤害 = 运气持续 24.86%×N（估计 N=18，约 0.35 s/跳，低）+ 小周天 139.17% + 大周天·内 377.74% + 大周天·外 516.91%
 *     协奏 5+18+23（小周天/大周天·内/大周天·外，高）；护盾/治疗不建模
 *   「【气】上限120点…风仪拳术命中、施放静气循行、行气/降气反击命中、变奏命中时，获得【气】」→ 每次获取量未公开：估计 a1 10 / a2 15 / a3 20 / a4 15 / 重击 10 / 技能 40 / 变奏 20（低）
 * 固有 形释无极：共鸣解放伤害 +20%（解析为空 → 模块 actionStats dmg:liberation 0.2）；覆映吾身（护盾量）不建模
 * 变奏 掌息之要: 33.80%×3+67.60%
 * 延奏 化境：下一位登场角色共鸣解放伤害加深 38%（解析）
 * 动作帧：WuWaSim（按原样映射）；解放两个条目 duration_s 为 null → 模块估计 1.5 秒（低）
 * 共鸣链：未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const QI = { a1: 10, a2: 15, a3: 20, a4: 15, hv: 10, E: 40, I: 20 };
  const LIB_TICKS = 6, ZT_TICKS = 18;
  const pick = (s, lab, count) => s.hits.filter((h) => !h.alt && h.label === lab).map((h) => (count ? Object.assign({}, h, { count }) : h));
  return WW.registerChar({
    id: 1405, chainModeled: 0, name: '鉴心', version: '0.1', confidence: 'medium',
    notes: ['气获取量为估计（低）', '运气持续伤害跳数 18、解放持续伤害跳数 6 为估计（低）', 'E 默认降气反击（木桩不出手）', '护盾/治疗不建模', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['zt', 'lib'], window: 25, sig: null, alts: [21040015, 21040016, 21040044], solo: 'jianxin_solo.json', team: 'team_danjin.json', teamMi: 2 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]',
      hv: '重击·heavy_heavy_attack [WuWaSim]', pr: '共鸣技能·skill_chi_parry_damage [WuWaSim]', ct: '共鸣技能·skill_chi_counter_damage [WuWaSim]',
      lib: '共鸣解放·liberation_resonance_liberation_explosion_damage [WuWaSim]', I: '变奏入场·intro [WuWaSim]',
      zt: '共鸣回路·forte_heavy_major_zhoutian_outer_shock_damage [WuWaSim]',
    },
    resources: [{ key: 'qi', name: '气', max: 120, segmented: false, confidence: 'low' }],
    kit(H) {
      const s3 = H.skill(3), s6 = H.skill(6);
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.33, 0.82, 0.92, 0.6] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.75, label: '重击' }),
        pr: H.act({ key: 'pr', cls: 'E', skill: 2, labels: ['降气反击伤害'], levelKey: 'skill', concertoParam: '降气反击回复协奏能量', cooldown: 12, cdKey: 'E', dur: 0.83, label: '静气循行·降气反击' }),
        ct: H.act({ key: 'ct', cls: 'E', skill: 2, labels: ['行气反击伤害'], levelKey: 'skill', concertoParam: '行气反击回复协奏能量', cooldown: 12, cdKey: 'E', dur: 1.0, label: '静气循行·行气反击' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, hits: pick(s3, '共鸣解放持续伤害', LIB_TICKS).concat(pick(s3, '共鸣解放炸裂伤害')), levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, cdKey: 'R', dur: 1.5, label: '涤净力场', inferred: '持续伤害×' + LIB_TICKS + '（估计）' }),
        zt: H.act({ key: 'zt', cls: 'H', skill: 6, hits: pick(s6, '运气持续伤害', ZT_TICKS).concat(pick(s6, '小周天震气伤害'), pick(s6, '大周天·内震气伤害'), pick(s6, '大周天·外震气伤害')), levelKey: 'forte', dur: 6.34, label: '重击·混元气旋（大周天·外）', inferred: '运气×' + ZT_TICKS + '（估计）+ 三次震气' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.36 }),
        O: B.outro(H, '化境'),
      });
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { qi: st.qi || 0, st: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: cs.qi >= 120 - 1e-9 ? K.zt : K.hv };
        case 'E': return api.cdReady('E') ? { act: api.H.opts.counter ? K.ct : K.pr } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) { return act && act.key === 'lib' ? [{ key: 'dmg:liberation', value: 0.2 }] : []; },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      const add = (n) => { cs.qi = Math.min(120, cs.qi + n); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; add(QI[k]); return; }
      switch (k) {
        case 'hv': add(QI.hv); break;
        case 'pr': case 'ct': add(QI.E); api.addConcerto(api.mi, 8); break;
        case 'I': add(QI.I); break;
        case 'zt': cs.qi = 0; api.addConcerto(api.mi, 5 + 18 + 23); break;
        default: break;
      }
    },
    // search heuristic (not a game rule): 气→混元气旋
    potential(api) { return api.cs.qi / 120 * 0.6 * api.est(api.mem.modKit.zt); },
  });
});
