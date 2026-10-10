/*
 * 吟霖 (1302) character module. 导电 音感仪，副C（协同攻击 审判之雷；延奏 导电 +20% / 共鸣解放 +25% 加深）。
 *
 * 共鸣技能 磁殛咆哮 (1001502)：「…使吟霖进入共鸣技能磁殛状态。磁殛状态：普攻和闪避反击命中目标时，触发1次磁殛爆发；每段普攻…仅可触发1次，最多可触发4次。」
 *   「磁殛爆发：攻击所有携带共鸣回路缚罪标记的目标」；「召雷磁爆：施放磁殛咆哮后一定时间内，短按共鸣技能…若一定时间内没有施放…或者切换至其他角色，则技能进入冷却状态。」
 *   参数：磁殛状态持续时间 10，冷却时间 12，磁殛咆哮/召雷磁爆/磁殛爆发 回复协奏 10/15/5。召雷窗口未给出 → 5 s（引擎假设）。
 * 共鸣回路 千面魅影 (1001507)：「【审判值】满时，重击将替换为千面魅影，消耗所有【审判值】…命中携带缚罪标记的目标时，缚罪标记被替换为惩罚印记，持续18秒。」
 *   「缚罪标记：常态攻击、共鸣解放或变奏技能命中目标时附加。吟霖离场时缚罪标记消失。」
 *   「惩罚印记：携带惩罚印记的目标受到伤害时会降下审判之雷…每秒最多可触发1次。审判之雷造成的伤害为共鸣技能伤害。」→ 任一队员（含协同/离场伤害）造成伤害时，距上次 ≥1 s 则触发，
 *     一个动作内按其时长每秒至多 1 次（中）。
 *   【审判值】每次获取量数据中没有 → 按 Prydwen 标准循环校准（低）：https://www.prydwen.gg/wuthering-waves/characters/yinlin
 *     「Intro → Basic P4 → Skill: Magnetic Roar → Heavy Attack → Skill: Lightning Execution → Ultimate → Basic P1 → Forte: Chameleon Cipher → Outro」
 *     → 变奏 10、普攻每段 5、重击 10、磁殛咆哮 30、召雷磁爆 30、磁殛爆发 10（合计恰好 100）。
 * 固有 浸渍痛楚（磁殛咆哮后暴击 +15%）：通用解析触发改为只由磁殛咆哮触发；目标专注：召雷磁爆命中缚罪目标 伤害 +10% 且攻击 +10% 4 s（模块）。
 * 链1 磁殛咆哮/召雷磁爆 +70%；链2 爆发 +5 审判/+5 能量；链3 审判之雷倍率 +55%；链4 审判之雷命中 全队攻击 +20% 12 s；链5 解放对印记目标 +100%；链6 疾霆昭彰未建模。
 * 武器 掣傀之手：「自身不在场时，该效果攻击额外提升12%」→ 离场的审判之雷按离场计。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on } = C;
  const SIG = 21050016;
  const JG = { I: 10, H: 10, E: 30, E2: 30, burst: 10, A: 5 };
  return WW.registerChar({
    id: 1302, chainModeled: 5, name: '吟霖', version: '0.1', confidence: 'medium',
    notes: ['【审判值】获取量为估计（低），按 Prydwen 标准循环校准', '召雷磁爆可用窗口按 5 s（引擎假设）', '审判之雷：任一队员造成伤害且距上次 ≥1 s 时触发，动作内按时长每秒至多 1 次',
      '链6 疾霆昭彰未建模；缚罪标记在吟霖离场时消失（惩罚印记不受影响）'],
    audit: { role: 'subdps', finishers: ['cipher'], window: 25, sig: SIG, solo: 'yinlin_solo.json', team: 'team_yinlin.json', teamMi: 1 },
    frames: {
      A1: '普攻·basic_1 [WuWaSim]', A2: '普攻·basic_2 [WuWaSim]', A3: '普攻·basic_3 [WuWaSim]', A4: '普攻·basic_4 [WuWaSim]', H: '重击·heavy_heavy_attack [WuWaSim]',
      E: '共鸣技能·skill_magnetic_roar_damage [WuWaSim]', E2: '共鸣技能·skill_lightning_execution_damage [WuWaSim]', R: '共鸣解放·liberation [WuWaSim]',
      I: '变奏入场·intro [WuWaSim]', cipher: '共鸣回路·forte_heavy_chameleon_cipher_damage [WuWaSim]',
    },
    resources: [
      { key: 'jp', name: '审判值', max: 100, segmented: false, confidence: 'low', basis: '上限 100；获取量按 Prydwen 循环校准' },
      { key: 'exec', name: '磁殛状态', max: 4, segmented: true, confidence: 'high', basis: '10 s 内至多 4 次磁殛爆发', get: (cs, t) => (on(cs.execUntil, t) ? cs.exec : 0) },
      { key: 'punish', name: '惩罚印记', max: 1, segmented: true, confidence: 'high', basis: '18 s', get: (cs, t) => (on(cs.punish, t) ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const c1 = ch >= 1 ? { scale: { '*': 1.7 }, inferred: '链1：伤害 +70%（按倍率处理）' } : {};
      const K = {
        E: H.act(Object.assign({ key: 'E', cls: 'E', skill: 2, labels: ['磁殛咆哮伤害'], levelKey: 'skill', concertoParam: '磁殛咆哮回复协奏能量', cooldown: H.param(2, '冷却时间') || 12, cdKey: 'E', label: '磁殛咆哮' }, c1)),
        E2: H.act(Object.assign({ key: 'E2', cls: 'E', skill: 2, labels: ['召雷磁爆伤害'], levelKey: 'skill', concertoParam: '召雷磁爆回复协奏能量', label: '召雷磁爆' }, c1)),
        burst: H.act({ key: 'burst', cls: 'E', skill: 2, labels: ['磁殛爆发伤害'], levelKey: 'skill', label: '磁殛爆发' }),
        cipher: H.act({ key: 'cipher', cls: 'H', skill: 6, labels: ['千面魅影伤害'], levelKey: 'forte', label: '千面魅影' }),
        thunder: H.act(Object.assign({ key: 'thunder', cls: 'E', skill: 6, labels: ['审判之雷伤害'], levelKey: 'forte', label: '审判之雷' }, ch >= 3 ? { scale: { '*': 1.55 }, inferred: '链3：倍率 +55%' } : {})),
      };
      H.patchBuff((b) => b.kind === 'inherent' && /浸渍痛楚/.test(b.src || ''), { trigger: { on: 'act', keys: ['E'] }, mode: 'auto' }, '模块：只由磁殛咆哮触发');
      H.patchBuff((b) => b.kind === 'inherent' && /目标专注/.test(b.src || ''), { mode: 'module' }, '模块：召雷磁爆命中缚罪目标');
      H.patchBuff((b) => b.kind === 'chain' && /前行的鼓舞|决意的回响/.test(b.src || ''), { mode: 'module' }, '模块：审判之雷命中 / 印记目标');
      if (H.weaponId === SIG) H.patchBuff((b) => b.kind === 'weapon' && /不在场/.test(b.text || ''), { mode: 'module' }, '模块：离场的审判之雷');
      return K;
    },
    init() { return { jp: 0, exec: 0, execUntil: null, e2Until: null, sinner: false, punish: null, lastThunder: -9, focus: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, kit = api.mem.kit;
      switch (btn) {
        case 'A': return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'H': return cs.jp >= 100 - 1e-9 ? { act: K.cipher } : (kit.H ? { act: kit.H } : null);
        case 'E': return on(cs.e2Until, api.t) ? { act: K.E2 } : { act: K.E };
        case 'R': return { act: kit.R };
        case 'I': return { act: kit.I };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, out = [];
      if (act.key === 'E2' && cs.sinner) out.push({ key: 'dmg:skill', value: 0.1 });
      if (on(cs.focus, api.t)) out.push({ key: 'atkPct', value: 0.1 });
      if (act.cls === 'R' && api.H.chain >= 5 && (cs.sinner || on(cs.punish, api.t))) out.push({ key: 'dmg:liberation', value: 1 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain, K = api.mem.modKit;
      const gain = (v) => { cs.jp = Math.min(100, cs.jp + v); };
      if (act.cls === 'A' && act.stage) {
        gain(JG.A); cs.sinner = true;
        if (on(cs.execUntil, api.t) && cs.exec > 0) {
          cs.exec--; api.deal(K.burst, { coord: false, t: te }); gain(JG.burst + (ch >= 2 ? 5 : 0)); if (ch >= 2) api.addEnergy(api.mi, 5);
        }
      }
      if (k === 'H') gain(JG.H);
      if (k === 'I') { gain(JG.I); cs.sinner = true; }
      if (act.cls === 'R') cs.sinner = true;
      if (k === 'E') { gain(JG.E); cs.exec = 4; cs.execUntil = te + 10; cs.e2Until = te + 5; }
      if (k === 'E2') { gain(JG.E2); cs.e2Until = null; if (cs.sinner) cs.focus = te + 4; }
      if (k === 'cipher') { cs.jp = 0; if (cs.sinner) cs.punish = te + 18; }
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'swap' && ev.from === api.mi) { cs.sinner = false; cs.e2Until = null; cs.exec = 0; }
      if (ev.type !== 'damage' || !on(cs.punish, ev.t)) return;
      const t0 = Math.max(ev.t, cs.lastThunder + 1), t1 = Math.min(ev.t + (ev.dur || 0), cs.punish);
      if (t0 > t1 + 1e-9) return;
      const n = 1 + Math.floor((t1 - t0) + 1e-9);
      const K = api.mem.modKit, ch = api.H.chain, off = !api.onField;
      const st = [];
      if (off && api.H.weaponId === SIG) st.push({ key: 'atkPct', value: 0.12 });
      cs.lastThunder = t0 + (n - 1);
      api.deal(K.thunder, { count: n, stats: st, t: t0 });
      if (ch >= 4) { const b = api.mem.buffDefs.find((x) => x.kind === 'chain' && /前行的鼓舞/.test(x.src || '')); if (b) for (let j = 0; j < api.teamSize; j++) api.fireBuff(b.id, j, { t: t0 }); }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = 0.5 * (cs.jp / 100) * api.est(K.cipher);
      if (on(cs.punish, t)) v += 0.6 * Math.min(8, cs.punish - t) * api.est(K.thunder);
      if (on(cs.execUntil, t)) v += 0.5 * cs.exec * api.est(K.burst);
      return v;
    },
  });
});
