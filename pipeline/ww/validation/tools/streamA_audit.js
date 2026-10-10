'use strict';
// Stream A 角色模块健康检查（在 validation/tools/module_audit.js 出现前的等价工具；只读，不改引擎）
// 用法: node validation/tools/streamA_audit.js <batch> <id...>   → validation/out/module_audit_<batch>.md
// 每个模块的 audit 元数据: { role:'dps'|'subdps'|'support', finishers:[key], window, sig, alts:[weaponIds], solo:'x.json', team:'y.json', teamMi, anomaly:'type', anomalyMin }
const fs = require('fs'), path = require('path');
const E = require('../../engine/chars');
const idx = E.indexData(require('../../../out/ww.json'));
const FR = JSON.parse(fs.readFileSync(path.join(__dirname, '../action_frames.json'), 'utf8'));
const EXD = path.join(__dirname, '../../engine/chars/examples');
const load = (f) => { const c = JSON.parse(fs.readFileSync(path.join(EXD, f), 'utf8')); c.actionFrames = FR; delete c.expect; return c; };
const [batch, ...ids] = process.argv.slice(2);
const rows = [];
for (const id of ids.map(Number)) {
  const mod = E.getChar(id); const A = (mod && mod.audit) || {};
  const row = { id, name: mod ? mod.name : '?', conf: mod ? mod.confidence : '-', ok: true, issues: [] };
  if (!mod) { row.ok = false; row.issues.push('无模块'); rows.push(row); continue; }
  try {
    const c = load(A.solo); if (A.window) c.duration = A.window;
    const r = E.simulate(c, idx);
    const own = r.timeline.filter((a) => a.mi === 0 && !a.status);
    const cnt = {}; own.forEach((a) => { cnt[a.key] = (cnt[a.key] || 0) + 1; });
    row.window = c.duration; row.total = Math.round(r.total); row.searchable = r.searchable !== false;
    row.fin = (A.finishers || []).map((k) => k + '×' + (cnt[k] || 0)).join(' ');
    row.R = cnt.R || 0;
    if ((A.finishers || []).some((k) => !cnt[k])) { row.ok = false; row.issues.push('单人搜索未用终结技 ' + A.finishers.filter((k) => !cnt[k]).join('/')); }
    const dflt = own.filter((a) => a.dur === 'default' || a.durSource === 'default' || a.durSource === 'module-estimate');
    row.estDur = [...new Set(dflt.map((a) => a.key))].join(' ') || '-';
    row.seq = r.sequence;
    const mods = (r.members || [])[0] || {};
    row.lowWarn = (r.warnings || []).filter((w) => /模块找不到/.test(w.text || '')).length;
    if (row.lowWarn) { row.ok = false; row.issues.push('命中行缺失 ' + row.lowWarn); }
    if (A.anomaly) {
      const an = r.timeline.filter((a) => a.status && a.mi === 0).reduce((s, a) => s + (a.damage || 0), 0);
      row.anom = (an / r.total * 100).toFixed(1) + '%';
      if (an / r.total < (A.anomalyMin || 0.05)) { row.ok = false; row.issues.push('异常伤害占比偏低'); }
    } else row.anom = '-';
    // signature weapon in context
    if (A.sig && A.alts && A.alts.length) {
      const ctxF = A.role === 'dps' || !A.team ? A.solo : A.team; const mi = ctxF === A.solo ? 0 : (A.teamMi || 0);
      const cc = load(ctxF); if (ctxF === A.solo && A.window) cc.duration = A.window;
      cc.team[mi].weapon = Object.assign({}, cc.team[mi].weapon, { id: A.sig, rank: 1 });
      cc.search = mi ? { beamWidth: 32, maxExpansions: 30000, topN: 3 } : { beamWidth: 48, maxExpansions: 60000, topN: 3 };
      const out = E.compareGear(cc, idx, E.weaponVariants(idx, mi, A.alts), { researchRotation: true });
      const cur = out.rows.find((x) => x.cur);
      row.sigCtx = ctxF === A.solo ? 'solo' : 'team';
      row.sigRank = cur.rank + '/' + out.rows.length;
      row.sigNext = out.rows.filter((x) => !x.cur).map((x) => x.label + ' ' + (x.total / cur.total * 100 - 100).toFixed(1) + '%')[0];
      if (cur.rank !== 1 && !A.sigNote) { row.ok = false; row.issues.push('专武未排第一'); }
      if (A.sigNote) row.issues.push('专武说明: ' + A.sigNote);
    } else { row.sigRank = '-'; if (A.sigNote) row.issues.push(A.sigNote); }
    if (A.team) { const t = E.simulate(load(A.team), idx); row.team = Math.round(t.total) + ' (' + A.team + ')'; }
    if (A.note) row.issues.push(A.note);
  } catch (e) { row.ok = false; row.issues.push('错误 ' + e.message); }
  rows.push(row);
  process.stderr.write(id + ' ' + (row.ok ? 'PASS' : 'FAIL') + ' ' + JSON.stringify(row) + '\n');
}
const md = ['# module audit · ' + batch, '', '生成：' + new Date().toISOString() + '（validation/tools/streamA_audit.js；endCredit=prorate 默认）', '',
  '| id | 角色 | 置信度 | 窗口s | 单人总伤 | R | 终结技 | 专武(语境) | 异常占比 | 估计时长动作 | 队伍 | 结果 | 备注 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.id} | ${r.name} | ${r.conf} | ${r.window || '-'} | ${r.total || '-'} | ${r.R} | ${r.fin || '-'} | ${r.sigRank || '-'} ${r.sigCtx || ''}${r.sigNext ? '（次: ' + r.sigNext + '）' : ''} | ${r.anom} | ${r.estDur} | ${r.team || '-'} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.issues.join('；')} |`);
md.push('', '## 单人搜索序列', '');
for (const r of rows) md.push(`- ${r.id} ${r.name}: \`${r.seq || ''}\``);
const out = path.join(__dirname, '../out/module_audit_' + batch + '.md');
fs.writeFileSync(out, md.join('\n') + '\n');
console.log(md.join('\n'));
console.log('\nwritten ' + out);
