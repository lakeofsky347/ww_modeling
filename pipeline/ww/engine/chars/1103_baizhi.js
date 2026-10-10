/*
 * 白芷 (1103) character module — stream A 批次 4。冷凝 音感仪，治疗辅助。
 *
 * 普攻 4 段（命中 +1 念意，上限 4）；重击 48.86%：消耗全部念意（+4 协奏 / +2.5 能量，按总量记，低）；
 * 共鸣技能 应急预案（冷却 16）15.94% 生命：消耗念意 +8 协奏（总量，低）；留下 天籁 15 s → 下一位登场角色（或白芷自身）攻击 +15% 20 s；
 * 共鸣解放 刹那合弥（175 能量，冷却 25）：4 段 频隙回响（链4 +2），每 2.5 s 协同攻击 4.07% 生命 冷凝（在场角色造成伤害时结算）；
 * 变奏 覆雪流盈 79.53%；延奏 命源输送：下一位登场角色每 3 s 受治疗 → 全伤害加深 15%（持续 6 s，30 s 内反复刷新 → 视为 30 s）。
 * 链：1 应急预案每消耗 1 念意 +2.5 能量；2 4 念意时 冷凝 +15% 12 s；6 天籁 → 全队 冷凝 +12% 20 s；3/4/5 治疗/生存 → 未建模（链4 频隙回响 +2 段建模）。chainModeled 6（3/5 不影响输出）。
 * 动作帧：WuwaLAB（Baizhi）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  return WW.registerChar({
    id: 1103, chainModeled: 6, name: '白芷', version: '0.1', confidence: 'medium',
    notes: ['念意 额外协奏/能量 按总量（非每点）记（低）', '天籁 由下一位登场角色拾取（中）', '链4 频隙回响额外 1.2% 生命 伤害未建模（极小）'],
    audit: { role: 'support', finishers: ['R', 'E'], window: 25, sig: null, solo: 'baizhi_solo.json', team: 'team_baizhi.json', teamMi: 2 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Destined Promise'), { a2: null, a4: null }, {
      h: '重击·Heavy: Destined Promise', E: '共鸣技能·Skill: Emergency Plan', R: '共鸣解放·Liberation: Momentary Union', echo: null, I: '变奏入场·Intro: Overflowing Frost',
    }),
    resources: [{ key: 'nian', name: '念意', max: 4, segmented: true, confidence: 'high' }, { key: 'echoes', name: '频隙回响', max: 6, segmented: true, confidence: 'high' }],
    kit(H) {
      const lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '', labels: ['第一段伤害', '第二段伤害', '第三段伤害', '第四段伤害'], durs: [0.5, 0.72, 0.7, 0.75] }), {
        h: H.act({ key: 'h', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.1, label: '重击' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 16, cdKey: 'E', dur: 0.95, label: '应急预案' }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 2.2, label: '刹那合弥' }),
        echo: H.act({ key: 'echo', cls: 'R', skill: 3, labels: ['频隙回响伤害'], levelKey: 'liberation', label: '频隙回响' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.63, label: '覆雪流盈' }),
        O: B.outro(H, '命源输送'),
      });
      H.patchBuff((b) => b.kind === 'inherent' && /天籁/.test(b.text || ''), { mode: 'off' }, '模块：天籁 由拾取者获得');
      H.buff({ id: 'tl', name: '天籁·攻击', stats: [{ key: 'atkPct', value: 0.15 }], duration: 20, trigger: { on: 'manual' }, mode: 'module', text: '拾取天籁的角色攻击提升15%，持续20秒' });
      H.patchBuff((b) => b.kind === 'outro' && b.stats.some((x) => x.key === 'deep:all'), { target: 'incoming', duration: 30 }, '模块：命源输送 每 3 s 治疗刷新 6 s 加深，30 s 内常驻');
      if (H.chain >= 2) { B.patch(H, /沉默的冰原/, { mode: 'off' }, '模块：4 念意时触发', 'chain'); H.buff({ id: 'c2', name: '链2·冷凝', stats: [{ key: 'dmg:glacio', value: 0.15 }], duration: 12, trigger: { on: 'manual' }, mode: 'module', text: '链2' }); }
      if (H.chain >= 6) { B.patch(H, /闻道者的觉悟/, { mode: 'off' }, '模块：拾取天籁时', 'chain'); H.buff({ id: 'c6', name: '链6·全队冷凝', stats: [{ key: 'dmg:glacio', value: 0.12 }], duration: 20, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链6' }); }
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { st: 0, nian: 0, echoes: 0, echoNext: null, tl: null }; },
    tickEcho(api, t) {
      const cs = api.cs;
      while (cs.echoes > 0 && cs.echoNext != null && cs.echoNext <= t + 1e-9) { api.deal(api.mem.modKit.echo, { t: cs.echoNext }); cs.echoes--; cs.echoNext += 2.5; }
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: K.h };
        case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.R };
        default: return B.common(api, btn);
      }
    },
    pickup(api, j, t) {
      const cs = api.cs; if (!on(cs.tl, t)) return; cs.tl = null;
      api.fireBuff('tl', j, { t });
      if (api.H.chain >= 6) for (let k = 0; k < api.teamSize; k++) api.fireBuff('c6', k, { t });
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      this.tickEcho(api, te);
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; cs.nian = Math.min(4, cs.nian + 1); return; }
      cs.st = 0;
      switch (k) {
        case 'h': if (cs.nian > 0) { api.addConcerto(api.mi, 4); api.addEnergy(api.mi, 2.5); cs.nian = 0; } break;
        case 'E':
          if (ch >= 2 && cs.nian >= 4) api.fireBuff('c2', api.mi, { t: te });
          if (cs.nian > 0) { api.addConcerto(api.mi, 8); if (ch >= 1) api.addEnergy(api.mi, 2.5 * cs.nian); cs.nian = 0; }
          cs.tl = te + 15;
          break;
        case 'R': cs.echoes = ch >= 4 ? 6 : 4; cs.echoNext = te + 2.5; break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type === 'swap' && ev.mi != null) this.pickup(api, ev.mi, ev.t);
      if (ev.type === 'damage') this.tickEcho(api, ev.t + (ev.dur || 0));
    },
    onOutro(api) { const cs = api.cs; if (on(cs.tl, api.t)) { /* 下一位登场角色拾取：在 swap 事件处理 */ } },
    potential(api) { const cs = api.cs; return cs.echoes * api.est(api.mem.modKit.echo); },
  });
});
