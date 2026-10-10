/*
 * 今汐 (1304) character module.  Rules derived from ww.json skill descriptions (quoted), confidence noted per rule.
 *
 * 共鸣技能 流光夕影 (1002002):
 *   「当今汐施放第4段普攻或不处于乘岁凌霄状态施放变奏技能蟠龙清辉时，共鸣技能替换为共鸣技能神霓飞芒，持续5秒。」
 *   「施放共鸣技能神霓飞芒时，造成衍射伤害，并使今汐进入乘岁凌霄状态。」 params: 乘岁凌霄状态持续时间=10, 神霓飞芒冷却时间=12, 神霓飞芒回复协奏能量=4
 * 共鸣回路 万物一心 (1002007):
 *   「乘岁凌霄状态持续期间：·普攻替换为普攻凌霄·普攻，进行最多连续4段攻击…此次伤害为共鸣技能伤害，此外，该连击段数不会被重置。」
 *   「·共鸣技能替换为共鸣技能逐天取月」 params: 逐天取月冷却时间=10, 逐天取月回复协奏能量=8
 *   「施放普攻凌霄·普攻第4段后，将立刻结束乘岁凌霄状态，并获得效果游龙廻光。」 游龙廻光持续时间=5
 *   「·共鸣技能替换为共鸣技能惊龙破空…施放时可以消耗今汐至多50点【韶光】…每消耗1点【韶光】，使本次共鸣技能惊龙破空的炳星的伤害倍率增加。」 每点【韶光】增加倍率=44.54%（forte 10 级）
 *   「·施放共鸣技能惊龙破空后，今汐可获得同奏，每25秒内只能获得一次。」 同奏持续时间=5, 惊龙破空回复协奏能量=20
 *   「同奏：今汐拥有同奏时，今汐切换其他角色时，登场角色将施放自身变奏技能，今汐则施放自身延奏技能…协奏能量达到最大值，并且拥有同奏效果时，只消耗同奏效果。」
 *   「【韶光】上限50点…造成属性伤害时，为今汐提供1点【韶光】，同类属性伤害每3秒可触发1次。协同攻击造成伤害时，为今汐提供2点【韶光】，同类属性伤害每3秒可触发1次。」
 * 延奏 驭时 (1002009): 「韶华共济提供【韶光】的触发间隔缩短为同类属性伤害每1秒可触发1次，该效果持续20秒。」
 * 固有 凝神 (1002005): 「变奏技能蟠龙清辉伤害倍率提升50%。」 → intro multiplier ×1.5 (inferred: relative increase; medium)
 * 共鸣链 1: 惊蛰 stacks (+20%/层 惊龙破空伤害, low: treated as dmg bonus); 5: 移岁诛邪倍率 +120% (×2.2, low); 6: 惊龙破空倍率 +45%, 每点韶光倍率额外 +45% (low).
 *
 * Inferred / low confidence:
 *   - 韶光 gain is modelled per damage EVENT (one action = one event); 同类属性 = element (+ separate bucket for coordinated attacks).
 *   - 开局韶光 default 50 (steady-state rotation assumption); override member.module.start.shaoguang.
 *   - Air-only forms (凌霄·重击, 凌霄·闪避) not modelled; ground H stays the normal heavy.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, multAt, CN } = C;
  return WW.registerChar({
    id: 1304, chainModeled: 6, name: '今汐', version: '0.1', confidence: 'medium',
    notes: [
      '开局韶光默认 50（稳态循环假设，可在 member.module.start.shaoguang 覆盖）',
      '韶光获取按“每个伤害动作一次事件”近似，同类属性 3 秒（驭时期间 1 秒）冷却；协同攻击单独计 2 点',
      '空中形态（凌霄·重击/凌霄·闪避）未建模',
    ],
    // action_frames.json (WuwaLAB) label map; generic rules cover A1-4 (Slash of Breaking Dawn), H, E (Skill 1), R, I.
    frames: {
      shenni: '共鸣技能·Skill 2: Overflowing Radiance',      // 神霓飞芒 (confidence: medium — matched by order/role)
      lxA1: '普攻·Basic: Incarnation 1', lxA2: '普攻·Basic: Incarnation 2', lxA3: '普攻·Basic: Incarnation 3', lxA4: '普攻·Basic: Incarnation 4',
      zhutian: '共鸣技能·Skill 3: Crescent Divinity',          // 逐天取月
      jinglong: '共鸣技能·Skill 4: Illuminous Epiphany',       // 惊龙破空
    },
    resources: [
      { key: 'sg', name: '韶光', max: 50, segmented: false, confidence: 'medium', basis: '万物一心：韶光上限 50' },
      { key: 'form', name: '形态', max: 3, segmented: true, confidence: 'high', basis: '1=神霓飞芒可用 2=乘岁凌霄 3=游龙廻光',
        get: (cs, t) => (on(cs.youlong, t) ? 3 : on(cs.chengsui, t) ? 2 : on(cs.shenni, t) ? 1 : 0) },
    ],
    kit(H) {
      const lx = {};
      const lxDur = [0.6, 0.7, 0.8, 1.3];
      for (let k = 1; k <= 4; k++) lx['lxA' + k] = H.act({ key: 'lxA' + k, cls: 'A', skill: 6, labels: ['凌霄·普攻第' + CN[k - 1] + '段伤害'], levelKey: 'forte', ownStage: true, dur: lxDur[k - 1] });
      const shenniCd = H.param(2, '神霓飞芒冷却时间') || 12;
      const zhutianCd = H.param(6, '逐天取月冷却时间') || 10;
      const kit = Object.assign(lx, {
        shenni: H.act({ key: 'shenni', cls: 'E', skill: 2, labels: ['神霓飞芒伤害'], levelKey: 'skill', concertoParam: '神霓飞芒回复协奏能量', cooldown: shenniCd, dur: 1.2 }),
        zhutian: H.act({ key: 'zhutian', cls: 'E', skill: 6, labels: ['逐天取月技能伤害'], levelKey: 'forte', concertoParam: '逐天取月回复协奏能量', cooldown: zhutianCd, dur: 1.2 }),
        jinglong: H.act({ key: 'jinglong', cls: 'E', skill: 6, labels: ['惊龙破空·熠日伤害', '惊龙破空·炳星伤害'], levelKey: 'forte', concertoParam: '惊龙破空回复协奏能量', dur: 2.5 }),
        intro: Object.assign(H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', primary: true, scale: { '*': 1.5 }, inferred: '凝神：倍率 ×1.5' })),
        R: H.chain >= 5 ? Object.assign({}, H.kit.R, { scale: { '*': 2.2 }, inferred: '链5：倍率 +120%（按 ×2.2）' }) : H.kit.R,
      });
      const bing = kit.jinglong.hits.find((h) => h.label === '惊龙破空·炳星伤害');
      const lvF = kit.jinglong.level;
      H.mem._jx = { per: H.param(6, '每点【韶光】增加倍率', 'forte') || 0.4454, bingBase: bing ? multAt(bing, lvF) : 3.4792 };
      // chain 4 parsed by text: trigger 「施放共鸣解放移岁诛邪或共鸣技能惊龙破空时」 → act keys
      H.patchBuff((b) => b.kind === 'chain' && /惊龙破空/.test(b.text || '') && /自甘佑凡尘|附近队伍/.test(b.text || ''), { trigger: { on: 'act', keys: ['R', 'jinglong'] }, mode: 'auto' }, '模块：触发=移岁诛邪/惊龙破空');
      return kit;
    },
    init(api) {
      const st = (api.H.opts.start || {});
      return { sg: st.shaoguang != null ? st.shaoguang : 50, shenni: null, chengsui: null, youlong: null, lxStage: 0, tongzou: null, tzCd: -1e9, yushi: null, last: {}, jz: 0, jzUntil: null };
    },
    jinglongAct(api) {
      const K = api.mem.modKit, n = Math.floor(Math.min(50, api.cs.sg));
      const c6 = api.H.chain >= 6 ? 1.45 : 1;
      const jx = api.mem._jx;
      const f = ((jx.bingBase + n * jx.per * c6) * c6) / jx.bingBase;
      return { act: Object.assign({}, K.jinglong, { scale: { '惊龙破空·炳星伤害': f }, label: `惊龙破空（韶光 ${n}）` }), meta: { n } };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, kit = api.mem.kit;
      switch (btn) {
        case 'A':
          if (on(cs.chengsui, t)) return { act: K['lxA' + ((cs.lxStage % 4) + 1)] };
          return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'E':
          if (on(cs.youlong, t)) return this.jinglongAct(api);
          if (on(cs.chengsui, t)) return { act: K.zhutian };
          if (on(cs.shenni, t)) return { act: K.shenni };
          return { act: kit.E };
        case 'I': return { act: K.intro };
        case 'R': return { act: K.R };
        case 'H': return kit.H ? { act: kit.H } : null;
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      if (act.key === 'jinglong' && api.H.chain >= 1 && on(api.cs.jzUntil, api.t)) return [{ key: 'dmg:all', value: 0.2 * api.cs.jz }];
      return [];
    },
    apply(api, act, meta) {
      const cs = api.cs, t = api.t, te = api.tEnd;
      const jz = () => { if (api.H.chain >= 1) { cs.jz = Math.min(4, (on(cs.jzUntil, t) ? cs.jz : 0) + 1); cs.jzUntil = te + 6; } };
      if (act.key === 'A4' && !on(cs.chengsui, t)) cs.shenni = te + 5;
      else if (act.key === 'I') { if (!on(cs.chengsui, t)) cs.shenni = te + 5; }
      else if (act.key === 'shenni') { cs.chengsui = te + 10; cs.shenni = null; }
      else if (/^lxA/.test(act.key)) {
        const k = +act.key.slice(3); jz();
        cs.lxStage = k % 4;
        if (k === 4) { cs.chengsui = null; cs.youlong = te + 5; }
      } else if (act.key === 'zhutian') jz();
      else if (act.key === 'jinglong') {
        cs.sg -= (meta && meta.n) || 0; cs.youlong = null; cs.jz = 0;
        if (t >= cs.tzCd - 1e-9) { cs.tongzou = te + 5; cs.tzCd = t + 25; }
      }
    },
    swapOut(api) {
      if (on(api.cs.tongzou, api.t)) { api.cs.tongzou = null; return { force: true, reason: 'tongzou' }; }
      return {};
    },
    onOutro(api) { api.cs.yushi = api.t + 20; },
    onTeam(api, ev) {
      if (ev.type !== 'damage' || !ev.el) return;
      const cs = api.cs;
      const iv = on(cs.yushi, ev.t) ? 1 : 3;
      const k = (ev.coord ? 'c:' : 'd:') + ev.el;
      if (cs.last[k] == null || ev.t - cs.last[k] >= iv - 1e-9) { cs.sg = Math.min(50, cs.sg + (ev.coord ? 2 : 1)); cs.last[k] = ev.t; }
    },
    potential(api) {
      const cs = api.cs, t = api.t;
      const J = api.est(this.jinglongAct(api).act);
      // progress credit along the basic chain (A1..A3 lead to the 神霓飞芒 window at A4) so the beam does not drop
      // the A-chain in favour of equally-fast fillers (inferred search heuristic, not a game rule)
      const st = (api.ms && api.ms.stage) || 0;
      const f = on(cs.youlong, t) ? 1 : on(cs.chengsui, t) ? 0.55 + 0.1 * cs.lxStage : on(cs.shenni, t) ? 0.4 : 0.15 + 0.0625 * Math.min(st, 3);
      return J * f + (on(cs.tongzou, t) ? 0.3 * api.ctx.potential[api.mi].IO : 0);
    },
  });
});
