/*
 * 夏空 (1407) character module — worker-B.
 *
 * 普攻 四拍的舞曲 (1003401):「普攻第4段可为命中的目标添加一层【风蚀效应】…普攻第4段结束后，夏空会进入音律独奏状态。夏空在主动或被动打断普攻第4段或音律独奏状态时，会生成一个合奏音影。
 *   音律独奏：夏空或合奏音影在进入音律独奏状态时能够以自身为中心，使附近队伍中所有角色的气动伤害加成提升24%，该效果不可叠加。」
 *   → 第4段后队伍气动 +24% 光环；持续时间描述未给出（合奏音影代替夏空继续独奏）：估计 opts.soloDur 默认 8 秒（低）
 * 共鸣技能 谐律速奏 (1003402): 40.39%×4，冷却 10，「为命中的目标添加一层【风蚀效应】。施放后一定时间内短按普攻，将会施放第2段普攻」
 * 共鸣解放 歌者的三重华彩 (1003403): 即兴的交响诗 1100.42%（消耗 125，冷却 20），进入演绎状态；
 *   「演绎状态持续期间，切换至其他角色不会结束演绎状态并可自动生成交响诗·主音…默认自动生成绿色的主音」「主音为绿色时：对周围的目标造成气动伤害，并为命中的目标添加一层【风蚀效应】」
 *   「演绎状态下的合奏音影可触发音律独奏的气动伤害加成提升效果」「再次短按共鸣解放，或在切换至其他角色后再切换至夏空，可提前结束演绎状态」
 *   → 交响诗·主音 6.12%×20：按演绎时长均匀生成（估计 opts.perfDur 默认 16 秒，20 个主音；低）；每个主音 +1 层风蚀（绿色，默认）
 *   → action_frames「Improvised Symphonic Poem」37.33s 为整个演绎状态，非施放时长：施放动作按 2.0s 估计（低）
 * 共鸣回路 风与诗乐的交响 (1003407):「持有3格【音律】时，夏空的重击替换为重击·四拍重奏…消耗所有【音律】…为命中的目标添加一层【风蚀效应】。施放普攻第4段和变奏技能时，可获得1格【音律】。」
 * 变奏 携风吟游 (1003406): 189.11%，+1 风蚀，「施放后一定时间内短按普攻，将会施放第3段普攻」，+1 音律
 * 延奏 和声引风 (1003409):「队伍中登场角色周围的目标受到【风蚀效应】的伤害加深100%，持续30秒。」→ 模块光环 deep:anomaly:erosion 1.0（高）
 * 固有：黎那汐塔之风 四拍重奏 +30%（模块 scale）；幕间伴奏 护盾不建模
 * 共鸣链：1 普攻攻击 +35%（解析）；2 演绎期间队伍气动 +40%（模块光环）；3 第4段额外 +1 音律（谐律速奏 2 次：不建模，已标注）；4 四拍重奏/共鸣解放无视 45% 防御（模块）；5 共鸣解放 +40%（解析）；
 *   6 进入音律独奏时 220% 气动（视为共鸣解放伤害，模块：第4段后追加）
 * 专武 林间的咏叹调 (21030026)：「为目标添加【风蚀效应】后，自身气动伤害加成提升24%，持续10秒」（解析；anomaly 触发）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21030026;
  return WW.registerChar({
    id: 1407, chainModeled: 6, name: '夏空', version: '0.1', confidence: 'medium',
    notes: ['音律独奏光环持续时间估计 8 秒（低，opts.soloDur）', '演绎状态：主音 20 个按 16 秒均匀生成（低，opts.perfDur），每个附加 1 层风蚀（绿色）；施放动作 2.0s 估计',
      '延奏「风蚀效应伤害加深100%」以模块光环 deep:anomaly:erosion 提供', '链3 谐律速奏 2 次使用：不建模'],
    audit: { role: 'subdps', finishers: ['sqz', 'lib'], window: 25, sig: SIG, alts: [21030015, 21030045, 21030104], solo: 'ciaccona_solo.json', team: 'team_cartethyia_ciaccona.json', teamMi: 1, anomaly: 'erosion' },
    frames: {
      // 普攻 4 段映射到 WuwaLAB 条目；第 1/2/4 段核心因「两个来源不一致」不取帧 → 回落模块 0.3/1.05/1.5s（=WuwaLAB 值，中）；键名 n1..n4 避免继承通用帧
      n1: '普攻·Basic: Quadruple Time Steps 1', n2: '普攻·Basic: Quadruple Time Steps 2', n3: '普攻·Basic: Quadruple Time Steps 3', n4: '普攻·Basic: Quadruple Time Steps 4',
      hj: '重击·Heavy: Quadruple Time Steps', sqz: '重击·Heavy: Quadruple Downbeat', E: '共鸣技能·Skill: Harmonic Allegro', I: '变奏入场·Intro: Roaming with the Wind',
    },
    resources: [
      { key: 'yl', name: '音律', max: 3, segmented: true, confidence: 'high' },
      { key: 'solo', name: '音律独奏（秒）', max: 8, segmented: false, confidence: 'low', get: (cs, t) => +B.rem(cs.soloUntil, t).toFixed(2) },
      { key: 'perf', name: '演绎（秒）', max: 16, segmented: false, confidence: 'low', get: (cs, t) => +B.rem(cs.perfUntil, t).toFixed(2) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 4, prefix: 'n', durs: [0.3, 1.05, 0.7, 1.5] });
      Object.assign(K, {
        hj: H.act({ key: 'hj', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.7 }),
        sqz: H.act({ key: 'sqz', cls: 'H', skill: 6, labels: ['四拍重奏伤害'], levelKey: 'forte', concertoParam: '回复协奏能量', dur: 1.25, scale: { '*': 1.3 }, label: '重击·四拍重奏', inferred: '固有 黎那汐塔之风 +30%' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 10, cdKey: 'E', dur: 0.65 }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['即兴的交响诗伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, dur: 2.0 }),
        tonic: H.act({ key: 'tonic', cls: 'R', skill: 3, labels: ['交响诗·主音伤害'], levelKey: 'liberation', label: '交响诗·主音（自动）' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.9 }),
        O: B.outro(H, '和声引风'),
      });
      K.c6 = H.act({ key: 'c6', cls: 'R', skill: 3, hits: [Object.assign({}, K.lib.hits[0], { label: '链6 音律独奏', multiplier: K.lib.hits[0].multiplier.map(() => 2.2), count: 1 })], levelKey: 'liberation', label: '链6·音律独奏 220%' });
      return K;
    },
    fillerKeys: ['n1', 'n2', 'n3', 'n4'],
    init(api) { return { yl: 0, st: 0, soloUntil: null, perfUntil: null, perfStart: null, tonics: 0, oUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['n' + ((cs.st % 4) + 1)] };
        case 'H': return { act: cs.yl >= 3 ? K.sqz : K.hj };
        case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '谐律速奏冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      if (api.H.chain >= 4 && (act.key === 'sqz' || act.cls === 'R')) return [{ key: 'defIgnore', value: 0.45 }];
      return [];
    },
    auras(api, target) {
      const cs = api.cs, t = api.t, out = [];
      const perf = on(cs.perfUntil, t);
      if (on(cs.soloUntil, t) || perf) out.push({ key: 'dmg:aero', value: 0.24 });
      if (perf && api.H.chain >= 2) out.push({ key: 'dmg:aero', value: 0.4 });
      if (on(cs.oUntil, t)) out.push({ key: 'deep:anomaly:erosion', value: 1.0 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      const soloDur = api.H.opts.soloDur || 8;
      if (/^n\d$/.test(k)) {
        const n = +k.slice(1); cs.st = n % 4;
        if (n === 4) {
          api.addAnomaly('erosion', 1); cs.yl = Math.min(3, cs.yl + 1 + (ch >= 3 ? 1 : 0)); cs.soloUntil = te + soloDur;
          if (ch >= 6) api.deal(api.mem.modKit.c6, { coord: true });
        }
        return;
      }
      switch (k) {
        case 'E': api.addAnomaly('erosion', 1); cs.st = 1; break;
        case 'sqz': api.addAnomaly('erosion', 1); cs.yl = 0; cs.st = 0; break;
        case 'I': api.addAnomaly('erosion', 1); cs.yl = Math.min(3, cs.yl + 1); cs.st = 2; break;
        case 'lib': cs.perfStart = te; cs.perfUntil = te + (api.H.opts.perfDur || 16); cs.tonics = 0; cs.st = 0; break;
        default: cs.st = 0; break;
      }
    },
    onOutro(api) { api.cs.oUntil = api.t + 30; },
    swapOut(api) { const cs = api.cs; if (cs.soloUntil != null && on(cs.soloUntil, api.t)) { /* 被动打断 → 合奏音影代替继续独奏（光环保持） */ } },
    onTeam(api, ev) {
      const cs = api.cs, me = api.mi;
      if (cs.perfUntil == null) return;
      // 「在切换至其他角色后再切换至夏空，可提前结束演绎状态」
      if ((ev.type === 'swap' || ev.type === 'intro') && ev.mi === me && on(cs.perfUntil, ev.t || api.t) && api.s.active === me && (ev.t || api.t) > cs.perfStart + 0.3) { this.tick(api, ev.t || api.t); cs.perfUntil = ev.t || api.t; return; }
      if (ev.type !== 'damage' || ev.coord) return;
      this.tick(api, Math.min((ev.t || 0) + (ev.dur || 0), api.ctx.duration));
    },
    tick(api, tt) {
      const cs = api.cs, dur = api.H.opts.perfDur || 16;
      const end = Math.min(tt, cs.perfUntil);
      const due = Math.min(20, Math.floor(Math.max(0, end - cs.perfStart) / dur * 20 + 1e-9));
      const n = due - cs.tonics;
      if (n > 0) { cs.tonics = due; api.deal(api.mem.modKit.tonic, { count: n / 20, coord: true }); api.addAnomaly('erosion', n); }
    },
    // search heuristic (not a game rule): 音律 → 四拍重奏
    potential(api) { const cs = api.cs, K = api.mem.modKit; return cs.yl / 3 * 0.4 * api.est(K.sqz) + (on(cs.perfUntil, api.t) ? (20 - cs.tonics) / 20 * 0.6 * api.est(K.tonic) : 0); },
  });
});
