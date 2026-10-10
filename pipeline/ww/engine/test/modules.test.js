'use strict';
// Character module tests: node --test /workspace/gamedata/pipeline/ww/engine/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const WW = require(path.join(__dirname, '../../../out/ww.json'));
const idx = E.indexData(WW);
const ex = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples', n), 'utf8'));
const manual = (f, seq, patch) => { const c = Object.assign(ex(f), patch || {}); c.rotation = { mode: 'manual', sequence: seq }; return E.simulate(c, idx); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
const FRAMES_PATH = path.join(__dirname, '../../validation/action_frames.json');
const FRAMES = fs.existsSync(FRAMES_PATH) ? JSON.parse(fs.readFileSync(FRAMES_PATH, 'utf8')) : null;
const resAt = (a) => a.res && a.res[a.mi];

test('registry: four modules registered by id with resource defs', () => {
  const ids = E.listChars().map((m) => m.id);
  for (const id of [1304, 1205, 1105, 1505]) assert.ok(ids.includes(id), 'module ' + id);
  for (const id of ids) {
    const m = E.getChar(id);
    assert.ok(m.name && m.version && m.confidence, 'meta ' + id);
    for (const r of m.resources || []) assert.ok(r.key && r.name && r.max > 0 && typeof r.segmented === 'boolean', 'resource def ' + id + ' ' + r.key);
  }
});

test('no module: manual works, search disabled with reason, view exposes searchable/noModule', () => {
  const c = ex('jinhsi_solo.json');
  // any resonator without a module (ids get modules over time: 相里要 1305 got one from stream B) — pick the first unmodelled 5★ rectifier-free id dynamically
  // 17:2x: all 64 resonators now have modules → fall back to 相里要 with module:false (same no-module code path)
  const noMod = [...idx.res.values()].find((R) => !E.getChar(R.id) && R.id < 1700) || Object.assign({ forced: true }, idx.res.get(1305));
  if (noMod.forced) c.team[0].module = false;
  c.team[0].id = noMod.id; c.team[0].weapon = { id: [0, 21010015, 21020015, 21030015, 21040015, 21050015][noMod.weaponType] || 21050016, level: 90, rank: 1 };
  c.rotation = { mode: 'search' };
  const r = E.simulate(c, idx);
  assert.equal(r.searchable, false);
  assert.ok(r.searchDisabledReason && (r.searchDisabledReason.includes(noMod.name) || /模块|module/.test(r.searchDisabledReason)));
  assert.ok(r.warnings.some((w) => /search|搜索/.test(w.code || '') || /搜索/.test(w.text || w.msg || '')), 'search-disabled warning');
  const v = E.toView(r);
  assert.equal(v.searchable, false);
  assert.ok(v.team[0].noModule && v.team[0].reason);
  assert.ok(v.searchDisabled);
  c.rotation = { mode: 'manual', sequence: 'A A A A E R' };
  const m = E.simulate(c, idx);
  assert.ok(m.total > 0 && m.timeline.length >= 5, 'manual sequence still runs');
  // module:false on a moduled character also disables search
  const c2 = ex('jinhsi_solo.json'); c2.team[0].module = false; c2.rotation = { mode: 'search' };
  assert.equal(E.simulate(c2, idx).searchable, false);
});

test('今汐: A4 → 神霓飞芒 → 凌霄 A×4 → 惊龙破空 consumes 韶光', () => {
  const r = manual('jinhsi_solo.json', 'A A A A E A A A A E E');
  const keys = r.timeline.map((a) => a.key);
  assert.deepEqual(keys.slice(0, 11), ['A1', 'A2', 'A3', 'A4', 'shenni', 'lxA1', 'lxA2', 'lxA3', 'lxA4', 'jinglong', 'E']);
  const jl = r.timeline[9];
  assert.equal(resAt(r.timeline[8]).sg, 50);
  assert.equal(resAt(jl).sg, 0, '韶光 consumed');
  assert.ok(jl.damage > 5 * r.timeline[10].damage, '惊龙破空 with 50 韶光 is the big hit');
  assert.ok('sg' in r.final[0].resources);
});

test('今汐: 惊龙破空 without 游龙 is not available (E falls back to the normal skill)', () => {
  const r = manual('jinhsi_solo.json', 'E');
  assert.equal(r.timeline[0].key, 'E');
});

test('长离: 赫羽三相 charges gate E; 离火 4 enables 焚身以火', () => {
  const r = manual('changli_solo.json', 'E E E');
  assert.equal(r.steps[2].ok, false);
  assert.match(r.steps[2].reason, /次数/);
  const r2 = manual('changli_solo.json', 'E E A H R H');
  const R = r2.timeline.find((a) => a.cls === 'R');
  assert.equal(resAt(R).lihuo, 4);
  const last = r2.timeline[r2.timeline.length - 1];
  assert.equal(last.key, 'fenshen');
  assert.equal(resAt(last).lihuo, 0);
});

test('折枝: 灵韵 builds from basics, 构形 → 神来之笔 → 极意 chain', () => {
  const r = manual('zhezhi_solo.json', 'E A E A H E');
  const keys = r.timeline.filter((a) => a.cls !== 'W').map((a) => a.key);
  assert.deepEqual(keys, ['E', 'A1', 'E', 'A1', 'gouxing', 'shenlai']);
  const g = r.timeline.find((a) => a.key === 'gouxing');
  assert.equal(resAt(g).ly, 0, '灵韵 consumed by 构形');
  assert.equal(resAt(r.timeline.find((a) => a.key === 'shenlai')).jy, 1);
});

test('守岸人: basics build 实论数据/坍缩核, 演绎 evolves cores into coordinated butterflies', () => {
  const r = manual('shorekeeper_solo.json', 'R A A A A H');
  const y = r.timeline.find((a) => a.key === 'yanyi');
  assert.ok(y, '演绎 replaces H at 5 data');
  assert.equal(resAt(y).data, 0);
  const b = r.timeline.find((a) => a.coord && a.key === 'butterfly');
  assert.ok(b && b.damage > 0);
  assert.equal(resAt(r.timeline.find((a) => a.cls === 'R')).field, 1);
});

// share of the most frequent resolved action (timeline key; button presses resolve to different stages/forms)
const topShare = (tl) => {
  const toks = tl.filter((a) => !a.coord && a.cls !== 'W').map((a) => a.key);
  const n = {}; for (const t of toks) n[t] = (n[t] || 0) + 1;
  return Math.max(...Object.values(n)) / toks.length;
};
test('search (with action_frames when present): 今汐 / 长离 rotations use their mechanics and are not one-action spam', () => {
  const j = ex('jinhsi_solo.json'); j.rotation = { mode: 'search' }; if (FRAMES) j.actionFrames = FRAMES;
  const rj = E.simulate(j, idx);
  assert.ok(rj.searchable);
  assert.ok(topShare(rj.timeline) < 0.5, '今汐 ' + rj.sequence);
  assert.ok(rj.timeline.some((a) => a.key === 'jinglong'), '今汐 search reaches 惊龙破空');
  const rc = E.simulate(Object.assign(ex('changli_solo_search.json'), FRAMES ? { actionFrames: FRAMES } : {}), idx);
  assert.ok(topShare(rc.timeline) < 0.5, '长离 ' + rc.sequence);
  assert.ok(rc.timeline.some((a) => a.key === 'fenshen'), '长离 search reaches 焚身以火');
});

test('gear: signature weapon beats generic options (今汐 / 长离 solo)', () => {
  const runs = [['jinhsi_solo.json', [21010016, 21010015, 21010036], { rotation: { mode: 'search' } }],
    ['changli_solo_search.json', [21020015, 21020026, 21020066], {}],
  ];
  for (const [f, ws, patch] of runs) {
    const c = Object.assign(ex(f), patch);
    c.search = { beamWidth: 48, maxExpansions: 60000, topN: 3 };
    if (FRAMES) c.actionFrames = FRAMES;
    const out = E.compareGear(c, idx, E.weaponVariants(idx, 0, ws), { researchRotation: true });
    assert.ok(out.rows[0].cur, f + ' signature (current) ranks first: ' + out.rows.map((r) => r.label + ' ' + Math.round(r.total)).join(', '));
  }
});

test('action frames: loaded durations replace defaults, est=false, durSource=frames', () => {
  const frames = { version: 'test', source: 'unit', characters: { 1304: { actions: { A1: 0.5, shenni: { frames: 90, fps: 60 } } } } };
  const c = ex('jinhsi_solo.json'); c.actionFrames = frames; c.rotation = { mode: 'manual', sequence: 'A A A A E' };
  const r = E.simulate(c, idx);
  const a1 = r.timeline[0], sh = r.timeline[4];
  assert.equal(a1.est, false); assert.equal(a1.durSource, 'frames'); near(a1.endT - a1.t, 0.5);
  assert.equal(sh.est, false); near(sh.endT - sh.t, 1.5);
  assert.equal(r.timeline[1].est, true, 'A2 not in frames → estimated');
  assert.ok(r.framesLoaded);
  const v = E.toView(r);
  const lane = v.timeline.lanes[0].actions;
  assert.equal(lane[0].est, false); assert.equal(lane[1].est, true);
});

test('view: resources / est / autoOff data for frontend batch 4', () => {
  const v = E.toView(E.simulate(ex('team_jinhsi.json'), idx));
  assert.equal(v.searchable, true);
  assert.ok(v.team.every((t) => typeof t.noModule === 'boolean'));
  assert.ok(v.resources.length >= 4);
  for (const r of v.resources) {
    assert.ok(r.label && r.max > 0 && typeof r.segmented === 'boolean');
    assert.ok(Array.isArray(r.series));
    if (r.segmented) assert.ok(Array.isArray(r.cells) && r.cells.length === r.max);
    assert.ok(typeof r.path === 'string');
  }
  assert.ok(v.timeline.lanes.every((l) => l.actions.every((a) => typeof a.est === 'boolean')));
  assert.ok(v.buffs.every((b) => typeof b.autoOff === 'boolean'));
});

test('action_frames.json (scraper shape): durations, est kept, dur/durReason, null + missing + outro + echo handling, swap rule', () => {
  const fp = path.join(__dirname, '../../validation/action_frames.json');
  if (!fs.existsSync(fp)) return;
  const frames = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const c = ex('jinhsi_solo.json'); c.actionFrames = frames; c.rotation = { mode: 'manual', sequence: 'A A A A E A A A A E Q' };
  const r = E.simulate(c, idx);
  const byKey = Object.fromEntries(r.timeline.map((a) => [a.key, a]));
  near(byKey.A1.endT - byKey.A1.t, 28 / 60);                 // Slash of Breaking Dawn 1: 28f
  near(byKey.shenni.endT - byKey.shenni.t, 1.4);             // module map → Skill 2: Overflowing Radiance
  // Skill 4: Illuminous Epiphany 2.9 s total with 2.2 s time-stop.
  // 17:20 steering (WuWaSim toa): only energy-consuming liberation cutscenes are excluded by default → 惊龙破空 (forte E, not R) now counts the full 2.9 s
  // under 'exclude' too (was 0.7 s). Expectation change documented in MECHANICS §10.
  near(byKey.jinglong.endT - byKey.jinglong.t, 2.9);
  assert.ok(byKey.jinglong.timeStop > 0, 'jinglong has time-stop frames');
  assert.equal(byKey.jinglong.tsBasis, 'not-liberation');
  assert.equal(byKey.jinglong.timeStopSaved, 0);
  const ci = Object.assign(ex('jinhsi_solo.json'), { actionFrames: frames, timeStop: 'include', rotation: c.rotation });
  const ji = E.simulate(ci, idx).timeline.find((a) => a.key === 'jinglong');
  near(ji.endT - ji.t, 2.9);
  assert.equal(byKey.A1.est, true, 'community frames stay est');
  assert.equal(byKey.A1.durSource, 'frames');
  assert.equal(byKey.Q.durSource, 'default', 'echo skills keep default');
  const v = E.toView(r);
  const lane = v.timeline.lanes[0].actions;
  const a1 = lane.find((a) => a.key === 'A1'), q = lane.find((a) => a.key === 'Q');
  assert.equal(a1.dur, 'frames'); assert.equal(a1.durReason, null); assert.equal(a1.est, true);
  assert.equal(q.dur, 'default'); assert.ok(q.durReason && /声骸/.test(q.durReason));
  assert.ok(r.warnings.some((w) => w.code === 'dur-frames') && r.warnings.some((w) => w.code === 'swap-rule'));
  // character missing from frames → defaults + warning (相里要)
  const c2 = ex('jinhsi_solo.json'); c2.team[0].id = 1305; c2.team[0].weapon = { id: 21050016, level: 90, rank: 1 };
  // round 3 covers all 64 ids → drop 相里要 from a copy to exercise the missing-character path
  const fr2 = Object.assign({}, frames, { characters: Object.fromEntries(Object.entries(frames.characters).filter(([k]) => !k.startsWith('相里要'))) });
  c2.actionFrames = fr2; c2.rotation = { mode: 'manual', sequence: 'A E R' };
  const r2 = E.simulate(c2, idx);
  assert.ok(r2.timeline.every((a) => a.durSource !== 'frames'));
  assert.ok(r2.warnings.some((w) => w.code === 'frames-missing'));
  // null source entry (散华 Basic 1 conflicting) → default + warning
  const c3 = ex('jinhsi_solo.json'); c3.team[0].id = 1102; c3.team[0].weapon = { id: 21020016, level: 90, rank: 1 };
  c3.actionFrames = frames; c3.rotation = { mode: 'manual', sequence: 'A E' };
  const r3 = E.simulate(c3, idx);
  const fn = r3.warnings.filter((w) => w.code === 'frames-null');
  const a1s = r3.timeline.find((a) => a.key === 'A1');
  assert.equal(a1s.durSource, 'default', '散华 A1 conflicting sources → default');
  assert.ok(fn.length >= 1 && /不一致/.test(a1s.durReason || ''));
  // outro: 0 s, flagged
  const t = E.simulate(Object.assign(ex('team_jinhsi.json'), { actionFrames: frames, rotation: { mode: 'manual', sequence: 'S2 S1 A' } }), idx);
  const o = t.timeline.find((a) => a.cls === 'O');
  near(o.endT - o.t, 0); assert.equal(o.est, true); assert.ok(/延奏/.test(o.durReason));
});

test('swap rule: swap leaves the outgoing action at max(no_swap, earliest_cancel)', () => {
  const frames = { characters: { 1304: { actions: { A1: { duration: 1.0, cancel: 0.4, noSwap: 0 } } } } };
  const c = ex('team_jinhsi.json'); c.actionFrames = frames; c.start = { energy: 'full', concerto: 0 }; c.rotation = { mode: 'manual', sequence: 'S1 A S2', start: 2 };
  const r = E.simulate(c, idx);
  const tl = r.timeline;
  const a = tl.find((x) => x.key === 'A1'); const sw = tl[tl.length - 1];
  near(sw.t, a.t + 0.4);
  assert.ok(sw.swapCut);
  const c2 = Object.assign({}, c, { swapRule: 'full' });
  const tl2 = E.simulate(c2, idx).timeline;
  near(tl2[tl2.length - 1].t, tl2.find((x) => x.key === 'A1').t + 1.0);
});

// 折枝 (琼枝冰绡) / 守岸人 (星序协响): the signature value is mostly team-side (off-field / outro buffs, ER), so solo
// personal damage is not a fair test (折枝 solo margin is within search noise; 守岸人 solo ranks it last). Check in a team.
test('gear: supports\' signature weapons win in the cold team (折枝 琼枝冰绡, 守岸人 星序协响)', () => {
  for (const [mi, ws] of [[1, [21050015, 21050016, 21050046]], [2, [21050015, 21050045, 21050066]]]) {
    const c = ex('team_jinhsi_cold.json');
    if (FRAMES) c.actionFrames = FRAMES;
    const out = E.compareGear(c, idx, E.weaponVariants(idx, mi, ws), { researchRotation: true });
    assert.ok(out.rows[0].cur, 'member ' + mi + ': ' + out.rows.map((r) => r.label + ' ' + Math.round(r.total)).join(', '));
  }
});
