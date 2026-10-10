/*
 * 嘉贝莉娜 (1208) character module. 热熔 佩枪，重击/声骸技能伤害主C。
 *
 * 普攻 猎魔扳机 (1004001): 「进行最多4段的连续攻击…普攻第1、2、3段伤害为重击伤害，普攻第4段伤害为声骸技能伤害。施放普攻第4段后…短按普攻，可施放普攻第2段。」
 *   「重击·燧发杀戮…最多3段…第3段伤害为声骸技能伤害。施放第1段后…短按普攻，可施放普攻第2段。施放第2、3段后…短按普攻，可施放普攻第3段。」 耐力 10/10/10
 * 共鸣技能 边缘翼动 (1004002): 迫近（冷却 5）；「【罪火】达到100点时，共鸣技能替换为共鸣技能·恶翼扬升…进入恶魔位格。【罪火】转化为等值的【净炼火】。可衔接普攻·炽天猎杀第2段。」（冷却 13）
 * 共鸣解放 炼净 (1004003): 「…此次伤害为声骸技能伤害，并使恶魔位格期间，普攻·炽天猎杀、重击·炼羽裁决、空中攻击·火狱暴雨、闪避反击·罪业当涤的伤害倍率提升85%，持续14秒。」
 *   → 引擎 multUp（单次动作倍率相对提升，见 MECHANICS §9）0.85，仅恶魔位格的 dA/dH。
 * 共鸣回路 超阈限 (1004007):
 *   「恶魔位格期间…普攻、重击…共鸣技能·迫近替换为普攻·炽天猎杀、重击·炼羽裁决…共鸣技能·掠袭，替换后的技能命中目标时消耗【净炼火】。」「消耗完【净炼火】时…将退出恶魔位格。」
 *   「恶魔位格期间，每点【余火】会使目标受到嘉贝莉娜的普攻·炽天猎杀、重击·炼羽裁决…共鸣技能·掠袭…伤害提升1.5%，至多提升至60%」→ deep:all（目标易伤，与加深相加，社区约定同 deepenTarget）
 *   「普攻·炽天猎杀…最多5段…第1、2、3段伤害为重击伤害，第4、5段伤害为声骸技能伤害。施放第5段后，短按普攻可施放第3段。」
 *   「内燃烧：施放变奏技能、地狱穿行、普攻·炽天猎杀第4段、共鸣技能·迫近、恶翼扬升、掠袭时，攻击提升20%…持续4秒。」（链2 ×4.5）
 *   「【余火】上限40点。阈限状态期间，附近队伍中所有角色施放声骸技能时，嘉贝莉娜回复8点【余火】，同名声骸只可触发1次…退出恶魔位格时，清除所有【余火】。」
 *   「【罪火】上限100点。阈限状态期间，普攻，重击·燧发杀戮，空中攻击…共鸣技能·迫近，变奏技能·永火上膛命中目标时，回复【罪火】。」
 *   → 【罪火】逐段获取、【净炼火】逐段消耗数据中没有。按 Prydwen 标准循环校准（低）：
 *     https://www.prydwen.gg/wuthering-waves/characters/galbrena 「Intro→Basic 2→Basic 3→Heavy 1→Heavy 2→Heavy 3→Hellstride→Heavy 1→Heavy 2→Skill: Ascent of Malice」恰好 100；
 *     「Starting from max Forte… 2 full Basic 3,4,5 combos can be executed (alongside a Basic 2)」→ dA2 10 + 2×(15+15+15) = 100。
 * 固有 誓猎: 「…命中目标时，会为目标叠加一层死运既定，每层使嘉贝莉娜的…造成的伤害加深5%，可叠加4层，持续5.5秒。同种类型的技能，对同一目标5秒内只能叠加一次。」
 *   → 类型：变奏 / 普攻（阈限普攻·重击）/ 共鸣回路（炽天猎杀·炼羽裁决）/ 共鸣技能（迫近·恶翼·掠袭）/ 共鸣解放；动作结束时叠层，下一动作生效（中）。
 * 延奏 驱猎逐烬: 「造成嘉贝莉娜79.5%*3+556.5%攻击的热熔伤害。」→ ww.json 行无元素/类型（低），模块补 热熔/延奏伤害。
 * 武器 光影双生 (21030036): 「造成声骸技能伤害时，重击伤害加深24%，持续6秒；造成重击伤害时，声骸技能伤害加深24%…同时拥有两种效果时，造成伤害时无视目标8%防御。」
 *   → 按本动作命中行的伤害类型触发（通用解析误判为“施放声骸技能/重击”，改为模块）。
 * 未建模：地狱穿行（固定伤害 666，闪避取消）、闪避反击·罪业当涤、空中攻击；食罪耐力回复。帧数据：action_frames 第 3 轮 WuWaSim（可接下一动作口径），解放为模块估计。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN } = C;
  const SIG = 21030036;
  const SIN = { I: 17, A1: 8, A2: 10, A3: 10, A4: 12, H1: 11, H2: 13, H3: 15, E: 8 };
  const PF = { dA1: 8, dA2: 10, dA3: 15, dA4: 15, dA5: 15, dH1: 10, dH2: 10, dH3: 15, dE: 10 };
  const FTYPE = (k) => (k === 'I' ? 'I' : /^d[AH]/.test(k) ? 'F' : /^[AH]\d$/.test(k) ? 'A' : (k === 'E' || k === 'eyi' || k === 'dE') ? 'E' : k === 'R' ? 'R' : null);
  const FORM = (k) => /^d[AH]|^dE$/.test(k);
  return WW.registerChar({
    id: 1208, chainModeled: 6, name: '嘉贝莉娜', version: '0.1', confidence: 'low',
    notes: ['【罪火】获取/【净炼火】消耗为估计（低），按 Prydwen 标准循环校准', '余火易伤按 deep:all 相加（社区：Prydwen 称其为独立 DMG Taken 乘区，此处与加深相加，偏保守）',
      '动作时长取自 WuWaSim（3.6 客户端导出，“可接下一动作”口径）；共鸣解放无条目 → 模块估计 2.3 s', '地狱穿行/闪避反击/空中攻击未建模；余火来源 = 自身/队友声骸技能（同一队员计一次）'],
    audit: { role: 'dps', finishers: ['eyi', 'dA5'], window: 25, sig: SIG, alts: [21030045, 21030046, 21030016], solo: 'galbrena_solo.json', team: 'team_galbrena.json', teamMi: 0 },
    // action_frames round 3: WuWaSim (3.6 client) — duration = time until the next action can start; R has no entry (module estimate)
    frames: {
      A1: '普攻·basic_basic_attack_1 [WuWaSim]',
      A2: '普攻·basic_basic_attack_2 [WuWaSim]',
      A3: '普攻·basic_basic_attack_3 [WuWaSim]',
      A4: '普攻·basic_basic_attack_4 [WuWaSim]',
      H1: '重击·heavy_volley_of_death_1 [WuWaSim]',
      H2: '重击·heavy_volley_of_death_2 [WuWaSim]',
      H3: '重击·heavy_volley_of_death_3 [WuWaSim]',
      dA1: '共鸣回路·forte_basic_seraphic_execution_1 EX普攻1 [WuWaSim]',
      dA2: '共鸣回路·forte_basic_seraphic_execution_2 EX普攻2 [WuWaSim]',
      dA3: '共鸣回路·forte_basic_seraphic_execution_3 EX普攻3 [WuWaSim]',
      dA4: '共鸣回路·forte_basic_seraphic_execution_4 EX普攻4 [WuWaSim]',
      dA5: '共鸣回路·forte_basic_seraphic_execution_5 普攻4 [WuWaSim]',
      dH1: '共鸣回路·forte_heavy_flamewing_verdict_1 重击-1 [WuWaSim]',
      dH2: '共鸣回路·forte_heavy_flamewing_verdict_2 重击-1 [WuWaSim]',
      dH3: '共鸣回路·forte_heavy_flamewing_verdict_3 重击-1 [WuWaSim]',
      E: '共鸣技能·skill_encroach 共鸣技能跳跃飞踢 [WuWaSim]',
      eyi: '共鸣技能·skill_ascent_of_malice 技能 [WuWaSim]',
      dE: '共鸣回路·forte_heavy_ravage 共鸣技能跳跃飞踢 [WuWaSim]',
      I: '变奏入场·intro_intro_skill_hellflare_overload [WuWaSim]',
    },
    resources: [
      { key: 'sin', name: '罪火', max: 100, segmented: false, confidence: 'low', basis: '上限 100；获取量估计' },
      { key: 'pf', name: '净炼火', max: 100, segmented: false, confidence: 'low', basis: '恶翼扬升时罪火等值转化；消耗量估计' },
      { key: 'af', name: '余火', max: 40, segmented: false, confidence: 'high', basis: '队伍声骸技能 +8（同名一次），上限 40' },
      { key: 'demon', name: '恶魔位格', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.demon ? 1 : 0) },
      { key: 'fe', name: '死运既定', max: 4, segmented: true, confidence: 'medium', get: (cs, t) => (on(cs.fe.until, t) ? cs.fe.n : 0) },
    ],
    kit(H) {
      const ch = H.chain, K = {};
      const durA = [0.5, 0.8, 0.9, 1.0], durH = [0.6, 0.7, 0.9], durD = [0.5, 0.8, 0.95, 0.95, 1.0];
      for (let k = 1; k <= 4; k++) K['A' + k] = H.act({ key: 'A' + k, cls: 'A', skill: 1, labels: ['普攻第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: durA[k - 1] });
      for (let k = 1; k <= 3; k++) K['H' + k] = H.act({ key: 'H' + k, cls: 'H', skill: 1, labels: ['重击·燧发杀戮第' + CN[k - 1] + '段伤害'], levelKey: 'basic', dur: durH[k - 1], extra: { stamina: H.param(1, '重击·燧发杀戮第' + CN[k - 1] + '段耐力消耗') || 10 } });
      for (let k = 1; k <= 5; k++) K['dA' + k] = H.act({ key: 'dA' + k, cls: 'A', skill: 6, labels: ['普攻·炽天猎杀第' + CN[k - 1] + '段伤害'], levelKey: 'forte', ownStage: true, dur: durD[k - 1], label: '普攻·炽天猎杀第' + CN[k - 1] + '段' });
      for (let k = 1; k <= 3; k++) K['dH' + k] = H.act({ key: 'dH' + k, cls: 'H', skill: 6, labels: ['重击·炼羽裁决第' + CN[k - 1] + '段伤害'], levelKey: 'forte', dur: durH[k - 1], label: '重击·炼羽裁决第' + CN[k - 1] + '段', extra: { stamina: H.param(6, '重击·炼羽裁决第' + CN[k - 1] + '段耐力消耗') || 10 } });
      const c5 = ch >= 5 ? { scale: { '*': 2.5 }, inferred: '链5：倍率 +150%' } : {};
      Object.assign(K, {
        E: H.act(Object.assign({ key: 'E', cls: 'E', skill: 2, labels: ['共鸣技能·迫近伤害'], levelKey: 'skill', cooldown: H.param(2, '共鸣技能·迫近冷却时间') || 5, cdKey: 'E', dur: 0.9 }, c5)),
        eyi: H.act(Object.assign({ key: 'eyi', cls: 'E', skill: 2, labels: ['共鸣技能·恶翼扬升伤害'], levelKey: 'skill', concertoParam: '共鸣技能·恶翼扬升回复协奏能量', cooldown: H.param(2, '共鸣技能·恶翼扬升冷却时间') || 13, cdKey: 'eyi', dur: 1.0 }, c5)),
        dE: H.act(Object.assign({ key: 'dE', cls: 'E', skill: 6, labels: ['共鸣技能·掠袭伤害'], levelKey: 'forte', cooldown: H.param(6, '共鸣技能·掠袭冷却时间') || 5, cdKey: 'E', dur: 0.9, label: '共鸣技能·掠袭' }, c5)),
        R: H.act(Object.assign({ key: 'R', cls: 'R', skill: 3, labels: ['共鸣解放·炼净伤害'], levelKey: 'liberation', cost: H.param(3, '共鸣解放·炼净消耗共鸣能量') || 125, cooldown: H.param(3, '共鸣解放·炼净冷却时间') || 25,
          concertoParam: '共鸣解放·炼净回复协奏能量', dur: 2.3 }, ch >= 3 ? { scale: { '*': 2.3 }, inferred: '链3：倍率 +130%' } : {})),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['变奏技能·永火上膛伤害'], levelKey: 'intro', concertoParam: '变奏技能·永火上膛回复协奏能量', dur: 1.0 }),
      });
      const o = H.skill(11);
      K.O = { key: 'O', cls: 'O', skill: 11, label: '延奏·驱猎逐烬', level: 1, levelKey: 'outro', energy: 0, concerto: 0, cooldown: 0,
        hits: (o ? o.hits : []).map((h) => Object.assign({}, h, { element: 'fusion', type: 'outro', scaling: 'atk', confidence: 'low', lowReason: 'ww.json 行无元素/类型，按描述“热熔伤害”补全' })) };
      H.patchBuff((b) => b.kind === 'inherent' && /死运既定/.test(b.text || ''), { mode: 'module' }, '模块：按技能类型叠层（5 s 同类一次）');
      H.patchBuff((b) => b.kind === 'chain' && /内燃烧|余火/.test(b.text || ''), { mode: 'module' }, '模块：内燃烧/余火');
      if (H.weaponId === SIG) {
        const he = H.findBuff((b) => b.kind === 'weapon' && b.stats[0] && b.stats[0].key === 'deep:heavy')[0];
        const eh = H.findBuff((b) => b.kind === 'weapon' && b.stats[0] && b.stats[0].key === 'deep:echo')[0];
        const di = H.findBuff((b) => b.kind === 'weapon' && /同时拥有两种效果/.test(b.text || ''))[0];
        H.patchBuff((b) => b === he || b === eh, { mode: 'module', trigger: { on: 'manual' } }, '模块：按本动作造成的伤害类型（声骸技能/重击）触发');
        H.patchBuff((b) => b === di, { mode: 'module' }, '模块：两种效果同时存在时');
        H.mem._lux = { he: he && he.id, eh: eh && eh.id, di: di ? di.stats[0].value : 0.08 };
      }
      return K;
    },
    init(api) {
      const st = api.H.opts.start || {};
      return { sin: st.sin || 0, pf: 0, af: st.af || 0, afFrom: {}, demon: false, st: 0, dst: 0, hst: 0, last: null, r85: null, nr: null, fe: { n: 0, until: null, last: {} } };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, kit = api.mem.kit;
      const after = (base) => (cs.last === 'I' || cs.last === 'H1' || cs.last === 'dH1' || cs.last === 'eyi' || cs.last === 'R' || cs.last === 'A4' ? 2
        : (cs.last === 'H2' || cs.last === 'H3' || cs.last === 'dH2' || cs.last === 'dH3' || cs.last === 'dA5') ? 3 : base);
      switch (btn) {
        case 'A':
          if (cs.demon) return { act: K['dA' + Math.min(5, after((cs.dst % 5) + 1))] };
          return { act: K['A' + Math.min(4, after((cs.st % 4) + 1))] };
        case 'H': {
          const n = cs.last === 'I' ? 2 : (cs.hst % 3) + 1;
          return { act: K[(cs.demon ? 'dH' : 'H') + n] };
        }
        case 'E':
          if (cs.demon) return { act: K.dE };
          return { act: cs.sin >= 100 - 1e-9 ? K.eyi : K.E };
        case 'R': return { act: K.R };
        case 'I': return { act: K.I };
        case 'O': return { act: K.O };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, k = act.key, out = [], ch = api.H.chain;
      if (on(cs.fe.until, t) && cs.fe.n) out.push({ key: 'deep:all', value: 0.05 * cs.fe.n });
      if (on(cs.nr, t)) out.push({ key: 'atkPct', value: 0.2 * (ch >= 2 ? 4.5 : 1) });
      if (cs.demon && FORM(k)) {
        out.push({ key: 'deep:all', value: Math.min(0.6, 0.015 * cs.af) });
        if (/^d[AH]/.test(k) && on(cs.r85, t)) out.push({ key: 'multUp', value: 0.85 + (ch >= 6 ? 0.6 : 0) });
        if (ch >= 1) out.push({ key: 'critDmg', value: Math.min(0.8, 0.02 * (cs.afAtE || 0)) });
      }
      const L = api.mem._lux;
      if (L && L.he && L.eh && api.buffInst(L.he) && api.buffInst(L.eh)) out.push({ key: 'defIgnore', value: L.di });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      if (cs.demon && PF[k] != null) cs.pf = Math.max(0, cs.pf - PF[k]);
      else if (!cs.demon && SIN[k] != null) cs.sin = Math.min(100, cs.sin + SIN[k]);
      if (k === 'eyi') { cs.demon = true; cs.pf = cs.sin; cs.sin = 0; cs.afAtE = cs.af; cs.dst = 1; }
      if (/^A\d$/.test(k)) cs.st = +k.slice(1) % 4;
      if (/^dA\d$/.test(k)) cs.dst = +k.slice(2) % 5;
      if (/^d?H\d$/.test(k)) cs.hst = +k.slice(-1) % 3; else cs.hst = 0;
      if (k === 'I' || k === 'dA4' || k === 'E' || k === 'eyi' || k === 'dE') cs.nr = te + 4;
      if (k === 'R') cs.r85 = te + 14;
      if (k === 'Q' && !cs.demon && !cs.afFrom[api.mi]) { cs.afFrom[api.mi] = true; cs.af = Math.min(40, cs.af + 8); }
      const ty = FTYPE(k);
      if (ty && act.hits && act.hits.length) {
        if (!on(cs.fe.until, t)) cs.fe.n = 0;
        if (cs.fe.last[ty] == null || t - cs.fe.last[ty] >= 5 - 1e-9) { cs.fe.n = Math.min(4, cs.fe.n + 1); cs.fe.until = te + 5.5; cs.fe.last[ty] = t; }
      }
      const L = api.mem._lux;
      if (L && act.hits) {
        if (act.hits.some((h) => h.type === 'echo') && L.he) api.fireBuff(L.he);
        if (act.hits.some((h) => h.type === 'heavy') && L.eh) api.fireBuff(L.eh);
      }
      if (cs.demon && cs.pf <= 1e-9 && k !== 'eyi') { cs.demon = false; cs.af = 0; cs.afFrom = {}; cs.afAtE = 0; cs.st = 0; }
      cs.last = k;
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'damage' && ev.mi !== api.mi && ev.act && ev.act.cls === 'Q' && !cs.demon && !cs.afFrom[ev.mi]) { cs.afFrom[ev.mi] = true; cs.af = Math.min(40, cs.af + 8); }
      if (ev.type === 'swap' && ev.mi === api.mi) cs.last = null;
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, e = (a) => api.est(a);
      const chain = e(K.dA3) + e(K.dA4) + e(K.dA5), per = chain / 45;   // 每点净炼火的价值（基础）
      const amp = 1 + Math.min(0.6, 0.015 * cs.af);
      if (cs.demon) return 0.9 * cs.pf * per * amp;
      return 0.6 * cs.sin * per * amp;
    },
  });
});
