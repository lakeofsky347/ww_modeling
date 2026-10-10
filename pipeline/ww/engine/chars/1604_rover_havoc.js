/*
 * 漂泊者·湮灭 (1604 / 1605, 两个性别同一技能组) character module — worker-B.
 * 帧数据：WuWaSim（duration_s = 到下一动作可开始的时间；由核心加载器按来源处理，本模块只做键映射）
 *
 * 普攻 裁羽弑音 (1001701): 5 段；重击 95.43%（之后普攻第4段）
 * 共鸣技能 行刃 (1001702): 286.29%×2，冷却 12
 * 共鸣解放 临渊死寂 (1001703): 1520.90%，冷却 16，消耗 125
 * 共鸣回路 永夜开明 (1001707):「【暗流】充满时，长按普攻将会施放灭音…此次伤害为重击伤害。施放灭音后，进入暗涌状态：普攻替换为强化普攻（5段）；重击替换为强化重击；
 *   施放强化重击后短按普攻 → 重击鸣刃；鸣刃后短按普攻 → 第3段强化普攻；共鸣技能行刃替换为破命（冷却 12）」
 *   「【暗流】上限100点。常态攻击命中、行刃、破命、变奏时可积攒」→ 每次积攒量未公开：估计 普攻每段 8–15、行刃/破命/变奏 20（低）
 *   暗涌状态持续时间原文未写：opts.dyDur 默认 12 秒（低）
 * 固有 变格：暗涌时湮灭伤害 +20%（模块）；拢音：暗涌时普攻命中额外 +1 共鸣能量/秒（模块：每个强化普攻 +1）
 * 变奏 化刹 198.81%；延奏 唤声：「召唤湮灭场…每2秒…143.3%攻击的湮灭伤害，持续6秒」→ 模块：延奏时以协同伤害计 3 次（时间近似）
 * 共鸣链：1 技能 +30%；2 灭音重置技能冷却；5 第5段额外 50%；6 暗涌暴击 +25%（模块）；3/4 未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const W = ' [WuWaSim]';
  const DL = { a1: 8, a2: 10, a3: 10, a4: 12, a5: 15, hv: 8, E: 20, pm: 20, I: 20 };
  function def(id) {
    return {
      id, chainModeled: 6, name: '漂泊者·湮灭', version: '0.1', confidence: 'medium',
      notes: ['暗流积攒量为估计（低）', '暗涌持续时间未写明：默认 12 秒（低）', '延奏湮灭场按 3 次协同伤害在延奏时结算'],
      audit: id === 1604
        ? { role: 'dps', finishers: ['my', 'lib'], window: 25, sig: null, solo: 'rover_havoc_solo.json', team: 'team_rover_havoc.json', teamMi: 0 }
        : { role: 'dps', finishers: ['my', 'lib'], window: 25, sig: null, solo: 'rover_havoc_f_solo.json', team: 'team_rover_havoc_f.json', teamMi: 0 },
      frames: {
        a1: '普攻·basic_1' + W, a2: '普攻·basic_2' + W, a3: '普攻·basic_3' + W, a4: '普攻·basic_4' + W, a5: '普攻·basic_5' + W,
        hv: '重击·heavy_heavy_attack' + W, E: '共鸣技能·skill' + W, lib: '共鸣解放·liberation' + W, I: '变奏入场·intro' + W,
        my: '共鸣回路·forte_heavy_devastation_damage' + W,
        u1: '共鸣回路·forte_basic_umbra_basic_attack_1' + W, u2: '共鸣回路·forte_basic_umbra_basic_attack_2' + W, u3: '共鸣回路·forte_basic_umbra_basic_attack_3' + W,
        u4: '共鸣回路·forte_basic_umbra_basic_attack_4' + W, u5: '共鸣回路·forte_basic_umbra_basic_attack_5' + W,
        uh: '共鸣回路·forte_heavy_umbra_heavy_attack' + W, mr: '共鸣回路·forte_heavy_umbra_thwackblade_damage' + W, pm: '共鸣回路·forte_heavy_umbra_lifetaker_damage' + W,
      },
      resources: [
        { key: 'dl', name: '暗流', max: 100, segmented: false, confidence: 'low' },
        { key: 'dy', name: '暗涌', max: 1, segmented: true, confidence: 'medium', get: (cs, t) => (on(cs.dyUntil, t) ? 1 : 0) },
      ],
      kit(H) {
        const ch = H.chain;
        const K = Object.assign(B.stages(H, { n: 5, prefix: 'a', durs: [0.3, 0.59, 0.44, 0.64, 1.0] }),
          B.stages(H, { n: 5, prefix: 'u', skill: 6, levelKey: 'forte', pre: '暗流·普攻', durs: [0.2, 0.34, 0.57, 0.82, 0.84] }), {
            hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.63, label: '重击' }),
            E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 12, cdKey: 'E', dur: 1.07, label: '行刃' }),
            my: H.act({ key: 'my', cls: 'H', skill: 6, labels: ['灭音伤害'], levelKey: 'forte', dur: 0.85, label: '灭音' }),
            uh: H.act({ key: 'uh', cls: 'H', skill: 6, labels: ['暗流·重击伤害'], levelKey: 'forte', dur: 0.63, label: '暗涌·强化重击' }),
            mr: H.act({ key: 'mr', cls: 'A', skill: 6, labels: ['暗流·鸣刃伤害'], levelKey: 'forte', dur: 0.61, label: '重击鸣刃' }),
            pm: H.act({ key: 'pm', cls: 'E', skill: 6, labels: ['暗流·破命伤害'], levelKey: 'forte', concertoParam: '破命回复协奏能量', cooldown: 12, cdKey: 'E', dur: 1.12, label: '破命' }),
            lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 16, dur: 2.27, label: '临渊死寂' }),
            I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.81 }),
            O: B.outro(H, '唤声'),
          });
        // 延奏 唤声：143.3%×3（描述，无命中行）→ 以变奏命中行为模板构造
        const tpl = K.I.hits[0];
        if (tpl) K.field = Object.assign({}, K.I, { key: 'field', cls: 'Z', label: '唤声·湮灭场', hits: [Object.assign({}, tpl, { label: '唤声·湮灭场', type: 'outro', multiplier: tpl.multiplier.map(() => 1.433), count: 3, energy: [0], concerto: [0], confidence: 'medium' })], duration: 0, energy: 0, concerto: 0 });
        if (ch >= 5) for (const k of ['a5', 'u5']) K[k] = Object.assign({}, K[k], { hits: K[k].hits.concat(K[k].hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * 0.5) }))) });
        B.patch(H, /处于暗涌状态时，湮灭伤害加成提升20%/, { mode: 'module', trigger: { on: 'manual' } }, '模块：暗涌期间', 'inherent');
        return K;
      },
      fillerKeys: ['a1', 'a2', 'a3', 'a4', 'a5'],
      init(api) { const st = api.H.opts.start || {}; return { dl: st.dl || 0, dyUntil: null, st: 0, ust: 0, nextA: null }; },
      resolve(api, btn) {
        const K = api.mem.modKit, cs = api.cs, t = api.t;
        const dy = on(cs.dyUntil, t);
        switch (btn) {
          case 'A':
            if (cs.nextA) return { act: K[cs.nextA] };
            return { act: dy ? K['u' + ((cs.ust % 5) + 1)] : K['a' + ((cs.st % 5) + 1)] };
          case 'H':
            if (cs.dl >= 100 - 1e-9) return { act: K.my };
            return { act: dy ? K.uh : K.hv };
          case 'E': return api.cdReady('E') ? { act: dy ? K.pm : K.E } : { blocked: '冷却中' };
          case 'R': return { act: K.lib };
          case 'I': return { act: K.I };
          default: return B.common(api, btn);
        }
      },
      actionStats(api) {
        const cs = api.cs, t = api.t, ch = api.H.chain, out = [];
        if (on(cs.dyUntil, t)) { out.push({ key: 'dmg:havoc', value: 0.2 }); if (ch >= 6) out.push({ key: 'critRate', value: 0.25 }); }
        if (ch >= 1) out.push({ key: 'dmg:skill', value: 0.3 });
        return out;
      },
      apply(api, act) {
        const cs = api.cs, k = act.key, te = api.tEnd, t = api.t;
        const dy = on(cs.dyUntil, t);
        const gain = (n) => { cs.dl = Math.min(100, cs.dl + n); };
        cs.nextA = null;
        if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 5; gain(DL[k]); return; }
        if (/^u\d$/.test(k)) { cs.ust = +k.slice(1) % 5; if (api.ms.energy != null) api.ms.energy = Math.min(api.H.R.energy.liberationCost, api.ms.energy + 1); return; }
        switch (k) {
          case 'hv': gain(DL.hv); cs.nextA = 'a4'; break;
          case 'my': cs.dl = 0; cs.dyUntil = te + (api.H.opts.dyDur || 12); cs.ust = 0; if (api.H.chain >= 2) api.ms.cd.E = 0; break;
          case 'uh': cs.nextA = 'mr'; break;
          case 'mr': cs.nextA = 'u3'; break;
          case 'E': gain(DL.E); break;
          case 'pm': gain(DL.pm); break;
          case 'I': gain(DL.I); break;
          case 'O': if (api.mem.modKit.field) api.deal(api.mem.modKit.field, { coord: true }); break;
          default: break;
        }
      },
      // search heuristic (not a game rule): 暗流 → 灭音/暗涌
      potential(api) {
        const cs = api.cs, K = api.mem.modKit;
        const dy = on(cs.dyUntil, api.t);
        return (dy ? 0 : cs.dl / 100 * 0.6 * (api.est(K.my) + 0.15 * (api.est(K.u3) + api.est(K.u5)))) + (dy ? 0.1 * (cs.dyUntil - api.t) / 12 * api.est(K.u5) : 0);
      },
    };
  }
  WW.registerChar(def(1605));
  return WW.registerChar(def(1604));
});
