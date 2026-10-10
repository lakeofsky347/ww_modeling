/*
 * 折枝 (1105) character module.
 *
 * 共鸣技能 以形写神 (1002202): 「若折枝至少拥有60点【灵韵】，则会消耗60点【灵韵】，召唤鹤影·左以及鹤影·右。」 冷却时间=6, 短按回复协奏能量=8
 * 共鸣回路 妙笔丹青 (1002207):
 *   「鹤影分为鹤影·左，鹤影·中，鹤影·右三种，每种最多存在1幅，持续15秒。」
 *   「重击·构形：普攻第3段后一定时间内长按普攻 / 施放共鸣技能以形写神后一定时间内短按普攻 / 施放神来之笔、极意·神来之笔后一定时间内长按普攻…
 *     若施放时折枝至少拥有30点【灵韵】，则消耗30点【灵韵】在场上召唤鹤影·中。」 (“一定时间内” = 1.5 s window, inferred)
 *   「折枝附近存在鹤影时，共鸣技能替换为神来之笔…此次伤害为普攻伤害。·获得1层【极意】，持续8秒，可叠加2层。」
 *   「存在鹤影，且【极意】层数为2时，神来之笔替换为极意·神来之笔…移除全部【极意】…让折枝的普攻伤害加成提升18%，持续27秒。」
 *   「【灵韵】上限为90点。常态攻击造成伤害可回复【灵韵】。施放变奏技能可回复【灵韵】。」
 *     amounts NOT in data → community: “一次变奏+三段普攻”或“两次变奏”可攒满 90 (700g.com 攻略) → 变奏 +45, 普攻每段 +15 (low; member.module.gain overrides)
 * 共鸣解放 虚实境趣 (1002203): 「队伍中在场角色造成伤害时，会召唤墨鹤对目标进行协同攻击…此次伤害为普攻伤害。
 *     造成伤害的接下来3秒内，每秒可召唤1只墨鹤…墨鹤造成的伤害不会触发该效果。共可召唤21只。效果持续30秒」 (链2 +6 只)
 *   → cranes spawn 1/s while the on-field member keeps dealing damage (window = action + 3 s), attributed to 折枝 with her live buffs (medium).
 * 固有 挥毫: 「施放共鸣技能神来之笔或共鸣技能极意·神来之笔时，攻击提升6%，可叠加3层，持续27秒。」 → trigger patched to those two acts
 * 固有 点睛: 「施放延奏技能后，为下一位登场角色回复15点共鸣能量。」
 * 武器 琼枝冰绡 (21050026): 「施放延奏技能时，若已累计3层效果，则移除全部层数，使自身不在场时普攻伤害加成提升52%，持续27秒。」 → module-checked 3 stacks
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on } = C;
  const SIG = 21050026;
  const shadowCount = (cs, t) => Object.values(cs.sh).filter((u) => on(u, t)).length;
  return WW.registerChar({
    id: 1105, chainModeled: 2, name: '折枝', version: '0.1', confidence: 'medium',
    notes: ['灵韵回复量数据缺失：按社区经验 变奏 +45 / 普攻每段 +15 推断（低置信，可在 member.module.gain 覆盖）',
      '墨鹤按“在场角色持续造成伤害时每秒 1 只”近似，伤害以折枝当前面板与增益计算', '重击·构形可用窗口按 1.5 秒估计'],
    // action_frames.json (WuwaLAB) label map
    frames: {
      E: '共鸣技能·Skill 1: Manifestation',                    // 以形写神 短按
      gouxing: '重击·Heavy: Conjuration',                      // 重击·构形
      shenlai: '共鸣技能·Skill 2: Stroke of Genius',           // 神来之笔
      jiyi: "共鸣技能·Skill 3: Creation's Zenith",             // 极意·神来之笔
      R: '共鸣解放·Liberation: Living Canvas',
    },
    resources: [
      { key: 'ly', name: '灵韵', max: 90, segmented: false, confidence: 'low', basis: '上限 90（表）；获取量为社区推断' },
      { key: 'sh', name: '鹤影', max: 3, segmented: true, confidence: 'high', get: (cs, t) => shadowCount(cs, t) },
      { key: 'jy', name: '极意', max: 2, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.jyUntil, t) ? cs.jy : 0) },
      { key: 'crane', name: '墨鹤剩余', max: 27, segmented: false, confidence: 'medium', get: (cs, t) => (on(cs.crane && cs.crane.until, t) ? cs.crane.left : 0) },
    ],
    kit(H) {
      const lib = H.skill(3);
      const K = {
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['短按技能伤害'], levelKey: 'skill', concertoParam: '短按回复协奏能量', cooldown: H.skill(2).cooldown || 6, dur: 1.0 }),
        gouxing: H.act({ key: 'gouxing', cls: 'H', skill: 6, labels: ['重击·构形伤害'], levelKey: 'forte', ownStage: true, dur: 1.2 }),
        shenlai: H.act({ key: 'shenlai', cls: 'E', skill: 6, labels: ['神来之笔伤害'], levelKey: 'forte', concertoParam: '神来之笔回复协奏能量', dur: 1.0 }),
        jiyi: H.act({ key: 'jiyi', cls: 'E', skill: 6, labels: ['极意·神来之笔伤害'], levelKey: 'forte', concertoParam: '极意·神来之笔回复协奏能量', dur: 1.3 }),
        crane: H.act({ key: 'crane', cls: 'A', skill: 3, labels: ['墨鹤伤害'], levelKey: 'liberation', label: '墨鹤（协同）' }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: lib.cooldown || 25, concertoParam: '回复协奏能量', label: lib.name, dur: 1.5 }),
      };
      H.buff({ id: 'jiyi', name: '极意·普攻伤害加成', stats: [{ key: 'dmg:basic', value: 0.18 }], duration: 27, trigger: { on: 'act', keys: ['jiyi'] },
        text: '极意·神来之笔：让折枝的普攻伤害加成提升18%，持续27秒。', confidence: 'high' });
      H.patchBuff((b) => /挥毫/.test(b.src || '') && b.stats.length, { trigger: { on: 'act', keys: ['shenlai', 'jiyi'] }, mode: 'auto' }, '模块：触发=神来之笔/极意·神来之笔');
      if (H.weaponId === SIG) {
        const off = H.findBuff((b) => b.kind === 'weapon' && /不在场时普攻伤害加成/.test(b.text || '') && b.stats[0] && b.stats[0].key === 'dmg:basic' && /52|延奏/.test(b.text))[0];
        const onB = H.findBuff((b) => b.kind === 'weapon' && /在场时普攻伤害加成提升12/.test(b.text || ''))[0];
        if (off) { H.patchBuff((b) => b === off, { mode: 'module', trigger: { on: 'module' } }, '模块：延奏时检查 3 层'); H.mem._zzWeapon = { off: off.id, on: onB ? onB.id : null }; }
      }
      const g = Object.assign({ intro: 45, basic: 15 }, H.opts.gain || {});
      H.mem._zzGain = g;
      return K;
    },
    init(api) { const st = api.H.opts.start || {}; return { ly: st.lingyun || 0, sh: {}, jy: 0, jyUntil: null, gx: null, crane: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, kit = api.mem.kit;
      switch (btn) {
        case 'A': return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'H': return on(cs.gx, t) ? { act: K.gouxing } : (kit.H ? { act: kit.H } : null);
        case 'E':
          if (shadowCount(cs, t) > 0) return (on(cs.jyUntil, t) && cs.jy >= 2) ? { act: K.jiyi } : { act: K.shenlai };
          return { act: K.E };
        case 'R': return { act: K.R };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        case 'I': return { act: kit.I };
        default: return null;
      }
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd, g = api.mem._zzGain;
      const removeShadow = () => { const ks = Object.keys(cs.sh).filter((k) => on(cs.sh[k], t)).sort((a, b) => cs.sh[a] - cs.sh[b]); if (ks.length) delete cs.sh[ks[0]]; };
      if (act.cls === 'A' && act.stage) { cs.ly = Math.min(90, cs.ly + g.basic); if (act.stage === 3) cs.gx = te + 1.5; }
      switch (act.key) {
        case 'I': cs.ly = Math.min(90, cs.ly + g.intro); break;
        case 'E': if (cs.ly >= 60) { cs.ly -= 60; cs.sh.L = te + 15; cs.sh.R = te + 15; } cs.gx = te + 1.5; break;
        case 'gouxing': if (cs.ly >= 30) { cs.ly -= 30; cs.sh.M = te + 15; } cs.gx = null; break;
        case 'shenlai': removeShadow(); cs.jy = Math.min(2, (on(cs.jyUntil, t) ? cs.jy : 0) + 1); cs.jyUntil = te + 8; cs.gx = te + 1.5; break;
        case 'jiyi': removeShadow(); cs.jy = 0; cs.jyUntil = null; cs.gx = te + 1.5; break;
        case 'R': cs.crane = { until: te + 30, left: 21 + (api.H.chain >= 2 ? 6 : 0), next: te }; break;
        default: break;
      }
    },
    onOutro(api, to) {
      api.addEnergy(to, 15); // 点睛
      const w = api.mem._zzWeapon;
      if (w && w.on) { const inst = api.buffInst(w.on); if (inst && inst.stacks >= 3) { api.endBuff(w.on); api.fireBuff(w.off, api.mi, { duration: 27 }); } }
    },
    onTeam(api, ev) {
      const cr = api.cs.crane;
      if (ev.type !== 'damage' || ev.coord || !cr || !on(cr.until, ev.t) || cr.left <= 0) return;
      if (ev.mi !== api.active) return; // 在场角色
      const start = Math.max(cr.next, ev.t);
      const end = Math.min(ev.t + (ev.dur || 0) + 3, cr.until, api.ctx.duration);
      if (end < start - 1e-9) return;
      const n = Math.min(cr.left, Math.floor(end - start + 1e-9) + 1);
      cr.next = start + n; cr.left -= n;
      api.deal(api.mem.modKit.crane, { count: n });
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const cr = cs.crane && on(cs.crane.until, t) ? Math.min(cs.crane.left, cs.crane.until - t) * api.est(K.crane) : 0;
      return cr + (cs.ly / 90) * 0.5 * api.est(K.shenlai) + 0.5 * C.on(cs.jyUntil, t) * cs.jy * api.est(K.shenlai) + 0.6 * Object.values(cs.sh).filter((u) => on(u, t)).length * api.est(K.shenlai);
    },
  });
});
