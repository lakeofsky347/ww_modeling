'use strict';
// stream B B12 (owned by stream A): (a) resource lookahead `mod.hold` — big finishers are not starved; (b) support cycle — non-dps members cast R before leaving
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const idx = E.indexData(require(path.join(__dirname, '../../../out/ww.json')));
const FRAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
const ex = (n, search) => { let c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples', n), 'utf8')); if (Array.isArray(c)) c = c[0]; c.actionFrames = FRAMES; if (search) c.search = Object.assign({}, c.search, search); return c; };
const keys = (r, mi) => r.timeline.filter((a) => a.mi === mi).map((a) => a.key);

test('B12a 露西: search holds energy for 暗网深潜 (dd), not 网络行者 (nr); hold beats no-hold', () => {
  for (const f of ['lucy_solo.json', 'team_lucy.json']) {
    const a = E.simulate(ex(f), idx), b = E.simulate(ex(f, { hold: false }), idx);
    assert.ok(keys(a, 0).includes('dd') && !keys(a, 0).includes('nr'), `${f}: ${keys(a, 0).join(' ')}`);
    assert.ok(a.total > b.total, `${f}: ${a.total} vs no-hold ${b.total}`);
  }
});
test('B12a 丹瑾: reaches 120 彤华 缭乱 (lrF)', () => {
  for (const f of ['danjin_solo.json', 'team_danjin.json']) {
    const a = E.simulate(ex(f), idx), b = E.simulate(ex(f, { hold: false }), idx);
    const mi = a.members.findIndex((m) => m.id === 1602);
    assert.ok(keys(a, mi).includes('lrF'), `${f}: ${keys(a, mi).join(' ')}`);
    assert.ok(a.total >= b.total, `${f}: ${a.total} vs no-hold ${b.total}`);
  }
});
test('B12a manual sequences are not affected by hold', () => {
  const c = ex('lucy_solo.json'); c.rotation = { mode: 'manual', sequence: 'R' }; c.start = Object.assign({}, c.start, { energy: 'full' });
  const r = E.simulate(c, idx);
  assert.equal(keys(r, 0)[0], 'nr');
});
for (const [f, ids] of [['team_jiyan.json', [1503]], ['team_yangyang.json', [1402, 1503]], ['team_aalto.json', [1403, 1503]], ['team_yinlin.json', [1302, 1505]], ['team_brant.json', [1505]]]) {
  test(`B12b support cycle ${f}: ${ids.join('/')} cast R`, () => {
    const r = E.simulate(ex(f), idx);
    for (const id of ids) {
      const mi = r.members.findIndex((m) => m.id === id);
      assert.ok(r.timeline.some((a) => a.mi === mi && a.cls === 'R' && !a.coord), `${f}: ${r.members[mi].name} never casts R (${r.sequence})`);
      assert.ok(r.timeline.some((a) => a.mi === mi && a.cls === 'O'), `${f}: ${r.members[mi].name} never outros`);
    }
  });
}
