/*
 * 秧秧·玄翎 (1610) character module — worker-B.
 *
 * 普攻 济善伐恶 (1005401): 苍剑式 / 羽剑式各 4 段，「消耗【流响】…第4段造成伤害时，会为目标附加1层【虚湮效应】」（流响每段消耗量未公开：估计 25/段，低）
 * 共鸣技能 羽拭苍锋 (1005402): 「剑式切换·苍/羽：施放普攻后…短按共鸣技能，会切换至另一剑式…此次伤害为重击伤害…不会重置普攻连段」
 * 共鸣回路 万声浮道 (1005407):
 *   「【流响】耗尽时…共鸣技能替换为剑式流转…回复100点【流响】和1点【苍翎】，此次伤害为重击伤害…命中目标时，消耗目标1层【虚湮效应】」
 *   「重击·苍剑式：【苍翎】回复至上限时…消耗所有【苍翎】…获得【绝息】…暴击伤害提升160%…每25秒仅可获得1次…附加2层【虚湮效应】」
 *   「重击·羽剑式：…命中目标后将自动施放空中攻击·释羽风落…获得【流岚】（15秒）…重击·羽剑式、释羽风落、普攻·湮象风华暴击伤害提升160%；湮象风华第3段结束时移除…每25秒1次…附加2层【虚湮效应】」
 *   「释羽风落…消耗所有【苍翎】…进入聆风祀声，持续12秒。聆风祀声：处于羽剑式时，普攻·羽剑式替换为普攻·湮象风华（3段，重击伤害）」
 *   「羽誓：队伍中的角色对目标附加【虚湮效应】时，获得1层，持续4秒，间隔1秒，最多6层…每层使（上述重击类）暴击伤害提升25%」
 *   → 释羽风落无伤害行（只有描述倍率 14.80%×3+66.57%）：按描述构造重击/湮灭/攻击（中）
 * 共鸣解放 裁羽寂万音 (1005403): 1988.10%（重击伤害；消耗 125，冷却 25）「消耗所有【流响】…回复1点【苍翎】…获得声声流转：施放剑式流转时召唤玄翎之影 337.98%」
 * 固有：恒守之誓（每层虚湮伤害加深 10%（1–3 层）/12%（4–6 层），模块 actionStats）；一生一器「裁羽寂万音命中时，附加【虚湮效应】至上限」「队伍附加虚湮 → 风息相依（1 秒间隔，6 层）→ 风我同频：下次剑式流转召唤释羽·玄翎附加6层」
 * 变奏 羽挟苍空 (1005406): 116.59%，+1 苍翎，+1 虚湮
 * 延奏 且随风引 (1005409): 300% + 队友「移宫换羽…为目标附加【虚湮效应】后，该角色湮灭伤害加深20%」（解析为 others 20 秒）
 * 引擎：虚湮（bane）上限 3 层（buff.json），链3/千咲延奏 +3（模块按 cap 传入）
 * 共鸣链：1 剑式流转召唤玄翎之影·抗坠 337.98%；2 上述重击类伤害 +100%；3 解放加深 175%、虚湮上限 +3、第4段/重击额外 +1 层；4 队伍攻击 +20%（解析）；6 万声皆流/止如槁木（部分：重击受伤 +40%，止如槁木不建模）
 * 专武 天之苍苍 (21020096)：「附加虚湮效应后，重击伤害加深36%，重击伤害无视目标12%防御，持续8秒」（解析）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21020096;
  const HEAVY_FAM = new Set(['hA', 'hF', 'hb1', 'hb2', 'hb3']);
  return WW.registerChar({
    id: 1610, chainModeled: 6, name: '秧秧·玄翎', version: '0.1', confidence: 'medium',
    notes: ['流响每段普攻消耗估计 25（低）', '虚湮（bane）只减防不造成伤害；恒守之誓按当前层数加深', '绝息/流岚 25 秒冷却、羽誓按最近 4 秒虚湮附加次数计', '释羽风落按描述倍率构造（无伤害行，中）', '链6 止如槁木不建模'],
    audit: { role: 'dps', finishers: ['lib', 'hF', 'hb3'], window: 25, sig: SIG, alts: [21020015, 21020045, 21020104], solo: 'xuanling_solo.json', team: 'team_xuanling_chisa.json', teamMi: 0, anomaly: 'bane' },
    frames: {
      az1: '普攻·Basic: Azure Sword 1', az2: '普攻·Basic: Azure Sword 2', az3: '普攻·Basic: Azure Sword 3', az4: '普攻·Basic: Azure Sword 4',
      fe1: '普攻·Basic: Feather Sword 1', fe2: '普攻·Basic: Feather Sword 2', fe3: '普攻·Basic: Feather Sword 3', fe4: '普攻·Basic: Feather Sword 4',
      swA: '共鸣技能·Skill: Sword Stance Switch - Azure', swF: '共鸣技能·Skill: Sword Stance Switch - Feather', flA: '共鸣技能·Skill: Sword Stance Flow - Azure', flF: '共鸣技能·Skill: Sword Stance Flow - Feather',
      hA: '重击·Heavy: Azure Sword', hb1: '共鸣回路·Basic: Havoc in Bloom 1', hb2: '共鸣回路·Basic: Havoc in Bloom 2', hb3: '共鸣回路·Basic: Havoc in Bloom 3',
      lib: '共鸣解放·Liberation: Hush of a Thousand Voices', I: '变奏入场·Intro: Skytouch',
    },
    resources: [
      { key: 'lx', name: '流响', max: 100, segmented: false, confidence: 'low' },
      { key: 'cl', name: '苍翎', max: 2, segmented: true, confidence: 'high' },
      { key: 'stance', name: '剑式（1=羽）', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.fe ? 1 : 0) },
      { key: 'lf', name: '聆风祀声（秒）', max: 12, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.lfUntil, t).toFixed(2) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = {};
      for (let k = 1; k <= 4; k++) {
        K['az' + k] = H.act({ key: 'az' + k, cls: 'A', skill: 1, labels: ['普攻·苍剑式第' + B.CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.32, 0.73, 0.72, 1.27][k - 1], label: '普攻·苍剑式' + k });
        K['fe' + k] = H.act({ key: 'fe' + k, cls: 'A', skill: 1, labels: ['普攻·羽剑式第' + B.CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.55, 0.7, 0.55, 1.55][k - 1], label: '普攻·羽剑式' + k });
      }
      const c2 = ch >= 2 ? { '*': 2 } : null;
      Object.assign(K, {
        swA: H.act({ key: 'swA', cls: 'E', skill: 2, labels: ['剑式切换·苍伤害'], levelKey: 'skill', dur: 0.98, label: '剑式切换·苍' }),
        swF: H.act({ key: 'swF', cls: 'E', skill: 2, labels: ['剑式切换·羽伤害'], levelKey: 'skill', dur: 0.73, label: '剑式切换·羽' }),
        flA: H.act({ key: 'flA', cls: 'E', skill: 6, labels: ['共鸣技能·剑式流转·苍伤害'], levelKey: 'forte', dur: 0.98, label: '剑式流转·苍' }),
        flF: H.act({ key: 'flF', cls: 'E', skill: 6, labels: ['共鸣技能·剑式流转·羽伤害'], levelKey: 'forte', dur: 0.73, label: '剑式流转·羽' }),
        hA: H.act({ key: 'hA', cls: 'H', skill: 6, labels: ['重击·苍剑式伤害'], levelKey: 'forte', dur: 1.75, scale: c2, label: '重击·苍剑式' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['裁羽寂万音伤害'], levelKey: 'liberation', concertoParam: '裁羽寂万音回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 5.0, scale: ch >= 3 ? { '*': 2.75 } : null, label: '裁羽寂万音' }),
        shadow: H.act({ key: 'shadow', cls: 'R', skill: 3, labels: ['玄翎之影伤害'], levelKey: 'liberation', label: '玄翎之影' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['羽挟苍空伤害'], levelKey: 'intro', concertoParam: '羽挟苍空回复协奏能量', dur: 0.78 }),
        O: B.outro(H, '且随风引'),
      });
      for (let k = 1; k <= 3; k++) K['hb' + k] = H.act({ key: 'hb' + k, cls: 'A', skill: 6, labels: ['普攻·湮象风华第' + B.CN[k - 1] + '段伤害'], levelKey: 'forte', ownStage: true, dur: [0.63, 1.15, 1.8][k - 1], scale: c2, label: '普攻·湮象风华' + k });
      // 重击·羽剑式 + 自动释羽风落（14.80%×3+66.57%，描述倍率，中）：0.75 + 1.27s
      const hF = H.act({ key: 'hF', cls: 'H', skill: 6, labels: ['重击·羽剑式伤害'], levelKey: 'forte', dur: 2.02, scale: c2, label: '重击·羽剑式+释羽风落' });
      const proto = hF.hits[hF.hits.length - 1];
      if (proto) {
        const lv = (H.level.forte || 10) - 1;
        const ff = (H.skill(6).params || []).find((p) => p.label === '空中攻击·释羽风落伤害');
        const nums = ff ? String(ff.values[Math.min(ff.values.length - 1, lv)]).match(/[\d.]+%(\*\d+)?/g) || [] : [];
        for (const n of nums) { const m = n.match(/([\d.]+)%(?:\*(\d+))?/); hF.hits.push(Object.assign({}, proto, { label: '释羽风落', multiplier: proto.multiplier.map(() => parseFloat(m[1]) / 100), count: m[2] ? +m[2] : 1, confidence: 'medium', lowReason: '无伤害行：按描述倍率' })); }
      }
      K.hF = hF;
      B.patch(H, /恒守之誓|每层【虚湮效应】使秧秧·玄翎/, { mode: 'module' }, '模块：按虚湮层数的加深', 'inherent');
      return K;
    },
    fillerKeys: ['az1', 'az2', 'az3', 'az4', 'fe1', 'fe2', 'fe3', 'fe4'],
    init(api) { const st = api.H.opts.start || {}; return { lx: st.lx != null ? st.lx : 100, cl: st.cl || 0, fe: false, st: 0, hb: 0, lfUntil: null, jxCd: 0, llCd: 0, llUntil: null, jx: false, ssl: false, fx: 0, fxNext: 0, tp: false, yw: [], c3Until: null }; },
    cap(api) { return 3 + (api.H.chain >= 3 && on(api.cs.c3Until, api.t) ? 3 : 0); },
    bane(api, n) { if (n > 0) api.addAnomaly('bane', n, { cap: this.cap(api) }); },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      switch (btn) {
        case 'A':
          if (cs.fe && on(cs.lfUntil, t) && cs.hb < 3) return { act: K['hb' + (cs.hb + 1)] };
          return { act: K[(cs.fe ? 'fe' : 'az') + ((cs.st % 4) + 1)] };
        case 'E':
          if (cs.lx <= 1e-9) return { act: cs.fe ? K.flA : K.flF };
          // 「施放普攻·X剑式后的一定时间内短按共鸣技能 → 剑式切换（重击伤害）」；否则「切换剑式并施放另一剑式普攻第1段」
          if (cs.afterA) return { act: cs.fe ? K.swA : K.swF };
          return { act: Object.assign({}, cs.fe ? K.az1 : K.fe1, { key: cs.fe ? 'toA' : 'toF', cls: 'E', label: cs.fe ? '剑式切换→苍剑式第1段' : '剑式切换→羽剑式第1段' }) };
        case 'H':
          if (cs.cl < 2) return { blocked: '苍翎未满' };
          return { act: cs.fe ? K.hF : K.hA };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [];
      const n = api.anomaly('bane') || 0;
      const deep = 0.1 * Math.min(3, n) + 0.12 * Math.max(0, Math.min(6, n) - 3);
      if (deep) out.push({ key: 'deep:all', value: deep });
      if (HEAVY_FAM.has(act.key)) {
        const yw = cs.yw.filter((x) => x > t - 4).length;
        let cd = 0.25 * Math.min(6, yw);
        if (act.key === 'hA' && t >= cs.jxCd - 1e-9) cd += 1.6;
        if (act.key !== 'hA' && (act.key === 'hF' ? t >= cs.llCd - 1e-9 : on(cs.llUntil, t))) cd += 1.6;
        if (cd) out.push({ key: 'critDmg', value: cd });
      }
      if (api.H.chain >= 6 && act.cls !== 'I' && /^(hA|hF|hb\d|lib|fl[AF]|sw[AF])$/.test(act.key) && n > 0) out.push({ key: 'deep:all', value: 0.4 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, t = api.t, ch = api.H.chain, K = api.mem.modKit;
      const m = k.match(/^(az|fe)(\d)$/);
      cs.afterA = !!m;
      if (k === 'toA' || k === 'toF') { cs.fe = k === 'toF'; cs.st = 1; cs.lx = Math.max(0, cs.lx - (api.H.opts.lxPerHit || 25)); return; }
      if (m) {
        const n = +m[2]; cs.st = n % 4; cs.lx = Math.max(0, cs.lx - (api.H.opts.lxPerHit || 25));
        if (n === 4) this.bane(api, 1 + (ch >= 3 ? 1 : 0));
        return;
      }
      switch (k) {
        case 'swA': case 'swF': cs.fe = k === 'swF'; break; // 不重置连段
        case 'flA': case 'flF':
          cs.fe = k === 'flF'; cs.lx = 100; cs.cl = Math.min(2, cs.cl + 1); cs.st = 0;
          api.detonateAnomaly('bane', { remove: 1, label: '剑式流转消耗虚湮' });
          if (ch >= 3) cs.c3Until = te + 20;
          if (cs.ssl) { cs.ssl = false; api.deal(K.shadow, { coord: true }); }
          if (ch >= 1) api.deal(K.shadow, { coord: true });
          if (cs.tp) { cs.tp = false; this.bane(api, 6); }
          break;
        case 'hA': cs.cl = 0; if (t >= cs.jxCd - 1e-9) cs.jxCd = t + 25; this.bane(api, 2 + (ch >= 3 ? 1 : 0)); cs.st = 0; break;
        case 'hF': cs.cl = 0; if (t >= cs.llCd - 1e-9) { cs.llCd = t + 25; cs.llUntil = te + 15; } this.bane(api, 2 + (ch >= 3 ? 1 : 0)); cs.lfUntil = te + 12; cs.hb = 0; cs.st = 0; break;
        case 'hb1': case 'hb2': cs.hb = +k.slice(2); break;
        case 'hb3': cs.hb = 0; cs.lfUntil = te; cs.llUntil = null; break;
        case 'lib': cs.lx = 0; cs.cl = Math.min(2, cs.cl + 1); cs.ssl = true; this.bane(api, this.cap(api)); cs.st = 0; break;
        case 'I': cs.cl = Math.min(2, cs.cl + 1); this.bane(api, 1); if (ch >= 3) cs.c3Until = te + 20; break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type !== 'anomaly' || ev.kind !== 'bane') return;
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if (t >= cs.fxNext - 1e-9) {
        cs.fxNext = t + 1;
        cs.yw = cs.yw.filter((x) => x > t - 4).concat([t]).slice(-6);
        if (!cs.tp) { cs.fx += 1; if (cs.fx >= 6) { cs.fx = 0; cs.tp = true; } }
      }
    },
    // search heuristic (not a game rule): 苍翎 → 重击·羽剑式 / 聆风祀声; 流响 → 剑式流转
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = cs.cl / 2 * 0.5 * api.est(K.hF);
      if (on(cs.lfUntil, t)) v += (3 - cs.hb) / 3 * 0.6 * (api.est(K.hb1) + api.est(K.hb2) + api.est(K.hb3));
      v += (100 - cs.lx) / 100 * 0.2 * api.est(K.flA);
      return v;
    },
  });
});
