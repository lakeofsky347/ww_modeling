/*
 * 丽贝卡 (1308) character module — worker-B.
 *
 * 普攻 混搭战术 (1004801): 猎手 / 铁胆 两种模式各 3 段普攻；重击·猎手（持续射击，模块按「吃枪子吧！」收尾 60.84%×2 建模）；重击·铁胆 202.79%
 *   战术闪避 / 空中突袭 / 闪避反击 未建模
 * 共鸣技能 战术性调整 (1004802): 猎手 → 来发大的！（切到铁胆）；铁胆 → 有本事来抓我！（切到猎手）；冷却各 1 秒
 * 共鸣解放 狂欢时间！ (1004803): 「切换为【31型重机枪】模式…9.5秒内…自动射击…此次伤害为普攻伤害」24.30% / 48.60% / 72.90%（威力提升 0/1/2 次），
 *   【过载】上限 90：命中 +2/+4/+6；「【31型重机枪】模式持续时间结束时或【过载】达到上限时，自动施放大烟花！」63.62%+572.58%
 *   → 模块：机枪阶段 = 1 个动作（尽早两次提升威力：5 发 +2、5 发 +4、10 发 +6 = 90 过载 → 大烟花），时长 5.0 秒为估计（低：射速未公开，WuwaLAB 该键为 null）
 * 共鸣回路 我要认真了！ (1004807):
 *   「处于【猎手】模式时，丽贝卡暴击伤害提升30%」「处于【铁胆】模式时，丽贝卡造成伤害无视目标15%防御」「丽贝卡初始处于【猎手】模式」
 *   【狂热】上限 120：「常态攻击造成伤害时…共鸣技能造成伤害时，回复」（量未公开 → 估计 普攻每段 10、重击 8、技能 20，低）；
 *     「施放变奏技能…并获得小孩子才做选择！时，回复50点」；满 120 → 重击 = 哒哒哒！·猎手 / 砰砰砰！·铁胆（消耗全部）
 *   【手感火热】上限 120：「每秒获得10点」「施放重击·哒哒哒！·猎手或重击·砰砰砰！·铁胆时回复40点」
 *   小孩子才做选择！：手感火热满时施放变奏或共鸣技能 → 12 秒同时获得两种模式加成；「每秒消耗10点【手感火热】」且不回复
 *   骇破·偏移：变奏 / 哒哒哒 / 砰砰砰 / 大烟花 → api.applyTune('hack','shift', 10)（偏移持续时间未给出 → 10 秒，只用于触发「附加骇破·偏移时」类增益，同 1511）
 *   骇破响应·熔触（谐度破坏）未建模（B4）
 * 固有 该你了！：「每次获得小孩子才做选择！效果或者施放重击·哒哒哒！·猎手和重击·砰砰砰！·铁胆时，攻击提升10%，持续12秒，可叠加2层」→ 模块触发
 * 固有 有破绽！：「施放共鸣解放·狂欢时间！时，附近队伍中所有角色攻击提升20%，持续30秒」（解析 buff）
 * 变奏 到我了！：按模式两种变奏（同样切换模式）
 * 延奏 好搭档：「下一位登场角色获得浪客羁绊，全伤害加深15%，持续14秒」（解析 buff，incoming）；
 *   「每0.2秒会获得1层超限，造成重击伤害加深0.5%（若是露西持有浪客羁绊，则直接获得满层），上限为35%」→ 模块按时间累积层数（露西直接 70 层）；
 *   机枪塔 2.5%/次（攻击频率未公开）未建模（低）
 * 动作帧：WuwaLAB（按原样映射）
 * 专武 碎骨 (21030066)：解析（附加骇破·偏移触发 → 由 applyTune 触发）
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const KR = { h1: 10, h2: 10, h3: 10, g1: 10, g2: 10, g3: 10, hH: 8, gH: 8, bb: 20, cm: 20 };
  // 手感火热：平时 +10/秒；小孩子才做选择！期间 −10/秒、不回复，结束后恢复回复
  const sgAt = (cs, t) => {
    if (cs.xhUntil == null) return Math.min(120, cs.sg + 10 * Math.max(0, t - cs.sgT));
    const te = Math.min(t, cs.xhUntil), v = Math.max(0, cs.sg - 10 * Math.max(0, te - cs.sgT));
    return t <= cs.xhUntil ? v : Math.min(120, v + 10 * (t - cs.xhUntil));
  };
  return WW.registerChar({
    id: 1308, chainModeled: 0, name: '丽贝卡', version: '0.1', confidence: 'medium',
    notes: ['狂热回复量为估计（低）', '31型重机枪阶段：尽早两次提升威力，20 发达到 90 过载 → 大烟花；时长 5.0 秒为估计（低）', '骇破·偏移持续 10 秒（未给出）；骇破响应·熔触未建模', '机枪塔伤害未建模（低）', '战术闪避 / 闪避反击 / 空中突袭未建模', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['rtt', 'fw'], window: 25, sig: 21030066, alts: [21030024, 21030064, 21030056], solo: 'rebecca_solo.json', team: 'team_rebecca.json', teamMi: 1 },
    frames: {
      h1: '普攻·Basic: Huntress 1', h2: '普攻·Basic: Huntress 2', h3: '普攻·Basic: Huntress 3',
      g1: '普攻·Basic: Guts 1', g2: '普攻·Basic: Guts 2', g3: '普攻·Basic: Guts 3',
      hH: '重击·Heavy 2: Eat Lead!', gH: '重击·Heavy 3: Guts', rtt: '共鸣回路·Forte: Rat-tat-tat!', bbb: '共鸣回路·Forte: Bang-bang-bang!',
      bb: "共鸣技能·Skill 1: It's Big Boomin' Time!", cm: "共鸣技能·Skill 2: Come 'n' Get Me!",
      lib: "共鸣解放·Liberation: Party 'til Dawn!", hmg: null, fw: '共鸣解放·Liberation: BOOM! Fireworks!',
      iH: "变奏入场·Intro: Yo, It's Big Boomin' Time!", iG: "变奏入场·Intro 2: Hey, Leadhead, Come 'n' Get Me!",
    },
    resources: [
      { key: 'mode', name: '模式（0 猎手 / 1 铁胆）', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.gu ? 1 : 0) },
      { key: 'kr', name: '狂热', max: 120, segmented: false, confidence: 'low' },
      { key: 'sg', name: '手感火热', max: 120, segmented: false, confidence: 'high', get: (cs, t) => +sgAt(cs, t).toFixed(1) },
      { key: 'xh', name: '小孩子才做选择！（秒）', max: 12, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.xhUntil, t).toFixed(2) },
    ],
    kit(H) {
      const s1 = H.skill(1), s2 = H.skill(2), s3 = H.skill(3), s5 = H.skill(5), s6 = H.skill(6);
      const f = (s, lab, cnt) => s.hits.filter((h) => !h.alt && h.label === lab).map((h) => (cnt ? Object.assign({}, h, { count: cnt }) : h));
      const K = Object.assign(
        B.stages(H, { n: 3, prefix: 'h', label: (k) => '普攻·猎手第' + B.CN[k - 1] + '段伤害', durs: [0.43, 0.67, 0.7] }),
        B.stages(H, { n: 3, prefix: 'g', label: (k) => '普攻·铁胆第' + B.CN[k - 1] + '段伤害', durs: [0.93, 0.55, 1.42] }), {
          hH: H.act({ key: 'hH', cls: 'H', skill: 1, hits: f(s1, '重击·吃枪子吧！·猎手伤害'), levelKey: 'basic', dur: 0.6, label: '重击·吃枪子吧！·猎手', extra: { stamina: H.param(1, '重击·猎手耐力消耗') || 20 } }),
          gH: H.act({ key: 'gH', cls: 'H', skill: 1, hits: f(s1, '重击·铁胆伤害'), levelKey: 'basic', dur: 1.13, label: '重击·铁胆', extra: { stamina: H.param(1, '重击·铁胆耐力消耗') || 20 } }),
          rtt: H.act({ key: 'rtt', cls: 'H', skill: 6, hits: f(s6, '哒哒哒！·猎手伤害'), levelKey: 'forte', dur: 1.83, label: '重击·哒哒哒！·猎手' }),
          bbb: H.act({ key: 'bbb', cls: 'H', skill: 6, hits: f(s6, '砰砰砰！·铁胆伤害'), levelKey: 'forte', dur: 1.5, label: '重击·砰砰砰！·铁胆' }),
          bb: H.act({ key: 'bb', cls: 'E', skill: 2, hits: f(s2, '共鸣技能·来发大的！伤害'), levelKey: 'skill', cooldown: 1, cdKey: 'bb', dur: 1.45, label: '来发大的！' }),
          cm: H.act({ key: 'cm', cls: 'E', skill: 2, hits: f(s2, '共鸣技能·有本事来抓我！伤害'), levelKey: 'skill', cooldown: 1, cdKey: 'cm', dur: 1.83, label: '有本事来抓我！' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 3.0, label: '狂欢时间！' }),
          hmg: H.act({ key: 'hmg', cls: 'A', skill: 3, hits: f(s3, '【31型重机枪】伤害', 5).concat(f(s3, '【31型重机枪】威力提升1次伤害', 5), f(s3, '【31型重机枪】威力提升2次伤害', 10)), levelKey: 'liberation', dur: 5.0, label: '31型重机枪（20 发）', noConcertoFallback: true }),
          fw: H.act({ key: 'fw', cls: 'A', skill: 3, hits: f(s3, '大烟花！伤害'), levelKey: 'liberation', dur: 2.22, label: '大烟花！' }),
          iH: H.act({ key: 'iH', cls: 'I', skill: 5, hits: f(s5, '呜呼，来发大的！伤害'), levelKey: 'intro', concertoParam: '呜呼，来发大的！回复协奏能量', dur: 1.6, label: '呜呼，来发大的！' }),
          iG: H.act({ key: 'iG', cls: 'I', skill: 5, hits: f(s5, '蠢货，有本事来抓我！伤害'), levelKey: 'intro', concertoParam: '蠢货，有本事来抓我！回复协奏能量', dur: 1.48, label: '蠢货，有本事来抓我！' }),
          O: B.outro(H, '好搭档'),
        });
      B.patch(H, /该你了/, { trigger: { on: 'manual' }, mode: 'module' }, '模块：小孩子才做选择！/ 哒哒哒 / 砰砰砰 时触发', 'inherent');
      H._cx = H.findBuff((b) => b.kind === 'outro' && /超限/.test(b.text || '')).map((b) => b.id);
      B.patch(H, /每0.2秒会获得1层超限/, { trigger: { on: 'manual' }, mode: 'module', target: 'self', maxStacks: 70 }, '模块：超限按时间累积（露西直接满层）', 'outro');
      H._gx = H.findBuff((b) => b.kind === 'inherent' && /该你了/.test((b.src || '') + (b.text || ''))).map((b) => b.id);
      return K;
    },
    fillerKeys: ['h1', 'h2', 'h3'],
    init() { return { gu: false, kr: 0, sg: 0, sgT: 0, xhUntil: null, hst: 0, gst: 0, phase: null, cxMi: null, cxT0: 0, cxEnd: null };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      if (cs.phase === 'hmg') return btn === 'A' || btn === 'H' || btn === 'R' ? { act: K.hmg } : { blocked: '31型重机枪模式' };
      if (cs.phase === 'fw') return btn === 'A' || btn === 'H' || btn === 'R' ? { act: K.fw } : { blocked: '大烟花！' };
      switch (btn) {
        case 'A': return cs.gu ? { act: K['g' + ((cs.gst % 3) + 1)] } : { act: K['h' + ((cs.hst % 3) + 1)] };
        case 'H': return cs.kr >= 120 - 1e-9 ? { act: cs.gu ? K.bbb : K.rtt } : { act: cs.gu ? K.gH : K.hH };
        case 'E': { const a = cs.gu ? K.cm : K.bb; return api.cdReady(a.cdKey) ? { act: a } : { blocked: '冷却中' }; }
        case 'R': return { act: K.lib };
        case 'I': return { act: cs.gu ? K.iG : K.iH };
        default: return B.common(api, btn);
      }
    },
    // 模式加成：猎手 暴击伤害 +30%；铁胆 无视防御 15%；小孩子才做选择！期间两者兼得
    actionStats(api) {
      const cs = api.cs, xh = on(cs.xhUntil, api.t), out = [];
      if (!cs.gu || xh) out.push({ key: 'critDmg', value: 0.3 });
      if (cs.gu || xh) out.push({ key: 'defIgnore', value: 0.15 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      const addKr = (n) => { cs.kr = Math.min(120, cs.kr + n); };
      const hack = () => api.applyTune('hack', 'shift', 10);
      const gx = () => { for (const id of api.H._gx || []) api.fireBuff(id, api.mi, { duration: 12, t: te }); };
      const tryXh = () => {
        if (sgAt(cs, t) >= 120 - 1e-9 && !on(cs.xhUntil, t)) { cs.sg = 120; cs.sgT = t; cs.xhUntil = t + 12; gx(); return true; }
        return false;
      };
      if (cs.xhUntil != null && !on(cs.xhUntil, t)) { const x = cs.xhUntil; cs.sg = sgAt(cs, x); cs.sgT = x; cs.xhUntil = null; }
      if (/^h\d$/.test(k)) { cs.hst = +k.slice(1) % 3; addKr(KR[k]); return; }
      if (/^g\d$/.test(k)) { cs.gst = +k.slice(1) % 3; addKr(KR[k]); return; }
      switch (k) {
        case 'hH': case 'gH': addKr(KR[k]); break;
        case 'rtt': case 'bbb':
          cs.kr = 0; hack(); gx();
          if (cs.xhUntil == null) { cs.sg = Math.min(120, sgAt(cs, t) + 40); cs.sgT = t; }
          break;
        case 'bb': case 'cm': tryXh(); addKr(KR[k]); cs.gu = k === 'bb'; cs.hst = 0; cs.gst = 0; break;
        case 'iH': case 'iG': if (tryXh()) addKr(50); cs.gu = k === 'iH'; cs.hst = 0; cs.gst = 0; hack(); break;
        case 'lib': cs.phase = 'hmg'; break;
        case 'hmg': cs.phase = 'fw'; break;
        case 'fw': cs.phase = null; hack(); break;
        default: break;
      }
    },
    // 延奏 好搭档：超限每 0.2 秒 +1 层（露西直接 70 层），14 秒，切人结束（buff 自带 endsOnSwap）
    onOutro(api, toMi) {
      const cs = api.cs, lucy = api.ctx.members[toMi].cfg.id === 1511;
      cs.cxMi = toMi; cs.cxT0 = api.t; cs.cxEnd = api.t + 14; cs.phase = null;
      for (const id of api.H._cx || []) api.fireBuff(id, toMi, { duration: 14, stacks: lucy ? 70 : 1 });
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (cs.cxMi == null) return;
      if ((ev.type === 'swap' || ev.type === 'intro') && ev.mi !== cs.cxMi) { cs.cxMi = null; return; }
      if (ev.type !== 'damage' || ev.mi !== cs.cxMi || !on(cs.cxEnd, ev.t)) return;
      const n = Math.min(70, 1 + Math.floor((ev.t - cs.cxT0) / 0.2 + 1e-9));
      for (const id of api.H._cx || []) api.fireBuff(id, cs.cxMi, { duration: cs.cxEnd - ev.t, stacks: n, t: ev.t });
    },
    // search heuristic (not a game rule): 狂热→哒哒哒/砰砰砰；机枪阶段剩余
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (cs.phase === 'hmg') return api.est(K.hmg) + api.est(K.fw);
      if (cs.phase === 'fw') return api.est(K.fw);
      return cs.kr / 120 * 0.5 * api.est(K.rtt);
    },
  });
});
