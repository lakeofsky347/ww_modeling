'use strict';
// stream A, B13 follow-ups (2026-10-09 17:3x SGT): periodic module hook api.every / mod.tick; 心 UNISON includes 锁暝; shared 同奏增益 cap across providers
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const C = require('../chars/_common.js');
const idx = E.indexData(require(path.join(__dirname, '../../../out/ww.json')));
const FRAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
const ex = (n) => { let c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples', n), 'utf8')); if (Array.isArray(c)) c = c[0]; c.actionFrames = FRAMES; delete c.expect; return c; };

test('api.every: 卜灵 五雷荡煞阵 ticks every 2 s also while nobody acts (idle window)', () => {
  const c = ex('buling_solo.json'); c.duration = 30;
  c.rotation = { mode: 'manual', sequence: 'E A A A A H A A A A A A A A H A A A H R A' };
  const r = E.simulate(c, idx);
  const gy = r.timeline.find((a) => a.key === 'gy');
  assert.ok(gy, 'gy cast');
  const ticks = r.timeline.filter((a) => a.key === 'tick');
  const last = r.timeline.filter((a) => a.key && a.key !== 'tick' && !/^anomaly:/.test(a.key)).pop();
  assert.ok(ticks.length >= Math.floor((30 - gy.endT) / 2), `ticks ${ticks.length}`);
  for (let i = 1; i < ticks.length; i++) assert.ok(Math.abs(ticks[i].t - ticks[i - 1].t - 2) < 1e-6);
  assert.ok(ticks.some((x) => x.t > last.endT + 2), 'ticks continue after the last action (idle window)');
  assert.ok(ticks.every((x) => x.damage > 0));
});

test('心 UNISON includes 锁暝 1312 (no module.unisonIds needed) and 同奏增益 total per target ≤ shared cap', () => {
  const c = ex('team_suoming.json');
  assert.ok(!c.team.some((m) => m.module && m.module.unisonIds), 'workaround removed from example');
  const r = E.simulate(c, idx);
  assert.ok(r.total > 0);
  const hsin = c.team.find((m) => m.id === 1311), cap = 2 + (hsin ? 1 : 0) + (hsin && hsin.chain >= 6 ? 1 : 0);
  // sum of all providers' tzzy stacks on each target at every interval start
  const tz = (r.buffUptime || []).filter((b) => /_tzzy$/.test(b.id));
  const pts = new Set(); tz.forEach((b) => b.intervals.forEach((iv) => pts.add(iv[0] + 1e-6)));
  for (const t of pts) {
    const by = {};
    for (const b of tz) for (const iv of b.intervals) if (iv[0] <= t && t < iv[1]) by[b.target] = (by[b.target] || 0) + (iv[2] || b.stacks || 1);
    for (const v of Object.values(by)) assert.ok(v <= cap, `同奏增益 ${v} > cap ${cap} @${t}`);
  }
});

test('tzzyRoom: shared cap 2 (+1 with 心, +1 at 心 S6) minus other providers', () => {
  const mk = (members, inst) => ({ ctx: { members }, buffInst: (id, j) => inst[id + '@' + j] || null });
  const m = (id, chain) => ({ R: { id }, chain: chain || 0 });
  assert.equal(C.tzzyRoom(mk([m(1304), m(1312)], {}), 0, 1), 2);
  assert.equal(C.tzzyRoom(mk([m(1304), m(1311), m(1312)], { 'm1_tzzy@0': { stacks: 2 } }), 0, 2), 1);
  assert.equal(C.tzzyRoom(mk([m(1304), m(1311, 6), m(1312)], { 'm1_tzzy@0': { stacks: 4 } }), 0, 2), 0);
});
