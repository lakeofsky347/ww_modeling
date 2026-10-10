/*
 * 炽霞 (1202) character module — stream A 批次 4。热熔 佩枪，主C（4★）。
 *
 * 普攻 砰砰 (1000201)：4 段射击；重击（满蓄力）。空中/闪避反击 不建模。
 * 共鸣技能 咻咻斗意 (1000202)：31.81%×8，2 次可用次数，冷却 9（按 2 层充能处理），协奏 10。
 * 共鸣回路 英雄炽火流 (1000207)：长按技能进入 咔咔压制：持续消耗【热压弹】（19.89%/发，共鸣技能伤害，每发协奏 0.5）；
 *   已消耗 30 发时短按普攻 → 轰轰（437.39%，固有 灼热弹匣 +50%）；否则短按普攻 → 普攻第 4 段。热压弹 上限 60（固有 +10 → 70）。
 *   模块动作：kaka（压制 N 发，N = min(热压弹, 30)，≥30 时接 轰轰）；单发节奏 0.08 s（引擎假设，低）。
 *   【热压弹】获取量数据未给出 → 估计 普攻 3/4/6/5、技能 8、变奏 6、满蓄力重击 4（低）。
 * 固有 加麻加辣：压制期间每发命中 攻击 +1%（10 s，30 层）→ 压制结束时按发数叠层；压制内的伤害按平均层数计。
 * 共鸣解放 炽烈焰火：954.29% + 57.84%×11，150 能量，冷却 20。延奏 跃焰 530%。
 * 链：1 轰轰必定暴击；2 击败回能（木桩不触发）；3 生命<50% 的目标 +40%（默认关）；4 解放后 +60 热压弹并重置一次技能；5 加麻加辣满层 攻击 +30%；
 *     6 轰轰后 全队普攻 +25% 15 s。chainModeled 6。
 * 动作帧：WuWaSim 3.6。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on, charges, useCharge } = C;
  const GAIN = { a1: 3, a2: 4, a3: 6, a4: 5, hv: 4, E: 8, I: 6 };
  const SHOT = 0.08;
  return WW.registerChar({
    id: 1202, chainModeled: 6, name: '炽霞', version: '0.1', confidence: 'medium',
    notes: ['【热压弹】获取量为估计（低）', '咔咔压制单发节奏 0.08 s（引擎假设，低）', '加麻加辣：压制内伤害按平均层数计，压制后 10 s 按发数叠层', '链2 击败回能、链3 低血量条件不建模/默认关'],
    audit: { role: 'dps', finishers: ['kaka', 'lib'], window: 25, sig: null, alts: [21030015, 21030016, 21030045], solo: 'chixia_solo.json', team: 'team_chixia.json', teamMi: 0 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]',
      hv: '重击·heavy_full_charge_heavy_attack 技能-移动射击强化退出 [WuWaSim]', E: '共鸣技能·skill [WuWaSim]', lib: '共鸣解放·liberation [WuWaSim]',
      I: '变奏入场·intro [WuWaSim]', boom: '共鸣回路·forte_heavy_boom_boom_damage [WuWaSim]', shot: null,
    },
    resources: [
      { key: 'ammo', name: '热压弹', max: 70, segmented: false, confidence: 'low', basis: '上限 60 + 固有 10；获取量估计' },
      { key: 'eCh', name: '咻咻斗意次数', max: 2, segmented: true, confidence: 'high', get: (cs, t) => charges(cs.eCh, t, 2, 9) },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.3, 0.53, 0.75, 1.13] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['满蓄力重击伤害'], levelKey: 'basic', dur: 1.33, label: '满蓄力重击' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', dur: 0.6, label: '咻咻斗意' }),
        shot: H.act({ key: 'shot', cls: 'E', skill: 6, labels: ['热压弹伤害'], levelKey: 'forte', dur: SHOT, label: '热压弹' }),
        boom: H.act(Object.assign({ key: 'boom', cls: 'E', skill: 6, labels: ['轰轰伤害'], levelKey: 'forte', dur: 1.33, label: '轰轰', scale: { '*': 1.5 }, inferred: '固有 灼热弹匣：轰轰伤害 +50%（按倍率处理）' },
          ch >= 1 ? { forceCrit: true } : {})),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 20, cdKey: 'R', dur: 3.53, label: '炽烈焰火' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.1, label: '堂堂登场' }),
        O: B.outro(H, '跃焰'),
      });
      H.buff({ id: 'mala', name: '加麻加辣·攻击', stats: [{ key: 'atkPct', value: 0.01 }], maxStacks: 30, duration: 10, trigger: { on: 'manual' }, mode: 'module', text: '咔咔压制期间每发热压弹命中 攻击提升1%，持续10秒，可叠加30层' });
      if (ch >= 5) H.buff({ id: 'c5', name: '链5·攻击', stats: [{ key: 'atkPct', value: 0.3 }], duration: 10, trigger: { on: 'manual' }, mode: 'module', text: '链5' });
      if (ch >= 6) H.buff({ id: 'c6', name: '链6·普攻', stats: [{ key: 'dmg:basic', value: 0.25 }], duration: 15, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链6' });
      B.patch(H, /加麻加辣|灼热弹匣|咔咔压制/, { mode: 'off' }, '模块处理', 'inherent');
      B.patch(H, /剧终的回归彩蛋|胜利的枪弹焰火|剧院的英雄戏/, { mode: 'off' }, '模块处理', 'chain');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { ammo: st.ammo || 0, st: 0, eCh: { n: 2, since: 0 } }; },
    /** 咔咔压制 with n bullets (+ 轰轰 when n ≥ 30): built at runtime, cached per n */
    kaka(api, n) {
      const mem = api.mem, K = mem.modKit; mem._kaka = mem._kaka || {};
      if (!mem._kaka[n]) {
        const boom = n >= 30;
        const shots = K.shot.hits.map((h) => Object.assign({}, h, { count: n }));
        mem._kaka[n] = Object.assign({}, K.shot, {
          key: 'kaka', label: `咔咔压制 ×${n}` + (boom ? ' + 轰轰' : ''), hits: shots.concat(boom ? K.boom.hits : []),
          duration: n * SHOT + (boom ? K.boom.duration : 0), energy: K.shot.energy * n + (boom ? K.boom.energy : 0),
          concerto: 0.5 * n + 10, concertoSource: 'description', scale: boom ? { '轰轰伤害': 1.5 } : null, forceCritLabels: null,
          cancel: null, noSwap: null, durSource: 'module-estimate', frameLabel: `热压弹 ${n}×${SHOT}s` + (boom ? ' + ' + (K.boom.frameLabel || '轰轰') : ''),
          meta: { n, boom }, inferred: `压制节奏 ${SHOT}s/发（低）`,
        });
      }
      return mem._kaka[n];
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      switch (btn) {
        case 'A': return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: K.hv };
        case 'E':
          if (cs.ammo >= 10 - 1e-9) { const n = Math.min(30, Math.floor(cs.ammo)); return { act: this.kaka(api, n), meta: { n, boom: n >= 30 } }; }
          return charges(cs.eCh, t, 2, 9) >= 1 ? { act: K.E } : { blocked: '咻咻斗意次数不足' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act, meta) {
      // 加麻加辣：压制内按平均层数（n/2）计
      if (act.key === 'kaka' && meta) return [{ key: 'atkPct', value: 0.01 * Math.min(30, meta.n) / 2 }];
      return [];
    },
    apply(api, act, meta) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      const gain = (v) => { cs.ammo = Math.min(70, cs.ammo + v); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; gain(GAIN[k]); return; }
      cs.st = 0;
      switch (k) {
        case 'hv': gain(GAIN.hv); break;
        case 'E': useCharge(cs.eCh, api.t, 2, 9); gain(GAIN.E); break;
        case 'I': gain(GAIN.I); break;
        case 'kaka': {
          const n = (meta && meta.n) || 0;
          cs.ammo = Math.max(0, cs.ammo - n);
          api.fireBuff('mala', api.mi, { stacks: Math.min(30, n), t: te });
          if (ch >= 5 && n >= 30) api.fireBuff('c5', api.mi, { t: te });
          if (ch >= 6 && meta && meta.boom) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c6', j, { t: te });
          break;
        }
        case 'lib': if (ch >= 4) { gain(60); cs.eCh.n = Math.min(2, charges(cs.eCh, api.t, 2, 9) + 1); cs.eCh.since = api.t; } break;
        default: break;
      }
    },
    hold(api, act, rem) {
      // 不满 30 发不放压制（除非窗口将尽）
      if (act.key === 'kaka' && act.meta && !act.meta.boom && rem > 4) return '攒满 30 发热压弹';
      return null;
    },
    potential(api) { const K = api.mem.modKit; return 0.5 * Math.min(30, api.cs.ammo) / 30 * (api.est(K.boom) + 30 * api.est(K.shot)); },
  });
});
