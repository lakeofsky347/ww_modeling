/*
 * 卜灵 (1307) character module — worker-B.
 *
 * 普攻 卦起雷动 (1004301): 普攻 4 段；重击按卦象「按从左到右顺序消耗高亮状态下的」两枚：
 *   艮震 → 山雷颐 178.93%；震艮 → 雷山小过 89.47%；艮艮 → 艮为山（治疗）；震震 → 震为雷（治疗，8 秒持续）；不足 2 枚 → 鬼门占卦（不建模，阻止）
 *   重击各回复协奏 15；耐力 20
 *   【卦象】「上限4枚，达上限时…最左侧【卦象】将被移除」；「普攻第2段造成伤害时获得【卦象·艮】」「普攻第4段、空中攻击造成伤害时获得【卦象·震】」「施放共鸣技能·遁影牵雷时获得【卦象·震】」
 *   → 模块：高亮 = 最左两枚（中）
 * 共鸣技能 遁影牵雷 (1004302): 58.40% + 牵引 5.84%×10，冷却 15，协奏 23；「施放共鸣技能后，一定时间内短按普攻，将会释放普攻第四段」
 * 共鸣解放 飞雷诀 (1004303): 357.86%，能量 150，冷却 24，协奏 20
 * 共鸣回路 雷炁化生 (1004307):
 *   「拥有【少阴】和【少阳】时…共鸣解放·飞雷诀替换为共鸣解放·飞雷诀·归一」536.79%（施放后消耗少阴/少阳：中）
 *   「生成【五雷荡煞阵】，每2秒…造成导电伤害，并添加2层【电磁效应】，持续24秒」19.89%
 *   雷法：一气初动 →（队伍施放变奏）→ 两仪交泰「登场的角色共鸣技能伤害加成提升10%」→（变奏）→ 三才合一「…提升25%」
 *   少阳：山雷颐 / 雷山小过；少阴：艮为山 / 震为雷
 *   → 阵伤害在队伍动作（伤害事件）覆盖的时间段内按 2 秒节拍结算（中：切人间隙的节拍会推迟到下一个动作）
 * 固有 我名地上仙：「变奏技能·召劾鬼神造成伤害时为目标附加4层【电磁效应】，该效果每10秒可生效1次」
 * 变奏 召劾鬼神: 131.10% + 治疗
 * 延奏 役将驱邪：「附近队伍中所有角色全伤害加深15%，持续30秒」（解析 buff）+ 持续治疗（不建模）
 * 动作帧：WuwaLAB（按原样映射）
 * 专武：无（null）；共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const HV = { gz: 'shan', zg: 'lei', gg: 'gen', zz: 'zhen' };
  const push = (q, x) => { q = q + x; return q.length > 4 ? q.slice(q.length - 4) : q; };
  return WW.registerChar({
    id: 1307, chainModeled: 0, name: '卜灵', version: '0.1', confidence: 'medium',
    notes: ['高亮卦象 = 最左两枚（中）', '归一施放后消耗少阴 / 少阳（中）', '五雷荡煞阵每 2 秒定时结算（核心 api.every，空窗期也结算）', '鬼门占卦、空中攻击、闪避反击未建模', '治疗不计入伤害', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['shan', 'fl'], window: 25, sig: null, alts: [21050024, 21050044, 21050036], solo: 'buling_solo.json', team: 'team_buling.json', teamMi: 2 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Hexagram Calls, Lightning Falls'), {
      shan: '重击·Heavy: Mountain Over Thunder', lei: '重击·Heavy: Thunder Over Mountain', gen: '重击·Heavy: Twin Mountains', zhen: '重击·Heavy: Twin Thunders',
      E: '共鸣技能·Skill: In Shadow Thunder Stirs', fl: '共鸣解放·Liberation: Flashing Thunder Spell', gy: '共鸣解放·Liberation: Flashing Thunder Spell - Harmony',
      I: '变奏入场·Intro: Summon and Smite',
    }),
    resources: [
      { key: 'gx', name: '卦象（艮=1 震=2，左→右）', max: 2222, segmented: false, confidence: 'medium', get: (cs) => +(cs.q.replace(/g/g, '1').replace(/z/g, '2') || 0) },
      { key: 'yy', name: '少阳+少阴', max: 2, segmented: true, confidence: 'high', get: (cs) => (cs.sy ? 1 : 0) + (cs.sn ? 1 : 0) },
      { key: 'zhen', name: '五雷荡煞阵（秒）', max: 24, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.arr, t).toFixed(2) },
    ],
    kit(H) {
      const s1 = H.skill(1);
      const hv = (key, lab, d, label) => H.act({ key, cls: 'H', skill: 1, hits: s1.hits.filter((h) => !h.alt && h.label === lab), levelKey: 'basic', concertoParam: label + '回复协奏能量', dur: d, label, extra: { stamina: H.param(1, label + '耐力消耗') || 20 } });
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.47, 0.75, 0.52, 1.0] }), {
        shan: hv('shan', '重击·山雷颐伤害', 1.17, '重击·山雷颐'),
        lei: hv('lei', '重击·雷山小过伤害', 1.17, '重击·雷山小过'),
        gen: hv('gen', '重击·艮为山治疗量', 1.0, '重击·艮为山'),
        zhen: hv('zhen', '重击·震为雷治疗量', 1.0, '重击·震为雷'),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['引雷符伤害', '牵引持续伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 15, cdKey: 'E', dur: 0.88, label: '遁影牵雷' }),
        fl: H.act({ key: 'fl', cls: 'R', skill: 3, labels: ['飞雷诀伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 24, cdKey: 'R', dur: 4.07, label: '飞雷诀' }),
        gy: H.act({ key: 'gy', cls: 'R', skill: 6, labels: ['飞雷诀·归一伤害'], levelKey: 'forte', concertoParam: null, cost: H.R.energy.liberationCost, cooldown: 24, cdKey: 'R', dur: 4.07, label: '飞雷诀·归一', extra: { concerto: H.param(3, '回复协奏能量') || 20 } }),
        tick: H.act({ key: 'tick', cls: 'R', skill: 6, labels: ['五雷荡煞阵持续伤害'], levelKey: 'forte', dur: 0, label: '五雷荡煞阵', noConcertoFallback: true }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害', '技能治疗量'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.33 }),
        O: B.outro(H, '役将驱邪'),
      });
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { q: '', sy: false, sn: false, st: 0, arr: null, arrStart: 0, lastTick: 0, lf: 0, flCd: -99 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': {
          if (cs.q.length < 2) return { blocked: '卦象不足 2 枚（鬼门占卦未建模）' };
          return { act: K[HV[cs.q.slice(0, 2)]] };
        }
        case 'E': return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: cs.sy && cs.sn ? K.gy : K.fl };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      if (/^a\d$/.test(k)) {
        cs.st = +k.slice(1) % 4;
        if (k === 'a2') cs.q = push(cs.q, 'g');
        if (k === 'a4') cs.q = push(cs.q, 'z');
        return;
      }
      switch (k) {
        case 'shan': case 'lei': cs.q = cs.q.slice(2); cs.sy = true; break;
        case 'gen': case 'zhen': cs.q = cs.q.slice(2); cs.sn = true; break;
        case 'E': cs.q = push(cs.q, 'z'); cs.st = 3; break;
        case 'gy': cs.sy = false; cs.sn = false; cs.arr = te + 24; cs.arrStart = te; cs.lastTick = te - 2; cs.lf = 1; api.every('wl', 2, te + 24 - 1e-6, te); break; // B13: periodic hook → ticks also in idle windows
        case 'I': if (t >= cs.flCd - 1e-9) { api.addAnomaly('flare', 4); cs.flCd = t + 10; } break;
        default: break;
      }
    },
    // 雷法：阵存续期间，登场角色共鸣技能伤害加成（两仪交泰 10% / 三才合一 25%）
    auras(api, target) {
      const cs = api.cs;
      if (!on(cs.arr, api.t) || target !== api.s.active || cs.lf < 2) return [];
      return [{ key: 'dmg:skill', value: cs.lf >= 3 ? 0.25 : 0.1 }];
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'intro' && on(cs.arr, ev.t) && ev.t > cs.arrStart - 1e-9) { cs.lf = Math.min(3, cs.lf + 1); return; }
    },
    // B13: 五雷荡煞阵 每 2 秒一跳（核心 api.every 定时钩子，空窗期也结算）
    tick(api, key, t) {
      if (key !== 'wl') return;
      api.cs.lastTick = t;
      api.deal(api.mem.modKit.tick, { t });
      api.addAnomaly('flare', 2, { t });
    },
    // search heuristic (not a game rule): 卦象→重击；少阴少阳→归一；阵剩余节拍
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = (cs.q.length >= 2 ? 0.4 * api.est(K.shan) : 0) + (cs.sy ? 0.25 : 0) * api.est(K.gy) + (cs.sn ? 0.25 : 0) * api.est(K.gy);
      if (on(cs.arr, t)) v += 0.5 * (cs.arr - t) / 2 * api.est(K.tick);
      return v;
    },
  });
});
