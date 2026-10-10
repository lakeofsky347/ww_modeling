/*
 * 莫宁 (1209) character module — stream A 批次 4。热熔 长刃，辅助（治疗、延奏 全队全伤害加深 25% 30 s、强谐振场 防御 +20%）。
 *
 * 普攻 基态校准 (1004401)：基准模式 普攻 4 段 / 重击；广域观测模式 普攻 3 段。
 * 共鸣技能 解算 (1004402)：期望误差（治疗+格挡，冷却 5；格挡期间受击才放 最优求解 → 木桩不触发，最优求解不建模）；广域观测模式 → 分布式阵列（治疗 + 浮游炮 4 段，冷却 16，协奏 10）。
 * 共鸣解放 临界协议 (1004403)：522.33%（防御倍率），冷却 25，175 能量，协奏 20；共鸣效率 >100% 时每 1% → 暴击 +0.5%（上限 80%）、暴击伤害 +1%（上限 160%）（按实时面板）。
 *   已有谐振场时 → 强谐振场 25 s：全队防御 +20%。全程时停（300f/5 s，按时停口径计 0.05 s，受冷却/能量门控）。
 * 回路 质能等价 (1004407)：基准模式攒【静质量能】100 → 重击·位势转换（进入广域观测模式 30 s，展开谐振场：解放伤害 39.77%×5）；
 *   广域观测模式攒【相对动能】100 → 重击·反演（258.46%）。变奏 归敛 也进入广域观测模式（清除静质量能）。切人/离场退出广域观测模式。
 *   静质量能/相对动能 每段获取量数据未给出 → 估计：基准 普攻 12/16/20/26、重击 14；广域 普攻 20/25/30、分布式阵列 35（低）。
 *   观测标记/干涉标记/粒子射流 依赖偏谐（谐度/偏移，B4 未建模）→ 不建模。
 * 固有 蓝图：共鸣效率 +10%（解析）；变奏 / 广域第 3 段 各 +20 协奏（每 20 s 1 次，模块）。有界（减伤/免死）不建模。
 * 延奏 递归：队伍中的角色全伤害加深 25% 30 s（通用解析）。
 * 链：1 干涉标记相关（偏谐，未建模）；2 暴击伤害（干涉标记，未建模）；3 分布式阵列 +25 协奏 +100 相对动能（25 s 1 次）；4 治疗量；
 *     5 临界协议 倍率 +40%（粒子射流未建模）；6 临界协议 伤害 +400%。chainModeled 6（链 1/2 依赖偏谐，按未建模处理但不影响伤害主体）。
 * 动作帧：WuwaLAB（Mornye）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21010066;
  const RM = { a1: 12, a2: 16, a3: 20, a4: 26, hv: 14 }, KM = { w1: 20, w2: 25, w3: 30, arr: 35 };
  return WW.registerChar({
    id: 1209, chainModeled: 6, name: '莫宁', version: '0.1', confidence: 'medium',
    notes: ['静质量能/相对动能 获取量为估计（低）', '最优求解需要受击（木桩不触发，不建模）', '观测/干涉标记、粒子射流依赖偏谐（B4 未建模）',
      '临界协议的暴击/暴伤按实时共鸣效率计算', '链 1/2 只作用于干涉标记（偏谐，未建模）'],
    audit: { role: 'support', finishers: ['lib', 'shift', 'inv'], window: 25, sig: SIG, alts: [21010015, 21010026, 21010045], solo: 'mornye_solo.json', team: 'team_lupa.json', teamMi: 2 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Ground State Calibration'), B.stageFrames('w', 3, '普攻·Basic: Wide Field Observation Mode'), {
      hv: '重击·Heavy: Ground State Calibration', E: '共鸣技能·Skill: Expectation Error', arr: '共鸣技能·Skill: Distributed Array',
      shift: '共鸣回路·Forte: Geopotential Shift', inv: '共鸣回路·Forte: Inversion', lib: '共鸣解放·Liberation: Critical Protocol', I: '变奏入场·Intro: Convergence',
    }),
    resources: [
      { key: 'rm', name: '静质量能', max: 100, segmented: false, confidence: 'low' },
      { key: 'km', name: '相对动能', max: 100, segmented: false, confidence: 'low' },
      { key: 'wide', name: '广域观测模式', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.wide, t) ? 1 : 0) },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '普攻', durs: [0.42, 0.82, 0.82, 1.93] }),
        B.stages(H, { n: 3, prefix: 'w', pre: '普攻·广域观测模式', durs: [0.35, 0.65, 0.68] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.58, label: '重击' }),
          E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['期望误差治疗量'], levelKey: 'skill', cooldown: 5, cdKey: 'E', dur: 0.35, label: '期望误差（治疗/格挡）' }),
          arr: H.act({ key: 'arr', cls: 'E', skill: 2, labels: ['分布式阵列伤害', '分布式阵列治疗量'], levelKey: 'skill', concertoParam: '分布式阵列回复协奏能量', cooldown: 16, cdKey: 'arr', dur: 1.0, label: '分布式阵列' }),
          shift: H.act({ key: 'shift', cls: 'H', skill: 6, labels: ['重击·位势转换伤害'], levelKey: 'forte', dur: 1.53, label: '重击·位势转换' }),
          field: H.act({ key: 'field', cls: 'R', skill: 6, labels: ['谐振场伤害'], levelKey: 'forte', label: '谐振场（展开）' }),
          inv: H.act({ key: 'inv', cls: 'H', skill: 6, labels: ['重击·反演伤害'], levelKey: 'forte', dur: 1.27, label: '重击·反演' }),
          lib: H.act(Object.assign({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 5.0, label: '临界协议' },
            ch >= 5 ? { scale: { '*': 1.4 }, inferred: '链5：倍率 +40%' } : {})),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.75, label: '归敛' }),
          O: B.outro(H, '递归'),
        });
      H.buff({ id: 'hfield', name: '强谐振场·防御', stats: [{ key: 'defPct', value: 0.2 }], duration: 25, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '强谐振场：附近队伍中所有角色防御提升20%' });
      B.patch(H, /强谐振场|谐振场/, { mode: 'off' }, '模块：强谐振场由模块触发', 'skill');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { rm: st.rm || 0, km: 0, wide: null, st: 0, wst: 0, field: null, cdI: -99, cdW3: -99, c3: -99 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, wide = on(cs.wide, t);
      switch (btn) {
        case 'A': return { act: wide ? K['w' + ((cs.wst % 3) + 1)] : K['a' + ((cs.st % 4) + 1)] };
        case 'H':
          if (wide) return cs.km >= 100 - 1e-9 ? { act: K.inv } : { blocked: '相对动能未满' };
          return { act: cs.rm >= 100 - 1e-9 ? K.shift : K.hv };
        case 'E':
          if (wide) return api.cdReady('arr') ? { act: K.arr } : { blocked: '冷却中' };
          return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      if (act.key !== 'lib') return [];
      const er = api.livePanel().energyRegen || 1, over = Math.max(0, (er - 1) * 100);
      const out = [{ key: 'critRate', value: Math.min(0.8, over * 0.005) }, { key: 'critDmg', value: Math.min(1.6, over * 0.01) }];
      if (api.H.chain >= 6) out.push({ key: 'dmg:liberation', value: 4 });
      return out;
    },
    enterWide(api, te) {
      const cs = api.cs;
      cs.rm = 0; cs.wide = te + 30; cs.wst = 0; cs.km = cs.km || 0; cs.field = te + 25;
      api.deal(api.mem.modKit.field, { coord: false, t: te });
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      const rm = (v) => { cs.rm = Math.min(100, cs.rm + v); };
      const km = (v) => { cs.km = Math.min(100, cs.km + v); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; rm(RM[k]); return; }
      if (/^w\d$/.test(k)) {
        cs.wst = +k.slice(1) % 3; km(KM[k]);
        if (k === 'w3' && api.t - cs.cdW3 >= 20) { cs.cdW3 = api.t; api.addConcerto(api.mi, 20); }
        return;
      }
      cs.st = 0;
      switch (k) {
        case 'hv': rm(RM.hv); break;
        case 'shift': this.enterWide(api, te); break;
        case 'I': this.enterWide(api, te); if (api.t - cs.cdI >= 20) { cs.cdI = api.t; api.addConcerto(api.mi, 20); } break;
        case 'arr':
          km(KM.arr);
          if (ch >= 3 && api.t - cs.c3 >= 25) { cs.c3 = api.t; api.addConcerto(api.mi, 25); cs.km = 100; }
          break;
        case 'inv': cs.km = 0; break;
        case 'lib':
          if (on(cs.field, api.t)) { cs.field = te + 25; for (let j = 0; j < api.teamSize; j++) api.fireBuff('hfield', j, { t: te, duration: 25 }); }
          break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type === 'swap' && ev.from === api.mi) { api.cs.wide = null; api.cs.wst = 0; }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.4 * (cs.rm / 100) * (api.est(K.shift) + api.est(K.field)) + 0.4 * (cs.km / 100) * api.est(K.inv);
    },
  });
});
