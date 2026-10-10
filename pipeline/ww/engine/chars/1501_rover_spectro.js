/*
 * 漂泊者·衍射 (1501 / 1502，同一套技能；两个性别各注册一次) character module — worker-B.
 *
 * 数据含两版技能：旧版（1000603/1000607）与光噪版（1000613/1000617，「附加6层【光噪效应】」「附加2层【光噪效应】和【微光】效果」）。
 *   → 默认光噪版（当前版本）；opts.legacy=true 用旧版（中）
 * 普攻 化声为形 (1000601): 4 段；「重击·鸣奏：第3段普攻或重击后，恰当时机短按普攻，将会施放重击鸣奏」；重击·余音（描述空白：按鸣奏后续一段处理，低）
 * 共鸣技能 浮声千斩 (1000602): 236.19%，冷却 6
 * 共鸣解放 回响奏鸣 (1000613): 198.81%+675.96%（消耗 125，冷却 20），附加 6 层光噪
 * 共鸣回路 万物微尘 (1000617):「施放共鸣技能时，若【尘微之声】超过50点，则消耗50点…施放浮声千斩·旋音…并附加2层【光噪效应】和【微光】效果。
 *   【微光】携带【微光】的目标，身上【光噪效应】的层数，不会因【光噪效应】原本的层数减少效果而减少。（微光持续时间=9）
 *   普攻·浮声千斩·回声：共鸣技能浮声千斩·旋音结束后，短按普攻…此次伤害为共鸣技能伤害。
 *   尘微之声：常态攻击化声为形命中目标时、重击余音命中目标时、施放变奏技能震声时回复。」→ 回复量未公开：估计（低，module.gain）
 *   → 微光：addAnomaly(..., { noDecayUntil: t+9 })（核心 B6 已完成）
 * 变奏 震声 (1000606): 168.99%；延奏 瞬刻：停滞区域（无增益，不建模）
 * 固有：屏息 回声 +60%（模块 scale）；静聆 鸣奏后攻击 +15% 5 秒（解析）
 * 共鸣链：1 E 暴击 +15%；2 衍射 +20%；3 共鸣效率 +20%；4 治疗；5 共鸣解放 +40%；6 E 命中衍射抗性 -10% 20 秒（解析）
 * 无专属 5★ 武器。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const GAIN = { A1: 8, A2: 10, A3: 12, A4: 18, yy: 20, I: 30 };
  const def = (id) => ({
    id, chainModeled: 0, name: '漂泊者·衍射', version: '0.1', confidence: 'medium',
    notes: ['默认光噪版技能（opts.legacy 用旧版）', '尘微之声获取量估计（低）', '微光 9 秒：光噪不衰减（noDecayUntil）', '重击·余音：描述空白，按鸣奏后的下一次普攻处理（低）'],
    audit: id === 1501 ? { role: 'subdps', finishers: ['xy', 'hs', 'lib'], window: 25, sig: null, solo: 'rover_spectro_solo.json', team: 'team_phoebe_rover.json', teamMi: 1, anomaly: 'frazzle' }
      : { role: 'subdps', finishers: ['xy', 'hs', 'lib'], window: 25, sig: null, solo: 'rover_spectro_f_solo.json', team: 'team_zani_rover.json', teamMi: 1, anomaly: 'frazzle' },
    frames: {
      n1: '普攻·Basic: Vibration Manifestation 1', n2: '普攻·Basic: Vibration Manifestation 2', n3: '普攻·Basic: Vibration Manifestation 3', n4: '普攻·Basic: Vibration Manifestation 4',
      hv: '重击·Heavy 1: Vibration Manifestation', mz: '重击·Heavy 2: Resonance', yy: '重击·Heavy 3: Aftertune', E: '共鸣技能·Skill: Resonating Slashes', xy: '共鸣技能·Skill: Resonating Spin',
      hs: '普攻·Basic: Resonating Echoes', lib: '共鸣解放·Liberation: Echoing Orchestra', I: '变奏入场·Intro: Waveshock',
    },
    resources: [
      { key: 'dust', name: '尘微之声', max: 100, segmented: false, confidence: 'low' },
      { key: 'gl', name: '微光（秒）', max: 9, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.glUntil, t).toFixed(2) },
    ],
    kit(H) {
      const legacy = !!H.opts.legacy;
      const S3 = legacy ? 1000603 : 1000613, S6 = legacy ? 1000607 : 1000617;
      const K = B.stages(H, { n: 4, prefix: 'n', durs: [0.35, 0.42, 0.4, 0.82] });
      Object.assign(K, {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.55 }),
        mz: H.act({ key: 'mz', cls: 'A', skill: 1, labels: ['鸣奏伤害'], levelKey: 'basic', dur: 0.45, label: '重击·鸣奏' }),
        yy: H.act({ key: 'yy', cls: 'A', skill: 1, labels: ['余音伤害'], levelKey: 'basic', dur: 0.68, label: '重击·余音' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 6, cdKey: 'E', dur: 0.68 }),
        xy: H.act({ key: 'xy', cls: 'E', skill: S6, labels: ['浮声千斩·旋音伤害', '浮声千斩·旋音飞轮伤害'], levelKey: 'forte', concertoParam: '浮声千斩·旋音回复协奏能量', dur: 0.97, label: '浮声千斩·旋音' }),
        hs: H.act({ key: 'hs', cls: 'A', skill: S6, labels: ['浮声千斩·回声一段伤害', '浮声千斩·回声二段伤害'], levelKey: 'forte', concertoParam: '浮声千斩·回声回复协奏能量', dur: 1.0, scale: { '*': 1.6 }, label: '普攻·浮声千斩·回声', inferred: '固有 屏息 +60%' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: S3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, dur: 2.15, label: '回响奏鸣' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.2 }),
        O: B.outro(H, '瞬刻'),
      });
      return K;
    },
    fillerKeys: ['n1', 'n2', 'n3', 'n4'],
    init(api) { const st = api.H.opts.start || {}; return { dust: st.dust || 0, st: 0, nx: null, glUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.nx) return { act: K[cs.nx] };
          return { act: K['n' + ((cs.st % 4) + 1)] };
        case 'H': return { act: K.hv };
        case 'E':
          if (cs.dust > 50 - 1e-9) return { act: K.xy };
          return api.cdReady('E') ? { act: K.E } : { blocked: '浮声千斩冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    glCheck(api, t) {
      const cs = api.cs;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, g = Object.assign({}, GAIN, api.H.opts.gain || {});
      const legacy = !!api.H.opts.legacy;
      const add = (n) => { cs.dust = Math.min(100, cs.dust + n); };
      this.glCheck(api, api.t);
      cs.nx = null;
      if (/^n\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; add(g['A' + n]); if (n === 3) cs.nx = 'mz'; return; }
      switch (k) {
        case 'hv': cs.st = 0; cs.nx = 'mz'; break;
        case 'mz': cs.st = 0; cs.nx = 'yy'; break;
        case 'yy': cs.st = 0; add(g.yy); break;
        case 'xy': cs.dust -= 50; cs.nx = 'hs'; cs.st = 0;
          if (!legacy) { api.addAnomaly('frazzle', 2, { noDecayUntil: te + 9 }); }
          break;
        case 'lib': cs.st = 0; if (!legacy) api.addAnomaly('frazzle', 6); break;
        case 'I': add(g.I); cs.st = 0; break;
        default: cs.st = 0; break;
      }
    },
    onTeam(api, ev) { if (ev.type === 'damage') this.glCheck(api, ev.t != null ? ev.t : api.t); },
    // search heuristic (not a game rule): 尘微之声 → 旋音 + 回声
    potential(api) { const cs = api.cs, K = api.mem.modKit; return Math.min(cs.dust, 100) / 50 * 0.4 * (api.est(K.xy) + api.est(K.hs)); },
  });
  WW.registerChar(def(1502));
  return WW.registerChar(def(1501));
});
