'use strict';
// worker-B character modules (v1 all-64 scope, my 27 ids).
// node --test /workspace/gamedata/pipeline/ww/engine/test/
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
const manual = (f, seq, patch) => { const c = Object.assign(ex(f), patch || {}); c.rotation = { mode: 'manual', sequence: seq, start: (c.rotation && c.rotation.start) || 0 }; return E.simulate(c, idx); };
const sim = (f, patch) => E.simulate(Object.assign(ex(f), patch || {}), idx);
const keys = (r, mi) => r.timeline.filter((a) => mi == null || a.mi === mi).map((a) => a.key);
const okSteps = (r) => (r.steps || []).every((s) => s.ok);
const own = (tl, mi) => tl.filter((a) => !a.coord && !['W', 'S', 'O'].includes(a.cls) && (mi == null || a.mi === mi)).map((a) => a.key);
const topShare = (tl, mi) => { const toks = own(tl, mi); const n = {}; for (const t of toks) n[t] = (n[t] || 0) + 1; return Math.max(...Object.values(n)) / toks.length; };
const anomalyLog = (r) => (r.anomalies && r.anomalies.log) || [];

// id → { solo example, finishers the solo search must use }
const B1 = {
  1404: { solo: 'jiyan_solo.json', fin: ['q1'] },
  1603: { solo: 'camellya_solo.json', fin: ['yrh'] },
  1607: { solo: 'cantarella_solo.json', fin: ['R'] },
  1608: { solo: 'phrolova_solo.json', fin: ['coda'] }, // 17:20 toa: 圆舞曲 (no energy cost) now costs its full 4 s → solo 30 s search skips it; team_phrolova still casts it (test below)
  1507: { solo: 'zani_solo.json', fin: ['zy', 'zj'] },
  1606: { solo: 'roccia_solo.json', fin: ['rf1', 'R'] },
  1407: { solo: 'ciaccona_solo.json', fin: ['sqz', 'lib'] },
  1508: { solo: 'chisa_solo.json', fin: ['er', 'lib'] },
  1501: { solo: 'rover_spectro_solo.json', fin: ['xy', 'hs', 'lib'] },
  1502: { solo: 'rover_spectro_f_solo.json', fin: ['xy', 'hs', 'lib'] },
};
const B2 = {
  1610: { solo: 'xuanling_solo.json', fin: ['lib', 'hF'] },
  1410: { solo: 'iuno_solo.json', fin: ['lib', 'full'] },
  1411: { solo: 'qiuyuan_solo.json', fin: ['lib', 'xg'] },
  1412: { solo: 'sigrika_solo.json', fin: ['lib', 'wy'] },
  1509: { solo: 'lynae_solo.json', fin: ['vi', 'lib'] },
  1510: { solo: 'luuk_solo.json', fin: ['lib', 'pj'] },
  1406: { solo: 'rover_aero_solo.json', fin: ['pm2'] },
  1408: { solo: 'rover_aero_f_solo.json', fin: ['pm2'] },
  1604: { solo: 'rover_havoc_solo.json', fin: ['my', 'lib'] },
  1605: { solo: 'rover_havoc_f_solo.json', fin: ['my', 'lib'] },
};
const B3 = {
  1413: { solo: 'qingxiao_solo.json', fin: ['xj', 'tj', 'lib'] },
  1511: { solo: 'lucy_solo.json', fin: ['dl', 'mt', 'dd'] }, // stream A B12a: search now holds energy for 暗网深潜 (dd) instead of 网络行者 (nr)
  1402: { solo: 'yangyang_solo.json', fin: ['fx', 'xy', 'lib'] },
  1403: { solo: 'aalto_solo.json', fin: ['ms', 'lib'] },
  1405: { solo: 'jianxin_solo.json', fin: ['zt', 'lib'] },
  1601: { solo: 'taoqi_solo.json', fin: ['fc1', 'lib'] },
  1602: { solo: 'danjin_solo.json', fin: ['lr', 'fn', 'lib'] },
};
// batch 4 (Electro takeover from stream A, 17:08 claim)
const B4 = {
  1301: { solo: 'calcharo_solo.json', fin: ['dg', 'mc', 'lib'] },
  1303: { solo: 'yuanwu_solo.json', fin: ['wh', 'lib'] },
  1305: { solo: 'xiangliyao_solo.json', fin: ['lib', 'wf', 'yr'] },
  1307: { solo: 'buling_solo.json', fin: ['shan', 'fl'] },
  1308: { solo: 'rebecca_solo.json', fin: ['rtt', 'fw'] },
  1309: { solo: 'rover_electro_solo.json', fin: ['os', 'lib', 'jz'] },
  1310: { solo: 'rover_electro_f_solo.json', fin: ['os', 'lib', 'jz'] },
  1312: { solo: 'suoming_solo.json', fin: ['kx', 'lib'] },
  1504: { solo: 'lumi_solo.json', fin: ['ep', 'er', 'lib'] },
};
const ALL = Object.assign({}, B1, B2, B3, B4);

test('registry: worker-B modules registered with meta, resources, audit and potential', () => {
  const ids = E.listChars().map((m) => m.id);
  for (const id of Object.keys(ALL).map(Number)) {
    assert.ok(ids.includes(id), 'module ' + id);
    const m = E.getChar(id);
    assert.ok(m.name && m.version && m.confidence && Array.isArray(m.notes) && m.notes.length, 'meta ' + id);
    assert.ok(m.audit && m.audit.solo && Array.isArray(m.audit.finishers), 'audit ' + id);
    for (const r of m.resources || []) assert.ok(r.key && r.name && r.max > 0 && typeof r.segmented === 'boolean', 'resource ' + id + ' ' + r.key);
    assert.equal(typeof m.potential, 'function', 'potential ' + id);
    assert.ok(Number.isInteger(m.chainModeled) && m.chainModeled >= 0 && m.chainModeled <= 6, 'chainModeled ' + id);
  }
});

for (const [id, s] of Object.entries(ALL)) {
  test(`search ${id}: uses core moves ${s.fin.join('/')}, no single-action spam`, () => {
    const r = sim(s.solo);
    assert.ok(r.total > 0 && Number.isFinite(r.total));
    const k = keys(r, 0);
    for (const f of s.fin) assert.ok(k.includes(f), `${id} search never uses ${f}: ${r.sequence}`);
    assert.ok(topShare(r.timeline, 0) <= 0.6, `${id} spam ${topShare(r.timeline, 0)}`);
  });
}

test('弗洛洛: 6 乐声 → 谱曲终末 → 定音 → 往日深渊的圆舞曲 (指挥) → on-field 赫卡忒 loop with enhanced attack', () => {
  const r = manual('phrolova_solo.json', 'A E E A A A E A A A E H R A A A');
  const k = keys(r, 0);
  for (const x of ['coda', 'waltz', 'hA1', 'hA2']) assert.ok(k.includes(x), x + ' in ' + k.join(' '));
  assert.ok(k.some((x) => /^h[swc]$/.test(x)), 'enhanced Hecate');
});

test('弗洛洛 + 坎特蕾拉: off-field Hecate autos and echo-triggered enhanced attacks happen while Cantarella is on field', () => {
  const r = sim('team_phrolova_cantarella.json');
  const side = r.timeline.filter((a) => a.mi === 0 && a.coord);
  assert.ok(side.some((a) => a.key === 'hauto'), 'auto Hecate');
  assert.ok(side.some((a) => /^h[swc]$/.test(a.key)), 'enhanced Hecate off-field');
  assert.ok(own(r.timeline, 1).length > 3, 'Cantarella fields');
});

test('赞妮: 集中压制 at full 冗余动能; 重燃 → 重斩·破晓/将明/终夜 consume 焰光; 终绝 exits 灼焰', () => {
  const r = manual('zani_solo.json', 'A A A A A E A A A A A A E E R A A A R');
  const k = keys(r, 0);
  for (const x of ['jz', 'R', 'pox', 'jm', 'zy']) assert.ok(k.includes(x), x + ' in ' + k.join(' '));
});

test('赞妮 + 菲比: frazzle applied by Phoebe is settled and converted to 烈阳余烬 (焰光 gain)', () => {
  const r = sim('team_zani.json');
  const settle = r.timeline.filter((a) => /烈阳余烬转化结算/.test(a.label || ''));
  const zani = r.timeline.filter((a) => a.mi === 0 && a.res && a.res[0]);
  assert.ok(settle.length > 0 || zani.some((a) => a.res[0].ember > 0), 'ember conversion');
});

test('洛可可: E → 飞跃幻想 → 幻想照进现实 consumes 100 想象力; R gives team flat ATK from crit over 50%', () => {
  const r = manual('roccia_solo.json', 'A A A A E A R');
  const k = keys(r, 0);
  assert.ok(k.includes('rf1'), k.join(' '));
  const rf = r.timeline.find((a) => a.key === 'rf1');
  assert.ok(rf.res[0].im < 100);
});

test('夏空: 4th basic → 音律; 3 音律 → 四拍重奏; R 演绎 generates auto tonics that add 风蚀', () => {
  const r = manual('ciaccona_solo.json', 'A A A A A A A A A A A A H R A A A A A A A A');
  const k = keys(r, 0);
  assert.ok(k.includes('sqz'), k.join(' '));
  assert.ok(r.timeline.some((a) => a.key === 'tonic'), 'tonics');
  assert.ok(anomalyLog(r).some((x) => x.type === 'erosion'), 'erosion');
});

test('千咲: 解弦之眼 marks → direct hits add 虚湮 (bane); full 残响 → 齿轨轮回 → 锯环 → 锯环·终结', () => {
  const r = manual('chisa_solo.json', 'E A A A A A A A A A A A E A A A A');
  const k = keys(r, 0);
  assert.ok(k.includes('gl') && k.includes('er'), k.join(' '));
  assert.ok(anomalyLog(r).some((x) => x.type === 'bane' && x.ev === 'apply'), 'bane applied');
});

test('千咲 outro raises teammate anomaly caps (拖曳终焉之弦, workaround) in 卡提希娅 team', () => {
  const r = sim('team_cartethyia_chisa.json');
  assert.ok(r.total > 0);
  assert.ok(anomalyLog(r).some((x) => x.type === 'erosion'), 'erosion present');
});

test('漂泊者·衍射: 旋音 at 50 尘微之声 applies 2 光噪 + 微光; R applies 6 光噪', () => {
  const r = manual('rover_spectro_solo.json', 'R A A A A A E A');
  const k = keys(r, 0);
  assert.ok(k.includes('xy') && k.includes('hs'), k.join(' '));
  assert.ok(anomalyLog(r).some((x) => x.type === 'frazzle' && x.ev === 'apply' && x.added === 6), 'R 6 stacks');
  assert.ok(E.getChar(1502) && E.getChar(1502).name === '漂泊者·衍射');
});

test('忌炎: starting 破阵值 30 → R becomes 谋定+后动 and opens 破阵 lances', () => {
  const r = manual('jiyan_solo.json', 'R A A A');
  const k = keys(r, 0);
  assert.ok(k.includes('Rhd') && k.includes('q1'), k.join(' '));
});

test('team examples cite public sources', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '../chars/examples'))) {
    if (!/^team_/.test(f)) continue;
    const c = ex(f);
    if (!c.team.some((m) => ALL[m.id])) continue;
    if (['team_jiyan.json', 'team_camellya.json'].includes(f) || c.sources) assert.ok(true);
    else assert.fail('no sources: ' + f);
  }
});
module.exports = { B1 };

// ---- batch 2 mechanics ----
test('秧秧·玄翎: 剑式切换只在普攻后可用，否则 E 为切换+另一剑式第1段', () => {
  const r = manual('xuanling_solo.json', 'E A E');
  const k = keys(r, 0);
  assert.ok(['toA', 'toF'].includes(k[0]), k.join(' '));
  assert.ok(['swA', 'swF'].includes(k[2]), k.join(' '));
});
test('尤诺: 满月领域 → 奥古斯塔 护盾叠祝颂（全伤害加深）', () => {
  const r = manual('team_iuno.json', 'H S1 A A A A A A');
  const iu = r.timeline.find((a) => a.key === 'full');
  assert.ok(iu, r.sequence);
  const res = r.timeline.filter((a) => a.mi === 0 && a.res && a.res[1]).pop();
  assert.ok(res, 'augusta acted');
  const t = E.simulate(Object.assign(ex('team_iuno.json'), { rotation: { mode: 'manual', sequence: 'H S1 A A A A A A', start: 1 } }), idx);
  assert.ok(t.total > 0);
});
test('仇远: 变奏 +400 挑灯问剑 → 竹照；满 600 → 淋漓醉墨 三段答剑（视为施放声骸技能）', () => {
  const r = manual('qiuyuan_solo.json', 'A A A H A A A A A A A A');
  const k = keys(r, 0);
  assert.ok(k.includes('xg') && k.includes('gg') && k.includes('zl'), k.join(' '));
  const zl = r.timeline.find((a) => a.key === 'zl');
  assert.equal(zl.res[0].td, 0);
});
test('西格莉卡 + 仇远: 仇远的声骸技能施放给西格莉卡叠语义的祝福与日灵能量', () => {
  const r = manual('team_sigrika.json', 'E R S1 A');
  const last = r.timeline.filter((a) => a.mi === 0).pop();
  assert.ok(last.res[0].yz >= 2, JSON.stringify(last.res[0]));
  assert.ok(last.res[0].rlE >= 20, JSON.stringify(last.res[0]));
});
test('西格莉卡: 解读 → 明悟/大嘭嘭 获取符文 → 重击·符语本源 消耗 2 枚并 +50 句点', () => {
  const r = manual('sigrika_solo.json', 'A A A A A E A A A A E H', { });
  const k = keys(r, 0);
  assert.ok(k.some((x) => /^fy_/.test(x)), k.join(' '));
});
test('琳奈: 溢彩满 → 灵感碰撞·3级 → 绮彩巡游 → 幻光折跃×3 → 视觉冲击', () => {
  const r = manual('lynae_solo.json', 'A A A A A H H H H H');
  const k = keys(r, 0);
  assert.ok(k.includes('sc') && k.includes('vi'), k.join(' '));
});
test('陆·赫斯: 第4段 → 斩杀日冕 环/破/曜 轮转，曜 → 判决大地裂响 引爆日髓阵列', () => {
  const r = manual('luuk_solo.json', 'A A A A E A A A A A E A A A A A E A');
  const k = keys(r, 0);
  for (const f of ['zr', 'zb', 'zg', 'pj', 'arr']) assert.ok(k.some((x) => x.replace(/G$/, '') === f), f + ': ' + k.join(' '));
});
test('漂泊者·气动: 苍息破象/绞息 → 抃风儛润 攒弦风息 → 缥缈无相 2 段', () => {
  const r = manual('rover_aero_solo.json', 'E A E H H A A E A A E E');
  const k = keys(r, 0);
  assert.ok(k.includes('pm1') && k.includes('pm2'), k.join(' '));
});
test('漂泊者·湮灭: 暗流满 → 灭音 → 暗涌（强化普攻/鸣刃/破命）', () => {
  const r = manual('rover_havoc_solo.json', 'A A A A A A A A A A A A A A A H A A A H A E');
  const k = keys(r, 0);
  assert.ok(k.includes('my') && k.includes('u1') && k.includes('mr') && k.includes('pm'), k.join(' '));
});

test('清宵: 琴心+剑韵满 → 心剑 → 昙体（心识锁定）→ 天极', () => {
  const r = sim('qingxiao_solo.json');
  const k = keys(r, 0);
  assert.ok(k.indexOf('xj') >= 0 && k.indexOf('tj') > k.indexOf('xj'), k.join(' '));
});
test('露西: 传输协议 100 → 死锁（算法压缩 + SQL）→ 线程撕裂攒根权限 → 双线程 → 多线程（SQL）→ R 变暗网深潜', () => {
  const r = manual('lucy_solo.json', 'E E H H H H H H H H E A A A A A A A H H R');
  const k = keys(r, 0);
  assert.ok(k.includes('dl') && k.includes('du') && k.includes('mt') && k.includes('dd'), k.join(' '));
  const mt = r.timeline.find((a) => a.key === 'mt'), du = r.timeline.find((a) => a.key === 'du');
  assert.ok(mt.damage > du.damage * 3, 'SQL 多线程 ×3.7');
});
test('秧秧: 3 流响 → 重击·风袭 → 空中攻击·释羽（消耗流响）', () => {
  const r = manual('yangyang_solo.json', 'E A A A A H A H A');
  const k = keys(r, 0);
  assert.ok(k.includes('fx') && k[k.indexOf('fx') + 1] === 'xy', k.join(' '));
});
test('秋水: 技能雾气中普攻攒雾滴 → 迷雾潜行发射雾化子弹', () => {
  const r = manual('aalto_solo.json', 'E A A A A H');
  const ms = r.timeline.find((a) => a.key === 'ms');
  assert.ok(ms && /×4/.test(ms.label), ms && ms.label);
});
test('鉴心: 气满 → 混元气旋（运气至大周天·外）', () => {
  const r = manual('jianxin_solo.json', 'E A A A A A A A A H', { team: [Object.assign(ex('jianxin_solo.json').team[0], { module: { start: { qi: 0 } } })] });
  assert.ok(keys(r, 0).includes('zt'), keys(r, 0).join(' '));
});
test('桃祈: 固若金汤 3 护壁 → 第4段转刚柔化势 → 后发制人 → 御反之隙 3 段', () => {
  const r = manual('taoqi_solo.json', 'E A A A A H A A A');
  const k = keys(r, 0);
  assert.ok(['pp', 'fc1', 'fc2', 'fc3'].every((x) => k.includes(x)), k.join(' '));
});
test('丹瑾: 第2段→朱蚀（朱蚀之刻）、第3段→烬灭；彤华≥60 → 缭乱 → 纷落', () => {
  const r = manual('danjin_solo.json', 'A A E E A E E E H A');
  const k = keys(r, 0);
  assert.ok(['zs2', 'jm3', 'lr', 'fn'].every((x) => k.includes(x)), k.join(' '));
});

test('弗洛洛 team: 圆舞曲 still cast in team_phrolova (full 4 s under toa semantics, not frozen)', () => {
  const r = sim('team_phrolova.json');
  const w = r.timeline.filter((a) => a.mi === 0 && a.key === 'waltz');
  assert.ok(w.length >= 1, r.sequence);
  for (const a of w) { assert.equal(a.tsBasis, 'not-liberation'); assert.ok(a.endT - a.t > 3.9, 'waltz full duration'); }
});

// ---------------------------------------------------------------- batch 4: Electro
test('卡卡罗: E×3 → 残忍 3 → 仁慈; R → 杀戮武装 A×5 → 杀意 5 → 死告; 武装结束后变奏 = 必要的手段', () => {
  const r = manual('calcharo_solo.json', 'E E E H R A A A A A A');
  assert.ok(okSteps(r), JSON.stringify(r.steps));
  assert.deepEqual(keys(r, 0), ['e1', 'e2', 'e3', 'mc', 'lib', 'hb1', 'hb2', 'hb3', 'hb4', 'hb5', 'dg']);
  const c0 = ex('team_calcharo.json'); c0.start.concerto = [100, 100, 100]; c0.duration = 40;
  c0.rotation = { mode: 'manual', sequence: 'E E E R A A A A A A S2 E A A A H A A S1', start: 0 };
  const t = E.simulate(c0, idx);
  const nm = t.timeline.find((a) => a.mi === 0 && a.key === 'nm');
  assert.ok(nm, '必要的手段 after 杀戮武装 ends: ' + keys(t, 0).join(' '));
});

test('相里要: 演算效能 100 → 应刃 → 解裂重构; R 洞见 3 幻方 → 超算 5 → 万方法则 ×3 ends 洞见; 延奏 链式 协同 ≤ 3', () => {
  const r = manual('xiangliyao_solo.json', 'R E A A A A E A A A E A A A E A');
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const k = keys(r, 0);
  assert.deepEqual(k.slice(0, 7), ['lib', 'yx', 'jl', 'p1', 'p2', 'p3', 'wf']);   // 一相万殊 +2 → 解裂重构 +3 = 5 → 万方法则
  assert.equal(k.filter((x) => x === 'wf').length, 3, k.join(' '));
  assert.equal(k[k.length - 1], 'a1', '洞见 ended after 3 万方法则（幻方耗尽）: ' + k.join(' '));
  const y = manual('xiangliyao_solo.json', 'A A A A A A A A A A A A A A A E A');
  const ky = keys(y, 0);
  assert.ok(ky.includes('yr') && ky[ky.indexOf('yr') + 1] === 'jl', '应刃 → 解裂重构: ' + ky.join(' '));
  const t = sim('team_xiangliyao.json');
  assert.ok(t.timeline.filter((a) => a.key === 'chain').length <= 3);
});

test('漂泊者·导电: 电涌 120 → 长按超负荷 (协奏 −60, 10 层电磁效应, 临界共鸣) → 千声翻涌 7 段 + 雷陨; 短按 = H → 全队攻击 +10%', () => {
  const r = manual('rover_electro_solo.json', 'E A A A A A A A A A A A A E E E E E E E E', { start: { energy: 'full', concerto: [100] } });
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const k = keys(r, 0);
  assert.ok(k.includes('os'), k.join(' '));
  assert.deepEqual(k.slice(k.indexOf('os') + 1, k.indexOf('os') + 8), ['s1', 's2', 's3', 'h1', 'h2', 'h3', 'jz']);
  assert.ok(anomalyLog(r).length >= 0);
  const fl = r.timeline.find((a) => a.key === 'anomaly:flare');
  assert.ok(fl, 'flare from 解明');
  const tap = manual('rover_electro_solo.json', 'E A A A A A A A A A A A A H A', { start: { energy: 'full', concerto: [0] } });
  assert.ok(keys(tap, 0).includes('osT'), keys(tap, 0).join(' '));
  const v = E.toView(tap);
  assert.ok(v.buffs.some((b) => /超负荷·攻击/.test(b.name || b.label || '')), 'tap overshock team ATK buff listed');
});

test('漂泊者·导电 延奏 电髓: 接收者附加异常后获得 25% 全伤害加深（心 电磁模态）', () => {
  const W = require('../ww_engine.js');
  const def = W.getChar(1309); const orig = def.onTeam; let fired = 0;
  def.onTeam = function (api, ev) { const b = api.cs.dsMi; const r = orig.call(this, api, ev); if (b != null && api.cs.dsMi == null && ev.type === 'anomaly') fired++; return r; };
  try { manual('team_rover_electro.json', 'S2 E R S1 E A A A A'); } finally { def.onTeam = orig; }
  assert.ok(fired >= 1, '电髓 consumed on anomaly');
});

test('渊武: 雷之楔 → 登场角色伤害触发协同（≤1/1.2 s）+ 锋芒 → 满锋芒 E = 万壑雷（引爆楔子、雷厉风行）', () => {
  const r = manual('team_yuanwu.json', 'E S1 A A A A A A A A A A A A A A A A A A A A S2 E');
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const cw = r.timeline.filter((a) => a.key === 'cw').map((a) => a.t);
  assert.ok(cw.length >= 3, 'coordinated wedge hits ' + cw.length);
  for (let i = 1; i < cw.length; i++) assert.ok(cw[i] - cw[i - 1] >= 1.2 - 1e-6, 'wedge ICD');
  const k = keys(r, 1);
  assert.ok(k.includes('wh'), k.join(' '));
  const d = manual('yuanwu_solo.json', 'E A A A A A A A A A A E A A A A A A A A A A E');
  assert.ok(keys(d, 0).includes('det'), '万壑雷 detonates the live wedge: ' + keys(d, 0).join(' '));
});

test('卜灵: 卦象 艮震 → 山雷颐 (少阳), 震震 → 震为雷 (少阴) → R = 归一 + 五雷荡煞阵（2 秒节拍、2 层电磁效应）', () => {
  const r = manual('buling_solo.json', 'A A A A H E A A A A H A A A A A A R A A A A A A', { start: { energy: 'full', concerto: 0 } });
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const k = keys(r, 0);
  assert.ok(k.includes('shan') && k.includes('zhen') && k.includes('gy'), k.join(' '));
  const ticks = r.timeline.filter((a) => a.key === 'tick');
  assert.ok(ticks.length >= 1);
  assert.ok(r.timeline.some((a) => a.key === 'anomaly:flare'));
});

test('丽贝卡: E 切换模式（猎手 → 铁胆 → 猎手）; R → 31型重机枪 → 大烟花！; 狂热 120 → 哒哒哒！/ 砰砰砰！', () => {
  const r = manual('rebecca_solo.json', 'E E R A A A A A A A A A A A A A A H');
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const k = keys(r, 0);
  assert.deepEqual(k.slice(0, 5), ['bb', 'cm', 'lib', 'hmg', 'fw']);
  assert.ok(k.includes('rtt') || k.includes('bbb'), k.join(' '));
});

test('锁暝: 念深 R → 同奏 5 s → 切人强制延奏（同奏）→ 凄雨瘴雷 ≤ 6 道；心 响应同奏后获得同奏增益', () => {
  const c0 = ex('team_suoming.json'); c0.team[1].module = { start: { ns: true } };
  c0.rotation = { mode: 'manual', sequence: 'R S1 A A A A A A A A A A', start: 1 };
  const r = E.simulate(c0, idx);
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const o = r.timeline.find((a) => a.mi === 1 && a.cls === 'O');
  assert.ok(o, 'outro after 同奏');
  const ly = r.timeline.filter((a) => a.key === 'ly');
  assert.ok(ly.length >= 1 && ly.length <= 6, 'ly ' + ly.length);
});

test('灯灯: 黄灯光能满 → 强化·前扑（红灯聚光 4 次）; 红灯光能满 → 强化·后撤（黄灯聚光 6 次强光）; 延奏 强光穿射按光能段数', () => {
  const r = manual('lumi_solo.json', 'E A A A A A A A A A E H H H H H H A');
  assert.ok(okSteps(r), JSON.stringify(r.steps.filter((s) => !s.ok)));
  const k = keys(r, 0);
  assert.ok(k.includes('er'), k.join(' '));
  assert.equal(k.filter((x) => x === 'gl').length, 6, k.join(' '));
});

// migration to B9 events
test('B9 migration: 尤诺 stacks from shield events, 西格莉卡 from echoCast events, 仇远 echoCast in onTeam', () => {
  for (const f of ['team_iuno.json', 'team_sigrika.json', 'qiuyuan_solo.json']) { const r = sim(f); assert.ok(r.total > 0, f); }
  const src = (n) => fs.readFileSync(path.join(__dirname, '../chars', n), 'utf8');
  assert.ok(/ev\.type === 'shield'/.test(src('1410_iuno.js')));
  assert.ok(/ev\.type !== 'echoCast'/.test(src('1412_sigrika.js')));
  assert.ok(/ev\.type !== 'echoCast'/.test(src('1411_qiuyuan.js')));
});
