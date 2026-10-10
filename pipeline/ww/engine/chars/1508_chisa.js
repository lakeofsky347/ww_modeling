/*
 * 千咲 (1508) character module — worker-B.
 *
 * 普攻 俱寂 (1004201): 2 段 →「施放普攻第2段后…短按普攻，将会施放纷裂贯穿」→「在地面施放该技能后…短按普攻，将会施放断命之铗」（共鸣解放伤害，期间按普攻额外伤害）→「断命之铗剪出后…短按普攻，将会施放撤弦」
 * 共鸣技能 碎面构图 (1004202): 解弦之眼 35.79%（冷却 12）；「在地面且【锯环残响】充满时，共鸣技能替换为齿轨轮回…施放该技能后，进入电锯模式」
 * 共鸣解放 即刻·归无 (1004203): 954.29%（消耗 125，冷却 25）「施放时进入万缕·汇终，持续15秒。万缕·汇终：锯环·疾攻、电锯模式·闪避反击、锯环·终结伤害倍率提升120%。
 *   锯环·疾攻、电锯模式·闪避反击消耗【锯环残响】提供的锯环·终结倍率增加效果提升120%。施放锯环·终结后提前结束万缕·汇终。」
 * 共鸣回路 解弦视界·万理归尘 (1004207):
 *   「虚无绞痕：共鸣技能命中目标 / 施放齿轨轮回一定时间内命中目标…附加虚无绞痕，持续30秒。拥有虚无绞痕的目标受到角色直接造成的伤害时，千咲为目标附加1层虚湮效应，该效果每2秒最多触发1次。」
 *   「虚湮之线：对拥有虚无绞痕的目标造成伤害时，可无视其18%防御。」
 *   「锯环·疾攻…最多3段…伤害为共鸣解放伤害。锯环·终结…退出电锯模式并清空【锯环残响】…每消耗1点【锯环残响】，可增加下一次锯环·终结伤害倍率（2.59%），最多计入100点。」
 *   「【锯环残响】上限100点。常态攻击、共鸣技能解弦之眼命中目标时，获得…施放共鸣解放即刻·归无时，获得40点…施放变奏技能鸣响·再临时，获得20点。」
 *   → 常态攻击/解弦之眼的残响获取量、疾攻各段消耗量未公开：估计（低，module.gain / module.drain）
 *   → 电锯热力/熄火、命弦·掠行、闪避反击不建模（木桩，持续输出）
 * 延奏 解弦式第零定律 (1004209):「附近队伍中所有角色获得拖曳终焉之弦，持续20秒：攻击命中后，使目标【异常效应】、【电磁爆发】层数上限增加3层，持续15秒…
 *   附加【异常效应】或造成异常效应伤害后，获得虚湮之线，持续15秒。」
 *   → 延奏后 15 秒内队伍附加的异常：api.raiseAnomalyCap(type, 3, 到期)（核心 B5 已完成；含虚湮）
 *   → 虚湮之线：延奏 20 秒内、目标有虚无绞痕时，全队 defIgnore 18%（按“已附加异常”近似；中）
 * 固有：终点在此处 变奏/共鸣解放后湮灭 +20% 12 秒（解析）；无解的命途/解弦视界（击败目标）不建模
 * 共鸣链：1 附加虚无绞痕时攻击 +30% 15 秒（模块）、固定伤害 61803（单目标一次，模块：首次附加时）；2 无视 10% 湮灭抗性（模块）、虚湮之线时全队全伤 +50%（模块光环）；
 *   3 疾攻/终结倍率 +120%、残响加成 +120%（与万缕叠加，模块）；4 虚湮附加间隔 1 秒；5 共鸣解放伤害 +100%；6 虚无绞痕·终焉：目标受异常伤害 +30%、受千咲伤害 +40%（模块）
 * 专武 昙切 (21010056)：「施放变奏技能或附加【异常效应】时，自身共鸣解放伤害加成提升8%，可叠加3层，持续15秒。该效果叠加至满层时，队伍中的角色附加【异常效应】时，该角色全属性伤害加成提升24%，持续15秒」
 *   → 第二句解析为 3 层团队（错误）→ 模块：满层后对附加异常的队员单独施加 24%（maxStacks 1）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21010056;
  const GAIN = { A1: 6, A2: 10, fl: 14, ds: 18, cx: 10, H: 8, E: 12 };
  const DRAIN = { b1: 20, b2: 40, b3: 40 };
  return WW.registerChar({
    id: 1508, chainModeled: 6, name: '千咲', version: '0.1', confidence: 'medium',
    notes: ['锯环残响：常态攻击获取 / 疾攻各段消耗为估计（低）', '虚无绞痕下，任意队员直接伤害 → 每 2 秒（链4: 1 秒）附加 1 层虚湮（引擎 bane 异常：减防）',
      '延奏「异常层数上限 +3」：模块直接改当前异常上限（工作区，CORE_CHANGES worker-B）', '电锯热力/熄火、命弦·掠行、闪避反击不建模'],
    audit: { role: 'support', finishers: ['er', 'lib'], window: 25, sig: SIG, alts: [21010015, 21010045, 21010074], solo: 'chisa_solo.json', team: 'team_cartethyia_chisa.json', teamMi: 2, anomaly: 'bane' },
    frames: {
      // n1/n2：action_frames 为 null（两来源不一致）→ 模块用 WuwaLAB 0.383/0.917s
      fl: '普攻·Basic: Rending Lunge', ds: '普攻·Basic: Death Snip With Spread', cx: '普攻·Basic: Thread Withdrawn',
      hv: '重击·Heavy: Reign of Silence', eye: '共鸣技能·Skill 1: Eye of Unraveling', gl: '共鸣技能·Skill 2: Serrated Loop (Hold)',
      b1: '共鸣回路·Forte: Sawring Blitz 1', b2: '共鸣回路·Forte: Sawring Blitz 2 (Hold)', b3: '共鸣回路·Forte: Sawring Blitz 3 (Hold)', er: '共鸣回路·Forte: Sawring Eradication',
      lib: '共鸣解放·Liberation: Moment of Nihility', I: '变奏入场·Intro: Reverberance Return',
    },
    resources: [
      { key: 'sr', name: '锯环残响', max: 100, segmented: false, confidence: 'low' },
      { key: 'saw', name: '电锯模式', max: 1, segmented: true, confidence: 'medium', get: (cs) => (cs.saw ? 1 : 0) },
      { key: 'mark', name: '虚无绞痕（秒）', max: 30, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.markUntil, t).toFixed(2) },
      { key: 'wl', name: '万缕·汇终（秒）', max: 15, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.wlUntil, t).toFixed(2) },
    ],
    kit(H) {
      const ch = H.chain;
      const a = (key, labels, o) => H.act(Object.assign({ key, cls: 'A', skill: 1, labels, levelKey: 'basic', ownStage: true }, o));
      const K = {
        n1: a('n1', ['第一段伤害'], { dur: 0.38 }), n2: a('n2', ['第二段伤害'], { dur: 0.92 }),
        fl: a('fl', ['纷裂贯穿伤害'], { dur: 1.33, label: '俱寂·纷裂贯穿' }),
        ds: a('ds', ['断命之铗伤害', '断命之铗额外伤害'], { dur: 1.27, label: '俱寂·断命之铗' }),
        cx: a('cx', ['撤弦伤害'], { dur: 0.93, label: '俱寂·撤弦' }),
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.73 }),
        eye: H.act({ key: 'eye', cls: 'E', skill: 2, labels: ['解弦之眼伤害'], levelKey: 'skill', cooldown: 12, cdKey: 'E', dur: 0.33, label: '解弦之眼' }),
        gl: H.act({ key: 'gl', cls: 'E', skill: 2, labels: ['齿轨轮回伤害', '齿轨轮回长按伤害'], levelKey: 'skill', dur: 2.9, label: '齿轨轮回（长按）' }),
        b1: H.act({ key: 'b1', cls: 'A', skill: 6, labels: ['锯环·疾攻第一段伤害'], levelKey: 'forte', ownStage: true, dur: 0.52 }),
        b2: H.act({ key: 'b2', cls: 'A', skill: 6, labels: ['锯环·疾攻第二段长按伤害'], levelKey: 'forte', ownStage: true, dur: 1.4, label: '锯环·疾攻第二段（长按）' }),
        b3: H.act({ key: 'b3', cls: 'A', skill: 6, labels: ['锯环·疾攻第三段长按伤害'], levelKey: 'forte', ownStage: true, dur: 1.65, label: '锯环·疾攻第三段（长按）' }),
        er: H.act({ key: 'er', cls: 'A', skill: 6, labels: ['锯环·终结伤害'], levelKey: 'forte', concertoParam: '锯环·终结回复协奏能量', ownStage: true, dur: 2.6 }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 3.67, label: '即刻·归无' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 0.92 }),
        O: B.outro(H, '解弦式第零定律'),
      };
      const pp = (H.skill(6).params || []).find((p) => p.label === '每点【锯环残响】增加倍率');
      H.mem._srPer = pp ? parseFloat(pp.values[Math.min(pp.values.length - 1, (H.level.forte || 10) - 1)]) / 100 : 0.0259;
      if (H.weaponId === SIG) {
        B.patch(H, /该效果叠加至满层时，队伍中的角色附加【异常效应】时/, { mode: 'module', maxStacks: 1, trigger: { on: 'manual' } }, '模块：满层后对附加异常的队员施加 24%', 'weapon');
        H.mem._wTeam = H.findBuff((b) => b.kind === 'weapon' && /dmg:allElement/.test(JSON.stringify(b.stats || [])) ).map((b) => b.id);
      }
      return K;
    },
    fillerKeys: ['n1', 'n2', 'fl', 'ds', 'cx'],
    init(api) { const st = api.H.opts.start || {}; return { sr: st.sr || 0, saw: false, bs: 0, used: 0, st: 0, markUntil: null, baneNext: 0, wlUntil: null, oUntil: null, capUntil: null, capSet: {}, c1Done: false, c1Until: null, wst: [] }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t, ch = api.H.chain;
      const wl = on(cs.wlUntil, t);
      const mult = 1 + (wl ? 1.2 : 0) + (ch >= 3 ? 1.2 : 0);
      switch (btn) {
        case 'A': {
          if (cs.saw) {
            if (cs.bs >= 3 || cs.sr <= 1e-9) {
              const used = Math.min(100, cs.used);
              const er = K.er, main = er.hits[er.hits.length - 1];
              const ex = Object.assign({}, main, { label: '残响加成×' + Math.round(used), multiplier: main.multiplier.map(() => used * api.H.mem._srPer * mult) });
              return { act: Object.assign({}, er, { hits: er.hits.concat([ex]), scale: mult !== 1 ? { '*': mult } : null, label: '锯环·终结（残响 ' + Math.round(used) + '）' }) };
            }
            const b = K['b' + (cs.bs + 1)];
            return { act: mult !== 1 ? Object.assign({}, b, { scale: { '*': mult }, inferred: '万缕·汇终/链3 ×' + mult.toFixed(1) }) : b };
          }
          return { act: K[['n1', 'n2', 'fl', 'ds', 'cx'][cs.st % 5]] };
        }
        case 'H': return cs.saw ? { blocked: '电锯模式无法重击' } : { act: K.hv };
        case 'E':
          if (!cs.saw && cs.sr >= 100 - 1e-9) return { act: K.gl };
          return api.cdReady('E') ? { act: K.eye } : { blocked: '解弦之眼冷却中' };
        case 'R': return { act: ch >= 5 ? Object.assign({}, K.lib, { scale: { '*': 2 }, inferred: '链5 共鸣解放伤害加成 +100%（按倍率近似）' }) : K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const out = [], cs = api.cs, ch = api.H.chain;
      if (ch >= 2) out.push({ key: 'resShred:havoc', value: 0.1 });
      if (ch >= 6 && on(cs.markUntil, api.t)) out.push({ key: 'deep:all', value: 0.4 });
      return out;
    },
    auras(api, target) {
      const cs = api.cs, t = api.t, out = [];
      const thread = on(cs.oUntil, t) && on(cs.markUntil, t);
      if (thread) { out.push({ key: 'defIgnore', value: 0.18 }); if (api.H.chain >= 2) out.push({ key: 'dmg:all', value: 0.5 }); }
      if (target === api.mi && on(cs.c1Until, t)) out.push({ key: 'atkPct', value: 0.3 });
      if (api.H.chain >= 6 && on(cs.markUntil, t)) out.push({ key: 'deep:anomaly', value: 0.3 });
      return out;
    },
    mark(api, te) {
      const cs = api.cs;
      cs.markUntil = te + 30;
      if (api.H.chain >= 1) {
        cs.c1Until = te + 15;
        if (!cs.c1Done) { cs.c1Done = true; /* 固定伤害 61803（单目标一次，受目标生命上限约束）：不计入（木桩无生命值，已标注） */ }
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, g = Object.assign({}, GAIN, api.H.opts.gain || {}), d = Object.assign({}, DRAIN, api.H.opts.drain || {});
      const add = (n) => { if (!cs.saw) cs.sr = Math.min(100, cs.sr + n); };
      switch (k) {
        case 'n1': case 'n2': case 'fl': case 'ds': case 'cx': cs.st = ['n1', 'n2', 'fl', 'ds', 'cx'].indexOf(k) + 1; add(g[k] || g.A1); break;
        case 'hv': add(g.H); cs.st = 0; break;
        case 'eye': add(g.E); this.mark(api, te); if (cs.saw) cs.bs = Math.min(cs.bs, 1); break; // 电锯模式：解弦之眼后 → 疾攻第2段
        case 'gl': cs.saw = true; cs.bs = 1; cs.used = 0; this.mark(api, te); break; // 「施放该技能后…按下普攻，将会施放锯环·疾攻第2段」
        case 'b1': case 'b2': case 'b3': { const n = Math.min(cs.sr, d[k]); cs.sr -= n; cs.used += n; cs.bs = +k.slice(1); break; }
        case 'er': cs.saw = false; cs.sr = 0; cs.used = 0; cs.bs = 0; cs.st = 0; cs.wlUntil = null; break;
        case 'lib': cs.sr = Math.min(100, cs.sr + 40); cs.wlUntil = te + 15; cs.st = cs.saw ? cs.st : 1; this.wHit(api, te); break;
        case 'I': cs.sr = Math.min(100, cs.sr + 20); cs.st = cs.saw ? cs.st : 1; if (cs.saw) cs.bs = 1; this.wHit(api, te); break;
        default: break;
      }
    },
    wHit(api, t) { const cs = api.cs; cs.wst = cs.wst.filter((x) => x > t - 15).concat([t]).slice(-3); },
    onOutro(api) { api.cs.oUntil = api.t + 20; api.cs.capUntil = api.t + 15; api.cs.capSet = {}; },
    onTeam(api, ev) {
      const cs = api.cs, t = ev.t != null ? ev.t : api.t;
      if (ev.type === 'anomaly') {
        if (ev.mi === api.mi) this.wHit(api, t);
        // 昙切满层：附加异常的队员全伤 +24%
        if ((api.mem._wTeam || []).length && cs.wst.filter((x) => x > t - 15).length >= 3) for (const id of api.mem._wTeam) api.fireBuff(id, ev.mi, { duration: 15 });
        // 拖曳终焉之弦：异常层数上限 +3（工作区）
        if (on(cs.capUntil, t) && !cs.capSet[ev.kind]) { cs.capSet[ev.kind] = 1; api.raiseAnomalyCap(ev.kind, 3, cs.capUntil); }
        return;
      }
      if (ev.type !== 'damage') return;
      const a = ev.act || {};
      if (a.cls === 'Z' || /^anomaly/.test(a.key || '')) return;
      if (on(cs.markUntil, t) && t >= cs.baneNext - 1e-9) {
        cs.baneNext = t + (api.H.chain >= 4 ? 1 : 2);
        api.addAnomaly('bane', 1);
      }
    },
    // search heuristic (not a game rule): 残响 → 齿轨轮回/锯环·终结
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      const mult = 1 + (on(cs.wlUntil, t) ? 1.2 : 0);
      return (cs.saw ? 0.6 * (api.est(K.er) + Math.min(100, cs.used + cs.sr) * api.H.mem._srPer * mult * api.est(K.er) / 2.58) : cs.sr / 100 * 0.4 * api.est(K.gl))
        + (on(cs.markUntil, t) ? 0 : 0.1 * api.est(K.eye));
    },
  });
});
