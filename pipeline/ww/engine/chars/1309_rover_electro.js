/*
 * 漂泊者·导电 (1309 / 1310, 两个性别同一技能组) character module — worker-B.
 *
 * 常态攻击 止戈 (1005501): 普攻 4 段；格挡架势 / 逆转一击 / 空中攻击·湮灭 / 闪避反击 未建模
 * 共鸣技能 雷引 (1005502): 100.20%×2，冷却 10；「一定时间内短按普攻，将会施放普攻·克敌…此次伤害为普攻伤害」56.12%+84.17%
 * 共鸣解放 最终战略 (1005503): 1192.86%，冷却 25，协奏 20
 * 共鸣回路 天机万象 (1005507):
 *   「【电涌】达到上限时，共鸣技能替换为共鸣技能超负荷」（上限 120）；超负荷 80.72%×7+423.77%×2，冷却 25
 *   「短按施放…随后清空【电涌】并使队伍中的角色获得10%攻击加成，持续20秒」
 *   「长按施放…消耗60点协奏能量…随后清空【电涌】并进入临界共鸣状态」
 *   临界共鸣：「解锁共鸣技能千声翻涌，处于战斗状态时每秒消耗10%上限的【霆怒】」；
 *     地面短按至多 7 段：衍射 ×3（衍射伤害）→ 湮灭 ×3（湮灭伤害）→ 剑止万律（气动伤害）
 *     「千声翻涌命中时可以触发雷陨…此次伤害为共鸣技能伤害」39.77%
 *   【电涌】：变奏、普攻、雷引、克敌造成伤害时回复（量未公开 → 估计 a1 8 / a2 8 / a3 12 / a4 14 / 雷引 20 / 克敌 16 / 变奏 30，低）
 *   【霆怒】：进入临界共鸣时满 100；千声翻涌造成伤害时回复（量未公开 → 估计每段 +4，低）
 * 固有 解明：「共鸣技能超负荷对目标造成伤害后附加10层【电磁效应】」→ api.addAnomaly('flare', 10)
 * 固有 归枢：「长按施放共鸣技能超负荷后，自身共鸣技能伤害加成提升20%，持续20秒，若切换至其他角色则该效果提前结束」→ 只在长按时触发
 * 变奏 不啻惊雷: 33.41%×2+100.21%
 * 延奏 殷殷其雷：「下一位登场角色获得电髓，持续20秒…持有电髓的角色附加异常效应后，消耗电髓并获得全伤害加深25%，持续14秒，切换至其他角色时，该效果提前结束」
 *   → 核心 anomaly 事件（ev.mi = 附加者）；「施放延奏技能时，退出临界共鸣状态，清除全部【霆怒】」
 * 按键映射（引擎只有 A/H/E/R/Q）：电涌满时 E = 长按超负荷（协奏 ≥ 60，否则短按）；H = 短按超负荷（本角色无常规重击，格挡架势未建模）
 * 雷陨：每段千声翻涌触发 1 次（低）
 * 动作帧：WuwaLAB（按原样映射）；衍射三段映射 Hunt / 1 / 2（低：WuwaLAB 命名与段数对应关系未确认）
 * 专武：无（null）
 * 共鸣链：未建模（chainModeled 0）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const DY = { a1: 8, a2: 8, a3: 12, a4: 14, tc: 20, kd: 16, I: 30 };
  const TN_GAIN = 4, TN_DRAIN = 10;
  const TS = [['s1', '千声翻涌·衍射第一段伤害', 0.35], ['s2', '千声翻涌·衍射第二段伤害', 0.83], ['s3', '千声翻涌·衍射第三段伤害', 0.7],
    ['h1', '千声翻涌·湮灭第一段伤害', 0.78], ['h2', '千声翻涌·湮灭第二段伤害', 0.82], ['h3', '千声翻涌·湮灭第三段伤害', 1.13], ['jz', '千声翻涌·剑止万律伤害', 1.7]];
  const tnAt = (cs, t) => (cs.lj ? Math.max(0, cs.tn - TN_DRAIN * Math.max(0, t - cs.tnT)) : 0);
  function def(id) {
    const file = id === 1309 ? 'rover_electro' : 'rover_electro_f';
    return {
      id, chainModeled: 0, name: '漂泊者·导电', version: '0.1', confidence: 'medium',
      notes: ['电涌 / 霆怒回复量为估计（低）', '雷陨每段千声翻涌 1 次（低）', '长按/短按超负荷：E = 长按（协奏 ≥ 60），H = 短按', '格挡架势、逆转一击、空中千声翻涌未建模', '延奏电髓：持有者下次附加异常时触发 25% 全伤害加深', '共鸣链未建模'],
      audit: { role: 'subdps', finishers: ['os', 'lib', 'jz'], window: 25, sig: null, alts: [21020015, 21020016, 21020024], solo: file + '_solo.json', team: 'team_' + file + '.json', teamMi: 1 },
      frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Deterrence'), {
        tc: '共鸣技能·Skill 1: Thunderclap', kd: '普攻·Basic: Repel', os: '共鸣技能·Skill 2: Overshock (Hold)', osT: '共鸣技能·Skill 2: Overshock',
        s1: '共鸣回路·Skill Spectro: Thrum of All Sounds Hunt', s2: '共鸣回路·Skill Spectro: Thrum of All Sounds 1', s3: '共鸣回路·Skill Spectro: Thrum of All Sounds 2',
        h1: '共鸣回路·Skill Havoc: Thrum of All Sounds 1', h2: '共鸣回路·Skill Havoc: Thrum of All Sounds 2', h3: '共鸣回路·Skill Havoc: Thrum of All Sounds 3',
        jz: '共鸣回路·Skill: Thrum of All Sounds - Silencing Blade', lib: '共鸣解放·Liberation: Ultimate Tactics', I: '变奏入场·Intro: Thunderous Fury',
      }),
      resources: [
        { key: 'dy', name: '电涌', max: 120, segmented: false, confidence: 'low' },
        { key: 'tn', name: '霆怒', max: 100, segmented: false, confidence: 'low', get: (cs, t) => +tnAt(cs, t).toFixed(1) },
      ],
      kit(H) {
        const s6 = H.skill(6);
        const ly = s6.hits.filter((h) => !h.alt && h.label === '雷陨伤害');
        const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', label: (k) => '普攻第' + B.CN[k - 1] + '段伤害', durs: [0.37, 0.48, 0.8, 1.3] }), {
          tc: H.act({ key: 'tc', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', cooldown: 10, cdKey: 'E', dur: 0.5, label: '雷引' }),
          kd: H.act({ key: 'kd', cls: 'A', skill: 2, labels: ['普攻·克敌伤害'], levelKey: 'skill', dur: 1.07, label: '普攻·克敌' }),
          os: H.act({ key: 'os', cls: 'E', skill: 6, labels: ['超负荷伤害'], levelKey: 'forte', cooldown: 25, cdKey: 'os', dur: 2.03, label: '超负荷（长按）' }),
          osT: H.act({ key: 'osT', cls: 'E', skill: 6, labels: ['超负荷伤害'], levelKey: 'forte', cooldown: 25, cdKey: 'os', dur: 2.03, label: '超负荷（短按）' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 3.73, label: '最终战略' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.2 }),
          O: B.outro(H, '殷殷其雷'),
        });
        for (const [k, lab, d] of TS) K[k] = H.act({ key: k, cls: 'E', skill: 6, hits: s6.hits.filter((h) => !h.alt && h.label === lab).concat(ly), levelKey: 'forte', dur: d, label: lab.replace('伤害', '') + '+雷陨' });
        H.buff({ id: 'osAtk', name: '超负荷·攻击', stats: [{ key: 'atkPct', value: 0.1 }], duration: 20, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '短按施放共鸣技能超负荷…使队伍中的角色获得10%攻击加成，持续20秒' });
        B.patch(H, /归枢|长按施放共鸣技能超负荷后/, { trigger: { on: 'act', keys: ['os'] }, mode: 'auto' }, '模块：只在长按超负荷时触发', 'inherent');
        H._ds = H.findBuff((b) => b.kind === 'outro' && /电髓/.test(b.text || '')).map((b) => b.id);
        B.patch(H, /持有电髓的角色附加异常效应后/, { trigger: { on: 'manual' }, mode: 'module' }, '模块：电髓持有者附加异常时（核心 anomaly 事件）', 'outro');
        return K;
      },
      fillerKeys: ['a1', 'a2', 'a3', 'a4'],
      init() { return { dy: 0, lj: false, tn: 0, tnT: 0, st: 0, ts: 0, kdOpen: false, dsMi: null, dsUntil: null }; },
      resolve(api, btn) {
        const K = api.mem.modKit, cs = api.cs, t = api.t, lj = cs.lj && tnAt(cs, t) > 0;
        const full = cs.dy >= 120 - 1e-9 && !lj;
        switch (btn) {
          case 'A': return cs.kdOpen ? { act: K.kd } : { act: K['a' + ((cs.st % 4) + 1)] };
          case 'H':
            if (full) return api.cdReady('os') ? { act: K.osT } : { blocked: '超负荷冷却中' };
            return null;
          case 'E':
            if (lj) return { act: K[TS[cs.ts % 7][0]] };
            if (full) {
              if (!api.cdReady('os')) return { blocked: '超负荷冷却中' };
              return api.ms.concerto >= 60 - 1e-9 ? { act: K.os } : { act: K.osT };
            }
            return api.cdReady('E') ? { act: K.tc } : { blocked: '冷却中' };
          case 'R': return { act: K.lib };
          case 'I': return { act: K.I };
          default: return B.common(api, btn);
        }
      },
      apply(api, act) {
        const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
        if (cs.lj && tnAt(cs, t) <= 0) { cs.lj = false; cs.ts = 0; }
        cs.kdOpen = false;
        const addDy = (n) => { cs.dy = Math.min(120, cs.dy + n); };
        if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; addDy(DY[k]); return; }
        const ti = TS.findIndex((x) => x[0] === k);
        if (ti >= 0) { const v = tnAt(cs, te); cs.tn = Math.min(100, v + TN_GAIN); cs.tnT = te; cs.ts = (ti + 1) % 7; return; }
        switch (k) {
          case 'tc': addDy(DY.tc); cs.kdOpen = true; break;
          case 'kd': addDy(DY.kd); break;
          case 'I': addDy(DY.I); break;
          case 'osT':
            cs.dy = 0; api.addAnomaly('flare', 10);
            api.fireBuff('osAtk', api.mi, { duration: 20 });
            break;
          case 'os':
            cs.dy = 0; api.addAnomaly('flare', 10); api.addConcerto(api.mi, -60);
            cs.lj = true; cs.tn = 100; cs.tnT = te; cs.ts = 0;
            break;
          case 'O': cs.lj = false; cs.tn = 0; cs.ts = 0; break;
          default: break;
        }
      },
      onOutro(api, toMi) { const cs = api.cs; cs.lj = false; cs.tn = 0; cs.ts = 0; cs.dsMi = toMi; cs.dsUntil = api.t + 20; },
      // 延奏 电髓：持有者附加异常效应 → 全伤害加深 25% 14 秒（切人提前结束）
      onTeam(api, ev) {
        const cs = api.cs, t = ev.t != null ? ev.t : api.t;
        if ((ev.type === 'swap' || ev.type === 'intro') && cs.dsMi != null && ev.mi !== cs.dsMi) { cs.dsMi = null; return; }
        if (ev.type !== 'anomaly' || ev.mi !== cs.dsMi || !on(cs.dsUntil, t) || !(ev.added > 0)) return;
        for (const id of api.H._ds || []) api.fireBuff(id, cs.dsMi, { duration: 14, t });
        cs.dsMi = null; cs.dsUntil = null;
      },
      // search heuristic (not a game rule): 电涌→超负荷；霆怒→千声翻涌
      potential(api) {
        const cs = api.cs, K = api.mem.modKit, tn = tnAt(cs, api.t);
        if (tn > 0) return tn / 100 * 0.5 * 6 * api.est(K.h1);
        return cs.dy / 120 * 0.5 * api.est(K.os);
      },
    };
  }
  WW.registerChar(def(1310));
  return WW.registerChar(def(1309));
});
