/*
 * 秋水 (1403) character module — worker-B.
 *
 * 普攻 真假参半 (1001001): 普攻 5 段，「普攻第4段会向前方扩散出【雾气】，【雾气】持续1.5秒」；重击 = 瞄准（完全蓄力 80.52%）
 * 共鸣技能 移位戏法 (1001002):「施放【雾气】和1个【雾化分身】…并在幻影周围生成6颗【雾化子弹】」59.65%×6（模块），冷却 10，协奏 15；幻影持续 8 秒
 * 共鸣解放 雾里观花 (1001003): 397.62%；「当攻击穿过【虚实之门】时攻击提升」10%，门持续 10 秒；冷却 20；150 能量
 *   → 模块：解放后 10 秒全队攻击 +10%（假设队友攻击穿门，中）
 * 共鸣回路 雾色掩护 (1001007):
 *   「当秋水穿过【雾气】或【虚实之门】时，会进入迷雾潜行状态…每消耗1点【雾滴】，生成1颗共鸣技能【雾化子弹】」59.65%/颗
 *   「【雾滴】上限6点。普攻或空中攻击穿过【雾气】命中目标时，回复1点【雾滴】」
 *   → 模块：雾气窗口（第 4 段后 1.5 秒 / 技能后 8 秒，估计）内每段普攻 +1 雾滴（低）；H（有雾滴时）= 迷雾潜行，消耗全部雾滴
 * 固有 零失误演绎：重击必定暴击（每 30 秒 1 次）→ 未建模（瞄准很少用）
 * 变奏 虚晃一枪: 66.27%×3
 * 延奏 雾解：下一位登场角色气动伤害加深 23%（解析）
 * 动作帧：WuWaSim（按原样映射）；瞄准、技能长按、迷雾潜行在帧数据中 duration_s 为 null → 模块估计（低）
 * 共鸣链：未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const scale = (a, m, key) => Object.assign({}, a, { key, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1403, chainModeled: 0, name: '秋水', version: '0.1', confidence: 'medium',
    notes: ['雾滴获取：雾气窗口内每段普攻 +1（低）', '移位戏法 6 颗雾化子弹全部命中（中）', '虚实之门：解放后 10 秒全队攻击 +10%（假设穿门，中）', '迷雾潜行时长 0.6 秒（穿雾进入）+0.25 秒/颗（低）', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['ms', 'lib'], window: 25, sig: null, alts: [21030015, 21030024, 21030064], solo: 'aalto_solo.json', team: 'team_aalto.json', teamMi: 1 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]', a5: '普攻·basic_5 [WuWaSim]',
      aim: '普攻·basic_fully_charged_aimed_shot_damage [WuWaSim]', sk: '共鸣技能·skill_mist_bullet_damage 技能-长按-本体 [WuWaSim]',
      lib: '共鸣解放·liberation [WuWaSim]', I: '变奏入场·intro [WuWaSim]', ms: '共鸣回路·forte_heavy_mist_bullet 技能-长按-本体 [WuWaSim]',
    },
    resources: [{ key: 'wd', name: '雾滴', max: 6, segmented: true, confidence: 'low' }],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 5, prefix: 'a', durs: [0.33, 0.37, 0.63, 0.79, 0.77] }), {
        aim: H.act({ key: 'aim', cls: 'H', skill: 1, labels: ['瞄准完全蓄力伤害'], levelKey: 'basic', dur: 1.33, label: '瞄准·完全蓄力' }),
        sk: H.act({ key: 'sk', cls: 'E', skill: 2, labels: ['雾化弹伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 10, cdKey: 'E', dur: 1.0, label: '移位戏法' }),
        ms1: H.act({ key: 'ms', cls: 'H', skill: 6, labels: ['雾化子弹伤害'], levelKey: 'forte', dur: 0.25, label: '迷雾潜行·雾化子弹' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, cdKey: 'R', dur: 1.5, label: '雾里观花' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.08 }),
        O: B.outro(H, '雾解'),
      });
      K.sk = scale(K.sk, 6, 'sk');
      for (let n = 1; n <= 6; n++) { K['ms' + n] = scale(K.ms1, n, 'ms'); K['ms' + n].defDur = 0.6 + 0.25 * n; K['ms' + n].label = '迷雾潜行·雾化子弹×' + n; }
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4', 'a5'],
    init() { return { wd: 0, st: 0, mistUntil: null, gateUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 5) + 1)] };
        case 'H': return cs.wd >= 1 && on(cs.mistUntil, api.t) ? { act: K['ms' + Math.min(6, Math.floor(cs.wd))] } : { act: K.aim };
        case 'E': return api.cdReady('E') ? { act: K.sk } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    auras(api) { return on(api.cs.gateUntil, api.t) ? [{ key: 'atkPct', value: 0.1 }] : []; },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      if (/^a\d$/.test(k)) {
        cs.st = +k.slice(1) % 5;
        if (on(cs.mistUntil, t)) cs.wd = Math.min(6, cs.wd + 1);
        if (k === 'a4') cs.mistUntil = Math.max(cs.mistUntil || 0, te + 1.5);
        return;
      }
      switch (k) {
        case 'sk': cs.mistUntil = Math.max(cs.mistUntil || 0, te + 8); break;
        case 'ms': cs.wd = 0; break;
        case 'lib': cs.gateUntil = te + 10; break;
        default: break;
      }
    },
    // search heuristic (not a game rule): 雾滴→迷雾潜行
    potential(api) { return api.cs.wd * 0.5 * api.est(api.mem.modKit.ms1); },
  });
});
