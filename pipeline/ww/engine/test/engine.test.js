'use strict';
// node --test /workspace/gamedata/pipeline/ww/engine/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const WW = require(path.join(__dirname, '../../../out/ww.json'));
const idx = E.indexData(WW);
const ex = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples', n), 'utf8'));
const near = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg || ''} ${a} != ${b}`);

// ---------------------------------------------------------------- formula units (hand computed)
test('defense zone: Lv90 vs Lv90, ignore/reduce', () => {
  near(E.defenseMultiplier(90, 90).value, 1520 / (1520 + 1512));            // 0.50132
  near(E.defenseMultiplier(90, 90, 0.18).value, 1520 / (1520 + 1512 * 0.82)); // 0.55076
  near(E.defenseMultiplier(90, 90, 0, 0.2).value, 1520 / (1520 + 1512 * 0.8));
  near(E.defenseMultiplier(80, 100).value, 1440 / (1440 + 1592));
  near(E.defenseMultiplier(90, 90, 0, 0, 1000).value, 1520 / 2520);
});
test('resistance zone: negative halving / linear / high-res', () => {
  near(E.resistanceMultiplier(-0.2), 1.1);
  near(E.resistanceMultiplier(0), 1);
  near(E.resistanceMultiplier(0.1), 0.9);
  near(E.resistanceMultiplier(0.4), 0.6);
  near(E.resistanceMultiplier(0.79), 0.21);
  near(E.resistanceMultiplier(0.9), 1 / 5.5);
});
test('crit zone: expected / crit / noncrit / cap', () => {
  near(E.critMultiplier(0.5, 2.0), 1.5);
  near(E.critMultiplier(0.05, 1.5), 1.025);
  near(E.critMultiplier(1.3, 2.5), 2.5);
  near(E.critMultiplier(0.5, 2.0, 'crit'), 2.0);
  near(E.critMultiplier(0.5, 2.0, 'noncrit'), 1);
});
test('resolveHit end-to-end with hand-computed number + zones carry mech/basis', () => {
  const panel = { atk: 2000, hp: 10000, def: 1000, critRate: 0.6, critDmg: 2.2, energyRegen: 1, healBonus: 0,
    raw: { 'dmg:spectro': 0.3, 'dmg:allElement': 0.1, 'dmg:skill': 0.2, 'deep:skill': 0.25, 'dmg:physical': 9, 'deep:all': 0.15 } };
  const hit = { label: 't', count: 2, multiplier: [1.5], flatAdd: [100], type: 'skill', element: 'spectro', scaling: 'atk', calc: 'damage' };
  const enemy = { level: 90, resTier: 0.1, resShred: 0.25, defIgnore: 0, defReduce: 0, dmgReduce: 0 };
  const r = E.resolveHit({ panel, hit, level: 1, attackerLevel: 90, enemy });
  // base 2000*1.5+100 = 3100; bonus 1+0.3+0.1+0.2 = 1.6; deepen 1+0.25+0.15 = 1.4; crit 1+0.6*1.2 = 1.72
  // def 1520/3032; effRes 0.1-0.25 = -0.15 → 1.075
  const common = 3100 * 1.6 * 1.4 * (1520 / 3032) * 1.075;
  near(r.perHit.noncrit, common);
  near(r.perHit.expected, common * 1.72);
  near(r.total.crit, common * 2.2 * 2);
  near(r.effectiveRes, -0.15);
  const zr = r.zones.find((z) => z.key === 'resistance');
  assert.equal(zr.neg, true); near(zr.effectiveRes, -0.15); near(zr.baseRes, 0.1); near(zr.shred, 0.25);
  for (const z of r.zones) {
    assert.ok(['table', 'corroborated', 'community', 'unsolved'].includes(z.mech), z.key);
    assert.ok(typeof z.basis === 'string' && z.basis.length > 3, z.key);
    assert.equal(z.mech, E.MECH[z.mechKey].mech, 'zone mech driven by MECH table');
  }
  // product of zone values == expected total
  const prod = r.zones.filter((z) => z.key !== 'multiplier' && z.key !== 'base').reduce((p, z) => p * z.value, 1);
  near(prod * 3100 * 2, r.total.expected, 1e-9);
});
test('physical: allElement does not apply', () => {
  const panel = { atk: 1000, hp: 0, def: 0, critRate: 0, critDmg: 1.5, healBonus: 0, raw: { 'dmg:allElement': 0.5 } };
  const hit = { count: 1, multiplier: [1], type: 'basic', element: 'physical', scaling: 'atk' };
  const r = E.resolveHit({ panel, hit, level: 1, attackerLevel: 90, enemy: { level: 90, resTier: 0 } });
  near(r.zones.find((z) => z.key === 'bonus').value, 1);
});
test('MECH table: every entry has mech+basis+confidence', () => {
  for (const [k, v] of Object.entries(E.MECH)) {
    assert.ok(['table', 'corroborated', 'community', 'unsolved', 'heuristic'].includes(v.mech), k); // heuristic = search-only (residual/steady)
    assert.ok(v.basis && v.confidence, k);
  }
});
test('text effect parser', () => {
  const e = E.parseTextEffects('全属性伤害加成提升12%。每次施放变奏技能或共鸣解放时，自身重击伤害加成提升24%，可叠加2层，效果持续14秒。');
  assert.equal(e[0].key, 'dmg:allElement'); assert.equal(e[0].conditional, false); near(e[0].value, 0.12);
  assert.equal(e[1].key, 'dmg:heavy'); assert.equal(e[1].maxStacks, 2); assert.equal(e[1].duration, 14);
  assert.deepEqual(e[1].trigger, { on: 'any', any: [{ on: 'intro' }, { on: 'cast', kinds: ['R'] }] });
  const o = E.parseTextEffects('下一位登场角色冷凝伤害加深20%，共鸣技能伤害加深25%，效果持续14秒，若切换至其他角色则该效果提前结束。');
  assert.equal(o.length, 2); assert.equal(o[0].key, 'deep:glacio'); assert.equal(o[1].key, 'deep:skill');
  assert.equal(o[0].target, 'incoming'); assert.equal(o[0].endsOnSwap, true);
});

// ---------------------------------------------------------------- stat assembly
test('stat assembly: 今汐 base + weapon + echoes + sonata + tree', () => {
  const ctx = E.buildContext(ex('jinhsi_solo.json'), idx);
  const m = ctx.members[0];
  const p = E.finalPanel(m, []);
  const R = idx.res.get(1304);
  const row = R.levelStats.filter((r) => r[0] === 90).pop();
  assert.equal(m.base.hp, row[2]);
  assert.ok(p.critRate > 0.05 && p.critDmg > 1.5);
  // sonata 浮星祛暗 2pc static +10% spectro; tree spectro nodes; 2× elemDmg 30% mains
  assert.ok(p.raw['dmg:spectro'] >= 0.6, 'spectro bonus ' + p.raw['dmg:spectro']);
  assert.equal(m.echoCost, 12);
});
test('substat tiers: tier index / max / Chinese names; off-table value warns but is used', () => {
  const tiers = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/substat_tiers.json'), 'utf8'));
  const tab = E.substatTierTable(tiers);
  assert.equal(tab.length, 13);
  near(tab.find((t) => t.key === 'critRate').values[7], 0.105);
  const c = ex('jinhsi_solo.json');
  c.substatTiers = tiers;
  c.team[0].echoes[1].subs = [{ stat: '暴击', tier: 'max' }, { stat: 'critDmg', tier: 0 }, { stat: 'atkPct', value: 0.1 }];
  const ctx = E.buildContext(c, idx);
  const base = E.finalPanel(E.buildContext(ex('jinhsi_solo.json'), idx).members[0], []);
  const p = E.finalPanel(ctx.members[0], []);
  near(p.critRate - base.critRate, 0.105, 1e-9);
  near(p.critDmg - base.critDmg, 0.126, 1e-9);
  assert.ok(ctx.warnings.some((w) => /不在档位表/.test(w.text)));
  // mock tiers object of another shape (array form)
  const c2 = ex('jinhsi_solo.json');
  c2.substatTiers = { substats: [{ stat: 'critRate', tiers: [{ value: 0.063 }, { value: 0.07 }] }] };
  c2.team[0].echoes[1].subs = [{ stat: 'critRate', tier: 1 }];
  near(E.finalPanel(E.buildContext(c2, idx).members[0], []).critRate - base.critRate, 0.07, 1e-9);
});

// ---------------------------------------------------------------- energy / concerto accounting
test('energy accounting: per-hit energy × count × energyRegen, capped; R consumes cost', () => {
  const c = ex('jinhsi_solo.json');
  c.rotation = { mode: 'manual', sequence: 'E' }; c.start = { energy: 0, concerto: 0 };
  const ctx = E.buildContext(c, idx);
  const act = ctx.members[0].kit.E;
  const expectE = act.hits.reduce((s, h) => s + h.energy[0] * (h.count || 1), 0);
  const er = E.finalPanel(ctx.members[0], []).energyRegen;
  const { state } = E.runSequence(ctx, 'E');
  near(state.m[0].energy, expectE * er, 1e-9);
  near(state.m[0].concerto, act.hits.reduce((s, h) => s + h.concerto[0] * (h.count || 1), 0), 1e-9);
  const c2 = ex('jinhsi_solo.json'); c2.start = { energy: 'full', concerto: 0 };
  const ctx2 = E.buildContext(c2, idx);
  const s2 = E.runSequence(ctx2, 'R').state;
  near(s2.m[0].energy, (ctx2.members[0].kit.R.energy || 0) * er, 1e-9);
  const s3 = E.runSequence(ctx2, 'E E E').state; // full + gains stays capped
  assert.equal(s3.m[0].energy, 150);
});
test('liberation gating: R blocked with insufficient energy (manual reports reason)', () => {
  const c = ex('jinhsi_solo.json'); c.start = { energy: 0, concerto: 0 };
  const ctx = E.buildContext(c, idx);
  const r = E.runSequence(ctx, 'R');
  assert.equal(r.steps[0].ok, false);
  assert.match(r.steps[0].reason, /共鸣能量不足/);
  assert.ok(!E.actionsFor(E.initialState(ctx), ctx).some((a) => a.tok === 'R'));
});
test('echo cooldown: second Q waits for cooldown (onBlocked=wait) or is skipped', () => {
  const ctx = E.buildContext(ex('jinhsi_solo.json'), idx);
  const cd = ctx.members[0].kit.Q.cooldown;
  assert.ok(cd > 0);
  const r = E.runSequence(ctx, 'Q Q', { onBlocked: 'wait' });
  const qs = E.timelineOf(r.state).filter((a) => a.cls === 'Q');
  assert.equal(qs.length, 2); near(qs[1].t - qs[0].t, cd, 1e-9);
  const r2 = E.runSequence(ctx, 'Q Q', { onBlocked: 'skip' });
  assert.equal(r2.steps[1].ok, false);
});
test('swap at full concerto triggers outro (buff to incoming) + intro; concerto resets', () => {
  const ctx = E.buildContext(ex('team_jinhsi.json'), idx);
  const r = E.runSequence(ctx, 'S2 S1');
  const tl = E.timelineOf(r.state);
  assert.deepEqual(tl.map((a) => a.cls), ['O', 'I', 'O', 'I']);
  assert.equal(r.state.m[2].concerto, 0); assert.equal(r.state.active, 0);
  // 折枝 outro deepen applied to 今汐
  const deep = r.state.buffs.filter((b) => b.target === 0 && /^o1_/.test(b.id));
  assert.ok(deep.length >= 2);
  // plain swap without concerto: no outro
  const r2 = E.runSequence(ctx, 'S2 S1 S2');
  assert.equal(E.timelineOf(r2.state).pop().cls, 'S');
});

// ---------------------------------------------------------------- invariants over search + random sequences
function invariants(ctx, state) {
  for (let s = state; s; s = s.prev) {
    s.m.forEach((m, i) => {
      assert.ok(m.energy >= -1e-9, 'negative energy');
      assert.ok(m.energy <= (ctx.members[i].R.energy.liberationCost || 0) + 1e-9, 'energy over max');
      assert.ok(m.concerto >= 0 && m.concerto <= 100 + 1e-9, 'concerto range');
    });
    const a = s.action;
    if (a && a.cls === 'R' && !a.extra) assert.ok(a.energyBefore >= ctx.members[a.mi].kit.R.cost - 1e-9, 'R without full energy');
  }
  const tl = E.timelineOf(state).filter((a) => !a.coord);
  for (let i = 0; i < ctx.members.length; i++) {
    const m = ctx.members[i];
    const acts = [m.kit.E, m.kit.R, m.kit.Q, ...Object.values(m.modKit || {})].filter((a) => a && a.cooldown);
    const cdOf = new Map(acts.map((a) => [a.cdKey || a.key, a.cooldown]));
    for (const [k, cd] of cdOf) {
      const ts = tl.filter((a) => a.mi === i && a.key === k && a.cls !== 'O').map((a) => a.t);
      for (let j = 1; j < ts.length; j++) assert.ok(ts[j] - ts[j - 1] >= cd - 1e-9, `${m.R.name} ${k} cooldown violated`);
    }
  }
}
test('invariants hold for beam-search results and random manual sequences', () => {
  for (const f of ['jinhsi_solo.json', 'changli_solo.json', 'team_jinhsi.json']) {
    const c = ex(f); c.search = { beamWidth: 12, maxExpansions: 5000, topN: 3 };
    const ctx = E.buildContext(c, idx);
    const sr = E.beamSearch(ctx);
    for (const cand of sr.ranked) {
      const r = E.runSequence(ctx, cand.sequence, { onBlocked: 'skip' });
      assert.ok(r.steps.every((s) => s.ok), f + ' search sequence replays cleanly');
      near(r.state.damage, cand.damage, 1e-9, 'replay damage');
      invariants(ctx, r.state);
    }
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let k = 0; k < 20; k++) {
      let s = E.initialState(ctx);
      while (s.t < ctx.duration - 1e-9) {
        const acts = E.actionsFor(s, ctx);
        const n = E.applyAction(s, acts[Math.floor(rnd() * acts.length)], ctx);
        if (!n) break; s = n;
      }
      invariants(ctx, s);
    }
  }
});
test('search determinism: identical results twice', () => {
  const c = ex('team_jinhsi.json');
  const a = E.simulate(c, idx), b = E.simulate(c, idx);
  assert.equal(a.sequence, b.sequence); assert.equal(a.total, b.total);
  assert.deepEqual(a.search.ranked, b.search.ranked);
  assert.ok(a.search.ranked.length >= 2);
  for (let i = 1; i < a.search.ranked.length; i++) assert.ok(a.search.ranked[i - 1].damage >= a.search.ranked[i].damage);
});
test('search beats or equals greedy policy', () => {
  const ctx = E.buildContext(ex('changli_solo.json'), idx);
  const g = E.runPolicy(ctx);
  const s = E.beamSearch(ctx);
  assert.ok(s.ranked[0].damage >= g.damage - 1e-6);
});

// ---------------------------------------------------------------- view model / gear compare
test('toView: contract shapes', () => {
  const v = E.toView(E.simulate(ex('team_jinhsi.json'), idx));
  for (const k of ['summary', 'gauges', 'timeline', 'seq', 'buffs', 'share', 'breakdown', 'warnings', 'search']) assert.ok(v[k] != null, k);
  assert.equal(v.timeline.lanes.length, 3);
  const cls = new Set(v.timeline.lanes.flatMap((l) => l.actions.map((a) => a.cls)));
  for (const c of cls) assert.ok(['A', 'H', 'E', 'R', 'Q', 'I', 'O'].includes(c), c);
  assert.ok(v.breakdown.representative.zones.every((z) => z.mech && z.basis));
  near(v.share.byMember.reduce((s, m) => s + m.pct, 0), 100, 1e-3);
  assert.ok(v.buffs.every((b) => b.uptimePct >= 0 && b.uptimePct <= 100));
  assert.ok(v.search.candidates[0].best && v.search.candidates[0].gapPct === 0);
});
test('compareGear: ranked rows with deltas', () => {
  const c = ex('jinhsi_solo.json');
  const out = E.compareGear(c, idx, [...E.weaponVariants(idx, 0, [21010015, 21010026]), ...E.echoMainVariants(0, 0, ['Crit', 'Atk%'])]);
  assert.equal(out.rows.length, 5);
  assert.equal(out.rows.filter((r) => r.cur).length, 1);
  assert.ok(out.rows[0].best && out.rows[0].gapPct === 0);
  for (let i = 1; i < out.rows.length; i++) assert.ok(out.rows[i].total <= out.rows[i - 1].total);
});
