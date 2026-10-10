/*
 * 尤诺 (1410) character module — worker-B.
 *
 * 普攻 祭者独步 (1003801): 月环·普攻 3 段（气动/普攻）；「月相流转·新月状态下…使用月弓进行最多3段…此次伤害为共鸣解放伤害」
 * 共鸣技能 先觉赋格 (1003802):「原初的律动（冷却 6）…不处于月相流转状态时，施放月环·普攻第3段、变奏技能或原初的律动时，共鸣技能替换为告终的喧响，持续5秒。
 *   施放告终的喧响…进入月相流转状态。处于弦月时→未终的喧响（与告终共用冷却 8）。处于新月时→越限的弦引（2 次，冷却 10，共鸣解放伤害）」
 * 共鸣解放 溺失月海 (1003803): 1093.46%（消耗 125，冷却 25），进入月相流转
 * 共鸣回路 于盈亏间涨落 (1003807):「月相流转分为弦月和新月…初始默认进入弦月…重击·流变进行两种状态间的切换（月相流转持续时间=15）。
 *   弦月：月环攻击命中目标时可恢复【灵性】。新月：月弓·普攻、越限的弦引…可消耗【灵性】，提升该次技能的伤害倍率（强化伤害行）。
 *   重击·至臻的完满：协奏能量充满时，重击替换为至臻的完满…结束自身的月相流转状态…展开满月领域，该效果25秒最多可触发一次。
 *   满月领域：处于领域中的登场角色获得护盾时，可获得一层苍白死光的祝颂（0.5 秒一次）。苍白死光的祝颂：全伤害加深4%，10秒，可叠加10层…切换至其他角色则提前结束。
 *   灵性：变奏 +40、共鸣解放 +60、告终/未终的喧响 +25；月环命中可获得。」
 *   → 灵性：月环每段获取、月弓/弦引强化消耗量未公开（估计：月环 10/段，强化消耗 20/段、弦引 30；低）
 *   → 祝颂：尤诺自身每个动作获得护盾（固有 盈昇）→ 领域内每动作 +1 层；队友仅在本模块不提供护盾时不叠（已标注）
 * 固有：盈昇（每个动作护盾）、新衍（变奏/解放直接 +5 层祝颂）
 * 延奏 晦渡为明 (1003809): 100% + 下一位登场角色重击伤害加深 50% 14 秒（解析）
 * 共鸣链：1 月相流转攻击 +40%（模块）；2 祝颂满 10 层额外全伤害加深 40%（模块）；3 月相流转时月弓/弦引加深 65%（模块）；5 共鸣解放 +20%（解析）；6 至臻的完满 +1600%、再入新月、灵性 100（模块）
 * 专武 万物持存的注释 (21040046)：「自身获得护盾时：共鸣解放伤害无视目标7.2%防御，每0.5秒可生效1次，可叠加5层，持续7秒」→ 模块：每个动作（盈昇护盾）触发，5 层
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21040046;
  const COST = { bow: 20, arc: 30 }, RING = 10;
  function addZs(cs, n, t) { if (!on(cs.zsUntil, t)) cs.zs = 0; cs.zs = Math.min(10, cs.zs + n); cs.zsUntil = t + 10; }
  return WW.registerChar({
    id: 1410, chainModeled: 6, name: '尤诺', version: '0.1', confidence: 'medium',
    notes: ['灵性：月环获取/月弓与弦引强化消耗为估计（低）', '苍白死光的祝颂：领域内尤诺每动作 +1 层（盈昇护盾）；队友叠层需要护盾来源，本模块不给队友叠层（低）', '越限的弦引 2 次可用次数：按冷却 5 秒近似（中）'],
    audit: { role: 'support', finishers: ['full', 'lib'], window: 25, sig: SIG, alts: [21040015, 21040045, 21040074], solo: 'iuno_solo.json', team: 'team_iuno.json', teamMi: 1 },
    frames: {
      r1: '普攻·Basic: Moon Ring 1', r2: '普攻·Basic: Moon Ring 2', r3: '普攻·Basic: Moon Ring 3',
      b1: '普攻·Basic: Moonbow 1', b2: '普攻·Basic: Moonbow 2', b3: '普攻·Basic: Moonbow 3', eb1: '普攻·Basic: Enhanced Moonbow 1', eb2: '普攻·Basic: Enhanced Moonbow 2', eb3: '普攻·Basic: Enhanced Moonbow 3',
      fxB: '重击·Heavy 1: Flux - Moonbow', fxR: '重击·Heavy 1: Flux - Moonring', full: '重击·Heavy 2: Absolute Fullness',
      po: '共鸣技能·Skill 1: Pulse of Origins', cr: '共鸣技能·Skill 2: Closing Refrain', ur: '共鸣技能·Skill 3: Unfinished Refrain', arc: '共鸣技能·Skill 4: Arc Beyond the Edge', earc: '共鸣技能·Skill 4: Enhanced Arc Beyond the Edge',
      lib: '共鸣解放·Liberation: Beneath Lunar Tides', I: '变奏入场·Intro: Illuminated Manifestation',
    },
    resources: [
      { key: 'ls', name: '灵性', max: 100, segmented: false, confidence: 'low' },
      { key: 'ph', name: '月相（1弦月/2新月）', max: 2, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.mfUntil, t) ? cs.ph : 0) },
      { key: 'zs', name: '苍白死光的祝颂', max: 10, segmented: true, confidence: 'low', get: (cs, t) => (on(cs.zsUntil, t) ? cs.zs : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = {};
      for (let k = 1; k <= 3; k++) {
        const cn = B.CN[k - 1];
        K['r' + k] = H.act({ key: 'r' + k, cls: 'A', skill: 1, labels: ['月环·普攻第' + cn + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.48, 0.85, 1.67][k - 1], label: '月环·普攻' + k });
        K['b' + k] = H.act({ key: 'b' + k, cls: 'A', skill: 1, labels: ['月弓·普攻第' + cn + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.57, 0.75, 1.53][k - 1], label: '月弓·普攻' + k });
        K['eb' + k] = H.act({ key: 'eb' + k, cls: 'A', skill: 6, labels: ['月弓·普攻第' + cn + '段强化伤害'], levelKey: 'forte', concertoParam: '月弓·普攻第' + cn + '段额外回复协奏能量', ownStage: true, dur: [0.57, 0.75, 1.53][k - 1], label: '月弓·普攻' + k + '（强化）' });
      }
      Object.assign(K, {
        fxB: H.act({ key: 'fxB', cls: 'H', skill: 6, labels: ['流变·月弓伤害'], levelKey: 'forte', dur: 1.43, label: '重击·流变·月弓' }),
        fxR: H.act({ key: 'fxR', cls: 'H', skill: 6, labels: ['流变·月环伤害'], levelKey: 'forte', dur: 1.9, label: '重击·流变·月环' }),
        full: H.act({ key: 'full', cls: 'H', skill: 6, labels: ['至臻的完满伤害', '至臻的完满治疗量'], levelKey: 'forte', dur: 1.48, label: '重击·至臻的完满' }),
        po: H.act({ key: 'po', cls: 'E', skill: 2, labels: ['原初的律动伤害'], levelKey: 'skill', concertoParam: '原初的律动回复协奏能量', cooldown: 6, cdKey: 'po', dur: 1.15, label: '原初的律动' }),
        cr: H.act({ key: 'cr', cls: 'E', skill: 2, labels: ['告终的喧响伤害'], levelKey: 'skill', concertoParam: '告终的喧响回复协奏能量', cooldown: 8, cdKey: 'refrain', dur: 1.82, label: '告终的喧响' }),
        ur: H.act({ key: 'ur', cls: 'E', skill: 2, labels: ['未终的喧响伤害'], levelKey: 'skill', concertoParam: '未终的喧响回复协奏能量', cooldown: 8, cdKey: 'refrain', dur: 1.82, label: '未终的喧响' }),
        arc: H.act({ key: 'arc', cls: 'E', skill: 2, labels: ['越限的弦引伤害'], levelKey: 'skill', concertoParam: '越限的弦引回复协奏能量', cooldown: 5, cdKey: 'arc', dur: 1.42, label: '越限的弦引' }),
        earc: H.act({ key: 'earc', cls: 'E', skill: 6, labels: ['越限的弦引强化伤害', '越限的弦引治疗量'], levelKey: 'forte', concertoParam: '越限的弦引额外回复协奏能量', cooldown: 5, cdKey: 'arc', dur: 1.42, label: '越限的弦引（强化）' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 4.17, label: '溺失月海' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.35 }),
        O: B.outro(H, '晦渡为明'),
      });
      if (ch >= 6) K.full = Object.assign({}, K.full, { hits: K.full.hits.map((h, i) => (i === 0 ? Object.assign({}, h, { multiplier: h.multiplier.map((x) => x + 16) }) : h)), inferred: '链6 +1600%' });
      if (H.weaponId === SIG) B.patch(H, /自身获得护盾时：共鸣解放伤害无视目标7.2%防御/, { trigger: { on: 'cast', kinds: ['A', 'H', 'E', 'R', 'I'] }, maxStacks: 5, mode: 'auto' }, '模块：盈昇——每个动作获得护盾', 'weapon');
      return K;
    },
    fillerKeys: ['r1', 'r2', 'r3'],
    init(api) { const st = api.H.opts.start || {}; return { ls: st.ls || 0, ph: 0, mfUntil: null, st: 0, crUntil: null, fieldUntil: null, fieldCd: 0, zs: 0, zsUntil: null, zsNext: 0, tz: {}, c4Until: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const mf = on(cs.mfUntil, t);
      switch (btn) {
        case 'A': {
          const n = (cs.st % 3) + 1;
          if (mf && cs.ph === 2) return { act: cs.ls >= COST.bow - 1e-9 ? K['eb' + n] : K['b' + n] };
          return { act: K['r' + n] };
        }
        case 'H':
          if (api.ms.concerto >= 100 - 1e-9 && t >= cs.fieldCd - 1e-9) return { act: K.full };
          if (mf) return { act: cs.ph === 1 ? K.fxB : K.fxR };
          return { blocked: '无重击（需月相流转或协奏满）' };
        case 'E':
          if (mf && cs.ph === 2) { const a = cs.ls >= COST.arc - 1e-9 ? K.earc : K.arc; return api.cdReady('arc') ? { act: a } : { blocked: '越限的弦引冷却中' }; }
          if (mf && cs.ph === 1) return api.cdReady('refrain') ? { act: K.ur } : { blocked: '喧响冷却中' };
          if (on(cs.crUntil, t)) return api.cdReady('refrain') ? { act: K.cr } : { blocked: '喧响冷却中' };
          return api.cdReady('po') ? { act: K.po } : { blocked: '原初的律动冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, ch = api.H.chain, out = [];
      if (ch >= 3 && on(cs.mfUntil, t) && /^(e?b\d|e?arc)$/.test(act.key)) out.push({ key: 'deep:all', value: 0.65 });
      return out;
    },
    auras(api, target) {
      const cs = api.cs, t = api.t, out = [];
      if (target !== api.mi) {
        const z = (cs.tz || {})[target];
        if (z && on(z.until, t) && api.s.active === target) { out.push({ key: 'deep:all', value: 0.04 * z.n }); if (api.H.chain >= 2 && z.n >= 10) out.push({ key: 'deep:all', value: 0.4 }); }
        return out;
      }
      if (on(cs.zsUntil, t) && cs.zs > 0 && api.s.active === api.mi) { out.push({ key: 'deep:all', value: 0.04 * cs.zs }); if (api.H.chain >= 2 && cs.zs >= 10) out.push({ key: 'deep:all', value: 0.4 }); }
      if (api.H.chain >= 1 && on(cs.mfUntil, t)) out.push({ key: 'atkPct', value: 0.4 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, t = api.t, ch = api.H.chain;
      const mf = on(cs.mfUntil, t);
      const enter = (ph) => { cs.ph = ph; if (!mf) cs.mfUntil = te + 15; };
      if (/^r\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (mf) cs.ls = Math.min(100, cs.ls + RING); if (n === 3 && !mf) cs.crUntil = te + 5; }
      else if (/^e?b\d$/.test(k)) { const n = +k.slice(-1); cs.st = n % 3; if (k[0] === 'e') cs.ls -= COST.bow; }
      else switch (k) {
        case 'po': cs.crUntil = te + 5; break;
        case 'cr': cs.ls = Math.min(100, cs.ls + 25); cs.crUntil = null; enter(1); break;
        case 'ur': cs.ls = Math.min(100, cs.ls + 25); break;
        case 'earc': cs.ls -= COST.arc; break;
        case 'fxB': cs.ph = 2; cs.st = 0; break;
        case 'fxR': cs.ph = 1; cs.st = 0; break;
        case 'full':
          cs.mfUntil = te; cs.fieldUntil = te + 30; cs.fieldCd = t + 25; cs.st = 0; if (ch >= 4) cs.c4Until = te + 30;
          if (ch >= 6) { cs.ph = 2; cs.mfUntil = te + 15; cs.ls = 100; api.ms.cd.arc = 0; }
          break;
        case 'lib': cs.ls = Math.min(100, cs.ls + 60); cs.ph = 1; cs.mfUntil = te + 15; addZs(cs, 5, te); break;
        case 'I': cs.ls = Math.min(100, cs.ls + 40); cs.crUntil = te + 5; addZs(cs, 5, te); break;
        default: break;
      }
      // 盈昇护盾 → 领域内祝颂 +1（0.5 秒一次）
      if (on(cs.fieldUntil, te) && te >= cs.zsNext - 1e-9 && act.cls !== 'O') { cs.zsNext = te + 0.5; addZs(cs, 1, te); }
    },
    // 满月领域：登场队友获得护盾时 +1 层（0.5 秒一次）。护盾来源：核心 shield 事件（任意队员 api.shield，如 奥古斯塔「荣誉的加护」）；尤诺链4 仍用伤害事件近似
    onTeam(api, ev) {
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if (ev.type === 'intro' || ev.type === 'swap') { cs.tz = {}; return; }
      // B9（核心 shield 事件）：领域中登场角色获得护盾（任意来源，含 奥古斯塔「荣誉的加护」）
      let mi = null;
      if (ev.type === 'shield') mi = ev.mi;
      // 链 4（尤诺自身给护盾的效果未接 api.shield）：领域内登场队友造成伤害时视同获得护盾（工作区，中）
      else if (ev.type === 'damage' && api.H.chain >= 4 && on(cs.c4Until, t)) mi = ev.mi;
      if (mi == null || mi === api.mi || !on(cs.fieldUntil, t) || api.s.active !== mi) return;
      cs.tz = cs.tz || {};
      const z = cs.tz[mi] || { n: 0, until: null, next: 0 };
      if (t < z.next - 1e-9) return;
      if (!on(z.until, t)) z.n = 0;
      z.n = Math.min(10, z.n + 1); z.until = t + 10; z.next = t + 0.5; cs.tz[mi] = z;
    },
    swapOut(api) { api.cs.zs = 0; api.cs.zsUntil = null; },
    // search heuristic (not a game rule): 灵性 → 强化月弓/弦引; 月相流转剩余
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      return cs.ls / 100 * 0.3 * (api.est(K.eb3) + api.est(K.earc)) + (on(cs.mfUntil, t) ? 0.2 * api.est(K.earc) : 0) + (api.ms.concerto >= 100 && t >= cs.fieldCd ? 0.3 * api.est(K.full) : 0);
    },
  });
});
