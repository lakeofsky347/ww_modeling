/*
 * 忌炎 (1404) character module — worker-B.
 *
 * 普攻 孤枪止戈 (1001101): 「进行至多5段的连续攻击」「重击·潜渊斩：若在重击期间松开普攻，会在重击结束后施放潜渊斩」
 *   → H = 重击 + 潜渊斩（合为一个动作，中）
 * 共鸣技能 枪扫风定 (1001102): 冷却 7，回复协奏 16。
 * 共鸣解放 苍躣八荒·谋定 (1001103): 「进入破阵状态…普攻、重击和闪避反击替换为重击破阵之枪。重击·破阵之枪：进行最多3段的连续攻击…此次伤害为重击伤害。」
 *   破阵状态持续时间=10，冷却 16，消耗共鸣能量 125。
 * 共鸣回路 苍龙破阵 (1001107):
 *   「施放共鸣技能枪扫风定时，若积攒30点以上【破阵值】，则消耗30点【破阵值】，此次共鸣技能枪扫风定伤害提升20%。
 *    处于破阵状态时，共鸣技能枪扫风定伤害提升20%，且不再消耗【破阵值】。」 → E ×1.2（高）
 *   「施放共鸣解放苍躣八荒·谋定时，若积攒30点以上【破阵值】，则消耗30点【破阵值】，施放苍躣八荒·后动，造成气动伤害，此次伤害为重击伤害。」
 *   「【破阵值】上限60点。常态攻击孤枪止戈命中目标时积攒【破阵值】。变奏技能攻其不备命中目标时积攒【破阵值】。」
 *   → 每动作获得量未公开：A1 5 / A2 5 / A3 10 / A4 10 / A5 15 / 重击 10（低，module.gain 可改）；变奏 30（gachahq 测试服文本「Accumulate 30 points … Tactical Strike」，中）
 *   → 15 秒未命中衰减：不建模（循环中持续命中）
 * 延奏 克己 (1001109): 「下一位登场角色重击命中目标时，忌炎将召唤长枪协同攻击，造成忌炎313.40%攻击的气动伤害，该协同攻击效果持续8秒，每1秒可触发1次，最多可触发2次。」
 *   → 下一位登场角色的重击类伤害事件（hits 含 heavy）触发，_common.perSecond（8 s / 2 次，中）
 * 固有 垂天平澜：变奏后攻击 +10% 15 秒（解析自动）；蕴风集流：「攻击命中目标时，忌炎的暴击伤害提升12%，持续8秒。」→ 输出期间常驻（中）
 * 共鸣链：1 E 2 次 + 消耗 −15；2 变奏 +30 破阵值、攻击 +28%（解析）；3 暴击（解析，E/R/I）；4 R → 全队重击 +25%（解析）；
 *   5 「延奏技能克己伤害倍率增加120%」→ 换用 ww.json 行 1404009015（4.334 = 313.4%+120%，高）；攻击 3%×15 命中叠层 → 常驻满层（中）；
 *   6 「每次使用重击、变奏技能攻其不备或共鸣技能枪扫风定时，获得1层【锐意之势】，最多可叠加2层…每层…后动的伤害倍率提升120%」→ 后动 ×(1+1.2n)（中：倍率相加约定）
 * 专武 苍鳞千嶂 (21010016)：变奏/解放 → 重击 +24% ×2（解析自动）。
 * 动作帧：WuWaSim（action_frames.json 16:14 起收录；只做键映射，duration 由核心加载器解释）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on, perSecond, rowHit } = C;
  const GAIN = { A1: 5, A2: 5, A3: 10, A4: 10, A5: 15, H: 10, I: 30 };
  return WW.registerChar({
    id: 1404, chainModeled: 6, name: '忌炎', version: '0.1', confidence: 'medium',
    notes: ['破阵值：普攻/重击每动作获得量为估计（低，module.gain 覆盖），变奏 +30（中）', 'H = 重击 + 潜渊斩（合并动作）',
      '延奏克己：下一位登场角色的重击伤害触发协同（≤2 次，1/s，8 s）'],
    audit: { role: 'dps', finishers: ['R', 'q1'], note: '后动（Rhd）含 2.9s 冻结帧（时停未建模），搜索在 25s 内常选先 E 消耗破阵值；不列为必用招式', window: 25, sig: 21010016, alts: [21010015, 21010045, 21010074], solo: 'jiyan_solo.json', team: 'team_jiyan.json', teamMi: 0 },
    // action_frames（WuWaSim：duration_s = 到下一动作可开始的时间；按原样映射，由核心加载器解释）
    frames: {
      A1: '普攻·basic_1 [WuWaSim]', A2: '普攻·basic_2 [WuWaSim]', A3: '普攻·basic_3 [WuWaSim]', A4: '普攻·basic_4 [WuWaSim]', A5: '普攻·basic_5 [WuWaSim]',
      E: '共鸣技能·skill [WuWaSim]', I: '变奏入场·intro [WuWaSim]', houdong: '共鸣回路·forte_heavy_emerald_storm_finale_damage [WuWaSim]',
      q1: '共鸣解放·liberation_lance_of_qingloong_1 [WuWaSim]', q2: '共鸣解放·liberation_lance_of_qingloong_2 [WuWaSim]', q3: '共鸣解放·liberation_lance_of_qingloong_3 [WuWaSim]',
    },
    resources: [
      { key: 'pz', name: '破阵值', max: 60, segmented: false, confidence: 'low', basis: '上限 60（描述）；获取量估计' },
      { key: 'pzs', name: '破阵状态（秒）', max: 10, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.pzUntil, t).toFixed(2) },
      { key: 'ry', name: '锐意之势（链6）', max: 2, segmented: true, confidence: 'medium' },
    ],
    kit(H) {
      const K = B.stages(H, { n: 5, durs: [0.5, 0.6, 1.0, 0.8, 1.6] });
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害', '潜渊斩伤害'], levelKey: 'basic', dur: 1.6, label: '孤枪止戈·重击+潜渊斩' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 7, cdKey: 'E', dur: 0.9 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 16, dur: 1.2, label: '苍躣八荒·谋定' }),
        houdong: H.act({ key: 'houdong', cls: 'R', skill: 6, labels: ['苍躣八荒·后动伤害'], levelKey: 'forte', dur: 1.4, label: '苍躣八荒·后动' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.2 }),
      });
      for (let k = 1; k <= 3; k++) K['q' + k] = H.act({ key: 'q' + k, cls: 'H', skill: 3, labels: ['破阵之枪第' + B.CN[k - 1] + '段伤害'], levelKey: 'liberation', ownStage: true, dur: [1.1, 1.1, 1.4][k - 1], label: '重击·破阵之枪' + k });
      const c5 = H.chain >= 5;
      const o11 = H.skill(11);
      const oh = c5 ? [rowHit(H, 11, 1404009015, { label: '克己伤害（链5）', why: '链5「延奏技能克己伤害倍率增加120%」：4.334 = 313.4%+120%' })].filter(Boolean) : o11.hits;
      K.coord = H.act({ key: 'coord', cls: 'O', skill: 11, hits: oh, levelKey: 'outro', label: '克己（协同）' });
      K.O = H.act({ key: 'O', cls: 'O', skill: 11, hits: [], levelKey: 'outro', label: '克己' });
      B.onHitAlways(H, /蕴风集流/);
      B.onHitAlways(H, /攻击命中目标时，忌炎的攻击提升3%/, 'chain');
      // 链4「施放…谋定或…后动时」→ R（谋定）施放即触发（解析为 cast R，已正确）
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'A4', 'A5'],
    init(api) { const st = api.H.opts.start || {}; return { pz: st.pz != null ? st.pz : 0, st: 0, q: 0, pzUntil: null, ry: 0, kj: null, e2: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const pzs = on(cs.pzUntil, t);
      switch (btn) {
        case 'A': return { act: pzs ? K['q' + ((cs.q % 3) + 1)] : K['A' + ((cs.st % 5) + 1)] };
        case 'H': return { act: pzs ? K['q' + ((cs.q % 3) + 1)] : K.H };
        case 'E': {
          // 链1「共鸣技能枪扫风定可使用次数增加1次」→ 2 次充能（单独计时）
          const cost = api.H.chain >= 1 ? 15 : 30;
          const boosted = pzs || cs.pz >= cost - 1e-9;
          const a = boosted ? Object.assign({}, K.E, { scale: { '*': 1.2 }, inferred: pzs ? '破阵状态：枪扫风定 +20%' : '消耗破阵值：枪扫风定 +20%' }) : K.E;
          if (api.H.chain >= 1 && !api.cdReady('E')) { if (!api.cdReady('E2')) return { blocked: '枪扫风定冷却中' }; return { act: Object.assign({}, a, { cdKey: 'E2' }), meta: { boosted, cost } }; }
          return { act: a, meta: { boosted, cost } };
        }
        case 'R': {
          if (cs.pz >= 30 - 1e-9) {
            const c6 = api.H.chain >= 6 ? 1 + 1.2 * cs.ry : 1;
            const hd = c6 !== 1 ? Object.assign({}, K.houdong, { scale: { '*': c6 } }) : K.houdong;
            return { act: Object.assign({}, K.R, { key: 'Rhd', cdKey: 'R', hits: hd.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * c6) })), defDur: 2.6, duration: K.R.duration + K.houdong.duration,
              label: '苍躣八荒·谋定+后动', inferred: c6 !== 1 ? '链6 锐意之势 ×' + c6.toFixed(1) : null }), meta: { hd: true } };
          }
          return { act: K.R };
        }
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act, meta) {
      const cs = api.cs, k = act.key, g = Object.assign({}, GAIN, api.H.opts.gain || {});
      const ch = api.H.chain;
      if (/^A\d$/.test(k)) { cs.st = +k.slice(1) % 5; cs.pz = Math.min(60, cs.pz + g[k]); } else cs.st = 0;
      if (/^q\d$/.test(k)) cs.q = +k.slice(1) % 3; else if (k !== 'E') cs.q = cs.q || 0;
      switch (k) {
        case 'H': cs.pz = Math.min(60, cs.pz + g.H); if (ch >= 6) cs.ry = Math.min(2, cs.ry + 1); break;
        case 'E': if (meta && meta.boosted && !on(cs.pzUntil, api.t)) cs.pz = Math.max(0, cs.pz - meta.cost); if (ch >= 6) cs.ry = Math.min(2, cs.ry + 1); break;
        case 'R': case 'Rhd': cs.pzUntil = api.tEnd + 10; cs.q = 0; if (meta && meta.hd) { cs.pz = Math.max(0, cs.pz - 30); cs.ry = 0; } break;
        case 'I': cs.pz = Math.min(60, cs.pz + g.I + (ch >= 2 && !on(cs.c2cd, api.t) ? 30 : 0)); if (ch >= 2) cs.c2cd = api.t + 15; if (ch >= 6) cs.ry = Math.min(2, cs.ry + 1); break;
        default: if (/^q\d$/.test(k) && ch >= 6) cs.ry = Math.min(2, cs.ry + 1); break;
      }
    },
    onOutro(api, to) { api.cs.kj = { until: api.t + 8, left: 2, next: api.t, to }; },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type !== 'damage' || ev.coord || !cs.kj || ev.mi !== cs.kj.to || ev.mi === api.mi) return;
      if (!(ev.act && (ev.act.cls === 'H' || (ev.act.hits || []).some((h) => h.type === 'heavy')))) return;
      const n = perSecond(cs.kj, ev.t, ev.dur || 0, 0, api.ctx.duration);
      if (n) api.deal(api.mem.modKit.coord, { count: n });
    },
    // search heuristic (not a game rule): stored 破阵值 ≈ an extra 后动 / boosted E; open 破阵状态 ≈ remaining lances
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      const lanceRate = (api.est(K.q1) + api.est(K.q2) + api.est(K.q3)) / 3.6;
      return Math.min(cs.pz, 60) / 30 * 0.3 * api.est(K.houdong) + B.rem(cs.pzUntil, api.t) * 0.5 * lanceRate;
    },
  });
});
