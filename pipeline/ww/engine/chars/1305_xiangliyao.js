/*
 * 相里要 (1305) character module — worker-B.
 *
 * 普攻 问难 (1002301): 普攻 5 段；重击 82.81%×2
 * 共鸣技能 基本推衍 (1002302): 198.81%，冷却 5，协奏 7
 * 共鸣解放 思维矩阵 (1002303): 1466.06%，进入洞见 24 秒：「获得3个幻方，施放共鸣技能万方法则时消耗1个幻方，消耗完所有幻方时结束洞见状态」
 *   普攻→枢机·勘破 3 段；共鸣技能→一相万殊（冷却 7，协奏 10）；闪避反击→知无定形（未建模）
 * 共鸣回路 察类明故 (1002307):
 *   「当【演算效能】达到100点时，共鸣技能基本推衍替换为应刃…消耗100点…共鸣解放伤害」397.82%，协奏 7
 *   「洞见状态期间，当【超算效能】达到5点时，共鸣技能一相万殊替换为万方法则；…消耗5点【超算效能】…共鸣解放伤害」95.73%×4+255.28%，协奏 10
 *   「施放共鸣技能应刃或共鸣技能一相万殊后一定时间内短按普攻，将…施放空中攻击解裂重构」21.87%×4+65.61%×2（共鸣解放伤害），协奏 5
 *   超算效能：勘破第 1 段 +1、第 2/3 段 +2、一相万殊 +2、解裂重构 +3（高）；演算效能：普攻/基本推衍命中回复，量未公开 → 估计 a1 8 / a2 12 / a3 12 / a4 12 / a5 16 / 重击 10 / 基本推衍 20（低）
 * 固有 睿知：施放共鸣技能时导电伤害 +5%（8 秒，4 层，解析）；潜心（抗打断）不建模
 * 变奏 正理: 99.41%×2
 * 延奏 链式：「下一位登场角色普攻命中目标时…造成相里要237.63%攻击的导电伤害，持续8秒，每2秒可触发1次，最多可触发3次」→ 模块：onTeam 伤害事件触发协同（中）
 * 动作帧：WuWaSim（按原样映射）
 * 专武 诸方玄枢 (21040016)：解析
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const YS = { a1: 8, a2: 12, a3: 12, a4: 12, a5: 16, hv: 10, sk: 20 };
  const CS = { p1: 1, p2: 2, p3: 2, yx: 2, jl: 3 };
  return WW.registerChar({
    id: 1305, chainModeled: 0, name: '相里要', version: '0.1', confidence: 'medium',
    notes: ['演算效能每次回复量为估计（低）', '知无定形（闪避反击）未建模', '延奏链式：下一位登场角色普攻伤害事件触发，2 秒 1 次，最多 3 次（中）', '共鸣链未建模'],
    audit: { role: 'dps', finishers: ['lib', 'wf', 'yr'], window: 25, sig: 21040016, alts: [21040015, 21040036, 21040044], solo: 'xiangliyao_solo.json', team: 'team_xiangliyao.json', teamMi: 0 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]', a5: '普攻·basic_5 [WuWaSim]',
      hv: '普攻·basic_ha [WuWaSim]', sk: '共鸣技能·skill [WuWaSim]', lib: '共鸣解放·liberation_cogitation_model [WuWaSim]',
      p1: '共鸣解放·liberation_pivot_impale_1 [WuWaSim]', p2: '共鸣解放·liberation_pivot_impale_2 [WuWaSim]', p3: '共鸣解放·liberation_pivot_impale_3 [WuWaSim]',
      yx: '共鸣解放·liberation_divergence [WuWaSim]', I: '变奏入场·intro [WuWaSim]',
      yr: '共鸣回路·forte_heavy_decipher [WuWaSim]', wf: '共鸣回路·forte_heavy_law_of_reigns [WuWaSim]', jl: '共鸣回路·forte_heavy_revamp [WuWaSim]',
    },
    resources: [
      { key: 'ys', name: '演算效能', max: 100, segmented: false, confidence: 'low' },
      { key: 'cs', name: '超算效能', max: 5, segmented: true, confidence: 'high' },
      { key: 'hf', name: '幻方', max: 3, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 5, prefix: 'a', durs: [0.33, 0.5, 0.6, 0.67, 1.0] }),
        B.stages(H, { n: 3, prefix: 'p', skill: 3, levelKey: 'liberation', label: (k) => '枢机·勘破第' + B.CN[k - 1] + '段伤害', durs: [0.5, 1.07, 1.17] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.83, label: '重击' }),
          sk: H.act({ key: 'sk', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 5, cdKey: 'E', dur: 0.5, label: '基本推衍' }),
          yr: H.act({ key: 'yr', cls: 'E', skill: 6, labels: ['应刃伤害'], levelKey: 'forte', concertoParam: '应刃回复协奏能量', dur: 0.83, label: '共鸣技能·应刃' }),
          yx: H.act({ key: 'yx', cls: 'E', skill: 3, labels: ['一相万殊伤害'], levelKey: 'liberation', concertoParam: '一相万殊回复协奏能量', cooldown: 7, cdKey: 'yx', dur: 1.16, label: '一相万殊' }),
          wf: H.act({ key: 'wf', cls: 'E', skill: 6, labels: ['万方法则伤害'], levelKey: 'forte', concertoParam: '万方法则回复协奏能量', dur: 1.5, label: '共鸣技能·万方法则' }),
          jl: H.act({ key: 'jl', cls: 'A', skill: 6, labels: ['解裂重构伤害'], levelKey: 'forte', concertoParam: '解裂重构回复协奏能量', dur: 0.5, label: '空中攻击·解裂重构' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['思维矩阵伤害'], levelKey: 'liberation', concertoParam: '思维矩阵回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 3.0, label: '思维矩阵' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.4 }),
          O: B.outro(H, '链式', { hits: [] }),
        });
      for (const k of ['p1', 'p2', 'p3']) K[k].cls = 'A';
      const base = H.skill(5).hits[0];
      K.chain = H.act({ key: 'chain', cls: 'O', skill: 11, hits: [B.textHit(H, base, { label: '链式伤害', mv: 2.3763, type: 'outro' })], levelKey: 'outro', dur: 0, label: '延奏·链式（协同）' });
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4', 'a5'],
    init() { return { ys: 0, cs: 0, hf: 0, dj: false, st: 0, pst: 0, jlOpen: false, chainMi: null, chainUntil: null, chainNext: 0, chainN: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.jlOpen) return { act: K.jl };
          if (cs.dj) return { act: K['p' + ((cs.pst % 3) + 1)] };
          return { act: K['a' + ((cs.st % 5) + 1)] };
        case 'H': return cs.dj ? { act: K['p' + ((cs.pst % 3) + 1)] } : { act: K.hv };
        case 'E':
          if (cs.dj) { if (cs.cs >= 5) return { act: K.wf }; return api.cdReady('yx') ? { act: K.yx } : { blocked: '一相万殊冷却中' }; }
          if (cs.ys >= 100 - 1e-9) return { act: K.yr };
          return api.cdReady('E') ? { act: K.sk } : { blocked: '冷却中' };
        case 'R': return cs.dj ? { blocked: '洞见中' } : { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd;
      if (cs.dj && cs.djUntil != null && api.t >= cs.djUntil) { cs.dj = false; cs.hf = 0; cs.cs = 0; }
      const wasOpen = cs.jlOpen; cs.jlOpen = false;
      const addYs = (n) => { if (!cs.dj) cs.ys = Math.min(100, cs.ys + n); };
      const addCs = (n) => { if (cs.dj) cs.cs = Math.min(5, cs.cs + n); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 5; addYs(YS[k]); return; }
      if (/^p\d$/.test(k)) { cs.pst = +k.slice(1) % 3; addCs(CS[k]); return; }
      switch (k) {
        case 'hv': addYs(YS.hv); break;
        case 'sk': addYs(YS.sk); break;
        case 'yr': cs.ys = 0; cs.jlOpen = true; break;
        case 'yx': addCs(CS.yx); cs.jlOpen = true; break;
        case 'jl': if (wasOpen) addCs(CS.jl); break;
        case 'wf': cs.cs = 0; cs.hf -= 1; if (cs.hf <= 0) { cs.dj = false; cs.hf = 0; } break;
        case 'lib': cs.dj = true; cs.hf = 3; cs.cs = 0; cs.pst = 0; cs.djUntil = te + 24; break;
        default: break;
      }
    },
    onOutro(api, toMi) { const cs = api.cs; cs.chainMi = toMi; cs.chainUntil = api.t + 8; cs.chainNext = 0; cs.chainN = 0; },
    // 延奏 链式：下一位登场角色普攻伤害命中时协同（2 秒 1 次，最多 3 次）
    onTeam(api, ev) {
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if ((ev.type === 'swap' || ev.type === 'intro') && ev.mi !== cs.chainMi) { cs.chainUntil = null; return; }
      if (ev.type !== 'damage' || ev.mi !== cs.chainMi || !on(cs.chainUntil, t) || !ev.act || ev.coord) return;
      if (ev.act.cls !== 'A' || cs.chainN >= 3 || t < cs.chainNext - 1e-9) return;
      cs.chainN += 1; cs.chainNext = t + 2;
      api.deal(api.mem.modKit.chain, { coord: true });
    },
    // search heuristic (not a game rule): 演算效能→应刃；洞见：超算效能/幻方→万方法则
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (cs.dj) return cs.hf * 0.5 * api.est(K.wf) * (0.4 + cs.cs / 5 * 0.6);
      return cs.ys / 100 * 0.6 * api.est(K.yr);
    },
  });
});
