/*
 * 维里奈 (1503) character module.
 *
 * 普攻 育苗 (1000301): 普攻最多 5 段；重击伤害；空中攻击 3 段
 * 共鸣技能 扩繁试验 (1000302): 冷却时间=12, 回复协奏能量=30
 * 共鸣解放 草木生长 (1000303): 消耗共鸣能量=175, 冷却时间=25, 回复协奏能量=20
 *   「命中目标时给目标附加光合标记」「附近队伍中所有角色攻击命中携带光合标记的目标时，维里奈都会进行协同攻击，造成衍射伤害…每秒可触发1次。」光合标记持续时间=12
 *   → 任一队员（非协同）伤害事件覆盖的时间内每秒 1 次协同攻击（_common.perSecond，中），以维里奈面板结算
 * 共鸣回路 星星花绽放 (1000307):
 *   「施放重击时，若拥有【光合能量】，则消耗1层【光合能量】，回复协奏能量…重击星星花绽放…此次伤害为重击伤害。」
 *   「施放空中攻击时，若拥有【光合能量】，则消耗1层…空中攻击星星花绽放…此次伤害为普攻伤害。施放重击星星花绽放后短按普攻，可以施放空中攻击星星花绽放。」
 *   「【光合能量】上限4层。第5段普攻命中目标时，获得1层。施放共鸣技能扩繁试验时，获得1层。施放变奏技能蔓延时，获得1层。」 每层【光合能量】回复协奏能量=12
 *   → H（有光合能量）= 重击星星花绽放；紧接着的 A（有光合能量）= 空中攻击星星花绽放（三段合并为一个动作，消耗 1 层；中）
 * 固有 自然的献礼: 「施放重击星星花绽放、空中攻击星星花绽放、共鸣解放草木生长或延奏技能盛放时，队伍中的角色攻击提升20%，持续20秒。」
 *   → 解析器把“重击”识别为任意重击：触发改为 hua / huaAir / R 动作 + 延奏
 * 延奏 盛放 (1000309): 「附近队伍中所有角色全伤害加深15%，持续30秒。」（解析正确，自动）
 * 共鸣链: 2 E 额外 +1 光合能量与 +10 协奏；4 同固有触发，衍射伤害 +15% 24 秒（改触发）；
 *   6 「重击星星花绽放及空中攻击星星花绽放的伤害提升20%，命中目标时触发1次协同攻击…等同于共鸣解放光合标记。」
 *   → 解析器（v0.2）先剔除招式名，不再误读为攻击%（该条为未建模）；模块实现 ×1.2 + 1 次协同攻击（中）
 * 维里奈无 5★ 专武；常用 4★ 奇幻变奏（施放共鸣技能回复协奏能量）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN, perSecond } = C;
  return WW.registerChar({
    id: 1503, chainModeled: 6, name: '维里奈', version: '0.1', confidence: 'medium',
    notes: ['光合标记协同：任一队员非协同伤害动作覆盖的时间内每秒 1 次（中）', '空中攻击星星花绽放三段合为一个动作（消耗 1 层光合能量，中）',
      '链6 由模块实现（×1.2 + 1 次协同攻击）；解析器已不再把“空中攻击”读成攻击%', '治疗量未计入伤害结果'],
    frames: {
      A1: '普攻·Basic: Cultivation 1', A2: '普攻·Basic: Cultivation 2', A3: '普攻·Basic: Cultivation 3', A4: '普攻·Basic: Cultivation 4', A5: '普攻·Basic: Cultivation 5',
      H: '重击·Heavy: Cultivation', hua: '重击·Heavy: Starflower Blooms', E: '共鸣技能·Skill: Botany Experiment',
      R: '共鸣解放·Liberation: Arboreal Flourish', I: '变奏入场·Intro: Verdant Growth',
    },
    resources: [
      { key: 'gh', name: '光合能量', max: 4, segmented: true, confidence: 'high' },
      { key: 'mark', name: '光合标记（秒）', max: 12, segmented: false, confidence: 'high', get: (cs, t) => (on(cs.mark.until, t) ? +(cs.mark.until - t).toFixed(2) : 0) },
    ],
    kit(H) {
      const K = {};
      for (let k = 1; k <= 5; k++) K['A' + k] = H.act({ key: 'A' + k, cls: 'A', skill: 1, labels: ['第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.48, 0.58, 0.72, 0.72, 0.97][k - 1] });
      const c6 = H.chain >= 6 ? { scale: { '*': 1.2 }, inferred: '链6：星星花绽放伤害 +20%（按 ×1.2）' } : {};
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.8 }),
        hua: H.act(Object.assign({ key: 'hua', cls: 'H', skill: 6, labels: ['重击·星星花绽放伤害'], levelKey: 'forte', concertoParam: '每层【光合能量】回复协奏能量', dur: 0.8 }, c6)),
        huaAir: H.act(Object.assign({ key: 'huaAir', cls: 'A', skill: 6, labels: ['空中攻击·星星花绽放第一段伤害', '空中攻击·星星花绽放第二段伤害', '空中攻击·星星花绽放第三段伤害'], levelKey: 'forte', concertoParam: '每层【光合能量】回复协奏能量', dur: 1.2, label: '空中攻击·星星花绽放' }, c6)),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: H.param(2, '冷却时间') || 12, dur: 1.08 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: H.param(3, '冷却时间') || 25, concertoParam: '回复协奏能量', dur: 2.5 }),
        coord: H.act({ key: 'coord', cls: 'R', skill: 3, labels: ['协同攻击伤害'], levelKey: 'liberation', label: '光合标记（协同）' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.63 }),
      });
      const trig = { on: 'any', any: [{ on: 'outro' }, { on: 'act', keys: ['hua', 'huaAir', 'R'] }] };
      H.patchBuff((b) => /自然的献礼/.test(b.src || '') && b.stats.length, { trigger: trig, mode: 'auto' }, '模块：触发=星星花绽放/草木生长/盛放（普通重击不触发）');
      H.patchBuff((b) => b.kind === 'chain' && /盛放的拥抱|队伍中的角色衍射伤害加成提升15%/.test((b.src || '') + (b.text || '')), { trigger: trig, mode: 'auto' }, '模块：同固有触发');
      H.patchBuff((b) => b.kind === 'chain' && /丰收的喜悦|空中攻击星星花绽放的伤害提升20%/.test((b.src || '') + (b.text || '')),
        { mode: 'off', stats: [], lowReason: '“空中攻击”被误识别为攻击提升；模块实现 ×1.2 与协同攻击' }, '模块：链6');
      return K;
    },
    init() { return { gh: 0, st: 0, air: false, mark: { until: null, next: 0 } }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': if (cs.air && cs.gh > 0) return { act: K.huaAir }; return { act: K['A' + ((cs.st % 5) + 1)] };
        case 'H': return { act: cs.gh > 0 ? K.hua : K.H };
        case 'E': return { act: K.E };
        case 'R': return { act: K.R };
        case 'I': return { act: K.I };
        case 'O': return { act: { key: 'O', cls: 'O', skill: 11, hits: [], label: '盛放' } };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      if (/^A\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 5; if (n === 5) cs.gh = Math.min(4, cs.gh + 1); }
      else cs.st = 0;
      cs.air = k === 'hua';
      switch (k) {
        case 'hua': case 'huaAir':
          cs.gh = Math.max(0, cs.gh - 1);
          if (api.H.chain >= 6) api.deal(api.mem.modKit.coord, { count: 1 });
          break;
        case 'E': cs.gh = Math.min(4, cs.gh + (api.H.chain >= 2 ? 2 : 1)); if (api.H.chain >= 2) api.addConcerto(api.mi, 10); break;
        case 'I': cs.gh = Math.min(4, cs.gh + 1); break;
        case 'R': cs.mark = { until: api.tEnd + 12, next: api.tEnd }; break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type !== 'damage' || ev.coord) return;
      const n = perSecond(api.cs.mark, ev.t, ev.dur || 0, 0, api.ctx.duration);
      if (n) api.deal(api.mem.modKit.coord, { count: n });
    },
    // 残值引导（搜索启发式）：窗口结束后光合标记剩余的协同攻击（约 1 次/秒）；不计入报告伤害
    residual(api, D, Hz) {
      const m = api.cs.mark;
      return m && m.until > D ? Math.min(Hz, m.until - D) * api.est(api.mem.modKit.coord) : 0;
    },
    // 稳态开局：光合标记计时平移 −D
    carry(api, cs, D) {
      if (cs.mark) cs.mark = { until: cs.mark.until == null ? null : cs.mark.until - D, next: (cs.mark.next || 0) - D };
      return cs;
    },
    // search heuristic (not a game rule): stored 光合能量 ≈ future 星星花绽放 + team ATK buff upkeep
    potential(api) { return api.cs.gh * 0.6 * api.est(api.mem.modKit.hua); },
  });
});
