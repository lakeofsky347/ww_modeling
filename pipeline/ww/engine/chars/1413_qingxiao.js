/*
 * 清宵 (1413) character module — worker-B.
 *
 * 普攻 化弦为剑 (1005801):「普攻·弦剑…4段…第1段、第4段为藏剑式；第2段、第3段为执剑式。重击·弦剑：【琴心】与【剑韵】充满时解锁…消耗所有【琴心】、【剑韵】，进入昙体仙身状态」
 * 共鸣技能 浮声一刹 (1005802):「行罚：…获得45点【琴心】（冷却 20）…之后按下普攻 → 普攻·弦剑第4段。凌霄：施放普攻·弦剑第2段、第3段…期间，共鸣技能替换为浮声一刹·凌霄（执剑式）」
 * 共鸣解放 天光云影沧澜兴 (1005803): 33.41%×10+1336.01%；获得 天心空明
 * 变奏 改韵易调 (1005806):「获得30点【剑韵】，并获得金声玉振（下次 行罚 额外 +30 琴心）」
 * 共鸣回路 无相心剑 (1005807):
 *   「昙体仙身：普攻·昙体仙身 4 段；重击·天钧荡煞解锁前，该技能伤害倍率提升100%。【心剑意】充满时 → 重击·天钧荡煞·昙体仙身（消耗所有心剑意，退出昙体仙身；回复协奏 25）」
 *   「心识锁定（上限15）：目标每拥有1层…受到清宵以下技能伤害加深2%，前7层每层额外加深5%（重击·弦剑、普攻/闪避反击·昙体仙身、天钧荡煞、共鸣解放）」
 *   「天心空明：进入战斗或施放共鸣解放时获得。藏剑式/执剑式造成伤害时，获得【琴心】/【剑韵】效率提升100%。施放重击·弦剑时，对附近的目标附加3层心识锁定，
 *    使自身下一次重击·天钧荡煞获得强化：伤害倍率提升100%…施放天钧荡煞后移除天心空明」
 *   「琴心/剑韵 上限100，藏剑式/执剑式造成伤害时获得；昙体仙身时无法获得。心剑意：普攻·昙体仙身造成伤害时获得」
 *   → 每次获得量未公开：估计 琴心 第1段 10 / 第4段 15，剑韵 第2段 10 / 第3段 15 / 凌霄 15，心剑意 每段 25（低）
 * 固有 通晓万物：「以下技能对拥有心识锁定的目标造成伤害提升，每层提升2%，前7层每层额外提升5%」（模块：同一组技能 dmg 加成）
 * 固有 识海浩渺：进入战斗时 1 层【凝识】→ 队伍伤害给目标附加 1 层心识锁定（模块：开场 1 层）；其余心识锁定来源（集谐·干涉）未建模（B4）
 * 延奏 弦歌不绝：800%
 * 共鸣链：1 暴击 +16%；2 重击·弦剑 +40%、心识锁定附加 6 层；5 行罚 +100%（模块）；其余未建模
 * 专武 云琅 (21020106)：「附加集谐偏移后，气动伤害加成提升11.2%，持续2秒，最多叠加5层，每0.5秒可触发1次；效果持续期间气动伤害无视10%防御」
 *   → 清宵每次技能伤害都附加集谐·偏移，连续输出时按 4 层常驻（中）+ 无视防御常驻
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21020106;
  const QX = { a1: 10, a4: 15 }, JY = { a2: 10, a3: 15, lx: 15 }, XJY = 25;
  const LOCKED = ['xj', 't1', 't2', 't3', 't4', 'tj', 'lib'];
  const lockPct = (n) => 0.02 * n + 0.05 * Math.min(7, n);
  const scale = (a, m, key, label) => Object.assign({}, a, { key, label: label || a.label, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1413, chainModeled: 5, name: '清宵', version: '0.1', confidence: 'medium',
    notes: ['琴心/剑韵/心剑意 每次获得量为估计（低）', '心识锁定只计 开场凝识 1 层 + 重击·弦剑 3 层；集谐·干涉 来源未建模（B4）', '御剑飞行/空中连段未建模', '云琅 偏移层按 4 层常驻（中）'],
    audit: { role: 'dps', finishers: ['xj', 'tj', 'lib'], window: 25, sig: SIG, alts: [21020015, 21020045, 21020064], solo: 'qingxiao_solo.json', team: 'team_qingxiao.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Stringblade'), B.stageFrames('t', 4, '共鸣回路·Basic: Ephemeral Transcendence'), {
      xj: '重击·Heavy: Stringblade', xf: '共鸣技能·Skill 1: Severing Note - Judgement', lx: '共鸣技能·Skill 2: Severing Note - Ascendant',
      tj: '共鸣回路·Forte: Heaven\'s Reckoning - Ephemeral Transcendence', lib: '共鸣解放·Liberation: Billows Beneath Heaven', I: '变奏入场·Intro: Tonality Shift',
    }),
    resources: [
      { key: 'qx', name: '琴心', max: 100, segmented: false, confidence: 'low' },
      { key: 'jy', name: '剑韵', max: 100, segmented: false, confidence: 'low' },
      { key: 'xjy', name: '心剑意', max: 100, segmented: false, confidence: 'low' },
      { key: 'tt', name: '昙体仙身', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.tt ? 1 : 0) },
      { key: 'sl', name: '心识锁定（目标）', max: 15, segmented: true, confidence: 'medium' },
    ],
    kit(H) {
      const ch = H.chain;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '普攻·弦剑', durs: [0.48, 0.62, 0.8, 0.87] }),
        B.stages(H, { n: 4, prefix: 't', skill: 6, levelKey: 'forte', pre: '普攻·昙体仙身', durs: [0.67, 0.97, 0.95, 1.45] }), {
          xj: H.act({ key: 'xj', cls: 'H', skill: 1, labels: ['重击·弦剑伤害'], levelKey: 'basic', dur: 2.28, label: '重击·弦剑' }),
          xf: H.act({ key: 'xf', cls: 'E', skill: 2, labels: ['浮声一刹·行罚伤害'], levelKey: 'skill', cooldown: 20, dur: 1.35, label: '浮声一刹·行罚' }),
          lx: H.act({ key: 'lx', cls: 'E', skill: 2, labels: ['浮声一刹·凌霄伤害'], levelKey: 'skill', dur: 1.07, label: '浮声一刹·凌霄' }),
          tj: H.act({ key: 'tj', cls: 'H', skill: 6, labels: ['天钧荡煞·昙体仙身伤害'], levelKey: 'forte', concertoParam: '天钧荡煞·昙体仙身回复协奏能量', dur: 3, label: '重击·天钧荡煞·昙体仙身' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 5, label: '天光云影沧澜兴' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.07 }),
          O: B.outro(H, '弦歌不绝'),
        });
      for (let n = 1; n <= 4; n++) K['t' + n + 'x'] = scale(K['t' + n], 2, 't' + n, K['t' + n].label + '（天钧荡煞解锁前 ×2）');
      K.tjE = scale(K.tj, 2, 'tj', K.tj.label + '（天心空明强化）');
      if (ch >= 2) K.xj = scale(K.xj, 1.4, 'xj');
      if (ch >= 5) K.xf = scale(K.xf, 2, 'xf');
      if (H.weaponId === SIG) {
        B.patch(H, /附加集谐偏移后，获得气动伤害加成提升11.2%/, (b) => ({ trigger: { on: 'always' }, mode: 'on', stats: b.stats.map((x) => ({ key: x.key, value: x.value * 4 })), maxStacks: 1 }), '模块：每次技能伤害都附加集谐·偏移，连续输出按 4 层常驻（中）', 'weapon');
        B.patch(H, /气动伤害无视目标10%的防御/, { trigger: { on: 'always' }, mode: 'on' }, '模块：常驻（中）', 'weapon');
      }
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { qx: st.qx || 0, jy: st.jy || 0, xjy: 0, tt: false, tx: true, txEnh: false, sl: st.sl != null ? st.sl : 1, st: 0, tst: 0, nextA: null, lxOk: false, jsyz: false }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.tt) { const n = (cs.tst % 4) + 1; return { act: cs.xjy >= 100 - 1e-9 ? K['t' + n] : K['t' + n + 'x'] }; }
          if (cs.nextA) return { act: K[cs.nextA] };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H':
          if (cs.tt) return cs.xjy >= 100 - 1e-9 ? { act: cs.txEnh ? K.tjE : K.tj } : { blocked: '心剑意未满' };
          return cs.qx >= 100 - 1e-9 && cs.jy >= 100 - 1e-9 ? { act: K.xj } : { blocked: '琴心/剑韵未满' };
        case 'E':
          if (cs.lxOk && !cs.tt) return { act: K.lx };
          return api.cdReady('xf') ? { act: K.xf } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, out = [];
      if (LOCKED.includes(act.key) && cs.sl > 0) { out.push({ key: 'deep:all', value: lockPct(cs.sl) }); out.push({ key: 'dmg:all', value: lockPct(cs.sl) }); }
      if (api.H.chain >= 1) out.push({ key: 'critRate', value: 0.16 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      const m = cs.tx ? 2 : 1;
      const addQ = (n) => { if (!cs.tt) cs.qx = Math.min(100, cs.qx + n * m); };
      const addJ = (n) => { if (!cs.tt) cs.jy = Math.min(100, cs.jy + n * m); };
      cs.nextA = null; cs.lxOk = false;
      if (/^a\d$/.test(k)) {
        const n = +k.slice(1); cs.st = n % 4;
        if (n === 1 || n === 4) addQ(QX[k]); else { addJ(JY[k]); cs.lxOk = true; }
        return;
      }
      if (/^t\d$/.test(k)) { cs.tst = +k.slice(1) % 4; cs.xjy = Math.min(100, cs.xjy + XJY); return; }
      switch (k) {
        case 'xj': cs.qx = 0; cs.jy = 0; cs.tt = true; cs.tst = 0; cs.xjy = 0; cs.sl = Math.min(api.H.chain >= 2 ? 25 : 15, cs.sl + (api.H.chain >= 2 ? 6 : 3)); if (cs.tx) cs.txEnh = true; break;
        case 'tj': cs.tt = false; cs.xjy = 0; cs.tx = false; cs.txEnh = false; cs.st = 0; break;
        case 'xf': addQ(45); if (cs.jsyz) { cs.qx = Math.min(100, cs.qx + 30); cs.jsyz = false; } cs.nextA = 'a4'; break;
        case 'lx': addJ(JY.lx); break;
        case 'lib': cs.tx = true; break;
        case 'I': cs.jy = Math.min(100, cs.jy + 30); cs.jsyz = true; break;
        default: break;
      }
    },
    swapOut(api) { api.cs.txEnh = false; },
    // search heuristic (not a game rule): 琴心/剑韵 → 重击·弦剑 → 昙体仙身 → 天钧荡煞
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (cs.tt) return (cs.xjy / 100) * 0.7 * api.est(cs.txEnh ? K.tjE : K.tj) + 0.3 * api.est(K.tj);
      return Math.min(cs.qx, cs.jy) / 100 * 0.6 * (api.est(K.xj) + api.est(K.tj));
    },
  });
});
