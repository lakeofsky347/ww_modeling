/*
 * 爱弥斯 (1210) character module.
 *
 * 常态攻击 校准无垠 (1004601): 普攻·爱弥斯 4 段；「重击·爱弥斯…一段蓄力…二段蓄力…处于即刻响应状态时，可快速完成二段蓄力…该技能伤害为共鸣解放伤害。」
 *   「施放重击·爱弥斯·一段蓄力后…普攻·爱弥斯第2段。施放重击·爱弥斯·二段蓄力后…普攻·爱弥斯第3段。」
 *   → 非即刻响应时 H = 一段蓄力（二段蓄力需长按，帧数据缺失，不建模；中）；即刻响应时 H = 二段蓄力
 * 共鸣技能 共赴长航 (1004602): 构型切换（自动接普攻第1段，冷却 1 秒）；
 *   「施放普攻·爱弥斯第2段、第3段、第4段、重击·爱弥斯…后…短按共鸣技能可施放合击·突刺·兵装融合…施放该技能后切换至机兵形态…普攻·机兵第2段。」（启明之音反之）
 *   → E 优先级：光翼共奏（满足条件）> 合击（上一动作为本形态普攻2-4段或重击）> 构型切换
 * 共鸣解放 飞至启明之时 (1004603):
 *   过载：「切换至机兵形态…星屑共振状态，持续30秒。星辉破界而来·于此释放状态，持续60秒。」 消耗共鸣能量=125, 冷却 25
 *   「处于星辉破界而来·于此释放状态，【共鸣率】达到上限时，获得即刻响应状态。」
 *   终结：「同时满足…于此释放…【同步率】达到上限…【共鸣率】达到上限…消耗全部【同步率】、【共鸣率】，移除…于此释放状态与光翼共奏之时状态…切换至爱弥斯形态。」冷却 25
 * 共鸣回路 为寂静赋形 (1004607):
 *   「施放普攻·爱弥斯第4段、普攻·机兵第4段时，获得光翼共奏之时，持续5秒。」
 *   「处于光翼共奏之时状态且【同步率】不少于100点时，短按共鸣技能可施放共鸣技能光翼共奏·降临（爱弥斯形态）/登台（机兵形态），消耗100点【同步率】…本次伤害为共鸣解放伤害…切换至机兵/爱弥斯形态」
 *   【同步率】上限 200：普攻/合击造成伤害时获得（数值不在描述中 → 原始 damage.json SpecialEnergy2/100：
 *     爱弥斯 A1 3.29 A2 6.44 A3 16.66 A4 23.31；机兵 A1 6.45 A2 9.6 A3 19.88 A4 23.28；兵装融合 19.79；启明之音 22.18；中）；
 *     「施放变奏技能…获得40点」「施放过载时，获得30点」「同时处于即刻响应状态与…于此释放状态，施放…二段蓄力时，可获得200点」
 *   【共鸣率】上限 4：「光翼共奏 +1」「过载 +1」「流光增幅状态下过载额外 +1」
 *   共鸣模态·聚爆（默认，module.mode='burst'）：A3/A4（两形态）、合击、变奏 命中时附加 1 层【聚爆效应】（同技能 3 秒 1 次不建模）；
 *     「敌人【聚爆效应】层数为0，将对目标附加1层」（在场动作时补 1 层）；「层数大于5层时，根据【聚爆效应】层数上限引爆…并移除层数」→ detonateAbove 5（倍率取上限层）；
 *     「附加【聚爆效应】时，附加1层聚爆轨迹，上限30层」；光翼共奏「若目标拥有聚爆轨迹…根据层数上限引爆，不移除层数…每层轨迹倍率 +10%」，星屑共振 +200%（链2 15%/400%）；
 *     链6 聚爆伤害可暴击（固定 80% / 275%）、轨迹翻倍、上限 60。
 *   共鸣模态·震谐（module.mode='tune'）：光翼共奏额外 5 次（星屑共振 10 次）震谐伤害 109.35%（震谐轨迹倍率提升不计；低）
 * 固有 于万籁之前: 「处于即刻响应状态时，重击·爱弥斯、重击·机兵造成的伤害加深200%。」
 * 固有 星与星之间（聚爆）: 「队伍中的角色附加【聚爆效应】时，爱弥斯暴击伤害提升30%，最多可叠加2层。该效果每名角色仅可触发1次。达到2层时，终结伤害加深25%。」
 *   → 层数 = 爱弥斯自身（附加后）+ module.burstAppliers（其他会附加聚爆的队友数，默认 0）
 * 变奏 航程伊始的预兆: 「施放时获得流光增幅状态，持续15秒。」
 * 延奏 不可见的守候: 「队伍中除爱弥斯以外的角色全伤害加深10%，持续20秒。角色附加【聚爆效应】时…提升至20%。」 → 解析为 self；模块对其他队员施加 10%（低：20% 需队友附加聚爆）
 * 武器 永远的启明星 (21020076): 「附加震谐·偏移或聚爆效应时，共鸣解放伤害无视目标32%防御，共鸣解放伤害无视目标10%热熔抗性，持续8秒。」 → 模块：仅共鸣解放类动作
 * 共鸣链: 2 光翼共奏 ×2；3 终结 ×2、过载 ×1.4，星与星之间改为暴击伤害 +60% 与终结加深 25%；4 全队全属性 +20%（变奏/合击/光翼共奏，30 秒）；6 共鸣解放伤害加深 40%。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, CN } = C;
  const SIG = 21020076;
  const SYNC = { pA1: 3.29, pA2: 6.44, pA3: 16.66, pA4: 23.31, mA1: 6.45, mA2: 9.6, mA3: 19.88, mA4: 23.28, heP: 19.79, heM: 22.18 };
  const BURST_KEYS = new Set(['pA3', 'pA4', 'mA3', 'mA4', 'heP', 'heM', 'I', 'mI', 'fsP3', 'fsM3']);
  const LIB_KEYS = new Set(['pH', 'mH', 'pH2', 'mH2', 'gyP', 'gyM', 'R', 'fin']);
  return WW.registerChar({
    id: 1210, chainModeled: 6, name: '爱弥斯', version: '0.2', confidence: 'medium',
    notes: ['默认共鸣模态·聚爆；聚爆效应（>5 层自动引爆、光翼共奏轨迹引爆）由引擎异常效应层结算（低：乘区按 wuwa-calc-site）', '同步率获取量取原始 damage.json SpecialEnergy2（中）',
      '非即刻响应时 H 为一段蓄力；二段蓄力只在即刻响应时使用', '星与星之间层数：实际附加过聚爆的队员数（引擎 anomaly 事件）+ module.burstAppliers', '延奏：其他队员全伤害加深 10%（附加聚爆的队友 20% 未区分）'],
    frames: {
      pA1: '普攻·Basic: Aemeath 1', pA2: '普攻·Basic: Aemeath 2', pA3: '普攻·Basic: Aemeath 3', pA4: '普攻·Basic: Aemeath 4',
      mA1: '普攻·Basic: Mech 1', mA2: '普攻·Basic: Mech 2', mA3: '普攻·Basic: Mech 3', mA4: '普攻·Basic: Mech 4',
      pH2: '重击·Heavy: Aemeath Charged 2 (Instant Response)', mH2: '重击·Heavy: Mech Charged 2 (Instant Response)',
      heP: '共鸣技能·Skill: Sync Strike (Armament Merge)', heM: '共鸣技能·Skill: Sync Strike (Call of Dawn)',
      gyP: '共鸣回路·Forte: Seraphic Duet - Overture', gyM: '共鸣回路·Forte: Seraphic Duet - Encore',
      R: '共鸣解放·Liberation: Heavenfall Edict - Overdrive', fin: '共鸣解放·Liberation: Heavenfall Edict - Finale',
      I: '变奏入场·Intro: Songs Across the Universe', mI: '变奏入场·Intro 2: Debut of Meteoric Radiance',
      fsP1: '普攻·Basic: Aemeath 1', fsM1: '普攻·Basic: Mech 1',
    },
    resources: [
      { key: 'sync', name: '同步率', max: 200, segmented: false, confidence: 'medium' },
      { key: 'rr', name: '共鸣率', max: 4, segmented: true, confidence: 'high' },
      { key: 'form', name: '形态', max: 2, segmented: true, confidence: 'high', basis: '1 爱弥斯 / 2 机兵', get: (cs) => (cs.form === 'P' ? 1 : 2) },
      { key: 'rel', name: '于此释放（秒）', max: 60, segmented: false, confidence: 'high', get: (cs, t) => (on(cs.rel, t) ? +(cs.rel - t).toFixed(1) : 0) },
      { key: 'gy', name: '光翼共奏之时', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.gy, t) ? 1 : 0) },
      { key: 'trail', name: '聚爆轨迹', max: 60, segmented: false, confidence: 'medium', get: (cs, t) => (on(cs.trailUntil, t) ? cs.trail : 0) },
    ],
    kit(H) {
      const ch = H.chain, K = {};
      for (let k = 1; k <= 4; k++) {
        K['pA' + k] = H.act({ key: 'pA' + k, cls: 'A', skill: 1, labels: ['普攻·爱弥斯第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.38, 0.72, 0.77, 1.0][k - 1] });
        K['mA' + k] = H.act({ key: 'mA' + k, cls: 'A', skill: 2, labels: ['普攻·机兵第' + CN[k - 1] + '段伤害'], levelKey: 'skill', ownStage: true, dur: [0.55, 0.78, 1.07, 1.03][k - 1] });
      }
      // 构型切换：自动施放新形态普攻第1段（冷却 1 秒）
      K.fsP1 = Object.assign({}, K.pA1, { key: 'fsP1', cls: 'E', cdKey: 'formSwitch', cooldown: 1, label: '构型切换→普攻·爱弥斯第1段', cast: 'E' });
      K.fsM1 = Object.assign({}, K.mA1, { key: 'fsM1', cls: 'E', cdKey: 'formSwitch', cooldown: 1, label: '构型切换→普攻·机兵第1段', cast: 'E' });
      const x2 = (f, why) => (f !== 1 ? { scale: { '*': f }, inferred: why } : {});
      Object.assign(K, {
        pH: H.act({ key: 'pH', cls: 'H', skill: 1, labels: ['重击·爱弥斯·一段蓄力伤害'], levelKey: 'basic', dur: 1.1, inferred: '一段蓄力动作时长无帧数据（估 1.1 秒）' }),
        mH: H.act({ key: 'mH', cls: 'H', skill: 2, labels: ['重击·机兵·一段蓄力伤害'], levelKey: 'skill', dur: 1.0, inferred: '一段蓄力动作时长无帧数据（估 1.0 秒）' }),
        pH2: H.act({ key: 'pH2', cls: 'H', skill: 1, labels: ['重击·爱弥斯·二段蓄力伤害'], levelKey: 'basic', dur: 1.58 }),
        mH2: H.act({ key: 'mH2', cls: 'H', skill: 2, labels: ['重击·机兵·二段蓄力伤害'], levelKey: 'skill', dur: 0.93 }),
        heP: H.act({ key: 'heP', cls: 'E', skill: 2, labels: ['合击·突刺·兵装融合伤害'], levelKey: 'skill', dur: 1.32 }),
        heM: H.act({ key: 'heM', cls: 'E', skill: 2, labels: ['合击·突刺·启明之音伤害'], levelKey: 'skill', dur: 1.2 }),
        gyP: H.act(Object.assign({ key: 'gyP', cls: 'E', skill: 6, labels: ['光翼共奏·降临伤害'], levelKey: 'forte', dur: 3.0 }, x2(ch >= 2 ? 2 : 1, '链2：光翼共奏倍率 ×2'))),
        gyM: H.act(Object.assign({ key: 'gyM', cls: 'E', skill: 6, labels: ['光翼共奏·登台伤害'], levelKey: 'forte', dur: 2.42 }, x2(ch >= 2 ? 2 : 1, '链2：光翼共奏倍率 ×2'))),
        gyX: H.act({ key: 'gyX', cls: 'E', skill: 6, labels: ['光翼共奏追加伤害（每次）'], levelKey: 'forte', label: '光翼共奏·震谐追加', inferred: '震谐模态追加伤害（低）' }),
        R: H.act(Object.assign({ key: 'R', cls: 'R', skill: 3, labels: ['星辉破界而来·过载伤害'], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: 25, concertoParam: '星辉破界而来·过载回复协奏能量', dur: 4.37 }, x2(ch >= 3 ? 1.4 : 1, '链3：过载 ×1.4'))),
        fin: H.act(Object.assign({ key: 'fin', cls: 'R', skill: 3, labels: ['星辉破界而来·终结伤害'], levelKey: 'liberation', cdKey: 'fin', cooldown: 25, concertoParam: '星辉破界而来·终结回复协奏能量', dur: 5.67 }, x2(ch >= 3 ? 2 : 1, '链3：终结 ×2'))),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['以旋律穿越长空伤害'], levelKey: 'intro', concertoParam: '以旋律穿越长空回复协奏能量', dur: 1.2 }),
        mI: H.act({ key: 'mI', cls: 'I', skill: 5, labels: ['携星辉降临于此伤害'], levelKey: 'intro', concertoParam: '携星辉降临于此回复协奏能量', dur: 1.23 }),
      });
      H.patchBuff((b) => b.kind === 'inherent' || /于万籁之前|星与星之间/.test(b.src || ''), { mode: 'module' }, '模块：即刻响应 / 聚爆层数判定');
      H.patchBuff((b) => b.kind === 'outro', { mode: 'module' }, '模块：延奏时对除爱弥斯外的队员施加');
      const outs = H.findBuff((b) => b.kind === 'outro' && b.stats.length);
      H.mem._amOutro = { tune: outs[0] && outs[0].id, burst: (outs[1] || outs[0] || {}).id };
      H.patchBuff((b) => b.kind === 'chain' && /全属性伤害加成提升20%/.test(b.text || ''), { mode: 'auto', target: 'team', duration: 30, trigger: { on: 'act', keys: ['I', 'mI', 'heP', 'heM', 'gyP', 'gyM'] } }, '模块：触发=变奏/合击/光翼共奏');
      H.patchBuff((b) => b.kind === 'chain' && /共鸣解放伤害提升40%/.test(b.text || ''), { mode: 'module' }, '模块：仅共鸣解放类动作');
      // 武器 永远的启明星：解析器给出 defIgnore:liberation / resPen:fusion:liberation，触发 = 自身附加聚爆（引擎 anomaly 事件），无需模块处理
      return K;
    },
    init(api) {
      const o = api.H.opts;
      return { form: 'P', st: 0, last: null, sync: (o.start && o.start.sync) || 0, rr: 0, gy: null, lg: null, rel: null, instant: false, xc: 0,
        appliers: {}, trail: 0, trailUntil: null, mode: o.mode === 'tune' ? 'tune' : 'burst', others: Math.max(0, o.burstAppliers || 0) };
    },
    canCombo(cs) { const p = cs.form === 'P' ? 'p' : 'm'; return cs.last === p + 'A2' || cs.last === p + 'A3' || cs.last === p + 'A4' || cs.last === p + 'H' || cs.last === p + 'H2'; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, P = cs.form === 'P';
      switch (btn) {
        case 'A': return { act: K[(P ? 'pA' : 'mA') + ((cs.st % 4) + 1)] };
        case 'H': return { act: cs.instant ? (P ? K.pH2 : K.mH2) : (P ? K.pH : K.mH) };
        case 'E':
          if (on(cs.gy, t) && cs.sync >= 100 - 1e-9) return { act: P ? K.gyP : K.gyM };
          if (this.canCombo(cs)) return { act: P ? K.heP : K.heM };
          return { act: P ? K.fsM1 : K.fsP1 };
        case 'R':
          if (on(cs.rel, t)) return (cs.sync >= 200 - 1e-9 && cs.rr >= 4) ? { act: K.fin } : null;
          return { act: K.R };
        case 'I': return { act: P ? K.I : K.mI };
        case 'O': return { act: { key: 'O', cls: 'O', skill: 11, hits: [], label: '不可见的守候' } };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    stacks(cs) { return Object.keys(cs.appliers).length + cs.others; },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [], k = act.key, ch = api.H.chain;
      const n = Math.min(2, this.stacks(cs));
      if (cs.mode === 'burst' && n) out.push({ key: 'critDmg', value: ch >= 3 ? 0.6 : 0.3 * n });
      if (k === 'fin' && cs.mode === 'burst' && (ch >= 3 ? n >= 1 : n >= 2)) out.push({ key: 'deep:all', value: 0.25 });
      if ((k === 'pH2' || k === 'mH2') && cs.instant) { out.push({ key: 'deep:all', value: 2 }); if (ch >= 1) out.push({ key: 'critDmg', value: 3 }); }
      if (LIB_KEYS.has(k)) {
        if (ch >= 6) out.push({ key: 'deep:all', value: 0.4 });
      }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd, k = act.key, ch = api.H.chain;
      const add = (v) => { cs.sync = Math.min(200, cs.sync + v); };
      const addRR = (v) => { const was = cs.rr; cs.rr = Math.min(4, cs.rr + v); if (cs.rr >= 4 && was < 4 && on(cs.rel, t)) cs.instant = true; };
      if (SYNC[k] != null) add(SYNC[k]);
      if (k === 'fsP1' || k === 'fsM1') add(SYNC[k === 'fsP1' ? 'pA1' : 'mA1']);
      const m = /^([pm])A(\d)$/.exec(k);
      cs.st = m ? +m[2] % 4 : 0;
      switch (k) {
        case 'pA4': case 'mA4': cs.gy = te + 5; break;
        case 'fsP1': cs.form = 'P'; cs.st = 1; break;
        case 'fsM1': cs.form = 'M'; cs.st = 1; break;
        case 'pH': case 'mH': cs.st = 1; break;
        case 'pH2': case 'mH2':
          cs.st = 2;
          if (cs.instant) { if (on(cs.rel, t)) add(200); cs.instant = false; }
          break;
        case 'heP': cs.form = 'M'; cs.st = 1; break;
        case 'heM': cs.form = 'P'; cs.st = 1; break;
        case 'gyP': case 'gyM':
          cs.sync -= 100; cs.gy = null; cs.form = k === 'gyP' ? 'M' : 'P'; cs.st = 1; addRR(1);
          if (cs.mode === 'tune') api.deal(api.mem.modKit.gyX, { count: cs.xc > 0 ? 10 : 5 });
          else if (on(cs.trailUntil, t) && cs.trail > 0 && api.anomaly('burst') > 0) {
            // 光翼共奏引爆：按层数上限、每层轨迹 +10%（链2 15%）、星屑共振 +200%（链2 400%），不移除层数
            const f = 1 + cs.trail * (ch >= 2 ? 0.15 : 0.1) + (cs.xc > 0 ? (ch >= 2 ? 4 : 2) : 0);
            api.detonateAnomaly('burst', { stacks: 'cap', scale: f, remove: 0, label: '光翼共奏引爆（轨迹' + cs.trail + '）' });
            cs.trail = 0; cs.trailUntil = null;
          }
          if (cs.xc > 0) cs.xc -= 1;
          break;
        case 'R': {
          add(30); cs.rel = te + 60; cs.xc = 2; cs.form = 'M'; cs.st = 1;
          const extra = on(cs.lg, t) ? 1 : 0; cs.lg = null; addRR(1 + extra);
          break;
        }
        case 'fin': cs.sync = 0; cs.rr = 0; cs.rel = null; cs.gy = null; cs.instant = false; cs.form = 'P'; cs.st = 0; break;
        case 'I': case 'mI': add(40); cs.lg = te + 15; cs.st = 2; break;
        default: break;
      }
      if (cs.mode === 'burst') {
        const applies = BURST_KEYS.has(k) || (ch >= 3 && (k === 'pH2' || k === 'mH2'));
        // 场上规则：目标聚爆层数为 0 时附加 1 层；>5 层时按上限引爆并移除
        const n = (applies ? 1 : 0) + (api.onField && api.anomaly('burst') === 0 && act.hits && act.hits.length && !applies ? 1 : 0);
        if (n) api.addAnomaly('burst', n, { detonateAbove: 5 });
      }
      cs.last = k;
    },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type !== 'anomaly' || ev.kind !== 'burst' || cs.mode !== 'burst') return;
      cs.appliers[ev.mi] = true;
      const ch = api.H.chain, cap = ch >= 6 ? 60 : 30;
      cs.trail = Math.min(cap, (on(cs.trailUntil, ev.t) ? cs.trail : 0) + (ch >= 6 ? 2 : 1) * (ev.added || 1)); cs.trailUntil = ev.t + 30;
    },
    // 链6「聚爆效应触发的伤害可暴击，暴击固定为80%，暴击伤害固定为275%」
    anomalyCrit(api, type) { return type === 'burst' && api.H.chain >= 6 && api.cs.mode === 'burst' ? { rate: 0.8, dmg: 2.75 } : null; },
    onOutro(api) {
      const cs = api.cs, o = api.mem._amOutro, id = cs.mode === 'tune' ? o.tune : o.burst;
      if (!id) return;
      api.ctx.members.forEach((_, j) => { if (j !== api.mi) api.fireBuff(id, j, { duration: 20 }); });
    },
    // search heuristic (not a game rule): progress toward 终结 (同步率/共鸣率) and 光翼共奏
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const fin = api.est(K.fin), gy = api.est(K.gyP);
      const relOn = on(cs.rel, t);
      const trailV = cs.mode === 'burst' && on(cs.trailUntil, t) ? 0.5 * (cs.sync / 100) * cs.trail * 0.1 * api.anomalyMult('burst', 10) * 3674 * 0.4 : 0;
      return trailV + (relOn ? 0.2 * cs.rr * fin + 0.2 * (cs.sync / 200) * fin + (cs.instant ? 0.3 * fin : 0) : 0) + (cs.sync / 100) * 0.4 * gy + (on(cs.gy, t) && cs.sync >= 100 ? 0.3 * gy : 0) + (on(cs.lg, t) && !relOn ? 0.1 * fin : 0);
    },
  });
});
