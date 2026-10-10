/*
 * 安可 (1203) character module — stream A 批次 4。热熔 音感仪，主C（常驻 5★）。
 *
 * 普攻 羊咩出击 (1000701)：普攻 4 段，第 4 段后短按 → 咩咩（238.57%）；重击 187.08%。空中/闪避反击 不建模。
 * 共鸣技能 热力羊咩 (1000702)：76.61%×8，冷却 10，协奏 15；之后一定时间内 → 热情欢迎式（339.16%，协奏 5）。窗口按 5 s（引擎假设）。
 * 共鸣解放 黑咩大暴走 (1000703)：10 s，普攻 → 黑咩·胡闹 4 段（普攻伤害），重击 → 黑咩·重击，技能 → 黑咩·狂热（冷却 4）。125 能量，冷却 16。
 * 回路 黑白羊咩 (1000707)：【失序值】满时重击 → 白咩·失控之炎（334%，解放伤害）；暴走期间 → 黑咩·暴走之炎（46.42%×6 + 495.21%，解放伤害）。
 *   失序状态时长未给出 → 按帧数据整段动作（Cloudy Frenzy 3.37 s / Cosmos Rupture 3.98 s）；「切换角色不会中断失序状态」→ 重击出手 0.93 s 后即可切人（cancel）。
 *   【失序值】获取量数据未给出 → 估计 普攻 8/8/12/14、咩咩 15、热力羊咩 20、热情欢迎式 15、变奏 15；暴走期间 胡闹 12/12/15/20、黑咩·重击 10、狂热 15（低，按 Prydwen 循环每轮 1 次白咩 + 1 次黑咩校准）。
 * 固有 生气的黑咩：暴走期间生命 >70% 伤害 +10%（木桩：满血，模块）；咩咩加油歌：热力羊咩/狂热后 热熔 +10% 10 s（模块）。
 * 延奏 热场：地炎 176.76% 每 1.5 s，6 s（4 跳，延奏后按协同伤害结算）。
 * 链：1 普攻命中 热熔 +3%×4（输出期间常驻满层，中）；2 咩咩/热情欢迎式 +10 能量（10 s 1 次）；3 失控/暴走之炎 倍率 +40%；4 暴走之炎后 全队热熔 +20% 30 s；
 *     5 共鸣技能伤害 +35%（解析）；6 暴走期间每次伤害 攻击 +5%×5（按满层计，中）。chainModeled 6。
 * 动作帧：WuwaLAB（Encore）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const G = { a1: 8, a2: 8, a3: 12, a4: 14, baa: 15, E: 20, E2: 15, I: 15, f1: 12, f2: 12, f3: 15, f4: 20, fh: 10, fe: 15 };
  return WW.registerChar({
    id: 1203, chainModeled: 6, name: '安可', version: '0.1', confidence: 'medium',
    notes: ['【失序值】获取量为估计（低）', '热情欢迎式窗口 5 s（引擎假设）', '失序状态按整段动作时长计（帧数据）', '生气的黑咩按满血常开（木桩）', '延奏 地炎 4 跳'],
    audit: { role: 'dps', finishers: ['white', 'black', 'lib'], window: 30, sig: null, alts: [21050015, 21050016, 21050045], solo: 'encore_solo.json', team: 'team_encore.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Wooly Attack'), B.stageFrames('f', 4, '普攻·Basic: Frolicking'), {
      baa: '普攻·Basic: Wooly Strike', hv: '重击·Heavy: Wooly Attack', fh: '重击·Heavy: Frolicking',
      E: '共鸣技能·Skill 1: Flaming Woolies', E2: '共鸣技能·Skill 2: Energetic Welcome', fe: '共鸣技能·Skill 3: Rampage',
      lib: '共鸣解放·Liberation: Cosmos Rave', white: '共鸣回路·Forte: Cloudy Frenzy', black: '共鸣回路·Forte: Cosmos Rupture', I: '变奏入场·Intro: Woolies Helpers',
    }),
    resources: [
      { key: 'dis', name: '失序值', max: 100, segmented: false, confidence: 'low' },
      { key: 'rave', name: '黑咩大暴走', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.rave, t) ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const c3 = ch >= 3 ? { scale: { '*': 1.4 }, inferred: '链3：倍率 +40%' } : {};
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.3, 0.37, 0.75, 0.77] }),
        B.stages(H, { n: 4, prefix: 'f', skill: 3, levelKey: 'liberation', pre: '黑咩·胡闹', durs: [0.48, 0.72, 0.78, 1.83] }), {
          baa: H.act({ key: 'baa', cls: 'A', skill: 1, labels: ['咩咩伤害'], levelKey: 'basic', dur: 1.27, label: '咩咩' }),
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.93, label: '重击' }),
          fh: H.act({ key: 'fh', cls: 'H', skill: 3, labels: ['黑咩·重击伤害'], levelKey: 'liberation', dur: 0.73, label: '黑咩·重击' }),
          E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['热力羊咩伤害'], levelKey: 'skill', concertoParam: '热力羊咩回复协奏能量', cooldown: 10, cdKey: 'E', dur: 1.83, label: '热力羊咩' }),
          E2: H.act({ key: 'E2', cls: 'E', skill: 2, labels: ['热情欢迎式伤害'], levelKey: 'skill', concertoParam: '热情欢迎式回复协奏能量', dur: 0.8, label: '热情欢迎式' }),
          fe: H.act({ key: 'fe', cls: 'E', skill: 3, labels: ['黑咩·狂热伤害'], levelKey: 'liberation', cooldown: 4, cdKey: 'fe', dur: 0.78, label: '黑咩·狂热' }),
          white: H.act(Object.assign({ key: 'white', cls: 'H', skill: 6, labels: ['白咩·失控之炎伤害'], levelKey: 'forte', concertoParam: '白咩·失控之炎回复协奏能量', dur: 3.37, label: '白咩·失控之炎' }, c3)),
          black: H.act(Object.assign({ key: 'black', cls: 'H', skill: 6, labels: ['黑咩·暴走之炎伤害'], levelKey: 'forte', concertoParam: '黑咩·暴走之炎回复协奏能量', dur: 3.98, label: '黑咩·暴走之炎' }, c3)),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 16, cdKey: 'R', dur: 2.33, label: '黑咩大暴走' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.33, label: '咩咩帮手' }),
          O: B.outro(H, '热场'),
        });
      // 黑咩·胡闹 是普攻伤害（命中行 type 已是 basic）
      H.buff({ id: 'cheer', name: '咩咩加油歌·热熔', stats: [{ key: 'dmg:fusion', value: 0.1 }], duration: 10, trigger: { on: 'act', keys: ['E', 'fe'] }, text: '施放热力羊咩或黑咩·狂热时 热熔伤害加成提升10%，持续10秒', confidence: 'high' });
      if (ch >= 4) H.buff({ id: 'c4', name: '链4·全队热熔', stats: [{ key: 'dmg:fusion', value: 0.2 }], duration: 30, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链4' });
      B.patch(H, /咩咩加油歌|生气的黑咩/, { mode: 'off' }, '模块处理', 'inherent');
      B.patch(H, /冒险？好有趣！|羊咩，拯救世界|羊咩的童话书/, { mode: 'off' }, '模块处理', 'chain');
      if (ch >= 1) B.onHitAlways(H, /羊咩的童话书/, 'chain');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { dis: st.dis || 0, st: 0, fst: 0, baaOk: false, e2Until: null, rave: null, c2: -99, heat: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, rave = on(cs.rave, t);
      switch (btn) {
        case 'A':
          if (rave) return { act: K['f' + ((cs.fst % 4) + 1)] };
          if (cs.baaOk) return { act: K.baa };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H':
          if (cs.dis >= 100 - 1e-9) return { act: this.offField(api, rave ? K.black : K.white) };
          return { act: rave ? K.fh : K.hv };
        case 'E':
          if (rave) return api.cdReady('fe') ? { act: K.fe } : { blocked: '狂热冷却中' };
          if (on(cs.e2Until, t)) return { act: K.E2 };
          return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    /** 失序状态：切换角色不会中断 → 按重击出手（≈0.93 s）后即可切人（cancel），伤害仍按整段结算（中） */
    offField(api, act) {
      const mem = api.mem; mem._off = mem._off || {};
      if (!mem._off[act.key]) mem._off[act.key] = Object.assign({}, act, { cancel: Math.min(act.duration, 0.93), noSwap: 0, inferred: '失序状态切人不中断：重击出手后可切人（中）' });
      return mem._off[act.key];
    },
    actionStats(api, act) {
      const out = [];
      if (on(api.cs.rave, api.t)) { out.push({ key: 'dmg:all', value: 0.1 }); if (api.H.chain >= 6) out.push({ key: 'atkPct', value: 0.25 }); }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      const gain = (v) => { cs.dis = Math.min(100, cs.dis + v); };
      if (G[k] != null) gain(G[k]);
      cs.baaOk = false;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; if (k === 'a4') cs.baaOk = true; return; }
      if (/^f\d$/.test(k)) { cs.fst = +k.slice(1) % 4; return; }
      cs.st = 0; cs.fst = 0;
      if ((k === 'baa' || k === 'E2') && ch >= 2 && api.t - cs.c2 >= 10) { cs.c2 = api.t; api.addEnergy(api.mi, 10); }
      switch (k) {
        case 'E': cs.e2Until = te + 5; break;
        case 'E2': cs.e2Until = null; break;
        case 'lib': cs.rave = te + 10; break;
        case 'white': case 'black':
          cs.dis = 0;
          if (k === 'black' && ch >= 4) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c4', j, { t: te });
          break;
        default: break;
      }
    },
    onOutro(api) {
      // 延奏 热场：地炎每 1.5 s 一跳，6 s → 4 跳（协同）
      const O = api.mem.modKit.O; if (O && O.hits && O.hits.length) api.deal(O, { count: 3, t: api.t + 1.5, coordAttack: false });
    },
    hold(api, act, rem) {
      // 公开轴（Prydwen/Game8）：黑咩大暴走内 失序满 100 即 重击→黑咩·暴走之炎 后切人；search only
      const cs = api.cs;
      if (on(cs.rave, api.t) && cs.dis >= 100 - 1e-9 && /^(f\d|fh|fe)$/.test(act.key)) return '失序已满，先放黑咩';
      return null;
    },
    potential(api) { const K = api.mem.modKit; return 0.5 * (api.cs.dis / 100) * api.est(on(api.cs.rave, api.t) ? K.black : K.white); },
  });
});
