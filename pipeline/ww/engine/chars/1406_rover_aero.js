/*
 * 漂泊者·气动 (1406 / 1408, 两个性别同一技能组) character module — worker-B.
 *
 * 普攻 刻雾裁风 (1003201): 4 段；重击（之后普攻第3段）；「重击·绞息：施放普攻第3段、闪避反击或重击后一定时间内长按普攻」
 * 共鸣技能 裂象 (1003202): 苍息破象 66.44%+99.66%（冷却 3）；
 *   「碧霄断行：处于空中时，短按共鸣技能…命中目标后，移除目标全部【光噪效应】、【虚湮效应】、【聚爆效应】、【霜渐效应】、【电磁效应】，每移除1层…附加1层【风蚀效应】」（冷却 12）
 * 共鸣解放 万象归墟 (1003203): 536.79%（消耗 150）
 * 共鸣回路 风息流转 (1003207):「空中攻击·抃风儛润：施放苍息破象 / 变奏 / 重击绞息 后一定时间内短按普攻…最多2段…共鸣技能伤害；
 *   【弦风息】达到上限（120）时，苍息破象替换为缥缈无相，最多2段，每段消耗60点；抃风儛润每段 +25，变奏 +20，普攻第3/4段、闪避反击 +10」
 * 固有 空渡浮尘：变奏后攻击 +20% 10 秒（解析）
 * 延奏 流风回响 (1003209):「附近队伍中所有角色获得蚀境象，持续30秒。攻击命中后，使目标【风蚀效应】层数上限增加3层，持续10秒」
 *   → 蚀境象期间有风蚀层被附加时 api.raiseAnomalyCap('erosion', 3, t+10)，10 秒内不重复（核心 B5）
 * 按钮：抃风儛润（空中）之后 E = 碧霄断行（冷却好时）；其它情况 E = 苍息破象 / 缥缈无相
 * 专武 血誓盟约 (21020046)：通用解析
 * 共鸣链：3 气动 +15%、4 抃风后技能 +15%、5 解放 +20%、6 缥缈无相 +30%（模块）；1/2 未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const OTHERS = ['frazzle', 'bane', 'burst', 'chafe', 'flare'];   // 光噪 虚湮 聚爆 霜渐 电磁
  const scale = (a, m, key) => Object.assign({}, a, { key, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  function def(id) {
    return {
      id, chainModeled: 6, name: '漂泊者·气动', version: '0.1', confidence: 'medium',
      notes: ['碧霄断行的转化：按当前其它异常层数之和附加风蚀并移除原异常（只建模本引擎已有的异常类型）', '延奏 蚀境象：风蚀上限 +3（raiseAnomalyCap，按队伍附加风蚀时触发近似“攻击命中后”）', '闪避反击未建模'],
      audit: id === 1406
        ? { role: 'support', finishers: ['pm2'], window: 25, sig: 21020046, alts: [21020015, 21020045, 21020064], solo: 'rover_aero_solo.json', team: 'team_cartethyia_rover_aero.json', teamMi: 2, note: '风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实' }
        : { role: 'support', finishers: ['pm2'], window: 25, sig: 21020046, alts: [21020015, 21020045, 21020064], solo: 'rover_aero_f_solo.json', team: 'team_cartethyia_rover_aero_f.json', teamMi: 2, note: '风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实' },
      frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Wind Cutter'), {
        hv: '重击·Heavy: Wind Cutter', jx: '重击·Heavy: Razor Wind', bf1: '普攻·Basic: Cloudburst Dance 1 (Mid-Air)', bf2: '普攻·Basic: Cloudburst Dance 2 (Mid-Air)',
        cp: '共鸣技能·Skill 1: Awakening Gale', bx: '共鸣技能·Skill 2: Skyfall Severance', pm1: '共鸣回路·Skill 3: Unbound Flow - Stage 1', pm2: '共鸣回路·Skill 3: Unbound Flow - Stage 2',
        lib: '共鸣解放·Liberation: Omega Storm', I: '变奏入场·Intro: Relentless Squall',
      }),
      resources: [
        { key: 'xf', name: '弦风息', max: 120, segmented: false, confidence: 'high' },
        { key: 'ej', name: '蚀境象', max: 1, segmented: true, confidence: 'medium', get: (cs, t) => (on(cs.ejUntil, t) ? 1 : 0) },
      ],
      kit(H) {
        const ch = H.chain;
        const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.32, 0.73, 0.93, 0.73] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.52, label: '重击' }),
          jx: H.act({ key: 'jx', cls: 'H', skill: 1, labels: ['绞息伤害'], levelKey: 'basic', dur: 0.63, label: '重击·绞息' }),
          bf1: H.act({ key: 'bf1', cls: 'A', skill: 6, labels: ['抃风儛润第一段伤害', '抃风儛润治疗量'], levelKey: 'forte', dur: 0.42, label: '抃风儛润·1' }),
          bf2: H.act({ key: 'bf2', cls: 'A', skill: 6, labels: ['抃风儛润第二段伤害', '抃风儛润治疗量'], levelKey: 'forte', dur: 0.45, label: '抃风儛润·2' }),
          cp: H.act({ key: 'cp', cls: 'E', skill: 2, labels: ['苍息破象伤害'], levelKey: 'skill', concertoParam: '苍息破象回复协奏能量', cooldown: 3, dur: 1.07, label: '苍息破象' }),
          bx: H.act({ key: 'bx', cls: 'E', skill: 2, labels: ['碧霄断行伤害'], levelKey: 'skill', concertoParam: '碧霄断行回复协奏能量', cooldown: 12, dur: 0.93, label: '碧霄断行' }),
          pm1: H.act({ key: 'pm1', cls: 'E', skill: 6, labels: ['缥缈无相第一段伤害'], levelKey: 'forte', concertoParam: '缥缈无相每段回复协奏能量', dur: 1.05, label: '缥缈无相·1' }),
          pm2: H.act({ key: 'pm2', cls: 'E', skill: 6, labels: ['缥缈无相第二段伤害'], levelKey: 'forte', concertoParam: '缥缈无相每段回复协奏能量', dur: 0.6, label: '缥缈无相·2' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害', '治疗量'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 24, dur: 3.52, label: '万象归墟' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.42 }),
          O: B.outro(H, '流风回响'),
        });
        if (ch >= 5) K.lib = scale(K.lib, 1.2, 'lib');
        if (ch >= 6) { K.pm1 = scale(K.pm1, 1.3, 'pm1'); K.pm2 = scale(K.pm2, 1.3, 'pm2'); }
        return K;
      },
      fillerKeys: ['a1', 'a2', 'a3', 'a4'],
      init(api) { const st = api.H.opts.start || {}; return { xf: st.xf || 0, st: 0, nextA: null, canJx: false, air: false, pm: 0, ejUntil: null, capNext: null, c4Until: null }; },
      resolve(api, btn) {
        const K = api.mem.modKit, cs = api.cs;
        switch (btn) {
          case 'A':
            if (cs.nextA) return { act: K[cs.nextA] };
            return { act: K['a' + ((cs.st % 4) + 1)] };
          case 'H': return { act: cs.canJx ? K.jx : K.hv };
          case 'E':
            if (cs.pm === 1) return { act: K.pm2 };
            if (cs.air && api.cdReady('bx')) return { act: K.bx };
            if (cs.xf >= 120 - 1e-9) return { act: K.pm1 };
            return api.cdReady('cp') ? { act: K.cp } : { blocked: '冷却中' };
          case 'R': return { act: K.lib };
          case 'I': return { act: K.I };
          default: return B.common(api, btn);
        }
      },
      actionStats(api, act) {
        const ch = api.H.chain, out = [];
        if (ch >= 3) out.push({ key: 'dmg:aero', value: 0.15 });
        if (ch >= 4 && on(api.cs.c4Until, api.t)) out.push({ key: 'dmg:skill', value: 0.15 });
        return out;
      },
      apply(api, act) {
        const cs = api.cs, k = act.key, te = api.tEnd;
        const gain = (n) => { cs.xf = Math.min(120, cs.xf + n); };
        cs.nextA = null; cs.canJx = false; cs.air = false;
        if (k !== 'pm1') cs.pm = 0;
        if (/^a\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; if (n >= 3) gain(10); if (n === 3) cs.canJx = true; return; }
        switch (k) {
          case 'hv': cs.nextA = 'a3'; cs.canJx = true; break;
          case 'jx': case 'cp': cs.nextA = 'bf1'; break;
          case 'bf1': gain(25); cs.nextA = 'bf2'; cs.air = true; if (api.H.chain >= 4) cs.c4Until = te + 5; break;
          case 'bf2': gain(25); cs.air = true; if (api.H.chain >= 4) cs.c4Until = te + 5; break;
          case 'pm1': cs.xf -= 60; cs.pm = 1; break;
          case 'pm2': cs.xf = Math.max(0, cs.xf - 60); break;
          case 'bx': {
            let n = 0;
            for (const ty of OTHERS) { const m = api.anomaly(ty) || 0; if (m > 0) { n += m; api.detonateAnomaly(ty, { remove: 'all', scale: 0 }); } }
            if (n > 0) api.addAnomaly('erosion', n);
            break;
          }
          case 'I': gain(20); cs.nextA = 'bf1'; break;
          case 'O': cs.ejUntil = te + 30; break;
          default: break;
        }
      },
      // 缥缈无相第1段后切人会自动施放第2段
      swapOut(api) { const cs = api.cs; if (cs.pm === 1) { api.deal(api.mem.modKit.pm2); cs.xf = Math.max(0, cs.xf - 60); cs.pm = 0; } },
      onTeam(api, ev) {
        const cs = api.cs, t = ev.t != null ? ev.t : api.t;
        if (ev.type !== 'anomaly' || ev.kind !== 'erosion' || !on(cs.ejUntil, t)) return;
        if (cs.capNext == null || t >= cs.capNext - 1e-9) { cs.capNext = t + 10; api.raiseAnomalyCap('erosion', 3, t + 10); }   // 「持续10秒，该效果无法叠加」
      },
      // search heuristic (not a game rule): 弦风息 → 缥缈无相
      potential(api) {
        const cs = api.cs, K = api.mem.modKit;
        return cs.xf / 120 * 0.6 * (api.est(K.pm1) + api.est(K.pm2)) + (cs.pm === 1 ? api.est(K.pm2) : 0);
      },
    };
  }
  WW.registerChar(def(1408));
  return WW.registerChar(def(1406));
});
