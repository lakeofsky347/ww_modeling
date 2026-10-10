/*
 * 穗穗 (1110) character module — stream A 批次 4。冷凝 音感仪，治疗辅助（延奏 全队全伤害加深 25%；山河水境 异常层数上限 +3）。
 *
 * 浣尘时（初始）：普攻 w1–w4（+水云息）；E·浣尘时 23.86%×6（冷却 6，与濯雨时共享，+40 水云息）；水云息 120 → E：醒春潮（生命 28.63%，冷却 15，1 层霜渐）→ 濯雨时 15 s。
 * 变奏 泠泠漱玉声（生命 28.63%，1 层霜渐，消耗水云息 → 濯雨时）。固有 近水纳天光：醒春潮/变奏 命中 +18 协奏 +13 能量、暴击 +80%、冷凝 +240%（25 s 一次，模块）。
 * 濯雨时 15 s：普攻 r1–r4（第 4 段 1 层霜渐，+芳菲信）；重击 11.93%×10+119.29%；E·濯雨时（+100 芳菲信）。芳菲信 上限 600。
 *   水云息 / 芳菲信 普攻获取量未给出 → 估计（w 15/20/20/25；r 30/40/40/50；重击 60，低）。
 * 共鸣解放 康衢之谣（175 能量，冷却 25）：山河水境 30 s——队员附加 光噪/聚爆/霜渐/风蚀/电磁 后该异常层数上限 +3（15 s，不叠加）。
 * 延奏 渌水盈盈：全队全伤害加深 25% 30 s（通用解析）；山河水境存在时进入 仙游碧落：按消耗的芳菲信 ≥200/400/600 进行 1/2/3 次 翾舞（延奏后 3/6/9 s，估计），
 *   每次 1 层霜渐 + 全队 重明照影 6 s（≥400：伤害 +min(12%, 0.2×(共鸣效率−200%))）；≥600：下一位登场角色 烟岚 攻击 +min(50%, (共鸣效率−200%)/0.12%×0.1%) 14 s（消耗异常层数即触发，按常驻）。
 * 链：2 山河水境内附加异常的角色 暴击伤害 +50% 30 s；3 E·濯雨时 后 r4 +20 协奏 +350 芳菲信（25 s）；5 濯雨时 普攻/重击 倍率 +100%；6 变奏/醒春潮 暴击伤害 +500%；1/4 生存/已含 → chainModeled 6。
 * 动作帧：WuwaLAB（Suisui）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21050096; // 栖霞饮露
  const MIST = { w1: 15, w2: 20, w3: 20, w4: 25, Ew: 40 };
  const FANG = { r1: 30, r2: 40, r3: 40, r4: 50, rh: 60, Er: 100 };
  const CAPK = ['frazzle', 'burst', 'chafe', 'erosion', 'flare'];
  return WW.registerChar({
    id: 1110, chainModeled: 6, name: '穗穗', version: '0.1', confidence: 'low',
    notes: ['水云息/芳菲信 普攻获取量为估计（低）', '翾舞 时刻按延奏后 3/6/9 s 估计', '烟岚 按常驻攻击提升（触发条件 消耗异常层数）', '专武 栖霞饮露：附加霜渐 + 治疗（润物）→ 全队攻击 +20% 视为常驻（中）'],
    audit: { role: 'support', finishers: ['spring', 'r4'], window: 25, sig: SIG, alts: [21050036, 21050016, 21050046], solo: 'suisui_solo.json', team: 'team_hiyuki.json', teamMi: 2 },
    frames: Object.assign(B.stageFrames('w', 4, '普攻·Basic: Zephyr'), B.stageFrames('r', 4, '普攻·Basic: Drizzle'), {
      rh: '重击·Heavy: Drizzle', Ew: '共鸣技能·Skill: Zephyr', spring: '共鸣技能·Skill: Awakening Spring', Er: '共鸣技能·Skill: Drizzle',
      R: '共鸣解放·Liberation: Song of Thoroughfare', I: '变奏入场·Intro: Tinkling Jade',
    }),
    resources: [
      { key: 'rain', name: '濯雨时', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (cs.rain != null && t < cs.rain ? 1 : 0) },
      { key: 'mist', name: '水云息', max: 120, segmented: false, confidence: 'low' },
      { key: 'fang', name: '芳菲信', max: 600, segmented: false, confidence: 'low' },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'w', pre: '普攻·浣尘时', durs: [0.4, 0.77, 0.85, 1.0] }), B.stages(H, { n: 4, prefix: 'r', pre: '普攻·濯雨时', skill: 6, levelKey: 'forte', durs: [0.52, 1.17, 1.1, 1.07] }), {
        rh: H.act({ key: 'rh', cls: 'H', skill: 6, labels: ['重击·濯雨时伤害'], levelKey: 'forte', dur: 1.62, label: '重击·濯雨时' }),
        Ew: H.act({ key: 'Ew', cls: 'E', skill: 2, labels: ['共鸣技能·浣尘时伤害'], levelKey: 'skill', cooldown: 6, cdKey: 'E', dur: 0.92, label: '共鸣技能·浣尘时' }),
        spring: H.act({ key: 'spring', cls: 'E', skill: 2, labels: ['醒春潮伤害'], levelKey: 'skill', cooldown: 15, cdKey: 'spring', dur: 1.3, label: '醒春潮' }),
        Er: H.act({ key: 'Er', cls: 'E', skill: 2, labels: ['共鸣技能·濯雨时伤害'], levelKey: 'skill', cooldown: 6, cdKey: 'E', dur: 0.9, label: '共鸣技能·濯雨时' }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 4.4, label: '康衢之谣' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.3, label: '泠泠漱玉声' }),
        O: B.outro(H, '渌水盈盈'),
      });
      B.patch(H, /近水纳天光/, { mode: 'off' }, '模块：25 s 一次，仅醒春潮/变奏', 'inherent');
      H.buff({ id: 'shine', name: '重明照影·伤害', stats: [{ key: 'dmg:all', value: 0.01 }], maxStacks: 12, duration: 6, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '≥400 芳菲信：持有重明照影 伤害提升（按共鸣效率，≤12%；层数 = 百分点）' });
      H.buff({ id: 'mist', name: '烟岚·攻击', stats: [{ key: 'atkPct', value: 0.01 }], maxStacks: 50, duration: 14, trigger: { on: 'manual' }, mode: 'module', text: '≥600 芳菲信：下一位登场角色 烟岚（按共鸣效率，≤50%；层数 = 百分点）' });
      if (ch >= 2) H.buff({ id: 'c2', name: '链2·暴击伤害', stats: [{ key: 'critDmg', value: 0.5 }], duration: 30, trigger: { on: 'manual' }, mode: 'module', target: 'team', text: '链2' });
      if (H.weaponId === SIG) H.patchBuff((b) => b.kind === 'weapon' && /染雪色/.test(b.text || '') && b.stats.some((x) => x.key === 'atkPct'), { trigger: { on: 'always' }, mode: 'on' }, '模块：附加霜渐 + 润物治疗 → 常驻（中）');
      B.patch(H, /雨洗千山|霞铺万顷|半卷疏帘|一桁秋山|愿乘东风|不负江山/, { mode: 'off' }, '模块处理', 'chain');
      return K;
    },
    fillerKeys: ['w1', 'w2', 'w3', 'w4', 'r1', 'r2', 'r3', 'r4'],
    init(api) { const s = api.H.opts.start || {}; return { st: 0, rst: 0, mist: s.mist || 0, fang: s.fang || 0, rain: null, jadeT: -99, field: null, capUntil: {}, dots: false, c3T: -99, c3: false }; },
    inRain(cs, t) { return cs.rain != null && t < cs.rain - 1e-9; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, rain = this.inRain(cs, t);
      switch (btn) {
        case 'A': return { act: rain ? K['r' + ((cs.rst % 4) + 1)] : K['w' + ((cs.st % 4) + 1)] };
        case 'H': return rain ? { act: K.rh } : null;
        case 'E':
          if (rain) return api.cdReady('E') ? { act: K.Er } : { blocked: '冷却中' };
          if (cs.mist >= 120 - 1e-9) return api.cdReady('spring') ? { act: K.spring } : { blocked: '冷却中' };
          return api.cdReady('E') ? { act: K.Ew } : { blocked: '冷却中' };
        case 'R': return { act: K.R };
        default: return B.common(api, btn);
      }
    },
    er(api) { const p = api.livePanel(); return p ? p.energyRegen : 1; },
    actionStats(api, act) {
      const ch = api.H.chain, out = [], k = act.key;
      if ((k === 'spring' || k === 'I') && api.t - api.cs.jadeT >= 25 - 1e-9) out.push({ key: 'critRate', value: 0.8 }, { key: 'dmg:glacio', value: 2.4 });
      if (ch >= 5 && (/^r\d$/.test(k) || k === 'rh')) out.push({ key: 'multUp', value: 1 });
      if (ch >= 6 && (k === 'spring' || k === 'I')) out.push({ key: 'critDmg', value: 5 });
      return out;
    },
    enterRain(api, te) { const cs = api.cs; cs.mist = 0; cs.fang = 0; cs.rain = te + 15; cs.rst = 0; },
    jade(api, te) { const cs = api.cs; if (te - cs.jadeT >= 25 - 1e-9 || cs.jadeT === api.t) { if (te - cs.jadeT >= 25 - 1e-9) { cs.jadeT = api.t; api.addConcerto(api.mi, 18); api.addEnergy(api.mi, 13); } } },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      if (/^w\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; cs.mist = Math.min(120, cs.mist + MIST[k]); return; }
      if (/^r\d$/.test(k)) {
        const n = +k.slice(1); cs.rst = n % 4; cs.fang = Math.min(600, cs.fang + FANG[k]);
        if (n === 4) { api.addAnomaly('chafe', 1, { t: te }); if (cs.c3 && te - cs.c3T >= 25) { cs.c3 = false; cs.c3T = te; api.addConcerto(api.mi, 20); cs.fang = Math.min(600, cs.fang + 350); } }
        return;
      }
      switch (k) {
        case 'rh': cs.fang = Math.min(600, cs.fang + FANG.rh); cs.rst = 0; break;
        case 'Ew': cs.mist = Math.min(120, cs.mist + MIST.Ew); break;
        case 'Er': cs.fang = Math.min(600, cs.fang + FANG.Er); if (ch >= 3) { cs.c3 = true; cs.rst = 3; } break;
        case 'spring': case 'I': this.jade(api, te); api.addAnomaly('chafe', 1, { t: te }); this.enterRain(api, te); break;
        case 'R': cs.field = te + 30; break;
        default: break;
      }
    },
    onOutro(api) {
      const cs = api.cs, t = api.t, fang = this.inRain(cs, t) ? cs.fang : 0;
      cs.rain = null; cs.fang = 0;
      if (!on(cs.field, t)) return;
      const n = fang >= 600 ? 3 : fang >= 400 ? 2 : fang >= 200 ? 1 : 0;
      const er = this.er(api);
      cs.dots = [];
      for (let i = 1; i <= n; i++) cs.dots.push({ t: t + 3 * i, shine: fang >= 400 ? Math.min(0.12, Math.max(0, 0.2 * (er - 2))) : 0 });
      if (fang >= 600) { const v = Math.min(0.5, Math.max(0, (er - 2) / 0.0012 * 0.001)); cs.mistPend = Math.round(v * 100); }
    },
    tickDots(api, t) {
      const cs = api.cs; if (!cs.dots || !cs.dots.length) return;
      while (cs.dots.length && cs.dots[0].t <= t + 1e-9 && on(cs.field, cs.dots[0].t)) {
        const d = cs.dots.shift();
        if (!api.onField) { api.addAnomaly('chafe', 1, { t: d.t }); if (d.shine > 0) { const n = Math.round(d.shine * 100); if (n > 0) for (let j = 0; j < api.teamSize; j++) api.fireBuff('shine', j, { t: d.t, stacks: n }); } }
      }
      if (cs.dots.length && !on(cs.field, cs.dots[0].t)) cs.dots = [];
    },
    onTeam(api, ev) {
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if (ev.type === 'damage') this.tickDots(api, t);
      if (ev.type === 'swap' && cs.mistPend && ev.mi !== api.mi) { api.fireBuff('mist', ev.mi, { t, stacks: cs.mistPend }); cs.mistPend = 0; }
      if (ev.type === 'anomaly' && on(cs.field, t) && CAPK.includes(ev.kind)) {
        cs.capUntil[ev.kind] = t + 15; api.raiseAnomalyCap(ev.kind, 3, t + 15, 'suisui:' + ev.kind); // 「无法叠加」= 每次触发刷新 15 秒，不叠加（核心按来源替换）
        if (api.H.chain >= 2) api.fireBuff('c2', ev.mi, { t });
      }
    },
    potential(api) { const cs = api.cs; return 0; },
  });
});
