#!/usr/bin/env node
'use strict';
/*
 * 角色模块健康检查（只读：不改 engine/ 与模块；只写 validation/out/）
 * node validation/tools/module_audit.js --help
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');                 // pipeline/ww
const ENG = path.join(ROOT, 'engine');
const CHARS = path.join(ENG, 'chars');
const OUT = path.join(ROOT, 'validation/out');
const EX_DIRS = [path.join(CHARS, 'examples'), path.join(ENG, 'examples')];

const HELP = `用法：node validation/tools/module_audit.js [选项]
  （在 pipeline/ww 下运行；也可从任意目录用绝对路径运行）
选项：
  --only id,id     只检查这些角色（id 或中文名）
  --changed        只检查模块文件自上次运行（out/module_audit.json 记录的哈希）以来有变化的角色；
                   _common.js / 0_wb_lib.js 变化时视为全部变化；首次运行 = 全部
  --quick          跳过专武对比（最慢的一项）
  --json <path>    JSON 输出（默认 validation/out/module_audit.json）
  --md <path>      Markdown 输出（默认 validation/out/MODULE_AUDIT.md）
  --data <path>    ww.json（默认 ../out/ww.json）
  --frames <path|none>  动作帧（默认 validation/action_frames.json）
  --verbose        打印每个角色的搜索序列与检查细节
  --help
退出码：本次检查的角色有任一 FAIL → 1；否则 0（WARN、EXPECTED 不影响退出码）。
  预期行为：validation/tools/audit_expected.json 中匹配（id + 检查 + 可选正则）的 WARN 降级为 EXPECTED，单独列出。
  --only/--changed 时，未检查的角色沿用上次 module_audit.json 的结果写入报告（结果合并）。
配置来源：模块 audit 元数据 {role, finishers, window, sig, alts, solo, team, teamMi, anomaly, anomalyMin, sigNote, note}
  > validation/tools/signature_weapons.json > 自动（示例配置 engine/chars/examples、engine/examples；无则合成单人配置）。`;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
if (flag('--help') || flag('-h')) { console.log(HELP); process.exit(0); }

// ---------------------------------------------------------------- thresholds (见 MODULE_AUDIT.md 顶部)
const TH = {
  windows: [25, 40],          // 单人窗口：第一个 = 模块 audit.window > 单人预设 duration > 25；第二个 = max(40, 第一个)
  spamShare: 0.60,            // 单一动作占动作数比例 > 60% → FAIL「只刷一个动作」
  heavyShare: 0.70,           // 重击占动作数 > 70% → WARN（耐力）
  anomalyMax: 0.90,           // 异常伤害占比 > 90% → WARN
  baneMax: 0.15,              // 虚湮减防增伤 > 15% → WARN（3 层=6% 减防，Lv90 对 Lv90 约 +3.1%；上限 12 层=24% 约 +14%）
  baneSlackPct: 0.5,          // 实测增伤超过“观测最高层数下的理论防御区增益”+0.5 个百分点 → WARN
  sigNoisePct: 0.5,           // 专武落后第一名 ≤0.5% → WARN（搜索噪声内），> 0.5% → FAIL
  timeStopShare: 0.50,        // 含时停帧动作的伤害占比 > 50% → WARN（时停不计战斗时间的口径待验证，占比越高结果越依赖它）
  estDurShare: 0.50,          // 默认/模块估计时长动作 > 50% → WARN
  dpsShare: 0.35,             // 无 role 时：队伍语境下个人伤害占比 ≥35% 视为 dps
  search: { beamWidth: 48, maxExpansions: 60000, topN: 3 },
  searchTeam: { beamWidth: 32, maxExpansions: 30000, topN: 3 },
};
// 默认对比武器（按武器类型）：常驻 5★ / 活动 5★ / 4★ 暴击系
const STD_ALTS = { 1: [21010015, 21010045, 21010074], 2: [21020015, 21020045, 21020104], 3: [21030015, 21030045, 21030104], 4: [21040015, 21040045, 21040074], 5: [21050015, 21050045, 21050074] };

const E = require(path.join(CHARS, 'index.js'));
const dataPath = opt('--data', path.join(ROOT, '../out/ww.json'));
const DATA = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const idx = E.indexData(DATA);
const framesOpt = opt('--frames', path.join(ROOT, 'validation/action_frames.json'));
const FRAMES = framesOpt !== 'none' && fs.existsSync(framesOpt) ? JSON.parse(fs.readFileSync(framesOpt, 'utf8')) : null;
const EXPECTED = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'audit_expected.json'), 'utf8')).entries || []; } catch (e) { return []; } })();
const SIGMAP = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'signature_weapons.json'), 'utf8')).characters || {}; } catch (e) { return {}; } })();
const RES = new Map(DATA.resonators.map((r) => [r.id, r]));
const WPN = new Map(DATA.weapons.map((w) => [w.id, w]));
const jsonPath = opt('--json', path.join(OUT, 'module_audit.json'));
const mdPath = opt('--md', path.join(OUT, 'MODULE_AUDIT.md'));
const verbose = flag('--verbose');
const clone = (o) => JSON.parse(JSON.stringify(o));
const r1 = (x) => Math.round(x * 10) / 10;
const pct = (x) => (x == null || !isFinite(x) ? '-' : r1(x * 100) + '%');

// ---------------------------------------------------------------- module files / hashes
const sha = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
const modFiles = {};
for (const f of fs.readdirSync(CHARS).filter((x) => /^\d+_.*\.js$/.test(x))) { const id = parseInt(f, 10); if (id > 0) modFiles[id] = f; }
const libHash = ['_common.js', '0_wb_lib.js'].filter((f) => fs.existsSync(path.join(CHARS, f))).map((f) => f + ':' + sha(path.join(CHARS, f))).join(',');
const hashes = Object.fromEntries(Object.entries(modFiles).map(([id, f]) => [id, sha(path.join(CHARS, f))]));

let ids = E.listChars().map((m) => m.id).sort((a, b) => a - b);
const onlyArg = opt('--only');
if (onlyArg) {
  const want = onlyArg.split(',').map((s) => s.trim()).filter(Boolean);
  ids = ids.filter((id) => want.includes(String(id)) || want.includes((E.getChar(id) || {}).name));
  const miss = want.filter((w) => !ids.some((id) => String(id) === w || E.getChar(id).name === w));
  if (miss.length) console.log('--only：以下角色没有模块，忽略：' + miss.join(', '));
}
if (flag('--changed')) {
  let prev = null; try { prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) { /* first run */ }
  if (prev && prev.files && prev.files.lib === libHash) ids = ids.filter((id) => !prev.files.modules || prev.files.modules[id] !== hashes[id] || !(prev.rows || []).some((r) => r.id === id));
  console.log(`--changed：${ids.length} 个角色需要检查${prev ? '' : '（无上次记录 → 全部）'}`);
}

// ---------------------------------------------------------------- example configs
const examples = [];
for (const d of EX_DIRS) if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.cases ? raw.cases : raw.team ? [raw] : [];
    const defs = Array.isArray(raw) ? {} : raw.defaults || {};
    list.forEach((c, i) => { if (c.team && !c.probe) examples.push({ file: f, dir: d, i, cfg: Object.assign({}, clone(defs), clone(c)) }); });
  } catch (e) { /* ignore broken example */ }
}
const allHaveModules = (cfg) => cfg.team.every((m) => E.getChar(m.id) && m.module !== false);
function findExample(name) { return name ? examples.find((x) => x.file === name) || null : null; }
function soloFor(id) {
  const c = examples.filter((x) => x.cfg.team.length === 1 && x.cfg.team[0].id === id);
  return c.find((x) => /solo/.test(x.file) && x.dir === EX_DIRS[0]) || c.find((x) => /search/.test(x.file)) || c[0] || null;
}
function teamFor(id) {
  const c = examples.filter((x) => x.cfg.team.length > 1 && x.cfg.team.some((m) => m.id === id) && allHaveModules(x.cfg));
  return c.find((x) => x.cfg.team[0].id !== id && /team_/.test(x.file)) || c.find((x) => /team_/.test(x.file)) || c[0] || null;
}
function synthSolo(id, weaponId) {
  return { name: `合成单人 ${id}`, duration: 25, mode: 'expected', enemy: { level: 90, resTier: 0.1, resShred: 0 }, start: { energy: 0, concerto: 0 },
    team: [{ id, level: 90, chain: 0, skillLevels: { basic: 10, skill: 10, liberation: 10, intro: 10, forte: 10, outro: 1 }, weapon: { id: weaponId, level: 90, rank: 1 },
      echoes: [{ cost: 4, main: 'Crit' }, { cost: 3, main: 'elemDmg' }, { cost: 3, main: 'elemDmg' }, { cost: 1, main: 'Atk%' }, { cost: 1, main: 'Atk%' }] }] };
}
function prep(cfg, { duration, team } = {}) {
  const c = clone(cfg);
  delete c.expect; delete c.probe;
  if (FRAMES && c.actionFrames == null) c.actionFrames = FRAMES;
  else if (typeof c.actionFrames === 'string') c.actionFrames = FRAMES;
  if (typeof c.substatTiers === 'string') { try { c.substatTiers = JSON.parse(fs.readFileSync(path.join(ROOT, 'validation', path.basename(c.substatTiers)), 'utf8')); } catch (e) { delete c.substatTiers; } }
  if (duration) c.duration = duration;
  c.rotation = { mode: 'search', start: (c.rotation && c.rotation.start) || 0 };
  c.search = Object.assign({}, team ? TH.searchTeam : TH.search, c.search || {});   // 预设里的 search（residual/residualWeight/预算）优先
  return c;   // timeStop、start.steady、search.residual 等不覆盖 → 用预设值或引擎默认
}
/** 记录一次运行实际使用的模式（从引擎结果读取，不硬编码） */
function modeOf(r, cfg) {
  const st = (cfg && cfg.start) || {};
  return { window: r.duration, timeStop: (r.config && r.config.timeStop) || cfg.timeStop || 'exclude', residual: !!r.residual, residualWeight: r.residual ? r.residual.weight : null,
    residualSetting: cfg.search && cfg.search.residual != null ? cfg.search.residual : 'auto', steady: !!st.steady, steadyLoops: st.steady ? (st.steadyLoops || 2) : null,
    runMode: r.runMode ? r.runMode.kind : 'cold', beam: cfg.search ? cfg.search.beamWidth : null };
}
const modeStr = (m) => (m ? `${m.window}s · 时停${m.timeStop === 'exclude' ? '不计时' : '计时'} · 残值引导${m.residual ? '开(×' + m.residualWeight + ')' : '关'} · ${m.steady ? '稳态开局×' + m.steadyLoops : '冷/预设开局'}` : '-');

// ---------------------------------------------------------------- data-side signature inference (low confidence fallback)
function inferSig(R) {
  const txt = [...R.skills.map((s) => s.desc || ''), ...(R.inherents || []).map((s) => s.desc || ''), ...(R.chains || []).map((s) => s.desc || '')].join('\n');
  const all = DATA.resonators.map((r) => [...r.skills.map((s) => s.desc || ''), ...(r.chains || []).map((s) => s.desc || '')].join('\n'));
  let best = null;
  for (const w of DATA.weapons) {
    if (w.rarity !== 5 || w.id % 10 !== 6 || w.weaponType !== R.weaponType || !w.passive) continue;
    const toks = [...new Set((w.passive.descTemplate || '').match(/【[^】]+】/g) || [])].map((t) => t.slice(1, -1));
    let s = 0; const hit = [];
    for (const t of toks) { if (!txt.includes(t)) continue; const df = all.filter((x) => x.includes(t)).length || 1; s += 1 / df; hit.push(t); }
    if (s > 0 && (!best || s > best.s)) best = { id: w.id, s, hit, tie: false }; else if (best && s === best.s && s > 0) best.tie = true;
  }
  return best && !best.tie && best.s >= 0.3 ? best : null;
}

// ---------------------------------------------------------------- helpers on results
const own = (r, mi) => r.timeline.filter((a) => a.mi === mi && !a.status && !a.coord && a.cls !== 'W' && a.cls !== 'S' && a.cls !== 'O');
const actKey = (a) => a.key || (a.cls + ':' + a.label);
function anomalyOwn(r, mi) {
  let s = 0; for (const a of r.timeline) if (a.status && a.mi === mi && !a.ext) s += a.damage || 0;
  if (!s && r.members.length === 1) s = Object.entries(r.byType).filter(([k]) => /^anomaly:/.test(k)).reduce((x, [, v]) => x + v, 0);
  return s;
}
function numericProblems(r) {
  const p = [];
  if (!isFinite(r.total)) p.push('总伤害 NaN/Infinity');
  else if (r.total <= 0) p.push('总伤害为 0');
  if (r.perMember.some((x) => !isFinite(x))) p.push('队员伤害 NaN');
  const neg = r.timeline.filter((a) => (a.damage || 0) < -1e-6); if (neg.length) p.push(`负伤害 ${neg.length} 处（${neg[0].label}）`);
  const nan = r.timeline.filter((a) => a.damage != null && !isFinite(a.damage)); if (nan.length) p.push(`NaN 伤害 ${nan.length} 处（${nan[0].label}）`);
  return p;
}
function resourcesSpent(r, mi, defs) {
  const out = [];
  for (const d of defs || []) {
    let prev = null, drops = 0, maxV = -Infinity;
    for (const a of r.timeline) { if (!a.res || !a.res[mi]) continue; const v = a.res[mi][d.key]; if (typeof v !== 'number') continue; if (prev != null && v < prev - 1e-9) drops++; prev = v; maxV = Math.max(maxV, v); }
    out.push({ key: d.key, name: d.name, drops, max: isFinite(maxV) ? r1(maxV) : null });
  }
  return out;
}
/** 模块源码文件：文件名前缀 = id；别名文件（「registered by <id>_xxx.js」/ alias_of_<id>）跟到真实文件；一个文件注册多个 id 时按源码含该 id 查找 */
function srcFileFor(id) {
  let f = modFiles[id];
  if (f) { const t = fs.readFileSync(path.join(CHARS, f), 'utf8'); const m = /registered by (\d+_[\w.]+\.js)/.exec(t) || /alias_of_(\d+)/.exec(f); if (m) { const tgt = /\.js$/.test(m[1]) ? m[1] : modFiles[+m[1]]; if (tgt && fs.existsSync(path.join(CHARS, tgt))) f = tgt; } return f; }
  return Object.values(modFiles).find((x) => new RegExp('\\b' + id + '\\b').test(fs.readFileSync(path.join(CHARS, x), 'utf8'))) || null;
}
function anomalyTypesInSource(id) {
  const f = srcFileFor(id); if (!f) return [];
  const src = fs.readFileSync(path.join(CHARS, f), 'utf8');
  return [...new Set([...src.matchAll(/addAnomaly\(\s*'(\w+)'/g)].map((m) => m[1]))];
}

// ---------------------------------------------------------------- Havoc Bane（虚湮）：减防增伤
// 虚湮不造成伤害，只减防。做法：同一条序列（搜索得到的最优序列，手动重放）分别在原数据与「虚湮减防表清零」的数据上跑，
// 增伤 = 有虚湮总伤 / 无减防总伤 − 1。层数/触发不变（只去掉减防），所以依赖虚湮层数的其他效果不受影响。
let idxNoBane = null;
function noBaneIdx() {
  if (idxNoBane) return idxNoBane;
  const d = clone(DATA);
  const b = d.anomalies && d.anomalies.types && d.anomalies.types.bane;
  if (b) b.defReduceTable = (b.defReduceTable || []).map(() => 0);
  idxNoBane = E.indexData(d);
  return idxNoBane;
}
function defZone(lvA, lvE, reduce) { return E.defenseMultiplier(lvA, lvE, 0, reduce, null).value; }
function baneGain(r, cfg) {
  const log = (r.anomalies && r.anomalies.log || []).filter((e) => e.type === 'bane');
  const maxN = Math.max(0, ...log.map((e) => e.n || 0));
  if (!maxN) return { applied: false, maxStacks: 0 };
  const c = clone(cfg); c.rotation = { mode: 'manual', sequence: r.sequence, start: (cfg.rotation && cfg.rotation.start) || 0, onBlocked: 'wait' };
  const r0 = E.simulate(c, noBaneIdx());
  const gain = r.total / (r0.total || 1) - 1;
  const tab = (DATA.anomalies.types.bane || {}).defReduceTable || [];
  const red = tab[Math.min(tab.length, maxN) - 1] || 0.02 * maxN;
  const lv = (cfg.team[0] && cfg.team[0].level) || 90, el = (cfg.enemy && cfg.enemy.level) || 90;
  const theo = defZone(lv, el, red) / defZone(lv, el, 0) - 1;
  // 虚湮在场时间（层数 > 0 的时长 / 窗口）
  let up = 0, cur = 0, from = 0; for (const e of log) { if (cur > 0) up += e.t - from; cur = e.n || 0; from = e.t; } if (cur > 0) up += r.duration - from;
  return { applied: true, maxStacks: maxN, defReduce: red, gainPct: +(gain * 100).toFixed(2), theoPct: +(theo * 100).toFixed(2), uptimePct: r1(100 * Math.min(1, up / r.duration)), totalWith: Math.round(r.total), totalWithout: Math.round(r0.total) };
}
function baneCheck(id, soloBase, w, soloRun, teamEx, rT, tmi, add) {
  const solo = baneGain(soloRun.r, soloRun.cfg);
  const team = rT ? baneGain(rT, rT._cfg) : null;
  const main = team && team.applied ? Object.assign({ context: `队伍 ${teamEx.file}` }, team) : Object.assign({ context: `单人 ${w}s` }, solo);
  const data = { solo, team, used: main.context };
  if (!solo.applied && !(team && team.applied)) add('bane', 'FAIL', '模块会施加虚湮，但单人/队伍运行中从未施加', data);
  else if (!(main.gainPct > 0)) add('bane', 'FAIL', `虚湮已施加（最高 ${main.maxStacks} 层），但减防增伤为 ${main.gainPct}%（${main.context}）`, data);
  else if (main.gainPct > TH.baneMax * 100) add('bane', 'WARN', `减防增伤 ${main.gainPct}% > ${TH.baneMax * 100}%（${main.context}）`, data);
  else if (main.gainPct > main.theoPct + TH.baneSlackPct) add('bane', 'WARN', `减防增伤 ${main.gainPct}% 超过理论上限 ${main.theoPct}%（${main.maxStacks} 层减防 ${r1(main.defReduce * 100)}%；${main.context}）`, data);
  else add('bane', 'PASS', `减防增伤 ${main.gainPct}%（最高 ${main.maxStacks} 层，减防 ${r1(main.defReduce * 100)}%，理论上限 ${main.theoPct}%，在场 ${main.uptimePct}%；${main.context}）`, data);
  return data.result;
}

// ---------------------------------------------------------------- time-stop safety
const ENGINE_SRC = fs.readFileSync(path.join(ENG, 'ww_engine.js'), 'utf8');
const ENGINE_HAS_CHAIN = /chainModeled/.test(ENGINE_SRC) || E.listChars().some((m) => 'chainModeled' in (E.getChar(m.id) || {}));
/** 本人动作中含时停帧的：伤害占比、战斗时间/动画时长占窗口比、逐动作次数 vs 冷却/能量上限 */
function timeStopStats(r, mi) {
  const acts = r.timeline.filter((a) => a.mi === mi && !a.status && !a.coord && a.cls !== 'W' && a.cls !== 'S');
  const ownDmg = r.total || 0;   // 占全队总伤害（单人 = 本人）；队伍里辅助的本人伤害很小，按本人占比会失真
  const tsActs = acts.filter((a) => a.timeStop > 0);
  const excl = ((r.config && r.config.timeStop) || 'exclude') === 'exclude';
  const kit = r.members[mi].kit || {};
  const kitActs = [].concat(kit.module || [], kit.stages || [], ['E', 'R', 'H', 'Q', 'I', 'O'].map((k) => kit[k])).filter(Boolean);
  const cdOf = (key) => { const k = kitActs.find((x) => x.key === key); return k ? { cooldown: k.cooldown || 0, cost: k.cost || 0 } : { cooldown: 0, cost: 0 }; };
  const by = {};
  for (const a of tsActs) {
    const k = actKey(a); const b = by[k] || (by[k] = { key: k, label: a.label, cls: a.cls, uses: 0, timeStop: a.timeStop, damage: 0, times: [], energyShort: 0 });
    b.uses++; b.damage += a.damage || 0; b.times.push(a.t);
    const c = cdOf(a.key);
    if (a.cls === 'R' && c.cost > 0 && a.energyBefore != null && a.energyBefore < c.cost - 1e-6) b.energyShort++;
  }
  const list = Object.values(by).map((b) => {
    const c = cdOf(b.key);
    let minGap = null; for (let i = 1; i < b.times.length; i++) { const g = b.times[i] - b.times[i - 1]; if (minGap == null || g < minGap) minGap = g; }
    const limit = c.cooldown > 0 ? Math.floor((r.duration + 1e-6) / c.cooldown) + 1 : null;   // 战斗时间内按冷却最多可用次数
    const cdViol = c.cooldown > 0 && minGap != null && minGap < c.cooldown - 0.01;
    return { key: b.key, label: b.label, cls: b.cls, uses: b.uses, timeStop: r1(b.timeStop), cooldown: c.cooldown || null, energyCost: c.cost || null, limit,
      minGap: minGap == null ? null : Math.round(minGap * 100) / 100, damagePct: ownDmg ? r1(100 * b.damage / ownDmg) : 0,
      violation: cdViol ? `两次间隔 ${Math.round(minGap * 100) / 100}s < 冷却 ${c.cooldown}s` : (limit != null && b.uses > limit) ? `${b.uses} 次 > 上限 ${limit}` : b.energyShort ? `${b.energyShort} 次能量不足仍施放` : null,
      gate: c.cooldown > 0 ? '冷却' : c.cost > 0 ? '能量' : '模块资源/无（未独立核对）' };
  });
  const combat = tsActs.reduce((x, a) => x + Math.max(0, a.endT - a.t), 0);
  const anim = tsActs.reduce((x, a) => x + Math.max(0, a.endT - a.t) + (excl ? a.timeStop : 0), 0);
  const tsTotal = tsActs.reduce((x, a) => x + a.timeStop, 0);
  return { mode: excl ? 'exclude' : 'include', damagePct: ownDmg ? r1(100 * tsActs.reduce((x, a) => x + (a.damage || 0), 0) / ownDmg) : 0,
    combatPct: r1(100 * combat / r.duration), animPct: r1(100 * anim / r.duration), timeStopSec: r1(tsTotal), actions: list };
}

// ---------------------------------------------------------------- audit one character
function audit(id) {
  const mod = E.getChar(id), R = RES.get(id), A = (mod && mod.audit) || {}, M = SIGMAP[id] || {};
  const row = { id, name: mod ? mod.name : (R ? R.name : '?'), version: mod && mod.version, confidence: mod && mod.confidence, file: modFiles[id], status: 'PASS', checks: {}, reasons: [], info: [] };
  row.expected = [];
  const add = (check, level, msg, data) => {
    if (level === 'WARN') {
      const ex = EXPECTED.find((e) => +e.id === id && e.check === check && (!e.match || new RegExp(e.match).test(msg)));
      if (ex) { level = 'EXPECTED'; row.expected.push({ check, msg, reason: ex.reason, source: ex.source || null }); }
    }
    row.checks[check] = Object.assign({ level, msg }, data || {});
    if (level === 'FAIL') { row.status = 'FAIL'; row.reasons.push(`[${check}] ${msg}`); }
    else if (level === 'WARN') { if (row.status === 'PASS' || row.status === 'EXPECTED') row.status = 'WARN'; row.reasons.push(`[${check}] ${msg}`); }
    else if (level === 'EXPECTED' && row.status === 'PASS') row.status = 'EXPECTED';
  };
  const errors = [];
  try {
    // --- signature / config resolution
    let sig = A.sig !== undefined ? A.sig : M.sig !== undefined && M.sig !== 'TODO' ? M.sig : undefined, sigSrc = A.sig !== undefined ? '模块 audit' : sig !== undefined ? 'signature_weapons.json' : null;
    if (sig === undefined) { const g = inferSig(R); if (g) { sig = g.id; sigSrc = `数据推断（低置信：${g.hit.join('、')}）`; } }
    const soloEx = findExample(A.solo || M.solo) || soloFor(id);
    const teamEx = findExample(A.team || M.team) || teamFor(id);
    const fallbackW = (soloEx && soloEx.cfg.team[0].weapon && soloEx.cfg.team[0].weapon.id) || sig || (STD_ALTS[R.weaponType] || [])[0];
    const soloBase = soloEx ? soloEx.cfg : synthSolo(id, fallbackW);
    row.file = srcFileFor(id) || row.file;
    if (A.note) row.info.push('模块 audit.note：' + A.note);
    row.config = { solo: soloEx ? soloEx.file : '合成', team: teamEx ? teamEx.file : null };
    if (!soloEx) row.info.push('无单人示例配置，使用合成配置（4C 暴击/元素/元素/攻击/攻击，无套装）');
    const mod0 = E.getChar(id); if (!mod0) throw new Error('无模块');

    // --- 1. search sanity: solo 25s + 40s
    const w1 = A.window || (soloEx && soloEx.cfg.duration) || TH.windows[0];
    const wins = w1 >= TH.windows[1] ? [w1] : [w1, TH.windows[1]];
    row.modes = {};
    const runs = {};
    for (const D of wins) {
      const t0 = Date.now();
      const pc = prep(soloBase, { duration: D });
      const r = E.simulate(pc, idx);
      runs[D] = { r, ms: Date.now() - t0, cfg: pc };
      row.modes['solo' + D] = modeOf(r, pc);
      if (!r.searchable) throw new Error('不可搜索：' + (r.searchDisabledReason || ''));
      const np = numericProblems(r); if (np.length) errors.push(`${D}s: ${np.join('；')}`);
      const bad = r.steps.filter((s) => !s.ok); if (bad.length) row.info.push(`${D}s 搜索序列含 ${bad.length} 个非法步骤（${bad[0].raw}: ${bad[0].reason}）`);
    }
    const wL = wins[wins.length - 1];
    const rS = runs[wins[0]].r, rL = runs[wL].r;
    row.solo = { window: wins[0], windowLong: wL, total: Math.round(rS.total), dps: Math.round(rS.dps), seq: rS.sequence, total40: Math.round(rL.total), seq40: rL.sequence, ms: wins.reduce((a, D) => a + runs[D].ms, 0) };
    // spam
    let spamWorst = null;
    for (const D of wins) {
      const acts = own(runs[D].r, 0); const cnt = {}; acts.forEach((a) => { const k = actKey(a); cnt[k] = (cnt[k] || 0) + 1; });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
      const share = acts.length ? top[1] / acts.length : 0;
      if (!spamWorst || share > spamWorst.share) spamWorst = { window: D, key: top[0], share, n: acts.length, label: (acts.find((a) => actKey(a) === top[0]) || {}).label };
    }
    // core moves (40s)
    const actsL = own(rL, 0), keysL = new Set(actsL.map(actKey));
    const libs = actsL.filter((a) => a.cls === 'R').length;
    const eMax = rL.final[0].energyMax;
    const eFull = !eMax || rL.timeline.some((a) => a.mi === 0 && a.energyBefore != null && a.energyBefore >= eMax - 1e-6) || rL.timeline.some((a) => a.mi === 0 && a.energyAfter >= eMax - 1e-6);
    const missFin = (A.finishers || []).filter((k) => !keysL.has(k));
    const resDefs = mod0.resources || [];
    const resUse = resourcesSpent(rL, 0, resDefs);
    const spent = resUse.filter((x) => x.drops > 0);
    const searchMsgs = []; let sLevel = 'PASS';
    const bump = (l) => { if (l === 'FAIL' || (l === 'WARN' && sLevel === 'PASS')) sLevel = l; };
    if (spamWorst.share > TH.spamShare) { bump('FAIL'); searchMsgs.push(`只刷一个动作：${spamWorst.label || spamWorst.key} 占 ${pct(spamWorst.share)}（${spamWorst.window}s）`); }
    const roleHint = A.role || M.role || null;
    if (!libs) {
      if (eFull && roleHint === 'support') { bump('WARN'); searchMsgs.push(`${wL}s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查）`); }
      else if (eFull) { bump('FAIL'); searchMsgs.push(`核心招式从不使用：共鸣解放 R（${wL}s 内能量曾满）`); }
      else { bump('WARN'); searchMsgs.push(`${wL}s 内未放 R（能量从未满 ${eMax}）`); }
    }
    if (missFin.length) { bump('FAIL'); searchMsgs.push('核心招式从不使用：' + missFin.join('/')); }
    if (resDefs.length && !spent.length) { bump('FAIL'); searchMsgs.push('专属资源从未消耗：' + resDefs.map((d) => d.name || d.key).join('/')); }
    add('search', sLevel, searchMsgs.join('；') || `最高单动作占比 ${pct(spamWorst.share)}；R×${libs}；资源消耗 ${spent.map((x) => x.name || x.key).join('/') || '-'}`,
      { spam: { key: spamWorst.key, label: spamWorst.label, share: r1(spamWorst.share * 100), window: spamWorst.window }, liberations40: libs, energyFull40: eFull, finishers: A.finishers || null, missingFinishers: missFin, resources: resUse });

    // --- team run (role inference / support on-field)
    let rT = null, tmi = -1;
    if (teamEx) {
      tmi = teamEx.cfg.team.findIndex((m) => m.id === id);
      const t0 = Date.now();
      const tc = prep(teamEx.cfg, { team: true });
      rT = E.simulate(tc, idx);
      row.modes.team = modeOf(rT, tc); rT._cfg = tc;
      row.team = { file: teamEx.file, member: tmi, total: Math.round(rT.total), share: rT.total ? r1(100 * rT.perMember[tmi] / rT.total) : null, seq: rT.sequence, ms: Date.now() - t0 };
      const np = numericProblems(rT); if (np.length) errors.push(`队伍: ${np.join('；')}`);
    }
    let role = A.role || M.role, roleSrc = A.role ? '模块 audit' : M.role ? 'signature_weapons.json' : null;
    if (!role) { role = rT ? (rT.perMember[tmi] / (rT.total || 1) >= TH.dpsShare ? 'dps' : 'support') : 'dps'; roleSrc = rT ? `推断（队伍伤害占比 ${row.team.share}%，阈值 ${TH.dpsShare * 100}%）` : '推断（无队伍配置，按 dps）'; }
    row.role = role; row.roleSrc = roleSrc;

    // --- 2. signature weapon
    if (flag('--quick')) add('signature', 'SKIP', '--quick 跳过');
    else if (sig === null) add('signature', 'SKIP', M.note || A.sigNote || '无专武');
    else if (sig === undefined) add('signature', 'WARN', '专武未知（signature_weapons.json 为 TODO，数据推断无唯一结果）');
    else {
      const alts = (A.alts || M.alts || STD_ALTS[R.weaponType] || []).filter((w) => w !== sig && WPN.has(w));
      const useTeam = role !== 'dps' && !!teamEx;
      if (role !== 'dps' && !teamEx) add('signature', 'WARN', `定位 ${role} 但没有可搜索的队伍配置 → 跳过专武检查`);
      else {
        const mi = useTeam ? tmi : 0;
        const cc = useTeam ? prep(teamEx.cfg, { team: true }) : prep(soloBase, { duration: wins[0] });
        cc.team[mi].weapon = Object.assign({ level: 90 }, cc.team[mi].weapon, { id: sig, rank: 1 });
        const t0 = Date.now();
        const out = E.compareGear(cc, idx, E.weaponVariants(idx, mi, alts), { researchRotation: true, baseLabel: (WPN.get(sig) || {}).name + '（专武）' });
        const cur = out.rows.find((x) => x.cur), best = out.rows[0];
        const gap = cur.rank === 1 ? 0 : (1 - cur.total / best.total) * 100;
        const rank = out.rows.map((x) => `${x.label} ${x.cur ? '' : (x.total / cur.total * 100 - 100 >= 0 ? '+' : '') + r1(x.total / cur.total * 100 - 100) + '%'}`.trim()).join(' > ');
        const ctxName = useTeam ? `队伍 ${teamEx.file}` : `单人 ${wins[0]}s`;
        const data = { sig, sigName: (WPN.get(sig) || {}).name, sigSrc, context: ctxName, rank: cur.rank, of: out.rows.length, gapPct: r1(gap), ranking: rank, ms: Date.now() - t0 };
        if (cur.rank === 1) add('signature', /数据推断/.test(sigSrc) ? 'WARN' : 'PASS', `${data.sigName} 第 1/${out.rows.length}（${ctxName}）${/数据推断/.test(sigSrc) ? '；专武由数据推断，请在 signature_weapons.json 确认' : ''}`, data);
        else if (gap <= TH.sigNoisePct || A.sigNote) add('signature', 'WARN', `${data.sigName} 第 ${cur.rank}/${out.rows.length}，落后 ${r1(gap)}%（${ctxName}${A.sigNote ? '；模块说明：' + A.sigNote : '；在搜索噪声内'}）`, data);
        else add('signature', 'FAIL', `${data.sigName} 第 ${cur.rank}/${out.rows.length}，落后第一（${best.label}）${r1(gap)}%（${ctxName}）`, data);
      }
    }

    // --- 3. anomaly share
    const srcAll = anomalyTypesInSource(id);
    const knownAll = [].concat(A.anomaly || M.anomaly || []);
    const baneApplier = srcAll.includes('bane') || knownAll.includes('bane');
    const srcTypes = srcAll.filter((t) => t !== 'bane');
    const known = knownAll.filter((t) => t !== 'bane')[0] || null;
    const applier = !!known || srcTypes.length > 0;
    if (baneApplier) baneCheck(id, soloBase, wins[0], runs[wins[0]], teamEx, rT, tmi, add);
    let anS = anomalyOwn(rS, 0) / (rS.total || 1), anCtx = `单人 ${wins[0]}s`;
    if (applier && anS === 0) {
      // 外部维持的异常（如菲比 module.frazzle='external'）不算本人：去掉 'external' 选项再跑一次
      const m0 = soloBase.team[0].module || {};
      const extKeys = Object.keys(m0).filter((k) => m0[k] === 'external');
      if (extKeys.length) {
        const c2 = clone(soloBase); extKeys.forEach((k) => delete c2.team[0].module[k]);
        const r2 = E.simulate(prep(c2, { duration: wins[0] }), idx);
        anS = anomalyOwn(r2, 0) / (r2.total || 1); anCtx = `单人 ${wins[0]}s，去掉 module.${extKeys.join('/')}='external'`;
      }
      if (anS === 0) {
        // 模式开关（如心 module.mode='flare'）：源码里 「.<key> === '<异常类型>'」 → 试 module.<key>=<类型>
        const src = fs.readFileSync(path.join(CHARS, srcFileFor(id)), 'utf8');
        for (const ty of (known ? [known] : srcTypes)) {
          const keys = [...new Set([...src.matchAll(new RegExp("\\.(\\w+)\\s*===\\s*'" + ty + "'", 'g'))].map((m) => m[1]))].filter((k) => !['type', 'kind'].includes(k));
          for (const k of keys) {
            const c2 = clone(soloBase); c2.team[0].module = Object.assign({}, c2.team[0].module || {}, { [k]: ty });
            const r2 = E.simulate(prep(c2, { duration: wins[0] }), idx);
            const a2 = anomalyOwn(r2, 0) / (r2.total || 1);
            if (a2 > 0) { anS = a2; anCtx = `单人 ${wins[0]}s，module.${k}='${ty}'（默认模式下 0%）`; break; }
          }
          if (anS > 0) break;
        }
      }
      if (anS === 0 && rT) { const a2 = anomalyOwn(rT, tmi) / (rT.total || 1); if (a2 > 0) { anS = a2; anCtx = `队伍 ${teamEx.file}`; } }
      if (anS === 0) { const a3 = anomalyOwn(rL, 0) / (rL.total || 1); if (a3 > 0) { anS = a3; anCtx = `单人 ${wL}s`; } }
    }
    const anData = { types: known ? [known] : srcTypes, share: r1(anS * 100), context: anCtx };
    if (!applier) add('anomaly', anS > 0 ? 'PASS' : 'SKIP', anS > 0 ? `异常占比 ${pct(anS)}` : baneApplier ? '只施加虚湮（无伤害），见「虚湮」检查' : '不施加异常', anData);
    else if (anS === 0 && !known) add('anomaly', 'WARN', `源码会施加 ${anData.types.join('/')}，但单人/队伍运行中占比 0%（未在 audit.anomaly 声明 → 视为条件施加${A.note ? '；模块说明：' + A.note : '，若为条件施加请在 audit.note 说明'}）`, anData);
    else if (anS === 0) add('anomaly', 'FAIL', `已声明施加 ${anData.types.join('/')}（audit.anomaly / signature_weapons.json），但异常伤害占比 0%`, anData);
    else if (anS > TH.anomalyMax) add('anomaly', 'WARN', `异常伤害占比 ${pct(anS)} > ${TH.anomalyMax * 100}%`, anData);
    else if (A.anomalyMin && anS < A.anomalyMin) add('anomaly', 'WARN', `异常伤害占比 ${pct(anS)} < 模块 audit.anomalyMin ${pct(A.anomalyMin)}`, anData);
    else add('anomaly', 'PASS', `${anData.types.join('/')} 占 ${pct(anS)}（${anCtx}）`, anData);

    // --- 4. stamina / heavy share
    let hv = null;
    for (const D of wins) { const acts = own(runs[D].r, 0); const s = acts.length ? acts.filter((a) => a.cls === 'H').length / acts.length : 0; if (!hv || s > hv.share) hv = { share: s, window: D }; }
    add('stamina', hv.share > TH.heavyShare ? 'WARN' : 'PASS', `重击占动作 ${pct(hv.share)}（${hv.window}s）${hv.share > TH.heavyShare ? ` > ${TH.heavyShare * 100}%，检查耐力/重击建模` : ''}`, { heavyShare: r1(hv.share * 100), window: hv.window });

    // --- 4b. time-stop safety（单人第一个窗口 + 队伍）
    {
      const tsS = timeStopStats(rS, 0), tsT = rT ? timeStopStats(rT, tmi) : null;
      const data = { solo: tsS, team: tsT };
      const viol = [].concat(tsS.actions.filter((x) => x.violation).map((x) => `单人 ${x.label}：${x.violation}`), tsT ? tsT.actions.filter((x) => x.violation).map((x) => `队伍 ${x.label}：${x.violation}`) : []);
      const share = Math.max(tsS.damagePct, tsT ? tsT.damagePct : 0);
      const msg = `含时停动作 伤害 ${tsS.damagePct}%（单人）${tsT ? ' / ' + tsT.damagePct + '%（队伍）' : ''}；占战斗时间 ${tsS.combatPct}%，按动画 ${tsS.animPct}%（时停 ${tsS.timeStopSec}s，口径 ${tsS.mode}）`;
      if (viol.length) add('timestop', 'FAIL', '使用次数超过冷却/资源上限：' + viol.join('；') + '；' + msg, data);
      else if (share > TH.timeStopShare * 100) add('timestop', 'WARN', msg + ` > ${TH.timeStopShare * 100}%（结果依赖“时停不计时”口径）`, data);
      else add('timestop', tsS.actions.length || (tsT && tsT.actions.length) ? 'PASS' : 'SKIP', tsS.actions.length || (tsT && tsT.actions.length) ? msg : '无含时停帧的动作', data);
    }
    // --- 4c. chainModeled
    {
      const cm = mod0.chainModeled !== undefined ? mod0.chainModeled : (rS.members[0].moduleInfo || {}).chainModeled;
      row.chainModeled = cm === undefined ? null : cm;
      if (cm === undefined) add('chain', ENGINE_HAS_CHAIN ? 'WARN' : 'SKIP', ENGINE_HAS_CHAIN ? '模块未提供 chainModeled' : '未提供（引擎尚无 chainModeled 字段）');
      else add('chain', 'PASS', typeof cm === 'object' ? JSON.stringify(cm) : String(cm), { value: cm });
    }
    // --- 5. durations
    const dc = { frames: 0, config: 0, 'module-estimate': 0, default: 0 };
    for (const a of actsL) { const k = a.durSource === 'frames' ? 'frames' : a.durSource === 'config' ? 'config' : a.durSource === 'module-estimate' ? 'module-estimate' : 'default'; dc[k]++; }
    const nA = actsL.length || 1, estS = (dc.default + dc['module-estimate']) / nA;
    const durMsg = `帧 ${pct(dc.frames / nA)} · 配置 ${pct(dc.config / nA)} · 模块估计 ${pct(dc['module-estimate'] / nA)} · 默认 ${pct(dc.default / nA)}`;
    const fm = (rL.warnings || []).some((w) => w.code === 'frames-missing');
    add('durations', estS > TH.estDurShare ? 'WARN' : 'PASS', durMsg + (fm ? '（action_frames 无此角色）' : ''), { counts: dc, n: actsL.length, estShare: r1(estS * 100), framesMissing: fm });

    // --- 6. support on-field in team
    if (role === 'dps') add('team', rT ? 'PASS' : 'SKIP', rT ? `队伍 ${teamEx.file} 个人占比 ${row.team.share}%` : '无队伍配置');
    else if (!rT) add('team', 'WARN', `定位 ${role}，但没有可搜索的队伍配置（模块 audit.team 或 engine/chars/examples/team_*.json）`);
    else {
      const on = rT.timeline.filter((a) => a.mi === tmi && !a.status && !a.coord && a.cls !== 'O' && a.cls !== 'W' && a.cls !== 'S');
      const io = rT.timeline.filter((a) => a.mi === tmi && (a.cls === 'I' || a.cls === 'O'));
      const rTeam = on.filter((a) => a.cls === 'R').length;
      const lvl = !on.length ? 'FAIL' : (!io.length || !rTeam) ? 'WARN' : 'PASS';
      add('team', lvl, !on.length ? `队伍 ${teamEx.file} 中从未上场` : `队伍 ${teamEx.file}：上场动作 ${on.length} 个，R×${rTeam}，变奏/延奏 ${io.length} 次${io.length ? '' : '（无变奏/延奏）'}${rTeam ? '' : '（队伍中也不放 R）'}；个人占比 ${row.team.share}%`, { onField: on.length, introOutro: io.length, liberations: rTeam });
    }
    // module-level warnings (missing hit rows)
    const miss = (rL.warnings || []).filter((w) => /找不到/.test(w.text || '')).map((w) => w.text);
    if (miss.length) errors.push('命中行缺失：' + [...new Set(miss)].slice(0, 3).join('；'));
  } catch (e) { errors.push('异常：' + (e && e.message || e)); if (verbose) console.error(e); }
  // --- 7. errors
  add('errors', errors.length ? 'FAIL' : 'PASS', errors.length ? errors.join('；') : '无', { list: errors });
  return row;
}

// ---------------------------------------------------------------- run
const T0 = Date.now();
const rows = [];
for (const id of ids) {
  const t = Date.now();
  const row = audit(id); row.ms = Date.now() - t; rows.push(row);
  if (verbose) console.log(`\n# ${id} ${row.name}: ${row.status}\n  solo ${row.solo && row.solo.seq}\n  40s  ${row.solo && row.solo.seq40}\n  ${JSON.stringify(row.checks)}`);
  else process.stdout.write(`${id} ${row.name} ${row.status} (${row.ms}ms)\n`);
}
const CK = ['search', 'signature', 'anomaly', 'bane', 'stamina', 'timestop', 'chain', 'durations', 'team', 'errors'];
const CKZ = { search: '搜索', signature: '专武', anomaly: '异常', bane: '虚湮', stamina: '耐力', timestop: '时停', chain: '链', durations: '时长', team: '队伍', errors: '错误' };
const tag = (c) => (c ? c.level : '-');
console.log('');
console.table(rows.map((r) => Object.assign({ id: r.id, 角色: r.name, 状态: r.status, 定位: r.role }, Object.fromEntries(CK.map((k) => [CKZ[k], tag(r.checks[k])])), { 原因: r.reasons.join('；').slice(0, 120) })));
const nF = rows.filter((r) => r.status === 'FAIL').length, nW = rows.filter((r) => r.status === 'WARN').length, nE = rows.filter((r) => r.status === 'EXPECTED').length;
const covered = new Set(E.listChars().map((m) => m.id));
const missing = DATA.resonators.filter((r) => !covered.has(r.id));
const stamp = new Date(); const sgt = new Date(stamp.getTime() + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' SGT';
console.log(`\n${rows.length} 个角色：PASS ${rows.length - nF - nW - nE} · EXPECTED ${nE} · WARN ${nW} · FAIL ${nF}（${((Date.now() - T0) / 1000).toFixed(1)}s）；模块覆盖 ${covered.size}/${DATA.resonators.length}`);

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
let prevRows = [];
if (onlyArg || flag('--changed')) { try { prevRows = (JSON.parse(fs.readFileSync(jsonPath, 'utf8')).rows || []).filter((r) => !ids.includes(r.id) && covered.has(r.id)); } catch (e) { /* none */ } }
const allRows = prevRows.concat(rows).sort((a, b) => a.id - b.id);
const prevHashes = (() => { try { return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).files.modules || {}; } catch (e) { return {}; } })();
const fileHashes = Object.assign({}, prevHashes); for (const id of ids) fileHashes[id] = hashes[id];
fs.writeFileSync(jsonPath, JSON.stringify({ generated: sgt, engine: E.VERSION, data: idx.meta.version, thresholds: TH, files: { lib: libHash, modules: fileHashes },
  coverage: { modules: covered.size, total: DATA.resonators.length, missing: missing.map((r) => ({ id: r.id, name: r.name })) }, ranThisTime: ids, rows: allRows }, null, 1) + '\n');

const modeShort = (r) => { const m = r.modes || {}; const so = m['solo' + (r.solo && r.solo.window)]; const t = m.team; const f = (x) => x ? `${x.window}s${x.timeStop === 'exclude' ? '' : '·时停计时'}${x.residual ? '·残值' : ''}${x.steady ? '·稳态' : ''}` : '-'; return `${f(so)} / ${f(t)}`; };
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [];
md.push('# 角色模块健康检查（module_audit）', '');
md.push(`生成：${sgt} · 引擎 ${E.VERSION} · 数据 ${idx.meta.version} · 本次检查 ${rows.length} 个（表中合计 ${allRows.length} 个，含以前运行的结果）· 模块覆盖 ${covered.size}/${DATA.resonators.length}`, '');
md.push('## 用法', '', '```', HELP, '```', '');
md.push('### 检查项与阈值', '',
  `| 检查 | 内容 | FAIL | WARN |`, '|---|---|---|---|',
  `| 搜索 | 单人自动搜索（窗口见下方“模式”） | 单一动作 > ${TH.spamShare * 100}%（只刷一个动作）；40s 内能量满过却从不放 R；audit.finishers 未出现；模块资源从未减少 | 40s 内能量从未满、没放 R；support 定位时“能量满却不放 R”降为 WARN |`,
  `| 专武 | compareGear（researchRotation + 交叉回放）对比 2–3 把同类武器；dps 看单人，subdps/support 看队伍 | 未排第一且落后 > ${TH.sigNoisePct}% | 落后 ≤ ${TH.sigNoisePct}%（搜索噪声）；专武为数据推断；support 无队伍配置；专武 TODO |`,
  `| 异常 | 本人异常伤害占比（不含虚湮；模块源码含 addAnomaly 或 audit/表中 anomaly 视为施加者；源码为 0 时依次重试：去掉 external 选项 → 切换模式开关 → 队伍 → 长窗口） | audit.anomaly / 表中声明的施加者为 0% | 仅源码检测到且为 0%（条件施加）；> ${TH.anomalyMax * 100}% |`,
  `| 虚湮 | 只减防不造成伤害：同一序列在原数据 / 虚湮减防表清零的数据上重放，增伤 = 比值 − 1（优先队伍预设，否则单人） | 模块会施加却从未施加；已施加但增伤 ≤ 0 | 增伤 > ${TH.baneMax * 100}%；或超过观测最高层数的理论防御区增益 + ${TH.baneSlackPct} 个百分点 |`,
  `| 耐力 | 重击占动作数 | — | > ${TH.heavyShare * 100}% |`,
  `| 时停 | 本人含时停帧的动作：伤害占全队总伤害的比例（单人 = 本人）、占窗口战斗时间（扣除时停）与按完整动画的比例；逐动作使用次数 vs 冷却（战斗时间内相邻两次间隔 ≥ 冷却、次数 ≤ ⌊窗口/冷却⌋+1）与能量（R 施放前能量 ≥ 消耗）；模块资源门槛未独立核对 | 任一动作超冷却/能量上限 | 伤害占比 > ${TH.timeStopShare * 100}%（单人或队伍） |`,
  `| 链 | 模块 chainModeled（共鸣链建模范围） | — | 引擎已有该字段而模块未提供（引擎无该字段时记“未提供”，不告警） |`,
  `| 时长 | 40s 单人动作的时长来源：帧 / 配置 / 模块估计 / 默认 | — | 估计+默认 > ${TH.estDurShare * 100}% |`,
  `| 队伍 | 辅助在默认队伍中是否上场、是否放 R、是否有变奏/延奏 | 从未上场 | 无变奏/延奏；队伍中不放 R；无队伍配置 |`,
  `| 错误 | 异常抛出、NaN、负伤害、总伤害 0、不可搜索、模块命中行缺失 | 任一 | — |`, '',
  `模式：不硬编码。单人第一个窗口 = 模块 audit.window > 单人预设 duration > 25s，第二个 = max(40, 第一个)（相同则只跑一次）；队伍用预设自己的 duration / start（含 start.steady）/ search（含 residual、residualWeight）/ timeStop，未写的按引擎默认（timeStop=exclude 时停不计战斗时间；search.residual=auto 队伍开、权重 0.5；残值只影响搜索排序，不计入伤害）。每次运行实际采用的模式从引擎结果读取，写入 JSON 的 rows[].modes 与下表“模式”列。`, '',
  `定位（role）：模块 audit.role > signature_weapons.json > 推断（队伍中个人伤害占比 ≥ ${TH.dpsShare * 100}% 视为 dps，无队伍按 dps）。默认对比武器按类型取常驻 5★ / 活动 5★ / 4★ 暴击系（${Object.entries(STD_ALTS).map(([k, v]) => k + ':' + v.map((w) => (WPN.get(w) || {}).name).join('/')).join('；')}）。`, '');
md.push('## 结果', '', `PASS ${allRows.filter((r) => r.status === 'PASS').length} · EXPECTED ${allRows.filter((r) => r.status === 'EXPECTED').length} · WARN ${allRows.filter((r) => r.status === 'WARN').length} · FAIL ${allRows.filter((r) => r.status === 'FAIL').length}`, '');
md.push('| id | 角色 | 状态 | 定位 | 模式（单人 / 队伍） | 搜索 | 专武 | 异常 | 虚湮 | 耐力 | 时停（伤害/战斗时间/动画） | 链 chainModeled | 时长 | 队伍 | 错误 | 原因 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of allRows) {
  const c = r.checks || {};
  const cell = (k, s) => `${tag(c[k])}${s ? ' ' + s : ''}`;
  md.push(`| ${r.id} | ${r.name} | **${r.status}** | ${r.role || '-'} | ${esc(modeShort(r))} | ${cell('search', c.search && c.search.spam ? `最高 ${c.search.spam.share}% · R×${c.search.liberations40}` : '')} | ${cell('signature', c.signature && c.signature.rank ? `${c.signature.rank}/${c.signature.of}` : '')} | ${cell('anomaly', c.anomaly && c.anomaly.share ? c.anomaly.share + '%' : '')} | ${cell('bane', c.bane && c.bane.solo ? '增伤 ' + ((c.bane.team && c.bane.team.applied ? c.bane.team : c.bane.solo).gainPct) + '%' : '')} | ${cell('stamina', c.stamina ? c.stamina.heavyShare + '%' : '')} | ${cell('timestop', c.timestop && c.timestop.solo ? `${c.timestop.solo.damagePct}% / ${c.timestop.solo.combatPct}% / ${c.timestop.solo.animPct}%` : '')} | ${r.chainModeled == null ? '未提供' : esc(typeof r.chainModeled === 'object' ? JSON.stringify(r.chainModeled) : r.chainModeled)} | ${cell('durations', c.durations ? '估计 ' + c.durations.estShare + '%' : '')} | ${cell('team')} | ${cell('errors')} | ${esc(r.reasons.join('；')) || '—'} |`);
}
const exRows = allRows.filter((r) => (r.expected || []).length);
md.push('', '## 预期行为（EXPECTED，来自 validation/tools/audit_expected.json；不计入 WARN、不影响退出码）', '');
if (exRows.length) { md.push('| id | 角色 | 检查 | 审计说明 | 预期原因 | 来源 |', '|---|---|---|---|---|---|'); for (const r of exRows) for (const x of r.expected) md.push(`| ${r.id} | ${r.name} | ${CKZ[x.check] || x.check} | ${esc(x.msg)} | ${esc(x.reason)} | ${esc(x.source || '')} |`); }
else md.push('无');
md.push('', '## 明细', '');
for (const r of allRows) {
  md.push(`### ${r.id} ${r.name}（${r.status}，模块 v${r.version || '?'} · ${r.confidence || '?'}，${r.file || ''}）`, '');
  md.push(`- 配置：单人 ${r.config ? r.config.solo : '-'}；队伍 ${r.config && r.config.team || '无'}；定位 ${r.role}（${r.roleSrc || '-'}）`);
  if (r.solo) md.push(`- 单人 ${r.solo.window}s：${r.solo.total.toLocaleString('en-US')}，\`${r.solo.seq}\``, `- 单人 ${r.solo.windowLong || 40}s：${r.solo.total40.toLocaleString('en-US')}，\`${r.solo.seq40}\``);
  if (r.team) md.push(`- 队伍 ${r.team.file}：${r.team.total.toLocaleString('en-US')}，个人占比 ${r.team.share}%，\`${r.team.seq}\``);
  for (const [k, m] of Object.entries(r.modes || {})) md.push(`- 模式 ${k === 'team' ? '队伍' : '单人'}：${modeStr(m)}`);
  const tsd = r.checks.timestop; if (tsd && tsd.solo) for (const [nm, t] of [['单人', tsd.solo], ['队伍', tsd.team]]) if (t && t.actions.length) md.push(`- 时停动作（${nm}）：` + t.actions.map((x) => `${x.label} ×${x.uses}（时停 ${x.timeStop}s，伤害 ${x.damagePct}%，${x.gate}${x.cooldown ? ' ' + x.cooldown + 's 上限 ' + x.limit : ''}${x.minGap != null ? '，最小间隔 ' + x.minGap + 's' : ''}${x.violation ? '，**' + x.violation + '**' : ''}）`).join('；'));
  for (const k of CK) if (r.checks[k]) md.push(`- ${CKZ[k]}：${r.checks[k].level} — ${esc(r.checks[k].msg)}${r.checks[k].ranking ? '；排名：' + esc(r.checks[k].ranking) : ''}`);
  const res = r.checks.search && r.checks.search.resources; if (res && res.length) md.push(`- 资源（40s，减少次数/最大值）：${res.map((x) => `${x.name || x.key} ${x.drops}/${x.max}`).join(' · ')}`);
  for (const x of r.info) md.push(`- 注：${esc(x)}`);
  md.push('');
}
md.push('## 尚无模块的角色', '', missing.map((r) => `${r.id} ${r.name}`).join('、') || '无', '');
fs.writeFileSync(mdPath, md.join('\n'));
console.log(`写出 ${path.relative(ROOT, jsonPath)}、${path.relative(ROOT, mdPath)}`);
process.exit(nF ? 1 : 0);
