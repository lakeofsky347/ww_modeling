/*
 * 赞妮 (1507) character module — worker-B.
 *
 * 普攻 例行交涉 (1003301): 4 段；「第3段普攻后恰当时机短按普攻，将施放普攻突破性进展，之后短按普攻可施放第4段普攻」→ A3 后 A = 突破性进展，再 A = 第4段
 * 共鸣技能 无眠守望 (1003302): 标准防卫预案（冷却 5，「一定时间内短按普攻可衔接普攻第3段，命中时额外获得10点【冗余动能】」）；
 *   「危机处理预案：赞妮未进入灼焰形态且【冗余动能】充满时，共鸣技能替换为…消耗全部【冗余动能】施放集中压制造成衍射伤害，此次伤害同时视为【光噪效应】伤害。
 *    施放集中压制或破袭反击时，进入斩棘状态，对命中的目标附加1层【烈阳余烬】。最后一段攻击施放后自身获得【焰光】。斩棘：自身直接造成的【光噪效应】伤害加深20%。」斩棘状态持续时间=14
 *   → 格挡/精准反击/破袭反击需要敌人攻击：不建模（木桩）
 * 共鸣解放 晨昏交替之时 (1003303): 重燃 318.52%（冷却 25，消耗 125）「进入灼焰形态，【焰光】上限从100点提升为150点，立即获得50点【焰光】。灼焰形态期间，普攻倍率提升（25%）」
 *   「灼焰形态持续期间，【焰光】低于30点时，或灼焰形态持续8秒后，共鸣解放替换为…终绝将至之刻…造成衍射伤害并退出灼焰形态。」灼焰形态持续时间=20
 * 共鸣回路 黯夜将明 (1003307):
 *   「赞妮处于编队时，附近队伍中的角色对目标附加【光噪效应】时，将立刻结算全部层数伤害并转化为相同层数的【烈阳余烬】…【烈阳余烬】层数上限为60层，每层持续6秒。」
 *   「赞妮处于灼焰形态时，解锁重斩·破晓、重斩·将明、重斩·终夜、重斩·闪裂…此次伤害为重击伤害，同时视为【光噪效应】伤害。」
 *   「【焰光】不少于30点时，普攻替换为重斩·破晓…施放重斩·破晓后若立即施放普攻，可施放普攻重斩·将明并消耗【焰光】。施放重斩·将明后，普攻替换为重斩·终夜。
 *    重斩·终夜命中时可以消耗赞妮至多40点【焰光】，每消耗1点【焰光】，使本次重斩·终夜的伤害倍率额外增加（9.95%）。」
 *   「冗余动能…常态攻击命中目标时、施放变奏技能时、施放标准防卫预案时获得…处于灼焰形态时，无法获得。」「焰光：集中压制后 +10；每1层【光噪效应】转化为【烈阳余烬】时 +5；重燃 +50。」
 *   → 重斩命中行无伤害表关联（build: multiplier only）→ 模块按描述构造：衍射、攻击缩放、重击类型（中）
 *   → 冗余动能获取量、重斩·破晓/将明的焰光消耗未公开（估计：破晓 10、将明 20；低，module.cost / module.gain）
 *   → 「同时视为【光噪效应】伤害」：按“光噪效应伤害加深/加成”同样作用于这些动作（livePanel 的 deep/dmg:anomaly[:frazzle] 计入，中）
 * 延奏 来日道标 (1003309): 「造成赞妮150%攻击的衍射伤害并清空其拥有的【烈阳余烬】。造成伤害前目标每拥有1层【烈阳余烬】受到该伤害提升10%，此次伤害同时视为【光噪效应】伤害。
 *   队伍中除赞妮以外的角色对拥有【烈阳余烬】的目标造成的衍射伤害加深20%，持续20秒。」→ 倍率 ×(1+0.1n)（模块）；加深 20% others（解析）
 * 共鸣链：1 集中压制 → 衍射 +50% 14 秒（模块触发）；2 暴击 +20%（解析）、集中压制 ×1.8；3 终绝最后一段 +8%/焰光（≤1200%，模块）；4 变奏全队攻击 +20%（解析）；5 重燃 ×2.2；6 重斩 ×1.4、每点焰光 ×1.4（焰光回满 70 未建模）。
 * 专武 焰光裁定 (21040036)：「施放普攻时…自身造成伤害无视目标8%防御，同时自身直接造成的【光噪效应】伤害加深50%，持续6秒」（解析；重斩经普攻键施放，按普攻触发）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const GAIN = { A1: 6, A2: 8, A3: 10, tp: 12, A4: 14, H: 6, E: 10, I: 15 };
  const COST = { pox: 10, jm: 20 };
  const FRZ = new Set(['jz', 'pox', 'jm', 'zy']);
  const forteHit = (H, label, extra) => {
    const h = H.skill(6).hits.find((x) => x.label === label);
    return h ? Object.assign({}, h, { type: 'heavy', element: 'spectro', scaling: 'atk', calc: 'damage', confidence: 'medium', lowReason: '命中行无 damage 表关联：类型/元素按描述「衍射伤害…此次伤害为重击伤害」' }, extra || {}) : null;
  };
  return WW.registerChar({
    id: 1507, chainModeled: 6, name: '赞妮', version: '0.1', confidence: 'medium',
    notes: ['格挡/精准反击/破袭反击不建模（无敌方攻击）', '冗余动能获取与重斩焰光消耗为估计（低）', '重斩/集中压制/延奏“同时视为光噪效应伤害”：光噪加深/加成同样计入（中）',
      '队友附加光噪时立即结算全部层数（伤害记在附加者）并转化为烈阳余烬 +5 焰光/层'],
    audit: { role: 'dps', finishers: ['zy', 'zj'], window: 25, sig: 21040036, alts: [21040015, 21040045, 21040074], solo: 'zani_solo.json', team: 'team_zani.json', teamMi: 0 },
    frames: {
      A1: '普攻·Basic: Routine Negotiation 1', A2: '普攻·Basic: Routine Negotiation 2', A3: '普攻·Basic: Routine Negotiation 3', A4: '普攻·Basic: Routine Negotiation 4',
      tp: '普攻·Basic: Breakthrough', H: '重击·Heavy: Routine Negotiation', E: '共鸣技能·Skill: Standard Defense Protocol', jz: '共鸣回路·Forte: Targeted Action',
      pox: '普攻·Basic: Heavy Slash Daybreak', jm: '普攻·Basic: Heavy Slash Dawning', zy: '普攻·Basic: Heavy Slash Nightfall',
      R: '共鸣解放·Liberation: Rekindle', zj: '共鸣解放·Liberation: The Last Stand', I: '变奏入场·Intro: Immediate Execution',
    },
    resources: [
      { key: 'rd', name: '冗余动能', max: 100, segmented: false, confidence: 'low', basis: '获取量估计' },
      { key: 'yg', name: '焰光', max: 150, segmented: false, confidence: 'medium' },
      { key: 'zy', name: '灼焰（秒）', max: 20, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.zyUntil, t).toFixed(2) },
      { key: 'ember', name: '烈阳余烬', max: 60, segmented: false, confidence: 'medium', get: (cs, t) => cs.embers.filter((e) => e.until > t).reduce((s, e) => s + e.n, 0) },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 4, durs: [0.4, 0.53, 0.95, 1.72] });
      const c6 = ch >= 6 ? { '*': 1.4 } : null;
      Object.assign(K, {
        tp: H.act({ key: 'tp', cls: 'A', skill: 1, labels: ['突破性进展伤害'], levelKey: 'basic', ownStage: true, dur: 1.83 }),
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.05 }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['标准防卫预案伤害'], levelKey: 'skill', concertoParam: '标准防卫预案回复协奏能量', cooldown: 5, cdKey: 'E', dur: 0.3 }),
        jz: H.act({ key: 'jz', cls: 'E', skill: 2, labels: ['集中压制伤害'], levelKey: 'skill', concertoParam: '集中压制回复协奏能量', dur: 2.23, scale: ch >= 2 ? { '*': 1.8 } : null }),
        pox: H.act({ key: 'pox', cls: 'A', skill: 6, hits: [forteHit(H, '重斩·破晓伤害')].filter(Boolean), levelKey: 'forte', dur: 0.52, scale: c6, label: '重斩·破晓' }),
        jm: H.act({ key: 'jm', cls: 'A', skill: 6, hits: [forteHit(H, '重斩·将明伤害')].filter(Boolean), levelKey: 'forte', dur: 1.32, scale: c6, label: '重斩·将明' }),
        zy: H.act({ key: 'zy', cls: 'A', skill: 6, hits: H.skill(6).hits.filter((x) => x.label === '重斩·终夜伤害').map((x) => forteHit(H, x.label, { multiplier: x.multiplier })), levelKey: 'forte', dur: 2.52, scale: c6, label: '重斩·终夜' }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['重燃伤害'], levelKey: 'liberation', concertoParam: '重燃回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 3.33, scale: ch >= 5 ? { '*': 2.2 } : null }),
        zj: H.act({ key: 'zj', cls: 'R', skill: 3, labels: ['终绝将至之刻伤害'], levelKey: 'liberation', concertoParam: '终绝将至之刻回复协奏能量', dur: 2.23 }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.5 }),
        O: B.outro(H, '来日道标'),
      });
      const pp = (H.skill(6).params || []).find((p) => p.label === '每点【焰光】增加倍率');
      H.mem._ygPer = pp ? parseFloat(pp.values[Math.min(pp.values.length - 1, (H.level.forte || 10) - 1)]) / 100 * (ch >= 6 ? 1.4 : 1) : 0.0995;
      B.patch(H, /施放集中压制或破袭反击时，衍射伤害加成提升50%/, { trigger: { on: 'act', keys: ['jz'] }, mode: 'auto' }, '模块：触发=集中压制', 'chain');
      // 延奏「对拥有【烈阳余烬】的目标」：施放延奏时总有余烬（清空前） → 20 秒按生效（中）
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'tp', 'A4'],
    init(api) { const st = api.H.opts.start || {}; return { rd: st.rd || 0, yg: st.yg || 0, zyUntil: null, zyStart: null, st: 0, zs: 0, ztUntil: null, embers: [], spent: 0, e3: false }; },
    embersAt(cs, t) { return cs.embers.filter((e) => e.until > t + 1e-9).reduce((s, e) => s + e.n, 0); },
    addEmbers(cs, n, t) { cs.embers = cs.embers.filter((e) => e.until > t + 1e-9); const cur = this.embersAt(cs, t); const add = Math.min(n, 60 - cur); if (add > 0) cs.embers.push({ n: add, until: t + 6 }); },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, ch = api.H.chain;
      const zy = on(cs.zyUntil, t);
      const cost = Object.assign({}, COST, api.H.opts.cost || {});
      switch (btn) {
        case 'A':
          if (zy) {
            if (cs.zs === 2) {
              const n = Math.min(40, cs.yg);
              const main = K.zy.hits[K.zy.hits.length - 1];
              const ex = main ? Object.assign({}, main, { label: '焰光加成×' + Math.round(n), multiplier: main.multiplier.map(() => n * api.H.mem._ygPer / (ch >= 6 ? 1.4 : 1)) }) : null;
              return { act: Object.assign({}, K.zy, { hits: K.zy.hits.concat(ex ? [ex] : []), label: '重斩·终夜（焰光 ' + Math.round(n) + '）' }), meta: { spend: n } };
            }
            if (cs.zs === 1 && cs.yg >= cost.jm - 1e-9) return { act: K.jm, meta: { spend: cost.jm } };
            if (cs.yg >= 30 - 1e-9) return { act: K.pox, meta: { spend: cost.pox } };
          }
          {
            const a = cs.st === 3 && !cs.tpd ? K.tp : K['A' + ((cs.st % 4) + 1)];
            // 「灼焰形态期间，普攻倍率提升（普攻倍率提升=25%）」
            return { act: zy ? Object.assign({}, a, { scale: { '*': 1.25 }, inferred: '灼焰：普攻倍率 ×1.25' }) : a };
          }
        case 'H': return { act: K.H };
        case 'E':
          if (!zy && cs.rd >= 100 - 1e-9) return { act: K.jz };
          if (zy && cs.yg >= 30 - 1e-9) return { act: K.pox, meta: { spend: cost.pox } }; // 引燃明灯（短按）→ 重斩·破晓
          return api.cdReady('E') ? { act: K.E } : { blocked: '标准防卫预案冷却中' };
        case 'R':
          if (zy && (cs.yg < 30 - 1e-9 || t >= cs.zyStart + 8 - 1e-9)) {
            const c3 = ch >= 3 ? Math.min(12, 0.08 * cs.spent) : 0;
            if (!c3) return { act: K.zj };
            const last = K.zj.hits[K.zj.hits.length - 1];
            return { act: Object.assign({}, K.zj, { hits: K.zj.hits.slice(0, -1).concat([Object.assign({}, last, { multiplier: last.multiplier.map((x) => x + c3) })]), inferred: '链3：最后一段 +' + Math.round(c3 * 100) + '%' }) };
          }
          if (zy) return { blocked: '灼焰形态（终绝将至之刻未就绪）' };
          return { act: K.R };
        case 'I': return { act: K.I };
        case 'O': { const n = this.embersAt(cs, t); return { act: n ? Object.assign({}, K.O, { scale: { '*': 1 + 0.1 * n }, inferred: '烈阳余烬 ' + n + ' 层 ×' + (1 + 0.1 * n).toFixed(1) }) : K.O }; }
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, out = [];
      const k = act.key;
      if (FRZ.has(k) || k === 'O') {
        // 「同时视为【光噪效应】伤害」→ 光噪效应伤害加深/加成同样生效（自身斩棘 20% 在下）
        const raw = api.livePanel().raw;
        const deep = (raw['deep:anomaly:frazzle'] || 0) + (raw['deep:anomaly'] || 0) + (on(cs.ztUntil, api.t) ? 0.2 : 0);
        const dmg = (raw['dmg:anomaly:frazzle'] || 0) + (raw['dmg:anomaly'] || 0);
        if (deep) out.push({ key: 'deep:all', value: deep });
        if (dmg) out.push({ key: 'dmg:all', value: dmg });
      }
      return out;
    },
    apply(api, act, meta) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd, g = Object.assign({}, GAIN, api.H.opts.gain || {});
      const zy = on(cs.zyUntil, t);
      const addRd = (n) => { if (!zy) cs.rd = Math.min(100, cs.rd + n); };
      if (/^A\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; cs.tpd = false; addRd(g[k]); }
      else if (k === 'tp') { cs.tpd = true; addRd(g.tp); }
      else if (k !== 'E') { cs.st = 0; cs.tpd = false; }
      switch (k) {
        case 'H': addRd(g.H); cs.st = 2; break; // 「重击…一定时间内短按普攻将会施放第3段普攻」
        case 'E': addRd(g.E + 10); cs.st = 2; break; // 「短按普攻可衔接普攻第3段，命中时额外获得10点」（合并计入）
        case 'I': addRd(g.I); break;
        case 'jz': cs.rd = 0; cs.yg = Math.min(zy ? 150 : 100, cs.yg + 10); cs.ztUntil = te + 14; this.addEmbers(cs, 1, te); break;
        case 'pox': cs.yg -= meta.spend; cs.spent += meta.spend; cs.zs = 1; break;
        case 'jm': cs.yg -= meta.spend; cs.spent += meta.spend; cs.zs = 2; break;
        case 'zy': cs.yg -= meta.spend; cs.spent += meta.spend; cs.zs = 0; break;
        case 'R': cs.zyUntil = te + 20; cs.zyStart = te; cs.yg = Math.min(150, cs.yg + 50); cs.zs = 0; cs.spent = 0; break;
        case 'zj': cs.zyUntil = te; cs.yg = Math.min(100, cs.yg); cs.zs = 0; break;
        default: break;
      }
      if (k !== 'pox' && k !== 'jm' && k !== 'zy' && k !== 'E') cs.zs = zy ? cs.zs : 0;
    },
    onOutro(api) { api.cs.embers = []; },
    onTeam(api, ev) {
      // 「附近队伍中的角色对目标附加【光噪效应】时，将立刻结算全部层数伤害并转化为相同层数的【烈阳余烬】」
      if (ev.type !== 'anomaly' || ev.kind !== 'frazzle') return;
      const cs = api.cs, n = ev.stacks || 0;
      if (n <= 0) return;
      api.detonateAnomaly('frazzle', { remove: 'all', owner: ev.mi, kind: 'settle', label: '烈阳余烬转化结算', t: ev.t });
      this.addEmbers(cs, n, ev.t || api.t);
      cs.yg = Math.min(on(cs.zyUntil, api.t) ? 150 : 100, cs.yg + 5 * n);
    },
    // search heuristic (not a game rule): 冗余动能 → 集中压制; 焰光 → 重斩·终夜; open 灼焰 window
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = (cs.rd / 100) * 0.5 * api.est(K.jz) + Math.min(cs.yg, 150) / 40 * 0.4 * (api.est(K.zy) + 40 * api.H.mem._ygPer * api.est(K.zy) / 4);
      if (on(cs.zyUntil, t)) v += 0.6 * api.est(K.zj);
      return v;
    },
  });
});
