/*
 * 绯雪 (1108) character module — stream A 批次 4。冷凝 迅刀，主C（共鸣解放伤害 + 霜冻效应）。
 *
 * 万世霜天：编队中有绯雪时，霜渐附加改为【霜冻效应】——按目标当前上限层数结算一次，满层不清空（引擎 frostbite，见 MECHANICS §6）。霜结 不建模。
 * 常世身（初始）：普攻 p1–p3（第 3 段 1 层霜渐、+100 心念；共鸣技能后下一次第 3 段额外 +100）；共鸣技能·常世身（冷却 20）；
 *   变奏 霜锋 156.15%（共鸣解放伤害，1 层，常世身 +200 心念）；心念 300 → H：重击·寒簇（共鸣解放伤害，最后一箭 1 层，消耗 300，解锁 见心）；
 *   R：预求我身·见心 397.62%（不耗能量，冷却 25，4 层）→ 武霜·居合 3、进入预求身、寒意 50。
 * 预求身：普攻 f1–f5（共鸣解放伤害；第 3/4/5 段各 1 层）；重击·预求身 107.16%；淬寒·枯霜 3 → H：重击·枯霜 15.41%×8+493.05%（1 层，+1 锻雪，+10 协奏）；
 *   E：霜罚·白玉切 66.01%×4（冷却 12）；居合：寒意 ≥100 时（A 在有 武霜 时优先 / H 在无淬寒满时）→ 居合架势+普攻·居合 283.82%+47.31%×4（消耗 100 寒意；
 *   有 武霜 → 3 层霜渐、+1 淬寒）；R：预求我身·归刃 198.81%+795.24%（+795.24%/锻雪，3 点时消耗；125 能量，冷却 25）→ 回到常世身。
 *   寒意 获取未给出 → 估计：预求身普攻 +20/段、重击·预求身 +30、白玉切 +50（低）。
 * 细雪：雪锈 = 1（自身）+ 附加过霜渐/虚湮的队友数（onTeam 'anomaly' 事件，上限 3；链3 +1）。1 层：在场时霜冻伤害加深 30%、暴击伤害 +40%；
 *   2 层：在场时自身每次附加霜渐，额外一段固定 102% 异常倍率的霜冻伤害（不随层数；链3 +488%）；3 层：再 +30% 加深。
 * 延奏 挽雪照身：其他角色对霜渐目标 冷凝伤害加深 20% 20 s（通用解析）。
 * 链：1 预求身普攻/重击 倍率 +120%；2 居合 倍率 +125%；3 寒簇/枯霜 倍率 +160%、开局 +1 雪锈、2 层额外倍率 +488%；4 E/白玉切 全队伤害 +20% 30 s（模块）；
 *   5 E/白玉切 倍率 +80%；6 见心/归刃 暴击伤害 +500%、2 层雪锈 暴击伤害 +40%（队友附加触发 2 层效果未建模）→ chainModeled 5。
 * 动作帧：WuwaLAB（Hiyuki）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const SIG = 21020086; // 灼霜
  const COLD = { f1: 20, f2: 20, f3: 20, f4: 20, f5: 20, fh: 30, jade: 50 };
  const CHAFE = { p3: 1, I: 1, I2: 1, splinter: 1, vision: 4, f3: 1, f4: 1, f5: 1, bitter: 1 };
  return WW.registerChar({
    id: 1108, chainModeled: 5, frostbite: true, name: '绯雪', version: '0.1', confidence: 'low',
    notes: ['寒意 获取量为估计（低）', '霜冻效应：霜渐附加按上限层数结算（引擎 frostbite），霜结 不建模', '雪锈 2 层额外霜冻伤害 = 固定 102% 异常倍率（游戏文本，高）', '空中攻击/闪避反击/沉息 不建模'],
    audit: { role: 'dps', finishers: ['vision', 'blade', 'iaiS'], window: 25, sig: SIG, alts: [21020015, 21020016, 21020056], solo: 'hiyuki_solo.json', team: 'team_hiyuki.json', teamMi: 0, anomaly: ['chafe'] },
    frames: Object.assign(B.stageFrames('p', 3, '普攻·Basic: Present Self'), B.stageFrames('f', 5, '普攻·Basic: Foreclaimed Self'), {
      splinter: '重击·Heavy: Frost Splinter', fh: '重击·Heavy: Foreclaimed Self', bitter: '重击·Heavy: Bitterfrost', E: '共鸣技能·Skill: Present Self', jade: '共鸣技能·Skill: Jade Cleave',
      vision: '共鸣解放·Liberation: Inward Vision', blade: '共鸣解放·Liberation: Blade Liberation', iai: null, iaiS: null,
      I: '变奏入场·Intro: Frostedge - Present Self', I2: '变奏入场·Intro 2: Frostedge - Foreclaimed Self',
    }),
    resources: [
      { key: 'fore', name: '预求身', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.fore ? 1 : 0) },
      { key: 'mind', name: '心念', max: 300, segmented: false, confidence: 'high' },
      { key: 'cold', name: '寒意', max: 300, segmented: false, confidence: 'low' },
      { key: 'wu', name: '武霜·居合', max: 3, segmented: true, confidence: 'high' },
      { key: 'cui', name: '淬寒·枯霜', max: 3, segmented: true, confidence: 'high' },
      { key: 'duan', name: '锻雪·归刃', max: 3, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 3, prefix: 'p', pre: '普攻·常世身', durs: [0.53, 0.63, 0.88] }), B.stages(H, { n: 5, prefix: 'f', pre: '普攻·预求身', durs: [0.37, 0.58, 1.23, 1.08, 1.37] }), {
        splinter: H.act({ key: 'splinter', cls: 'H', skill: 1, labels: ['重击·寒簇·常世身伤害'], levelKey: 'basic', dur: 2.2, label: '重击·寒簇' }),
        fh: H.act({ key: 'fh', cls: 'H', skill: 1, labels: ['重击·预求身伤害'], levelKey: 'basic', dur: 0.78, label: '重击·预求身' }),
        bitter: H.act({ key: 'bitter', cls: 'H', skill: 1, labels: ['重击·枯霜·预求身伤害'], levelKey: 'basic', concertoParam: '重击·枯霜·预求身回复协奏能量', dur: 2.5, label: '重击·枯霜' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['共鸣技能·常世身伤害'], levelKey: 'skill', cooldown: 20, cdKey: 'E', dur: 1.42, label: '共鸣技能·常世身' }),
        jade: H.act({ key: 'jade', cls: 'E', skill: 2, labels: ['霜罚·白玉切伤害'], levelKey: 'skill', cooldown: 12, cdKey: 'jade', dur: 0.65, label: '霜罚·白玉切' }),
        vision: H.act({ key: 'vision', cls: 'R', skill: 3, labels: ['预求我身·见心伤害'], levelKey: 'liberation', concertoParam: '预求我身·见心回复协奏能量', cooldown: 25, cdKey: 'Rv', dur: 4.0, label: '预求我身·见心' }),
        blade: H.act({ key: 'blade', cls: 'R', skill: 3, labels: ['预求我身·归刃基础伤害'], levelKey: 'liberation', concertoParam: '预求我身·归刃回复协奏能量', cost: lc, cooldown: 25, cdKey: 'Rb', dur: 6.0, label: '预求我身·归刃' }),
        iai: H.act({ key: 'iai', cls: 'A', skill: 6, labels: ['普攻·居合伤害'], levelKey: 'forte', dur: 0.68, label: '普攻·居合' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.07, label: '霜锋' }),
        O: B.outro(H, '挽雪照身'),
      });
      K.iaiS = Object.assign({}, K.iai, { key: 'iaiS', label: '居合架势 + 普攻·居合', dur: 1.18 });
      K.I2 = Object.assign({}, K.I, { key: 'I2', dur: 1.13, label: '霜锋（预求身）' });
      // 归刃 每点锻雪 +795.24%（同一命中行的倍率提升，actionStats multUp 相对基础 198.81%+795.24%）
      if (H.weaponId === SIG) H.patchBuff((b) => b.kind === 'weapon' && b.stats.some((x) => x.key === 'deep:glacio'), { target: 'self' }, '模块：灼霜 冷凝加深为自身（解析误判为全队）');
      B.patch(H, /细雪|万世霜天|无常世/, { mode: 'off' }, '模块处理（雪锈/霜冻）', 'inherent');
      H.buff({ id: 'rust1', name: '雪锈·暴击伤害', stats: [{ key: 'critDmg', value: 0.4 }], trigger: { on: 'always' }, mode: 'on', duration: null, text: '1 层雪锈（自身附加霜渐即获得，常驻）：暴击伤害 +40%' });
      if (ch >= 4) { B.patch(H, /有如苇草浮沉/, { mode: 'off' }, '模块', 'chain'); H.buff({ id: 'c4', name: '链4·全队伤害', stats: [{ key: 'dmg:all', value: 0.2 }], duration: 30, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链4' }); }
      B.patch(H, /不见春|于无声处|我身无我|千祈万愿|纵使前路/, { mode: 'off' }, '模块处理', 'chain');
      return K;
    },
    fillerKeys: ['p1', 'p2', 'p3', 'f1', 'f2', 'f3', 'f4', 'f5'],
    init(api) {
      const s = api.H.opts.start || {};
      return { fore: false, st: 0, fst: 0, mind: s.mind || 0, cold: 0, wu: 0, cui: 0, duan: 0, eBoost: false, unlock: false, stance: false, rustMates: {}, rustSet: false };
    },
    rust(api) { const n = 1 + Object.keys(api.cs.rustMates).length + (api.H.chain >= 3 ? 1 : 0); return Math.min(3, n); },
    chafe(api, n, t) {
      const cs = api.cs; if (!n) return;
      api.addAnomaly('chafe', n, { t });
      if (this.rust(api) >= 2 && api.onField) api.detonateAnomaly('chafe', { stacks: 'cap', scale: 0, addMult: 1.02 + (api.H.chain >= 3 ? 4.88 : 0), remove: 0, label: '雪锈·额外霜冻', kind: 'tick', t }); // 固定 102% 异常倍率（链3 +488%），不乘层数表
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      if (!cs.fore) {
        switch (btn) {
          case 'A': return { act: K['p' + ((cs.st % 3) + 1)] };
          case 'H': return cs.mind >= 300 - 1e-9 ? { act: K.splinter } : { blocked: '心念不足 300' };
          case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
          case 'R': return cs.unlock ? { act: K.vision } : { blocked: '需先施放 重击·寒簇' };
          case 'I': return { act: K.I };
          default: return B.common(api, btn);
        }
      }
      switch (btn) {
        case 'A':
          if (cs.wu > 0 && cs.cold >= 100 - 1e-9) return { act: cs.stance ? K.iai : K.iaiS };
          return { act: K['f' + ((cs.fst % 5) + 1)] };
        case 'H':
          if (cs.cui >= 3) return { act: K.bitter };
          if (cs.cold >= 100 - 1e-9) return { act: cs.stance ? K.iai : K.iaiS };
          return { act: K.fh };
        case 'E': return api.cdReady('jade') ? { act: K.jade } : { blocked: '冷却中' };
        case 'R': return { act: K.blade };
        case 'I': return { act: K.I2 };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, ch = api.H.chain, k = act.key, out = [];
      let up = 0;
      if (k === 'blade' && cs.duan >= 3) up += 3 * 7.9524 / (1.9881 + 7.9524);
      if (ch >= 1 && (/^f\d$/.test(k) || k === 'fh')) up += 1.2;
      if (ch >= 2 && /^iai/.test(k)) up += 1.25;
      if (ch >= 3 && (k === 'splinter' || k === 'bitter')) up += 1.6;
      if (ch >= 5 && (k === 'E' || k === 'jade')) up += 0.8;
      if (up) out.push({ key: 'multUp', value: up });
      if (ch >= 6 && (k === 'vision' || k === 'blade')) out.push({ key: 'critDmg', value: 5 });
      if (ch >= 6 && this.rust(api) >= 2) out.push({ key: 'critDmg', value: 0.4 });
      return out;
    },
    anomalyStats(api, type) {
      if (type !== 'chafe' || !api.onField) return [];
      const r = this.rust(api); return [{ key: 'deep:anomaly:chafe', value: 0.3 + (r >= 3 ? 0.3 : 0) }];
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      if (CHAFE[k]) this.chafe(api, CHAFE[k], te);
      if (/^p\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (n === 3) { cs.mind = Math.min(300, cs.mind + 100 + (cs.eBoost ? 100 : 0)); cs.eBoost = false; } return; }
      if (/^f\d$/.test(k)) { const n = +k.slice(1); cs.fst = n % 5; cs.cold = Math.min(300, cs.cold + COLD[k]); cs.stance = false; return; }
      switch (k) {
        case 'E': cs.eBoost = true; cs.st = 2; if (ch >= 4) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c4', j, { t: te }); break;
        case 'I': cs.mind = Math.min(300, cs.mind + 200); cs.st = 2; break;
        case 'I2': cs.fst = 1; cs.stance = false; break;
        case 'splinter': cs.mind = 0; cs.unlock = true; cs.st = 0; break;
        case 'vision': cs.wu = 3; cs.mind = 0; cs.cold = 50; cs.fore = true; cs.unlock = false; cs.fst = 0; cs.stance = false; break;
        case 'fh': cs.cold = Math.min(300, cs.cold + COLD.fh); cs.fst = 1; cs.stance = false; break;
        case 'jade': cs.cold = Math.min(300, cs.cold + COLD.jade); cs.stance = false; if (ch >= 4) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c4', j, { t: te }); break;
        case 'iai': case 'iaiS':
          cs.cold = Math.max(0, cs.cold - 100); cs.stance = cs.cold >= 100 - 1e-9;
          if (cs.wu > 0) { cs.wu--; cs.cui = Math.min(3, cs.cui + 1); this.chafe(api, 3, te); }
          break;
        case 'bitter': cs.cui = 0; cs.duan = Math.min(3, cs.duan + 1); cs.stance = false; break;
        case 'blade': if (cs.duan >= 3) cs.duan = 0; cs.mind = 0; cs.cold = 0; cs.fore = false; cs.st = 0; cs.stance = false; break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type === 'anomaly' && ev.mi !== api.mi && (ev.kind === 'chafe' || ev.kind === 'bane')) api.cs.rustMates[ev.mi] = 1; // plain object: module state is deep-copied (Set would not survive)
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.3 * (cs.mind / 300) * api.est(K.vision) + 0.4 * (cs.duan / 3) * api.est(K.blade) + 0.3 * (cs.cui / 3) * api.est(K.bitter) + 0.3 * cs.wu * api.est(K.iai);
    },
  });
});
