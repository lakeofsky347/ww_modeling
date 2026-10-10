/*
 * 珂莱塔 (1107) character module.  Rules derived from ww.json descriptions (quoted), confidence per rule.
 *
 * 普攻 缄默执行 (1002801):
 *   「普攻 进行最多2段的连续攻击」「珂莱塔身上拥有【可塑晶质】时，施放的普攻将替换为必要性手段。进行最多3段的连续攻击…每段必要性手段将消耗1个【可塑晶质】。」
 *   「重击·限制性策略：珂莱塔【灵萃】充满时，施放的重击将替换为限制性策略，消耗所有【灵萃】…并使共鸣技能暴力美学的冷却时间减少6秒。」 限制性策略回复协奏能量=15
 * 共鸣技能 暴力美学 (1002802): 冷却 14, 回复协奏能量=5 / 示我璀璨回复协奏能量=5
 *   「施放后一定时间内短按共鸣技能，可施放示我璀璨。」「示我璀璨 珂莱塔消耗所有当前拥有的【可塑晶质】，对目标造成冷凝伤害。」
 *   → 示我璀璨窗口按 5 秒估计（“一定时间内”，低）
 * 共鸣解放 新浪潮时代 (1002803): 消耗 125, 冷却 25, 解离持续时间=4, 枪花轮舞持续时间=10
 *   「为命中的目标附加解离效果，进入枪花轮舞状态，此次伤害为共鸣技能伤害。」「解离 珂莱塔攻击携带解离效果的目标，造成伤害时忽视目标18%防御。」
 *   「枪花轮舞状态下按下普攻或共鸣解放可施放死兆。每次施放死兆时，获得1点【镜向箔】。【镜向箔】达到4点时，按下普攻或共鸣解放可施放致死以终。」
 *   「进入和退出枪花轮舞状态时，清空灵萃，枪花轮舞状态下无法施放普攻必要性手段、重击限制性策略、重击末路见行。」「施放致死以终后结束枪花轮舞状态。」
 *   → 死兆/致死以终按“共鸣解放”类动作（cls R，无能量消耗、无冷却）：C6 原文称「共鸣解放死兆」（中）
 * 共鸣回路 艺间巡礼 (1002807):
 *   「珂莱塔每22秒可激活【镀色晶】。当【灵萃】充满，且【镀色晶】处于激活状态时，长按普攻可消耗所有【灵萃】，施放重击末路见行…使共鸣技能暴力美学的冷却时间减少6秒。」 末路见行回复协奏能量=15
 *   「揭幕者：【灵萃】达到上限时，获得揭幕者效果。共鸣解放新浪潮时代、共鸣解放死兆、共鸣解放致死以终的伤害倍率提升80%，枪花轮舞状态时若切换至其他角色或枪花轮舞状态结束时，效果结束。」
 *     → 倍率 ×1.8（“倍率提升 X%”按相对提升，与今汐凝神同一约定，中）
 *   「【灵萃】上限120点。共鸣解放枪花轮舞状态下，无法获得【灵萃】。施放变奏技能入冬叹调时，回复30点【灵萃】。施放共鸣技能示我璀璨时，每消耗1颗【可塑晶质】，回复10点【灵萃】。
 *     施放普攻必要性手段时，每消耗1颗【可塑晶质】，回复10点【灵萃】。」
 *   「【可塑晶质】上限6颗。共鸣解放枪花轮舞状态下，无法获得【可塑晶质】。施放第2段普攻时、施放重击时、施放变奏技能入冬叹调时、施放共鸣技能暴力美学时，回复3个【可塑晶质】。」 【可塑晶质】持续时间=10
 * 固有 艺术至上: 「变奏技能入冬叹调、共鸣技能示我璀璨、共鸣解放死兆、重击末路见行可以为命中的目标附加解离效果。」
 * 延奏 致辞 (1002809): 「攻击目标，造成珂莱塔794.2%攻击的冷凝伤害。」 → build_ww 关联 110708501 (rate 7.942 = 描述值，高)
 * 武器 死与舞 (21030016): 「施放变奏技能或共鸣解放时，自身共鸣技能伤害加成提升48%，持续5秒。」（文本解析：intro / cast R；死兆、致死以终按 R 触发，中）
 * 共鸣链: 1 解离目标暴击 +12.5%（模块）、对变彩目标示我璀璨额外 +30 灵萃；2 致死以终倍率 +126%（×2.26，低）；3 暴力美学/示我璀璨倍率 +93%（×1.93）、延奏追加 1032.18%（110708502）；
 *   4 文本解析（触发改为 重击/限制性策略/末路见行）；5 末路见行倍率 +47%；6 死兆倍率 +186.6%。
 * 未建模：空中攻击/礼节性问候、闪避反击（消耗 1 晶质）；晶质 10 秒到期按“最后一次获得后 10 秒全部消失”近似（低）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, rowHit } = C;
  const cry = (cs, t) => (on(cs.cryUntil, t) ? cs.cry : 0);
  return WW.registerChar({
    id: 1107, chainModeled: 6, name: '珂莱塔', version: '0.1', confidence: 'medium',
    notes: ['揭幕者“伤害倍率提升80%”按 ×1.8（中）', '示我璀璨可用窗口按 5 秒估计（低）', '可塑晶质 10 秒持续按“最后一次获得后 10 秒全部消失”近似（低）',
      '死兆/致死以终视为共鸣解放类施放（触发死与舞等“施放共鸣解放时”效果，中）', '延奏伤害：build_ww 已把 damage 行 110708501（倍率 794.2%，与描述一致）关联到延奏技能', '空中攻击/礼节性问候/闪避反击未建模'],
    // action_frames.json (WuwaLAB) label map
    frames: {
      A1: '普攻·Basic: Silent Execution 1', A2: '普攻·Basic: Silent Execution 2',
      bA1: '普攻·Basic: Necessary Measures 1', bA2: '普攻·Basic: Necessary Measures 2', bA3: '普攻·Basic: Necessary Measures 3',
      H: '重击·Heavy 1: Silent Execution', xianzhi: '重击·Heavy 2: Containment Tactics', molu: '重击·Heavy 3: Imminent Oblivion',
      E: '共鸣技能·Skill 1: Art of Violence', shiwo: '共鸣技能·Skill 2: Chromatic Splendor',
      R: '共鸣解放·Liberation 1: Era of New Wave', sizhao: '共鸣解放·Liberation 2: Death Knell', zhisi: '共鸣解放·Liberation 3: Fatal Finale',
      I: '变奏入场·Intro: Wintertime Aria',
    },
    resources: [
      { key: 'lc', name: '灵萃', max: 120, segmented: false, confidence: 'high', basis: '艺间巡礼：灵萃上限 120' },
      { key: 'cry', name: '可塑晶质', max: 6, segmented: true, confidence: 'medium', basis: '上限 6 颗，持续 10 秒（到期近似）', get: (cs, t) => cry(cs, t) },
      { key: 'mx', name: '镜向箔', max: 4, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.qh, t) ? cs.mx : 0) },
      { key: 'qh', name: '枪花轮舞', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.qh, t) ? 1 : 0) },
      { key: 'jm', name: '揭幕者', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.jm ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const sk1 = 1, lib = H.skill(3);
      const K = {
        A1: H.act({ key: 'A1', cls: 'A', skill: sk1, labels: ['普攻第一段伤害'], levelKey: 'basic', ownStage: true, dur: 0.3 }),
        A2: H.act({ key: 'A2', cls: 'A', skill: sk1, labels: ['普攻第二段伤害'], levelKey: 'basic', ownStage: true, dur: 0.75 }),
        bA1: H.act({ key: 'bA1', cls: 'A', skill: sk1, labels: ['必要性手段第一段伤害'], levelKey: 'basic', ownStage: true, dur: 0.4 }),
        bA2: H.act({ key: 'bA2', cls: 'A', skill: sk1, labels: ['必要性手段第二段伤害'], levelKey: 'basic', ownStage: true, dur: 0.8 }),
        bA3: H.act({ key: 'bA3', cls: 'A', skill: sk1, labels: ['必要性手段第三段伤害'], levelKey: 'basic', ownStage: true, dur: 1.3 }),
        H: H.act({ key: 'H', cls: 'H', skill: sk1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.9 }),
        xianzhi: H.act({ key: 'xianzhi', cls: 'H', skill: sk1, labels: ['限制性策略伤害'], levelKey: 'basic', concertoParam: '限制性策略回复协奏能量', dur: 0.9 }),
        molu: H.act({ key: 'molu', cls: 'H', skill: 6, labels: ['末路见行伤害'], levelKey: 'forte', concertoParam: '末路见行回复协奏能量', dur: 2.1,
          scale: ch >= 5 ? { '*': 1.47 } : null, inferred: ch >= 5 ? '链5：末路见行倍率 ×1.47' : null }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: H.param(2, '冷却时间') || 14, dur: 0.8,
          scale: ch >= 3 ? { '*': 1.93 } : null, inferred: ch >= 3 ? '链3：倍率 ×1.93' : null }),
        shiwo: H.act({ key: 'shiwo', cls: 'E', skill: 2, labels: ['示我璀璨伤害'], levelKey: 'skill', concertoParam: '示我璀璨回复协奏能量', dur: 2.0,
          scale: ch >= 3 ? { '*': 1.93 } : null, inferred: ch >= 3 ? '链3：倍率 ×1.93' : null }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: H.param(3, '技能冷却') || lib.cooldown || 25,
          concertoParam: '回复协奏能量', dur: 3.0 }),
        sizhao: H.act({ key: 'sizhao', cls: 'R', skill: 3, labels: ['死兆伤害'], levelKey: 'liberation', concertoParam: '死兆回复协奏能量', dur: 1.2 }),
        zhisi: H.act({ key: 'zhisi', cls: 'R', skill: 3, labels: ['致死以终伤害'], levelKey: 'liberation', concertoParam: '致死以终回复协奏能量', dur: 2.8 }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.4 }),
      };
      const o11 = H.skill(11);
      // build_ww 已把 110708501（rate 7.942 = 描述 794.2%）关联到延奏技能；旧数据退回 unlinkedDamage
      const oh = o11 && o11.hits.length ? o11.hits.slice() : [rowHit(H, 11, 110708501, { label: '致辞伤害', why: '延奏描述「造成珂莱塔794.2%攻击的冷凝伤害」↔ unlinkedDamage 110708501 rate 7.942' })];
      if (ch >= 3) oh.push(rowHit(H, 11, 110708502, { label: '碎璃镜花伤害', why: '链3「额外进行一次攻击，造成珂莱塔1032.18%攻击的冷凝伤害」↔ 110708502 rate 10.3218' }));
      K.O = H.act({ key: 'O', cls: 'O', skill: 11, hits: oh.filter(Boolean), levelKey: 'outro', label: '致辞', inferred: o11 && o11.hits.length ? null : '延奏伤害行来自 unlinkedDamage（低）' });
      // 揭幕者 / 链 2 / 链 6 multipliers are applied per cast in resolve (state-dependent scale)
      H.mem._kl = { c2: ch >= 2 ? 2.26 : 1, c6: ch >= 6 ? 2.866 : 1 };
      H.patchBuff((b) => b.kind === 'chain' && /解离效果的目标攻击/.test(b.text || ''), { mode: 'module' }, '模块：解离期间按动作加暴击');
      H.patchBuff((b) => b.kind === 'chain' && /共鸣技能伤害加成提升25%/.test(b.text || ''), { trigger: { on: 'act', keys: ['H', 'xianzhi', 'molu'] }, mode: 'auto' }, '模块：触发=重击/限制性策略/末路见行');
      return K;
    },
    init(api) {
      const st = api.H.opts.start || {};
      return { lc: st.lingcui || 0, cry: 0, cryUntil: null, jm: (st.lingcui || 0) >= 120, qh: null, mx: 0, jl: null, shiwoUntil: null, bianUntil: null, dsj: 0, na: 0, nb: 0 };
    },
    libScale(api, act, extra) {
      const cs = api.cs, f = (cs.jm ? 1.8 : 1) * (extra || 1);
      if (Math.abs(f - 1) < 1e-9) return { act };
      return { act: Object.assign({}, act, { scale: { '*': f }, label: act.label + (cs.jm ? '（揭幕者）' : ''), inferred: [cs.jm ? '揭幕者 ×1.8' : null, extra && extra !== 1 ? '共鸣链倍率' : null].filter(Boolean).join('；') }), meta: { jm: cs.jm } };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, kl = api.mem._kl;
      const inQ = on(cs.qh, t);
      switch (btn) {
        case 'A':
          if (inQ) return cs.mx >= 4 ? this.libScale(api, K.zhisi, kl.c2) : this.libScale(api, K.sizhao, kl.c6);
          if (cry(cs, t) > 0) return { act: K['bA' + ((cs.nb % 3) + 1)] };
          return { act: K['A' + ((cs.na % 2) + 1)] };
        case 'H':
          if (!inQ && cs.lc >= 120 - 1e-9) return { act: t >= cs.dsj - 1e-9 ? K.molu : K.xianzhi };
          return { act: K.H };
        case 'E': return on(cs.shiwoUntil, t) ? { act: K.shiwo } : { act: K.E };
        case 'R':
          if (inQ) return cs.mx >= 4 ? this.libScale(api, K.zhisi, kl.c2) : this.libScale(api, K.sizhao, kl.c6);
          return this.libScale(api, K.R);
        case 'I': return { act: K.I };
        case 'O': return { act: K.O };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, out = [];
      if (on(cs.jl, api.t)) { out.push({ key: 'defIgnore', value: 0.18 }); if (api.H.chain >= 1) out.push({ key: 'critRate', value: 0.125 }); }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd;
      const inQ = on(cs.qh, t);
      const gainLc = (v) => { if (on(cs.qh, t)) return; cs.lc = Math.min(120, cs.lc + v); if (cs.lc >= 120 - 1e-9) cs.jm = true; };
      const gainCry = (n) => { if (on(cs.qh, t)) return; cs.cry = Math.min(6, cry(cs, t) + n); cs.cryUntil = te + 10; };
      const lijie = () => { cs.jl = te + 4; };
      const k = act.key;
      if (k === 'A1' || k === 'A2') { cs.na = k === 'A1' ? 1 : 0; cs.nb = 0; if (k === 'A2') gainCry(3); }
      else if (/^bA/.test(k)) { cs.nb = (+k.slice(2)) % 3; cs.na = 0; cs.cry = Math.max(0, cry(cs, t) - 1); gainLc(10); }
      else { cs.na = 0; cs.nb = 0; }
      switch (k) {
        case 'H': gainCry(3); break;
        case 'xianzhi': case 'molu':
          cs.lc = 0; api.ms.cd.E = Math.max(t, (api.ms.cd.E || 0) - 6);
          if (k === 'molu') { cs.dsj = t + 22; lijie(); }
          break;
        case 'E': gainCry(3); cs.shiwoUntil = te + 5; cs.bianUntil = te + 1.5; break;
        case 'shiwo': {
          const n = cry(cs, t); cs.cry = 0; cs.shiwoUntil = null; gainLc(10 * n);
          if (api.H.chain >= 1 && on(cs.bianUntil, t)) gainLc(30);
          lijie(); break;
        }
        case 'I': gainLc(30); gainCry(3); lijie(); break;
        case 'R': cs.lc = 0; cs.cry = 0; cs.qh = te + 10; cs.mx = 0; lijie(); break;
        case 'sizhao': cs.mx = Math.min(4, cs.mx + 1); lijie(); break;
        case 'zhisi': cs.qh = null; cs.mx = 0; cs.jm = false; cs.lc = 0; break;
        default: break;
      }
      if (inQ && !on(cs.qh, te) && k !== 'zhisi') { cs.jm = false; cs.lc = 0; } // 枪花轮舞自然结束：揭幕者结束、清空灵萃
    },
    swapOut(api) {
      const cs = api.cs;
      if (on(cs.qh, api.t)) { cs.jm = false; cs.qh = null; cs.mx = 0; cs.lc = 0; } // 「枪花轮舞状态时若切换至其他角色…效果结束」（枪花一并结束：推断，中）
      cs.shiwoUntil = null; // 「若一定时间内没有施放共鸣技能示我璀璨或者切换至其他角色，则技能进入冷却状态」
      return {};
    },
    // search heuristic (not a game rule): value of stored 灵萃 / 晶质 / 枪花 progress so the beam keeps building toward 末路见行 → 新浪潮时代 → 致死以终
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = (cs.lc / 120) * 0.6 * api.est(K.molu) + (cry(cs, t) / 6) * 0.3 * api.est(K.shiwo) + (on(cs.shiwoUntil, t) ? 0.5 * api.est(K.shiwo) : 0);
      if (on(cs.qh, t)) v += 0.8 * api.est(K.zhisi) * (cs.jm ? 1.8 : 1) + (4 - cs.mx) * 0.5 * api.est(K.sizhao);
      if (!on(cs.qh, t)) {
        // value of holding 共鸣解放 until 揭幕者 (+80% on 新浪潮时代/死兆/致死以终): scaled by energy readiness and 灵萃 progress
        const libV = 4 * api.est(K.sizhao) + api.est(K.zhisi), eFrac = Math.min(1, api.ms.energy / ((K.R && K.R.cost) || 125));
        v += eFrac * 0.8 * libV * 0.6 * (cs.jm ? 1 : cs.lc / 120);
      }
      return v;
    },
  });
});
