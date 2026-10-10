/*
 * 卡卡罗 (1301) character module — worker-B.
 *
 * 普攻 猎犬剑技·獠牙撕扯 (1001401): 普攻 4 段；重击 41.36%×5
 * 共鸣技能 灭杀指令 (1001402):「进行最多3段攻击…若切换至其他角色或者一定时间内没有施放共鸣技能灭杀指令，则技能进入冷却状态」冷却 10；每段协奏 4
 *   → 模块：第 1 段起算冷却（cdKey E），第 2/3 段为链式后续（不受冷却限制，其他动作后链断）
 * 共鸣解放 幻影蚀刻 (1001403): 596.43%，进入杀戮武装 11 秒：普攻→狂噬影狱 5 段（普攻伤害）；重击→共鸣解放伤害（62.03%×5）；
 *   「状态结束后，卡卡罗下次变奏技能替换为变奏技能「必要的手段」」198.81%×2（变奏伤害）
 * 共鸣回路 猎杀使命 (1001407):
 *   「持有3点【残忍】时，重击替换为重击「仁慈」…消耗3点【残忍】…并额外回复共鸣能量和协奏能量」（6 / 6）
 *   「共鸣技能灭杀指令命中目标时，获得1点【残忍】」「杀戮武装状态下，无法获得【残忍】」
 *   「持有5点【杀意】时，普攻替换为重击「死告」…共鸣解放伤害…额外回复」（能量 5 / 协奏 10）「普攻猎犬剑技·狂噬影狱命中目标时，回复1点【杀意】」
 * 固有 喋血觉悟：仁慈时共鸣解放伤害加成 +10% 15 秒（解析）；无暇赴死（减伤）不建模
 * 变奏 全境通缉: 39.77%×2+59.65%×2
 * 延奏 掠影奇袭: 猎杀影 195.98%+391.96%（技能 11 命中，解析）
 * 动作帧：WuWaSim（按原样映射）；灭杀指令只有第 3 段条目、狂噬影狱/解放重击无条目 → 模块估计（低）
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  return WW.registerChar({
    id: 1301, chainModeled: 0, name: '卡卡罗', version: '0.1', confidence: 'medium',
    notes: ['狂噬影狱各段、灭杀指令第 1/2 段、杀戮武装重击时长为模块估计（低）', '杀戮武装 11 秒从解放动作结束起算', '杀戮武装重击（5 段旋斩）时长 2.0 秒为估计，WuWaSim 无对应键（低）；耐力消耗 30 取技能表', '闪避反击（含杀戮武装闪避反击）未建模', '共鸣链未建模'],
    audit: { role: 'dps', finishers: ['dg', 'mc', 'lib'], window: 25, sig: null, alts: [21010015, 21010016, 21010024], solo: 'calcharo_solo.json', team: 'team_calcharo.json', teamMi: 0 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]',
      hv: '重击·heavy_heavy_attack [WuWaSim]', e3: '共鸣技能·skill_extermination_order_3 [WuWaSim]', lib: '共鸣解放·liberation [WuWaSim]',
      nm: '共鸣解放·liberation_necessary_means_damage [WuWaSim]', lH: null, I: '变奏入场·intro [WuWaSim]',
      mc: '共鸣回路·forte_heavy_mercy_damage [WuWaSim]', dg: '共鸣回路·forte_heavy_death_messenger_damage [WuWaSim]',
    },
    resources: [
      { key: 'cr', name: '残忍', max: 3, segmented: true, confidence: 'high' },
      { key: 'sy', name: '杀意', max: 5, segmented: true, confidence: 'high' },
      { key: 'ks', name: '杀戮武装（秒）', max: 11, segmented: false, confidence: 'medium', get: (cs, t) => +B.rem(cs.ksUntil, t).toFixed(2) },
    ],
    kit(H) {
      const s3 = H.skill(3);
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.46, 0.5, 1.07, 1.33] }),
        B.stages(H, { n: 5, prefix: 'hb', skill: 3, levelKey: 'liberation', label: (k) => '猎犬剑技·狂噬影狱第' + B.CN[k - 1] + '段', durs: [0.55, 0.8, 0.75, 1.0, 1.1] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.04, label: '重击' }),
          e1: H.act({ key: 'e1', cls: 'E', skill: 2, labels: ['灭杀指令第一段伤害'], levelKey: 'skill', concertoParam: '每段灭杀指令回复协奏能量', cooldown: 10, cdKey: 'E', dur: 0.8, label: '灭杀指令·第一段' }),
          e2: H.act({ key: 'e2', cls: 'E', skill: 2, labels: ['灭杀指令第二段伤害'], levelKey: 'skill', concertoParam: '每段灭杀指令回复协奏能量', dur: 0.85, label: '灭杀指令·第二段' }),
          e3: H.act({ key: 'e3', cls: 'E', skill: 2, labels: ['灭杀指令第三段伤害'], levelKey: 'skill', concertoParam: '每段灭杀指令回复协奏能量', dur: 0.93, label: '灭杀指令·第三段' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, cdKey: 'R', dur: 1.67, label: '幻影蚀刻' }),
          lH: H.act({ key: 'lH', cls: 'H', skill: 3, hits: s3.hits.filter((h) => !h.alt && h.label === '重击伤害'), levelKey: 'liberation', dur: 2.0, label: '杀戮武装·重击', extra: { stamina: H.param(3, '重击耐力消耗') || 30 } }),
          nm: H.act({ key: 'nm', cls: 'I', skill: 3, labels: ['「必要的手段」伤害'], levelKey: 'liberation', dur: 2.36, label: '变奏·必要的手段' }),
          mc: H.act({ key: 'mc', cls: 'H', skill: 6, labels: ['「仁慈」伤害'], levelKey: 'forte', dur: 1.97, label: '重击·仁慈' }),
          dg: H.act({ key: 'dg', cls: 'A', skill: 6, labels: ['「死告」伤害'], levelKey: 'forte', dur: 1.97, label: '重击·死告' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.4 }),
          O: B.outro(H, '掠影奇袭'),
        });
      for (const k of ['hb1', 'hb2', 'hb3', 'hb4', 'hb5']) K[k].cls = 'A';
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { cr: 0, sy: 0, st: 0, hst: 0, ksUntil: null, nmReady: false, chainE: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, ks = on(cs.ksUntil, api.t);
      switch (btn) {
        case 'A':
          if (ks) return { act: cs.sy >= 5 ? K.dg : K['hb' + ((cs.hst % 5) + 1)] };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H':
          if (ks) return { act: K.lH };
          return { act: cs.cr >= 3 ? K.mc : K.hv };
        case 'E':
          if (cs.chainE) return { act: K[cs.chainE] };
          return api.cdReady('E') ? { act: K.e1 } : { blocked: '冷却中' };
        case 'R': return ks ? { blocked: '杀戮武装中' } : { act: K.lib };
        case 'I': return { act: (cs.nmReady || cs.ksUntil != null) && !ks ? K.nm : K.I };   // 杀戮武装结束（含离场期间）→ 必要的手段
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ks = on(cs.ksUntil, api.t);
      if (cs.ksUntil != null && !on(cs.ksUntil, api.t)) { cs.ksUntil = null; cs.sy = 0; cs.nmReady = true; }
      cs.chainE = null;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; return; }
      if (/^hb\d$/.test(k)) { cs.hst = +k.slice(2) % 5; cs.sy = Math.min(5, cs.sy + 1); return; }
      switch (k) {
        case 'e1': case 'e2': case 'e3':
          if (!ks) cs.cr = Math.min(3, cs.cr + 1);
          if (k !== 'e3') cs.chainE = k === 'e1' ? 'e2' : 'e3';
          break;
        case 'mc': cs.cr = 0; api.addEnergy(api.mi, 6); api.addConcerto(api.mi, 6); break;
        case 'dg': cs.sy = 0; cs.hst = 0; api.addEnergy(api.mi, 5); api.addConcerto(api.mi, 10); break;
        case 'lib': cs.ksUntil = te + 11; cs.sy = 0; cs.hst = 0; break;
        case 'nm': cs.nmReady = false; cs.ksUntil = null; break;
        default: break;
      }
    },
    // search heuristic (not a game rule): 残忍→仁慈；杀意→死告
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return on(cs.ksUntil, api.t) ? cs.sy / 5 * 0.6 * api.est(K.dg) : cs.cr / 3 * 0.5 * api.est(K.mc) + (cs.nmReady ? 0.3 * api.est(K.nm) : 0);
    },
  });
});
