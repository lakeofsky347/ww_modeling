/*
 * 琳奈 (1509) character module — worker-B.
 *
 * 普攻 泛彩流光 (1004501): 普攻 3 段；「普攻·灵感碰撞：处于「光学取样」阶段时，如果【溢彩】已满，按住普攻进入蓄力状态。蓄力期间，每0.2秒将15点【溢彩】转换为12.5%的【流光】…
 *   1级 <50% / 2级 50–100% / 3级 =100%」；「绮彩巡游·普攻 最多5段」「绮彩巡游·地面重击（普攻伤害）」
 * 共鸣技能 琳奈式创想 (1004502): 冷却 6；绮彩巡游·地面短按 → 加色混合（共享冷却）；绮彩巡游时长按 → 退出绮彩巡游（未建模长按）
 * 共鸣解放 爆炸喷涂 (1004503): 87.48%×10；「施放时使附近队伍中所有角色造成的伤害提升24%，持续30秒」（模块 aura：dmg:all 0.24）；
 *   「施放…一定时间内，短按普攻，可以施放普攻·向着多彩的明天！」
 * 共鸣回路 色光混合律 (1004507):
 *   「琳奈施放普攻·灵感碰撞时，进入绮彩巡游状态…施放绮彩巡游·普攻、地面重击、加色混合、变奏技能、向着多彩的明天！的一定时间内，每秒回复20%的【流光】（上限120）」
 *   「普攻·幻光折跃（跳跃）：至少拥有1/3【流光】时…消耗1/3最大【流光】…最多连续3段…每次施放获得1点【本色】」
 *   「拥有3点【本色】…普攻·视觉冲击（不处于冷却，冷却 25）1216.72%…使附近队伍中所有角色的谐度破坏增幅提升40点，持续30秒；否则 普攻·虹彩飞溅 304.18%。消耗3点【本色】」
 *   「【溢彩】上限120…光学取样阶段施放普攻、琳奈式创想…期间回复【溢彩】，施放变奏技能时回复（变奏 100）」→ 普攻/技能每次回复量未公开：估计 a1 20 / a2 30 / a3 30 / 技能 30（低）
 *   → 按钮映射：绮彩巡游中 H = 幻光折跃（跳跃）/ 本色 3 时 视觉冲击·虹彩飞溅；光学取样阶段 H = 灵感碰撞（溢彩满；否则普通重击不可用）
 *   → 谐度（偏移/干涉/光谱解析、谐度破坏增幅）未建模：见 CORE_CHANGES_NEEDED worker-B B4
 * 固有 自适应光学：变奏后 9 秒衍射伤害 +25%（解析为 15 秒 → 模块改 9 秒）
 * 变奏 来点儿颜色瞧瞧！: 22.48%×10；光学取样阶段 +100 溢彩
 * 延奏 有空一起兜风！: 下一位登场角色全伤害加深 15%、共鸣解放伤害加深 25% 14 秒（解析）；退出绮彩巡游
 * 共鸣链：2 全伤害加深 25% + 延奏额外 25%（模块）；3 视觉冲击/虹彩飞溅 +90%；4 攻击 +20%；5 解放 +70%（模块）；1/6 未建模
 * 专武 溢彩荧辉 (21030046):「每次自身施放普攻技能期间为目标附加【震谐·偏移】或【集谐·偏移】时，使队伍中的角色造成的伤害提升8%，最多叠加3层，持续30秒」
 *   → 偏移附加未建模；模块：幻光折跃/视觉冲击/虹彩飞溅（附加光致变染）时 +1 层（中）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21030046;
  const YC = { n1: 20, n2: 30, n3: 30, ep: 30 };
  const LG_GAIN = 24;   // 20%/s of 120
  const scale = (a, m, key) => Object.assign({}, a, { key, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1509, chainModeled: 5, name: '琳奈', version: '0.1', confidence: 'medium',
    notes: ['溢彩每次回复量为估计（低）', '流光：绮彩巡游中每个动作按 20%/秒×时长 回复（中）', '谐度/偏移/光谱解析未建模（B4）', '绮彩巡游·地面重击未单列；跳跃映射为 H'],
    audit: { role: 'support', finishers: ['vi', 'lib'], window: 25, sig: SIG, alts: [21030015, 21030045, 21030064], solo: 'lynae_solo.json', team: 'team_lynae.json', teamMi: 1 },
    frames: Object.assign(B.stageFrames('n', 3, '普攻·Basic: Chroma Drift'), B.stageFrames('p', 5, '普攻·Basic: Kaleidoscopic Parade'), B.stageFrames('lp', 3, '共鸣回路·Basic: Polychrome Leap'), {
      sc: '共鸣回路·Basic: Spark Collision Lv.3', ep: '共鸣技能·Skill 1: Lynae-Style Palettes', mix: '共鸣技能·Skill 2: Additive Color',
      hc: '共鸣回路·Basic: Iridescent Splash', vi: '共鸣回路·Basic: Visual Impact', lib: '共鸣解放·Liberation: Prismatic Overblast', mt: '共鸣解放·Basic: To a Vivid Tomorrow!',
      I: '变奏入场·Intro: Time to Show Some Colors!', O: "延奏·Outro: Let's Hit the Road!",
    }),
    resources: [
      { key: 'yc', name: '溢彩', max: 120, segmented: false, confidence: 'low' },
      { key: 'lg', name: '流光', max: 120, segmented: false, confidence: 'medium' },
      { key: 'bs', name: '本色', max: 3, segmented: true, confidence: 'high' },
      { key: 'pd', name: '绮彩巡游', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.pd ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = Object.assign(B.stages(H, { n: 3, prefix: 'n', pre: '普攻', durs: [0.52, 1.1, 0.73] }),
        B.stages(H, { n: 5, prefix: 'p', pre: '绮彩巡游·普攻', durs: [0.58, 0.47, 0.67, 1.17, 1.65] }),
        B.stages(H, { n: 3, prefix: 'lp', skill: 6, levelKey: 'forte', label: (k) => '普攻·幻光折跃·第' + k + '段', durs: [0.77, 0.7, 0.62] }), {
          sc: H.act({ key: 'sc', cls: 'H', skill: 1, labels: ['普攻·灵感碰撞·3级伤害'], levelKey: 'basic', dur: 2.62, label: '普攻·灵感碰撞·3级' }),
          ep: H.act({ key: 'ep', cls: 'E', skill: 2, labels: ['琳奈式创想伤害'], levelKey: 'skill', cooldown: 6, cdKey: 'E', dur: 1.27, label: '琳奈式创想' }),
          mix: H.act({ key: 'mix', cls: 'E', skill: 2, labels: ['加色混合伤害'], levelKey: 'skill', cooldown: 6, cdKey: 'E', dur: 1.25, label: '加色混合' }),
          hc: H.act({ key: 'hc', cls: 'H', skill: 6, labels: ['普攻·虹彩飞溅伤害'], levelKey: 'forte', dur: 1.07, label: '普攻·虹彩飞溅' }),
          vi: H.act({ key: 'vi', cls: 'H', skill: 6, labels: ['普攻·视觉冲击伤害'], levelKey: 'forte', cooldown: 25, dur: 1.75, label: '普攻·视觉冲击' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['爆炸喷涂伤害'], levelKey: 'liberation', concertoParam: '爆炸喷涂回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 4, label: '爆炸喷涂' }),
          mt: H.act({ key: 'mt', cls: 'A', skill: 3, labels: ['普攻·向着多彩的明天！伤害'], levelKey: 'liberation', dur: 2.65, label: '普攻·向着多彩的明天！' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['来点儿颜色瞧瞧！伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.27 }),
          O: B.outro(H, '有空一起兜风！'),
        });
      for (const k of ['lp1', 'lp2', 'lp3', 'vi', 'hc']) K[k].cls = 'H';
      if (ch >= 3) { K.vi = scale(K.vi, (12.1672 + 0.9) / 12.1672, 'vi'); K.hc = scale(K.hc, (3.0418 + 0.9) / 3.0418, 'hc'); }
      if (ch >= 5) K.lib = scale(K.lib, (0.8748 * 10 + 0.7) / (0.8748 * 10), 'lib');
      B.patch(H, /自适应光学|衍射伤害加成提升25%/, { duration: 9 }, '模块：原文 9 秒（解析为 15）', 'inherent');
      if (H.weaponId === SIG) {
        B.patch(H, /震谐·偏移|集谐·偏移/, { mode: 'module', trigger: { on: 'manual' } }, '模块：幻光折跃/视觉冲击/虹彩飞溅附加光致变染时 +1 层（偏移未建模，中）', 'weapon');
        H._wTeam = H.findBuff((b) => b.kind === 'weapon' && /震谐·偏移|集谐·偏移/.test(b.text || '')).map((b) => b.id);
      }
      return K;
    },
    fillerKeys: ['n1', 'n2', 'n3'],
    init(api) { const st = api.H.opts.start || {}; return { yc: st.yc || 0, lg: 0, bs: 0, pd: false, st: 0, pst: 0, lpN: 0, libUntil: null, mtUntil: null, team24Until: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      switch (btn) {
        case 'A':
          if (on(cs.mtUntil, t)) return { act: K.mt };
          if (cs.pd) return { act: K['p' + ((cs.pst % 5) + 1)] };
          return { act: K['n' + ((cs.st % 3) + 1)] };
        case 'H':
          if (!cs.pd) return cs.yc >= 120 - 1e-9 ? { act: K.sc } : { blocked: '溢彩未满' };
          if (cs.bs >= 3) return { act: api.cdReady('vi') ? K.vi : K.hc };
          if (cs.lg >= 40 - 1e-9) return { act: K['lp' + ((cs.lpN % 3) + 1)] };
          return { blocked: '流光不足 1/3' };
        case 'E': return api.cdReady('E') ? { act: cs.pd ? K.mix : K.ep } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api) {
      const ch = api.H.chain, out = [];
      if (ch >= 2) out.push({ key: 'deep:all', value: 0.25 });
      if (ch >= 4) out.push({ key: 'atkPct', value: 0.2 });
      return out;
    },
    auras(api) {
      const cs = api.cs, t = api.t, out = [];
      if (on(cs.team24Until, t)) out.push({ key: 'dmg:all', value: 0.24 });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, dur = te - api.t;
      const lgGain = () => { cs.lg = Math.min(120, cs.lg + LG_GAIN * dur); };
      if (k !== 'mt' && k !== 'lib') cs.mtUntil = null;
      if (/^n\d$/.test(k)) { cs.st = +k.slice(1) % 3; cs.yc = Math.min(120, cs.yc + YC[k]); return; }
      if (/^p\d$/.test(k)) { cs.pst = +k.slice(1) % 5; lgGain(); return; }
      if (/^lp\d$/.test(k)) { cs.lpN = +k.slice(2) % 3; cs.lg -= 40; cs.bs = Math.min(3, cs.bs + 1); cs.pst = 1; this.wStack(api, te); return; }
      switch (k) {
        case 'sc': cs.yc = 0; cs.pd = true; cs.lg = 120; cs.bs = 0; cs.pst = 0; break;
        case 'ep': cs.yc = Math.min(120, cs.yc + YC.ep); cs.st = 1; break;
        case 'mix': lgGain(); cs.pst = 1; break;
        case 'vi': case 'hc': cs.bs = 0; cs.pst = 1; this.wStack(api, te); break;
        case 'lib': cs.team24Until = te + 30; cs.mtUntil = te + 5; break;
        case 'mt': cs.mtUntil = null; if (cs.pd) { lgGain(); cs.pst = 1; } break;
        case 'I': if (!cs.pd) cs.yc = Math.min(120, cs.yc + 100); else lgGain(); break;
        case 'O': if (api.H.chain < 6) { cs.pd = false; cs.lg = 0; cs.bs = 0; } break;
        default: break;
      }
    },
    wStack(api, t) { for (const id of api.H._wTeam || []) api.ctx.members.forEach((m, j) => api.fireBuff(id, j, { duration: 30 })); },
    // search heuristic (not a game rule): 溢彩→灵感碰撞/绮彩巡游, 本色→视觉冲击
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (!cs.pd) return cs.yc / 120 * 0.6 * (api.est(K.sc) + 0.5 * api.est(K.vi));
      return cs.bs / 3 * 0.6 * api.est(api.cdReady('vi') ? K.vi : K.hc) + cs.lg / 120 * 0.3 * api.est(K.lp1);
    },
  });
});
