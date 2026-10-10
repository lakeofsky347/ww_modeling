/*
 * 莫特斐 (1204) character module — stream A 批次 4。热熔 佩枪，辅助（协同 加强音、延奏 重击 +38% 加深）。
 *
 * 普攻 即兴发挥 (1001201)：4 段；瞄准完全蓄力 167.01%。空中/闪避反击 不建模。
 * 共鸣技能 激昂变奏 (1001202)：208.76%，冷却 14，协奏 18。【怒气值】100 时 → 怒火赋格（326.05%，共鸣技能伤害，协奏 18）。
 *   固有 密接和应：激昂变奏后 8 s 内 怒火赋格 +25%（模块）。
 *   【怒气值】获取量数据未给出 → 估计 普攻 8/10/12/15、蓄力 10、技能 20、变奏 20；激昂变奏后 5 s 内普攻 ×1.5（低）。
 * 共鸣解放 暴烈终曲 (1001203)：159.05%，125 能量，冷却 20；浮翼狂想 10 s（全队）：登场角色普攻命中 → 1 发加强音，重击命中 → 2 发（31.81%，解放伤害），
 *   协同每 0.35 s 至多 1 次。实现：队友每个普攻/重击动作，发数 = min(命中段数 × 1|2, ⌊动作时长/0.35⌋+1)（中）。
 *   固有 节奏自由：每发 +1.5%（上限 50 层），浮翼狂想结束时清零 → 按发数累计。
 * 链：1 浮翼狂想期间 登场角色放技能 → 2 发；2 声骸技能 +10 能量（20 s）；3 加强音 暴伤 +30%；4 浮翼狂想 +7 s；5 激昂变奏/怒火赋格 +4 发（伤害 −50%）；
 *     6 解放后 全队攻击 +20% 20 s。chainModeled 6。
 * 动作帧：WuwaLAB（Mortefi）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const G = { a1: 8, a2: 10, a3: 12, a4: 15, hv: 10, E: 20, I: 20 };
  const ICD = 0.35;
  return WW.registerChar({
    id: 1204, chainModeled: 6, name: '莫特斐', version: '0.1', confidence: 'medium',
    notes: ['【怒气值】获取量为估计（低）', '加强音发数：命中段数 ×1（普攻）/×2（重击），受 0.35 s 间隔限制（中）', '节奏自由叠层按加强音发数累计'],
    audit: { role: 'support', finishers: ['fugue', 'lib'], window: 25, sig: null, alts: [21030015, 21030016, 21030045], solo: 'mortefi_solo.json', team: 'team_mortefi.json', teamMi: 1 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Impromptu Show'), {
      hv: null, E: '共鸣技能·Skill 1: Passionate Variation', fugue: '共鸣技能·Skill 2: Fury Fugue', lib: '共鸣解放·Liberation: Violent Finale', I: '变奏入场·Intro: Dissonance',
    }),
    resources: [
      { key: 'rage', name: '怒气值', max: 100, segmented: false, confidence: 'low' },
      { key: 'wing', name: '浮翼狂想', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.wing, t) ? 1 : 0) },
      { key: 'fs', name: '节奏自由', max: 50, segmented: false, confidence: 'high', get: (cs, t) => (on(cs.wing, t) ? cs.fs : 0) },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.35, 0.58, 0.67, 1.52] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['瞄准完全蓄力伤害'], levelKey: 'basic', dur: 1.5, label: '瞄准完全蓄力' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 14, cdKey: 'E', dur: 0.77, label: '激昂变奏' }),
        fugue: H.act({ key: 'fugue', cls: 'E', skill: 6, labels: ['怒火赋格伤害'], levelKey: 'forte', concertoParam: '怒火赋格回复协奏能量', dur: 1.12, label: '怒火赋格' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['暴烈终曲伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 20, cdKey: 'R', dur: 2.0, label: '暴烈终曲' }),
        marc: H.act({ key: 'marc', cls: 'R', skill: 3, labels: ['加强音伤害'], levelKey: 'liberation', label: '加强音（协同）' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.5, label: '不协和音' }),
        O: B.outro(H, '怒意移调'),
      });
      if (ch >= 6) H.buff({ id: 'c6', name: '链6·全队攻击', stats: [{ key: 'atkPct', value: 0.2 }], duration: 20, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链6' });
      B.patch(H, /密接和应|节奏自由/, { mode: 'off' }, '模块处理', 'inherent');
      B.patch(H, /预热的宣叙调|盛怒的无言歌/, { mode: 'off' }, '模块处理', 'chain');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { rage: st.rage || 0, st: 0, eAt: -99, wing: null, fs: 0, lastM: -9, c2: -99 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: K.hv };
        case 'E': if (cs.rage >= 100 - 1e-9) return { act: K.fugue }; return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      if (act.key === 'fugue' && api.t - api.cs.eAt <= 8) return [{ key: 'dmg:skill', value: 0.25 }];
      return [];
    },
    /** n 发加强音（节奏自由 按发数逐发 +1.5%，上限 50 层） */
    marcato(api, n, t, mult) {
      const cs = api.cs, ch = api.H.chain;
      if (n <= 0) return;
      const avg = Math.min(50, cs.fs + (n - 1) / 2) * 0.015;
      const st = [{ key: 'dmg:liberation', value: avg }];
      if (ch >= 3) st.push({ key: 'critDmg', value: 0.3 });
      if (mult) st.push({ key: 'dmg:all', value: mult - 1 });
      api.deal(api.mem.modKit.marc, { count: n, stats: st, t });
      cs.fs = Math.min(50, cs.fs + n);
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      const gain = (v) => { cs.rage = Math.min(100, cs.rage + v); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; gain(G[k] * (api.t - cs.eAt <= 5 ? 1.5 : 1)); return; }
      cs.st = 0;
      switch (k) {
        case 'hv': gain(G.hv); break;
        case 'I': gain(G.I); break;
        case 'E': gain(G.E); cs.eAt = te; if (ch >= 5) this.marcato(api, 4, te, 0.5); break;
        case 'fugue': cs.rage = 0; if (ch >= 5) this.marcato(api, 4, te, 0.5); break;
        case 'lib':
          cs.wing = te + 10 + (ch >= 4 ? 7 : 0); cs.fs = 0;
          if (ch >= 6) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c6', j, { t: te });
          break;
        default: break;
      }
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'echoCast' && ev.mi === api.mi && api.H.chain >= 2 && ev.t - cs.c2 >= 20) { cs.c2 = ev.t; api.addEnergy(api.mi, 10); }
      if (ev.type !== 'damage' || ev.coord || !on(cs.wing, ev.t) || !ev.act || ev.mi !== api.active) return;
      if (ev.act.key === 'marc') return;
      const cls = ev.act.cls;
      let per = cls === 'A' ? 1 : cls === 'H' ? 2 : (cls === 'E' && api.H.chain >= 1) ? 2 : 0;
      if (!per) return;
      const hits = cls === 'E' ? 1 : (ev.act.hits || []).reduce((s, h) => s + (h.calc === 'heal' ? 0 : (h.count || 1)), 0) || 1;
      const t0 = Math.max(ev.t, cs.lastM + ICD);
      const room = Math.max(0, Math.floor(((ev.t + (ev.dur || 0)) - t0) / ICD + 1e-9) + 1);
      const n = Math.min(hits * per, room * (cls === 'A' ? 1 : 2));
      if (n <= 0) return;
      cs.lastM = t0 + (Math.ceil(n / (cls === 'A' ? 1 : 2)) - 1) * ICD;
      this.marcato(api, n, t0);
    },
    potential(api) { const K = api.mem.modKit; return 0.5 * (api.cs.rage / 100) * api.est(K.fugue); },
  });
});
