'use strict';
// lead request (16:41): time-stop exploit guard under timeStop="exclude" (default).
// Actions whose whole animation is time-stopped shrink to 0.05 s of fight time; they must stay gated (cooldown / energy / module resource),
// so the search can never chain them, and their damage / buffs must still apply.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const idx = E.indexData(require(path.join(__dirname, '../../../out/ww.json')));
const FRAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
const ex = (n, d) => { let c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples', n), 'utf8')); if (Array.isArray(c)) c = c[0]; c.actionFrames = FRAMES; if (d) c.duration = d; return c; };
const frozen = (r) => r.timeline.filter((a) => a.key && a.timeStop > 0 && a.endT - a.t <= 0.051);

for (const [file, name] of [['qingxiao_solo.json', '清宵'], ['phrolova_solo.json', '弗洛洛'], ['lucy_solo.json', '露西']]) {
  for (const d of [25, 40]) {
    test(`timeStop exclude: ${name} ${d}s search does not chain frozen actions`, () => {
      const r = E.simulate(ex(file, d), idx);
      const fz = frozen(r);
      const by = {};
      for (const a of fz) (by[a.key] = by[a.key] || []).push(a);
      for (const [k, list] of Object.entries(by)) {
        // gate: at most one cast per 12 s of fight time (+1) — every whole-frozen action in these kits sits behind a ≥14 s cooldown, 125 energy or a forte bar
        assert.ok(list.length <= Math.floor(d / 12) + 1, `${name} ${k} ×${list.length} in ${d}s`);
        for (let i = 1; i < list.length; i++) assert.ok(list[i].t - list[i - 1].t > 5, `${name} ${k} recast after ${(list[i].t - list[i - 1].t).toFixed(2)}s`);
      }
      const share = fz.reduce((s, a) => s + (a.damage || 0), 0) / r.total;
      assert.ok(share < 0.6, `${name} frozen-action damage share ${(100 * share).toFixed(1)}%`);
      // the shortened action still deals its damage (only 弗洛洛 圆舞曲 is damage-free by kit text)
      for (const a of fz) if (!/waltz/.test(a.key)) assert.ok(a.damage > 0 || a.cls !== 'R' || a.key === 'zx', `${name} ${a.key} dealt no damage`);
    });
  }
}

// 17:20 (WuWaSim toa): 圆舞曲 has no energy cost → not frozen by default. The buff-freeze property is now exercised through an explicit
// tsVerified frame entry (test fixture only; the shipped action_frames.json carries no tsVerified flags).
const withVerified = (label, src) => { const F = JSON.parse(JSON.stringify(FRAMES)); let n = 0;
  for (const c of Object.values(F.characters)) if (c && c[label]) { c[label].tsVerified = src; n++; }
  assert.ok(n > 0, 'fixture label found: ' + label); return F; };
const WALTZ = '共鸣解放·Liberation: Waltz of Forsaken Depths';
test('timeStop exclude: buffs started by a tsVerified whole-frozen action keep their full duration (弗洛洛 圆舞曲 fixture)', () => {
  const c = ex('team_phrolova.json', 30); c.actionFrames = withVerified(WALTZ, 'test fixture');
  const r = E.simulate(c, idx);
  const w = frozen(r).find((a) => a.key === 'waltz');
  assert.ok(w, '弗洛洛 casts 圆舞曲 (frozen, 0.05 s) when its frame entry is tsVerified');
  assert.ok(/^verified:/.test(w.tsBasis), w.tsBasis);
  const started = (r.buffUptime || []).filter((b) => b.intervals.some((iv) => Math.abs(iv[0] - w.endT) < 0.01));
  for (const b of started) {
    const iv = b.intervals.find((x) => Math.abs(x[0] - w.endT) < 0.01);
    const len = (iv[1] - iv[0]) + (b.residual || []).reduce((s, x) => s + x[1] - x[0], 0);
    assert.ok(len > 5, `${b.id} lasts ${len.toFixed(2)}s (fight time, not shortened by the freeze)`);
  }
});

test('toa default: only energy-consuming R is excluded; non-liberation time stops count full (今汐/清宵/守岸人/弗洛洛)', () => {
  for (const f of ['team_qingxiao.json', 'team_phrolova.json', 'jinhsi_solo.json']) {
    if (!fs.existsSync(path.join(__dirname, '../chars/examples', f))) continue;
    const r = E.simulate(ex(f), idx);
    for (const a of r.timeline.filter((x) => x.key && x.timeStop > 0)) {
      if (a.tsBasis === 'liberation') { assert.equal(a.cls, 'R'); assert.ok(a.timeStopSaved > 0, `${f} ${a.key}`); }
      else { assert.equal(a.tsBasis, 'not-liberation', `${f} ${a.key} ${a.tsBasis}`); assert.ok(!(a.timeStopSaved > 0), `${f} ${a.key} saved ${a.timeStopSaved}`); }
    }
  }
});

test('composite frame entries count the time stop once (max of parts, not sum)', () => {
  const L = E._frameLookup, R = { name: '今汐' }, lab = '共鸣技能·Skill 4: Illuminous Epiphany';
  const a = L(FRAMES, R, ['X'], { X: lab }), b = L(FRAMES, R, ['X'], { X: [lab, lab] });
  assert.ok(a && b && a.timeStop > 0, JSON.stringify(a));
  assert.ok(Math.abs(b.timeStop - a.timeStop) < 1e-9, `composite ts ${b.timeStop} vs single ${a.timeStop}`);
  assert.ok(Math.abs(b.duration - 2 * a.duration) < 1e-6, 'durations still sum');
  // 17:5x: the only shipped tsVerified entry is 奥古斯塔 赫日威临 (game text: 俯首之刻持续期间时间暂时停止; see MECHANICS §10)
  const ver = []; for (const [c, acts] of Object.entries(FRAMES.characters || {})) for (const [l, e] of Object.entries(acts || {})) if (e && e.tsVerified) ver.push(c + ' ' + l);
  assert.deepEqual(ver, ['奥古斯塔（Augusta） 共鸣解放·Liberation 2: Sublime is the Sun']);
});

test('timeStop include restores full animation time', () => {
  const a = E.simulate(Object.assign(ex('qingxiao_solo.json', 25), { timeStop: 'include' }), idx);
  assert.equal(frozen(a).length, 0);
});

// steering 16:44: module-gated frozen actions — count ≤ resource-implied max (each cast must consume its own gate since the previous cast)
function gateCheck(r, mi, key, gateKeys, startCharges, label) {
  const tl = r.timeline.filter((a) => a.mi === mi && a.key);
  let charges = startCharges, casts = 0, gates = 0;
  for (const a of tl) {
    if (gateKeys.includes(a.key)) { gates++; charges = 1; }
    else if (key.test(a.key)) { casts++; assert.ok(charges > 0, `${label}: ${a.key} @${a.t.toFixed(2)}s without a fresh gate (${gateKeys.join('/')})`); charges = 0; }
  }
  assert.ok(casts <= gates + startCharges, `${label}: ${casts} casts > ${gates} gates + ${startCharges}`);
  return { casts, gates };
}
for (const d of [25, 40]) {
  test(`gate: 清宵 强化重击（天钧荡煞）≤ 心剑（xj）次数 · ${d}s`, () => {
    for (const f of ['qingxiao_solo.json', 'team_qingxiao.json']) {
      const r = E.simulate(ex(f, d), idx);
      const g = gateCheck(r, 0, /^tjE?$/, ['xj'], 0, `清宵 ${f}`);
      assert.ok(g.casts >= 1, `清宵 ${f}: 强化重击 never cast`);
    }
  });
  test(`gate: 弗洛洛 圆舞曲 ≤ 定音（coda）次数 · ${d}s`, () => {
    // 17:20: solo search may skip 圆舞曲 now that it costs its full 4 s → gate only; casts ≥1 asserted on team_phrolova
    for (const f of ['phrolova_solo.json', 'team_phrolova.json']) {
      const r = E.simulate(ex(f, d), idx);
      const g = gateCheck(r, 0, /^waltz$/, ['coda'], 0, '弗洛洛 ' + f);
      if (f === 'team_phrolova.json') assert.ok(g.casts >= 1, '弗洛洛 圆舞曲 never cast in team');
    }
  });
  test(`gate: 守岸人 洞悉 ≤ 每个解限星域 1 次（R 次数）· ${d}s`, () => {
    const c = ex('team_qingxiao.json', d), mi = c.team.findIndex((m) => m.id === 1505);
    assert.ok(mi >= 0);
    const r = E.simulate(c, idx);
    const g = gateCheck(r, mi, /^dongxi$/, ['R'], 0, '守岸人');
    assert.ok(g.casts <= Math.floor(d / 25) + 1, `守岸人 洞悉 ×${g.casts}`);
  });
}
test('timeStopSaved: exclude > 0, include = 0, toggle changes total (清宵)', () => {
  const a = E.simulate(ex('team_qingxiao.json'), idx), b = E.simulate(Object.assign(ex('team_qingxiao.json'), { timeStop: 'include' }), idx);
  assert.ok(a.timeStopSaved > 0); assert.equal(b.timeStopSaved, 0);
  const sum = a.timeline.reduce((s, x) => s + (x.timeStopSaved || 0), 0);
  assert.ok(Math.abs(sum - a.timeStopSaved) < 0.01);
  assert.notEqual(Math.round(a.total), Math.round(b.total));
  assert.equal(E.toView(a).summary.timeStopSaved, a.timeStopSaved);
});
