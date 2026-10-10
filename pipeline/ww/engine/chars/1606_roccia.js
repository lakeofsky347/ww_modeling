/*
 * 洛可可 (1606) character module — worker-B.
 *
 * 普攻 佩洛，悠着点 (1002701): 4 段；「重击…命中目标时若【想象力】至少有100点，则将洛可可送上空中，进入飞跃幻想状态。可通过持续按住普攻进行蓄力，蓄力越久能获得越多的【想象力】」
 * 共鸣技能 高难度设计 (1002702): 61.47%×8，冷却 10，协奏 20；「把洛可可送上空中，进入飞跃幻想状态」
 * 共鸣解放 即兴喜剧，开场 (1002703): 278.34%×3「此次伤害为重击伤害。洛可可暴击高于50%时，每多出0.1%暴击，施放该技能时，使队伍中的角色攻击提升1点，持续30秒。最高可提升200点。」
 *   → 模块：施放时读取实时面板暴击，队伍 atkFlat 光环 30 秒（高）
 * 共鸣回路 道具师的自我修养 (1002707):「飞跃幻想…若至少拥有100点【想象力】，可短按普攻，消耗100点【想象力】施放普攻幻想照进现实。该状态会在洛可可不处于空中状态、或处于后台时解除。
 *   普攻·幻想照进现实：最多3段…此次伤害为重击伤害。第1段、第2段攻击落地后，若【想象力】大于100点，会将洛可可送上空中，进入飞跃幻想状态。
 *   【想象力】上限300点；常态攻击造成伤害可回复；持续按住普攻进行蓄力可获得；施放高难度设计时，回复100点；施放变奏技能佩洛，来帮忙时，回复100点。」
 *   → 常态攻击/蓄力重击的想象力获取量未公开：估计 A1 15 / A2 20 / A3 25 / A4 35 / 蓄力重击 40（低，module.gain 可改）
 * 变奏 佩洛，来帮忙 (1002706): 168.99%「施放该技能后在一定时间内短按普攻，将会施放普攻第4段」→ I 后 A = 第4段
 * 延奏 掌声鼓励 (1002709): 下一位登场角色湮灭加深 20%、普攻加深 25%，14 秒，切人结束（解析）
 * 固有：沉浸式演出 施放共鸣技能或重击时攻击 +20% 12 秒（解析）；珍奇箱（探索工具，视为声骸技能）：不建模
 * 共鸣链：1 高难度设计额外 +100 想象力、+10 协奏（模块）；2 幻想照进现实 → 队伍湮灭 +10%×3（满层再 +10%）（模块触发）；3 变奏暴击/爆伤（解析）；
 *   4 高难度设计后 12 秒幻想照进现实 ×1.6（模块）；5 共鸣解放 ×1.2、重击 ×1.8（模块）；6 共鸣解放后 12 秒：幻想照进现实无视 60% 防御，第3段后可接构筑现实（=第3段 100%，模块）
 * 专武 悲喜剧 (21040026)：「施放普攻或变奏技能时，自身重击伤害加成提升48%，持续3秒」（解析；幻想照进现实由普攻键施放 → 触发）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21040026;
  const GAIN = { A1: 15, A2: 20, A3: 25, A4: 35, H: 40 };
  return WW.registerChar({
    id: 1606, chainModeled: 6, name: '洛可可', version: '0.1', confidence: 'medium',
    notes: ['想象力：常态攻击/蓄力重击获取量为估计（低）', '飞跃幻想按“动作链”建模：E / 重击(≥100) / 幻想照进现实第1、2段落地(>100) 进入；其他动作或切人结束',
      '共鸣解放攻击加成按施放时实时暴击计算（队伍光环 30 秒）', '珍奇箱不建模'],
    audit: { role: 'subdps', finishers: ['rf1', 'R'], window: 25, sig: SIG, alts: [21040015, 21040045, 21040074], solo: 'roccia_solo.json', team: 'team_camellya_roccia.json', teamMi: 1 },
    frames: {
      A1: '普攻·Basic: Pero, Easy 1', A2: '普攻·Basic: Pero, Easy 2', A3: '普攻·Basic: Pero, Easy 3', A4: '普攻·Basic: Pero, Easy 4',
      E: '共鸣技能·Skill: Acrobatic Trick', R: '共鸣解放·Liberation: Commedia Improvviso!', I: '变奏入场·Intro: Pero, Help',
      rf1: '共鸣回路·Forte: Real Fantasy 1', rf2: '共鸣回路·Forte: Real Fantasy 2', rf3: '共鸣回路·Forte: Real Fantasy 3', rr: '共鸣回路·Forte: Reality Recreation',
    },
    resources: [
      { key: 'im', name: '想象力', max: 300, segmented: false, confidence: 'low', basis: '上限/固定获取高；常态攻击获取估计' },
      { key: 'fly', name: '飞跃幻想', max: 1, segmented: true, confidence: 'medium', get: (cs) => (cs.fly ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 4, durs: [0.45, 0.75, 1.07, 1.45] });
      Object.assign(K, {
        // 蓄力重击：action_frames 起手 0.27s + 结束 0.77s；按住时长估计 → 1.3s（低）
        hc: H.act({ key: 'hc', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.3, scale: ch >= 5 ? { '*': 1.8 } : null, label: '佩洛，悠着点·蓄力重击' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 10, cdKey: 'E', dur: 1.58 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, dur: 3.33, scale: ch >= 5 ? { '*': 1.2 } : null }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.13 }),
        O: B.outro(H, '掌声鼓励'),
      });
      for (let k = 1; k <= 3; k++) K['rf' + k] = H.act({ key: 'rf' + k, cls: 'A', skill: 6, labels: ['第' + B.CN[k - 1] + '段伤害'], levelKey: 'forte', concertoParam: '第' + B.CN[k - 1] + '段回复协奏能量', ownStage: true, dur: [1.05, 1.05, 1.43][k - 1], label: '普攻·幻想照进现实' + k });
      K.rr = H.act({ key: 'rr', cls: 'A', skill: 6, labels: ['第三段伤害'], levelKey: 'forte', ownStage: true, dur: 1.13, label: '普攻·构筑现实（链6）' });
      B.patch(H, /施放普攻幻想照进现实时，队伍中的角色湮灭伤害加成提升10%/, { trigger: { on: 'act', keys: ['rf1', 'rf2', 'rf3', 'rr'] }, mode: 'auto' }, '模块：触发=幻想照进现实', 'chain');
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'A4'],
    init(api) { const st = api.H.opts.start || {}; return { im: st.im || 0, fly: false, rf: 0, st: 0, c4Until: null, c6Until: null, atkUntil: null, atkFlat: 0, c2: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, ch = api.H.chain;
      switch (btn) {
        case 'A': {
          if (cs.fly && cs.rf === 3 && ch >= 6 && on(cs.c6Until, t)) return { act: K.rr };
          if (cs.fly && cs.im >= 100 - 1e-9 && cs.rf < 3) {
            const a = K['rf' + (cs.rf + 1)];
            const sc = ch >= 4 && on(cs.c4Until, t) ? 1.6 : 1;
            return { act: sc !== 1 ? Object.assign({}, a, { scale: { '*': sc }, inferred: '链4 ×1.6' }) : a };
          }
          return { act: K['A' + ((cs.st % 4) + 1)] };
        }
        case 'H': return { act: K.hc };
        case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '高难度设计冷却中' };
        case 'R': return { act: K.R };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      if (api.H.chain >= 6 && /^r[fr]/.test(act.key) && on(api.cs.c6Until, api.t)) return [{ key: 'defIgnore', value: 0.6 }];
      return [];
    },
    auras(api, target) {
      const cs = api.cs;
      return on(cs.atkUntil, api.t) && cs.atkFlat > 0 ? [{ key: 'atkFlat', value: cs.atkFlat }] : [];
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain, g = Object.assign({}, GAIN, api.H.opts.gain || {});
      const add = (n) => { cs.im = Math.min(300, cs.im + n); };
      if (/^A\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; add(g[k]); cs.fly = false; cs.rf = 0; return; }
      switch (k) {
        case 'hc': cs.st = 0; add(g.H); cs.fly = cs.im >= 100 - 1e-9; cs.rf = 0; break;
        case 'E': cs.st = 0; add(100 + (ch >= 1 ? 100 : 0)); cs.fly = true; cs.rf = 0; if (ch >= 4) cs.c4Until = te + 12; if (ch >= 1) api.addConcerto(api.mi, 10); break;
        case 'rf1': case 'rf2': cs.im -= 100; cs.rf = +k.slice(2); cs.fly = cs.im >= 100 - 1e-9; break;
        case 'rf3': cs.im -= 100; cs.rf = 3; cs.fly = ch >= 6 && on(cs.c6Until, te); break;
        case 'rr': cs.fly = true; break;
        case 'R': {
          cs.fly = false; cs.rf = 0; cs.st = 0;
          const cr = api.livePanel().critRate;
          cs.atkFlat = Math.max(0, Math.min(200, Math.floor((cr - 0.5) * 1000 + 1e-9)));
          cs.atkUntil = te + 30;
          if (ch >= 6) cs.c6Until = te + 12;
          break;
        }
        case 'I': cs.st = 3; add(100); cs.fly = false; cs.rf = 0; break;
        default: cs.fly = false; cs.rf = 0; break;
      }
    },
    swapOut(api) { api.cs.fly = false; api.cs.rf = 0; },
    // search heuristic (not a game rule): 想象力 → 幻想照进现实
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return (cs.im / 100) * 0.7 * api.est(K.rf2) + (cs.im >= 300 - 1e-9 ? 0.3 * api.est(K.rf3) : 0) + (cs.fly && cs.im >= 100 ? 0.2 * api.est(K.rf1) : 0);
    },
  });
});
