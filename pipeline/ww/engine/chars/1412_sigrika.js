/*
 * 西格莉卡 (1412) character module — worker-B.
 *
 * 普攻 一、二、三…… (1005101):「最多4段…施放普攻第4段后进入解读状态，持续5秒…若至少拥有50点【句点】，普攻从第2段开始。
 *   处于解读状态时…普攻·明悟…本次伤害为声骸技能伤害。施放时退出解读状态。」重击 58.14%×2（施放后普攻第2段）
 * 共鸣技能 罗伊近身格斗技 (1005102):「嘭嘭！（冷却 10，之后普攻第3段）；解读状态：大嘭嘭！（声骸技能伤害）；解读且句点≥50：日灵帮帮忙（声骸技能伤害）。施放时退出解读状态」
 * 共鸣解放 如那期望般！ (1005103): 861.43% 声骸技能伤害；专注 20 秒（下次获取符文额外获得不同符文；句点 100 时不生效）
 * 固有 语义复现：变奏后 回声 20 秒（下次获取符文额外获得相同符文；优先于专注；句点 100 时不生效）
 * 固有 语义共鸣：「队伍中的角色施放声骸技能时…叠加一层语义的祝福，最多6层，同名声骸仅可触发一次…每层…登场角色气动伤害加成 +3%、声骸技能伤害加成 +3%。
 *   达到6层时，西格莉卡的气动/声骸技能伤害加成额外 +30%。共鸣效率大于125%时，每超过1%…声骸技能伤害加成 +2%，上限50%」
 * 共鸣回路 在那浩瀚中 (1005107):
 *   「重击·符语本源…消耗两枚【符文】：期望+答问→符语爆破；两枚期望→符语链刃；两枚答问→符语日灵。
 *    消耗符文时，若【日灵能量】≥30：消耗30，本次符语伤害倍率提升50%，并叠加一层「天赋？」；<30：消耗全部，每10点使本次符语伤害加深15%。
 *    「天赋？」上限2层，每层使符语与 共鸣回路·我即语义 伤害加深30%；施放我即语义后或切换角色结束。
 *    符文上限4枚，未拥有【句点】时仅可累积2枚…溢出左移；明悟/闪避反击·解读命中 → 符文·期望；大嘭嘭！/日灵帮帮忙命中 → 符文·答问。
 *    施放重击·符语本源后获得50点【句点】，上限100。附近队伍中所有角色施放声骸技能时 +10【日灵能量】（上限60，同名声骸仅一次；延奏重置记录）」
 *   我即语义：302.87%+908.61%，冷却 25 —— 施放条件原文未写明：本模块按「句点=100 时重击 → 我即语义，并清空句点」处理（低）
 * 变奏 昭日的语源 (1005106): 163.42%，之后普攻第2段；延奏 在这一瞬间 (1005109): 795%（凝语停滞未建模）
 * 「施放声骸技能」判定：队员 Q（声骸）动作或模块动作标记 echoCast（例如 仇远 1411 的答剑/技能/解放/延奏）；同名 = 同一队员同一动作 key
 * 共鸣链：1 明悟/大嘭嘭/日灵帮帮忙倍率 +70%（模块）；2 我即语义 +120%（模块）；4 队伍声骸施放时攻击 +20%（模块）；5 解放 +30%（模块）；3/6 未建模
 * 专武 昭日译注 (21040066):「造成声骸技能伤害时，气动伤害无视目标10%防御，持续6秒」→ 几乎全部伤害为声骸技能伤害，输出期间常驻（中）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21040066;
  const FU = { EQ: 'bp', QE: 'bp', EE: 'lr', QQ: 'rl' };
  const scale = (a, m, key, label) => Object.assign({}, a, { key, label, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1412, chainModeled: 5, name: '西格莉卡', version: '0.1', confidence: 'medium',
    notes: ['我即语义的施放条件未写明：按句点 100 时重击施放（低）', '凝语（延奏停滞）、闪避反击·解读未建模', '语义的祝福/日灵能量：核心 echoCast 事件（队员 Q 声骸 + 模块 echoCast 动作；同名按声骸名）（中）', '共鸣效率>125% 的声骸加成按面板实时计算'],
    audit: { role: 'dps', finishers: ['wy', 'lib'], window: 25, sig: SIG, alts: [21040015, 21040045, 21040074], solo: 'sigrika_solo.json', team: 'team_sigrika.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: One, Two, Three'), {
      mw: '普攻·Basic: Elucidated', hv: '重击·Heavy: One, Two, Three', pp: '共鸣技能·Skill 1: BOOMY BOOM!', dpp: '共鸣技能·Skill 2: BIG BOOMY BOOM!', rlb: '共鸣技能·Skill 3: Soliskin to the Aid',
      fy: '共鸣回路·Forte: Schemata of Runes', bp: '共鸣回路·Runic Outburst', lr: '共鸣回路·Runic Chain Whip', rl: '共鸣回路·Runic Soliskin', wy: '共鸣回路·Forte: Learn My True Name',
      lib: '共鸣解放·Liberation: Where Trust Leads Me!', I: '变奏入场·Intro: Solsworn Etymology', O: '延奏·Outro: In This Very Moment',
    }),
    resources: [
      { key: 'rn', name: '符文', max: 4, segmented: true, confidence: 'high', get: (cs) => cs.rn.length },
      { key: 'jd', name: '句点', max: 100, segmented: false, confidence: 'high' },
      { key: 'rlE', name: '日灵能量', max: 60, segmented: false, confidence: 'medium' },
      { key: 'tf', name: '「天赋？」', max: 2, segmented: true, confidence: 'high' },
      { key: 'yz', name: '语义的祝福', max: 6, segmented: true, confidence: 'medium', get: (cs) => cs.yz.length },
    ],
    kit(H) {
      const ch = H.chain;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '普攻', durs: [0.37, 0.68, 0.73, 1.3] }), {
        mw: H.act({ key: 'mw', cls: 'A', skill: 1, labels: ['普攻·明悟伤害'], levelKey: 'basic', dur: 1.1, label: '普攻·明悟' }),
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.7, label: '重击' }),
        pp: H.act({ key: 'pp', cls: 'E', skill: 2, labels: ['嘭嘭！伤害'], levelKey: 'skill', cooldown: 10, dur: 0.93, label: '嘭嘭！' }),
        dpp: H.act({ key: 'dpp', cls: 'E', skill: 2, labels: ['大嘭嘭！伤害'], levelKey: 'skill', dur: 0.93, label: '大嘭嘭！' }),
        rlb: H.act({ key: 'rlb', cls: 'E', skill: 2, labels: ['日灵帮帮忙伤害'], levelKey: 'skill', dur: 0.9, label: '日灵帮帮忙' }),
        fy: H.act({ key: 'fy', cls: 'H', skill: 6, labels: ['重击·符语本源伤害'], levelKey: 'forte', dur: 1.27, label: '重击·符语本源' }),
        bp: H.act({ key: 'bp', cls: 'H', skill: 6, labels: ['符语爆破伤害'], levelKey: 'forte', dur: 1.13, label: '符语爆破' }),
        lr: H.act({ key: 'lr', cls: 'H', skill: 6, labels: ['符语链刃伤害'], levelKey: 'forte', dur: 1.1, label: '符语链刃' }),
        rl: H.act({ key: 'rl', cls: 'H', skill: 6, labels: ['符语日灵伤害'], levelKey: 'forte', dur: 1.3, label: '符语日灵' }),
        wy: H.act({ key: 'wy', cls: 'H', skill: 6, labels: ['共鸣回路·我即语义伤害'], levelKey: 'forte', concertoParam: '共鸣回路·我即语义回复协奏能量', cooldown: 25, dur: 2.3, label: '我即语义' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 3.8, label: '如那期望般！' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.97 }),
        O: B.outro(H, '在这一瞬间'),
      });
      if (ch >= 1) for (const k of ['mw', 'dpp', 'rlb']) K[k] = scale(K[k], 1.7, k, K[k].label + '（链1）');
      if (ch >= 2) K.wy = scale(K.wy, (3.0287 + 9.0861 + 1.2) / (3.0287 + 9.0861), 'wy', '我即语义（链2）');
      if (ch >= 5) K.lib = scale(K.lib, (8.6143 + 0.3) / 8.6143, 'lib', K.lib.label);
      // 「语义共鸣」固有：模块按层数提供（auras / actionStats），parse 的 manual 行不再使用
      B.patch(H, /语义的祝福|共鸣效率大于125%/, { trigger: { on: 'never' }, mode: 'off' }, '模块：语义的祝福 / 共鸣效率加成由模块计算', 'inherent');
      if (H.weaponId === SIG) B.onHitAlways(H, /造成声骸技能伤害时/, 'weapon');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { rn: (st.rn || []).slice(), jd: st.jd || 0, rlE: st.rlE || 0, tf: 0, yz: [], seen: {}, st: 0, jdUntil: null, focusUntil: null, echoUntil: null, next: 0, c4Until: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const jdS = on(cs.jdUntil, t);
      switch (btn) {
        case 'A': {
          if (jdS) return { act: K.mw };
          let n = cs.next || ((cs.st % 4) + 1);
          if (n === 1 && cs.jd >= 50) n = 2;
          return { act: K['a' + n] };
        }
        case 'E':
          if (jdS) return { act: cs.jd >= 50 ? K.rlb : K.dpp };
          return api.cdReady('pp') ? { act: K.pp } : { blocked: '冷却中' };
        case 'H':
          if (cs.jd >= 100 && api.cdReady('wy')) return { act: K.wy };
          if (cs.rn.length >= 2) {
            const fu = FU[cs.rn[0] + cs.rn[1]];
            return { act: B.combo(api, ['fy', fu], { key: 'fy_' + fu, label: '重击·符语本源 + ' + K[fu].label }) };
          }
          return { act: K.hv };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [];
      if (/^fy_|^wy$/.test(act.key) && cs.tf > 0) out.push({ key: 'deep:all', value: 0.3 * cs.tf });
      if (/^fy_/.test(act.key)) {
        // 日灵能量：≥30 → 符语倍率 ×1.5；<30 → 每 10 点加深 15%。只作用于符语部分：按倍率占比折算为整个组合动作的加深（中）
        const K = api.mem.modKit, fu = K[act.key.slice(3)], sum = (a) => a.hits.reduce((x, h) => x + h.multiplier.reduce((y, m) => y + m, 0) * (h.count || 1), 0);
        const share = sum(fu) / (sum(fu) + sum(K.fy));
        const boost = cs.rlE >= 30 ? 0.5 : Math.floor(cs.rlE / 10) * 0.15;
        if (boost > 0) out.push({ key: 'deep:all', value: boost * share });
      }
      if (cs.yz.length >= 6) { out.push({ key: 'dmg:aero', value: 0.3 }); out.push({ key: 'dmg:echo', value: 0.3 }); }
      const er = (api.livePanel().raw || {}).energyRegen;
      if (er != null && er > 1.25) out.push({ key: 'dmg:echo', value: Math.min(0.5, (er - 1.25) * 2) });
      return out;
    },
    auras(api, target) {
      const cs = api.cs, t = api.t, out = [];
      if (api.s.active === target && cs.yz.length) { out.push({ key: 'dmg:aero', value: 0.03 * cs.yz.length }); out.push({ key: 'dmg:echo', value: 0.03 * cs.yz.length }); }
      if (api.H.chain >= 4 && on(cs.c4Until, t)) out.push({ key: 'atkPct', value: 0.2 });
      return out;
    },
    echoCast(api, mi, key, t) {
      const cs = api.cs, id = String(key).includes(':') ? key : mi + ':' + key;
      if (!cs.yz.includes(id) && cs.yz.length < 6) cs.yz.push(id);
      if (!cs.seen[id]) { cs.seen[id] = 1; cs.rlE = Math.min(60, cs.rlE + 10); }
      if (api.H.chain >= 4) cs.c4Until = t + 20;
    },
    // B9（核心 echoCast 事件）：任一队员施放声骸技能（Q 声骸或模块 echoCast 动作，含无伤害动作）；同名 = ev.echo
    onTeam(api, ev) {
      if (ev.type !== 'echoCast') return;
      this.echoCast(api, ev.mi, ev.echo || ev.key, ev.t != null ? ev.t : api.t);
    },
    addRune(cs, r, t) {
      const cap = cs.jd >= 50 ? 4 : 2;
      const push = (x) => { cs.rn.push(x); while (cs.rn.length > cap) cs.rn.shift(); };
      push(r);
      if (cs.jd < 100) {
        if (on(cs.echoUntil, t)) { push(r); cs.echoUntil = null; }
        else if (on(cs.focusUntil, t)) { push(r === 'E' ? 'Q' : 'E'); cs.focusUntil = null; }
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, t = api.t;
      cs.next = 0;
      if (/^a\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; if (n === 4) cs.jdUntil = te + 5; return; }
      if (/^fy_/.test(k)) {
        cs.rn.splice(0, 2);
        cs.jd = Math.min(100, cs.jd + 50);
        if (cs.rlE >= 30) { cs.rlE -= 30; cs.tf = Math.min(api.H.chain >= 3 ? 4 : 2, cs.tf + 1); } else cs.rlE = 0;
        return;
      }
      switch (k) {
        case 'mw': cs.jdUntil = null; this.addRune(cs, 'E', te); break;
        case 'dpp': case 'rlb': cs.jdUntil = null; this.addRune(cs, 'Q', te); break;
        case 'pp': cs.next = 3; break;
        case 'hv': cs.next = 2; break;
        case 'wy': cs.jd = 0; cs.tf = 0; break;
        case 'lib': cs.focusUntil = te + 20; break;
        case 'I': cs.echoUntil = te + 20; cs.next = 2; break;
        case 'O': cs.seen = {}; break;
        default: break;
      }
    },
    swapOut(api) { const cs = api.cs; cs.jdUntil = null; if (api.H.chain < 3) cs.tf = 0; },
    // search heuristic (not a game rule): 符文/句点 → 符语与我即语义
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      const fu = api.est(K.fy) + api.est(K.bp);
      return cs.rn.length / 2 * 0.9 * fu + (on(cs.jdUntil, api.t) ? 0.6 * api.est(K.mw) : 0) + cs.jd / 100 * 0.6 * api.est(K.wy) + cs.rlE / 30 * 0.3 * api.est(K.bp);
    },
  });
});
