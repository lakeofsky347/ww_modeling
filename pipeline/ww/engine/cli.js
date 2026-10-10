#!/usr/bin/env node
'use strict';
/*
 * WW engine validation CLI.
 *   node cli.js <cases.json> [--data ../../out/ww.json] [--frames ../validation/action_frames.json|none] [--case <name|index>] [--rows N] [--json out.json] [--timeline]
 * Action frames: case.actionFrames (object or path relative to the cases file) > --frames > ../validation/action_frames.json when present.
 * cases.json: { "cases": [ <case>, ... ] }  or  [ <case>, ... ]   (format: VALIDATION_CASES.md)
 * Anomaly probe: case.probe = { member, anomaly: erosion|frazzle|flare|burst|chafe|bane, stacks, ticks, cap, noDecay, detonate, scale, crit:{rate,dmg}, extraStats, electroRefreshOnHalve }
 *   bane（虚湮）不造成伤害：输出 0..stacks 层的减防与防御区（expect.defZone / defReduce / defZones[]）
 *   electroRefreshOnHalve：电磁减半时刷新持续时间（MECH.electroDecay 读法 B，默认 false）
 *   prints every settlement (tick / burst) with zones; expect.{first, sum, count, ticks:[..]} are checked.
 * Exit code 1 if any `expect` check fails.
 */
const fs = require('fs');
const path = require('path');
const E = require('./chars');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--timeline'].includes(args[i - 1])));
if (!file) { console.error('usage: node cli.js <cases.json> [--data ww.json] [--case name|idx] [--rows N] [--json out.json] [--timeline]'); process.exit(2); }
const dataPath = opt('--data', path.join(__dirname, '../../out/ww.json'));
const idx = E.indexData(JSON.parse(fs.readFileSync(dataPath, 'utf8')));
const baseDir = path.dirname(path.resolve(file));
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
let cases = Array.isArray(raw) ? raw : raw.cases ? raw.cases : raw.team ? [raw] : [];
const defaults = Array.isArray(raw) ? {} : (raw.defaults || {});
const only = opt('--case');
if (only != null) cases = cases.filter((c, i) => String(i) === only || c.name === only);
const rowsN = +opt('--rows', 8);
const framesOpt = opt('--frames', path.join(__dirname, '../validation/action_frames.json'));
let globalFrames = null;
if (framesOpt !== 'none' && fs.existsSync(framesOpt)) {
  try { globalFrames = JSON.parse(fs.readFileSync(framesOpt, 'utf8')); console.log(`action frames: ${framesOpt}${globalFrames.version ? ' (version ' + globalFrames.version + ')' : ''}`); }
  catch (e) { console.log(`action frames: failed to read ${framesOpt}: ${e.message}`); }
} else console.log('action frames: none loaded (durations fall back to defaults, flagged est/unsolved)');

const fmt = (x, n = 0) => (x == null ? '-' : Number(x).toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: n }));
const loadTiers = (t) => (typeof t === 'string' ? JSON.parse(fs.readFileSync(path.resolve(baseDir, t), 'utf8')) : t);
const mechTag = (z) => ({ table: 'T', corroborated: 'K', community: 'C', unsolved: 'U' }[z.mech] || '?');
const zoneLine = (zs) => zs.map((z) => `${z.key}=${z.key === 'base' ? fmt(z.value, 1) : z.key === 'multiplier' ? fmt(z.value * 100, 2) + '%' : fmt(z.value, 4)}[${mechTag(z)}]`).join('  ');

function within(actual, exp, tolPct) {
  if (exp == null) return true;
  return Math.abs(actual - exp) <= Math.abs(exp) * (tolPct / 100) + 1e-9;
}

function probe(cfg, p) {
  const ctx = E.buildContext(cfg, idx);
  const mi = p.member || 0;
  const mem = ctx.members[mi];
  const k = mem.kit;
  let act = p.action === 'A' ? k.stages[(p.stage || 1) - 1] : /^X\d+$/.test(p.action) ? k.extras[+p.action.slice(1)] : k[p.action];
  if (!act) throw new Error(`probe: member ${mi} has no action ${p.action}`);
  const buffs = [];
  for (const m of ctx.members) for (const b of m.buffDefs) {
    if (b.unmodeled) continue;
    const forced = (p.buffs || []).includes(b.id);
    const staticOn = b.mode === 'on' && (b.target === 'team' || (b.target === 'incoming' ? b.owner !== mi : b.owner === mi));
    if (forced || staticOn) for (const s of b.stats) buffs.push({ key: s.key, value: s.value * (forced || b.trigger.on !== 'always' ? b.maxStacks || 1 : 1) });
  }
  for (const s of p.extraStats || []) buffs.push({ key: E.panelKey(s.key, mem.el) || s.key, value: s.value });
  const panel = E.finalPanel(mem, buffs);
  const hits = p.hit ? act.hits.filter((h) => h.label === p.hit) : act.hits;
  const out = hits.map((h) => ({ label: h.label, r: E.resolveHit({ panel, hit: h, level: act.level, attackerLevel: mem.level, enemy: ctx.enemy, mode: ctx.mode }) }));
  return { act, panel, out, ctx };
}

let fails = 0;
const report = [];
cases.forEach((c0, ci) => {
  const c = Object.assign({}, JSON.parse(JSON.stringify(defaults)), JSON.parse(JSON.stringify(c0)));
  const name = c.name || `case#${ci}`;
  console.log(`\n=== [${ci}] ${name} ===`);
  const exp = c.expect || {};
  const tol = exp.tolerancePct != null ? exp.tolerancePct : 1;
  const checks = [];
  try {
    if (c.substatTiers) c.substatTiers = loadTiers(c.substatTiers);
    if (typeof c.actionFrames === 'string') c.actionFrames = loadTiers(c.actionFrames);
    else if (c.actionFrames == null && globalFrames) c.actionFrames = globalFrames;
    if (c.probe && c.probe.anomaly) {
      // anomaly probe: { member, anomaly, stacks, ticks, cap, noDecay, detonate, scale, crit, extraStats }
      const r = E.probeAnomaly(c, idx, c.probe);
      console.log(`anomaly probe: ${r.member} Lv${r.level} → ${r.zh}(${r.type}) ${c.probe.stacks || 1} 层 | cap ${r.def.cap} dur ${r.def.duration}s period ${r.def.period}s${r.def.decayRatio != null ? ' decay×' + r.def.decayRatio : ''}${r.def.stackExpirationRemoveNumber === 1 ? ' −1层/周期' : ''}${r.type === 'flare' ? ' | 减半续时 ' + (r.electroRefreshOnHalve ? '是' : '否') + ' [unsolved: MECH.electroDecay]' : ''}`);
      if (r.bane) {
        // 虚湮：不造成伤害，只减防 → 逐层防御区
        r.bane.forEach((x) => console.log(`  ${x.stacks} 层: 减防 ${fmt(x.defReduce * 100, 2)}% → 敌方有效防御 ${fmt(x.effectiveDef, 1)}（原 ${fmt(x.enemyDef, 1)}） 防御区 ${fmt(x.defZone, 6)}  直伤/异常 +${fmt(x.gainPct, 3)}%  [${r.mech[0].mech}]`));
        const last = r.bane[r.bane.length - 1];
        if (exp.defZone != null) checks.push(['defZone', last.defZone, exp.defZone]);
        if (exp.defReduce != null) checks.push(['defReduce', last.defReduce, exp.defReduce]);
        (exp.defZones || []).forEach((v, i) => { if (v != null) checks.push([`defZone[${i}]`, r.bane[i] ? r.bane[i].defZone : 0, v]); });
      }
      r.ticks.forEach((x, i) => {
        console.log(`  #${i + 1} t=${fmt(x.t, 2)}s ${x.kind} ${x.stacks} 层: ${fmt(x.value, 1)}`);
        if (x.zones.length) console.log('    ' + zoneLine(x.zones));
      });
      console.log(`  SUM ${fmt(r.sum, 1)} over ${r.ticks.length} settlement(s)`);
      if (exp.first != null) checks.push(['first', r.ticks[0] ? r.ticks[0].value : 0, exp.first]);
      if (exp.sum != null) checks.push(['sum', r.sum, exp.sum]);
      if (exp.count != null) checks.push(['count', r.ticks.length, exp.count]);
      (exp.ticks || []).forEach((v, i) => { if (v != null) checks.push([`tick[${i}]`, r.ticks[i] ? r.ticks[i].value : 0, v]); });
      report.push({ name, probe: c.probe, anomaly: r });
    } else if (c.probe) {
      const { act, panel, out, ctx } = probe(c, c.probe);
      console.log(`probe: ${ctx.members[c.probe.member || 0].R.name} ${act.cls} ${act.label} Lv${act.level} | ATK ${fmt(panel.atk, 1)} HP ${fmt(panel.hp, 1)} CR ${fmt(panel.critRate * 100, 2)}% CD ${fmt(panel.critDmg * 100, 2)}%`);
      let sum = { expected: 0, crit: 0, noncrit: 0 };
      for (const o of out) {
        console.log(`  ${o.label}${(o.r.total.expected && '') || ''}: expected ${fmt(o.r.total.expected, 1)} | crit ${fmt(o.r.total.crit, 1)} | noncrit ${fmt(o.r.total.noncrit, 1)}${o.r.heal ? ' | heal ' + fmt(o.r.heal, 1) : ''}`);
        if (o.r.zones.length) console.log('    ' + zoneLine(o.r.zones) + `  effRes=${fmt(o.r.effectiveRes * 100, 2)}%`);
        for (const k of Object.keys(sum)) sum[k] += o.r.total[k];
      }
      console.log(`  SUM expected ${fmt(sum.expected, 1)} | crit ${fmt(sum.crit, 1)} | noncrit ${fmt(sum.noncrit, 1)}`);
      for (const k of ['expected', 'crit', 'noncrit']) if (exp[k] != null) checks.push([k, sum[k], exp[k]]);
      report.push({ name, probe: c.probe, panel: { atk: panel.atk, hp: panel.hp, critRate: panel.critRate, critDmg: panel.critDmg }, sum, hits: out.map((o) => ({ label: o.label, total: o.r.total, zones: o.r.zones })) });
    } else {
      const r = E.simulate(c, idx);
      const v = E.toView(r);
      console.log(`sequence: ${r.sequence}`);
      const bad = r.steps.filter((s) => !s.ok);
      if (bad.length) console.log('invalid steps: ' + bad.map((s) => `${s.raw}(${s.reason})`).join(', '));
      console.log(`total(${r.mode}) ${fmt(r.total)} | DPS ${fmt(r.dps)} | ${r.duration}s (ended ${fmt(r.endT, 2)}s) | swaps ${r.swaps} | liberations ${r.liberations}`);
      r.members.forEach((m, i) => console.log(`  [${i + 1}] ${m.name}: ${fmt(r.perMember[i])} | ATK ${fmt(m.panel.atk, 1)} HP ${fmt(m.panel.hp, 1)} CR ${fmt(m.panel.critRate * 100, 2)}% CD ${fmt(m.panel.critDmg * 100, 2)}% ER ${fmt(m.panel.energyRegen * 100, 1)}% | end E ${fmt(r.final[i].energy, 1)}/${r.final[i].energyMax} C ${fmt(r.final[i].concerto, 1)}`));
      console.log('  by type: ' + v.share.byType.map((t) => `${t.zh} ${t.pct}%`).join(' · '));
      if (v.breakdown.representative) { const rp = v.breakdown.representative; console.log(`  representative hit: ${r.members[rp.member].name} ${rp.action}/${rp.hit} @${fmt(rp.t, 2)}s = ${fmt(rp.value, 1)}`); console.log('    ' + zoneLine(rp.zones)); }
      console.log(`  per action/hit (top ${rowsN}; zones = buffs at first occurrence):`);
      for (const row of v.breakdown.rows.slice(0, rowsN)) console.log(`   - ${row.name} ${row.cls} ${row.action}/${row.hit} ×${row.count}: ${fmt(row.damage)}\n       ${zoneLine(row.zones)}`);
      if (flag('--timeline')) for (const a of r.timeline) console.log(`   t=${fmt(a.t, 2)} ${a.tok || ''} ${a.cls} ${r.members[a.mi].name} ${a.label} ${fmt(a.damage)} E${fmt(a.energyAfter, 1)} C${fmt(a.concertoAfter, 1)}`);
      if (r.search) console.log(`  search: expanded ${r.search.expanded}${r.search.truncated ? ' (budget hit)' : ''}, top: ` + r.search.ranked.map((x) => fmt(x.damage)).join(' / '));
      if (exp.total != null) checks.push(['total', r.total, exp.total]);
      if (exp.dps != null) checks.push(['dps', r.dps, exp.dps]);
      for (const [i, val] of Object.entries(exp.perMember || {})) checks.push([`perMember[${i}]`, r.perMember[+i], val]);
      for (const [k, val] of Object.entries(exp.panel || {})) for (const [st, x] of Object.entries(val)) checks.push([`panel[${k}].${st}`, r.members[+k].panel[st], x]);
      if (exp.noInvalidSteps && bad.length) checks.push(['noInvalidSteps', bad.length, 0]);
      report.push({ name, sequence: r.sequence, total: r.total, dps: r.dps, perMember: r.perMember, members: r.members.map((m) => ({ name: m.name, panel: m.panel })), representative: v.breakdown.representative, rows: v.breakdown.rows.slice(0, rowsN) });
    }
  } catch (e) {
    console.log('ERROR: ' + e.message); fails++; report.push({ name, error: e.message }); return;
  }
  for (const [k, a, x] of checks) {
    const ok = within(a, x, tol);
    if (!ok) fails++;
    console.log(`  expect ${k}: ${fmt(a, 2)} vs ${fmt(x, 2)} (±${tol}%) ${ok ? 'OK' : 'FAIL (' + fmt((a / x - 1) * 100, 2) + '%)'}`);
  }
});
console.log(`\nzone mech legend: T=table K=corroborated C=community U=unsolved · engine ${E.VERSION} · data ${idx.meta.version}`);
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 1));
process.exit(fails ? 1 : 0);
