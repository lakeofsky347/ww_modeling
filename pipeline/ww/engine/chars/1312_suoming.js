/*
 * 锁暝 (1312) character module — worker-B.
 *
 * 普攻 拢伞形 (1006201): 念起 普攻 3 段；念深 普攻·解伞形 4 段；「长按…旋雷破第1段、第2段」→ 念深时 H = 旋雷破 1/2 交替
 * 共鸣技能 拢伞形·破隙 (1006202): 106.61%，冷却 8；念深 → 解伞形·赤芒瞬闪 47.25%+23.63%×2+63.00%（「进入念深状态时，共鸣技能刷新冷却时间」）
 *   破隙的格挡反击（受击后施放赤芒瞬闪）不建模；念深下 E 直接施放赤芒瞬闪（中）
 * 共鸣解放 暝伞形·重锁狱瘴 (1006203): 「念深状态下，解锁共鸣解放」60.89%×8+208.76%，冷却 25；「施放共鸣解放时，锁暝获得同奏，持续5秒」
 *   凄雨瘴雷：「施放延奏技能时，若锁暝拥有同奏，队伍中在场角色造成伤害时，会召唤雷痕…协同攻击」59.65%；每秒最多 1 道，共 6 道，8 秒
 * 共鸣回路 囚执化念 (1006207): 【妄执】上限 800
 *   念起 800 → E = 拢伞形·锁妄念（进入念深、清空妄执）；念深 800 → E = 解伞形·无舍念 → A/E = 暝伞形·刻心念 1551.41%（协奏 40，清空妄执，结束后念起）
 *   「施放共鸣解放时，获得200点【妄执】」「施放变奏技能·解伞形·碎霆或变奏技能·解伞形·旋雷破·同奏时，获得200点【妄执】」
 *   普攻/解伞形/旋雷破/赤芒瞬闪 命中时获得妄执（量未公开 → 估计，低）
 *   同奏：「锁暝拥有同奏时，若切换其他角色，登场角色将施放自身变奏技能，锁暝则施放自身延奏技能」→ swapOut {force, reason:'tongzou'}（同 1304/1311 约定），cs.tongzou 供心的「灯同辉」读取
 *   响应同奏：引擎延奏事件 forced && reason 'tongzou' → 变奏替换为 锁妄念·同奏（念起）/ 旋雷破·同奏（念深），可响应同奏的队员获得 1 层【同奏增益】（锁暝提供上限 1 层，30 秒）
 *   同奏增益「最终伤害提升3%」→ deep:all 0.03（同 1311 口径，中）；可响应同奏的角色：1304 / 1311 / 1312（module.unisonIds 追加）  // B13 已解决：心 1311 UNISON 含 1312；同奏增益按跨提供者共享上限（_common.tzzyRoom）
 * 变奏 拢伞形·闪裂 (1006206): 念起 → 念深并清空妄执；念深 → 解伞形·碎霆（+200 妄执）
 * 固有 雨浸旧契：变奏 → 导电 +50% 15 秒（解析）；同奏变奏额外 +10 协奏（25 秒 1 次）
 * 固有 沉契凝锁：「锁暝拥有同奏并施放延奏技能时，锁暝获得协契效果，持续30秒」「锁暝施放共鸣解放或普攻·暝伞形·刻心念后8秒内，施放延奏技能时，如果获得协契效果或处于协契效果期间，
 *   下一个登场的角色导电伤害加成提升30%，每拥有一层【同奏增益】，导电伤害加成额外提升20%，最多额外提升40%，持续8秒」→ 模块触发；禁锁契主（破隙消耗同奏）不建模（关闭）
 * 延奏 伞机鸣动：下一位登场角色 导电加深 20%；「拥有【同奏增益】时，共鸣技能伤害加深25%」→ 模块按接收者同奏增益层数触发
 * 专武 沉冥 (21020107)：「获得同奏时」两条 → 共鸣解放时触发；「协奏能量消耗时…」（自身，切人结束）不建模
 * 动作帧：Riley31415/wuwa_calc（唯一来源，低）；碎霆 / 旋雷破·同奏 变奏无帧 → 估计 1.7 秒（低）
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21020107;
  const UNISON = [1304, 1311, 1312];
  const WZ = { n1: 30, n2: 40, n3: 50, u1: 50, u2: 70, u3: 70, u4: 100, x1: 80, x2: 80, cm: 60 };
  const RL = ' [Riley31415/wuwa_calc]';
  return WW.registerChar({
    id: 1312, chainModeled: 0, name: '锁暝', version: '0.1', confidence: 'low',
    notes: ['妄执每段获得量为估计（低）', '动作帧仅 Riley31415 一个来源（低）', '破隙格挡反击、闪避反击、禁锁契主未建模', '同奏增益按全伤害加深 3%/层（中，同 1311）', '凄雨瘴雷：每个登场角色伤害事件最多 1 道（1 秒间隔，共 6 道，8 秒）', '共鸣链未建模'],
    audit: { role: 'subdps', finishers: ['kx', 'lib'], window: 25, sig: SIG, alts: [21020015, 21020016, 21020024], solo: 'suoming_solo.json', team: 'team_suoming.json', teamMi: 1 },
    frames: {
      n1: '普攻·Basic - Furled Canopy 1' + RL, n2: '普攻·Basic - Furled Canopy 2' + RL, n3: '普攻·Basic - Furled Canopy 3' + RL,
      u1: '普攻·Basic - Unfurled Canopy 1' + RL, u2: '普攻·Basic - Unfurled Canopy 2' + RL, u3: '普攻·Basic - Unfurled Canopy 3' + RL, u4: '普攻·Basic - Unfurled Canopy 4' + RL,
      x1: '重击·Heavy - Unfurled Canopy: Whirling Thunder 1' + RL, x2: '重击·Heavy - Unfurled Canopy: Whirling Thunder 2' + RL,
      px: '共鸣技能·Skill - Furled Canopy: Rift Cleaver' + RL, cm: '共鸣技能·Skill - Unfurled Canopy: Crimson Gleam' + RL,
      swn: '共鸣技能·Forte Skill - Furled Canopy: Sealed Delusion' + RL, wsn: '共鸣技能·Skill - Unfurled Canopy: Unforsaken Mind' + RL,
      kx: '普攻·Forte Basic - Umbral Canopy: Engraved Heart' + RL, lib: '共鸣解放·Liberation - Umbral Canopy: Miasma Lock' + RL,
      sl: '变奏入场·Intro - Furled Canopy: Flash Rift' + RL, slU: '变奏入场·Intro - Furled Canopy: Sealed Delusion (Unison)' + RL, st: null, stU: null,
    },
    resources: [
      { key: 'ns', name: '念深', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.ns ? 1 : 0) },
      { key: 'wz', name: '妄执', max: 800, segmented: false, confidence: 'low' },
      { key: 'tz', name: '同奏（秒）', max: 5, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.tongzou, t).toFixed(2) },
    ],
    kit(H) {
      const s1 = H.skill(1), s5 = H.skill(5), s6 = H.skill(6);
      const f = (s, lab) => s.hits.filter((h) => !h.alt && h.label === lab);
      const kxRaw = s6.hits.find((h) => h.label === '普攻·暝伞形·刻心念伤害');
      const kxHit = B.textHit(H, f(s1, '普攻·解伞形第一段伤害')[0], { label: '普攻·暝伞形·刻心念伤害', mv: kxRaw ? kxRaw.multiplier : 15.5141, type: 'basic', confidence: 'low' });
      const K = Object.assign(
        B.stages(H, { n: 3, prefix: 'n', label: (k) => '普攻第' + B.CN[k - 1] + '段伤害', durs: [0.4, 0.78, 1.37] }),
        B.stages(H, { n: 4, prefix: 'u', label: (k) => '普攻·解伞形第' + B.CN[k - 1] + '段伤害', durs: [0.65, 1.13, 1.17, 1.92] }), {
          x1: H.act({ key: 'x1', cls: 'H', skill: 1, hits: f(s1, '普攻·解伞形·旋雷破第一段伤害'), levelKey: 'basic', dur: 1.47, label: '普攻·解伞形·旋雷破第1段' }),
          x2: H.act({ key: 'x2', cls: 'H', skill: 1, hits: f(s1, '普攻·解伞形·旋雷破第二段伤害'), levelKey: 'basic', dur: 1.42, label: '普攻·解伞形·旋雷破第2段' }),
          px: H.act({ key: 'px', cls: 'E', skill: 2, labels: ['共鸣技能·拢伞形·破隙伤害'], levelKey: 'skill', cooldown: 8, cdKey: 'E', dur: 0.7, label: '拢伞形·破隙' }),
          cm: H.act({ key: 'cm', cls: 'E', skill: 2, labels: ['共鸣技能·解伞形·赤芒瞬闪伤害'], levelKey: 'skill', cooldown: 8, cdKey: 'E', dur: 1.12, label: '解伞形·赤芒瞬闪' }),
          swn: H.act({ key: 'swn', cls: 'E', skill: 6, labels: ['共鸣技能·拢伞形·锁妄念伤害'], levelKey: 'forte', dur: 1.78, label: '拢伞形·锁妄念' }),
          wsn: H.act({ key: 'wsn', cls: 'E', skill: 6, labels: ['共鸣技能·解伞形·无舍念伤害'], levelKey: 'forte', dur: 1.13, label: '解伞形·无舍念' }),
          kx: H.act({ key: 'kx', cls: 'A', skill: 6, hits: [kxHit], levelKey: 'forte', concertoParam: '普攻·暝伞形·刻心念回复协奏能量', dur: 5.13, label: '暝伞形·刻心念' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['共鸣解放·暝伞形·重锁狱瘴伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 5.58, label: '暝伞形·重锁狱瘴' }),
          ly: H.act({ key: 'ly', cls: 'R', skill: 3, labels: ['共鸣解放·凄雨瘴雷伤害'], levelKey: 'liberation', dur: 0, label: '凄雨瘴雷·雷痕', noConcertoFallback: true }),
          sl: H.act({ key: 'sl', cls: 'I', skill: 5, hits: f(s5, '变奏技能·拢伞形·闪裂伤害'), levelKey: 'intro', concertoParam: '施放变奏技能·拢伞形·闪裂回复协奏能量', dur: 1.72, label: '拢伞形·闪裂' }),
          st: H.act({ key: 'st', cls: 'I', skill: 5, hits: f(s5, '变奏技能·解伞形·碎霆伤害'), levelKey: 'intro', concertoParam: '施放变奏技能·解伞形·碎霆回复协奏能量', dur: 1.7, label: '解伞形·碎霆' }),
          slU: H.act({ key: 'slU', cls: 'I', skill: 5, hits: f(s5, '变奏技能·拢伞形·锁妄念·同奏伤害'), levelKey: 'intro', concertoParam: '变奏技能·拢伞形·锁妄念·同奏回复协奏能量', dur: 1.72, label: '拢伞形·锁妄念·同奏' }),
          stU: H.act({ key: 'stU', cls: 'I', skill: 5, hits: f(s5, '变奏技能·解伞形·旋雷破·同奏伤害'), levelKey: 'intro', concertoParam: '变奏技能·解伞形·旋雷破·同奏回复协奏能量', dur: 1.7, label: '解伞形·旋雷破·同奏' }),
          O: B.outro(H, '伞机鸣动'),
        });
      for (const k of ['n1', 'n2', 'n3']) K[k].label = '拢伞形·' + K[k].label.split('·').pop();
      // 沉契凝锁：协契延奏 buff 由模块触发；禁锁契主不建模
      H._xq = H.findBuff((b) => b.kind === 'inherent' && /沉契凝锁/.test(b.src || '') && b.stats.length && /导电伤害加成提升30%/.test(b.text || '')).map((b) => b.id);
      B.patch(H, /锁暝施放共鸣解放或普攻·暝伞形·刻心念后8秒内/, (b) => ({ trigger: { on: 'manual' }, mode: 'module', target: 'self', maxStacks: b.stats[0] && b.stats[0].value === 0.2 ? 2 : 1 }), '模块：协契 + 8 秒内解放/刻心念 → 延奏时给下一位登场角色', 'inherent');
      B.patch(H, /禁锁契主|并使自身暴击伤害提升100%/, { trigger: { on: 'never' }, mode: 'off' }, '模块：禁锁契主未建模', 'inherent');
      H._sk = H.findBuff((b) => b.kind === 'outro' && b.stats.some((s) => s.key === 'deep:skill')).map((b) => b.id);
      B.patch(H, /拥有【同奏增益】时，共鸣技能伤害加深25%/, (b) => (b.stats.some((s) => s.key === 'deep:skill') ? { trigger: { on: 'manual' }, mode: 'module', target: 'self' } : {}), '模块：接收者拥有同奏增益时', 'outro');
      if (H.weaponId === SIG) {
        H._wTz = H.findBuff((b) => b.kind === 'weapon' && /获得同奏时/.test(b.text || '')).map((b) => b.id);
        B.patch(H, /获得同奏时/, { trigger: { on: 'manual' }, mode: 'module' }, '模块：共鸣解放获得同奏时触发', 'weapon');
      }
      H.buff({ id: 'tzzy', name: '同奏增益', stats: [{ key: 'deep:all', value: 0.03 }], duration: 30, maxStacks: 1, trigger: { on: 'manual' }, mode: 'module', target: 'self',
        text: '每层【同奏增益】使队伍中可响应同奏的角色造成的最终伤害提升3%（锁暝提供上限 1 层）', confidence: 'medium' });
      return K;
    },
    fillerKeys: ['n1', 'n2', 'n3'],
    init(api) {
      const o = api.H.opts || {}, st = o.start || {};
      return { ns: !!st.ns, wz: st.wz || 0, st: 0, ust: 0, xst: 0, kxOpen: false, tongzou: null, forcedOut: false, respond: false, xq: null, lastRK: -99, tzCd: -99,
        ly: { mi: null, until: null, left: 0, next: 0 }, unison: UNISON.concat(o.unisonIds || []) };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, full = cs.wz >= 800 - 1e-9;
      switch (btn) {
        case 'A':
          if (cs.kxOpen) return { act: K.kx };
          return cs.ns ? { act: K['u' + ((cs.ust % 4) + 1)] } : { act: K['n' + ((cs.st % 3) + 1)] };
        case 'H': return cs.ns && !cs.kxOpen ? { act: K['x' + ((cs.xst % 2) + 1)] } : null;
        case 'E':
          if (cs.kxOpen) return { act: K.kx };
          if (full) return { act: cs.ns ? K.wsn : K.swn };
          return api.cdReady('E') ? { act: cs.ns ? K.cm : K.px } : { blocked: '冷却中' };
        case 'R': return cs.ns ? { act: K.lib } : { blocked: '念起状态下无法施放共鸣解放' };
        case 'I':
          if (cs.respond) return { act: cs.ns ? K.stU : K.slU };
          return { act: cs.ns ? K.st : K.sl };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      const onField = api.s.active === api.mi;
      const addWz = (n) => { if (onField) cs.wz = Math.min(800, cs.wz + n); };
      const enterNs = () => { if (!cs.ns) { cs.ns = true; api.ms.cd && (api.ms.cd.E = 0); } cs.wz = 0; };
      if (/^n\d$/.test(k)) { cs.st = +k.slice(1) % 3; addWz(WZ[k]); return; }
      if (/^u\d$/.test(k)) { cs.ust = +k.slice(1) % 4; addWz(WZ[k]); return; }
      switch (k) {
        case 'x1': case 'x2': cs.xst = k === 'x1' ? 1 : 0; addWz(WZ[k]); break;
        case 'px': break;
        case 'cm': addWz(WZ.cm); break;
        case 'swn': enterNs(); break;
        case 'wsn': cs.kxOpen = true; break;
        case 'kx': cs.kxOpen = false; cs.wz = 0; cs.ns = false; cs.lastRK = te; cs.st = 0; break;
        case 'lib':
          cs.wz = Math.min(800, cs.wz + 200); cs.tongzou = te + 5; cs.lastRK = te;
          for (const id of api.H._wTz || []) api.fireBuff(id, api.mi, { duration: 30 });   // 沉冥「获得同奏时」（team 目标的条目对全队生效）
          break;
        case 'sl': enterNs(); break;
        case 'st': cs.wz = Math.min(800, cs.wz + 200); break;
        case 'slU': case 'stU':
          if (k === 'slU') enterNs(); else cs.wz = Math.min(800, cs.wz + 200);
          cs.respond = false; this.giveTzzy(api);
          if (t >= cs.tzCd - 1e-9) { api.addConcerto(api.mi, 10); cs.tzCd = t + 25; }
          break;
        default: break;
      }
    },
    giveTzzy(api) {
      api.ctx.members.forEach((m, j) => { if (api.cs.unison.includes(m.R.id) && (C.tzzyRoom ? C.tzzyRoom(api, j, api.mi) : 1) > 0) api.fireBuff('tzzy', j, { stacks: 1, duration: 30 }); }); // B13: shared 同奏增益 cap across providers
    },
    tzStacksOf(api, j) {
      let n = 0;
      api.ctx.members.forEach((m, k) => { const b = api.buffInst('m' + k + '_tzzy', j); if (b) n += b.stacks; });
      return n;
    },
    swapOut(api) {
      const cs = api.cs;
      if (on(cs.tongzou, api.t)) { cs.tongzou = null; cs.forcedOut = true; return { force: true, reason: 'tongzou' }; }
      return {};
    },
    onOutro(api, toMi) {
      const cs = api.cs, t = api.t, n = this.tzStacksOf(api, toMi);
      if (cs.forcedOut) { cs.xq = t + 30; cs.ly = { mi: toMi, until: t + 8, left: 6, next: 0 }; }
      if (on(cs.xq, t) && t - cs.lastRK <= 8 + 1e-9) {
        for (const id of api.H._xq || []) {
          const b = api.mem.buffDefs.find((x) => x.id === id);
          if (b && b.stats[0] && b.stats[0].value === 0.2) { if (n > 0) api.fireBuff(id, toMi, { duration: 8, stacks: Math.min(2, n) }); }
          else api.fireBuff(id, toMi, { duration: 8 });
        }
      }
      if (n > 0) for (const id of api.H._sk || []) api.fireBuff(id, toMi, { duration: 8 });
      cs.forcedOut = false; cs.kxOpen = false;
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'outro' && ev.to === api.mi && ev.mi !== api.mi && ev.forced && ev.reason === 'tongzou') { cs.respond = true; return; }
      const L = cs.ly;
      if (L.mi == null) return;
      if ((ev.type === 'swap' || ev.type === 'intro') && ev.mi !== L.mi) { L.mi = null; return; }
      if (ev.type !== 'damage' || ev.coord || ev.mi !== L.mi || !on(L.until, ev.t) || L.left <= 0 || ev.t < L.next - 1e-9) return;
      L.left -= 1; L.next = ev.t + 1;
      api.deal(api.mem.modKit.ly, { t: ev.t });
    },
    // search heuristic (not a game rule): 妄执→刻心念；同奏 → 延奏价值
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      let v = (cs.kxOpen ? 0.8 : cs.wz / 800 * 0.5) * api.est(K.kx);
      if (on(cs.tongzou, api.t)) v += 0.3 * 6 * api.est(K.ly);
      return v;
    },
  });
});
