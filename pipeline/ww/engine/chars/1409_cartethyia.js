/*
 * 卡提希娅 (1409) character module. 生命值缩放。
 *
 * 常态攻击 以剑奉读此身 (1003501):
 *   「施放第4段普攻·卡提希娅后，会为命中的目标附加1层【风蚀效应】，同时会召唤【神权剑之影】。」「重击·卡提希娅…会召唤【异权剑之影】…此次伤害视为普攻伤害。」
 *   「施放空中攻击·卡提希娅后，卡提希娅回收附近场上所有【剑之影】，根据【剑之影】的种类之和，改变此次下落攻击的形态」（空中攻击回收一剑/二剑/三剑）
 *   「【…剑之影】持续20秒，至多仅存在1把。」
 *   → 按键映射（非游戏规则）：基础形态下若场上有【异权剑之影】，H = 下落攻击并回收全部剑之影；否则 H = 重击（召唤异权剑）。
 * 共鸣技能 此剑以人之名 (1003502): 「为命中目标附加2层【风蚀效应】，此次伤害为普攻伤害」「会召唤【人权剑之影】」 共鸣技能冷却时间=14
 * 共鸣解放 听骑士从心祈愿 (1003503): 「化身【芙露德莉斯】…进入【显化】状态，持续12秒…进入该状态时，清空【决意】。」消耗共鸣能量=125, 冷却时间=25
 *   「普攻·芙露德莉斯第5段，空中攻击·芙露德莉斯第2段，共鸣技能·凭风斩浪破敌可以给命中的目标立刻结算1次【风蚀效应】，结算完成后会使当前【风蚀效应】层数减少1层。」
 *   「【芙露德莉斯】攻击命中目标时，可积攒【决意】，当【决意】达到120点时，点按共鸣解放，可施放共鸣解放·看潮怒风哮之刃。」
 *   看潮怒风哮之刃:「清空【决意】，移除【显化】状态…造成伤害时目标每拥有1层【风蚀效应】，对目标造成的伤害加深20%，至多5层，命中后会清空目标拥有的【风蚀效应】。」冷却时间=25
 *   化身·卡提希娅「【决意】未满120点时，点按共鸣解放，会施放普攻·卡提希娅第2段，并临时化身为【卡提希娅】，并暂停【显化】状态持续时间计时」
 *   化身·芙露德莉斯「在【显化】状态持续时间内，【卡提希娅】使用共鸣解放时，会施放普攻·芙露德莉斯第2段，不消耗共鸣能量…并恢复【显化】状态持续时间计时」
 *   → 建模：R(决意<120, 显化中) = avC（A2 命中行，暂停显化）；暂停期间卡提希娅 R = avF（fA2 命中行，不耗能，恢复显化）。
 *   → 之心/之意/之力：仅【神权之意】影响单目标伤害（风蚀间隔 −50%、加深 50%，需显化且在场）；人权=停滞、异权=多目标复制，只记录。
 *     之心在空中攻击回收剑之影时获得，「【显化】状态结束时，移除」（显化暂停不算结束）。
 * 共鸣回路 暴风雨 (1003507): 芙露德莉斯 普攻 5 段 / 重击 / 强化重击（重击后再按 H）/ 共鸣技能·此剑为潮浪之意 → 再次 E = 凭风斩浪破敌（窗口 3 秒，推断）/ 共鸣技能冷却时间=14
 *   【决意】每次命中的获取量数据中没有、公开资料也未找到 → 估计（低；module.gain 覆盖）：fA1 6 / fA2 8 / fA3 10 / fA4 12 / fA5 20 / 重击 10 / 强化重击 15 / 潮浪之意 10 / 凭风斩浪 20 / 自由的未来 15
 * 公开循环（核对用）：Prydwen https://www.prydwen.gg/wuthering-waves/characters/cartethyia 标准循环
 *   变奏→普攻2-4→E→下落→R→[芙露德莉斯] E1→空中重击(空中3)→普攻3-5→E2→普攻3-5→看潮→延奏，“majority of her damage in Fleurdelys form”；
 *   Game8 https://game8.co/games/Wuthering-Waves/archives/507777 “Fleurdelys form is her primary source of damage”。
 *   0.3：修复估值缓存键冲突（模块 R 与通用 kit.R 同 key）后搜索使用 R；加入空中攻击·芙露德莉斯 1–3（耐力 5/5/30，表）、上挑、化身切换、神权之意门控。
 * 固有 以风刻痕留蚀: 「当目标拥有1到3层【风蚀效应】时…造成的伤害提升30%；当目标拥有3层以上…每层额外提升10%，最多叠加3层。」 → dmg:all（中：“伤害提升”归入伤害加成区）
 * 延奏 听风潮为你祝颂: 「队伍中除【卡提希娅】、【芙露德莉斯】以外的登场角色对拥有【异常效应】的目标造成的气动伤害加深17.5%，持续20秒。」
 *   → 解析为 target 'others'；模块在延奏时若目标有任一异常效应（引擎异常层，或 module.anomaly='external'）才施加
 * 风蚀效应: 引擎异常效应层（api.addAnomaly / detonateAnomaly，见 MECHANICS.md「异常效应」）：附加即跳、每 3 秒一跳、附加刷新 14.8 秒、
 *   到期全部移除、上限 3（链2 +3，module.erosionCap 覆盖）。芙露德莉斯显化期间：触发间隔 −50%（anomalyPeriodScale）、风蚀伤害加深 50%（anomalyStats）。
 * 武器 不屈命定之冠 (21020056): 「施放变奏技能或普攻后15秒内，自身造成伤害无视目标8%防御，当目标的风蚀效应不少于1层时，对目标造成的伤害加深20%。」 → 模块判定
 * 共鸣链: 1 决意每到 30/60/90/120 暴击伤害 +25%（15 秒，最多 4 层）；2 卡提希娅形态普攻/重击/变奏 ×1.5、空中攻击 ×3，风蚀上限 +3；
 *   3 fA5/强化重击/凭风斩浪 额外附加 2 层，看潮倍率 ×2；4 全队全属性伤害 +20%（附加风蚀后，20 秒）；6 芙露德莉斯受到伤害 +40%（deep），看潮附加风蚀至上限且不清空。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN } = C;
  const SIG = 21020056;
  // 【决意】获取量：数据与公开资料均无逐段数值 → 估计，校准为 Prydwen 标准循环（fE1→空中重击fM3→fA3→fA4→fA5→fE2→fA3→fA4→fA5→看潮）恰好 120
  const GAIN = { fA1: 6, fA2: 8, fA3: 10, fA4: 12, fA5: 20, fH: 10, fHH: 15, fE1: 10, fE2: 20, fI: 15, fM1: 6, fM2: 12, fM3: 6, fUp: 10, avF: 8, avFM: 6 };
  const ER = (api) => api.anomaly('erosion');
  const swords = (cs, t) => ['shen', 'ren', 'yi'].filter((k) => on(cs.sw[k], t));
  const F = (cs, t) => on(cs.xh, t);
  return WW.registerChar({
    id: 1409, chainModeled: 6, name: '卡提希娅', version: '0.3', confidence: 'low',
    notes: ['风蚀效应伤害由引擎异常效应层结算（每层倍率/时序来自 buff.json，乘区按 wuwa-calc-site，低）；显化期间风蚀间隔 −50%、伤害加深 50%',
      '【决意】获取量为估计值（低，校准为 Prydwen 标准循环恰好 120），可在 member.module.gain 覆盖', '决意未满时 R = 临时化身卡提希娅（暂停显化），显化暂停期间 R = 化身芙露德莉斯（不耗能）',
      '芙露德莉斯空中：fE1/上挑后在空中，A = 空中攻击 1→2→3，H = 空中攻击第3段（长按）；空中3段/凭风斩浪后 A 接普攻第3段；强化重击后 A = 上挑',
      '显化期间风蚀间隔 −50%/加深 50% 需【神权之意】（空中攻击回收神权剑之影）',
      '基础形态 H：场上有异权剑之影时为下落攻击（回收剑之影），否则为重击', '风蚀效应 14.8 秒内无新附加即全部移除（buff.json 10040000，表格）'],
    frames: {
      A1: '普攻·Basic: Sword to Carve My Forms 1', A2: '普攻·Basic: Sword to Carve My Forms 2', A3: '普攻·Basic: Sword to Carve My Forms 3', A4: '普攻·Basic: Sword to Carve My Forms 4',
      H: '重击·Heavy: Sword to Carve My Forms', E: '共鸣技能·Skill 1: Sword to Bear Their Names',
      P1: '普攻·Basic: Plunging Attack 1', P2: '普攻·Basic: Plunging Attack 2', P3: '普攻·Basic: Plunging Attack 3',
      I: "变奏入场·Intro: Sword to Mark Tide's Trace", fI: '变奏入场·Intro 2: Sword to Call for Freedom',
      fA1: '普攻·Basic: Tempest 1', fA2: '普攻·Basic: Tempest 2', fA3: '普攻·Basic: Tempest 3', fA4: '普攻·Basic: Tempest 4', fA5: '普攻·Basic: Tempest 5',
      fM1: '普攻·Basic: Tempest 1 (Mid-Air)', fM2: '普攻·Basic: Tempest 2 (Mid-Air)', fM3: '普攻·Basic: Tempest 3 (Mid-Air)', fUp: '普攻·Basic: Tempest Upward Cut',
      avC: '普攻·Basic: Sword to Carve My Forms 2', avF: '普攻·Basic: Tempest 2',
      fH: '重击·Heavy: Tempest 1', fHH: '重击·Heavy: Tempest 2', fE1: "共鸣技能·Skill 2: Sword to Answer Waves' Call", fE2: '共鸣技能·Skill 3: May Tempest Break the Tides',
      R: "共鸣解放·Liberation: A Knight's Heartfelt Prayers", kanchao: '共鸣解放·Liberation: Blade of Howling Squall',
    },
    resources: [
      { key: 'jy', name: '决意', max: 120, segmented: false, confidence: 'low', basis: '上限 120（描述）；获取量估计' },
      { key: 'er', name: '风蚀效应（目标，动作结束时）', max: 6, segmented: true, confidence: 'low', basis: '引擎异常层快照' },
      { key: 'xh', name: '显化（秒）', max: 12, segmented: false, confidence: 'high', get: (cs, t) => (F(cs, t) ? +(cs.xh - t).toFixed(2) : 0) },
      { key: 'sw', name: '剑之影', max: 3, segmented: true, confidence: 'high', get: (cs, t) => swords(cs, t).length },
      { key: 'hearts', name: '之心/之意/之力', max: 3, segmented: true, confidence: 'high', get: (cs) => cs.hearts.length },
    ],
    kit(H) {
      const ch = H.chain, K = {};
      const c2 = ch >= 2 ? { scale: { '*': 1.5 }, inferred: '链2：卡提希娅普攻/重击/变奏倍率 ×1.5' } : {};
      const c2p = ch >= 2 ? { scale: { '*': 3 }, inferred: '链2：空中攻击倍率 ×3' } : {};
      for (let k = 1; k <= 4; k++) K['A' + k] = H.act(Object.assign({ key: 'A' + k, cls: 'A', skill: 1, labels: ['第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.33, 0.82, 1.0, 1.03][k - 1] }, c2));
      for (let k = 1; k <= 5; k++) K['fA' + k] = H.act({ key: 'fA' + k, cls: 'A', skill: 6, labels: ['普攻第' + CN[k - 1] + '段伤害'], levelKey: 'forte', ownStage: true, dur: [0.35, 0.92, 0.98, 1.0, 0.83][k - 1] });
      // 空中攻击·芙露德莉斯（耐力：空中攻击第N段耐力消耗 5/5/30，表）与上挑
      [5, 5, 30].forEach((sta, i) => { K['fM' + (i + 1)] = H.act({ key: 'fM' + (i + 1), cls: 'A', skill: 6, labels: ['空中攻击第' + CN[i] + '段伤害'], levelKey: 'forte', dur: [0.8, 1.18, 0.8][i], label: '空中攻击·芙露德莉斯第' + CN[i] + '段', extra: { stamina: H.param(6, '空中攻击第' + CN[i] + '段耐力消耗') || sta } }); });
      K.fUp = H.act({ key: 'fUp', cls: 'A', skill: 6, labels: ['上挑攻击伤害'], levelKey: 'forte', dur: 0.65, label: '上挑攻击·芙露德莉斯' });
      // 化身切换：施放对应形态的普攻第2段（命中行同普攻第2段）
      K.avC = H.act(Object.assign({ key: 'avC', cls: 'R', skill: 1, labels: ['第二段伤害'], levelKey: 'basic', dur: 0.82, label: '化身·卡提希娅（普攻第2段）' }, c2));
      K.avF = H.act({ key: 'avF', cls: 'R', skill: 6, labels: ['普攻第二段伤害'], levelKey: 'forte', dur: 0.92, label: '化身·芙露德莉斯（普攻第2段）' });
      // 「可以在空中施放，空中施放该技能时，会施放空中攻击·卡提希娅 / 空中攻击·芙露德莉斯第1段」
      ['', '一', '二', '三'].forEach((n, i) => { K['avP' + i] = H.act(Object.assign({ key: 'avP' + i, cls: 'R', skill: 1, labels: [n ? '空中攻击回收' + n + '剑' : '空中攻击'], levelKey: 'basic', dur: [0.75, 0.75, 0.85, 0.85][i], label: '化身·卡提希娅（空中攻击' + (n ? '·回收' + n + '剑' : '') + '）' }, c2p)); });
      K.avFM = H.act({ key: 'avFM', cls: 'R', skill: 6, labels: ['空中攻击第一段伤害'], levelKey: 'forte', dur: 0.8, label: '化身·芙露德莉斯（空中攻击第1段）' });
      ['一', '二', '三'].forEach((n, i) => { K['P' + (i + 1)] = H.act(Object.assign({ key: 'P' + (i + 1), cls: 'A', skill: 1, labels: ['空中攻击回收' + n + '剑'], levelKey: 'basic', dur: [0.75, 0.85, 0.85][i], label: '空中攻击·回收' + n + '剑' }, c2p)); });
      Object.assign(K, {
        H: H.act(Object.assign({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.08 }, c2)),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '共鸣技能回复协奏能量', cooldown: H.param(2, '共鸣技能冷却时间') || 14, dur: 1.02 }),
        I: H.act(Object.assign({ key: 'I', cls: 'I', skill: 5, labels: ['此剑，为潮水的过去伤害'], levelKey: 'intro', concertoParam: '此剑，为潮水的过去回复协奏能量', dur: 0.93 }, c2)),
        fI: H.act({ key: 'fI', cls: 'I', skill: 5, labels: ['此剑，为自由的未来伤害'], levelKey: 'intro', concertoParam: '此剑，为自由的未来回复协奏能量', dur: 1.18 }),
        fH: H.act({ key: 'fH', cls: 'H', skill: 6, labels: ['重击伤害'], levelKey: 'forte', dur: 0.85 }),
        fHH: H.act({ key: 'fHH', cls: 'H', skill: 6, labels: ['强化重击伤害'], levelKey: 'forte', dur: 1.12 }),
        fE1: H.act({ key: 'fE1', cls: 'E', skill: 6, labels: ['共鸣技能·此剑为潮浪之意伤害'], levelKey: 'forte', concertoParam: '共鸣技能·此剑为潮浪之意回复协奏能量', dur: 0.92 }),
        fE2: H.act({ key: 'fE2', cls: 'E', skill: 6, labels: ['共鸣技能·凭风斩浪破敌伤害'], levelKey: 'forte', concertoParam: '共鸣技能·凭风斩浪破敌回复协奏能量', dur: 1.68 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: H.param(3, '听骑士从心祈愿冷却时间') || 25, concertoParam: '听骑士从心祈愿回复协奏能量', label: '听骑士从心祈愿', dur: 3.3 }),
        kanchao: H.act(Object.assign({ key: 'kanchao', cls: 'R', skill: 3, labels: ['看潮怒风哮之刃伤害'], levelKey: 'liberation', cdKey: 'kanchao', cooldown: H.param(3, '看潮怒风哮之刃冷却时间') || 25, concertoParam: '看潮怒风哮之刃回复协奏能量', dur: 5.02 },
          ch >= 3 ? { scale: { '*': 2 }, inferred: '链3：看潮倍率 ×2' } : {})),
      });
      H.patchBuff((b) => /以风刻痕留蚀/.test(b.src || ''), { mode: 'module' }, '模块：按目标风蚀层数');
      H.patchBuff((b) => b.kind === 'outro' && b.stats.some((s) => s.key === 'deep:aero'), { mode: 'module', target: 'others' }, '模块：延奏时对其他队员施加（需目标有异常效应）');
      H.mem._ctOutro = (H.findBuff((b) => b.kind === 'outro' && b.stats.some((s) => s.key === 'deep:aero'))[0] || {}).id;
      H.patchBuff((b) => b.kind === 'chain' && /决意】达到30/.test(b.text || ''), { mode: 'module' }, '模块：决意阈值计层');
      H.patchBuff((b) => b.kind === 'chain' && /全属性伤害加成提升20%/.test(b.text || ''), { mode: 'auto', target: 'team', duration: 20, trigger: { on: 'anomalyTeam', kinds: ['any'] } }, '模块：任一队员附加异常效应后（引擎 anomalyTeam 触发）');
      if (H.weaponId === SIG) H.patchBuff((b) => b.kind === 'weapon' && /无视目标8%防御/.test(b.text || ''), { mode: 'module' }, '模块：15 秒窗口 + 风蚀≥1 判定');
      return K;
    },
    init(api) {
      const st = api.H.opts.start || {};
      return { jy: 0, er: 0, xh: null, paused: null, air: false, mst: 0, hT: -1, xhEnd: null, sw: { shen: null, ren: null, yi: null }, hearts: [], st: 0, fst: 0, last: null, e2Until: null, fEready: 0,
        jyMarks: 0, c1Until: null, wUntil: null, c2: false, erCap: api.H.opts.erosionCap || (api.H.chain >= 2 ? 6 : 3), ext: api.H.opts.anomaly === 'external' || !!st.anomaly };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      if (F(cs, t)) {
        switch (btn) {
          case 'A':
            if (cs.air) return { act: K['fM' + Math.min(3, cs.mst + 1)] };
            if (cs.last === 'fHH') return { act: K.fUp };
            return { act: K['fA' + ((cs.fst % 5) + 1)] };
          case 'H': if (cs.air) return { act: K.fM3 }; return { act: cs.last === 'fH' ? K.fHH : K.fH };
          case 'E': if (on(cs.e2Until, t)) return { act: K.fE2 }; if (cs.fEready > t + 1e-9) return null; return { act: K.fE1 };
          case 'R': return cs.jy >= 120 - 1e-9 ? { act: K.kanchao } : { act: cs.air ? K['avP' + swords(cs, t).length] : K.avC };
          case 'I': return { act: K.fI };
          case 'O': return { act: { key: 'O', cls: 'O', skill: 11, hits: [], label: '听风潮为你祝颂' } };
          case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
          default: return null;
        }
      }
      switch (btn) {
        case 'A': return { act: K['A' + ((cs.st % 4) + 1)] };
        case 'H': { const n = swords(cs, t).length; return { act: on(cs.sw.yi, t) && n ? K['P' + n] : K.H }; }
        case 'E': return { act: K.E };
        case 'R': return cs.paused != null ? { act: K.avF } : { act: K.R };   // 卡提希娅形态无空中状态建模（avFM 仅供手动/扩展）
        case 'I': return { act: K.I };
        case 'O': return { act: { key: 'O', cls: 'O', skill: 11, hits: [], label: '听风潮为你祝颂' } };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [];
      const er = ER(api), ch = api.H.chain;
      if (er >= 1) out.push({ key: 'dmg:all', value: 0.3 + 0.1 * Math.min(3, Math.max(0, er - 3)) });
      if (api.H.weaponId === SIG && on(cs.wUntil, t)) { out.push({ key: 'defIgnore', value: 0.08 }); if (er >= 1) out.push({ key: 'deep:all', value: 0.2 }); }
      if (act.key === 'kanchao') out.push({ key: 'deep:all', value: 0.2 * Math.min(5, ch >= 6 ? cs.erCap : er) });
      const fForm = /^f|^kanchao$|^avF/.test(act.key || '');
      if (fForm && ch >= 6) out.push({ key: 'deep:all', value: 0.4 });
      if (fForm && ch >= 1 && on(cs.c1Until, t) && cs.jyMarks) out.push({ key: 'critDmg', value: 0.25 * cs.jyMarks });
      return out;
    },
    addEr(api, n) { api.addAnomaly('erosion', n, { cap: api.cs.erCap }); },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd, k = act.key, ch = api.H.chain;
      const g = Object.assign({}, GAIN, api.H.opts.gain || {});
      // 普攻段数衔接：变奏/下落/化身·卡提希娅 → 普攻第2段；fI/化身·芙露德莉斯 → 第2段（化身本身即第2段，下一下为第3段）；fE2/空中3 → 第3段
      if (/^A\d$/.test(k)) cs.st = +k.slice(1) % 4; else if (k === 'I' || /^P\d$/.test(k) || /^avP\d$/.test(k)) cs.st = 1; else if (k === 'avC') cs.st = 2; else cs.st = 0;
      if (/^fA\d$/.test(k)) cs.fst = +k.slice(2) % 5; else if (k === 'fE2' || k === 'fM3' || k === 'avF') cs.fst = 2; else if (k === 'fI') cs.fst = 1; else cs.fst = 0;
      // 空中状态：fE1（技能将自身托起）/上挑/空中1、2 段 → 空中；fE1/fE2 在空中重置空中段数；空中3段、fE2、其余动作 → 落地
      if (k === 'fE1' || k === 'fUp') { cs.air = true; cs.mst = 0; } else if (k === 'avFM') { cs.air = true; cs.mst = 1; } else if (k === 'fM1' || k === 'fM2') { cs.air = true; cs.mst = +k.slice(2); } else { cs.air = false; cs.mst = 0; }
      if (k === 'I' || k === 'H' || k === 'fI' || /^(A\d|fA\d|P\d|fM\d|fUp|avC|avF|avFM|avP\d)$/.test(k)) cs.wUntil = t + 15; // 武器：变奏或普攻后 15 秒（重击/下落/E 均为普攻伤害；按“普攻”类按键计，中）
      switch (k) {
        case 'A4': this.addEr(api, 1); cs.sw.shen = te + 20; break;
        case 'H': cs.sw.yi = te + 20; break;
        case 'E': this.addEr(api, 2); cs.sw.ren = te + 20; break;
        case 'I': this.addEr(api, 2); cs.sw.yi = te + 20; break;
        case 'P1': case 'P2': case 'P3': case 'avP0': case 'avP1': case 'avP2': case 'avP3': {
          if (k.startsWith('avP')) { cs.paused = Math.max(0, cs.xh - t); cs.xh = null; }
          const got = swords(cs, t);
          // 显化暂停期间回收：与已有之心合并；否则（上次显化已结束）重新获得
          cs.hearts = cs.paused != null ? Array.from(new Set(cs.hearts.concat(got))) : got; cs.hT = t;
          cs.sw = { shen: null, ren: null, yi: null };
          if (ch >= 2) api.ms.cd.E = Math.max(t, (api.ms.cd.E || 0) - got.length);
          break;
        }
        case 'R':
          if (cs.xhEnd != null && cs.hT < cs.xhEnd) cs.hearts = [];   // 之心在上次显化结束时已移除
          cs.xh = te + 12; cs.xhEnd = cs.xh; cs.paused = null; cs.jy = 0; cs.jyMarks = 0; cs.fst = 0; if (ch >= 2) cs.c2 = true; break;
        case 'avC': cs.paused = Math.max(0, cs.xh - t); cs.xh = null; break;                    // 暂停显化计时
        case 'avF': case 'avFM': cs.xh = te + (cs.paused || 0); cs.xhEnd = cs.xh; cs.paused = null; break;   // 恢复
        case 'kanchao': cs.xh = null; cs.xhEnd = t; cs.paused = null; cs.jy = 0; cs.hearts = []; cs.c1Until = null; cs.jyMarks = 0; if (ch >= 6) this.addEr(api, cs.erCap); else api.clearAnomaly('erosion'); break;
        case 'fE1': cs.e2Until = te + 3; break;
        case 'fE2': cs.e2Until = null; cs.fEready = te + 14; break;
        default: break;
      }
      if (k === 'fE1') cs.fEready = te + 3 + 14; // 不接凭风斩浪时窗口结束后进入冷却（推断）
      if (k === 'fA5' || k === 'fE2' || k === 'fHH' || k === 'fM2') {
        if (ch >= 3 && k !== 'fM2') this.addEr(api, 2);
        // 「普攻第5段，空中攻击第2段，凭风斩浪破敌…立刻结算1次【风蚀效应】，结算完成后会使当前【风蚀效应】层数减少1层」
        if (k !== 'fHH' && ER(api) > 0) api.detonateAnomaly('erosion', { kind: 'settle', remove: 1, label: '立刻结算' });
      }
      // 链2「施放共鸣解放后…自身技能下一次直接造成伤害后，附加3层【风蚀效应】，并立刻结算1次…此次结算不消耗层数」
      if (cs.c2 && k !== 'R' && act.hits && act.hits.length) { cs.c2 = false; this.addEr(api, 3); api.detonateAnomaly('erosion', { kind: 'settle', remove: 0, label: '链2结算' }); }
      cs.er = ER(api);
      if (g[k] && F(cs, t)) {
        const before = cs.jy; cs.jy = Math.min(120, cs.jy + g[k]);
        const marks = Math.floor(cs.jy / 30) - Math.floor(before / 30);
        if (marks > 0 && ch >= 1) { if (!on(cs.c1Until, t)) { cs.jyMarks = 0; cs.c1Until = t + 15; } cs.jyMarks = Math.min(4, cs.jyMarks + marks); }
      }
      cs.last = k;
    },
    // 芙露德莉斯显化期间（在场）：「目标【风蚀效应】触发的间隔减少50%，并使目标受到的【风蚀效应】伤害加深50%」
    // 需【神权之意】（描述：「当【芙露德莉斯】拥有【神权之意】和【显化】状态时」）
    anomalyPeriodScale(api, type, t) { return type === 'erosion' && F(api.cs, t) && api.cs.hearts.includes('shen') && api.onField ? 0.5 : 1; },
    anomalyStats(api, type) { return type === 'erosion' && F(api.cs, api.t) && api.cs.hearts.includes('shen') && api.onField ? [{ key: 'deep:anomaly:erosion', value: 0.5 }] : []; },
    onOutro(api) {
      const cs = api.cs, id = api.mem._ctOutro;
      if (!id || !(cs.ext || api.anomaly('any') > 0)) return;
      api.ctx.members.forEach((_, j) => { if (j !== api.mi) api.fireBuff(id, j, { duration: 20 }); });
    },
    swapOut(api) { api.cs.e2Until = null; api.cs.air = false; api.cs.mst = 0; return {}; },
    // search heuristic (not a game rule): progress toward 看潮 (决意) and stored erosion / swords
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const kc = api.est(K.kanchao);
      // 看潮进度：已有决意 + 剩余显化时间内可得决意（约 12/秒，Prydwen 循环 ≈120/9 秒）
      const rem = F(cs, t) ? cs.xh - t : cs.paused != null ? cs.paused : 0;
      const reach = rem > 0 || cs.jy >= 120 ? Math.min(1, (cs.jy + 12 * rem) / 120) : 0;
      return 0.9 * reach * kc + ER(api) * 0.03 * kc + swords(cs, t).length * 0.15 * api.est(K.P3);
    },
  });
});
