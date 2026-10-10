/*
 * 露西 (1511) character module — worker-B.
 *
 * 普攻 靶定线程 (1004901): 普攻 4 段；重击 2 段；「普攻·线程撕裂（算法压缩状态）…最多4段…本次伤害为重击伤害」「重击·单线程 / 重击·双线程（【根权限】达到100点）」
 *   「重击·多线程…附加【骇破·偏移】。施放时若自身持有SQL，则使本次伤害倍率提升270%并移除SQL」（模块：倍率 ×3.7，中）
 * 共鸣技能 协议突破 (1004902): 有效载荷（冷却 15，命中自动追加攻击，激活脉冲干扰，附加骇破·偏移）→ 脉冲干扰（附加非正式握手）；
 *   「当【传输协议】达到100点或露西处于算法压缩状态下时…替换为共鸣技能·死锁」（冷却 14，重击伤害，附加骇破·偏移）
 *   「施放共鸣解放…将重置共鸣技能·死锁的冷却时间」
 * 共鸣解放 网络行者 (1004903): 覆写篡改 894.65%（重击伤害），冷却 25，125 能量；Ram 24：
 *   集群入侵 2（79.53%）/ 义体故障 4（受到伤害 +5% 30 秒）/ 突破协议 4（防御 −5% 30 秒）/ 突触熔融 5（79.53%）/ 运动失能 6（911.83% 骇破伤害，降攻）
 *   → 模块默认 集群入侵+义体故障+突破协议+突触熔融+运动失能 = 21 Ram；运动失能伤害类型为骇破（unknown14，低）→ 默认不计伤害（opts.motorDmg=true 计入）
 *   「暗网深潜：露西处于算法压缩状态且施放重击·多线程后…替换…覆写篡改伤害倍率大幅提升」1789.29%
 * 共鸣回路 黑墙深度 (1004907):
 *   「施放共鸣技能·死锁后露西进入算法压缩状态，并获得1层SQL…自身衍射伤害加成提升65%，持续8秒」
 *   「施放共鸣解放…或施放重击·多线程后8秒内不施放指定技能，将会退出算法压缩状态」→ 模块：R 后退出；多线程后 8 秒内没有其他动作也退出（中）
 *   【传输协议】/【根权限】每次获取量未公开 → 估计（低）：普攻 8/8/12/14、重击 10/15、有效载荷 10、脉冲干扰 15（变奏后 +20）、非正式握手 5/秒；
 *   线程撕裂每段 +15、单线程 +20 根权限
 * 变奏 过时幻觉: 69.14%×2；下一次脉冲干扰 +20 传输协议
 * 延奏 反制程序: 下一名登场角色普攻伤害加深 25%（解析）；「队伍中除露西以外的登场角色附加【骇破·偏移】时，该角色全伤害加深20%」→ 偏移未建模 → 模块关闭（B4）
 * 固有：光学欺骗（生存）/ 网络后门（击败怒涛级以上目标才叠层）→ 不建模
 * 共鸣链：未建模（notes）
 * 专武 蜃影 (21030056):「每次为敌方怪物附加【骇破·偏移】后，重击伤害加深30%，且重击伤害能无视目标10%防御，持续14秒」
 *   → 模块：有效载荷/死锁/多线程（技能描述写明附加骇破·偏移）时触发（高）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21030056;
  const CP = { a1: 8, a2: 8, a3: 12, a4: 14, h1: 10, h2: 15, pl: 10, pi: 15 };   // 估计（低）
  const HS = 5;          // 非正式握手 /秒（估计，低）
  const RG = { s1: 15, s2: 15, s3: 15, s4: 15, sg: 20 };  // 估计（低）
  const scale = (a, m, key) => Object.assign({}, a, { key, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1511, chainModeled: 0, name: '露西', version: '0.1', confidence: 'medium',
    notes: ['传输协议/根权限/非正式握手获取量为估计（低）', '多线程 SQL「倍率提升270%」按 ×3.7（中）', '运动失能（骇破伤害）默认不计伤害；骇破·偏移/干涉/数据崩解未建模（B4）',
      '欺骗程式选择耗时未计（覆写篡改帧 4.37s 内）', '空中攻击/闪避反击未建模', '共鸣链未建模'],
    audit: { role: 'dps', finishers: ['mt', 'dd'], window: 25, sig: SIG, alts: [21030015, 21030016, 21030045], solo: 'lucy_solo.json', team: 'team_lucy.json', teamMi: 0,
      note: '暗网深潜（dd）需要在多线程后 8 秒内放 R：开场满能量时搜索直接放网络行者，不保留能量（开场能量 60 时搜索会用 dd，25s 29.3 万 vs 25.6 万）→ 搜索贪心问题，见 CORE_CHANGES worker-B B12' },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Locked Thread'), B.stageFrames('s', 4, '普攻·Basic: Thread Shredding'), {
      h1: '重击·Heavy: Locked Thread 1', h2: '重击·Heavy: Locked Thread 2', pl: '共鸣技能·Skill 1: Payload Charge', pi: '共鸣技能·Skill 2: Pulse Interference',
      dl: '共鸣技能·Skill 3: Deadlock', sg: '重击·Heavy: Single Threading', du: '重击·Heavy: Dual Threading', mt: '重击·Heavy: Multi-threading (SQL)', mt0: '重击·Heavy: Multi-threading',
      nr: '共鸣解放·Liberation: Netrunner Override', dd: '共鸣解放·Liberation: Old Net Deep Dive', I: '变奏入场·Intro: Outdated Hallucination', O: '延奏·Outro: Countermeasure Program',
    }),
    resources: [
      { key: 'cp', name: '传输协议', max: 100, segmented: false, confidence: 'low' },
      { key: 'rg', name: '根权限', max: 100, segmented: false, confidence: 'low' },
      { key: 'ys', name: '算法压缩', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.ys ? 1 : 0) },
      { key: 'sql', name: 'SQL', max: 1, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const o = H.opts;
      const progLabels = ['欺骗程式·集群入侵伤害', '欺骗程式·突触熔融伤害'].concat(o.motorDmg ? ['欺骗程式·运动失能伤害'] : []);
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '普攻', durs: [0.52, 0.62, 1.15, 1.25] }),
        B.stages(H, { n: 4, prefix: 's', pre: '普攻·线程撕裂', durs: [0.57, 0.92, 1.12, 0.78] }), {
          h1: H.act({ key: 'h1', cls: 'H', skill: 1, labels: ['重击第一段伤害'], levelKey: 'basic', dur: 0.8, label: '重击第一段' }),
          h2: H.act({ key: 'h2', cls: 'H', skill: 1, labels: ['重击第二段伤害'], levelKey: 'basic', dur: 1.82, label: '重击第二段' }),
          sg: H.act({ key: 'sg', cls: 'H', skill: 1, labels: ['重击·单线程伤害'], levelKey: 'basic', dur: 1.12, label: '重击·单线程' }),
          du: H.act({ key: 'du', cls: 'H', skill: 1, labels: ['重击·双线程伤害'], levelKey: 'basic', concertoParam: '重击·双线程回复协奏能量', dur: 1.12, label: '重击·双线程' }),
          mt0: H.act({ key: 'mt', cls: 'H', skill: 1, labels: ['重击·多线程伤害'], levelKey: 'basic', concertoParam: '重击·多线程回复协奏能量', dur: 1.02, label: '重击·多线程' }),
          pl: H.act({ key: 'pl', cls: 'E', skill: 2, labels: ['共鸣技能·有效载荷突进攻击伤害', '共鸣技能·有效载荷追加攻击伤害'], levelKey: 'skill', cooldown: 15, cdKey: 'E', dur: 0.92, label: '有效载荷' }),
          pi: H.act({ key: 'pi', cls: 'E', skill: 2, labels: ['共鸣技能·脉冲干扰伤害'], levelKey: 'skill', concertoParam: '共鸣技能·脉冲干扰回复协奏能量', dur: 2.6, label: '脉冲干扰' }),
          dl: H.act({ key: 'dl', cls: 'E', skill: 2, labels: ['共鸣技能·死锁伤害'], levelKey: 'skill', concertoParam: '共鸣技能·死锁回复协奏能量', cooldown: 14, cdKey: 'dl', dur: 1.2, label: '死锁' }),
          nr: H.act({ key: 'nr', cls: 'R', skill: 3, labels: ['共鸣解放·网络行者·覆写篡改伤害'].concat(progLabels), levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 4.37, label: '网络行者' }),
          dd: H.act({ key: 'dd', cls: 'R', skill: 3, labels: ['共鸣解放·暗网深潜·覆写篡改伤害'].concat(progLabels), levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, cdKey: 'R', dur: 4.37, label: '暗网深潜' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['变奏技能·过时幻觉伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.95 }),
          O: B.outro(H, '反制程序'),
        });
      K.mt = scale(K.mt0, 3.7, 'mt');
      K.mt.label = '重击·多线程（SQL）';
      for (const k of ['s1', 's2', 's3', 's4']) K[k].cls = 'A';
      B.patch(H, /除露西以外的登场角色附加【骇破·偏移】/, { mode: 'off' }, '模块：骇破·偏移未建模（B4）→ 关闭', 'outro');
      // 专武 蜃影「每次为敌方怪物附加【骇破·偏移】后…」：核心解析为 tune 触发（hack:shift），由 api.applyTune 触发，模块不再补丁
      // 声骸 1 件套 碎梦亡鬼之魇：核心解析器已补全「普攻和重击伤害加成」并识别「添加【骇破·偏移】时」触发（CORE B11/B4 钩子）→ 模块不再补丁，附加偏移时调用 api.applyTune
      // 固有 网络后门（击败怒涛级以上目标才叠层）：核心解析器已默认关闭（CORE B11），模块不再补丁
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { cp: st.cp || 0, rg: 0, ys: false, sql: 0, st: 0, sst: 0, hst: 0, piReady: false, hs: false, introBonus: false, spUntil: null, mtT: null, deep: false, debuffUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.ys) return { act: K['s' + ((cs.sst % 4) + 1)] };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H':
          if (cs.ys) {
            if (cs.duDone) return { act: cs.sql ? K.mt : K.mt0 };
            return { act: cs.rg >= 100 - 1e-9 ? K.du : K.sg };
          }
          return { act: cs.hst ? K.h2 : K.h1 };
        case 'E':
          if (cs.ys || cs.cp >= 100 - 1e-9) return api.cdReady('dl') ? { act: K.dl } : { blocked: '死锁冷却中' };
          if (cs.piReady) return { act: K.pi };
          return api.cdReady('E') ? { act: K.pl } : { blocked: '冷却中' };
        case 'R': return { act: cs.deep ? K.dd : K.nr };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api) {
      const out = [];
      if (on(api.cs.spUntil, api.t)) out.push({ key: 'dmg:spectro', value: 0.65 });
      return out;
    },
    auras(api) {
      if (!on(api.cs.debuffUntil, api.t)) return [];
      return [{ key: 'deep:all', value: 0.05 }, { key: 'defReduce', value: 0.05 }];   // 义体故障 / 突破协议（目标侧，近似为全队增益）
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd, dur = te - t;
      if (cs.ys && cs.mtT != null && t > cs.mtT + 8) { cs.ys = false; cs.deep = false; }
      const cpAdd = (n) => { if (!cs.ys) cs.cp = Math.min(100, cs.cp + n + (cs.hs ? HS * dur : 0)); };
      const hack = () => { api.applyTune('hack', 'shift', 10); };   // 偏移持续时间未给出 → 10 s（只用于触发「附加骇破·偏移时」类增益）
      if (k !== 'h1') cs.hst = 0;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; cpAdd(CP[k]); return; }
      if (/^s\d$/.test(k)) { cs.sst = +k.slice(1) % 4; cs.rg = Math.min(100, cs.rg + RG[k]); return; }
      switch (k) {
        case 'h1': cpAdd(CP.h1); cs.hst = 1; break;
        case 'h2': cpAdd(CP.h2); break;
        case 'pl': cpAdd(CP.pl); cs.piReady = true; cs.st = 1; hack(); break;
        case 'pi': cpAdd(CP.pi + (cs.introBonus ? 20 : 0)); cs.introBonus = false; cs.piReady = false; cs.hs = true; cs.st = 1; break;
        case 'dl':
          if (!cs.ys) { cs.ys = true; cs.sql = 1; cs.spUntil = te + 8; cs.rg = 0; cs.duDone = false; cs.mtT = null; }
          cs.cp = 0; cs.hs = false; cs.sst = 1; hack(); break;
        case 'sg': cs.rg = Math.min(100, cs.rg + RG.sg); cs.sst = 1; break;
        case 'du': cs.rg = 0; cs.duDone = true; break;
        case 'mt': cs.sql = 0; cs.duDone = false; cs.deep = true; cs.mtT = te; cs.sst = 1; hack(); break;
        case 'nr': case 'dd':
          cs.ys = false; cs.deep = false; cs.sql = 0; cs.cp = 0; cs.hs = false; cs.mtT = null; cs.duDone = false; cs.debuffUntil = te + 30;
          api.ms.cd.dl = 0; break;
        case 'I': cs.introBonus = true; cs.st = 1; break;
        default: break;
      }
    },
    // search heuristic (not a game rule): 传输协议→死锁/算法压缩，算法压缩→多线程/暗网深潜
    // stream B B12a: hold 网络行者 (plain R) while 暗网深潜 (多线程 → 8 s 内 R) is reachable in the remaining window (search only; reach estimates, low)
    hold(api, act, rem) {
      if (act.key !== 'nr') return null;
      const cs = api.cs, reach = cs.ys ? (cs.duDone ? 1.5 : 6) : (cs.cp >= 100 - 1e-9 ? 8 : 14);
      return rem > reach + 1 ? '保留能量等待暗网深潜' : null;
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      if (!cs.ys) return cs.cp / 100 * 0.6 * (api.est(K.dl) + api.est(K.mt));
      return (cs.sql ? 0.6 * api.est(K.mt) : 0) + cs.rg / 100 * 0.3 * api.est(K.du) + (cs.deep ? 0.3 * (api.est(K.dd) - api.est(K.nr)) : 0);
    },
  });
});
