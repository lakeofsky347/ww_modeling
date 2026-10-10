/*
 * 长离 (1205) character module.
 *
 * 普攻 衔火洞明 (1002101): 「施放地面普攻第4段后进入心眼状态，持续12秒。」
 * 共鸣技能 赫羽三相 (1002102):
 *   「心眼·劫：短按共鸣技能，长离在空间内高速攻击敌人后进入心眼状态，持续12秒…初始拥有2次可使用次数，每12秒可使用次数增加1次，可使用次数上限2次。」
 *   「普攻·心眼·征：心眼状态下，长离在地面短按普攻，将会施放心眼·征…施放后退出心眼状态，此次伤害为共鸣技能伤害。」 (心眼·冲 = 跳跃/空中版本，未单独建模，同征)
 *   params: 心眼·劫回复协奏能量=14, 心眼·征回复协奏能量=7
 * 共鸣解放 离火照丹心 (1002103): 「获得4层【离火】，并进入焰羽状态。焰羽：10秒内施放重击焚身以火时攻击提升25%，施放后效果提前结束。」
 * 共鸣回路 焚身以火 (1002107): 「施放重击时，若长离拥有4层【离火】，将会消耗所有【离火】施放焚身以火…此次伤害为共鸣技能伤害。」
 *   「施放普攻心眼·征命中目标时，获得1层【离火】…施放共鸣解放离火照丹心时，获得4层【离火】。」 回复协奏能量=10
 * 变奏 天道持枢 (1002106): 「攻击目标并进入心眼状态，持续12秒。」
 * 固有 潜谋: 「施放普攻心眼·征或普攻心眼·冲时，每拥有1层【离火】，长离的热熔伤害加成提升5%。」 → per-action stat (stacks before gaining)
 * 固有 散势: 「施放重击焚身以火或共鸣解放离火照丹心时，长离的热熔伤害加成提升20%，攻击造成伤害时忽视目标15%防御。」 → applied to those casts themselves (medium: wording reads as the cast's own bonus)
 * 武器 赫奕流明 (21020016) 【灼羽】: 「造成伤害时获得1层【灼羽】，每0.5秒可获得1层。施放共鸣技能时额外获得5层。每层【灼羽】使共鸣技能伤害加成提升4%，可叠加14层。【灼羽】达到14层的12秒后，清空全部层数。」
 *   → stacks += floor(action duration / 0.5) (≥1) per damaging action, +5 on 共鸣技能 casts (心眼·劫); low confidence on per-action approximation.
 * Chains: 2 (+25% crit on 离火 gain) etc. left to the generic text parser (low).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, charges, useCharge } = C;
  const SIG = 21020016;
  function zyStacks(cs, t) { if (cs.zyFull != null && t >= cs.zyFull + 12 - 1e-9) return 0; return cs.zy; }
  return WW.registerChar({
    id: 1205, chainModeled: 0, name: '长离', version: '0.1', confidence: 'medium',
    notes: ['心眼·冲（跳跃/空中）未单独建模，等同心眼·征', '散势按“作用于焚身以火/离火照丹心本次施放”处理', '赫奕流明【灼羽】按每动作 floor(时长/0.5) 层近似'],
    // action_frames.json (WuwaLAB) label map
    frames: {
      E: '共鸣技能·Skill: Tripartite Flames',                  // 赫羽三相（心眼·劫）
      zheng: '共鸣回路·True Sight: Conquest',                  // 心眼·征
      fenshen: '共鸣回路·Forte: Flaming Sacrifice',            // 焚身以火
    },
    resources: [
      { key: 'lihuo', name: '离火', max: 4, segmented: true, confidence: 'high', basis: '焚身以火：离火上限 4 层' },
      { key: 'ch', name: '赫羽三相次数', max: 2, segmented: true, confidence: 'high', basis: '初始 2 次，每 12 秒 +1', get: (cs, t) => charges(cs.ch, t, 2, 12) },
      { key: 'xinyan', name: '心眼', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.xinyan, t) ? 1 : 0) },
    ],
    kit(H) {
      const K = {
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['心眼·劫伤害'], levelKey: 'skill', concertoParam: '心眼·劫回复协奏能量', dur: 1.8 }),
        zheng: H.act({ key: 'zheng', cls: 'A', skill: 2, labels: ['心眼·征伤害'], levelKey: 'skill', concertoParam: '心眼·征回复协奏能量', ownStage: true, dur: 1.1 }),
        fenshen: H.act({ key: 'fenshen', cls: 'H', skill: 6, labels: ['焚身以火伤害'], levelKey: 'forte', concertoParam: '回复协奏能量', dur: 2.2 }),
      };
      H.patchBuff((b) => /潜谋|散势/.test(b.src || ''), { mode: 'module' }, '模块按施放时层数/本次施放计算');
      if (H.weaponId === SIG) {
        const zb = H.findBuff((b) => b.kind === 'weapon' && /灼羽/.test(b.text || '') && b.stats[0] && b.stats[0].key === 'dmg:skill')[0];
        H.mem._zyPer = zb ? zb.stats[0].value : 0.04;
        H.patchBuff((b) => b === zb, { mode: 'module' }, '模块：灼羽层数追踪');
      }
      return K;
    },
    init() { return { lihuo: 0, xinyan: null, yanyu: null, ch: { n: 2, since: 0 }, zy: 0, zyFull: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, kit = api.mem.kit;
      switch (btn) {
        case 'A': return on(cs.xinyan, t) ? { act: K.zheng } : { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'E': return charges(cs.ch, t, 2, 12) >= 1 ? { act: K.E } : { blocked: '赫羽三相次数不足' };
        case 'H': return cs.lihuo >= 4 ? { act: K.fenshen } : (kit.H ? { act: kit.H } : null);
        case 'R': return { act: kit.R };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        case 'I': return { act: kit.I };
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, out = [];
      if (act.key === 'zheng') out.push({ key: 'dmg:fusion', value: 0.05 * cs.lihuo });
      if (act.key === 'fenshen' || act.key === 'R') out.push({ key: 'dmg:fusion', value: 0.2 }, { key: 'defIgnore', value: 0.15 });
      if (act.key === 'fenshen' && on(cs.yanyu, api.t)) out.push({ key: 'atkPct', value: 0.25 });
      if (api.mem._zyPer) { const z = zyStacks(cs, api.t); if (z) out.push({ key: 'dmg:skill', value: api.mem._zyPer * z }); }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd;
      switch (act.key) {
        case 'A4': case 'I': cs.xinyan = te + 12; break;
        case 'E': useCharge(cs.ch, t, 2, 12); cs.xinyan = te + 12; break;
        case 'zheng': cs.xinyan = null; cs.lihuo = Math.min(4, cs.lihuo + 1); break;
        case 'fenshen': cs.lihuo = 0; cs.yanyu = null; break;
        case 'R': cs.lihuo = 4; cs.yanyu = te + 10; break;
        default: break;
      }
      if (api.mem._zyPer && act.hits.length) {
        let z = zyStacks(cs, t); if (z === 0) cs.zyFull = null;
        z = Math.min(14, z + Math.max(1, Math.floor(act.duration / 0.5)) + (act.cls === 'E' ? 5 : 0));
        if (z >= 14 && cs.zyFull == null) cs.zyFull = te;
        cs.zy = z;
      }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      return (cs.lihuo / 4) * 0.8 * api.est(K.fenshen) + (on(cs.xinyan, t) ? 0.5 * api.est(K.zheng) : 0) + 0.25 * charges(cs.ch, t, 2, 12) * api.est(K.E);
    },
  });
});
