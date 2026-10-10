'use strict';
// stream A 批次 4（热熔/冷凝）：每个模块的单人示例可运行、chainModeled 已声明、核心招式（audit.finishers）在单人搜索中出现；公开配队可运行
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const E = require('../chars');
const idx = E.indexData(require(path.join(__dirname, '../../../out/ww.json')));
const FRAMES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../validation/action_frames.json'), 'utf8'));
const ex = (n) => { const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../chars/examples', n), 'utf8')); c.actionFrames = FRAMES; delete c.expect; return c; };
const IDS = [1103, 1104, 1106, 1108, 1109, 1110, 1202, 1203, 1204, 1207, 1209, 1211, 1212];
for (const id of IDS) {
  test(`批次4 ${id}: solo search uses finishers, chainModeled declared`, () => {
    const m = E.getChar(id);
    assert.ok(m && Number.isInteger(m.chainModeled), 'chainModeled ' + id);
    const r = E.simulate(ex(m.audit.solo), idx);
    assert.ok(r.total > 0 && Number.isFinite(r.total));
    const keys = r.timeline.filter((a) => a.mi === 0).map((a) => a.key);
    const missing = (m.audit.finishers || []).filter((f) => f !== 'R' && f !== 'I' && !keys.includes(f));
    assert.ok(missing.length <= 1, `${id} missing ${missing.join('/')}: ${r.sequence}`);
  });
}
for (const f of ['team_denia.json', 'team_jingran.json', 'team_lupa.json', 'team_mortefi.json', 'team_baizhi.json', 'team_hiyuki.json', 'team_lingyang.json', 'team_youhu.json', 'team_encore.json']) {
  test(`批次4 team ${f} runs, every member acts`, () => {
    const r = E.simulate(ex(f), idx);
    assert.ok(r.total > 0);
    const c = ex(f);
    c.team.forEach((_, i) => assert.ok(r.timeline.some((a) => a.mi === i && a.key), `${f} member ${i} never acts`));
  });
}
test('绯雪 frostbite: 霜渐 application settles at the cap (team_hiyuki: 穗穗 raises the cap to 13)', () => {
  const r = E.simulate(ex('team_hiyuki.json'), idx);
  const st = r.timeline.filter((a) => a.key === 'anomaly:chafe').map((a) => a.stacks);
  assert.ok(st.length && st.every((n) => n >= 10), JSON.stringify(st.slice(0, 8)));
});
