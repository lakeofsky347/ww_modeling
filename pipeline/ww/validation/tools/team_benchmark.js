#!/usr/bin/env node
// 队伍级基准：同一配置分别用 timeStop=exclude / include 跑 40s 自动搜索，输出总伤、DPS（总伤/窗口）、
// DPS（总伤/实际推进时间）、时停节省秒数、成员占比。只读引擎；输出 validation/out/team_benchmark.json
// 用法：node validation/tools/team_benchmark.js [--duration 40] [--only team_qingxiao,lucy_solo] [--scope all]
// 17:2x（stream A，配置对齐）：默认与页面预设同一解析——各示例文件自带的 duration / rotation（含 start）/ search / start / endCredit，
//   帧数据 = validation/action_frames.json（页面 runtime 精简版只删字段，结果逐值相同，已核对）。--duration N 强制统一窗口（旧口径：40）。
//   DPS = 总伤 / 各自窗口，因此不同窗口的队伍可比。--scope all = 17:20 之前的时停口径（非耗能时停也扣除），仅作对照。
//   末尾输出与 Slyraf 参考（TEAM_BENCHMARK.md §5）重叠队伍的比值与 Spearman。
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const E = require(path.join(ROOT, 'engine/chars/index.js'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DFORCE = arg('--duration', null) != null ? +arg('--duration', null) : null;
const SCOPE = arg('--scope', null);
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, '../out/ww.json'), 'utf8'));
const idx = E.indexData(DATA);
const FR = path.join(ROOT, 'validation/action_frames.json');
const FRAMES = fs.existsSync(FR) ? JSON.parse(fs.readFileSync(FR, 'utf8')) : null;
const LIST = [
  ['default', '今汐/折枝/守岸人（默认预设）', 'engine/examples/team_jinhsi.json'],
  ['carlotta', '珂莱塔/折枝/守岸人', 'engine/chars/examples/team_carlotta.json'],
  ['iuno', '尤诺队', 'engine/chars/examples/team_iuno.json'],
  ['yinlin', '吟霖队', 'engine/chars/examples/team_yinlin.json'],
  ['qingxiao', '清宵/琳奈/守岸人', 'engine/chars/examples/team_qingxiao.json'],
  ['lucy_solo', '露西 单人', 'engine/chars/examples/lucy_solo.json'],
  ['danjin_solo', '丹瑾 单人', 'engine/chars/examples/danjin_solo.json'],
  ['lucy', '露西队', 'engine/chars/examples/team_lucy.json'],
  ['danjin', '丹瑾队', 'engine/chars/examples/team_danjin.json'],
  ['changli', '长离/折枝/守岸人', null],
  ['camellya', '椿队（散华）', 'engine/chars/examples/team_camellya_sanhua.json'],
  ['cartethyia', '卡提希娅/守岸人', 'engine/chars/examples/team_cartethyia.json'],
  ['phrolova', '弗洛洛队', 'engine/chars/examples/team_phrolova.json'],
  ['jiyan', '忌炎队', 'engine/chars/examples/team_jiyan.json'],
  ['zani', '赞妮队', 'engine/chars/examples/team_zani.json'],
  ['augusta', '奥古斯塔/守岸人', 'engine/chars/examples/team_augusta.json'],
  ['aemeath', '爱弥斯/长离/守岸人', 'engine/chars/examples/team_aemeath.json'],
  ['phoebe', '菲比/守岸人', 'engine/chars/examples/team_phoebe.json'],
];
const only = arg('--only', null);
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
function cfgOf(key, f) {
  if (key === 'changli') { const t = load('engine/examples/team_jinhsi.json'), c = load('engine/examples/changli_solo_search.json'); t.team[0] = c.team[0]; return t; }
  return load(f);
}
const out = [];
for (const [key, label, f] of LIST) {
  if (only && !only.split(',').includes(key)) continue;
  const base = cfgOf(key, f); delete base.expect; delete base.probe;
  if (FRAMES && (base.actionFrames == null || typeof base.actionFrames === 'string')) base.actionFrames = FRAMES;
  // same resolution as page presets (build_page.presets): keep the file's duration / rotation / search / start; only force search mode
  if (DFORCE) base.duration = DFORCE;
  base.rotation = Object.assign({}, base.rotation || {}, { mode: 'search' });
  if (SCOPE) base.timeStopScope = SCOPE;
  const D = base.duration || 25;
  const row = { key, label, duration: D, team: base.team.map((m) => (E.getChar(m.id) || {}).name || m.id), chains: base.team.map((m) => m.chain || 0) };
  for (const ts of ['exclude', 'include']) {
    const c = JSON.parse(JSON.stringify(base)); c.timeStop = ts;
    const t0 = Date.now();
    try {
      const r = E.simulate(c, idx);
      const saved = r.timeStopSaved || 0;
      const mem = (r.members || []).map((m, i) => ({ name: m.name, chain: m.chain, chainModeled: m.chainModeled, dmg: Math.round((r.perMember || [])[i] || 0) }));
      row[ts] = { total: Math.round(r.total), dpsWindow: Math.round(r.total / D), timeStopSaved: saved, dpsRealtime: Math.round(r.total / (D + (ts === 'exclude' ? saved : 0))), liberations: r.liberations, members: mem, ms: Date.now() - t0 };
    } catch (e) { row[ts] = { error: String(e && e.message || e) }; }
  }
  if (row.exclude.total && row.include.total) row.ratio = +(row.exclude.total / row.include.total).toFixed(3);
  out.push(row);
  console.log(key.padEnd(12), label.padEnd(16), (D + 's').padEnd(4), 'excl', row.exclude.total, 'saved', row.exclude.timeStopSaved, '| incl', row.include.total, '| x', row.ratio);
}
// reference overlap (TEAM_BENCHMARK.md §5, Slyraf S0R1 DPS, fetched 2026-10-09)
const REF = { qingxiao: 97860, iuno: 74157, zani: 58820, lucy: 58475, carlotta: 57014 };
const rank = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]), r = []; o.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
const spearman = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length; return 1 - 6 * ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0) / (n * (n * n - 1)); };
const refRows = out.filter((r) => REF[r.key] && r.exclude && r.exclude.dpsWindow);
const cmp = {};
if (refRows.length >= 3 && refRows.some((r) => r.key === 'qingxiao')) {
  const q = refRows.find((r) => r.key === 'qingxiao');
  for (const ts of ['exclude', 'include']) {
    const ours = refRows.map((r) => r[ts].dpsWindow), ref = refRows.map((r) => REF[r.key]);
    cmp[ts] = { spearman: +spearman(ours, ref).toFixed(3), ratios: Object.fromEntries(refRows.map((r) => [r.key, { ours: +(r[ts].dpsWindow / q[ts].dpsWindow).toFixed(3), ref: +(REF[r.key] / REF.qingxiao).toFixed(3) }])) };
    const wo = refRows.filter((r) => r.key !== 'iuno');
    if (wo.length >= 3) cmp[ts].spearmanNoIuno = +spearman(wo.map((r) => r[ts].dpsWindow), wo.map((r) => REF[r.key])).toFixed(3);
    console.log(ts.padEnd(8), 'Spearman', cmp[ts].spearman, '(w/o 尤诺队', cmp[ts].spearmanNoIuno + ')', Object.entries(cmp[ts].ratios).map(([k, v]) => `${k} ${v.ours}/${v.ref}`).join('  '));
  }
}
fs.writeFileSync(path.join(ROOT, 'validation/out/team_benchmark.json'), JSON.stringify({ duration: DFORCE || 'per-config', scope: SCOPE || 'toa', generated: new Date().toISOString(), rows: out, reference: cmp }, null, 1));
