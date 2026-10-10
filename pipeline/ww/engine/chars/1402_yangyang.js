/*
 * 秧秧 (1402) character module — worker-B.
 *
 * 普攻 风羽为刃 (1000101): 普攻 4 段；重击；「重击·风吟：重击或闪避反击后一定时间内短按普攻，将会施放重击风吟」（重击伤害 106.61%）
 * 共鸣技能 流风载域 (1000102): 34.53%×4+207.19%，冷却 10，协奏 15
 * 共鸣解放 朔风旋涌 (1000103): 46.58%×12+372.70%，冷却 16，100 能量
 * 共鸣回路 覆声裁羽 (1000107):
 *   「重击·风袭：当秧秧持有3声【流响】时，施放重击或闪避反击后可触发风袭」38.02%×2
 *   「空中攻击·释羽：当秧秧持有3声【流响】时，在空中使用普攻，将消耗所有【流响】…此次伤害为普攻伤害」21.73%×5+126.81%×2，协奏 30
 *   「【流响】上限3声。第4段普攻…重击风吟…共鸣技能流风载域命中…施放变奏技能湛蓝礼赞时，获取1声【流响】」
 *   → 按钮映射：流响 3 时 H = 重击+风袭（跳起），随后 A = 释羽；否则 H = 重击，之后 A = 风吟
 * 固有 怀悯：变奏后气动伤害 +8% 8 秒（解析）；解意（耐力）不建模
 * 变奏 湛蓝礼赞: 79.52%×2；+1 流响
 * 延奏 衍息：「持续为下一位登场角色回复共鸣能量，每秒回复4点共鸣能量，持续5秒」→ 模块：O 时为下一位登场角色直接 +20 能量（中）
 * 动作帧：WuWaSim（duration_s = 到下一动作可开始的时间；按原样映射，由核心加载器解释）
 * 共鸣链：未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  return WW.registerChar({
    id: 1402, chainModeled: 0, name: '秧秧', version: '0.1', confidence: 'medium',
    notes: ['释羽跳起/下落按单个动作计（WuWaSim forte_heavy_feather_release）', '延奏能量回复按 +20 一次性计入下一位登场角色（中）', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['xy', 'lib'], window: 25, sig: null, alts: [21020015, 21020017, 21020064], solo: 'yangyang_solo.json', team: 'team_yangyang.json', teamMi: 1 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]',
      hv: '重击·heavy_heavy_attack [WuWaSim]', fy: '普攻·basic_zephyr_song_damage [WuWaSim]', sk: '共鸣技能·skill [WuWaSim]', lib: '共鸣解放·liberation [WuWaSim]',
      I: '变奏入场·intro [WuWaSim]', fx: '共鸣回路·forte_heavy_stormy_strike_damage [WuWaSim]', xy: '共鸣回路·forte_heavy_feather_release_damage [WuWaSim]',
    },
    resources: [{ key: 'lx', name: '流响', max: 3, segmented: true, confidence: 'high' }],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.3, 0.4, 0.63, 1.11] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.4, label: '重击' }),
        fy: H.act({ key: 'fy', cls: 'A', skill: 1, labels: ['风吟伤害'], levelKey: 'basic', dur: 0.71, label: '重击·风吟' }),
        fx: H.act({ key: 'fx', cls: 'H', skill: 6, labels: ['风袭伤害'], levelKey: 'forte', dur: 0.5, label: '重击·风袭' }),
        xy: H.act({ key: 'xy', cls: 'A', skill: 6, labels: ['释羽伤害'], levelKey: 'forte', concertoParam: '释羽回复协奏能量', dur: 1.06, label: '空中攻击·释羽' }),
        sk: H.act({ key: 'sk', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 10, cdKey: 'E', dur: 0.74, label: '流风载域' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 16, cdKey: 'R', dur: 2.21, label: '朔风旋涌' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.9 }),
        O: B.outro(H, '衍息'),
      });
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { lx: 0, st: 0, afterH: false, air: false }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.air) return { act: K.xy };
          if (cs.afterH) return { act: K.fy };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: cs.lx >= 3 ? K.fx : K.hv };
        case 'E': return api.cdReady('E') ? { act: K.sk } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      const prevAir = cs.air; cs.afterH = false; cs.air = false;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; if (k === 'a4') cs.lx = Math.min(3, cs.lx + 1); return; }
      switch (k) {
        case 'hv': cs.afterH = true; break;
        case 'fx': cs.air = true; break;
        case 'xy': if (prevAir) cs.lx = 0; cs.st = 0; break;
        case 'fy': cs.lx = Math.min(3, cs.lx + 1); cs.st = 0; break;
        case 'sk': cs.lx = Math.min(3, cs.lx + 1); break;
        case 'I': cs.lx = Math.min(3, cs.lx + 1); break;
        default: break;
      }
    },
    onOutro(api, toMi) {
      // 衍息：下一位登场角色 4 能量/秒 × 5 秒（模块：一次性 +20，中）
      if (toMi != null && !api.H._outroEnergyParsed) api.addEnergy(toMi, 20);
    },
    // search heuristic (not a game rule): 流响→释羽
    potential(api) { return api.cs.lx / 3 * 0.6 * api.est(api.mem.modKit.xy); },
  });
});
