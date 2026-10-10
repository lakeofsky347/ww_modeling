'use strict';
// ww-engine 0.2 core: anomaly layer, stamina, forced outro flag, parser fixes, team-search valuation
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const WW = require(path.join(__dirname, '../../../out/ww.json'));
const idx = E.indexData(WW);
const FRAMES_PATH = path.join(__dirname, '../../validation/action_frames.json');
const FRAMES = fs.existsSync(FRAMES_PATH) ? JSON.parse(fs.readFileSync(FRAMES_PATH, 'utf8')) : null;
const ex = (n) => { const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples', n), 'utf8')); if (FRAMES) c.actionFrames = FRAMES; return c; };
const solo = (id) => ({ team: [{ id, level: 90, chain: 0, weapon: { id: 21010023, level: 90, rank: 1 }, echoes: [] }], enemy: { level: 90, resTier: 0.1, resShred: 0 }, conditionals: 'off' });
const near = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * (tol || 0.001);

test('data: anomaly tables from buff.json / AbnormalDamage', () => {
  const A = WW.anomalies;
  assert.equal(A.levelBase[89], 3674);
  for (const k of ['erosion', 'frazzle', 'flare', 'burst', 'chafe', 'bane']) assert.ok(A.types[k], k);
  assert.equal(A.types.erosion.cap, 3); assert.equal(A.types.erosion.period, 3);
  assert.equal(A.types.frazzle.stackExpirationRemoveNumber, 1);
  assert.equal(A.types.flare.decayRatio, 0.5);
});

test('anomaly probe: erosion ticks on apply every 3s until 14.8s; frazzle −1/tick; flare halves', () => {
  const er = E.probeAnomaly(solo(1409), idx, { anomaly: 'erosion', stacks: 3, ticks: 10 });
  assert.deepEqual(er.ticks.map((x) => x.t), [0, 3, 6, 9, 12]);
  assert.ok(near(er.ticks[0].value, 3674 * 2.25 * er.ticks[0].zones.find((z) => z.key === 'defense').value * 0.9));
  const fz = E.probeAnomaly(solo(1506), idx, { anomaly: 'frazzle', stacks: 10, ticks: 4 });
  assert.deepEqual(fz.ticks.map((x) => x.stacks), [10, 9, 8, 7]);
  const fl = E.probeAnomaly(solo(1311), idx, { anomaly: 'flare', stacks: 10, ticks: 5 });
  assert.deepEqual(fl.ticks.map((x) => x.stacks), [10, 5, 2]);
  const nd = E.probeAnomaly(solo(1311), idx, { anomaly: 'flare', stacks: 10, ticks: 3, noDecay: true });
  assert.deepEqual(nd.ticks.map((x) => x.stacks), [10, 10, 10]);
  // anomaly damage never crits and ignores attacker panel bonuses; anomaly-specific deepen applies
  const dp = E.probeAnomaly(solo(1409), idx, { anomaly: 'erosion', stacks: 3, ticks: 1, extraStats: [{ key: 'deep:anomaly:erosion', value: 0.5 }] });
  assert.ok(near(dp.ticks[0].value, er.ticks[0].value * 1.5));
});

test('anomaly is a first-class damage source: share, breakdown rows, status lanes', () => {
  for (const [f, kind] of [['cartethyia_solo.json', 'erosion'], ['phoebe_solo.json', 'frazzle'], ['aemeath_solo.json', 'burst']]) {
    const c = ex(f); if (kind === 'frazzle') c.team[0].module = Object.assign({}, c.team[0].module, { frazzle: 'self' });   // external frazzle has no ticks
    const r = E.simulate(c, idx);
    const st = r.timeline.filter((a) => a.status && a.anomaly === kind);
    assert.ok(st.length && st.reduce((a, x) => a + x.damage, 0) > 0, f + ' ' + kind + ' damage');
    const v = E.toView(r);
    assert.ok(v.share.byType.some((t) => t.type === 'anomaly:' + kind && t.status), f + ' share');
    assert.ok(v.breakdown.rows.some((row) => row.status && row.anomaly === kind), f + ' breakdown');
    const lane = v.timeline.status.find((l) => l.type === kind);
    assert.ok(lane && lane.segments.length && (kind === 'burst' ? lane.bursts.length : lane.ticks.length), f + ' status lane');
  }
});

test('stamina: heavy cost from tables, rejected when empty, solo search stops spamming heavies', () => {
  const c = ex('hsin_solo.json'); c.rotation = { mode: 'manual', sequence: Array(16).fill('H').join(' '), start: 0 };
  const r = E.simulate(c, idx);
  assert.ok(r.steps.some((s) => !s.ok && s.noStamina), 'H rejected for stamina');
  assert.equal(r.timeline.find((a) => a.key === 'yH').staminaCost, 20);
  for (const f of ['hsin_solo.json', 'verina_solo.json']) {
    const s = E.simulate(ex(f), idx);
    const hs = s.timeline.filter((a) => a.cls === 'H' && !a.status && !a.coord).length;
    const all = s.timeline.filter((a) => !a.status && !a.coord && a.cls !== 'W').length;
    assert.ok(hs / all < 0.6, f + ' heavy share ' + hs + '/' + all + ': ' + s.sequence);
    let run = 0, maxRun = 0; for (const a of s.timeline.filter((x) => !x.status && !x.coord)) { run = a.cls === 'H' ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
    assert.ok(maxRun <= 12, f + ' max consecutive heavies ' + maxRun);
  }
  const off = E.simulate(Object.assign(ex('verina_solo.json'), { stamina: false }), idx);
  assert.equal(off.stamina, null);
});

test('outro forced flag: 今汐 同奏 forced outro carries forced/reason and 心 responds', () => {
  const r = E.simulate(ex('team_hsin_jinhsi.json'), idx);
  const o = r.timeline.find((a) => a.cls === 'O' && a.forced);
  assert.ok(o && o.forceReason === 'tongzou', 'forced outro ' + r.sequence);
  assert.ok(r.timeline.some((a) => a.mi === 1 && (a.key === 'yIz' || a.key === 'zIz')));
});

test('parser: others target, 空中攻击 not a stat, per-type defIgnore/resPen, quoted anomaly deepen', () => {
  const keysOf = (es) => es.flatMap((e) => (e.stats ? e.stats.map((s) => s.key) : [e.key]));
  const a = E.parseTextEffects('施放变奏技能时，队伍中除自身以外的角色全属性伤害加深15%，持续20秒。');
  assert.ok(a.some((e) => e.target === 'others'), JSON.stringify(a));
  const b = E.parseTextEffects('施放空中攻击时，造成伤害提升20%。');
  assert.ok(!keysOf(b).includes('atkPct'), JSON.stringify(b));
  // 永远的启明星 (爱弥斯 signature): per-type DEF ignore / RES pen, triggered by the owner applying 聚爆
  const am = E.simulate(Object.assign(ex('aemeath_solo.json'), { duration: 1, rotation: { mode: 'manual', sequence: 'A', start: 0 } }), idx);
  const wb = am.members[0].buffs.filter((x) => x.kind === 'weapon');
  const ks = wb.flatMap((x) => x.stats.map((s) => s.key));
  assert.ok(ks.includes('defIgnore:liberation') && ks.some((k) => /^resPen:fusion(:liberation)?$/.test(k)), JSON.stringify(ks));
  assert.ok(wb.some((x) => x.trigger && x.trigger.on === 'anomaly'), 'anomaly trigger');
  const d = E.parseTextEffects('队伍中的角色对目标造成的【光噪效应】伤害加深100%，持续30秒。');
  assert.ok(keysOf(d).includes('deep:anomaly:frazzle'), JSON.stringify(d));
});

test('team search fields supports: 守岸人 outro precedes 卡提希娅; IO potential only in teams', () => {
  const r = E.simulate(ex('team_cartethyia.json'), idx);
  assert.ok(r.timeline.some((a) => a.mi === 1 && a.cls === 'O'), r.sequence);
  assert.ok(r.buffUptime.some((u) => u.id === 'o1_0' && u.target === 0 && u.uptime > 0), 'outro deepen on 卡提希娅');
});
