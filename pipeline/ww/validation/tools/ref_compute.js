#!/usr/bin/env node
'use strict';
/*
 * 参考计算器公式的忠实移植 + 用例期望值生成（只读调用引擎，不修改 engine/）。
 *  A = wuwa-tools  src/lib/calc/damage.ts  (commit 73e1961, 2026-10-06)
 *  B = wuwa-calc-site site/src/logic/CombatCalculator.ts (commit ec00eed, 2026-10-09)，数据 wuwa-calc-data (ac8ecba)
 * 输入：cases.draft.json（tools/gen_cases.py）+ out/draft_run.json（引擎 --json 结果）
 * 输出：cases.json（带 expect 与 _ref）、out/ref_values.json
 */
const fs = require('fs'), path = require('path');
const V = path.resolve(__dirname, '..');
const E = require(path.join(V, '../engine/ww_engine.js'));
const data = JSON.parse(fs.readFileSync(path.join(V, '../../out/ww.json'), 'utf8'));
const idx = E.indexData(data);

// ---------------- A：wuwa-tools damage.ts（逐行翻译，去掉类型标注） ----------------
const A = (() => {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const safe = (v) => (Number.isFinite(v) ? v : 0);
  function baseDamage(atk, mv, flat) { return (atk * mv) / 100 + flat; }
  function enemyBaseDef(enemyLevel) { return 792 + 8 * enemyLevel; }
  function defFactor(attackerLevel, enemyLevel, defReduction = 0, defIgnore = 0) {
    const enemyDef = enemyBaseDef(enemyLevel);
    const modifiedDef = enemyDef * (1 - defReduction) * (1 - defIgnore);
    const attackerDefTerm = 800 + 8 * attackerLevel;
    return { enemyDef, modifiedDef, attackerDefTerm, factor: attackerDefTerm / (modifiedDef + attackerDefTerm) };
  }
  function resFactor(effectiveRes) {
    if (effectiveRes < 0) return 1 - effectiveRes / 2;
    if (effectiveRes < 0.8) return 1 - effectiveRes;
    return 1 / (1 + 5 * effectiveRes);
  }
  function avgCritMultiplier(critRate, critDmg) { return 1 + clamp(critRate, 0, 1) * (critDmg - 1); }
  function calculateDamage(i) {
    const baseDmg = baseDamage(i.atk, i.mv, i.flatDmg);
    const bonusPool = 1 + i.elementBonus + i.typeBonus + i.generalBonus + i.combatBonus;
    const amplifyMultiplier = 1 + i.amplify;
    const specialMultiplier = 1 + i.special;
    const def = defFactor(i.attackerLevel, i.enemyLevel, i.defReduction, i.defIgnore);
    const effectiveRes = i.baseRes - i.resShred;
    const res = resFactor(effectiveRes);
    const critMultiplier = i.critDmg;
    const avgMult = avgCritMultiplier(i.critRate, i.critDmg);
    const common = baseDmg * bonusPool * amplifyMultiplier * specialMultiplier * def.factor * res;
    return { baseDmg: safe(baseDmg), bonusPool, amplifyMultiplier, specialMultiplier, defFactor: def.factor, effectiveRes, resFactor: res,
      avgCritMultiplier: avgMult, critDamage: safe(common * critMultiplier), nonCritDamage: safe(common), avgDamage: safe(common * avgMult) };
  }
  return { calculateDamage };
})();

// ---------------- B：wuwa-calc-site CombatCalculator.ts（相关纯函数逐行翻译） ----------------
const B = (() => {
  const LEVEL_CAP = 90; // SIM_CONSTANTS.LEVEL_CAP：unitLvl 固定取 90（L465）
  const critMultiplier = (critRate, critDamage) => { const cr = Math.min(1, Math.max(0, critRate)); return (1 - cr) + cr * critDamage; };
  const calcDefense = (unitLevel, enemyLevel, ignoreDef = 0, reduceDef = 0) => {
    const k = (800 + 8 * unitLevel) / ((792 + 8 * enemyLevel) * (1 - ignoreDef) * (1 - reduceDef) + 800 + 8 * unitLevel);
    return Math.max(0, k);
  };
  const calcResistance = (baseRes, ignoreRes = 0, reduceRes = 0) => {
    const effectiveRes = baseRes - ignoreRes - reduceRes;
    return effectiveRes > 0 ? 1 - effectiveRes : 1 - (effectiveRes / 2);
  };
  const calcStandardDmg = (baseDmg, critMult, dmgBonus, dmgAmp, dmgTaken, multiMult, resMult, defMult) =>
    baseDmg * critMult * dmgBonus * (1 + dmgAmp) * (1 + dmgTaken) * (1 + multiMult) * resMult * defMult;
  // L442-449：面板组装（ATK 双重取整；talentAtkPct 单独取整）
  function scalars(s) {
    const rawBaseAtk = s.baseAtk, talentPctDecimal = s.talentAtkPct, generalAtkPctDecimal = s.percentAtk - s.talentAtkPct;
    const totalAtk = Math.floor((Math.floor(rawBaseAtk) * (1 + generalAtkPctDecimal)) + Math.floor(Math.floor(rawBaseAtk) * talentPctDecimal) + s.flatAtk);
    const totalHP = s.baseHP * (1 + s.percentHP) + s.flatHP;
    const totalDef = s.baseDef * (1 + s.percentDef) + s.flatDef;
    return { atk: totalAtk, hp: totalHP, def: totalDef };
  }
  function instance(h) { // 对应 calculateDamageInstance 的 Standard 分支
    const baseDmg = (h.pctMult * h.scalingStatVal) + h.flatMult;
    const defMult = calcDefense(LEVEL_CAP, h.enemyLevel, h.ignoreDef, h.reduceDef);
    const resMultiplier = calcResistance(h.baseRes, h.ignoreRes, h.reduceRes);
    const critMult = critMultiplier(h.critRate, h.critDamage);
    const dmgBonusTotal = 1 + h.dmgBonus;
    const total = calcStandardDmg(baseDmg, critMult, dmgBonusTotal, h.dmgAmp, h.dmgTaken, 0, resMultiplier, defMult);
    const nonCrit = calcStandardDmg(baseDmg, 1.0, dmgBonusTotal, h.dmgAmp, h.dmgTaken, 0, resMultiplier, defMult);
    const crit = calcStandardDmg(baseDmg, h.critDamage, dmgBonusTotal, h.dmgAmp, h.dmgTaken, 0, resMultiplier, defMult);
    return { total, nonCrit: Math.floor(nonCrit), crit: Math.floor(crit), defMult, resMultiplier, critMult, ampMult: (1 + h.dmgAmp) * (1 + h.dmgTaken) };
  }
  return { scalars, instance, LEVEL_CAP };
})();

// ---------------- 用引擎（只读）复现 CLI probe 的面板 ----------------
function probePanel(c) {
  const ctx = E.buildContext(c, idx);
  const p = c.probe, mi = p.member || 0, mem = ctx.members[mi];
  const buffs = [];
  for (const m of ctx.members) for (const b of m.buffDefs) {
    if (b.unmodeled) continue;
    const forced = (p.buffs || []).includes(b.id);
    const staticOn = b.mode === 'on' && (b.target === 'team' || (b.target === 'incoming' ? b.owner !== mi : b.owner === mi));
    if (forced || staticOn) for (const s of b.stats) buffs.push({ key: s.key, value: s.value * (forced || b.trigger.on !== 'always' ? b.maxStacks || 1 : 1) });
  }
  for (const s of p.extraStats || []) buffs.push({ key: E.panelKey(s.key, mem.el) || s.key, value: s.value });
  const panel = E.finalPanel(mem, buffs);
  return { mem, panel, ctx };
}

const draft = JSON.parse(fs.readFileSync(path.join(V, 'cases.draft.json'), 'utf8'));
const run = JSON.parse(fs.readFileSync(path.join(V, 'out/draft_run.json'), 'utf8'));
const out = [];
draft.cases.forEach((c0, ci) => {
  const c = Object.assign({}, JSON.parse(JSON.stringify(draft.defaults)), JSON.parse(JSON.stringify(c0)));
  c.enemy = Object.assign({}, draft.defaults.enemy, c0.enemy || {});
  const r = run[ci];
  const { mem, panel } = probePanel(c);
  const raw = panel.raw;
  // B 的“天赋 ATK%”= 技能树固定 ATK%（与回声/武器分开取整）
  const Rdat = data.resonators.find((x) => x.id === c.team[0].id);
  const nodeAtk = (Rdat && Rdat.statNodeTotals && Rdat.statNodeTotals['Atk%']) || 0;
  const bStats = B.scalars({ baseAtk: mem.base.atk, talentAtkPct: nodeAtk, percentAtk: raw.atkPct || 0, flatAtk: raw.atkFlat || 0,
    baseHP: mem.base.hp, percentHP: raw.hpPct || 0, flatHP: raw.hpFlat || 0, baseDef: mem.base.def, percentDef: raw.defPct || 0, flatDef: raw.defFlat || 0 });
  const en = c.enemy, attackerLevel = mem.level || c.team[0].level || 90;
  const split = c.refSplit || null;
  let sumA = { expected: 0, crit: 0, noncrit: 0 }, sumB = { expected: 0, crit: 0, noncrit: 0 }, sumO = r.sum;
  const hits = r.hits.map((h) => {
    const z = Object.fromEntries(h.zones.map((x) => [x.key, x]));
    const stat = z.base.stat, statVal = z.base.value, flat = z.base.flat || 0, mvTotal = z.multiplier.value; // 已乘段数
    const res = z.resistance;
    const amp = z.deepen.value - 1;
    const a = A.calculateDamage({ attackerLevel, enemyLevel: en.level, atk: statVal, critRate: z.crit.critRate, critDmg: z.crit.critDmg,
      mv: mvTotal * 100, flatDmg: flat, elementBonus: z.bonus.value - 1, typeBonus: 0, generalBonus: 0, combatBonus: 0,
      amplify: amp, special: 0, defReduction: en.defReduce || 0, defIgnore: en.defIgnore || 0, baseRes: res.baseRes, resShred: res.shred });
    const bStat = stat === 'hp' ? bStats.hp : stat === 'def' ? bStats.def : bStats.atk;
    const b = B.instance({ pctMult: mvTotal, scalingStatVal: bStat, flatMult: flat, enemyLevel: en.level, ignoreDef: en.defIgnore || 0, reduceDef: en.defReduce || 0,
      baseRes: res.baseRes, ignoreRes: 0, reduceRes: res.shred, critRate: z.crit.critRate, critDamage: z.crit.critDmg, dmgBonus: z.bonus.value - 1,
      dmgAmp: split ? split.amplify : amp, dmgTaken: split ? split.taken : 0 });
    sumA.expected += a.avgDamage; sumA.crit += a.critDamage; sumA.noncrit += a.nonCritDamage;
    sumB.expected += b.total; sumB.crit += b.crit; sumB.noncrit += b.nonCrit;
    return { label: h.label, ours: { expected: h.total.expected, stat: statVal, mv: mvTotal, bonus: z.bonus.value, deepen: z.deepen.value, crit: z.crit.value, defense: z.defense.value, resistance: res.value, effRes: res.effectiveRes },
      A: { expected: a.avgDamage, stat: statVal, bonus: a.bonusPool, deepen: a.amplifyMultiplier, crit: a.avgCritMultiplier, defense: a.defFactor, resistance: a.resFactor },
      B: { expected: b.total, stat: bStat, bonus: z.bonus.value, deepen: b.ampMult, crit: b.critMult, defense: b.defMult, resistance: b.resMultiplier } };
  });
  out.push({ name: c.name, isolates: c.isolates, ours: sumO, A: sumA, B: sumB, panel: { ours: { atk: panel.atk, hp: panel.hp, def: panel.def }, B: bStats, nodeAtkPct: nodeAtk }, hits });
  const caseOut = JSON.parse(JSON.stringify(c0));
  delete caseOut.refSplit;
  caseOut.expect = { tolerancePct: 0.5, expected: +sumA.expected.toFixed(1), crit: +sumA.crit.toFixed(1), noncrit: +sumA.noncrit.toFixed(1) };
  caseOut._ref = { 'A_wuwa-tools': { expected: +sumA.expected.toFixed(1), crit: +sumA.crit.toFixed(1), noncrit: +sumA.noncrit.toFixed(1) },
    'B_wuwa-calc-site': { expected: +sumB.expected.toFixed(1), crit: sumB.crit, noncrit: sumB.noncrit, note: 'B 的 crit/noncrit 为逐段 Math.floor 后求和；面板 ATK 按 B 的取整规则重算' },
    ...(split ? { B_split: split } : {}) };
  draft.cases[ci] = caseOut;
});
draft['_说明'] = 'WW 引擎交叉验证用例。expect.* = wuwa-tools（参考 A）公式在完全相同输入下的值，容差 0.5%；_ref 同时给出 wuwa-calc-site（参考 B）。生成：tools/gen_cases.py → 引擎跑 draft → tools/ref_compute.js。';
fs.writeFileSync(path.join(V, 'cases.json'), JSON.stringify(draft, null, 1));
fs.writeFileSync(path.join(V, 'out/ref_values.json'), JSON.stringify(out, null, 1));
const pct = (x, y) => ((x / y - 1) * 100).toFixed(3) + '%';
for (const o of out) console.log(`${o.name}\n  ours ${o.ours.expected.toFixed(1)} | A ${o.A.expected.toFixed(1)} (${pct(o.ours.expected, o.A.expected)}) | B ${o.B.expected.toFixed(1)} (${pct(o.ours.expected, o.B.expected)}) | atk ours ${o.panel.ours.atk.toFixed(2)} B ${o.panel.B.atk} hp ${o.panel.ours.hp.toFixed(1)}/${o.panel.B.hp.toFixed(1)} nodeAtk ${o.panel.nodeAtkPct}`);
