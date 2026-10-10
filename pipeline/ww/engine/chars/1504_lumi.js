/*
 * 灯灯 (1504) character module — worker-B.
 *
 * 常态攻击 前路领航 (1002601): 黄灯·普攻 31.81%×3；黄灯·疾奔 飞星 63.62%（加速冲刺自动释放 → 模块：黄灯模式 H = 飞星，低）；
 *   红灯·普攻 3 段；红灯·重击 66.11%×2（耐力 25）；下落攻击 / 闪避反击 未建模
 * 共鸣技能 灯光探照 (1002602): 黄灯 → 前扑 181.32%（耐力 30，切红灯）；红灯 → 后撤 173.76%（耐力 30，切黄灯）
 * 共鸣解放 啾啾专送 (1002603): 954.29%，冷却 20，协奏 20
 * 共鸣回路 信号闪耀 (1002607):
 *   「当【黄灯光能】满时，共鸣技能替换为强化·前扑…并进入红灯聚光模式…施放4次普攻或重击后，退出红灯聚光模式」183.31%×2
 *   「当【红灯光能】满时，共鸣技能替换为强化·后撤…并进入黄灯聚光模式…飞星替换为强光…施放6次强光后，退出黄灯聚光模式」251.70%；强光 81.52%
 *   强光穿射：「灯灯施放延奏技能时，消耗当前模式的全部【光能】…每25点【光能】可使强光穿射的伤害段数加1，最多4段」74.56%/段
 *   光能回复量未公开 → 估计（低）：黄 普攻 12 / 飞星 8 / 强光 15 / 强化后撤 20 / 变奏 30；红 普攻每段 12 / 重击 10；聚光模式 ×1.5
 * 固有 寻路：红灯（含聚光）模式期间 导电 +10%（模块）；奔赴：强化·前扑 / 强化·后撤 后 5 秒攻击 +10%
 * 变奏 专项派送: 56.33%×3，「进入黄灯模式」
 * 延奏 护航：「下一位登场角色共鸣技能伤害加深38%，效果持续10秒」（解析）
 * 动作帧：wuwa-calc-data（优先级高于 WuWaSim，按原样映射）
 * 专武：无（null）；共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const GY = { yA: 12, fx: 8, gl: 15, er: 20, I: 30 };
  const GR = { r1: 12, r2: 12, r3: 12, rH: 10, s1: 12, s2: 12, s3: 12, sH: 10 };
  const SPOT = 1.5;
  const CD = ' [wuwa-calc-data]';
  return WW.registerChar({
    id: 1504, chainModeled: 0, name: '灯灯', version: '0.1', confidence: 'medium',
    notes: ['光能回复量为估计（低）', '黄灯·疾奔 飞星：H 键近似（加速冲刺自动释放，低）', '下落攻击 / 闪避反击未建模', '共鸣链未建模'],
    audit: { role: 'subdps', finishers: ['ep', 'er', 'lib'], window: 25, sig: null, alts: [21010024, 21010016, 21010015], solo: 'lumi_solo.json', team: 'team_lumi.json', teamMi: 1 },
    frames: {
      yA: '普攻·Yellow Light: Basic Attack' + CD, fx: '普攻·Yellow Light: Glitter' + CD, gl: '共鸣回路·Yellow Spotlight: Glare' + CD,
      r1: '普攻·Red Light: Basic Attack 1' + CD, r2: '普攻·Red Light: Basic Attack 2' + CD, r3: '普攻·Red Light: Basic Attack 3' + CD, rH: '普攻·Red Light: Heavy Attack' + CD,
      s1: '共鸣回路·Red Spotlight: Basic Attack 1' + CD, s2: '共鸣回路·Red Spotlight: Basic Attack 2' + CD, s3: '共鸣回路·Red Spotlight: Basic Attack 3' + CD, sH: '共鸣回路·Red Spotlight: Heavy Attack' + CD,
      po: '共鸣技能·Pounce' + CD, rb: '共鸣技能·Rebound' + CD, ep: '共鸣回路·Energized Pounce' + CD, er: '共鸣回路·Energized Rebound' + CD,
      lib: '共鸣解放·Squeakie Express' + CD, I: '变奏入场·Intro' + CD,
    },
    resources: [
      { key: 'mode', name: '模式（0 黄 / 1 红）', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.red ? 1 : 0) },
      { key: 'gy', name: '黄灯光能', max: 100, segmented: false, confidence: 'low' },
      { key: 'gr', name: '红灯光能', max: 100, segmented: false, confidence: 'low' },
      { key: 'spot', name: '聚光剩余次数', max: 6, segmented: true, confidence: 'high', get: (cs) => cs.spot },
    ],
    kit(H) {
      const s1 = H.skill(1), s2 = H.skill(2), s6 = H.skill(6);
      const f = (s, lab) => s.hits.filter((h) => !h.alt && h.label === lab);
      const a = (key, cls, s, lab, lk, d, label, ex) => H.act(Object.assign({ key, cls, skill: s.type, hits: f(s, lab), levelKey: lk, dur: d, label }, ex || {}));
      const K = {
        yA: a('yA', 'A', s1, '黄灯·普攻', 'basic', 0.88, '黄灯·普攻'),
        fx: a('fx', 'H', s1, '飞星', 'basic', 0.33, '黄灯·飞星'),
        gl: a('gl', 'H', s6, '强光伤害', 'forte', 0.38, '黄灯聚光·强光'),
        r1: a('r1', 'A', s1, '红灯·普攻一段伤害', 'basic', 0.57, '红灯·普攻第1段'),
        r2: a('r2', 'A', s1, '红灯·普攻二段伤害', 'basic', 1.32, '红灯·普攻第2段'),
        r3: a('r3', 'A', s1, '红灯·普攻三段伤害', 'basic', 1.0, '红灯·普攻第3段'),
        rH: a('rH', 'H', s1, '红灯·重击伤害', 'basic', 0.68, '红灯·重击', { extra: { stamina: H.param(1, '红灯·重击耐力消耗') || 25 } }),
        s1: a('s1', 'A', s6, '红灯聚光·普攻一段伤害', 'forte', 0.57, '红灯聚光·普攻第1段'),
        s2: a('s2', 'A', s6, '红灯聚光·普攻二段伤害', 'forte', 1.32, '红灯聚光·普攻第2段'),
        s3: a('s3', 'A', s6, '红灯聚光·普攻三段伤害', 'forte', 1.0, '红灯聚光·普攻第3段'),
        sH: a('sH', 'H', s6, '红灯聚光·重击伤害', 'forte', 0.68, '红灯聚光·重击', { extra: { stamina: H.param(1, '红灯·重击耐力消耗') || 25 } }),
        po: a('po', 'E', s2, '前扑伤害', 'skill', 1.43, '前扑', { extra: { stamina: H.param(2, '前扑耐力消耗') || 30 } }),
        rb: a('rb', 'E', s2, '后撤伤害', 'skill', 0.68, '后撤', { extra: { stamina: H.param(2, '后撤耐力消耗') || 30 } }),
        ep: a('ep', 'E', s6, '强化前扑伤害', 'forte', 1.43, '强化·前扑', { concertoParam: '强化前扑回复协奏能量' }),
        er: a('er', 'E', s6, '强化后撤伤害', 'forte', 0.68, '强化·后撤', { concertoParam: '强化后撤回复协奏能量' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 20, cdKey: 'R', dur: 2.5, label: '啾啾专送' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.0 }),
        O: B.outro(H, '护航'),
      };
      for (let n = 1; n <= 4; n++) K['O' + n] = H.act({ key: 'O' + n, cls: 'O', skill: 6, hits: f(s6, '强光穿射每段伤害').map((h) => Object.assign({}, h, { count: n })), levelKey: 'forte', dur: 0, label: '护航 + 强光穿射×' + n, noConcertoFallback: true });
      B.patch(H, /寻路|红灯模式期间，灯灯导电伤害加成提升10%/, { trigger: { on: 'never' }, mode: 'off' }, '模块：红灯模式期间由 actionStats 计入', 'inherent');
      B.patch(H, /奔赴|施放强化·前扑或强化·后撤时/, { trigger: { on: 'act', keys: ['ep', 'er'] }, mode: 'auto', duration: 5 }, '模块：强化·前扑 / 强化·后撤', 'inherent');
      return K;
    },
    fillerKeys: ['yA'],
    init() { return { red: false, gy: 0, gr: 0, spot: 0, spotKind: null, rst: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, rs = cs.spotKind === 'red' && cs.spot > 0, ys = cs.spotKind === 'yellow' && cs.spot > 0;
      switch (btn) {
        case 'A':
          if (!cs.red) return { act: K.yA };
          return { act: K[(rs ? 's' : 'r') + ((cs.rst % 3) + 1)] };
        case 'H':
          if (!cs.red) return { act: ys ? K.gl : K.fx };
          return { act: rs ? K.sH : K.rH };
        case 'E':
          if (!cs.red) return { act: cs.gy >= 100 - 1e-9 ? K.ep : K.po };
          return { act: cs.gr >= 100 - 1e-9 ? K.er : K.rb };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        case 'O': { const e = cs.red ? cs.gr : cs.gy, n = Math.min(4, Math.floor(e / 25 + 1e-9)); return { act: n > 0 ? K['O' + n] : K.O }; }
        default: return B.common(api, btn);
      }
    },
    actionStats(api) { return api.cs.red ? [{ key: 'dmg:electro', value: 0.1 }] : []; },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      const addY = (n) => { cs.gy = Math.min(100, cs.gy + n); };
      const addR = (n) => { cs.gr = Math.min(100, cs.gr + n); };
      if (GR[k] != null) {
        addR(GR[k] * (k[0] === 's' ? SPOT : 1));
        if (k !== 'rH' && k !== 'sH') cs.rst = +k.slice(1) % 3;
        if (k[0] === 's') { cs.spot -= 1; if (cs.spot <= 0) cs.spotKind = null; }
        return;
      }
      switch (k) {
        case 'yA': addY(GY.yA); break;
        case 'fx': addY(GY.fx); break;
        case 'gl': addY(GY.gl * SPOT); cs.spot -= 1; if (cs.spot <= 0) cs.spotKind = null; break;
        case 'po': cs.red = true; cs.rst = 0; cs.spot = 0; cs.spotKind = null; break;
        case 'ep': cs.gy = 0; cs.red = true; cs.rst = 0; cs.spot = 4; cs.spotKind = 'red'; break;
        case 'rb': cs.red = false; cs.spot = 0; cs.spotKind = null; break;
        case 'er': cs.gr = 0; cs.red = false; cs.spot = 6; cs.spotKind = 'yellow'; addY(GY.er); break;
        case 'I': cs.red = false; cs.spot = 0; cs.spotKind = null; addY(GY.I); break;
        default: break;
      }
    },
    // 强光穿射：延奏时消耗当前模式全部光能（伤害段数在 resolve('O') 中按光能决定）
    onOutro(api) { const cs = api.cs; if (cs.red) cs.gr = 0; else cs.gy = 0; },
    // search heuristic (not a game rule): 光能 → 强化前扑 / 强化后撤
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return cs.gy / 100 * 0.5 * api.est(K.ep) + cs.gr / 100 * 0.5 * api.est(K.er);
    },
  });
});
