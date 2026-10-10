/*
 * 渊武 (1303) character module — worker-B. 防御缩放（解析：技能 sc=def）。
 *
 * 普攻 雷煌拳 (1001601): 普攻 5 段，重击 159.05%（耐力 20）
 * 共鸣技能 拳震凌武 (1001602): 雷之楔 23.86%，冷却 3，协奏 3；「雷之楔持续12秒」
 *   「施放共鸣回路万壑雷及共鸣解放寂土重明时会立刻引爆场上的共鸣技能雷之楔…此次伤害为共鸣技能伤害」59.65%
 *   雷池：「队伍中登场角色处于雷池内…攻击命中目标时，共鸣技能雷之楔会进行协同攻击…每1.2秒可触发1次」7.96%
 *   → 模块：雷之楔存在期间，登场角色的非协同伤害事件触发（假设登场角色始终处于雷池内，中）
 * 共鸣解放 寂土重明 (1001603): 174.96%×2，冷却 20，协奏 20；「为附近队伍中所有角色提供共鸣回路雷厉风行状态，持续10秒」
 *   （队友只获得抗打断，不建模；渊武本人进入雷厉风行）
 * 共鸣回路 沉雷藏锋 (1001607):
 *   「【锋芒】充满时，长按共鸣技能，将会消耗所有【锋芒】，施放万壑雷…并使渊武进入雷厉风行状态」108.54%，协奏 25
 *   「【锋芒】充满时，共鸣技能雷之楔将会施放掀雷」39.77%（固有 决电 +40%）→ 引擎无“短按/长按”二选一：E 在锋芒满时 = 万壑雷；掀雷未建模（低）
 *   雷厉风行：普攻 5 段 / 重击 / 「施放重击…后3秒内短按普攻，将会施放蹑风追雷…此次伤害为普攻伤害」；「不会回复【锋芒】」
 *   锋芒：「场上存在共鸣技能雷之楔时，每秒回复6点【锋芒】，渊武不在场时该效果依然生效」「雷之楔协同攻击命中目标时，回复5点【锋芒】」
 * 固有 敛光：「战斗状态中离场时，若【锋芒】没有充满，渊武会自动在原地留下1个共鸣技能雷之楔」→ 离场时补楔（无伤害）
 * 变奏 轰雷: 63.62%；延奏 驱雷：只有共振值伤害（不建模）
 * 动作帧：WuWaSim（按原样映射）
 * 专武：无（null）
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const FM_RATE = 6, FM_COORD = 5, CW_CD = 1.2;
  return WW.registerChar({
    id: 1303, chainModeled: 0, name: '渊武', version: '0.1', confidence: 'medium',
    notes: ['雷池：假设登场角色始终处于雷池内（中）', '掀雷（锋芒满时短按 E）未建模：引擎按键无短按/长按之分，满锋芒时 E = 万壑雷', '寂土重明给队友的雷厉风行只有抗打断，不建模', '闪避反击未建模', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['wh', 'lib'], window: 25, sig: null, alts: [21040044, 21040024, 21040053], solo: 'yuanwu_solo.json', team: 'team_yuanwu.json', teamMi: 1 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]', a5: '普攻·basic_5 [WuWaSim]',
      hv: '重击·heavy_heavy_attack [WuWaSim]', E: '共鸣技能·skill 渊武E技能 [WuWaSim]', wh: '共鸣技能·skill_rumbling_spark_damage [WuWaSim]',
      lib: '共鸣解放·liberation [WuWaSim]', I: '变奏入场·intro [WuWaSim]',
      l1: '共鸣回路·forte_basic_lightning_infused_basic_attack_1 [WuWaSim]', l2: '共鸣回路·forte_basic_lightning_infused_basic_attack_2 [WuWaSim]',
      l3: '共鸣回路·forte_basic_lightning_infused_basic_attack_3 [WuWaSim]', l4: '共鸣回路·forte_basic_lightning_infused_basic_attack_4 [WuWaSim]',
      l5: '共鸣回路·forte_basic_lightning_infused_basic_attack_5 [WuWaSim]', lH: '共鸣回路·forte_heavy_lightning_infused_heavy_attack [WuWaSim]',
      nf: '共鸣回路·forte_heavy_thunderweaver_damage [WuWaSim]',
    },
    resources: [
      { key: 'fm', name: '锋芒', max: 100, segmented: false, confidence: 'high', get: (cs, t) => +fmAt(cs, t).toFixed(1) },
      { key: 'wedge', name: '雷之楔（秒）', max: 12, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.wUntil, t).toFixed(2) },
      { key: 'lf', name: '雷厉风行（秒）', max: 10, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.lfUntil, t).toFixed(2) },
    ],
    kit(H) {
      const s6 = H.skill(6);
      const K = Object.assign(B.stages(H, { n: 5, prefix: 'a', durs: [0.3, 0.63, 0.67, 0.63, 0.81] }),
        B.stages(H, { n: 5, prefix: 'l', skill: 6, levelKey: 'forte', label: (k) => '雷厉风行普攻第' + B.CN[k - 1] + '段伤害', durs: [0.3, 0.63, 0.67, 0.7, 0.81] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.47, label: '重击' }),
          lH: H.act({ key: 'lH', cls: 'H', skill: 6, hits: s6.hits.filter((h) => !h.alt && h.label === '雷厉风行重击伤害'), levelKey: 'forte', dur: 0.87, label: '雷厉风行·重击' }),
          nf: H.act({ key: 'nf', cls: 'A', skill: 6, hits: s6.hits.filter((h) => !h.alt && h.label === '蹑风追雷伤害'), levelKey: 'forte', dur: 0.47, label: '蹑风追雷' }),
          E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '拳震凌武回复协奏能量', cooldown: 3, cdKey: 'E', dur: 0.4, label: '雷之楔' }),
          wh: H.act({ key: 'wh', cls: 'E', skill: 2, labels: ['万壑雷伤害'], levelKey: 'skill', concertoParam: '万壑雷回复协奏能量', dur: 0.71, label: '万壑雷' }),
          det: H.act({ key: 'det', cls: 'E', skill: 2, labels: ['雷之楔引爆伤害'], levelKey: 'skill', dur: 0, label: '雷之楔·引爆' }),
          cw: H.act({ key: 'cw', cls: 'E', skill: 2, labels: ['雷之楔协同攻击伤害'], levelKey: 'skill', dur: 0, label: '雷之楔·协同攻击' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, cdKey: 'R', dur: 2.23, label: '寂土重明' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.16 }),
          O: B.outro(H, '驱雷'),
        });
      for (const k of ['l1', 'l2', 'l3', 'l4', 'l5']) K[k].cls = 'A';
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4', 'a5'],
    init() { return { fm: 0, fmT: 0, wUntil: null, lfUntil: null, st: 0, lst: 0, nfUntil: null, cwNext: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, lf = on(cs.lfUntil, t);
      switch (btn) {
        case 'A':
          if (lf && on(cs.nfUntil, t)) return { act: K.nf };
          return lf ? { act: K['l' + ((cs.lst % 5) + 1)] } : { act: K['a' + ((cs.st % 5) + 1)] };
        case 'H': return { act: lf ? K.lH : K.hv };
        case 'E':
          if (fmAt(cs, t) >= 100 - 1e-9 && !lf) return { act: K.wh };
          return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      if (k !== 'lH') cs.nfUntil = null;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 5; return; }
      if (/^l\d$/.test(k)) { cs.lst = +k.slice(1) % 5; return; }
      switch (k) {
        case 'lH': cs.nfUntil = te + 3; break;
        case 'E': setFm(cs, t, fmAt(cs, t)); cs.wUntil = te + 12; break;
        case 'wh': this.detonate(api, te); setFm(cs, t, 0); cs.lfUntil = te + 10; cs.lst = 0; break;
        case 'lib': setFm(cs, t, fmAt(cs, t)); this.detonate(api, te); cs.lfUntil = te + 10; cs.lst = 0; break;
        default: break;
      }
    },
    detonate(api, t) {
      const cs = api.cs;
      if (!on(cs.wUntil, t)) return;
      setFm(cs, t, fmAt(cs, t)); cs.wUntil = t;
      api.deal(api.mem.modKit.det, { t });
    },
    // 雷池协同（登场角色伤害事件，1.2 秒 1 次）；敛光：离场且锋芒未满 → 原地留楔
    onTeam(api, ev) {
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if (((ev.type === 'swap' && ev.from === api.mi) || (ev.type === 'outro' && ev.mi === api.mi)) && fmAt(cs, t) < 100 - 1e-9 && !on(cs.wUntil, t)) { setFm(cs, t, fmAt(cs, t)); cs.wUntil = t + 12; return; }
      if (ev.type !== 'damage' || ev.coord || ev.mi !== api.s.active || !on(cs.wUntil, t) || t < cs.cwNext - 1e-9) return;
      cs.cwNext = t + CW_CD;
      api.deal(api.mem.modKit.cw, { t });
      if (!on(cs.lfUntil, t)) setFm(cs, t, Math.min(100, fmAt(cs, t) + FM_COORD));
    },
    // search heuristic (not a game rule): 锋芒→万壑雷
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return fmAt(cs, api.t) / 100 * 0.5 * api.est(K.wh) + (on(cs.wUntil, api.t) ? 0.2 * api.est(K.det) : 0);
    },
  });
  // 锋芒：雷之楔存在期间 +6/秒（离场仍生效）；雷厉风行期间不回复（只对渊武本人）
  function fmAt(cs, t) {
    let v = cs.fm;
    const end = cs.wUntil == null ? cs.fmT : Math.min(t, cs.wUntil);
    let dt = Math.max(0, end - cs.fmT);
    if (cs.lfUntil != null && dt > 0) { const a = Math.max(cs.fmT, Math.min(end, cs.lfUntil)); dt -= Math.max(0, a - cs.fmT); }
    return Math.min(100, v + FM_RATE * Math.max(0, dt));
  }
  function setFm(cs, t, v) { cs.fm = v; cs.fmT = t; }
});
