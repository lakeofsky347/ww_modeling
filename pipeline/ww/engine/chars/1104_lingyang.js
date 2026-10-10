/*
 * 凌阳 (1104) character module — stream A 批次 4。冷凝 臂铠，常驻 5★ 主C（行狮 普攻/共鸣技能）。
 *
 * 常态：普攻 5 段（惊跃 后第 5 段 → 崩拳·当头咆哮）；共鸣技能 冲掌（无冷却）；第 3/4/5 段或崩拳命中后 E → 惊跃·郁怒追逃（+狮魂）。共鸣技能不打断普攻段数。
 * 狮魂：上限 100；惊跃 +40、变奏 +100、共鸣解放 +100（数值未给出，估计，低）。
 * 重击：狮魂满 → 起势·纵地金光 172.37%，进入 行狮（5 s；狮子奋迅期间消耗减半 → 10 s）；否则普通重击 145.73%。
 * 行狮：A → 狂态·摇光金狮舞 2 段；E → 飞身式·翻山越涧 82.88%×2（固有 勤修苦练：3 s 内有普攻 → 额外 1 次 150%，共鸣技能伤害）；
 *   剩余 < 0.5 s（狮魂 < 10）时 A → 凌云式·腿打连环，随后 登楼·尾坠千斤，结束行狮。消耗狮魂 回复协奏 35（进入时计）。
 * 共鸣解放 397.62%（125 能量，冷却 20）：狮子奋迅 14 s 冷凝 +50%（通用解析）。变奏 99.41%×2（固有 +50%，通用解析）。延奏 587.94% 攻击。
 * 链：2 变奏 +10 能量（20 s）；3 狮子奋迅期间 普攻 +20%、共鸣技能 +10%；4 延奏 全队冷凝 +20% 30 s；5 解放额外 200%；6 飞身式后 3 s 下次普攻 +100%。chainModeled 6。
 * 动作帧：WuWaSim（凌阳）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SOUL = { E2: 40, I: 100, R: 100 };
  return WW.registerChar({
    id: 1104, chainModeled: 6, name: '凌阳', version: '0.1', confidence: 'medium',
    notes: ['狮魂 获取量为估计（惊跃 40 / 变奏 100 / 解放 100，低）', '行狮 时长按狮魂匀速消耗（5 s / 狮子奋迅 10 s）', '空中攻击、闪避反击不建模'],
    audit: { role: 'dps', finishers: ['f1', 'f2', 'fly', 'R'], window: 25, sig: null, solo: 'lingyang_solo.json', team: 'team_lingyang.json', teamMi: 0 },
    frames: {
      a1: '普攻·basic_1 [WuWaSim]', a2: '普攻·basic_2 [WuWaSim]', a3: '普攻·basic_3 [WuWaSim]', a4: '普攻·basic_4 [WuWaSim]', a5: '普攻·basic_5 [WuWaSim]',
      roar: '普攻·basic_feral_roars_damage [WuWaSim]', h: '重击·heavy_heavy_attack [WuWaSim]', E: '共鸣技能·skill_ancient_arts_damage [WuWaSim]', E2: '共鸣技能·skill_furious_punches_damage [WuWaSim]',
      R: '共鸣解放·liberation [WuWaSim]', I: '变奏入场·intro [WuWaSim]', glor: '共鸣回路·forte_heavy_glorious_plunge_damage [WuWaSim]',
      f1: '共鸣回路·forte_heavy_feral_gyrate_1 [WuWaSim]', f2: '共鸣回路·forte_heavy_feral_gyrate_2 [WuWaSim]', fly: '共鸣回路·forte_heavy_mountain_roamer_damage [WuWaSim]',
      kick: '共鸣回路·forte_heavy_stormy_kicks_damage [WuWaSim]', tail: '共鸣回路·forte_heavy_tail_strike_damage [WuWaSim]', flyX: null,
    },
    resources: [{ key: 'soul', name: '狮魂', max: 100, segmented: false, confidence: 'low' }, { key: 'lion', name: '行狮', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (cs.lion != null ? 1 : 0) }],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 5, prefix: 'a', pre: '', durs: [0.3, 0.4, 0.73, 0.73, 0.73] }), {
        roar: H.act({ key: 'roar', cls: 'A', skill: 1, labels: ['崩拳·当头咆哮伤害'], levelKey: 'basic', dur: 0.8, label: '崩拳·当头咆哮' }),
        h: H.act({ key: 'h', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.73, label: '重击' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['冲掌·势式相承伤害'], levelKey: 'skill', dur: 0.67, label: '冲掌' }),
        E2: H.act({ key: 'E2', cls: 'E', skill: 2, labels: ['惊跃·郁怒追逃伤害'], levelKey: 'skill', dur: 0.77, label: '惊跃·郁怒追逃' }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 20, cdKey: 'R', dur: 3.03, label: '狮子奋迅' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.43, label: '出洞·睡狮蛰醒' }),
        glor: H.act({ key: 'glor', cls: 'H', skill: 6, labels: ['起势·纵地金光伤害'], levelKey: 'forte', dur: 0.8, label: '起势·纵地金光' }),
        f1: H.act({ key: 'f1', cls: 'A', skill: 6, labels: ['狂态·摇光金狮舞第一段伤害'], levelKey: 'forte', dur: 1.05, label: '摇光金狮舞·1' }),
        f2: H.act({ key: 'f2', cls: 'A', skill: 6, labels: ['狂态·摇光金狮舞第二段伤害'], levelKey: 'forte', dur: 1.0, label: '摇光金狮舞·2' }),
        fly: H.act({ key: 'fly', cls: 'E', skill: 6, labels: ['飞身式·翻山越涧伤害'], levelKey: 'forte', dur: 0.67, label: '飞身式·翻山越涧' }),
        kick: H.act({ key: 'kick', cls: 'A', skill: 6, labels: ['凌云式·腿打连环伤害'], levelKey: 'forte', dur: 1.93, label: '凌云式·腿打连环' }),
        tail: H.act({ key: 'tail', cls: 'A', skill: 6, labels: ['登楼·尾坠千斤伤害'], levelKey: 'forte', dur: 1.02, label: '登楼·尾坠千斤' }),
        O: B.outro(H, '留痕·踏雪点星'),
      });
      // 勤修苦练：额外 1 次 飞身式 ×1.5（共鸣技能伤害）
      K.flyX = Object.assign({}, K.fly, { key: 'flyX', label: '飞身式·翻山越涧（勤修苦练 额外）', hits: K.fly.hits.map((h) => Object.assign({}, h, { type: 'skill' })), scale: { '*': 1.5 } });
      if (!K.O.hits.length) {
        const ih = K.I.hits[0];
        K.O.hits = [Object.assign({}, ih, { label: '留痕·踏雪点星', multiplier: [5.8794], count: 1, type: 'outro', energy: [0], concerto: [0], confidence: 'low', lowReason: 'ww.json 无延奏伤害行，按描述 587.94% 攻击' })];
      }
      B.patch(H, /勤修苦练/, { mode: 'off' }, '模块：额外 飞身式', 'inherent');
      if (ch >= 3) B.patch(H, /瞠目顾盼/, { trigger: { on: 'act', keys: ['R'] }, duration: 14, mode: 'auto' }, '模块：狮子奋迅 14 s', 'chain');
      if (ch >= 6) { B.patch(H, /神功盖世/, { mode: 'off' }, '模块', 'chain'); H.buff({ id: 'c6', name: '链6·普攻', stats: [{ key: 'dmg:basic', value: 1.0 }], duration: 3, trigger: { on: 'manual' }, mode: 'module', text: '链6：飞身式后 3 s 下次普攻 +100%' }); }
      if (ch >= 5) { B.patch(H, /蹑罡踏斗/, { mode: 'off' }, '模块：额外 200%', 'chain'); K.c5 = Object.assign({}, K.R, { key: 'c5', label: '链5 额外伤害', hits: [Object.assign({}, K.R.hits[0], { multiplier: [2.0], count: 1, energy: [0], concerto: [0], label: '链5' })] }); }
      if (ch >= 2) { B.patch(H, /威风凛凛/, { mode: 'off' }, '模块：+10 能量 20 s', 'chain'); }
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4', 'a5'],
    init(api) { const s = api.H.opts.start || {}; return { st: 0, soul: s.soul || 0, lion: null, kicked: false, jump: false, roar: false, lastA: -9, c2: -99, liberated: null }; },
    endLion(api, t) {
      const cs = api.cs;
      if (cs.lion != null && t >= cs.lion - 1e-9) { cs.lion = null; cs.soul = 0; cs.kicked = false; cs.lst = 0; }
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      this.endLion(api, t);
      if (cs.lion != null) {
        switch (btn) {
          case 'A':
            if (cs.kicked) return { act: K.tail };
            if (cs.lion - t < 0.5 + 1e-9) return { act: K.kick };
            return { act: cs.lst % 2 ? K.f2 : K.f1 };
          case 'E': return { act: K.fly };
          case 'H': return { blocked: '行狮中' };
          case 'R': return { act: K.R };
          default: return B.common(api, btn);
        }
      }
      switch (btn) {
        case 'A': { const n = (cs.st % 5) + 1; return { act: n === 5 && cs.roar ? K.roar : K['a' + n] }; }
        case 'E': return { act: cs.jump ? K.E2 : K.E };
        case 'H': return { act: cs.soul >= 100 - 1e-9 ? K.glor : K.h };
        case 'R': return { act: K.R };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain, K = api.mem.modKit;
      if (/^a\d$/.test(k) || k === 'roar') {
        const n = k === 'roar' ? 5 : +k.slice(1); cs.st = n % 5; if (n >= 3) cs.jump = true; if (k === 'roar') cs.roar = false; cs.lastA = te; return;
      }
      switch (k) {
        case 'E': break;
        case 'E2': cs.jump = false; cs.roar = true; cs.soul = Math.min(100, cs.soul + SOUL.E2); break;
        case 'h': cs.st = 0; break;
        case 'glor': {
          const half = on(cs.liberated, te);
          cs.lion = te + (half ? 10 : 5); cs.lst = 0; cs.kicked = false; cs.st = 0; api.addConcerto(api.mi, 35);
          break;
        }
        case 'f1': case 'f2': cs.lst = (cs.lst || 0) + 1; cs.lastA = te; break;
        case 'fly':
          if (te - cs.lastA <= 3 + 1e-9) { api.deal(K.flyX, { t: te, coordAttack: false }); cs.lastA = -9; }
          if (ch >= 6) api.fireBuff('c6', api.mi, { t: te });
          break;
        case 'kick': cs.kicked = true; cs.lastA = te; break;
        case 'tail': cs.lion = null; cs.soul = 0; cs.kicked = false; break;
        case 'R':
          cs.soul = Math.min(100, cs.soul + SOUL.R); cs.liberated = te + 14;
          if (cs.lion != null) cs.lion = Math.min(te + 10, te + 2 * Math.max(0, cs.lion - te));
          if (K.c5) api.deal(K.c5, { t: te, coordAttack: false });
          break;
        case 'I':
          cs.soul = Math.min(100, cs.soul + SOUL.I);
          if (ch >= 2 && te - cs.c2 >= 20) { cs.c2 = te; api.addEnergy(api.mi, 10); }
          break;
        default: break;
      }
      this.endLion(api, te);
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (cs.lion != null) return 0.8 * Math.max(0, cs.lion - api.t) / 1.0 * api.est(K.f1) * 0.5;
      return 0.5 * (cs.soul / 100) * (api.est(K.glor) + 4 * api.est(K.f1));
    },
  });
});
