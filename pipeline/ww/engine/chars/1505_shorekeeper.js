/*
 * 守岸人 (1505) character module.
 *
 * 共鸣回路 群星漫响 (1002507):
 *   「常态攻击命中目标时，生成坍缩核悬浮在空中，并在6秒后演化为耀星·蝶…若场上坍缩核的数量已达到5枚，守岸人下一次普攻会催生坍缩核，使之提前演化」
 *   「演绎：持有5段【实论数据】时，施放重击将消耗所有【实论数据】…造成衍射伤害，并使所有坍缩核立即演化为耀星·蝶。」 演绎回复协奏能量=6
 *   「普攻第1段、普攻第2段、普攻第4段命中目标时，获得1段【实论数据】。普攻第3段命中目标时，获得2段【实论数据】。」 上限5段
 *   → 1 core per basic stage (inferred: “命中时生成” per stage, medium), cores cap 5.
 * 共鸣技能 混沌理论 (1002502): 「回复…生命值，并召唤5只黯星·蝶」 hit row count=1 → modelled ×5 (inferred, low); 回复协奏能量=20 (description, hit rows give 2/只)
 * 共鸣解放 终末回环 (1002503): 星域 30 s.
 *   「浅析星域持续期间，当附近队伍中的角色使用变奏技能时，将进入深潜星域…暴击提升：守岸人自身每0.2%共鸣效率计算为0.01%暴击提升，上限12.5%。」
 *   「深潜星域持续期间…使用变奏技能时，将进入解限星域…暴击伤害提升：每0.1%共鸣效率计算为0.01%暴击伤害提升，上限25%。」
 *   → crit = min(12.5%, ER×5%), critDmg = min(25%, ER×10%) using 守岸人 total ER (medium: whether base 100% counts is community consensus).
 * 变奏 故此证明 (1002506): 「解限星域持续期间，守岸人的变奏技能启迪替换为变奏技能洞悉。施放时对应星域状态结束…此次伤害为共鸣解放伤害，并且必定暴击。同一个解限星域中仅可触发1次」
 * 固有 自我引力: 「队伍中登场角色处于星域生效范围内时，守岸人共鸣效率提升10%」 → aura while 星域 active
 * 武器 星序协响 (21050036): 「施放共鸣解放时，回复自身8点协奏能量，每20秒可触发1次。」 (other effects via text parser)
 * Not modelled: 重击 解限 charging (演算数据→实论数据), 延奏双蝶的伤害 (no hit rows).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on } = C;
  const fieldStage = (cs, t) => (cs.field && on(cs.field.until, t) ? cs.field.stage : 0);
  return WW.registerChar({
    id: 1505, chainModeled: 1, name: '守岸人', version: '0.1', confidence: 'medium',
    notes: ['混沌理论 黯星·蝶按 5 只计（命中行 count=1，描述为 5 只；低置信）', '星域暴击/暴伤按守岸人总共鸣效率换算', '普攻每段生成 1 枚坍缩核（推断），6 秒后或演绎时演化为耀星·蝶', '重击解限蓄力与延奏双蝶伤害未建模'],
    // action_frames.json (WuwaLAB) label map
    frames: {
      I: '变奏入场·Intro: Enlightenment',                      // 启迪
      dongxi: '变奏入场·Intro 2: Discernment',                 // 故此证明·洞悉
      yanyi: '共鸣回路·Forte: Illation',                       // 演绎 (Illation = deduction; confidence: medium)
    },
    resources: [
      { key: 'data', name: '实论数据', max: 5, segmented: true, confidence: 'high' },
      { key: 'cores', name: '坍缩核', max: 5, segmented: true, confidence: 'medium', get: (cs) => cs.cores.length },
      { key: 'field', name: '星域', max: 3, segmented: true, confidence: 'high', basis: '1 浅析 / 2 深潜 / 3 解限', get: (cs, t) => fieldStage(cs, t) },
    ],
    kit(H) {
      const sk2 = H.skill(2);
      const K = {
        E: H.act({ key: 'E', cls: 'E', skill: 2, hits: sk2.hits.map((h) => (h.label === '黯星·蝶伤害' ? Object.assign({}, h, { count: 5 }) : h)), levelKey: 'skill', cooldown: sk2.cooldown || 16, label: sk2.name, dur: 1.2, inferred: '黯星·蝶×5', extra: {} }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['启迪伤害', '启迪治疗量'], levelKey: 'intro', concertoParam: '启迪回复协奏能量', label: '故此证明·启迪' }),
        dongxi: H.act({ key: 'dongxi', cls: 'I', skill: 5, labels: ['洞悉伤害', '洞悉治疗量'], levelKey: 'intro', concertoParam: '洞悉回复协奏能量', forceCrit: true, label: '故此证明·洞悉', dur: 1.5 }),
        yanyi: H.act({ key: 'yanyi', cls: 'H', skill: 6, labels: ['演绎伤害'], levelKey: 'forte', concertoParam: '演绎回复协奏能量', dur: 1.5 }),
        butterfly: H.act({ key: 'butterfly', cls: 'A', skill: 6, labels: ['耀星·蝶伤害'], levelKey: 'forte', label: '耀星·蝶（协同）' }),
      };
      K.E.concerto = 20; K.E.concertoSource = 'description';
      H.patchBuff((b) => /自我引力/.test(b.src || ''), { mode: 'module' }, '模块：星域期间共鸣效率 +10%');
      return K;
    },
    init() { return { data: 0, cores: [], field: null, wcd: -1e9 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, kit = api.mem.kit;
      switch (btn) {
        case 'A': return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'H': return cs.data >= 5 ? { act: K.yanyi } : (kit.H ? { act: kit.H } : null);
        case 'E': return { act: K.E };
        case 'R': return { act: kit.R };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        case 'I': return (fieldStage(cs, t) === 3 && !cs.field.dx) ? { act: K.dongxi } : { act: K.I };
        default: return null;
      }
    },
    evolve(api, all) {
      const cs = api.cs, t = api.t;
      const ready = all ? cs.cores.length : cs.cores.filter((b) => b + 6 <= t + 1e-9).length;
      if (!ready) return;
      cs.cores = all ? [] : cs.cores.filter((b) => b + 6 > t + 1e-9);
      api.deal(api.mem.modKit.butterfly, { count: ready });
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd;
      if (act.cls === 'A' && act.stage) {
        cs.data = Math.min(5, cs.data + (act.stage === 3 ? 2 : 1));
        if (cs.cores.length >= 5) this.evolve(api, true); // 催生
        cs.cores.push(t);
      }
      if (act.key === 'yanyi') { cs.data = 0; this.evolve(api, true); }
      if (act.key === 'R') {
        cs.field = { until: te + 30 + (api.H.chain >= 1 ? 10 : 0), stage: 1, dx: false };
        if (api.H.weaponId === 21050036 && t >= cs.wcd - 1e-9) { api.addConcerto(api.mi, 8); cs.wcd = t + 20; }
      }
      if (act.key === 'dongxi' && cs.field) { cs.field.dx = true; if (api.H.chain < 1) cs.field.until = t; }
    },
    auras(api, target) {
      const cs = api.cs, st = fieldStage(cs, api.t);
      if (!st) return [];
      const er = api.staticPanel().energyRegen + 0.1;
      const out = [];
      if (target === api.mi) out.push({ key: 'energyRegen', value: 0.1 });
      if (st >= 2) out.push({ key: 'critRate', value: Math.min(0.125, er * 0.05) });
      if (st >= 3) out.push({ key: 'critDmg', value: Math.min(0.25, er * 0.1) });
      return out;
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'intro' && cs.field && on(cs.field.until, ev.t)) cs.field.stage = Math.min(3, cs.field.stage + 1);
      if (cs.cores.length && cs.cores[0] + 6 <= ev.t + 1e-9 && !ev.coord) this.evolve(api, false);
    },
    // 残值引导（搜索启发式）：窗口结束后星域仍存在的时间 × 当前阶段光环对队伍的价值；不计入报告伤害
    residual(api, D, Hz) {
      const cs = api.cs;
      if (!cs.field || !(cs.field.until > D)) return 0;
      const er = api.staticPanel().energyRegen + 0.1, st = Math.max(1, cs.field.stage);
      const stats = [{ key: 'critRate', value: Math.min(0.125, er * 0.05) }].concat(st >= 3 ? [{ key: 'critDmg', value: Math.min(0.25, er * 0.1) }] : []);
      return api.teamStatValue(st >= 2 ? stats : stats.map((x) => ({ key: x.key, value: x.value * 0.5 })), Math.min(Hz, cs.field.until - D));
    },
    // 稳态开局：星域/坍缩核/武器冷却的时间点平移 −D
    carry(api, cs, D) {
      if (cs.field) { cs.field.until -= D; if (!(cs.field.until > 0)) cs.field = null; }
      cs.cores = (cs.cores || []).map((b) => b - D);
      cs.wcd = (cs.wcd || -1e9) - D;
      return cs;
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      // 星域（暴击/暴伤光环）的搜索估值：在场星域按剩余时间×当前阶段（至少按深潜计），未开星域按能量比例×完整星域
      const er = api.staticPanel().energyRegen + 0.1, cr = Math.min(0.125, er * 0.05), cd = Math.min(0.25, er * 0.1);
      const st = fieldStage(cs, api.t);
      const stats = (n) => [{ key: 'critRate', value: cr }].concat(n >= 3 ? [{ key: 'critDmg', value: cd }] : []);
      const left = Math.max(0, api.duration - api.t);
      const fv = st ? api.teamStatValue(stats(Math.max(2, st)), Math.min(left, cs.field.until - api.t))
        : api.energyFrac() * api.teamStatValue(stats(2), Math.min(left, 25));
      return fv + (cs.data / 5) * 0.6 * api.est(K.yanyi) + cs.cores.length * 0.8 * api.est(K.butterfly);
    },
  });
});
