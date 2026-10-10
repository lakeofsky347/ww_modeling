/*
 * 菲比 (1506) character module.
 *
 * 普攻 敬请光辉降落 (1003001): 普攻 3 段；「菲比处于【镜之环】内时，替换为夏弥尔之星…」
 * 共鸣技能 追寻光芒之所 (1003002): 冷却 12
 *   「在目标位置召唤【镜之环】…【镜之环】持续30秒」「菲比处于【镜之环】内时，普攻替换为普攻夏弥尔之星，进行最多3段的连续攻击…此次伤害为普攻伤害。」
 *   → 镜之环存在期间默认菲比位于环内（module.inRing=false 可关闭；中）；环外折射圣辉未建模
 * 共鸣解放 启明之誓愿 (1003003): 「·赦罪状态：伤害倍率提升255%。·告解状态：为命中的目标附加8层【光噪效应】。」 → 赦罪 ×3.55（倍率相对提升约定，中）
 * 共鸣回路 交错星辉的祝祷 (1003007):
 *   「若菲比【祈愿】满时，可消耗所有【祈愿】，选择两个技能中的一个施放：重击圣祷赦罪…进入更擅长输出的赦罪状态。共鸣技能显明告解…进入更擅长运用【光噪效应】的告解状态。」
 *   「赦罪状态、告解状态不能同时存在」「未消耗完所有【福音】时，无法施放重击圣祷赦罪、共鸣技能显明告解。」「消耗完所有【福音】时，不会退出赦罪或告解状态。」
 *   「重击·星辉：若菲比拥有【福音】，施放普攻第3段或闪避反击时，下一次重击替换为重击星辉。消耗30点【福音】」
 *   「·赦罪状态：施放时所消耗的【福音】减少15点，命中的目标拥有【光噪效应】时，伤害加深256%。·告解状态：为命中的目标附加5层【光噪效应】。」
 *   「【祈愿】上限120点。随时间持续获得，每秒获得5点。」「【福音】上限60点。施放重击圣祷赦罪、共鸣技能显明告解时，回复60点。」
 *   圣祷赦罪回复协奏能量=10, 显明告解回复协奏能量=40
 * 固有 启示: 「处于赦罪状态、告解状态时，衍射伤害加成提升12%。」
 * 延奏 倾听之心 (1003009): 「对周围的目标造成总计菲比攻击528.41%的衍射伤害。·赦罪状态：伤害倍率提升255%。
 *   ·告解状态：队伍中登场角色获得默祷效果：使一定范围内的目标衍射伤害抗性减少10%，【光噪效应】伤害加深100%…效果持续30秒，若菲比进入赦罪状态则该效果提前结束。」
 *   → 延奏伤害：build_ww 已把 1506201011 行关联到延奏（倍率取描述总计 528.41%，低：两条行 2.345/0.6606 凑不出 528.41%）
 *   → 默祷：衍射减抗 10% + 【光噪效应】伤害加深 100%（目标侧，30 秒）；「目标身上的【光噪效应】触发伤害后，下一次造成伤害的周期延长50%」→ anomalyPeriodScale 1.5
 * 光噪效应（目标状态）: 引擎异常效应层（buff.json：每 3 秒一跳后减 1 层，上限 10）；module.frazzle='external' 视为队友（如漂泊者·衍射）持续挂 10 层（不计其伤害）。
 * 武器 和光回唱 (21050046): 「对附加了【光噪效应】的目标造成伤害时，自身普攻、重击伤害加成提升14%，可以叠加3层，持续6秒。」（模块按动作计层）；延奏「目标受到【光噪效应】伤害加深30%」由解析器自动处理。
 * 共鸣链: 1 赦罪解放 ×5.8 / 告解解放 ×1.9 且光噪至上限；2 赦罪延奏对光噪目标加深 120%（模块）；3 星辉倍率 赦罪 ×1.91 / 告解 ×3.49；4 普攻命中衍射减抗 10%（触发改为普攻动作）；5/6 文本解析。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on, rowHit, CN } = C;
  const SIG = 21050046;
  const qyAt = (cs, t) => Math.min(120, cs.qy + 5 * Math.max(0, t - cs.qyT));
  const FZ = (api) => api.anomaly('frazzle');
  return WW.registerChar({
    id: 1506, chainModeled: 3, name: '菲比', version: '0.2', confidence: 'medium',
    notes: ['状态选择：module.state = absolution(赦罪) / confession(告解) / both（默认 both：祈愿满时 H=圣祷赦罪、E=显明告解）',
      '开局祈愿默认 120（稳态假设，module.start.qiyuan 可改）', '镜之环存在期间默认在环内（普攻=夏弥尔之星）',
      '光噪效应伤害由引擎异常效应层结算（buff.json 每层倍率/周期；乘区按 wuwa-calc-site，低）；默祷/和光回唱的光噪加深计入',
      '延奏伤害：build_ww 关联的行，倍率取描述总计 528.41%（低）', '赦罪 “伤害倍率提升255%” 按 ×3.55（中）'],
    frames: {
      A1: '普攻·Basic: O Come Divine Light 1', A2: '普攻·Basic: O Come Divine Light 2', A3: '普攻·Basic: O Come Divine Light 3',
      xA1: "普攻·Basic: Chamuel's Star 1", xA2: "普攻·Basic: Chamuel's Star 2", xA3: "普攻·Basic: Chamuel's Star 3",
      H: '重击·Heavy: O Come Divine Light', shengdao: '重击·Heavy: Absolution Litany', xinghui: '重击·Heavy: Starflash',
      E: '共鸣技能·Skill: To Where Light Shines', gaojie: '共鸣技能·Skill: Utter Confession',
      R: '共鸣解放·Liberation: Dawn of Enlightenment', I: '变奏入场·Intro: Golden Grace',
    },
    resources: [
      { key: 'qy', name: '祈愿', max: 120, segmented: false, confidence: 'high', basis: '上限 120，每秒 +5', get: (cs, t) => qyAt(cs, t) },
      { key: 'fy', name: '福音', max: 60, segmented: false, confidence: 'high' },
      { key: 'state', name: '状态', max: 2, segmented: true, confidence: 'high', basis: '1 赦罪 / 2 告解', get: (cs) => (cs.state === 'ab' ? 1 : cs.state === 'cf' ? 2 : 0) },
      { key: 'fz', name: '光噪效应（目标，动作结束时）', max: 10, segmented: false, confidence: 'low', basis: '引擎异常层快照' },
    ],
    kit(H) {
      const ch = H.chain;
      const K = {};
      for (let k = 1; k <= 3; k++) {
        K['A' + k] = H.act({ key: 'A' + k, cls: 'A', skill: 1, labels: ['第' + CN[k - 1] + '段伤害'], levelKey: 'basic', ownStage: true, dur: [0.43, 0.55, 1.0][k - 1] });
        K['xA' + k] = H.act({ key: 'xA' + k, cls: 'A', skill: 2, labels: ['夏弥尔之星第' + CN[k - 1] + '段伤害'], levelKey: 'skill', ownStage: true, dur: [0.37, 0.53, 1.02][k - 1] });
      }
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.0 }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', cooldown: H.param(2, '冷却时间') || 12, dur: 1.2 }),
        shengdao: H.act({ key: 'shengdao', cls: 'H', skill: 6, labels: ['圣祷赦罪伤害'], levelKey: 'forte', concertoParam: '圣祷赦罪回复协奏能量', dur: 1.1 }),
        gaojie: H.act({ key: 'gaojie', cls: 'E', skill: 6, labels: ['显明告解伤害'], levelKey: 'forte', concertoParam: '显明告解回复协奏能量', dur: 1.1 }),
        xinghui: H.act({ key: 'xinghui', cls: 'H', skill: 6, labels: ['重击·星辉伤害'], levelKey: 'forte', dur: 0.92 }),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', cost: H.R.energy.liberationCost, cooldown: H.param(3, '冷却时间') || 25, concertoParam: '回复协奏能量', dur: 3.7 }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.6 }),
      });
      const o11 = H.skill(11);
      const oh = o11 && o11.hits.length ? o11.hits : [rowHit(H, 11, 1506201011, { label: '倾听之心伤害', mult: 5.2841, why: '延奏描述「总计菲比攻击528.41%的衍射伤害」；倍率取描述值' })].filter(Boolean);
      K.O = H.act({ key: 'O', cls: 'O', skill: 11, hits: oh, levelKey: 'outro', label: '倾听之心', inferred: '延奏伤害：描述总计倍率（低）' });
      H.mem._pb = { r: ch >= 1 ? { ab: 5.8, cf: 1.9 } : { ab: 3.55, cf: 1 }, xh: ch >= 3 ? { ab: 1.91, cf: 3.49 } : { ab: 1, cf: 1 } };
      H.patchBuff((b) => /启示/.test(b.src || ''), { mode: 'module' }, '模块：赦罪/告解状态期间生效');
      const mds = H.findBuff((b) => b.kind === 'outro' && b.stats.some((s) => /^resShred:/.test(s.key) || s.key === 'deep:anomaly:frazzle'));
      H.patchBuff((b) => mds.includes(b), { mode: 'module', target: 'team', duration: 30 }, '模块：告解状态延奏时施加默祷（目标侧：衍射减抗 + 光噪伤害加深）');
      H.mem._pbMd = mds.map((b) => b.id);
      // 链2「告解状态下，默祷的【光噪效应】伤害加深效果额外提升120%」
      H.patchBuff((b) => b.kind === 'chain' && /默祷的【光噪效应】伤害加深效果额外提升/.test(b.text || ''), { mode: 'module', stats: [{ key: 'deep:anomaly:frazzle', value: 1.2 }], target: 'team', duration: 30 }, '模块：随默祷施加');
      H.mem._pbMdC = (H.findBuff((b) => b.kind === 'chain' && /默祷的【光噪效应】伤害加深效果额外提升/.test(b.text || ''))[0] || {}).id;
      H.patchBuff((b) => b.kind === 'chain' && /延奏技能对拥有【光噪效应】的目标伤害加深120%/.test(b.text || ''), { mode: 'module' }, '模块：赦罪延奏且目标有光噪时生效');
      H.patchBuff((b) => b.kind === 'chain' && /目标衍射伤害抗性降低10%/.test(b.text || ''), { trigger: { on: 'act', keys: ['A1', 'A2', 'A3', 'xA1', 'xA2', 'xA3'] }, mode: 'auto', target: 'team' }, '模块：触发=普攻/夏弥尔之星命中');
      if (H.weaponId === SIG) {
        const wb = H.findBuff((b) => b.kind === 'weapon' && /普攻、重击伤害加成提升/.test(b.text || ''))[0];
        if (wb) { H.patchBuff((b) => b === wb, { mode: 'module' }, '模块：对光噪目标造成伤害时按动作计层'); H.mem._pbW = wb.stats[0].value; }
      }
      return K;
    },
    init(api) {
      const st = api.H.opts.start || {};
      if (api.H.opts.frazzle === 'external') api.addAnomaly('frazzle', 10, { external: true });
      return { qy: st.qiyuan != null ? st.qiyuan : 120, qyT: 0, fy: 0, state: null, xing: false, ring: null, st: 0, fz: 0, mdUntil: null, wh: 0, whUntil: null, obo: false };
    },
    allowed(api, s) { const o = api.H.opts.state || 'both'; return o === 'both' || (o === 'absolution' ? s === 'ab' : s === 'cf'); },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, pb = api.mem._pb;
      const inRing = on(cs.ring, t) && api.H.opts.inRing !== false;
      const full = qyAt(cs, t) >= 120 - 1e-9 && cs.fy <= 1e-9;
      switch (btn) {
        case 'A': { const p = inRing ? 'xA' : 'A'; return { act: K[p + ((cs.st % 3) + 1)] }; }
        case 'H': {
          if (cs.xing && cs.fy > 1e-9) {
            const s = cs.state || 'none', f = pb.xh[s] || 1;
            return { act: f !== 1 ? Object.assign({}, K.xinghui, { scale: { '*': f }, inferred: '链3：星辉倍率' }) : K.xinghui, meta: { s } };
          }
          if (full && this.allowed(api, 'ab')) return { act: K.shengdao };
          return { act: K.H };
        }
        case 'E': return (full && this.allowed(api, 'cf')) ? { act: K.gaojie } : { act: K.E };
        case 'R': {
          const f = cs.state ? pb.r[cs.state] : 1;
          return { act: f !== 1 ? Object.assign({}, K.R, { scale: { '*': f }, label: K.R.label + (cs.state === 'ab' ? '（赦罪）' : '（告解）'), inferred: cs.state === 'ab' ? '赦罪：倍率 ×3.55' : '链1：告解倍率' }) : K.R, meta: { s: cs.state } };
        }
        case 'I': return { act: K.I };
        case 'O': return { act: cs.state === 'ab' ? Object.assign({}, K.O, { scale: { '*': 3.55 }, label: '倾听之心（赦罪）', inferred: '赦罪：延奏倍率 ×3.55' }) : K.O };
        case 'Q': return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, out = [];
      const fz = FZ(api) > 0;
      if (act.key === 'xinghui' && cs.state === 'ab' && fz) out.push({ key: 'deep:all', value: 2.56 });
      if (api.mem._pbW && on(cs.whUntil, t) && cs.wh) out.push({ key: 'dmg:basic', value: api.mem._pbW * cs.wh }, { key: 'dmg:heavy', value: api.mem._pbW * cs.wh });
      return out;
    },
    auras(api, target) {
      const cs = api.cs, out = [];
      if (target !== api.mi) return out;
      if (cs.state) out.push({ key: 'dmg:spectro', value: 0.12 }); // 固有 启示
      if (cs.obo && api.H.chain >= 2 && cs.state === 'ab' && FZ(api) > 0) out.push({ key: 'deep:all', value: 1.2 }); // 链2：仅延奏结算瞬间（swapOut→onOutro）
      return out;
    },
    apply(api, act) {
      const cs = api.cs, t = api.t, te = api.tEnd, k = act.key;
      const hadFz = FZ(api) > 0;
      const addFz = (n) => api.addAnomaly('frazzle', n);
      if (/^x?A\d$/.test(k)) { const n = +k.slice(-1); cs.st = n % 3; if (n === 3 && cs.fy > 1e-9) cs.xing = true; }
      else cs.st = 0;
      switch (k) {
        case 'E': cs.ring = te + 30; break;
        case 'shengdao': case 'gaojie':
          cs.qy = 0; cs.qyT = t; cs.fy = 60; addFz(1);
          cs.state = k === 'shengdao' ? 'ab' : 'cf';
          if (cs.state === 'ab') { for (const id of api.mem._pbMd.concat(api.mem._pbMdC || [])) api.ctx.members.forEach((_, j) => api.endBuff(id, j)); cs.mdUntil = null; }
          break;
        case 'xinghui': cs.fy = Math.max(0, cs.fy - (cs.state === 'ab' ? 15 : 30)); cs.xing = false; if (cs.state === 'cf') addFz(5); break;
        case 'R': if (cs.state === 'cf') addFz(api.H.chain >= 1 ? api.anomalyCap('frazzle') : 8); break;
        default: break;
      }
      cs.fz = FZ(api);
      if (act.hits.length && api.mem._pbW && hadFz) { cs.wh = Math.min(3, (on(cs.whUntil, t) ? cs.wh : 0) + 1); cs.whUntil = te + 6; }
    },
    swapOut(api) { api.cs.obo = true; return {}; },
    onOutro(api) {
      const cs = api.cs; cs.obo = false;
      if (cs.state === 'cf' && api.mem._pbMd.length) {
        for (const id of api.mem._pbMd.concat(api.H.chain >= 2 && api.mem._pbMdC ? [api.mem._pbMdC] : [])) api.ctx.members.forEach((_, j) => api.fireBuff(id, j, { duration: 30 }));
        cs.mdUntil = api.t + 30;
      }
    },
    // 默祷：「目标身上的【光噪效应】触发伤害后，【光噪效应】下一次造成伤害的周期延长50%」
    anomalyPeriodScale(api, type, t) { return type === 'frazzle' && on(api.cs.mdUntil, t) ? 1.5 : 1; },
    onTeam(api, ev) { if (ev.type === 'intro' || ev.type === 'swap') api.cs.obo = false; },
    // search heuristic (not a game rule): value of 福音 (星辉) and an almost-full 祈愿
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      return (cs.fy / 30) * 0.5 * api.est(K.xinghui) * (cs.state === 'ab' ? 2 : 1) + (qyAt(cs, t) / 120) * 0.3 * api.est(K.shengdao) + (cs.fy > 0 ? (cs.xing ? 0.6 : cs.st * 0.2) * api.est(K.xinghui) * (cs.state === 'ab' && FZ(api) > 0 ? 3.56 : 1) : 0);
    },
  });
});
