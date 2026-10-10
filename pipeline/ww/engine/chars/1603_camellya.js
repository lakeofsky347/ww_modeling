/*
 * 椿 (1603) character module — worker-B.
 *
 * 普攻 育种 (1001301): 5 段；「施放第3段普攻或重击修枝后，长按普攻，将会持续攻击目标」「第4段普攻结束后，将会自动施放第5段普攻」
 *   → A4 = 长按段（24.70%×20，帧取 Burgeoning 4 (Hold)），A4 后自动 A5（合并为 A4 动作，中）
 *   固有 温床「重击修枝伤害视为普攻伤害」→ H 取同标签的普攻类型行（build 拆分的 alt 行，高）
 * 共鸣技能 盛放与凋零的轮舞 (1001302): 冷却 4
 *   「红椿盛绽…进入盛绽状态，此次伤害为普攻伤害」「盛绽状态：普攻和重击修枝替换为普攻蔓舞，进行最多4段…
 *    施放普攻第3段蔓舞时，长按普攻，将会施放普攻烬华蔓舞…并自动施放普攻第4段蔓舞」「共鸣技能替换为共鸣技能黯蕊猎心…施放后将会退出盛绽状态」
 *   → 盛绽中：A = 蔓舞 1→2→3→4；H（第3段后）= 烬华蔓舞 + 自动第4段（合并，中）；E = 黯蕊猎心（退出盛绽）
 * 共鸣解放 芳华绽烬 (1001303): 1202.81%，冷却 25，消耗 125。链3 ×1.5（「伤害倍率提升50%」）。
 * 共鸣回路 植物性宇宙 (1001307):
 *   「…命中目标时，消耗【红椿·蕊】，此次攻击的基础共鸣能量回复效率提升150%。每消耗10点【红椿·蕊】，回复4点协奏能量，并获得1层红椿·蕾，持续15秒，可叠加10层。」
 *   「当协奏能量充满时，若一日花不处于冷却状态，共鸣技能替换为一日花。施放一日花时，消耗70点协奏能量…此次伤害为普攻伤害。施放一日花时，进入含苞状态。」
 *   「含苞状态·酣梦：…的伤害倍率提升50%；施放一日花时，清除所有红椿·蕾，每层红椿·蕾使酣梦的伤害倍率提升效果额外提升5%，最多可额外提升50%」
 *   「含苞状态期间…基础共鸣能量回复效率降低至0%」「切换至其他角色时，将提前结束含苞状态；消耗完【红椿·蕊】时，将提前结束含苞状态。」
 *   「红椿·蕊 上限100点。施放变奏技能八千春秋时，回复100点。施放共鸣回路一日花时，回复100点。」 含苞状态持续时间=15，一日花冷却时间=25
 *   → 每动作消耗的蕊未公开：按命中段数估计（RUI 表，低；module.rui 可改）；酣梦 ×(1.5+0.05×蕾)（链6 再 +1.5）；能量 ×2.5 / 含苞中 ×0
 * 延奏 缠绕 (1001309): 「造成椿329.24%攻击的湮灭伤害。施放共鸣回路一日花后，下次延奏技能缠绕额外造成椿459.02%攻击的湮灭伤害。」
 *   → 额外段取 ww.json 未关联行（倍率取描述 459.02%，中）；链5 ×1.68
 * 共鸣链：1 变奏暴伤 +28%（解析）；2 一日花 ×2.2；3 解放 ×1.5、含苞期间攻击 +58%（模块光环）；4 变奏→全队普攻 +25%（解析）；5 变奏 ×4.03、延奏 ×1.68；6 酣梦 +150% / 永生花（未建模，低）。
 * 专武 裁春 (21020026)：「自身的协奏能量消耗时，自身普攻伤害加成提升40%，持续10秒…若切换至其他角色则该效果提前结束」→ 一日花施放时触发（模块）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  // estimated 红椿·蕊 drained per action (≈ by hit count; low)
  const RUI = { A1: 4, A2: 6, A3: 8, A4: 36, H: 8, hong: 8, v1: 5, v2: 8, v3: 12, jh: 57, v4: 12, anrui: 20, I: 0, yrh: 0 };
  const AFFECT = new Set(['A1', 'A2', 'A3', 'A4', 'H', 'hong', 'v1', 'v2', 'v3', 'jh', 'v4', 'anrui']);
  return WW.registerChar({
    id: 1603, chainModeled: 6, name: '椿', version: '0.1', confidence: 'medium',
    notes: ['红椿·蕊 每动作消耗量为估计（低，module.rui 覆盖）', '酣梦 ×(1.5+0.05×蕾)；含苞中基础共鸣能量回复 0、非含苞消耗蕊时 ×2.5',
      'A4 为长按段并自动接 A5；盛绽中 H（第3段后）= 烬华蔓舞 + 自动第4段', '链6 永生花未建模（低）'],
    audit: { role: 'dps', finishers: ['yrh'], window: 25, sig: 21020026, alts: [21020015, 21020045, 21020104], solo: 'camellya_solo.json', team: 'team_camellya.json', teamMi: 0 },
    frames: {
      A1: '普攻·Basic: Burgeoning 1', A2: '普攻·Basic: Burgeoning 2', A3: '普攻·Basic: Burgeoning 3', A4: '普攻·Basic: Burgeoning 4 (Hold)', A5: '普攻·Basic: Burgeoning 5', jh: '普攻·Basic: Blazing Waltz (Hold)',
      H: '重击·Heavy: Pruning', hong: '共鸣技能·Skill 1: Crimson Blossom', v1: '普攻·Basic: Vining Waltz 1', v2: '普攻·Basic: Vining Waltz 2',
      v3: '普攻·Basic: Vining Waltz 3', v4: '普攻·Basic: Vining Waltz 4', anrui: '共鸣技能·Skill 2: Floral Ravage',
      R: '共鸣解放·Liberation: Fervor Efflorescent', yrh: '共鸣回路·Forte: Ephemeral', I: '变奏入场·Intro: Everblooming',
    },
    resources: [
      { key: 'rui', name: '红椿·蕊', max: 100, segmented: false, confidence: 'medium', basis: '上限/回复为描述；消耗量估计' },
      { key: 'lei', name: '红椿·蕾', max: 10, segmented: true, confidence: 'medium' },
      { key: 'hb', name: '含苞（秒）', max: 15, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.hbUntil, t).toFixed(2) },
      { key: 'sz', name: '盛绽', max: 1, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 4, durs: [0.32, 0.55, 1.03, 2.47] });
      const s1 = H.skill(1);
      K.A5 = H.act({ key: 'A5', cls: 'A', skill: 1, labels: ['第五段伤害'], levelKey: 'basic', ownStage: true, dur: 1.57 });
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, hits: s1.hits.filter((h) => h.label === '重击伤害' && h.type === 'basic'), levelKey: 'basic', dur: 1.45, label: '重击·修枝（视为普攻）' }),
        hong: H.act({ key: 'hong', cls: 'E', skill: 2, labels: ['红椿盛绽伤害'], levelKey: 'skill', concertoParam: '红椿盛绽回复协奏能量', cooldown: 4, cdKey: 'E', dur: 1.42 }),
        anrui: H.act({ key: 'anrui', cls: 'E', skill: 2, labels: ['黯蕊猎心伤害'], levelKey: 'skill', concertoParam: '黯蕊猎心回复协奏能量', dur: 1.6 }),
        v1: H.act({ key: 'v1', cls: 'A', skill: 2, labels: ['蔓舞第一段伤害'], levelKey: 'skill', ownStage: true, dur: 0.62 }),
        v2: H.act({ key: 'v2', cls: 'A', skill: 2, labels: ['蔓舞第二段伤害'], levelKey: 'skill', ownStage: true, dur: 0.6 }),
        v3: H.act({ key: 'v3', cls: 'A', skill: 2, labels: ['蔓舞第三段伤害'], levelKey: 'skill', ownStage: true, dur: 1.18 }),
        v4: H.act({ key: 'v4', cls: 'A', skill: 2, labels: ['蔓舞第四段伤害'], levelKey: 'skill', ownStage: true, dur: 1.37 }),
        jh: H.act({ key: 'jh', cls: 'A', skill: 2, labels: ['烬华蔓舞伤害'], levelKey: 'skill', ownStage: true, dur: 1.95 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 4.4, scale: ch >= 3 ? { '*': 1.5 } : null }),
        yrh: H.act({ key: 'yrh', cls: 'E', skill: 6, labels: ['一日花伤害'], levelKey: 'forte', cooldown: 25, cdKey: 'yrh', dur: 1.42, scale: ch >= 2 ? { '*': 2.2 } : null, inferred: ch >= 2 ? '链2：一日花 ×2.2' : null }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.28, scale: ch >= 5 ? { '*': 4.03 } : null }),
      });
      const o11 = H.skill(11);
      const extra = (o11.unlinkedDamage || []).find((r) => r.type === 'outro');
      const c5 = ch >= 5 ? { '*': 1.68 } : null;
      K.O = B.outro(H, '缠绕', { scale: c5 });
      K.Oplus = H.act({ key: 'O', cls: 'O', skill: 11, hits: o11.hits.concat(extra ? [C.rowHit(H, 11, extra.damageId, { label: '缠绕（一日花后额外）', mult: 4.5902, why: '描述「下次延奏技能缠绕额外造成椿459.02%攻击」' })] : [
        Object.assign({}, o11.hits[0], { label: '缠绕（一日花后额外）', multiplier: [4.5902], confidence: 'medium', lowReason: '无对应 damage 行，按描述倍率复制主行' })]), levelKey: 'outro', label: '缠绕（一日花后）', scale: c5 });
      // 裁春「自身的协奏能量消耗时…普攻伤害加成提升40%」→ 一日花消耗协奏时由模块触发
      B.patch(H, /自身的协奏能量消耗时/, { mode: 'module' }, '模块：一日花消耗协奏时触发', 'weapon');
      H.mem._caiChun = (H.findBuff((b) => b.kind === 'weapon' && /自身的协奏能量消耗时/.test(b.text || ''))[0] || {}).id;
      B.patch(H, /含苞状态期间，椿的攻击提升58%/, { mode: 'module' }, '模块：含苞期间光环', 'chain');
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'A4', 'v1', 'v2', 'v3', 'v4'],
    init(api) { const st = api.H.opts.start || {}; return { rui: st.rui != null ? st.rui : 0, lei: 0, leiUntil: null, hbUntil: null, hbF: 0, sz: 0, st: 0, vs: 0, ephem: false, acc: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const hb = on(cs.hbUntil, t) && cs.rui > 1e-9;
      const boost = (a) => {
        let x = a;
        if (hb && AFFECT.has(a.key)) x = Object.assign({}, a, { scale: { '*': (a.scale && a.scale['*'] || 1) * cs.hbF }, energy: 0, inferred: '含苞·酣梦 ×' + cs.hbF.toFixed(2) + '（能量回复 0）' });
        else if (!hb && cs.rui > 1e-9 && AFFECT.has(a.key)) x = Object.assign({}, a, { energy: a.energy * 2.5 });
        return { act: x };
      };
      switch (btn) {
        case 'A': if (cs.sz) return boost(K['v' + ((cs.vs % 4) + 1)]); return boost(cs.st === 3 ? B.combo(api, ['A4', 'A5'], { label: '育种·第四段（长按）→第五段（自动）' }) : K['A' + ((cs.st % 4) + 1)]);
        case 'H': if (cs.sz) return boost(cs.vs === 3 ? B.combo(api, ['jh', 'v4'], { label: '烬华蔓舞→蔓舞第四段（自动）' }) : K['v' + ((cs.vs % 4) + 1)]); return boost(K.H);
        case 'E':
          if (api.ms.concerto >= 100 - 1e-9 && api.cdReady('yrh')) return { act: K.yrh };
          return cs.sz ? boost(K.anrui) : (api.cdReady('E') ? boost(K.hong) : { blocked: '红椿盛绽冷却中' });
        case 'R': return { act: K.R };
        case 'I': return { act: K.I };
        case 'O': return { act: cs.ephem ? K.Oplus : K.O };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      const rui = Object.assign({}, RUI, api.H.opts.rui || {});
      const hb = on(cs.hbUntil, t) && cs.rui > 1e-9;
      // 「施放第3段普攻或重击修枝后，长按普攻，将会持续攻击目标」→ 重击后 A = 长按段
      if (/^A\d$/.test(k)) cs.st = k === 'A4' ? 0 : +k.slice(1); else if (k === 'H') cs.st = 3; else if (k !== 'hong') cs.st = 0;
      if (/^v\d$/.test(k)) cs.vs = +k.slice(1) % 4; if (k === 'jh') cs.vs = 0;
      if (AFFECT.has(k) && cs.rui > 1e-9) {
        const used = Math.min(cs.rui, rui[k] || 0);
        cs.rui -= used;
        if (!hb) {
          cs.acc += used;
          const n = Math.floor(cs.acc / 10 + 1e-9);
          if (n > 0) { cs.acc -= n * 10; api.addConcerto(api.mi, 4 * n); cs.lei = Math.min(10, (on(cs.leiUntil, t) ? cs.lei : 0) + n); cs.leiUntil = te + 15; }
        } else if (cs.rui <= 1e-9) cs.hbUntil = te; // 消耗完蕊 → 含苞提前结束
      }
      switch (k) {
        case 'hong': cs.sz = 1; cs.vs = 0; break;
        case 'anrui': cs.sz = 0; break;
        case 'I': cs.rui = 100; cs.acc = 0; break;
        case 'yrh': {
          api.addConcerto(api.mi, -70);
          const lei = on(cs.leiUntil, t) ? cs.lei : 0;
          cs.hbF = 1 + 0.5 + 0.05 * Math.min(10, lei) + (api.H.chain >= 6 ? 1.5 : 0);
          cs.lei = 0; cs.leiUntil = null; cs.rui = 100; cs.acc = 0; cs.hbUntil = te + 15; cs.ephem = true;
          if (api.mem._caiChun) api.fireBuff(api.mem._caiChun, api.mi, { duration: 10 });
          break;
        }
        default: break;
      }
    },
    auras(api, target) {
      if (target !== api.mi || api.H.chain < 3) return [];
      return on(api.cs.hbUntil, api.t) && api.cs.rui > 1e-9 ? [{ key: 'atkPct', value: 0.58 }] : [];
    },
    swapOut(api) { api.cs.hbUntil = null; api.cs.sz = 0; return {}; },
    onOutro(api) { api.cs.ephem = false; },
    // search heuristic (not a game rule): 蕊 converts into 蕾/协奏 (→ 一日花); open 含苞 multiplies the next basics
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const hb = on(cs.hbUntil, t) && cs.rui > 1e-9;
      const lei = on(cs.leiUntil, t) ? cs.lei : 0;
      const wRate = (api.est(K.v1) + api.est(K.v2) + api.est(K.v3) + api.est(K.jh)) / 6.0;
      return (hb ? Math.min(B.rem(cs.hbUntil, t), cs.rui / 12) * wRate * (cs.hbF - 1) * 0.6 : (cs.rui / 100) * 0.3 * api.est(K.yrh)) + lei * 0.05 * 0.4 * api.est(K.yrh);
    },
  });
});
