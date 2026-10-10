'use strict';
// summary.tailFreeze / warning ts-window-edge: excluded time-stop cast whose full animation crosses the window end (marked, not changed)
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const E = require('../chars');
const idx = E.indexData(require('../../../out/ww.json'));
const FR = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
function run(d) { const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples/team_augusta.json'), 'utf8')); delete c.expect; c.actionFrames = FR; if (d) c.duration = d; return E.simulate(c, idx); }
test('tail-freeze: 奥古斯塔 @11 s marks 赫日威临, view + warning', () => {
  const r = run(11), v = E.toView ? E.toView(r) : require('../ww_engine.js').toView(r);
  assert.ok(r.tailFreeze.pct > 3 && r.tailFreeze.idx.length === 1);
  assert.match(r.timeline[r.tailFreeze.idx[0]].label, /赫日威临/);
  assert.strictEqual(v.summary.tailFreezePct, r.tailFreeze.pct);
  assert.strictEqual(v.lanes ? v.lanes[0].actions.filter((a) => a.tailFreeze).length : v.timeline.lanes[0].actions.filter((a) => a.tailFreeze).length, 1);
  assert.strictEqual(r.warnings.filter((w) => w.code === 'ts-window-edge').length, 1);
});
test('tail-freeze: preset window (25 s) unaffected', () => {
  const r = run(); assert.strictEqual(r.tailFreeze.pct, 0); assert.strictEqual(r.warnings.filter((w) => w.code === 'ts-window-edge').length, 0);
});
