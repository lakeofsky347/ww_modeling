/*
 * 丹瑾 (1602) character module — worker-B.
 *
 * 普攻 执刃 (1000801): 普攻 3 段；重击 37.12%×3
 * 共鸣技能 朱华残章 (1000802):「赤华 38.18%×2」；「朱蚀：在第2段普攻、闪避反击或变奏技能击雠施放后，短按共鸣技能，可进行最多2段的连续攻击…第2段朱蚀命中时…附加朱蚀之刻」
 *   「朱蚀之刻：丹瑾攻击携带朱蚀之刻的目标时，造成的伤害提升20%」12 秒（模块 actionStats dmg:all 0.2）
 *   「烬灭：在第3段普攻后短按共鸣技能，可进行最多3段的连续攻击」；冷却 0；每次攻击消耗 3% 生命（不建模）
 * 共鸣解放 绯红绽放 (1000803): 49.09%×8 + 392.65%，冷却 16，100 能量
 * 共鸣回路 丹心昭瑾 (1000807):
 *   「【彤华】积攒60点以上时，长按普攻，将会消耗所有【彤华】施放缭乱…若【彤华】积攒至120点时，则消耗120点【彤华】，此次缭乱和纷落的伤害倍率提升」
 *   「重击缭乱后一定时间内短按普攻，将会施放纷落」；缭乱协奏 50
 *   「施放共鸣技能朱华残章时，回复【彤华】」→ 每段回复量未公开：估计 赤华 10 / 朱蚀 15 / 烬灭 12（低）
 * 固有 盈溢：「施放共鸣技能烬灭后，丹瑾的重击伤害提升30%，效果持续5秒」（解析为任意 E → 模块：烬灭时触发）；绯光（闪避反击·逐影）不建模
 * 变奏 击雠: 49.71%×4
 * 延奏 明晦：下一位登场角色湮灭伤害加深 23%（解析）
 * 动作帧：WuwaLAB
 * 共鸣链：未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const TH = { ch: 10, zs1: 15, zs2: 15, jm1: 12, jm2: 12, jm3: 12 };
  return WW.registerChar({
    id: 1602, chainModeled: 0, name: '丹瑾', version: '0.1', confidence: 'medium',
    notes: ['彤华每段回复量为估计（低）', '生命消耗与治疗不建模', '闪避反击·逐影（绯光）不建模', '共鸣链未建模'],
    audit: { role: 'dps', finishers: ['lrF', 'fnF', 'lib'], window: 25, sig: null, alts: [21020015, 21020017, 21020064], solo: 'danjin_solo.json', team: 'team_danjin.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('a', 3, '普攻·Basic: Execution'), B.stageFrames('zs', 2, '共鸣技能·Skill 2: Crimson Erosion'), B.stageFrames('jm', 3, '共鸣技能·Skill 3: Sanguine Pulse'), {
      hv: '重击·Heavy: Execution', ch: '共鸣技能·Skill 1: Carmine Gleam', lib: '共鸣解放·Liberation: Crimson Bloom', I: '变奏入场·Intro: Vindication', O: '延奏·Outro: Duality',
      lr: '共鸣回路·Forte: Chaoscleave', fn: '共鸣回路·Forte: Scatterbloom', lrF: '共鸣回路·Forte: Chaoscleave (Full Energy)', fnF: '共鸣回路·Forte: Scatterbloom (Full Energy)',
    }),
    resources: [{ key: 'th', name: '彤华', max: 120, segmented: false, confidence: 'low' }],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 3, prefix: 'a', durs: [0.27, 0.42, 0.47] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.67, label: '重击' }),
        ch: H.act({ key: 'ch', cls: 'E', skill: 2, labels: ['赤华伤害'], levelKey: 'skill', dur: 0.48, label: '赤华' }),
        zs1: H.act({ key: 'zs1', cls: 'E', skill: 2, labels: ['朱蚀一段伤害'], levelKey: 'skill', dur: 0.62, label: '朱蚀·第一段' }),
        zs2: H.act({ key: 'zs2', cls: 'E', skill: 2, labels: ['朱蚀二段伤害'], levelKey: 'skill', dur: 0.77, label: '朱蚀·第二段' }),
        jm1: H.act({ key: 'jm1', cls: 'E', skill: 2, labels: ['烬灭第一段伤害'], levelKey: 'skill', dur: 0.55, label: '烬灭·第一段' }),
        jm2: H.act({ key: 'jm2', cls: 'E', skill: 2, labels: ['烬灭第二段伤害'], levelKey: 'skill', dur: 0.62, label: '烬灭·第二段' }),
        jm3: H.act({ key: 'jm3', cls: 'E', skill: 2, labels: ['烬灭第三段伤害'], levelKey: 'skill', dur: 0.98, label: '烬灭·第三段' }),
        lr: H.act({ key: 'lr', cls: 'H', skill: 6, labels: ['缭乱伤害'], levelKey: 'forte', concertoParam: '缭乱恢复协奏能量', dur: 1.2, label: '重击·缭乱' }),
        fn: H.act({ key: 'fn', cls: 'A', skill: 6, labels: ['纷落伤害'], levelKey: 'forte', dur: 0.82, label: '重击·纷落' }),
        lrF: H.act({ key: 'lrF', cls: 'H', skill: 6, labels: ['满能缭乱伤害'], levelKey: 'forte', concertoParam: '缭乱恢复协奏能量', dur: 1.2, label: '重击·缭乱（满能）' }),
        fnF: H.act({ key: 'fnF', cls: 'A', skill: 6, labels: ['满能纷落伤害'], levelKey: 'forte', dur: 0.82, label: '重击·纷落（满能）' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['连续攻击伤害', '绯刹爆发伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 16, cdKey: 'R', dur: 3.2, label: '绯红绽放' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.72 }),
        O: B.outro(H, '明晦'),
      });
      B.patch(H, /施放共鸣技能烬灭后/, { mode: 'module', trigger: { on: 'manual' } }, '模块：烬灭时触发（解析为任意 E）', 'inherent');
      H._yy = H.findBuff((b) => b.kind === 'inherent' && /施放共鸣技能烬灭后/.test(b.text || '')).map((b) => b.id);
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3'],
    init(api) { const st = api.H.opts.start || {}; return { th: st.th || 0, st: 0, chainE: null, after: null, markUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.after === 'lr') return { act: K.fn };
          if (cs.after === 'lrF') return { act: K.fnF };
          return { act: K['a' + ((cs.st % 3) + 1)] };
        case 'H':
          if (cs.th >= 120 - 1e-9) return { act: K.lrF };
          if (cs.th >= 60 - 1e-9) return { act: K.lr };
          return { act: K.hv };
        case 'E':
          if (cs.chainE) return { act: K[cs.chainE] };
          if (cs.after === 'a2' || cs.after === 'I') return { act: K.zs1 };
          if (cs.after === 'a3') return { act: K.jm1 };
          return { act: K.ch };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api) { return on(api.cs.markUntil, api.t) ? [{ key: 'dmg:all', value: 0.2 }] : []; },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd;
      cs.chainE = null; cs.after = null;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 3; cs.after = k; return; }
      if (TH[k] != null) cs.th = Math.min(120, cs.th + TH[k]);
      switch (k) {
        case 'zs1': cs.chainE = 'zs2'; break;
        case 'zs2': cs.markUntil = te + 12; break;
        case 'jm1': cs.chainE = 'jm2'; break;
        case 'jm2': cs.chainE = 'jm3'; break;
        case 'jm3': for (const id of api.H._yy || []) api.fireBuff(id, api.mi, { duration: 5 }); break;
        case 'lr': cs.th = 0; cs.after = 'lr'; break;
        case 'lrF': cs.th = 0; cs.after = 'lrF'; break;
        case 'I': cs.after = 'I'; break;
        default: break;
      }
    },
    // stream B B12a: hold 60–119 彤华 缭乱 while 120 彤华 is reachable (≈12 彤华 per ~1.2 s 技能段, estimate) — search only
    hold(api, act, rem) {
      if (act.key !== 'lr') return null;
      const reach = (120 - api.cs.th) / 12 * 1.2 + 1;
      return rem > reach + 1 ? '保留彤华至 120' : null;
    },
    // search heuristic (not a game rule): 彤华→缭乱/纷落
    potential(api) { const K = api.mem.modKit; return api.cs.th / 120 * 0.6 * (api.est(K.lrF) + api.est(K.fnF)); },
  });
});
