/*
 * 景燃 (1212) character module — stream A 批次 4。热熔 长刃，生命成长主C（重击）。
 *
 * 炁机斡旋：抱阳（初始）/ 负阴。普攻 抱阳＝灭煞 g1–4、负阴＝摄召 y1–4；第 3、4 段 +50 炁，伤害为重击伤害。
 * 共鸣技能：负阴 阴蚀骨 / 抱阳 阳焚身（各自冷却 15），获得 破秽 4 s 与 画地 15 s；破秽期间 A → 黄泉渡 / 往生送（重击伤害，+100 炁，结束破秽）。
 * 重击：炁 300 → 劫魄（负阴→抱阳）/ 踏罡（抱阳→负阴）；有 行途 时 +200 炁、行途 −1；荧惑中且 命火>0：消耗 25 命火，
 *   倍率 +（每 1000 生命：劫魄 21.1% / 踏罡 21.65%）× min(25, (生命−25000)/1000)（引擎 multUp，相对基础倍率）；荧惑中每次重击召唤 魑魅魍魉 83.51%（重击伤害）。
 * 共鸣解放 万鬼同葬：93.15%×8（重击伤害），125 能量，冷却 25；+100 命火、+200 炁、3 行途、荧惑 15 s（结束时清空命火）。
 * 变奏 挑灯问冢 198.81%：+100 炁，消耗全部【鬼护】转为同层 祸兮福兮（每层 热熔 +min(2.5%, 0.05%×生命/1000)，15 s，切人结束）；获得 画地。
 * 鬼护：开局 25（扫痕观迹）；画地 期间在场造成伤害获得护盾 → +1 / 0.5 s；队友获得护盾（'shield' 事件）+2（0.5 s），持有 敛神 时另 +15 并移除（延奏/开局获得 敛神）。上限 50。
 * 幽而复明 / 阳变阴合：防御 0（不影响输出）；热熔 +1.5%/1000 生命（≤75%）、攻击 +36/1000 生命（≤1800）→ actionStats 按实时面板生命计算。
 * 延奏 收山出煞：795% 攻击 热熔伤害。
 * 链：1 共鸣技能/黄泉渡/往生送 倍率 +80%；2 劫魄/踏罡 倍率 +46%、命火加成 ×1.46、进入战斗 300 炁 + 通幽（首次劫魄/踏罡回复 25% 能量上限，重击伤害加深 180% 4 s）；
 *   3–6 未建模 → chainModeled 2。
 * 未建模：闪避反击（+100 炁）、潜影、空中攻击；护盾数值本身（不计输出）。
 * 动作帧：WuwaLAB（Jingran）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21010076; // 千般渡
  const HEAVYK = { hj: { base: 2.3429, perK: 0.211 }, ht: { base: 2.4038, perK: 0.2165 } };
  return WW.registerChar({
    id: 1212, chainModeled: 2, name: '景燃', version: '0.1', confidence: 'medium',
    notes: ['鬼护 获取按 画地 护盾 1/0.5 s 在场近似（中）', '闪避反击/潜影/空中攻击 不建模', '链 3–6 未建模', '专武 千般渡：承天/载物 需在场获得护盾，画地 期间视为常驻（中）'],
    audit: { role: 'dps', finishers: ['hj', 'ht', 'lib'], window: 25, sig: SIG, alts: [21010016, 21010026, 21010046], solo: 'jingran_solo.json', team: 'team_jingran.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('y', 4, '普攻·Basic: Drink Soul'), B.stageFrames('g', 4, "普攻·Basic: Devil's Bane"), {
      hj: '重击·Heavy 1: Soul Raid', ht: '重击·Heavy 2: Stardome Meander',
      Ey: '共鸣技能·Skill 1: Encroaching Yin', fy: '共鸣技能·Skill 2: Netherworld Traverse', Eg: '共鸣技能·Skill 3: Scorching Yang', fg: "共鸣技能·Skill 4: Afterlife's Guide",
      lib: '共鸣解放·Liberation: Burial of Thousand Souls', ghost: null, I: '变奏入场·Intro: Question the Tombs',
    }),
    resources: [
      { key: 'yin', name: '负阴', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.yin ? 1 : 0) },
      { key: 'qi', name: '炁', max: 300, segmented: false, confidence: 'high' },
      { key: 'fire', name: '命火', max: 100, segmented: false, confidence: 'high' },
      { key: 'way', name: '行途', max: 3, segmented: true, confidence: 'high' },
      { key: 'gh', name: '鬼护', max: 50, segmented: false, confidence: 'medium' },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const st = (pre, durs) => B.stages(H, { n: 4, prefix: pre === '普攻·摄召' ? 'y' : 'g', pre, durs });
      const K = Object.assign(st('普攻·摄召', [0.33, 0.55, 0.77, 1.35]), st('普攻·灭煞', [0.33, 0.72, 1.12, 0.87]), {
        hj: H.act({ key: 'hj', cls: 'H', skill: 6, labels: ['重击·劫魄伤害'], levelKey: 'forte', dur: 1.35, label: '重击·劫魄' }),
        ht: H.act({ key: 'ht', cls: 'H', skill: 6, labels: ['重击·踏罡伤害'], levelKey: 'forte', dur: 1.5, label: '重击·踏罡' }),
        Ey: H.act({ key: 'Ey', cls: 'E', skill: 2, labels: ['阴蚀骨伤害'], levelKey: 'skill', cooldown: 15, cdKey: 'Ey', dur: 0.8, label: '阴蚀骨' }),
        Eg: H.act({ key: 'Eg', cls: 'E', skill: 2, labels: ['阳焚身伤害'], levelKey: 'skill', cooldown: 15, cdKey: 'Eg', dur: 0.78, label: '阳焚身' }),
        fy: H.act({ key: 'fy', cls: 'E', skill: 2, labels: ['黄泉渡伤害'], levelKey: 'skill', dur: 1.33, label: '黄泉渡' }),
        fg: H.act({ key: 'fg', cls: 'E', skill: 2, labels: ['往生送伤害'], levelKey: 'skill', dur: 1.32, label: '往生送' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['万鬼同葬伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 4.67, label: '万鬼同葬' }),
        ghost: H.act({ key: 'ghost', cls: 'R', skill: 3, labels: ['魑魅魍魉伤害'], levelKey: 'liberation', label: '魑魅魍魉' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.05, label: '挑灯问冢' }),
      });
      // 普攻 3/4 段、黄泉渡/往生送、解放、魑魅魍魉 在 ww.json 中已是 type=heavy。延奏 无伤害行 → 按描述 795% 攻击 热熔 补一行（低）
      const ih = K.I.hits[0];
      K.O = { key: 'O', cls: 'O', skill: 11, label: '收山出煞', level: 1, levelKey: 'outro', energy: 0, concerto: 0, cooldown: 0,
        hits: [Object.assign({}, ih, { label: '收山出煞', multiplier: [7.95], count: 1, type: 'outro', element: 'fusion', scaling: 'atk', energy: [0], concerto: [0], confidence: 'low', lowReason: 'ww.json 无延奏伤害行，按描述“795%攻击的热熔伤害”' })] };
      H.buff({ id: 'woe', name: '祸兮福兮', stats: [{ key: 'dmg:fusion', value: 0.025 }], maxStacks: 50, duration: 15, endsOnSwap: true, trigger: { on: 'manual' }, mode: 'module', text: '每层祸兮福兮 热熔 +（0.05%×生命/1000，≤2.5%），15 s，切人结束（按 2.5% 每层；生命 <50000 时由 actionStats 扣回）' });
      if (ch >= 2) H.buff({ id: 'c2deep', name: '通幽·重击加深', stats: [{ key: 'deep:heavy', value: 1.8 }], duration: 4, trigger: { on: 'manual' }, mode: 'module', text: '链2 通幽：劫魄/踏罡 伤害加深 180% 4 s' });
      B.patch(H, /幽而复明|阳变阴合|炁机斡旋|命火|祸兮福兮|画地|鬼护|敛神/, { mode: 'off' }, '模块处理（生命成长 / 资源）');
      B.patch(H, /阴阳其和|孤灯踩影|乾道变化|虚实莫辨|原始反终|恩仇了了/, { mode: 'off' }, '模块处理 / 未建模', 'chain');
      if (H.weaponId === SIG) B.onHitAlways(H, /承天|载物|召鬼呼星/, 'weapon');
      return K;
    },
    fillerKeys: ['g1', 'g2', 'g3', 'g4', 'y1', 'y2', 'y3', 'y4'],
    init(api) {
      const s = api.H.opts.start || {}, ch = api.H.chain;
      return { yin: false, st: 0, qi: s.qi != null ? s.qi : (ch >= 2 ? 300 : 0), fire: 0, way: 0, ying: null, gh: 25, lian: true, ghT: -1, poHui: null, huadi: null, woe: 0, tongyou: ch >= 2 };
    },
    hp(api) { const p = api.livePanel(); return p && p.hp ? p.hp : 0; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      switch (btn) {
        case 'A':
          if (on(cs.poHui, t)) return { act: cs.yin ? K.fy : K.fg };
          return { act: K[(cs.yin ? 'y' : 'g') + ((cs.st % 4) + 1)] };
        case 'H':
          if (cs.qi < 300 - 1e-9) return { blocked: '炁不足 300' };
          return { act: cs.yin ? K.hj : K.ht };
        case 'E': { const k = cs.yin ? 'Ey' : 'Eg'; return api.cdReady(k) ? { act: K[k] } : { blocked: '冷却中' }; }
        case 'R': return { act: K.lib };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, ch = api.H.chain, hp = this.hp(api), k = hp / 1000, out = [];
      out.push({ key: 'atkFlat', value: Math.min(1800, 36 * k) }, { key: 'dmg:fusion', value: Math.min(0.75, 0.015 * k) });
      // 祸兮福兮 每层 0.05%/1000 生命（≤2.5%）：buff 按 2.5% 记，这里扣回差额
      if (cs.woe > 0 && on(api.buffInst('woe') ? api.buffInst('woe').until : null, api.t)) out.push({ key: 'dmg:fusion', value: -cs.woe * (0.025 - Math.min(0.025, 0.0005 * k)) });
      if (HEAVYK[act.key]) {
        let up = ch >= 2 ? 0.46 : 0;
        if (on(cs.ying, api.t) && cs.fire > 0) up += HEAVYK[act.key].perK * Math.min(25, Math.max(0, k - 25)) * (ch >= 2 ? 1.46 : 1) / HEAVYK[act.key].base;
        if (up) out.push({ key: 'multUp', value: up });
      }
      if (ch >= 1 && /^(Ey|Eg|fy|fg)$/.test(act.key)) out.push({ key: 'multUp', value: 0.8 });
      return out;
    },
    ghGain(api, n) { const cs = api.cs; cs.gh = Math.min(50, cs.gh + n); },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      // 画地：在场造成伤害获得护盾 → 鬼护 +1 / 0.5 s
      if (on(cs.huadi, api.t) && act.hits && act.hits.length) { const n = Math.max(1, Math.floor((te - Math.max(api.t, cs.ghT + 0.5)) / 0.5) + 1); this.ghGain(api, n); cs.ghT = te; }
      if (/^[yg]\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; if (n >= 3) cs.qi = Math.min(300, cs.qi + 50); return; }
      switch (k) {
        case 'Ey': case 'Eg': cs.poHui = te + 4; cs.huadi = te + 15; cs.st = 0; break;
        case 'fy': case 'fg': cs.poHui = null; cs.qi = Math.min(300, cs.qi + 100); cs.st = 1; break;
        case 'hj': case 'ht':
          cs.qi = 0; if (cs.way > 0) { cs.way--; cs.qi = 200; }
          if (on(cs.ying, api.t)) { if (cs.fire > 0) cs.fire = Math.max(0, cs.fire - 25); api.deal(api.mem.modKit.ghost, { t: te, coordAttack: false }); }
          if (cs.tongyou) { cs.tongyou = false; api.addEnergy(api.mi, 0.25 * api.H.R.energy.liberationCost); api.fireBuff('c2deep', api.mi, { t: api.t }); }
          cs.yin = k === 'ht'; cs.poHui = null; cs.st = 1;
          break;
        case 'lib': cs.fire = 100; cs.qi = Math.min(300, cs.qi + 200); cs.way = 3; cs.ying = te + 15; cs.st = 0; break;
        case 'I':
          cs.qi = Math.min(300, cs.qi + 100); cs.huadi = te + 15;
          cs.woe = Math.round(cs.gh); cs.gh = 0;
          if (cs.woe > 0) api.fireBuff('woe', api.mi, { t: te, stacks: cs.woe });
          cs.st = 1; break;
        case 'O': cs.lian = true; break;
        default: break;
      }
      if (cs.ying != null && !on(cs.ying, te)) { cs.fire = 0; }
    },
    onTeam(api, ev) {
      if (ev.type !== 'shield' || ev.mi === api.mi) return;
      const cs = api.cs;
      if (ev.t - (cs.shT == null ? -9 : cs.shT) >= 0.5) { cs.shT = ev.t; this.ghGain(api, 2); }
      if (cs.lian) { cs.lian = false; this.ghGain(api, 15); }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.5 * (cs.qi / 300) * api.est(cs.yin ? K.hj : K.ht) + (on(cs.ying, api.t) ? 0.5 * cs.way * api.est(K.ht) : 0);
    },
  });
});
