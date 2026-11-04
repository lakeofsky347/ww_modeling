'use strict';
// Rotation-edge regressions found by replaying the page presets and hand sequences.
// Game numbers are not invented here: cooldowns and durations come from the data / action_frames the engine already uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const WW = require(path.join(__dirname, '../../../out/ww.json'));
const idx = E.indexData(WW);
const FRAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
const presets = JSON.parse(fs.readFileSync(path.join(__dirname, '../../page/presets_v35.json'), 'utf8'));
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg || ''} ${a} != ${b}`);

function withFrames(c) {
  const x = JSON.parse(JSON.stringify(c));
  x.actionFrames = FRAMES;
  return x;
}

test('window credit 0 is not a full hit: a skill whose cooldown lands exactly on the window end deals nothing', () => {
  const c = withFrames(JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/jinhsi_solo.json'), 'utf8')));
  c.start = { energy: 0, concerto: 0 };
  c.duration = 30;
  c.rotation = { mode: 'manual', sequence: 'E E', onBlocked: 'wait' };
  const wide = E.simulate(c, idx);
  const casts = wide.timeline.filter((a) => a.cls === 'E' && !a.coord && !a.status);
  assert.equal(casts.length, 2, 'two E casts inside a long window');
  const boundary = casts[1].t;
  assert.ok(boundary > casts[0].endT + 1e-6, 'second E waited for the cooldown');
  c.duration = boundary;
  const cut = E.simulate(c, idx);
  const casts2 = cut.timeline.filter((a) => a.cls === 'E' && !a.coord && !a.status);
  assert.equal(casts2.length, 1, 'the cast that would start at t = duration is not played');
  near(cut.total, casts[0].damage, 1e-6, 'total is only the in-window cast');
  assert.ok(cut.steps.some((s) => s.raw === 'E' && s.ok === false && s.reason === '超出时长'));
  // concerto / energy from the dropped cast must not land either
  near(cut.final[0].concerto, wide.timeline.find((a) => a.cls === 'E').concertoAfter, 1e-6, 'no concerto from the dropped cast');
});

test('a swap whose cooldown wait ends exactly at the window does not pay a full outro', () => {
  const c = withFrames(JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/team_jinhsi.json'), 'utf8')));
  c.start = { energy: 0, concerto: [100, 0, 0] };
  c.swapCooldown = 1;
  c.duration = 30;
  // Leave, then come back inside the cooldown so the engine waits. Measure where that wait ends.
  c.rotation = { mode: 'manual', sequence: 'S2 S1', start: 0 };
  const wide = E.simulate(c, idx);
  const back = wide.timeline.filter((a) => (a.cls === 'I' || a.cls === 'S') && a.mi === 0 && a.t > 0);
  assert.ok(back.length, 'swapped back to the opener');
  const boundary = back[0].t;
  assert.ok(boundary > 0);
  c.duration = boundary;
  const cut = E.simulate(c, idx);
  const phantom = cut.timeline.filter((a) => a.t >= boundary - 1e-9 && (a.cls === 'O' || a.cls === 'I') && (a.damage || 0) > 1);
  assert.equal(phantom.length, 0, 'no outro/intro damage on the boundary');
  const before = wide.timeline.filter((a) => !a.coord && !a.status && a.endT <= boundary + 1e-9 && a.t < boundary - 1e-9)
    .reduce((s, a) => s + (a.damage || 0), 0);
  near(cut.total, before, 1e-4, 'total stops at the actions that finished inside the window');
});

test('truncated action parts use the same window credit as the counted damage', () => {
  const c = withFrames(presets[1].config); // 今汐/折枝/守岸人 · 30s 冷启动
  const r = E.simulate(c, idx);
  near(r.total, 368067.79494773416, 1e-6, '30s preset total unchanged');
  let partGap = 0;
  for (const a of r.timeline) {
    if (a.status || a.coord || !a.parts || !a.parts.length) continue;
    const ps = a.parts.reduce((s, p) => s + (p.value || 0), 0);
    partGap += ps - a.damage;
    near(ps, a.damage, 1e-6, a.label);
  }
  near(partGap, 0, 1e-4, 'sum of part-vs-damage gaps');
  const v = E.toView(r);
  const bd = v.breakdown.rows.reduce((s, x) => s + x.damage, 0);
  near(bd, r.total, 1e-4, 'breakdown sums to the total');
});

test('default and 30s presets stay on the published totals', () => {
  const d = E.simulate(withFrames(presets[0].config), idx);
  const s = E.simulate(withFrames(presets[1].config), idx);
  near(d.total, 561384.4668069953, 1e-6, 'default');
  near(s.total, 368067.79494773416, 1e-6, '30s');
  assert.equal(Math.round(d.total), 561384);
  assert.equal(Math.round(s.total), 368068);
});

test('an empty substat slot does not shift the later slots or change the panel', () => {
  const c = withFrames(presets[0].config);
  const a = E.buildContext(c, idx);
  const bcfg = withFrames(presets[0].config);
  const subs = bcfg.team[0].echoes[0].subs;
  subs.splice(1, 0, null); // hole where a cleared 副词条 used to shift everyone down
  const b = E.buildContext(bcfg, idx);
  const pa = E.finalPanel(a.members[0], []);
  const pb = E.finalPanel(b.members[0], []);
  near(pa.atk, pb.atk, 1e-9);
  near(pa.critRate, pb.critRate, 1e-9);
  near(pa.critDmg, pb.critDmg, 1e-9);
});
