/*
 * 布兰特 (1206) character module. 热熔 迅刀，副C/主C（延奏 热熔 +20% / 共鸣技能 +25% 加深）。
 *
 * 共鸣回路 海中戏剧 (1002907)：
 *   「戏中人生：当自身共鸣效率大于150%时，每超过1%的共鸣效率计算为12点攻击提升，上限为1560。」解放后 燃焰「「我」的人生…20点攻击提升，上限为2600」。
 *   「当【喝彩】充满，共鸣技能起锚！替换为火焰归亡曲…消耗全部【喝彩】，造成热熔伤害，此次伤害为普攻伤害…若在燃焰状态中施放，则在火焰归亡曲结束后失去燃焰状态。」
 *   「【喝彩】上限100点。常态攻击/变奏技能/共鸣技能命中目标时，获得【喝彩】。」燃焰：「常态攻击、共鸣技能起锚！命中时获取【喝彩】效率提升100%。」
 *   → 每动作喝彩量数据中没有。按 Prydwen 标准循环校准（低）：https://www.prydwen.gg/wuthering-waves/characters/brant
 *     「Intro → (Skill) → Ultimate → Mid-Air P2 → P2: Charged → P2: Flip → P3 → P3: Flip → Forte」，变奏 = “a quarter of his Forte Gauge”(25)，
 *     其余 5 个空中分段在燃焰（×2）下补满 75 → 每分段 7.5（基础）。地面普攻“very little”→ 每段 3（估计）。
 * 空中攻击：模块把“第N段 + 长按 + 空翻”合并为一个动作 aN（第3段 = 第三段 + 空翻；第4段单段）。变奏「幕间掌声：下一次空中攻击从第2段开始」；
 *   变奏/解放/起锚! 后处于空中 → A = 空中连段，否则地面普攻。空中分段帧数据 WuWaSim 为 null（按住类）→ 模块估计时长（低）。
 * 固有 迎海投火的决意 热熔 +15%（通用解析）。链1 变奏/空翻后伤害 +20%×3（5 s）；链2 空中攻击与火焰归亡曲暴击 +30%；链3 火焰归亡曲倍率 +42%；
 * 链5 普攻伤害加成 +15%（通用解析）；链6 空中攻击倍率 +30%、火焰归亡曲后再燃 30%。链2 延奏追加爆炸未建模。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN } = C;
  const SIG = 21020036;
  const AIR = { a1: 22.5, a2: 22.5, a3: 15, a4: 7.5 };
  return WW.registerChar({
    id: 1206, chainModeled: 1, name: '布兰特', version: '0.1', confidence: 'low',
    notes: ['【喝彩】每动作获取量为估计（低），按 Prydwen 标准循环校准（变奏 25，空中分段 7.5，燃焰 ×2，地面普攻 3）', '空中攻击“段 + 长按 + 空翻”合并为一个动作，时长为模块估计（WuWaSim 按住类条目为 null）',
      '戏中人生/「我」的人生 攻击按静态面板共鸣效率换算', '链2 延奏追加爆炸、护盾/治疗未建模'],
    audit: { role: 'subdps', finishers: ['fz'], window: 25, sig: SIG, solo: 'brant_solo.json', team: 'team_brant.json', teamMi: 1 },
    frames: {
      A1: '普攻·basic_1 [WuWaSim]', A2: '普攻·basic_2 [WuWaSim]', A3: '普攻·basic_3 [WuWaSim]', A4: '普攻·basic_4 [WuWaSim]',
      E: '共鸣技能·skill [WuWaSim]', R: '共鸣解放·liberation [WuWaSim]', I: '变奏入场·intro [WuWaSim]', fz: '共鸣回路·forte_heavy_returned_from_ashes [WuWaSim]',
      a1: null, a2: null, a3: null, a4: null,
    },
    resources: [
      { key: 'bravo', name: '喝彩', max: 100, segmented: false, confidence: 'low', basis: '上限 100；获取量按 Prydwen 循环校准' },
      { key: 'aflame', name: '燃焰', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.aflame ? 1 : 0) },
      { key: 'air', name: '空中', max: 1, segmented: true, confidence: 'medium', get: (cs) => (cs.air ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain, K = {};
      const c6 = ch >= 6 ? { scale: { '*': 1.3 }, inferred: '链6：空中攻击倍率 +30%' } : {};
      const air = [
        ['a1', ['空中攻击第一段伤害', '空中攻击第一段长按伤害', '空中攻击第一段空翻伤害'], 1.7],
        ['a2', ['空中攻击第二段伤害', '空中攻击第二段长按伤害', '空中攻击第二段空翻伤害'], 1.7],
        ['a3', ['空中攻击第三段伤害', '空中攻击第三段空翻伤害'], 1.2],
        ['a4', ['空中攻击第四段伤害'], 0.9],
      ];
      for (const [k, labels, dur] of air) K[k] = H.act(Object.assign({ key: k, cls: 'A', skill: 1, labels, levelKey: 'basic', ownStage: true, dur, label: '空中攻击第' + CN[+k[1] - 1] + '段（含长按/空翻）' }, c6));
      K.fz = H.act(Object.assign({ key: 'fz', cls: 'E', skill: 6, labels: ['火焰归亡曲伤害'], levelKey: 'forte', label: '火焰归亡曲', dur: 1.8 }, ch >= 3 ? { scale: { '*': 1.42 }, inferred: '链3：倍率 +42%' } : {}));
      H.patchBuff((b) => b.kind === 'chain' && /跟随洋流和信风|掠夺欢声与笑颜/.test(b.src || ''), { mode: 'module' }, '模块：链1 叠层 / 链2 暴击');
      return K;
    },
    init(api) { const st = api.H.opts.start || {}; return { bravo: st.bravo || 0, aflame: false, air: false, ast: 0, c1: { n: 0, until: null } }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, kit = api.mem.kit;
      switch (btn) {
        case 'A': return cs.air ? { act: K['a' + (cs.ast + 1)] } : { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'E': return { act: cs.bravo >= 100 - 1e-9 ? K.fz : kit.E };
        case 'H': return kit.H ? { act: kit.H } : null;
        case 'R': return { act: kit.R };
        case 'I': return { act: kit.I };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, ch = api.H.chain, out = [];
      const er = api.staticPanel().energyRegen;
      const over = Math.max(0, er - 1.5) * 100;
      out.push({ key: 'atkFlat', value: cs.aflame ? Math.min(2600, over * 20) : Math.min(1560, over * 12) });
      if (ch >= 1 && on(cs.c1.until, api.t) && cs.c1.n) out.push({ key: 'dmg:all', value: 0.2 * cs.c1.n });
      if (ch >= 2 && (/^a\d$/.test(act.key) || act.key === 'fz')) out.push({ key: 'critRate', value: 0.3 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain, mul = cs.aflame ? 2 : 1;
      const gain = (v) => { cs.bravo = Math.min(100, cs.bravo + v); };
      const c1 = () => { if (ch < 1) return; if (!on(cs.c1.until, api.t)) cs.c1.n = 0; cs.c1.n = Math.min(3, cs.c1.n + 1); cs.c1.until = te + 5; };
      if (AIR[k] != null) { gain(AIR[k] * mul); cs.ast = (+k[1]) % 4; if (k !== 'a4') c1(); if (k === 'a4') cs.air = false; }
      else if (act.cls === 'A' && act.stage) { gain(3 * mul); cs.air = false; }
      if (k === 'I') { gain(25); cs.air = true; cs.ast = 1; c1(); }
      if (k === 'E') { gain(10 * mul); cs.air = true; cs.ast = 0; }
      if (k === 'R') { cs.aflame = true; cs.air = true; if (k === 'R' && !cs.ast) cs.ast = cs.ast || 0; }
      if (k === 'fz') {
        cs.bravo = 0; cs.aflame = false; cs.air = false; cs.ast = 0;
        if (ch >= 6) api.deal(act, { stats: [], coord: false, t: te, count: 0.3 });
      }
      if (k === 'H') cs.air = false;
    },
    onTeam(api, ev) { if (ev.type === 'swap' && ev.mi !== api.mi) { /* 换下：幕间掌声结束，落地 */ } if (ev.type === 'swap' && ev.from === api.mi) { api.cs.air = false; api.cs.ast = 0; } },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.8 * (cs.bravo / 100) * api.est(K.fz);
    },
  });
});
