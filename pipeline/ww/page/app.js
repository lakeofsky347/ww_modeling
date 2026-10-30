/* 鸣潮 · 伤害模拟器 — page app (inlined into dist/ww/index.html by pipeline/ww/page/build_page.py).
 * Renders into the fixed containers of frontend/ww/index.html using only the classes in frontend/ww/COMPONENTS.md.
 * Engine: assets/ww-engine.js (per-game package; shared dist resolves it from the page config) (window.WWEngine, character modules registered dynamically).
 * Simulation runs in assets/ww-worker.js (falls back to the main thread when workers are unavailable). */
(function () {
'use strict';
var CFG = window.__WW_PAGE__ || {};
var E = window.WWEngine;
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmt(n, d) { if (n == null || isNaN(n)) return '-'; return Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); }
function pctTxt(v, d) { return (Math.round(v * Math.pow(10, 2 + (d == null ? 1 : d))) / Math.pow(10, d == null ? 1 : d)) + '%'; }

// ---------------------------------------------------------------- loader hooks (typeof-guarded)
function ui(name, arg) {
  function go() {
    var f = window[name];
    if (typeof f === 'function') { try { f(arg); } catch (e) { /* theme hook must not break the page */ } return; }
    if (name === '__uiError') {
      var d = document.getElementById('sim-load-error') || document.createElement('div');
      d.setAttribute('role', 'alert'); d.id = 'sim-load-error';
      d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;padding:16px 20px;background:#3a1515;color:#ffd7d7;font:14px/1.5 sans-serif;white-space:pre-wrap';
      d.textContent = '加载失败：' + arg;
      (document.body || document.documentElement).appendChild(d);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
function fail(msg) { window.__SIM_LOAD_ERROR__ = msg; ui('__uiError', msg); }

// ---------------------------------------------------------------- constants
var ELZH = { glacio: '冷凝', fusion: '热熔', electro: '导电', aero: '气动', spectro: '衍射', havoc: '湮灭', physical: '物理' };
var WTYPE = { 1: '长刃', 2: '迅刀', 3: '佩枪', 4: '臂铠', 5: '音感仪' };
var MAINS = {
  4: [['Crit', '暴击'], ['CritDamage', '暴击伤害'], ['Atk%', '攻击%'], ['LifeMax%', '生命%'], ['Def%', '防御%'], ['HealChange', '治疗效果加成']],
  3: [['elemDmg', '本属性伤害'], ['Atk%', '攻击%'], ['LifeMax%', '生命%'], ['Def%', '防御%'], ['EnergyEfficiency', '共鸣效率'],
      ['DamageChangeElement1', '冷凝伤害'], ['DamageChangeElement2', '热熔伤害'], ['DamageChangeElement3', '导电伤害'],
      ['DamageChangeElement4', '气动伤害'], ['DamageChangeElement5', '衍射伤害'], ['DamageChangeElement6', '湮灭伤害']],
  1: [['Atk%', '攻击%'], ['LifeMax%', '生命%'], ['Def%', '防御%']],
};
var SKILLS = [['basic', '常态攻击'], ['skill', '共鸣技能'], ['liberation', '共鸣解放'], ['intro', '变奏技能'], ['forte', '共鸣回路']];
var MECH_ZH = { table: '表格推导', corroborated: '社区印证', community: '待验证', unsolved: '估计', 'community-consensus': '多工具一致（未实测）' };
var SWAP_ZH = { cancel: '取消点', full: '等动作结束', swapTime: '9 帧' };
var STORE = CFG.storageKey || 'ww-sim:config:v1';

// ---------------------------------------------------------------- state
var S = { data: null, chars: null, weapons: null, sonatas: null, echoes: null, tiers: [], tierByKey: {}, config: null, sel: 0, echoSel: 0,
  view: null, lastSearch: null, error: null, running: false, pending: false, jobId: 0, worker: null, workerReady: false, ms: null, modules: {}, runMeta: {},
  auto: true, dirty: false };
// v3.2 engine events & API (bridge: pipeline/shared/sim_bridge.js, prepended by build_page.py)
var SIM = window.__mkSimBridge('ww', (window.__WW_PAGE__ || {}).engineVersion || window.__SIM_ENGINE_VERSION__);   // v3.3 engineVersion (build constant)
// v3.3 chunks (pipeline/shared/sim_chunks.js; COMPONENTS.md「v3.3 数据分块与按需加载」): the index (data/ww.json) carries slim resonator /
// weapon / echo records; the full original records (data/ww-r|w|e<id>.json) and the character modules (data/ww-m<id>-engine.js) are
// merged in before anything reads them, so the engine always sees exactly the v3.2 data. Every computation waits for its chunks.
var COLL = { resonator: 'resonators', weapon: 'weapons', echo: 'echoes' };
var MODS = CFG.modules || {};   // resonator id → module chunk id ('mod:<id>'; the rover pairs share one)
S.full = {}; S.echoIdx = {}; S.addQ = { mods: [], recs: [] }; S.loading = false;
function chunkErr(code, msg, id) { var x = new Error(msg); x.code = code; x.chunk = id; return x; }
function processChunk(e, text) {
  if (e.kind === 'index' || e.kind === 'module') return text;
  var o = JSON.parse(text);
  if (!o || o.chunk !== e.id || o.game !== 'ww' || o.dataVersion !== CFG.version || !o.record) throw chunkErr('mismatch', '分块内容与清单不一致：' + e.id + '（可能混用了新旧版本的文件，请强制刷新）', e.id);
  return o;
}
var LD = window.__mkSimChunks ? window.__mkSimChunks('ww', { manifestUrl: CFG.chunksUrl, base: CFG.chunkBase || '', boot: CFG.boot || [], dataVersion: CFG.version, process: processChunk }) : null;
function execModule(id, src) {
  var owner = 0; for (var k in MODS) if (MODS[k] === id) { owner = +k; break; }
  var s = document.createElement('script');
  s.text = src + '\n//# sourceURL=' + id;
  (document.head || document.documentElement).appendChild(s);
  s.parentNode.removeChild(s);
  if (owner && !(E.getChar && E.getChar(owner))) throw chunkErr('parse', '角色模块执行失败：' + id, id);
}
/** merge one loaded chunk into S.data (full record replaces the slim one at the same position) / execute a module; false if already merged */
function mergeChunk(id, payload) {
  if (S.full[id]) return false;
  if (payload == null) throw chunkErr('missing', '分块未加载：' + id, id);
  if (id.indexOf('mod:') === 0) {
    execModule(id, payload);
    S.addQ.mods.push([id, payload]);
  } else {
    var rec = payload.record, arr = S.data[COLL[payload.kind]], i;
    for (i = 0; i < arr.length; i++) if (arr[i].id === rec.id) break;
    if (i >= arr.length) throw chunkErr('mismatch', '索引里没有 ' + id, id);
    arr[i] = rec;
    if (payload.kind === 'resonator') S.chars[rec.id] = rec;
    else if (payload.kind === 'weapon') S.weapons[rec.id] = rec;
    S.addQ.recs.push({ kind: payload.kind, record: rec });
  }
  S.full[id] = 1;
  return true;
}
/** chunk ids a config needs (team resonators + their modules, weapons, echoes with an echoId) that are not merged yet */
function needChunks(cfg) {
  var out = [], ids = { resonator: [], weapon: [], echo: [] };
  function add(cid, kind, oid) {
    if (S.full[cid] || out.indexOf(cid) >= 0) return;
    out.push(cid); if (ids[kind].indexOf(oid) < 0) ids[kind].push(oid);
  }
  ((cfg && cfg.team) || []).forEach(function (m) {
    if (!m || m.id == null || !S.chars[m.id]) return;
    add('res:' + m.id, 'resonator', +m.id);
    if (MODS[m.id]) add(MODS[m.id], 'resonator', +m.id);
    if (m.weapon && m.weapon.id != null && S.weapons[m.weapon.id]) add('wpn:' + m.weapon.id, 'weapon', +m.weapon.id);
    (m.echoes || []).forEach(function (e) { if (e && e.echoId != null && S.echoIdx[e.echoId]) add('echo:' + e.echoId, 'echo', +e.echoId); });
  });
  return { chunks: out, ids: ids };
}
/** download + merge everything cfg needs; resolves the newly merged chunk ids */
function ensure(cfg, phase) {
  var n = needChunks(cfg);
  if (!n.chunks.length) return Promise.resolve([]);
  if (!LD) return Promise.reject(chunkErr('loader', '分块加载器缺失（sim_chunks.js）', null));
  return LD.load(n.chunks, phase || 'lazy', { ids: n.ids }).then(function (o) {
    var got = [];
    n.chunks.forEach(function (id) { if (mergeChunk(id, o[id])) got.push(id); });
    if (got.length) S.idx = E.indexData(S.data);
    return got;
  });
}
function takeAdd() { var a = S.addQ; S.addQ = { mods: [], recs: [] }; return a.mods.length || a.recs.length ? a : null; }
function loadFailed(e, rid, keepView) {
  var msg = '数据加载失败：' + (e && e.message || e);
  var extra = { phase: 'load', code: (e && e.code) || 'error', chunk: (e && e.chunk) || null, file: (e && e.file) || null };
  if (!keepView) { S.error = msg; S.view = null; renderAll(); }
  var r = rid != null ? rid : (SIM.takeReserved ? SIM.takeReserved() : null);
  if (r != null) SIM.abort(r, msg, extra);
  else SIM.fire('sim:error', Object.assign({ game: 'ww', runId: null, message: msg }, extra));
}
// v3.3: intent delay for the member picker (hover / focus / press → 80 ms → prefetchMember; leave / blur cancels; one prefetch per id)
var PF_DELAY = 80, pfTimer = null, pfItem = null, pfDone = {};
function pfIntentStart(it) {
  if (!it || it === pfItem) return;
  var id = +it.getAttribute('data-id');
  if (pfDone[id]) return;
  clearTimeout(pfTimer); pfItem = it;
  pfTimer = setTimeout(function () {
    pfTimer = null;
    if (pfItem !== it) return;
    pfItem = null;
    if (pfDone[id]) return;
    pfDone[id] = 1; prefetchMember(id);
  }, PF_DELAY);
}
function pfIntentCancel(it) { if (!it || it === pfItem) { clearTimeout(pfTimer); pfTimer = null; pfItem = null; } }
function prefetchMember(id) {
  if (!LD || !S.chars || !S.chars[id]) return;
  var n = needChunks({ team: [defaultMember(+id)] });
  if (n.chunks.length) LD.prefetch(n.chunks);
}
window.__simEnsure = function (cfg) { return S.data ? ensure(cfg, 'lazy') : Promise.reject(new Error('数据尚未加载')); };
window.__simPrefetch = function (kind, id) {
  if (!LD || !S.data) return;
  if (kind === 'resonator') return prefetchMember(id);
  var cid = kind === 'weapon' ? 'wpn:' + id : kind === 'echo' ? 'echo:' + id : null;
  if (cid && !S.full[cid]) LD.prefetch([cid]);
};

// ---------------------------------------------------------------- data helpers
function charById(id) { return S.chars[id]; }
function hasModule(id) { return !!MODS[id] || !!(E && E.getChar && E.getChar(+id)); }   // v3.3: modules load on demand; CFG.modules lists them all
// chainModeled（引擎字段，见 COMPONENTS.md）：所选链数高于它时按 chainModeled 计算
function chainCap(m) { if (!m || m.module === false || !E || !E.chainModeledOf || !S.idx) return null; var c = E.chainModeledOf(S.idx, m.id); return c == null ? null : c; } // == result.members[i].chainModeled
function chainCapTag(m) {
  var c = chainCap(m);
  return c != null && (m.chain || 0) > c ? '<span class="ww-tag chain-cap" title="共鸣链未建模，按 ' + c + ' 链计算">按 ' + c + ' 链</span>' : '';
}
function weaponById(id) { return S.weapons[id]; }
function elemSonata(el) {
  var eid = { glacio: 1, fusion: 2, electro: 3, aero: 4, spectro: 5, havoc: 6 }[el];
  for (var i = 0; i < S.data.sonatas.length; i++) {
    var s = S.data.sonatas[i], p2 = s.pieces && s.pieces['2'];
    if (p2 && (p2.addProp || []).some(function (a) { return a.key === 'DamageChangeElement' + eid; })) return s.id;
  }
  return S.data.sonatas[0].id;
}
function echoesFor(cost, set) {
  return S.data.echoes.filter(function (e) { return e.cost === cost && (!set || (e.sonataGroups || []).indexOf(+set) >= 0); });
}
function defaultMember(id) {
  var R = charById(id);
  var ws = S.data.weapons.filter(function (w) { return w.weaponType === R.weaponType; }).sort(function (a, b) { return b.rarity - a.rarity || a.id - b.id; });
  var set = elemSonata(R.element);
  var q = echoesFor(4, set)[0];
  var e4 = { cost: 4, main: 'Crit', set: set, subs: [] };
  if (q) e4.echoId = q.id;
  return { id: id, level: 90, chain: 0, skillLevels: { basic: 10, skill: 10, liberation: 10, intro: 10, forte: 10 },
    weapon: { id: ws[0] ? ws[0].id : null, level: 90, rank: 1 },
    echoes: [e4, { cost: 3, main: 'elemDmg', set: set, subs: [] }, { cost: 3, main: 'elemDmg', set: set, subs: [] }, { cost: 1, main: 'Atk%', set: set, subs: [] }, { cost: 1, main: 'Atk%', set: set, subs: [] }] };
}
// substat: {stat, tier} | {stat, value}; tiers come from runtime.substatTiers (engine units)
function subKey(st) { var k = st && st.stat; if (S.tierByKey[k]) return k; for (var i = 0; i < S.tiers.length; i++) if (S.tiers[i].zh === k) return S.tiers[i].key; return k; }
function tierOf(sub) {
  var t = S.tierByKey[subKey(sub)]; if (!t) return -1;
  if (sub.tier != null) return sub.tier === 'max' ? t.values.length - 1 : sub.tier === 'min' ? 0 : +sub.tier;
  if (sub.value != null) { var v = +sub.value; if (v > 1.5 && t.unit === 'fraction') v /= 100; for (var i = 0; i < t.values.length; i++) if (Math.abs(t.values[i] - v) < 1e-6) return i; }
  return -1;
}
function tierVal(t, i) { return t.unit === 'fraction' ? pctTxt(t.values[i]) : fmt(t.values[i]); }
function normalizeImported(cfg) {
  // values that match a tier become tier selections (round-trips export → import)
  (cfg.team || []).forEach(function (m) { (m.echoes || []).forEach(function (e) { (e.subs || []).forEach(function (s) {
    var k = subKey(s); if (S.tierByKey[k]) { var i = tierOf(s); s.stat = k; if (i >= 0) { s.tier = i; delete s.value; } }
  }); }); });
  return cfg;
}
function exportConfig() {
  // self-contained: tier selections are written as values (format of VALIDATION_CASES.md; runnable with engine/cli.js)
  var c = clone(S.config);
  (c.team || []).forEach(function (m) { (m.echoes || []).forEach(function (e) { (e.subs || []).forEach(function (s) {
    var t = S.tierByKey[subKey(s)]; if (t && s.tier != null) { var i = tierOf(s); if (i >= 0) { s.value = t.values[i]; delete s.tier; } }
  }); }); });
  delete c.actionFrames; delete c.substatTiers;
  return c;
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(S.config)); } catch (e) { /* storage unavailable */ } }
function validConfig(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.team) || !c.team.length || c.team.length > 3) return '编队需要 1–3 名共鸣者';
  for (var i = 0; i < c.team.length; i++) if (!charById(c.team[i].id)) return '未知共鸣者 id：' + c.team[i].id;
  try { E.buildContext(Object.assign({}, c, { substatTiers: S.data.runtime.substatTiers }), S.idx); } catch (e) { return String(e && e.message || e); }
  return null;
}

// ---------------------------------------------------------------- simulation (worker or main thread)
function startWorker() {
  if (typeof Worker !== 'function' || !CFG.workerUrl) return;
  try {
    var w = new Worker(new URL(CFG.workerUrl, location.href).href);
    w.onmessage = function (ev) {
      var m = ev.data || {};
      // a job queued before the worker was ready keeps its id / runId (re-running would orphan its sim:start, e.g. the share-link run)
      if (m.type === 'ready') { S.workerReady = true; var q = S.queued; S.queued = null; if (q) postSim(q.id, q.cfg); else if (S.pending) run(); }
      else if (m.type === 'init-error') { S.worker = null; w.terminate(); flushQueued(); }
      else if (m.type === 'result') onResult(m);
    };
    w.onerror = function () { if (!S.workerReady) { S.worker = null; try { w.terminate(); } catch (e) {} flushQueued(); } };
    w.postMessage({ type: 'init', engineUrl: new URL(CFG.engineUrl, location.href).href, text: S.dataText });
    S.worker = w;
  } catch (e) { S.worker = null; }
}
function postSim(id, cfg) { S.worker.postMessage({ type: 'sim', id: id, config: cfg, add: takeAdd() }); }   // add: chunks merged since the last message
function flushQueued() { var q = S.queued; S.queued = null; if (q) setTimeout(function () { runSync(q.id, q.cfg); }, 0); else if (S.pending) { S.running = false; run(); } }
function simConfig() { var c = clone(S.config); return c; }
function runSync(id, cfg) {
  var t0 = Date.now();
  try {
    cfg.substatTiers = S.data.runtime.substatTiers;
    if (cfg.actionFrames !== false) cfg.actionFrames = S.data.runtime.actionFrames; else delete cfg.actionFrames;
    var r = E.simulate(cfg, S.idx);
    onResult({ id: id, view: E.toView(r), sequence: r.sequence, total: r.total, ms: Date.now() - t0 });
  } catch (e) { onResult({ id: id, error: String(e && e.message || e), ms: Date.now() - t0 }); }
}
var runTimer = null;
function schedule(delay) { clearTimeout(runTimer); runTimer = setTimeout(run, delay == null ? 250 : delay); }
function run() {
  clearTimeout(runTimer);
  if (S.running) { S.pending = true; return; }
  if (needChunks(S.config).chunks.length) {   // v3.3: fetch the chunks first; sim:start only once everything is merged
    S.pending = false; S.running = true; S.loading = true; renderStatus();
    ensure(S.config, 'lazy').then(function (got) {
      S.running = false; S.loading = false;
      if (got.length) renderInputs(true);
      run();
    }, function (e) {
      S.running = false; S.loading = false; renderStatus();
      loadFailed(e);
    });
    return;
  }
  S.pending = false; S.running = true; S.jobId += 1;
  var id = S.jobId, cfg = simConfig();
  S.runMeta[id] = { rid: SIM.begin(), cfg: clone(cfg), src: rotationSourceOf(cfg) };
  renderStatus();
  if (S.worker && S.workerReady) postSim(id, cfg);
  else if (S.worker && !S.workerReady) S.queued = { id: id, cfg: cfg };   // posted when the worker reports ready (same job id)
  else setTimeout(function () { runSync(id, cfg); }, 0);
}
function onResult(m) {
  S.running = false;
  S.dirty = false;
  clearStale();
  var meta = S.runMeta[m.id]; delete S.runMeta[m.id];
  if (m.id !== S.jobId) { if (meta) SIM.fail(meta.rid, '已被新的计算取代'); if (S.pending) run(); return; }
  S.ms = m.ms;
  if (m.error) { S.error = m.error; S.view = null; }
  else {
    S.error = null; S.view = m.view;
    if (m.view.search) S.lastSearch = { search: m.view.search, key: searchKey() };
  }
  window.__WW_LAST__ = { total: m.total, sequence: m.sequence, ms: m.ms, error: m.error || null, jobId: m.id,
    timeStopSaved: m.view ? m.view.summary.timeStopSaved || 0 : null, tailFreeze: m.view ? m.view.summary.tailFreeze || null : null, members: m.view ? m.view.team : null, warnings: m.view ? m.view.warnings : null };
  renderAll();
  if (meta) {
    if (m.error) SIM.fail(meta.rid, m.error);
    else { try { SIM.done(meta.rid, simDetail(m, meta.cfg, meta.src)); } catch (e) { SIM.fail(meta.rid, '结果导出失败：' + (e && e.message || e)); } }
  }
  if (S.pending) run();
}
// result detail (sim:result / __simResult / __simApply promise): see frontend/ww/COMPONENTS.md「Engine events & API (v3.2)」
// flat action order shared by detail.timeline (index) and the DOM (.ww-act data-act-index): lanes in order, actions in lane order,
// then stable-sorted by t, member. returns [{li, ai}] (position = detail.timeline index)
function flatActs(V) {
  var out = [];
  V.timeline.lanes.forEach(function (l, li) { l.actions.forEach(function (a, ai) { out.push({ li: li, ai: ai, t: a.t, member: l.member }); }); });
  out.sort(function (a, b) { return a.t - b.t || a.member - b.member; });
  return out;
}
// v3.3 rotationSource: 'search' (rotation.mode search → the engine searched), 'preset' (a preset's fixed sequence: loaded from the
// preset menu / a preset card, or any manual rotation equal to a preset's sequence for the same team), 'locked' (__simApply lockRotation),
// 'manual' (anything else the user arranged: edited steps, applied search candidate, imported / shared manual sequence).
// S.rotTag remembers the last preset / lockRotation sequence; any edit changes the sequence and so falls back to 'manual'.
function rotationSourceOf(cfg) {
  var r = (cfg && cfg.rotation) || {};
  if (r.mode === 'search' || !r.sequence) return 'search';
  if (S.rotTag && S.rotTag.seq === r.sequence) return S.rotTag.kind;
  if (r.origin === 'search') return 'manual';   // replay of a searched result's detail.config (explicit sequence) — never 'preset'
  var ids = JSON.stringify(((cfg && cfg.team) || []).map(function (m) { return m && m.id; }));
  var hit = (CFG.presets || []).some(function (p) { var pr = (p.config && p.config.rotation) || {};
    return pr.mode === 'manual' && pr.sequence === r.sequence && JSON.stringify(((p.config && p.config.team) || []).map(function (m) { return m && m.id; })) === ids; });
  return hit ? 'preset' : 'manual';
}
function simDetail(m, cfg, src) {
  var V = m.view, ids = V.ids || [], dmg = {};
  (V.share.byMember || []).forEach(function (x) { dmg[x.member] = x; });
  var tl = flatActs(V).map(function (f, i) {
    var l = V.timeline.lanes[f.li], a = l.actions[f.ai];
    return { index: i, lane: l.member, laneIndex: f.ai, member: l.member, id: l.id != null ? l.id : ids[l.member], t: a.t, av: a.t, endT: a.endT, rt: a.rt != null ? a.rt : null, rtEnd: a.rtEnd != null ? a.rtEnd : null, cls: a.cls, key: a.key, tok: a.tok, label: a.label,
        skillId: a.skillId, skillIdBy: a.skillIdBy, skillIcon: ((skillOf(l.id != null ? l.id : ids[l.member], a.skillId) || {}).skillIcon) || null, echoId: a.echoId, damage: a.damage || 0, coord: !!a.coord, offfield: !!a.offfield,
        timeStop: a.timeStop, truncated: !!a.truncated, credit: a.credit, tailFreeze: !!a.tailFreeze, delayedBy: a.delayedBy || 0 };
  });
  var seq = String(V.sequence || m.sequence || '');
  // v3.3: a searched run exports its rotation explicitly — detail.config.rotation = {mode:'manual', sequence:<searched sequence>,
  // origin:'search'} — so __simApply(detail.config) / share links / plans replay exactly this rotation (no new search, no preset
  // sequence; same total to the last digit; rotationSource 'manual'). Exception: 稳态开局 (start.steady) searches per loop, a single
  // manual sequence would not reproduce it → config kept as is (mode search; re-search is deterministic, same total).
  if (V.search && seq && !(cfg && cfg.start && cfg.start.steady)) {
    cfg = clone(cfg);
    cfg.rotation = Object.assign({}, cfg.rotation || {}, { mode: 'manual', sequence: seq, origin: 'search' });
  }
  // v3.3 MECH.clock: clock {mode, gameTime, realTime, frozen, gameEnd, dpsClock} (gameTime = window; realTime = window + frozen seconds);
  // timeline[i].rt / rtEnd = realTime position (t / endT stay on the game clock). engineVersion is added by the bridge (SIM.done).
  var ck = V.summary.clock || null;
  return SIM.clone({ dataVersion: S.data.meta.version, dataCommit: S.data.meta.source_commit, engine: E.VERSION || null, config: cfg,
    // v3.3: searched = this run's rotation came from the engine's automatic search (view.search present); rotationSource see rotationSourceOf
    searched: !!(V && V.search), rotationSource: src || rotationSourceOf(cfg),
    clock: ck ? { mode: ck.mode, gameTime: ck.gameTime, realTime: ck.realTime, frozen: ck.frozen, gameEnd: ck.gameEnd, dpsClock: ck.dpsClock } : null,
    summary: V.summary,
    members: V.team.map(function (t, i) { var d = dmg[i] || {}; return { index: i, id: ids[i], name: t.name, el: t.el, chain: t.chain, chainModeled: t.chainModeled, module: t.module, damage: d.damage || 0, pct: d.pct || 0 }; }),
    // v3.4 swap cooldown (pass-through from toView, no value change): adjust {swapCdDelays, swapCdDelaySec}, swapCooldown (s), timeline[i].delayedBy
    adjust: V.adjust || { swapCdDelays: 0, swapCdDelaySec: 0 }, swapCooldown: V.swapCooldown != null ? V.swapCooldown : null,
    timeline: tl, breakdown: V.breakdown, rotation: seq ? seq.split(/\s+/) : [], illegal: V.illegal || [], waits: V.waits || [], warnings: V.warnings || [] });
}
function simFindMissingIds(cfg) {
  var out = [], son = {}, ech = {};
  (S.data.sonatas || []).forEach(function (x) { son[x.id] = 1; });
  (S.data.echoes || []).forEach(function (x) { ech[x.id] = 1; });
  function miss(kind, id, ok) { if (id != null && id !== '' && !ok) out.push(kind + ':' + id); }
  ((cfg && cfg.team) || []).forEach(function (m) {
    if (!m) return;
    miss('resonator', m.id, S.chars[m.id]);
    if (m.weapon) miss('weapon', m.weapon.id, S.weapons[m.weapon.id]);
    (m.echoes || []).forEach(function (e) { if (!e) return; miss('echo', e.echoId, ech[e.echoId]); miss('sonata', e.set, son[e.set]); });
  });
  return out.filter(function (x, i) { return out.indexOf(x) === i; });
}
window.__simFindMissingIds = simFindMissingIds;
// __simApply(config, {runId, lockRotation}) → Promise<detail>. lockRotation: tokens (detail.rotation) or objects with .tok; replayed as a manual
// sequence on top of config.rotation (keeps start etc.); rejected tokens come back in detail.illegal [{index, token, reason}] — never skipped silently
// v3.3: the chunks the config needs are loaded (and merged) first; the runId is reserved only after that, so a computation started
// meanwhile cannot take it. A load failure rejects with e.detail.phase === 'load' (sim:error, no sim:start).
window.__simApply = function (config, opts) {
  opts = opts || {};
  var c0 = null, pre = null;
  try {
    if (!S.data) throw new Error('数据尚未加载');
    if (!config || typeof config !== 'object') throw new Error('config 必须是对象');
    c0 = clone(config);
    var miss0 = simFindMissingIds(c0);
    if (miss0.length) throw new Error('数据中不存在：' + miss0.join(', '));
  } catch (e) { pre = e; }
  if (pre) return applyNow(config, opts);
  return ensure(c0, 'lazy').then(function () { return applyNow(config, opts); },
    function (e) { var q = SIM.request(opts.runId); loadFailed(e, q.runId, true); return q.promise; });
};
function applyNow(config, opts) {
  var q = SIM.request(opts.runId), c;
  try {
    if (!S.data) throw new Error('数据尚未加载');
    if (!config || typeof config !== 'object') throw new Error('config 必须是对象');
    c = clone(config); delete c.actionFrames; delete c.substatTiers;
    var miss = simFindMissingIds(c);
    if (miss.length) throw new Error('数据中不存在：' + miss.join(', '));
    // v3.3 opts.search: ignore any fixed (preset / manual) sequence and run the automatic search; the result is the search result only
    // (the preset rule max(search, previous sequence) is a build-time rule for preset cards and is NOT mixed in here)
    if (opts.search && opts.lockRotation) throw new Error('opts.search 与 opts.lockRotation 不能同时使用');
    S.rotTag = null;
    if (opts.search) c.rotation = Object.assign({}, c.rotation || {}, { mode: 'search', sequence: '' });
    if (opts.lockRotation) {
      if (!Array.isArray(opts.lockRotation)) throw new Error('lockRotation 必须是数组');
      var toks = opts.lockRotation.map(function (x) { var t = typeof x === 'string' ? x : (x && x.tok); t = String(t == null ? '' : t).trim(); return t && !/\s/.test(t) ? t : '?'; });
      c.rotation = Object.assign({}, c.rotation || {}, { mode: 'manual', sequence: toks.join(' ') });
      S.rotTag = { kind: 'locked', seq: c.rotation.sequence };
    }
    c.rotation = c.rotation || { mode: 'search', sequence: '' };
    var bad = validConfig(c);
    if (bad) throw new Error(bad);
  } catch (e) { SIM.abort(q.runId, e && e.message || e); return q.promise; }
  S.config = c; S.sel = 0; S.echoSel = 0; S.lastSearch = null; save(); renderInputs();
  run();
  return q.promise;
}
function searchKey() { var c = clone(S.config); delete c.rotation; delete c.buffOverrides; return JSON.stringify(c); }

// ---------------------------------------------------------------- rendering: top bar
function renderTop() {
  var opts = '<option value="">载入预设…</option>' + (CFG.presets || []).map(function (p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join('');
  $('ww-top-actions').innerHTML = '<select id="ww-preset" style="width:200px" aria-label="载入预设">' + opts + '</select>' +
    '<button class="ww-btn sm" id="ww-import">导入</button><button class="ww-btn sm" id="ww-export">导出</button>';
  var run = $('ww-top-run');
  if (run) run.innerHTML = '<label class="auto-toggle" title="改参数后自动重算"><input type="checkbox" id="ww-auto"' + (S.auto ? ' checked' : '') + ' aria-label="自动计算"><span>自动计算</span></label>' +
    '<button type="button" class="ww-btn more-btn" id="ww-more" aria-expanded="false" aria-controls="top-more" aria-haspopup="menu">⋯更多</button>' +
    '<button type="button" class="ww-btn pri" id="ww-run">计算</button>';
  $('ww-preset').onchange = function () {
    var p = CFG.presets[+this.value]; if (!p) return;
    S.config = clone(p.config); S.rotTag = p.config.rotation && p.config.rotation.mode === 'manual' ? { kind: 'preset', seq: p.config.rotation.sequence } : null;
    S.sel = 0; S.echoSel = 0; S.lastSearch = null; S.dirty = false; clearStale(); save(); renderInputs(); run(); this.value = '';
    toast('已载入预设：' + p.name);
  };
  $('ww-run').onclick = function () { if (invalidCount()) return; S.dirty = false; run(); };
  $('ww-import').onclick = openImport;
  $('ww-export').onclick = openExport;
  var auto = $('ww-auto');
  if (auto) auto.onchange = function () { S.auto = auto.checked; if (S.auto && S.dirty && !invalidCount()) run(); renderStatus(); };
  var more = $('ww-more'), bar = $('ww-top');
  if (more && bar) more.onclick = function (ev) {
    ev.stopPropagation();
    var open = bar.classList.toggle('more-open');
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var f = bar.querySelector('#top-more button, #top-more select, #top-more input'); if (f) f.focus(); }
  };
  if (!window.__wwMoreBound) {
    window.__wwMoreBound = true;
    document.addEventListener('click', function (e) {
      var top = document.getElementById('ww-top');
      if (!top || !top.classList.contains('more-open')) return;
      if (e.target.closest && e.target.closest('#top-more, .more-btn')) return;
      top.classList.remove('more-open');
      var b = top.querySelector('.more-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var top = document.getElementById('ww-top');
      if (!top || !top.classList.contains('more-open')) return;
      top.classList.remove('more-open');
      var b = top.querySelector('.more-btn'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
    });
  }
  renderStatus();
}
function invalidCount() { return document.querySelectorAll('input[aria-invalid="true"]').length; }
function clearStale() { var el = $('ww-summary'); if (el) el.classList.remove('stale'); }
function markStale() { var el = $('ww-summary'); if (el && S.view) el.classList.add('stale'); }
function renderStatus() {
  var b = $('ww-run'), st = $('ww-status');
  var n = invalidCount();
  if (b) {
    b.disabled = S.loading || S.running || n > 0;
    b.textContent = S.loading ? '加载数据…' : S.running ? (S.config && S.config.rotation && S.config.rotation.mode === 'search' ? '搜索中…' : '计算中…') : '计算';
  }
  if (!st) return;
  st.className = 'status';
  if (S.loading || S.running) { st.className = 'status run'; st.textContent = S.loading ? '加载数据…' : '计算中…'; }
  else if (n) { st.className = 'status err'; st.textContent = '有 ' + n + ' 项未生效'; }
  else if (S.error) { st.className = 'status err'; st.textContent = '计算失败'; }
  else if (S.dirty) st.textContent = S.auto ? '等待重算…' : '参数已修改，点击「计算」';
  else if (S.view && S.ms != null) st.textContent = '✓ 耗时 ' + S.ms + ' ms';
  else st.textContent = '';
  if (window.__gresult) window.__gresult.refresh();
}
function toast(msg) {
  var t = document.createElement('div'); t.className = 'ww-toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 2200);
}

// ---------------------------------------------------------------- team + picker
function staminaBar(i) {
  // 耐力（队伍共享，社区说法）：结束时剩余；title 写本角色消耗与被拒次数
  var V = S.view, g = V && V.gauges && V.gauges[i], st = g && g.stamina;
  if (!st) return '';
  var lane = V.timeline.lanes[i], rej = lane && lane.rejected ? lane.rejected.length : 0;
  var t = ['耐力（队伍共享）结束时 ' + fmt(st.value) + ' / ' + st.max, '本角色重击消耗 ' + fmt(st.usedByMember), '回复 ' + V.stamina.regen + '/s，停用 ' + V.stamina.delay + 's 后开始（社区数值）'];
  if (rej) t.push('因耐力不足被拒 ' + rej + ' 次');
  return '<div class="ww-stamina' + (st.pct < 25 ? ' low' : '') + '" style="--p:' + st.pct + '" title="' + esc(t.join('\n')) + '"></div>';
}
function renderTeam() {
  var team = S.config.team, html = '<div class="ww-team">';
  for (var i = 0; i < 3; i++) {
    var m = team[i];
    if (!m) { html += '<button type="button" class="ww-slot empty" data-slot="' + i + '">＋ 选择共鸣者</button>'; continue; }
    var R = charById(m.id), w = weaponById(m.weapon && m.weapon.id), mod = hasModule(m.id) && m.module !== false;
    html += '<button type="button" class="ww-slot' + (i === S.sel ? ' sel' : '') + (mod ? '' : ' no-module') + '" data-slot="' + i + '" data-el="' + R.element + '" title="' + (mod ? '点击更换共鸣者 · 可自动搜索' : '点击更换共鸣者 · 仅手动排轴') + '">' +
      '<span class="role">' + (i + 1) + ' 号位</span><div class="ava">' + gava(m.id, 'md') + '</div><div class="nm">' + esc(R.name) + '</div>' +
      '<div class="meta">Lv' + (m.level || 90) + ' · ' + esc(w ? w.name : '无武器') + (w ? ' R' + ((m.weapon && m.weapon.rank) || 1) : '') + '</div>' +
      '<div class="ww-chain">' + (function (cap) { return [1, 2, 3, 4, 5, 6].map(function (k) { return '<i' + (k <= (m.chain || 0) ? (cap != null && k > cap ? ' class="on unmodeled" title="第 ' + k + ' 链未建模，不计入"' : ' class="on"') : '') + '></i>'; }).join(''); })(chainCap(m)) + '</div>' +
      chainCapTag(m) + staminaBar(i) + '<span class="slot-swap">更换</span></button>';
  }
  $('ww-team').innerHTML = html + '</div>';
  Array.prototype.forEach.call($('ww-team').querySelectorAll('.ww-slot'), function (el) {
    el.onclick = function () {
      var i = +el.getAttribute('data-slot');
      if (!S.config.team[i]) return openPicker(Math.min(i, S.config.team.length));
      S.sel = i; S.echoSel = 0; openPicker(i);
    };
  });
}
function modal(title, body, footer, onMount) {
  var root = $('ww-modal-root');
  root.innerHTML = '<div class="ww-modal-bg"><div class="ww-modal" role="dialog" aria-modal="true"><header><b>' + esc(title) + '</b><span style="margin-left:auto"></span><button class="ww-btn sm" data-close>关闭</button></header>' +
    '<div class="body">' + body + '</div>' + (footer ? '<footer>' + footer + '</footer>' : '') + '</div></div>';
  var bg = root.querySelector('.ww-modal-bg');
  var close = function () { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  var onKey = function (ev) { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.onclick = function (ev) { if (ev.target === bg) close(); };
  root.querySelector('[data-close]').onclick = close;
  if (onMount) onMount(root.querySelector('.ww-modal'), close);
}
function openPicker(slot) {
  var cur = S.config.team[slot], used = S.config.team.map(function (m) { return m.id; });
  var list = S.data.resonators.slice().sort(function (a, b) { return (hasModule(b.id) - hasModule(a.id)) || (b.rarity - a.rarity) || (a.id - b.id); });
  function chips(group, items) {
    return '<div class="ww-filters" data-group="' + group + '" role="group" aria-label="' + esc(group === 'el' ? '属性' : group === 'wt' ? '武器' : '星级') + '">' +
      items.map(function (it, i) { return '<button type="button" data-v="' + esc(it[0]) + '"' + (i === 0 ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(it[1]) + '</button>'; }).join('') + '</div>';
  }
  var body = '<div class="ww-grid2" style="margin-bottom:8px"><label class="ww-field"><span>搜索</span><input type="text" id="ww-pick-q" placeholder="名称 / 属性 / 英文" aria-label="搜索共鸣者"></label>' +
    '<div class="ww-field"><span>说明</span><div style="font-size:12px;color:var(--muted)">带「模块」标记的角色可自动搜索；其余仅手动排轴。共 ' + list.length + ' 名。点槽位直接打开此列表。</div></div></div>' +
    chips('el', [['', '全部属性']].concat(Object.keys(ELZH).filter(function (k) { return k !== 'physical'; }).map(function (k) { return [k, ELZH[k]]; }))) +
    chips('wt', [['', '全部武器'], ['1', '长刃'], ['2', '迅刀'], ['3', '佩枪'], ['4', '臂铠'], ['5', '音感仪']]) +
    chips('rar', [['', '全部星级'], ['5', '5★'], ['4', '4★']]) +
    '<div class="ww-pick">' +
    list.map(function (R) {
      var taken = used.indexOf(R.id) >= 0 && (!cur || cur.id !== R.id);
      return '<button type="button" class="it' + (cur && cur.id === R.id ? ' cur' : '') + '" data-el="' + R.element + '" data-wt="' + R.weaponType + '" data-rar="' + R.rarity + '" data-id="' + R.id + '" data-q="' + esc((R.name + ' ' + (R.nameEn || '') + ' ' + ELZH[R.element] + ' ' + WTYPE[R.weaponType]).toLowerCase()) + '"' + (taken ? ' aria-disabled="true" style="opacity:.4"' : '') + '>' +
        gava(R.id, 'md') + '<div style="min-width:0"><div>' + esc(R.name) + '</div><div style="font-size:10.5px;color:var(--muted)">' +
        '<span class="ww-stars">' + (R.rarity >= 5 ? '★★★★★' : '★★★★') + '</span> ' + WTYPE[R.weaponType] + '</div></div>' +
        (hasModule(R.id) ? '<span class="ww-tag cyan" style="margin-left:auto">模块</span>' : '<span class="ww-tag" style="margin-left:auto">仅手动</span>') + '</button>';
    }).join('') + '</div>';
  var foot = (cur && S.config.team.length > 1 ? '<button class="ww-btn sm" data-remove>移出编队</button>' : '');
  modal('选择共鸣者 · ' + (slot + 1) + ' 号位', body, foot, function (box, close) {
    var q = box.querySelector('#ww-pick-q'), filt = { el: '', wt: '', rar: '' };
    function applyFilter() {
      var v = q.value.trim().toLowerCase();
      Array.prototype.forEach.call(box.querySelectorAll('.ww-pick .it'), function (it) {
        var hide = (v && it.getAttribute('data-q').indexOf(v) < 0) || (filt.el && it.getAttribute('data-el') !== filt.el) ||
          (filt.wt && it.getAttribute('data-wt') !== filt.wt) || (filt.rar && it.getAttribute('data-rar') !== filt.rar);
        it.hidden = hide;
      });
    }
    q.oninput = applyFilter;
    Array.prototype.forEach.call(box.querySelectorAll('.ww-filters'), function (g) {
      Array.prototype.forEach.call(g.querySelectorAll('button'), function (b) {
        b.onclick = function () {
          filt[g.getAttribute('data-group')] = b.getAttribute('data-v');
          Array.prototype.forEach.call(g.querySelectorAll('button'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          applyFilter();
        };
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.ww-pick .it'), function (it) {
      it.onclick = function () {
        if (it.getAttribute('aria-disabled')) return toast('该角色已在编队中');
        var id = +it.getAttribute('data-id');
        if (cur && cur.id === id) return close();
        setMember(slot, defaultMember(id)); close();
      };
      it.onkeydown = function (ev) { if (ev.key === 'Enter') it.onclick(); };
      // v3.3: prefetch the resonator's chunks (record + module + default weapon / echo) on hover / press / focus after an 80 ms intent delay
      // (same as the theme's preset cards, frontend/theme/presets.js PF_DELAY); leaving / blurring cancels; each item at most once; no background preload
      it.onpointerenter = it.onpointerdown = it.onfocus = function () { pfIntentStart(it); };
      it.onpointerleave = it.onblur = function () { pfIntentCancel(it); };
    });
    var rm = box.querySelector('[data-remove]');
    if (rm) rm.onclick = function () { removeMember(slot); close(); };
    setTimeout(function () { q.focus(); }, 0);
  });
}
function remapSequence(fn) {
  var r = S.config.rotation; if (!r || !r.sequence) return;
  r.sequence = E.parseSequence(r.sequence).map(fn).filter(Boolean).join(' ');
}
function setMember(slot, m) {
  var t = S.config.team;
  if (slot >= t.length) t.push(m); else t[slot] = m;
  S.sel = Math.min(slot, t.length - 1); S.echoSel = 0;
  changed(true);
}
function removeMember(slot) {
  var t = S.config.team; if (t.length <= 1) return;
  t.splice(slot, 1);
  remapSequence(function (p) {
    if (p.t === 'S') { if (p.to === slot) return null; return 'S' + (p.to > slot ? p.to : p.to + 1); }
    if (p.m != null) { if (p.m === slot) return null; return (p.m > slot ? p.m : p.m + 1) + p.raw.slice(1); }
    return p.raw;
  });
  var r = S.config.rotation; if (r && r.start != null && r.start >= t.length) r.start = 0;
  ['energy', 'concerto'].forEach(function (k) { var v = S.config.start && S.config.start[k]; if (Array.isArray(v)) v.splice(slot, 1); });
  S.sel = 0; S.echoSel = 0;
  changed(true);
}

// ---------------------------------------------------------------- build editor
function field(label, inner, attrs) { return '<label class="ww-field"' + (attrs || '') + '><span>' + label + '</span>' + inner + '</label>'; }
function numInput(path, v, min, max, step) {
  var id = 'nh-' + String(path).replace(/[^a-zA-Z0-9]+/g, '-');
  return '<span class="numwrap"><input type="number" data-path="' + path + '" value="' + esc(v) + '" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" aria-describedby="' + id + '">' +
    '<span class="numhint" id="' + id + '" hidden>范围 ' + min + '–' + max + '，此值未生效</span></span>';
}
function numBad(el) {
  if (!el || el.type !== 'number') return false;
  if (el.value === '') return true;
  var n = +el.value;
  if (!isFinite(n)) return true;
  if (el.min !== '' && n < +el.min) return true;
  if (el.max !== '' && n > +el.max) return true;
  return false;
}
function paintNum(el) {
  var bad = numBad(el);
  var hint = el.parentNode && el.parentNode.querySelector ? el.parentNode.querySelector('.numhint') : null;
  if (bad) { el.setAttribute('aria-invalid', 'true'); if (hint) hint.hidden = false; }
  else { el.removeAttribute('aria-invalid'); if (hint) hint.hidden = true; }
  return bad;
}
function sel(path, opts, v) { return '<select data-path="' + path + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
function renderBuild() {
  var m = S.config.team[S.sel];
  if (!m) { $('ww-build').innerHTML = '<div class="ww-empty">先在编队中选择共鸣者</div>'; return; }
  var R = charById(m.id), mod = E.getChar(+m.id);
  var ws = S.data.weapons.filter(function (w) { return w.weaponType === R.weaponType; }).sort(function (a, b) { return b.rarity - a.rarity || a.id - b.id; });
  var P = 'team.' + S.sel + '.';
  var sk = m.skillLevels || {};
  var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="ww-tag el" data-el="' + R.element + '"><i class="ww-el"></i>' + ELZH[R.element] + '</span>' +
    '<span class="ww-tag">' + WTYPE[R.weaponType] + '</span>' +
    (mod && m.module !== false ? '<span class="ww-tag cyan" title="' + esc((mod.notes || []).join('\n')) + '">角色模块 v' + esc(mod.version) + ' · 置信度 ' + esc(mod.confidence) + '</span>' :
      '<span class="ww-tag low" data-confidence="low" title="没有角色模块：专属资源与强化动作未建模，自动搜索不可用">无模块 · 仅手动</span>') +
    '<button class="ww-btn sm" id="ww-swap-char" style="margin-left:auto">更换</button></div>';
  html += '<div class="ww-sub">等级与共鸣链</div><div class="ww-grid3">' +
    field('等级', numInput(P + 'level', m.level || 90, 1, 90)) +
    field('共鸣链', sel(P + 'chain', [0, 1, 2, 3, 4, 5, 6].map(function (k) { return [k, k + ' 链']; }), m.chain || 0) + chainCapTag(m)) +
    field('角色模块', sel(P + 'module', mod ? [['on', '启用'], ['off', '停用（仅手动）']] : [['off', '无模块']], mod && m.module !== false ? 'on' : 'off')) + '</div>';
  html += '<div class="ww-sub">技能等级</div><div class="ww-grid4">' + SKILLS.map(function (s) { return field(s[1], numInput(P + 'skillLevels.' + s[0], sk[s[0]] || 10, 1, 10)); }).join('') + '</div>';
  html += '<div class="ww-sub">武器</div><div class="ww-grid3">' +
    field('武器', sel(P + 'weapon.id', ws.map(function (w) { return [w.id, (w.rarity >= 5 ? '★5 ' : w.rarity === 4 ? '★4 ' : '★' + w.rarity + ' ') + w.name]; }), m.weapon && m.weapon.id), ' style="grid-column:span 2"') +
    field('谐振', sel(P + 'weapon.rank', [1, 2, 3, 4, 5].map(function (k) { return [k, 'R' + k]; }), (m.weapon && m.weapon.rank) || 1)) + '</div>';
  var w = weaponById(m.weapon && m.weapon.id);
  if (w && w.passive) html += '<div style="font-size:11.5px;color:var(--muted);margin-top:6px">' + esc(w.passive.name || '') + '：' + esc(((w.passive.descByRank || [])[((m.weapon.rank || 1) - 1)] || '').slice(0, 220)) + '</div>';
  // echoes
  var costs = (m.echoes || []).map(function (e) { return e.cost; });
  var costSum = costs.reduce(function (a, b) { return a + (+b || 0); }, 0);
  html += '<div class="ww-sub">声骸 <span class="ww-tag ' + (costSum > 12 ? 'low' : 'gold') + '">' + costs.join('-') + ' · COST ' + costSum + '/12</span></div><div class="ww-echoes">' +
    (m.echoes || []).map(function (e, i) {
      var main = (MAINS[e.cost] || []).filter(function (x) { return x[0] === e.main; })[0];
      var st = S.data.sonatas.filter(function (s) { return s.id === +e.set; })[0];
      return '<div class="ww-echo" data-echo="' + i + '" role="button" tabindex="0" style="cursor:pointer' + (i === S.echoSel ? ';border-color:var(--gold)' : '') + '"><span class="cost">COST ' + e.cost + '</span>' +
        '<div class="main">' + esc(main ? main[1] : e.main) + '</div><div class="set">' + esc(st ? st.name : '无套装') + '</div>' +
        '<div class="set">' + ((e.subs || []).length) + ' 副词条</div></div>';
    }).join('') + '</div>';
  var e = (m.echoes || [])[S.echoSel];
  if (e) {
    var EP = P + 'echoes.' + S.echoSel + '.';
    html += '<div class="ww-grid3" style="margin-top:10px">' +
      field('COST', sel(EP + 'cost', [[4, '4'], [3, '3'], [1, '1']], e.cost)) +
      field('主词条', sel(EP + 'main', MAINS[e.cost] || [], e.main)) +
      field('套装', sel(EP + 'set', [['', '无']].concat(S.data.sonatas.map(function (s) { return [s.id, s.name]; })), e.set == null ? '' : e.set)) + '</div>';
    if (S.echoSel === 0) {
      var cands = echoesFor(e.cost, e.set);
      html += '<div class="ww-grid2" style="margin-top:8px">' + field('主位声骸（Q 技能）', sel(EP + 'echoId', [['', '无（不施放 Q）']].concat(cands.map(function (x) { return [x.id, x.name]; })), e.echoId || '')) +
        '<div class="ww-field"><span>&nbsp;</span><button class="ww-btn sm" id="ww-set-all">套装应用到全部 5 个</button></div></div>';
    }
    html += '<div class="ww-sub">副词条（档位）</div><div class="ww-subs">' + [0, 1, 2, 3, 4].map(function (k) {
      var s = (e.subs || [])[k] || null, key = s ? subKey(s) : '', t = S.tierByKey[key], ti = s ? tierOf(s) : -1;
      var opts = [['', '—']].concat(S.tiers.map(function (x) { return [x.key, x.zh]; }));
      if (s && !t) opts.push([key, key]);
      var custom = s && ti < 0 && s.value != null ? '<span class="ww-tag low" title="数值不在档位表中，按原值计算">' + esc(s.value) + '</span>' : '';
      return '<div class="ww-sub-row"><div class="nm"><label class="ww-field" style="margin:0"><span class="visually-hidden" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">副词条 ' + (k + 1) + '</span>' + sel(EP + 'subs.' + k + '.stat', opts, key).replace('<select ', '<select aria-label="副词条 ' + (k + 1) + '" ') + '</label></div><div class="ww-tiers">' +
        (t ? t.values.map(function (v, i) { return '<button data-sub="' + k + '" data-tier="' + i + '" class="' + (i === ti ? 'on' : '') + '"' + (t.probabilities ? ' title="出现概率 ' + t.probabilities[i] + '%"' : '') + '>' + tierVal(t, i) + '</button>'; }).join('') : '') + custom + '</div></div>';
    }).join('') + '</div><div style="font-size:11px;color:var(--dim);margin-top:4px">档位来自 substat_tiers.json（官方公示 + 社区核对，早于 3.7.8）；概率不参与伤害计算。</div>';
  }
  $('ww-build').innerHTML = html;
  var root = $('ww-build');
  $('ww-swap-char').onclick = function () { openPicker(S.sel); };
  bindInputs(root);
  Array.prototype.forEach.call(root.querySelectorAll('.ww-echo'), function (el) { el.onclick = function () { S.echoSel = +el.getAttribute('data-echo'); renderBuild(); }; });
  Array.prototype.forEach.call(root.querySelectorAll('.ww-tiers button[data-tier]'), function (b) {
    b.onclick = function () {
      var k = +b.getAttribute('data-sub'), ti = +b.getAttribute('data-tier'), ec = S.config.team[S.sel].echoes[S.echoSel];
      var s = ec.subs[k]; if (!s) return;
      delete s.value; s.tier = ti; changed(false); renderBuild();
    };
  });
  var sa = $('ww-set-all');
  if (sa) sa.onclick = function () { var mm = S.config.team[S.sel]; mm.echoes.forEach(function (x) { x.set = mm.echoes[0].set; }); changed(false); renderBuild(); toast('已将套装应用到全部声骸'); };
}
function setPath(path, raw, el) {
  var parts = path.split('.'), o = S.config;
  if (/\.subs\.\d+\.stat$/.test(path)) {
    var ec = S.config; for (var q = 0; q < parts.length - 3; q++) ec = ec[parts[q]];
    var arr = ec.subs || (ec.subs = []), k2 = +parts[parts.length - 2];
    if (!raw) { if (k2 < arr.length) arr.splice(k2, 1); return; }
    var tt = S.tierByKey[raw], obj = { stat: raw, tier: tt ? Math.min(3, tt.values.length - 1) : 0 };
    if (k2 >= arr.length) arr.push(obj); else arr[k2] = obj;
    return;
  }
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (o[k] == null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    o = o[k];
  }
  var last = parts[parts.length - 1];
  var num = el && (el.type === 'number' || /(\.id|level|rank|chain|cost|set|echoId|duration|resTier|\.start)$/.test(path));
  var v = raw === '' ? null : num && !isNaN(+raw) ? +raw : raw;
  if (el && el.type === 'number') {
    if (paintNum(el)) return;
  }
  // special cases
  if (/\.module$/.test(path)) { if (v === 'off') o.module = false; else delete o.module; return; }
  if (/\.echoes\.\d+\.cost$/.test(path)) { o.cost = v; if (!(MAINS[v] || []).some(function (x) { return x[0] === o.main; })) o.main = MAINS[v][0][0]; if (o.echoId) { var ex = S.data.echoes.filter(function (x) { return x.id === o.echoId; })[0]; if (ex && ex.cost !== v) delete o.echoId; } return; }
  if (last === 'echoId' && v == null) { delete o.echoId; return; }
  if (last === 'set' && v == null) { delete o.set; return; }
  o[last] = v;
}
function bindInputs(root) {
  Array.prototype.forEach.call(root.querySelectorAll('[data-path]'), function (el) {
    if (el.type === 'number') el.oninput = function () { paintNum(el); renderStatus(); };
    el.onchange = function () {
      if (el.type === 'number' && paintNum(el)) { renderStatus(); return; }
      setPath(el.getAttribute('data-path'), el.value, el);
      changed(/\.module$|\.id$/.test(el.getAttribute('data-path')));
    };
  });
}
function changed(structural) {
  save();
  S.dirty = true;
  markStale();
  if (structural) renderTeam();
  renderInputs(true);
  if (invalidCount()) { renderStatus(); return; }
  if (S.auto) schedule(structural ? 50 : 300);
  else renderStatus();
}

// ---------------------------------------------------------------- enemy + settings
function renderEnemy() {
  var en = S.config.enemy || (S.config.enemy = { level: 90, resTier: 0.1, resShred: 0 });
  var tier = en.resTier == null ? 0.1 : en.resTier;
  var shred = en.resShred || 0; if (shred > 1.5) shred = shred / 100;
  $('ww-enemy').innerHTML = '<div class="ww-grid2">' + field('等级', numInput('enemy.level', en.level || 90, 1, 120)) +
    field('防御', '<input type="text" disabled value="' + fmt(792 + 8 * (en.level || 90)) + '（792 + 8·Lv）">') + '</div>' +
    '<div class="ww-sub">抗性</div><div class="ww-res"><div class="ww-seg" id="ww-restier">' + [[0.1, '10%'], [0.4, '40%'], [1, '免疫']].map(function (x) { return '<button data-v="' + x[0] + '" class="' + (Math.abs(tier - x[0]) < 1e-9 ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    field('减抗%', '<span class="numwrap"><input type="number" id="ww-shred" min="0" max="200" step="1" value="' + Math.round(shred * 1000) / 10 + '" aria-describedby="nh-shred"><span class="numhint" id="nh-shred" hidden>范围 0–200，此值未生效</span></span>') +
    '<div class="ww-field"><span>有效抗性</span><div id="ww-effres" style="padding:5px 2px">' + pctTxt(tier - shred) + (tier - shred >= 0.8 ? ' <span class="ww-mech" title="≥80% 段 1/(1+5r)：参考分歧，待验证">待验证</span>' : '') + '</div></div></div>';
  bindInputs($('ww-enemy'));
  Array.prototype.forEach.call($('ww-enemy').querySelectorAll('#ww-restier button'), function (b) { b.onclick = function () { S.config.enemy.resTier = +b.getAttribute('data-v'); changed(false); }; });
  var shredEl = $('ww-shred');
  shredEl.oninput = function () { paintNum(shredEl); renderStatus(); };
  shredEl.onchange = function () { if (paintNum(shredEl)) { renderStatus(); return; } var v = +shredEl.value || 0; S.config.enemy.resShred = Math.round(v * 10) / 1000; changed(false); };
}
function seg(id, opts, cur, cls) { return '<div class="ww-seg' + (cls ? ' ' + cls : '') + '" id="' + id + '">' + opts.map(function (o) { return '<button data-v="' + esc(o[0]) + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
function renderSettings() {
  var c = S.config, rot = c.rotation || (c.rotation = { mode: 'search', sequence: '' });
  var st = c.start || (c.start = { energy: 0, concerto: 0 });
  var enV = Array.isArray(st.energy) ? 'custom' : st.energy === 'full' ? 'full' : (+st.energy || 0) === 0 ? '0' : 'custom';
  var coV = Array.isArray(st.concerto) ? 'custom' : st.concerto === 'full' || +st.concerto === 100 ? 'full' : (+st.concerto || 0) === 0 ? '0' : 'custom';
  var members = c.team.map(function (m, i) { return [i, (i + 1) + ' · ' + charById(m.id).name]; });
  $('ww-settings').innerHTML = '<div class="ww-grid3">' + field('时长（秒）', numInput('duration', c.duration || 25, 5, 120)) +
    field('开场在场', sel('rotation.start', members, rot.start || 0)) +
    field('搜索宽度', numInput('search.beamWidth', (c.search && c.search.beamWidth) || (E.DEFAULT_SEARCH && E.DEFAULT_SEARCH.beamWidth) || 96, 8, 256, 8)) + '</div>' +
    '<div class="ww-sub">排轴</div>' + seg('ww-rotmode', [['manual', '手动序列'], ['search', '自动搜索']], rot.mode || 'search') +
    // v3.5 search.effort：缺省 standard（不写入配置）；deep 由用户手动开启，分享链接只在 deep 时带上
    '<div class="ww-sub">搜索档位</div>' + seg('ww-effort', [['standard', '标准'], ['deep', '深度搜索（耗时明显变长）']], c.search && c.search.effort === 'deep' ? 'deep' : 'standard') +
    '<div class="ww-effort-hint" style="font-size:11px;color:var(--dim);margin-top:4px">深度搜索：预算阶梯 + 更多搜索分支 + 更大的局部改进，结果不低于标准档；耗时约为标准档的 4–8 倍（120 秒的三人队可达数分钟）。只对自动搜索生效。</div>' +
    '<div class="ww-sub">暴击口径</div>' + seg('ww-mode', [['expected', '期望'], ['crit', '暴击'], ['noncrit', '不暴']], c.mode || 'expected') +
    '<div class="ww-sub">切人时机 <span class="ww-mech unsolved" title="' + esc(E.SWAP_RULE ? E.SWAP_RULE.basis : '') + '">引擎假设</span></div>' +
    seg('ww-swaprule', [['cancel', '取消点'], ['full', '等动作结束'], ['swapTime', '9 帧']], c.swapRule || 'cancel') +
    '<div class="ww-sub">开局</div><div class="ww-grid2"><div class="ww-field"><span>共鸣能量</span>' + seg('ww-st-energy', [['0', '空'], ['full', '满']].concat(enV === 'custom' ? [['custom', '自定义']] : []), enV) + '</div>' +
    '<div class="ww-field"><span>协奏能量</span>' + seg('ww-st-concerto', [['0', '空'], ['full', '满']].concat(coV === 'custom' ? [['custom', '自定义']] : []), coV) + '</div></div>' +
    '<div class="ww-sub">电磁效应减半 <span class="ww-mech unsolved" title="' + esc(E.MECH && E.MECH.electroDecay ? E.MECH.electroDecay.basis : '') + '">未定</span></div>' +
    seg('ww-electro', [['off', '不续时（3 跳）'], ['on', '减半续时（4 跳）']], c.electroRefreshOnHalve ? 'on' : 'off') +
    '<div class="ww-sub">窗口末尾动作 <span class="ww-mech unsolved" title="' + esc(E.MECH && E.MECH.endCredit ? E.MECH.endCredit.basis : '') + '">引擎假设</span> </div>' +
    seg('ww-endcredit', [['prorate', '按比例（默认）'], ['full', '全额']], c.endCredit === 'full' ? 'full' : 'prorate') +
    '<div class="ww-sub">解放时停 <span class="ww-mech community" title="' + esc(E.MECH && E.MECH.timeStop ? E.MECH.timeStop.basis : '') + '">社区</span></div>' +
    seg('ww-timestop', [['exclude', '时停不计时'], ['include', '按完整动画']], c.timeStop === 'include' ? 'include' : 'exclude', 'timestop-seg') +
    '<div class="ww-sub">动作时长</div>' + seg('ww-frames', [['on', '社区帧数表'], ['off', '仅默认值']], c.actionFrames === false ? 'off' : 'on') +
    '<div style="font-size:11px;color:var(--dim);margin-top:4px">' + esc(S.data.runtime.framesInfo ? (S.data.runtime.framesInfo.source + ' · ' + S.data.runtime.framesInfo.characters + ' 名角色 · 按 60fps 换算') : '') + '</div>';
  var R = $('ww-settings');
  bindInputs(R);
  function segBind(id, fn) { Array.prototype.forEach.call(R.querySelectorAll('#' + id + ' button'), function (b) { b.onclick = function () { var v = b.getAttribute('data-v'); if (v === 'custom') return; fn(v); changed(false); }; }); }
  segBind('ww-rotmode', function (v) { rot.mode = v; if (v === 'manual' && !rot.sequence && S.view && S.view.seq) rot.sequence = S.view.seq.text; });
  segBind('ww-mode', function (v) { c.mode = v; });
  segBind('ww-effort', function (v) { if (v === 'deep') { c.search = c.search || {}; c.search.effort = 'deep'; } else if (c.search) delete c.search.effort; });
  Array.prototype.forEach.call(R.querySelectorAll('#ww-effort button[data-v="deep"]'), function (b) { b.title = '深度搜索：耗时会明显变长（约为标准档的 4–8 倍）'; });
  segBind('ww-swaprule', function (v) { if (v === 'cancel') delete c.swapRule; else c.swapRule = v; });
  segBind('ww-st-energy', function (v) { st.energy = v === 'full' ? 'full' : 0; });
  segBind('ww-st-concerto', function (v) { st.concerto = v === 'full' ? 100 : 0; });
  segBind('ww-electro', function (v) { if (v === 'on') c.electroRefreshOnHalve = true; else delete c.electroRefreshOnHalve; });
  segBind('ww-endcredit', function (v) { if (v === 'full') c.endCredit = 'full'; else delete c.endCredit; });
  segBind('ww-timestop', function (v) { if (v === 'include') c.timeStop = 'include'; else delete c.timeStop; });
  segBind('ww-frames', function (v) { if (v === 'off') c.actionFrames = false; else delete c.actionFrames; });
}

// ---------------------------------------------------------------- sequence editor
function seqTokens() {
  var rot = S.config.rotation;
  if (rot.mode === 'search') return E.parseSequence(S.view && S.view.seq ? S.view.seq.text : '');
  return E.parseSequence(rot.sequence || '');
}
function activeAfter(tokens) { var a = S.config.rotation.start || 0; tokens.forEach(function (p) { if (p.t === 'S') a = p.to; }); return a; }
function renderSeq() {
  var rot = S.config.rotation, team = S.config.team, toks = seqTokens(), V = S.view;
  var steps = V && V.seq && V.seq.text === toks.map(function (p) { return p.raw; }).join(' ') ? V.seq.steps.filter(function (s) { return !s.auto; }) : null;
  if (steps && steps.length !== toks.length) steps = null;
  var active = rot.start || 0, html = '';
  if (rot.mode === 'search') html += '<div style="font-size:11.5px;color:var(--dim);margin-bottom:6px">自动搜索得到的序列；编辑任一步会切换到手动模式。</div>';
  html += '<div class="ww-seq" id="ww-seq-list">';
  if (!toks.length) html += '<span class="ww-seq-sep">点击下方按钮添加动作</span>';
  toks.forEach(function (p, i) {
    var st = steps ? steps[i] : null;
    var mi = p.t === 'S' ? p.to : p.m != null ? p.m : active;
    if (p.t === 'S' && (!st || !st.invalid)) active = p.to;
    var m = team[mi], R = m && charById(m.id);
    var label = p.t === 'S' ? '切人 → ' + (R ? R.name : '?') : p.t === 'W' ? '等待 ' + p.w + 's' : st && st.actLabel ? st.actLabel : (E.ACTION_ZH[p.t] || p.raw);
    var cls = 'ww-step' + (st && st.invalid ? ' invalid' : '') + (st && st.noStamina ? ' no-stamina' : '') + (st && st.est && st.dur !== 'config' ? ' est' : '');
    var title = [p.raw];
    if (st && st.invalid) title.push('非法：' + st.reason);
    if (st && st.dur) title.push('时长：' + (st.dur === 'frames' ? '社区帧数表' : st.dur === 'config' ? '用户设定' : '默认值') + (st.durReason ? '（' + st.durReason + '）' : ''));
    html += '<span class="' + cls + '" draggable="true" data-i="' + i + '"' + (R ? ' data-el="' + R.element + '"' : '') + (st && st.dur ? ' data-dur="' + st.dur + '"' : '') + ' title="' + esc(title.join('\n')) + '">' +
      '<span class="k">' + esc(R ? R.name.slice(0, 2) : '?') + '</span>' + esc(label) + '<button class="del" title="删除" aria-label="删除">×</button></span>';
  });
  html += '</div>';
  var bad = steps ? steps.map(function (s, i) { return s.invalid ? '第 ' + (i + 1) + ' 步「' + s.token + '」：' + s.reason : null; }).filter(Boolean) : [];
  if (bad.length) html += '<div class="ww-err">' + esc('非法动作已跳过：\n' + bad.join('\n')) + '</div>';
  html += '<div class="ww-palette">';
  team.forEach(function (m, i) {
    var R = charById(m.id);
    ['A', 'H', 'E', 'R', 'Q'].forEach(function (c) { html += '<button data-el="' + R.element + '" data-add="' + i + ':' + c + '">' + esc(R.name) + ' · ' + E.ACTION_ZH[c] + '</button>'; });
  });
  html += '<button data-add="w">等待 1s</button><button data-clear>清空</button></div>';
  $('ww-seq').innerHTML = html;
  var list = $('ww-seq-list');
  function editTokens(fn) {
    var arr = toks.map(function (p) { return p.raw; });
    fn(arr);
    rot.mode = 'manual'; rot.sequence = arr.join(' ');
    changed(false);
  }
  Array.prototype.forEach.call(list.querySelectorAll('.ww-step .del'), function (b) {
    b.onclick = function (ev) { ev.stopPropagation(); var i = +b.parentNode.getAttribute('data-i'); editTokens(function (a) { a.splice(i, 1); }); };
  });
  Array.prototype.forEach.call($('ww-seq').querySelectorAll('[data-add]'), function (b) {
    b.onclick = function () {
      var v = b.getAttribute('data-add');
      editTokens(function (a) {
        if (v === 'w') { a.push('W1'); return; }
        var mi = +v.split(':')[0], c = v.split(':')[1];
        if (activeAfter(E.parseSequence(a.join(' '))) !== mi) a.push('S' + (mi + 1));
        a.push(c);
      });
    };
  });
  var clr = $('ww-seq').querySelector('[data-clear]');
  clr.onclick = function () { editTokens(function (a) { a.length = 0; }); };
  // native drag & drop reorder
  var dragI = null;
  Array.prototype.forEach.call(list.querySelectorAll('.ww-step'), function (el) {
    el.addEventListener('dragstart', function (ev) { dragI = +el.getAttribute('data-i'); el.classList.add('dragging'); try { ev.dataTransfer.setData('text/plain', String(dragI)); ev.dataTransfer.effectAllowed = 'move'; } catch (e) {} });
    el.addEventListener('dragend', function () { el.classList.remove('dragging'); Array.prototype.forEach.call(list.querySelectorAll('.drop-before'), function (x) { x.classList.remove('drop-before'); }); });
    el.addEventListener('dragover', function (ev) { ev.preventDefault(); Array.prototype.forEach.call(list.querySelectorAll('.drop-before'), function (x) { x.classList.remove('drop-before'); }); el.classList.add('drop-before'); });
    el.addEventListener('drop', function (ev) {
      ev.preventDefault(); var to = +el.getAttribute('data-i'); var from = dragI != null ? dragI : +ev.dataTransfer.getData('text/plain');
      if (from === to || isNaN(from)) return;
      editTokens(function (a) { var x = a.splice(from, 1)[0]; a.splice(from < to ? to - 1 : to, 0, x); });
    });
  });
  list.addEventListener('dragover', function (ev) { ev.preventDefault(); });
  list.addEventListener('drop', function (ev) {
    if (ev.target !== list) return; ev.preventDefault();
    var from = dragI; if (from == null) return;
    editTokens(function (a) { var x = a.splice(from, 1)[0]; a.push(x); });
  });
}

// ---------------------------------------------------------------- results
// 角色头像占位 .gava（由主题头像脚本填充；avatar 为 null 时不写 data-icon → 徽章）
// skill icon placeholder (frontend theme fills it): <span class="gskill" data-icon data-kind data-name>; only for actions with a skillId
var SKILL_KIND = { 1: 'basic', 2: 'skill', 3: 'ult', 5: 'intro', 6: 'forte', 11: 'outro', 12: 'tune' };
function skillOf(charId, skillId) {
  var R = S.chars && S.chars[charId]; if (!R || !R.skills || skillId == null) return null;
  for (var i = 0; i < R.skills.length; i++) if (R.skills[i].id === skillId) return R.skills[i];
  return null;
}
function gskill(charId, skillId) {
  var k = skillOf(charId, skillId); if (!k) return '';
  return '<span class="gskill"' + (k.skillIcon ? ' data-icon="' + esc(k.skillIcon) + '"' : '') + ' data-kind="' + (SKILL_KIND[k.type] || 'passive') + '" data-name="' + esc(k.name || '') + '"></span>';
}
function gava(id, size) {
  var R = (S.chars && S.chars[id]) || {};
  return '<span class="gava ' + (size || 'md') + '"' + (R.avatar ? ' data-icon="' + esc(R.avatar) + '"' : '') + ' data-el="' + esc(R.element || '') + '" data-name="' + esc(R.name || String(id || '')) + '"></span>';
}
// 时停（cfg.timeStop，默认 exclude）：summary.timeStopSaved = 被扣除的时停秒数（include 时为 0）
function timeStopTag(sm) {
  var x = +(sm && sm.timeStopSaved) || 0, inc = S.config && S.config.timeStop === 'include';
  // summary.tailFreeze {pct, sec, idx}: 窗口末尾起手的时停大招（冻结期间伤害全额计入）→ .ww-tag.tail-freeze（COMPONENTS.md）
  var tf = sm && sm.tailFreeze, tail = tf ? '<span class="ww-tag tail-freeze" title="' + esc('窗口最后 ' + (+tf.sec).toFixed(2) + ' 秒起手的时停大招按冻结时间全额计入，占总伤 ' + (+tf.pct).toFixed(1) + '%') + '">尾段时停 ' + (+tf.pct).toFixed(1) + '%</span>' : '';
  return '<div class="ww-sub"><span class="ww-tag timestop' + (x > 0 ? '' : ' zero') + '" title="' + esc(inc ? '按完整动画计时：时停帧计入战斗时间' : '时停帧不占战斗时间：本轮共扣除 ' + x.toFixed(2) + ' 秒（计时冻结，增益/冷却同样冻结）') + '">时停 +' + x.toFixed(2) + ' 秒</span>' + tail + '</div>';
}
function renderSummary() {
  var V = S.view;
  if (S.error) { $('ww-summary').innerHTML = '<div class="ww-err">' + esc('模拟失败：' + S.error) + '</div>'; return; }
  if (!V) { $('ww-summary').innerHTML = '<div class="ww-cards"><div class="ww-card hero"><div class="k">总伤害</div><div class="v">—</div><div class="s">' + (S.running ? '计算中…' : '尚未运行') + '</div></div></div>'; return; }
  $('ww-summary').innerHTML = '<div class="ww-cards">' + V.summary.cards.map(function (c) {
    return '<div class="ww-card' + (c.hero ? ' hero' : '') + '"><div class="k">' + esc(c.k) + '</div><div class="v">' + fmt(c.v) + '</div>' + (c.s ? '<div class="s">' + esc(c.s) + (c.hero && S.ms != null ? ' · 用时 ' + S.ms + ' ms' : '') + '</div>' : '') + '</div>';
  }).join('') + '</div>' + timeStopTag(V.summary) + (V.summary.runMode ? '<div class="ww-sub"><span class="ww-tag mode ' + esc(V.summary.runMode.kind) + '" title="' + esc(V.summary.runMode.reason + (V.summary.runMode.residual != null ? '\n残值估值 ' + fmt(V.summary.runMode.residual) + '（仅用于搜索排序，不计入总伤害）' : '')) + '">' + esc(V.summary.runMode.label) + '</span></div>' : '');
}
function renderGauges() {
  var V = S.view; if (!V) { $('ww-gauges').innerHTML = '<div class="ww-empty">—</div>'; return; }
  var html = '<div class="ww-gauges">' + V.gauges.map(function (g) {
    return '<div class="ww-gauge" style="--p:' + g.energyPct + ';--c:var(--' + g.el + ')" title="共鸣能量 ' + g.energy + ' / ' + g.energyMax + '"><div class="ring" data-val="' + Math.round(g.energyPct) + '%"></div><div class="lbl">' + esc(g.name) + '<br>共鸣能量</div></div>' +
      '<div class="ww-gauge concerto" style="--p:' + g.concertoPct + '" title="协奏能量 ' + g.concerto + ' / 100"><div class="ring" data-val="' + Math.round(g.concerto) + '"></div><div class="lbl">' + esc(g.name) + '<br>协奏能量</div></div>';
  }).join('') + '</div>';
  if (V.resources && V.resources.length) {
    html += '<div class="ww-sub">角色资源（结束时）</div>' + V.resources.map(function (r) {
      var low = r.confidence === 'low';
      var bar = r.segmented ? '<div class="ww-res-bar" data-el="' + r.el + '">' + r.cells.map(function (on) { return '<i' + (on ? ' class="on"' : '') + '></i>'; }).join('') + '<span></span></div>'
        : '<div class="ww-res-bar cont" data-el="' + r.el + '" style="--p:' + r.pct + '"></div>';
      return '<div class="ww-res-meter" data-el="' + r.el + '"' + (low ? ' data-confidence="low" title="获取量为推断值"' : '') + '><span>' + esc(r.name + ' · ' + r.label) + '</span>' + bar + '<span>' + fmt(r.value, r.segmented ? 0 : 1) + ' / ' + r.max + '</span></div>';
    }).join('');
  }
  $('ww-gauges').innerHTML = html;
}
function actTitle(a) {
  var t = [a.label, a.t.toFixed(2) + 's – ' + a.endT.toFixed(2) + 's', '伤害 ' + fmt(a.damage)];
  if (a.coord) t.push('协同伤害（不占动作时间）' + (a.offfield ? '·后台触发（不在场）' : ''));
  if (a.forced) t.push('强制延奏' + (a.forceReason ? '（' + a.forceReason + '）' : ''));
  if (a.staminaCost) t.push('耐力 −' + fmt(a.staminaCost));
  if (a.dur === 'frames') t.push('时长：社区帧数表' + (a.frameLabel ? '「' + a.frameLabel + '」' : '') + (a.durSrcTag ? ' · 来源 ' + a.durSrcTag + (a.durSrcZh ? '（' + a.durSrcZh + '）' : '') : '') + (a.frameLow ? ' · 低置信：' + a.frameLow : ''));
  else if (a.dur === 'config') t.push('时长：用户设定');
  else if (a.dur === 'default') t.push('时长回退：' + (a.durReason || '默认值'));
  if (a.swapCut) t.push('提前切人（' + a.swapCut.rule + '）：' + a.swapCut.from.toFixed(2) + 's → ' + a.swapCut.at.toFixed(2) + 's');
  if (a.inferred) t.push('推断：' + a.inferred);
  if (a.truncated) t.push('越过时长结束：计入 ' + (a.credit * 100).toFixed(1) + '%' + (a.credit >= 1 ? '（全额模式）' : '（按窗口内比例）'));
  if (a.timeStop) t.push('含时停 ' + a.timeStop.toFixed(2) + 's' + (S.config && S.config.timeStop === 'include' ? '（按完整动画计时）' : '（不占战斗时间，计时冻结）'));
  if (a.low) t.push('含低置信命中');
  return t.join('\n');
}
function renderTimeline() {
  var V = S.view; if (!V) { $('ww-timeline').innerHTML = '<div class="ww-empty">—</div>'; return; }
  var T = V.timeline, ticks = T.ruler.filter(function (t) { return t < T.duration - 1e-9; });
  var html = '<div class="ww-tl"><div class="ruler">' + ticks.map(function (t) { return '<span>' + t + 's</span>'; }).join('') + '</div>';
  var WE = T.windowEnd || { leftPct: 100, t: T.duration, endCredit: 'prorate' };
  var fidx = {};   // "li:ai" → detail.timeline index
  flatActs(V).forEach(function (f, i) { fidx[f.li + ':' + f.ai] = i; });
  T.lanes.forEach(function (l, li) {
    html += '<div class="ww-lane" data-el="' + l.el + '"><div class="who">' + gava(l.id != null ? l.id : ((S.config.team[l.member] || {}).id), 'sm') + esc(l.name) + '</div><div class="track">' +
      (l.carry ? '<i class="ww-carry" title="' + esc(l.carry.title) + '"></i>' : '') +
      (li === 0 ? '<i class="ww-window-end" style="left:' + WE.leftPct + '%" title="' + esc('时长结束 ' + WE.t + 's · 越过此处的动作' + (WE.endCredit === 'full' ? '全额计入' : '按窗口内比例计入')) + '"></i>' : '') +
      '<div class="onfield" title="在场区间">' + (l.onfield || []).map(function (s) { return '<i style="left:' + s.leftPct + '%;width:' + s.widthPct + '%" title="在场 ' + s.t.toFixed(2) + 's – ' + s.endT.toFixed(2) + 's"></i>'; }).join('') + '</div>' +
      (l.rejected || []).map(function (r) { return '<div class="ww-act H no-stamina" style="left:' + r.leftPct + '%;width:0.6%" title="' + esc(r.token + ' 被拒 @' + r.t.toFixed(2) + 's：' + r.reason) + '"></div>'; }).join('') +
      l.actions.map(function (a, ai) {
        var cls = 'ww-act ' + a.cls + (a.offfield ? ' offfield' : '') + (a.est && a.dur !== 'config' ? ' est' : '');
        var name = (a.cls === 'O' || a.coord) ? '' : (a.label || '');
        return '<div class="' + cls + '" data-act="' + l.member + ':' + ai + '" data-act-index="' + fidx[li + ':' + ai] + '" data-lane="' + l.member + '" tabindex="0"' + (a.dur ? ' data-dur="' + a.dur + '"' : '') + (a.low ? ' data-confidence="low"' : '') + (a.truncated ? ' data-truncated="1" data-credit="' + a.credit + '"' : '') + (a.tailFreeze ? ' data-tail-freeze="1"' : '') + ' style="left:' + a.leftPct + '%;width:' + a.widthPct + '%' + (a.coord ? ';top:20px;height:6px;font-size:0' : '') + '" title="' + esc(actTitle(a)) + '" aria-label="' + esc(name || a.label || a.cls) + '">' + gskill(l.id != null ? l.id : (V.ids || [])[li], a.skillId) + (name ? '<span class="act-name">' + esc(name) + '</span>' : '') + '</div>' +
          (a.freeze ? '<i class="ww-freeze" style="left:' + a.freeze.leftPct + '%' + (a.freeze.widthPct ? ';width:' + a.freeze.widthPct + '%' : '') + '" title="' + esc('时停 ' + a.freeze.sec.toFixed(2) + ' 秒' + (a.freeze.excluded ? '（不计战斗时间）' : a.freeze.basis === 'not-liberation' ? '（非耗能解放，按完整动画计时）' : '（按完整动画计时）')) + '"></i>' : '');
      }).join('') +
      T.swaps.map(function (s) { return '<div class="ww-swap" style="left:' + s.leftPct + '%"></div>'; }).join('') +
      (l.buffbars.length ? '<div class="ww-buffbar' + (l.buffbars.length > 1 ? ' stacked' : '') + '" style="--c:var(--' + l.el + ')" title="受到的增益覆盖">' + l.buffbars.slice(0, 6).map(function (b) { return b.segments.map(function (s) { return '<i style="left:' + s.leftPct + '%;width:' + s.widthPct + '%"></i>'; }).join('') + (b.residual || []).map(function (s) { return '<i class="residual" title="' + esc('窗口结束后仍剩 ' + (s.endT - s.t).toFixed(1) + ' 秒，不计入伤害（' + b.id + '）') + '"></i>'; }).join(''); }).join('') + '</div>' : '') +
      '</div></div>';
  });
  (T.status || []).forEach(function (st) {
    var tt = st.zh + '（' + (st.el ? ELZH[st.el] || st.el : '') + '）· 上限 ' + (st.cap || '-') + ' 层 · 合计 ' + fmt(st.damage) + '\n时序/乘区为社区说法（低置信）';
    html += '<div class="ww-lane status" data-el="' + (st.el || '') + '" data-confidence="' + (st.confidence === 'low' ? 'low' : 'medium') + '"><div class="who" title="' + esc(tt) + '"><i class="ww-el"></i>' + esc(st.zh) + '</div><div class="track" title="' + esc(tt) + '">' +
      st.segments.map(function (g) { return '<div class="ww-status" data-stk="' + g.stacks + '" style="left:' + g.leftPct + '%;width:' + g.widthPct + '%" title="' + esc(g.stacks + ' 层 · ' + g.t.toFixed(2) + 's – ' + g.endT.toFixed(2) + 's') + '"></div>'; }).join('') +
      st.ticks.map(function (k) { return '<div class="ww-tick" style="left:' + k.leftPct + '%" title="' + esc((k.kind === 'settle' ? '结算' : '跳伤') + ' @' + k.t.toFixed(2) + 's · ' + k.stacks + ' 层 · ' + fmt(k.damage)) + '"></div>'; }).join('') +
      st.bursts.map(function (k) { return '<div class="ww-tick burst" style="left:' + k.leftPct + '%" title="' + esc('引爆 @' + k.t.toFixed(2) + 's · ' + k.stacks + ' 层 · ' + fmt(k.damage)) + '"></div>'; }).join('') +
      '</div></div>';
  });
  var g0 = V.gauges && V.gauges[0] && V.gauges[0].stamina;
  if (g0 && g0.path && g0.series.length > 1) {
    var sp = g0.path.split(/(?=[ML])/), sfx = sp[0].slice(1).split(' ')[0], slx = sp[sp.length - 1].slice(1).split(' ')[0];
    html += '<div class="ww-lane res stamina"><div class="who">耐力</div><div class="track" title="' + esc('耐力（队伍共享，0–' + g0.max + '）') + '"><div class="res-axis" aria-hidden="true"><span>' + esc(String(g0.max)) + '</span><span>0</span></div><svg viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="' + esc('耐力曲线，0 到 ' + g0.max) + '"><path class="area" d="' + g0.path + ' L' + slx + ' 10 L' + sfx + ' 10 Z"></path><path d="' + g0.path + '"></path></svg></div></div>';
  }
  (V.resources || []).forEach(function (r) {
    if (!r.path) return;
    var pts = r.path.split(/(?=[ML])/), first = pts[0], last = pts[pts.length - 1];
    var fx = first.slice(1).split(' ')[0], lx = last.slice(1).split(' ')[0];
    html += '<div class="ww-lane res" data-el="' + r.el + '"' + (r.confidence === 'low' ? ' data-confidence="low"' : '') + '><div class="who">' + esc(r.name.slice(0, 2) + '·' + r.label) + '</div><div class="track" title="' + esc(r.label + '（0–' + r.max + '）') + '">' +
      '<div class="res-axis" aria-hidden="true"><span>' + esc(String(r.max)) + '</span><span>0</span></div>' +
      '<svg viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="' + esc(r.label + '曲线，0 到 ' + r.max) + '"><path class="area" d="' + r.path + ' L' + lx + ' 10 L' + fx + ' 10 Z"></path><path d="' + r.path + '"></path></svg></div></div>';
  });
  html += '</div><div class="ww-tl-legend"><span>◆ 变奏入场</span><span>▶ 延奏离场</span><span>发光块 = 共鸣解放</span><span>金色块 = 声骸技能</span><span>~ 社区帧数时长</span><span>≈ 默认时长</span><span>虚线块 = 后台协同</span><span>底色 = 在场区间</span>' + ((T.status || []).length ? '<span>竖线 = 异常效应结算 · 白线 = 引爆</span>' : '') + '</div>';
  $('ww-timeline').innerHTML = html;
}
function renderBuffs() {
  var V = S.view; if (!V) { $('ww-buffs').innerHTML = '<div class="ww-empty">—</div>'; return; }
  var ov = S.config.buffOverrides || {};
  var list = V.buffs.slice().sort(function (a, b) { return (a.off - b.off) || (b.uptimePct - a.uptimePct); });
  $('ww-buffs').innerHTML = '<div style="font-size:11.5px;color:var(--dim);margin-bottom:6px">点击条目切换：自动 → 常开 → 关闭。</div><div class="ww-buffs">' + list.map(function (b) {
    var cls = 'ww-buff' + (b.off ? ' off' : '') + (b.autoOff ? ' auto-off' : '');
    var mode = ov[b.id] ? { on: '常开', off: '关闭', auto: '自动' }[ov[b.id]] : null;
    var t = [b.text || b.name, b.basis ? '依据：' + b.basis : '', b.lowReason ? '低置信：' + b.lowReason : '', b.patchedBy ? '模块修正：' + b.patchedBy : '', mode ? '手动设定：' + mode : ''].filter(Boolean).join('\n');
    return '<div class="' + cls + '" data-el="' + b.el + '" data-buff="' + esc(b.id) + '" role="button" tabindex="0" style="cursor:pointer"' + (b.confidence === 'low' ? ' data-confidence="low"' : '') + ' title="' + esc(t) + '">' +
      '<div class="nm"><i class="ww-el"></i>' + esc(b.name) + (mode ? ' <span class="ww-tag gold">' + mode + '</span>' : '') + '</div><div class="src">' + esc(b.src) + '</div><div class="stk">×' + (b.stacks || 1) + '</div>' +
      '<div class="cov"><div class="ww-bar"><i style="width:' + b.uptimePct + '%"></i></div>' + b.uptimePct + '%</div></div>';
  }).join('') + '</div>';
  Array.prototype.forEach.call($('ww-buffs').querySelectorAll('[data-buff]'), function (el) {
    el.onclick = function () {
      var id = el.getAttribute('data-buff'), o = S.config.buffOverrides || (S.config.buffOverrides = {});
      var cur = o[id] || 'auto', nx = { auto: 'on', on: 'off', off: 'auto' }[cur];
      if (nx === 'auto') delete o[id]; else o[id] = nx;
      changed(false);
    };
  });
}
function renderSearch() {
  var V = S.view, html = '';
  var searchable = V ? V.searchable : S.config.team.every(function (m) { return hasModule(m.id) && m.module !== false; });
  var reason = V && V.searchDisabled ? V.searchDisabled.reason : '编队中有角色没有角色模块，自动搜索不可用（可手动排轴）';
  var inner = '';
  var ls = S.lastSearch && S.lastSearch.key === searchKey() ? S.lastSearch.search : null;
  if (ls && searchable) {
    var curSeq = S.view ? S.view.seq.text : null;
    inner += '<div style="font-size:11.5px;color:var(--dim);margin-bottom:6px">展开 ' + fmt(ls.expanded) + ' 个状态 · ' + fmt(ls.ms) + ' ms · beam ' + ls.budget.beamWidth + (ls.budgetUsed && ls.budgetUsed.effort === 'deep' ? ' · 深度搜索' : '') + (ls.truncated ? ' · 已达展开上限' : '') + '。点击候选套用为手动序列。</div>';
    inner += '<div class="ww-cands"><div class="hd"><span>#</span><span>方案</span><span>DPS</span><span class="total">总伤</span><span>差距</span></div>' + ls.candidates.map(function (c) {
      return '<div class="ww-cand' + (c.best ? ' best' : '') + (c.sequence === curSeq ? ' cur' : '') + '" data-seq="' + esc(c.sequence) + '" role="button" tabindex="0"><div class="rk">' + c.rank + '</div><div class="desc"><div class="t">' + esc(c.title) + '</div><div class="s" title="' + esc(c.sequence) + '">' + esc(c.sequence) + '</div></div>' +
        '<div class="num">' + fmt(c.dps) + '</div><div class="num total">' + fmt(c.total) + '</div><div class="gap">' + (c.best ? '最优' : c.gapPct + '%') + '</div></div>';
    }).join('') + '</div>';
  } else inner += '<div class="ww-empty">' + (S.running && S.config.rotation.mode === 'search' ? '搜索中…' : '尚无搜索结果') + '</div>';
  inner += '<div style="margin-top:10px;display:flex;gap:8px"><button class="ww-btn sm" id="ww-do-search">运行自动搜索</button></div>';
  if (!searchable) html = '<div class="ww-disabled-note">' + esc(reason) + '</div><div class="ww-disabled" aria-disabled="true">' + inner + '</div>';
  else html = inner;
  $('ww-search').innerHTML = html;
  var b = $('ww-do-search'); if (b) b.onclick = function () { S.config.rotation.mode = 'search'; changed(false); };
  Array.prototype.forEach.call($('ww-search').querySelectorAll('.ww-cand'), function (el) {
    el.onclick = function () { S.config.rotation = Object.assign({}, S.config.rotation, { mode: 'manual', sequence: el.getAttribute('data-seq') }); changed(false); toast('已套用候选序列'); };
  });
}
function cmpState() { return window.__gcmp && window.__gcmp.state; }
function deltaHtml(cur, prev) {
  if (prev == null || cur == null || !isFinite(cur) || !isFinite(prev)) return '';
  var d = cur - prev;
  if (Math.abs(d) < 0.5) return '<span class="ww-delta">±0</span>';
  var p = prev ? d / prev * 100 : 0;
  var sign = d > 0 ? '+' : '−';
  return '<span class="ww-delta ' + (d > 0 ? 'up' : 'down') + '">' + sign + fmt(Math.abs(d)) + (prev ? ' · ' + sign + Math.abs(p).toFixed(1) + '%' : '') + '</span>';
}
function cumChart(V) {
  var acts = flatActs(V), pts = [{ t: 0, v: 0 }], sum = 0, i, a, dmg;
  for (i = 0; i < acts.length; i++) {
    a = V.timeline.lanes[acts[i].li].actions[acts[i].ai];
    dmg = a && a.damage || 0;
    if (!(dmg > 0)) continue;
    sum += dmg;
    pts.push({ t: a.t || 0, v: sum });
  }
  if (pts.length < 2) return '';
  var gst = cmpState(), aCurve = gst && gst.on && gst.A && gst.A.curve, aTotal = gst && gst.on && gst.A && gst.A.summary ? +gst.A.summary.total : null;
  var T = V.timeline.duration || pts[pts.length - 1].t || 1, ymax = pts[pts.length - 1].v || 1;
  if (aCurve) aCurve.forEach(function (p) { if (p.av > T) T = p.av; if (p.v > ymax) ymax = p.v; });
  var W = 640, H = 160, L = 46, R = 8, TP = 10, B = 22, pw = W - L - R, ph = H - TP - B;
  var step = Math.pow(10, Math.floor(Math.log(ymax / 4) / Math.LN10));
  if (ymax / step > 6) step *= 2; if (ymax / step > 6) step *= 2.5;
  if (!(step > 0)) step = ymax;
  ymax = Math.ceil(ymax / step) * step || 1;
  function X(t) { return L + pw * Math.max(0, Math.min(T, t)) / (T || 1); }
  function Y(v) { return TP + ph * (1 - v / ymax); }
  var d = '';
  pts.forEach(function (p, n) { d += (n ? 'L' : 'M') + X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); });
  var ad = '';
  if (aCurve && aCurve.length) aCurve.forEach(function (p, n) { ad += (n ? 'L' : 'M') + X(p.av).toFixed(1) + ',' + Y(p.v).toFixed(1); });
  var ticks = '', v;
  for (v = 0; v <= ymax + 1e-6; v += step) ticks += '<line class="' + (v ? 'grid' : 'ax') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"></line><text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end">' + (v ? fmt(v) : '0') + '</text>';
  var cap = '累计伤害 · 横轴为游戏时间（秒）';
  if (aTotal != null && V.summary && V.summary.total != null) cap += ' · 相对 A ' + (V.summary.total - aTotal >= 0 ? '+' : '−') + fmt(Math.abs(V.summary.total - aTotal));
  return '<div class="ww-cum"><div class="cap">' + esc(cap) + (ad ? ' · <span style="color:#f1d9a0">虚线 = A</span>' : '') + '</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cap) + '">' + ticks +
    '<path d="' + d + '" fill="none" stroke="#7fd6dc" stroke-width="1.6" stroke-linejoin="round"></path>' +
    (ad ? '<path d="' + ad + '" fill="none" stroke="#f1d9a0" stroke-width="1.6" stroke-dasharray="6 4" stroke-linejoin="round"></path>' : '') +
    '<text x="' + (L) + '" y="' + (H - 6) + '">0s</text><text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(String(Math.round(T))) + 's</text></svg></div>';
}
function renderShare() {
  var V = S.view; if (!V) { $('ww-share').innerHTML = '<div class="ww-empty">—</div>'; return; }
  var gst = cmpState(), aBy = {};
  if (gst && gst.on && gst.A) (gst.A.members || []).forEach(function (m) { if (m.id != null) aBy[m.id] = m; });
  $('ww-share').innerHTML = cumChart(V) + '<div class="ww-bars">' + V.share.byMember.map(function (m) {
    var id = (V.ids || [])[m.member];
    var prev = aBy[id];
    return '<div class="row" data-el="' + m.el + '"><div class="nm"><i class="ww-el"></i>' + esc(m.name) + '</div><div class="ww-bar"><i style="width:' + m.pct + '%"></i></div><div class="num">' + fmt(m.damage) + ' · ' + m.pct + '%' + (prev ? deltaHtml(m.damage, prev.damage) : '') + '</div></div>';
  }).join('') + '</div><div class="ww-sub">按伤害类型</div><div class="ww-stack">' + V.share.byType.map(function (t) { return '<i style="width:' + t.pct + '%;background:' + t.color + '" title="' + esc(t.zh + ' ' + t.pct + '%') + '"></i>'; }).join('') + '</div>' +
    '<div class="ww-legend">' + V.share.byType.map(function (t) { return t.status ? '<span class="ww-tag status" style="--el:' + t.color + '" title="异常效应伤害（不暴击，乘区为社区说法）"><i style="--c:' + t.color + '"></i>' + esc(t.zh) + ' ' + t.pct + '%</span>' : '<span><i style="--c:' + t.color + '"></i>' + esc(t.zh) + ' ' + t.pct + '%</span>'; }).join('') + '</div>';
}
function zoneHtml(z) {
  return '<span class="z' + (z.key === 'resistance' && z.neg ? ' neg' : '') + '" data-mech="' + esc(z.mech) + '" title="' + esc((MECH_ZH[z.mech] || z.mech) + '（' + z.confidence + '）\n' + z.basis) + '"><b>' + esc(z.name) + '</b>' + esc(z.key === 'base' ? fmt(z.value, 1) : z.key === 'multiplier' ? fmt(z.value * 100, 2) + '%' : z.display) + '</span>';
}
function renderBreakdown() {
  var V = S.view; if (!V || !V.breakdown.representative) { $('ww-breakdown').innerHTML = '<div class="ww-empty">—</div>'; return; }
  var B = V.breakdown, r = B.representative, mem = V.team[r.member];
  var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">代表命中（全程最大单次）：' + esc(mem.name + ' · ' + r.action + ' / ' + r.hit) + ' @' + r.t.toFixed(2) + 's = <b>' + fmt(r.value) + '</b> · 有效抗性 ' + pctTxt(B.effectiveRes) + '</div>';
  html += '<div class="ww-mult">' + r.zones.map(zoneHtml).join('<span class="x">×</span>') + '</div>';
  html += '<div class="ww-mech-legend"><span class="table">表格推导</span><span class="corroborated">社区印证</span><span class="community">待验证</span><span class="unsolved">估计</span></div>';
  html += '<div style="max-height:360px;overflow:auto;margin-top:12px"><table class="ww-tbl"><thead><tr><th>角色</th><th>动作 / 命中</th><th>类型</th><th class="num">次数</th><th class="num">伤害</th><th class="num">占比</th></tr></thead><tbody>' +
    B.rows.slice(0, 60).map(function (x, i) {
      var low = x.confidence === 'low';
      return '<tr data-hit="' + i + '" tabindex="0"' + (x.status ? ' class="status"' : '') + (x.truncated ? ' data-truncated="1" data-credit="' + x.credit + '"' : '') + (low ? ' data-confidence="low" title="' + esc((x.lowReason || '低置信') + (x.truncated ? '\n越过时长结束：计入 ' + (x.credit * 100).toFixed(1) + '%' : '')) + '"' : x.truncated ? ' title="' + esc('越过时长结束：计入 ' + (x.credit * 100).toFixed(1) + '%') + '"' : '') + '><td><span class="ww-tag el" data-el="' + x.el + '"><i class="ww-el"></i>' + esc(x.name) + '</span></td><td>' + gskill((V.ids || [])[x.member], x.skillId) + esc(x.action) + ' / ' + esc(x.hit) + (low ? ' <span class="ww-tag low">低置信</span>' : '') + '</td><td>' + (x.status ? '<span class="ww-tag status" data-el="' + x.el + '">' + esc(x.typeZh) + '</span>' : esc(x.typeZh)) + '</td><td class="num">' + x.count + '</td><td class="num">' + fmt(x.damage) + '</td><td class="num">' + (V.summary.total ? (100 * x.damage / V.summary.total).toFixed(1) + '%' : '-') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  $('ww-breakdown').innerHTML = html;
}
function renderWarnings() {
  var V = S.view, html = '';
  if (S.error) html += '<div class="ww-err">' + esc(S.error) + '</div>';
  if (V) {
    var main = V.warnings.filter(function (w) { return w.level === 'warn' || w.level === 'error'; });
    var info = V.warnings.filter(function (w) { return !(w.level === 'warn' || w.level === 'error'); });
    var tag = function (w) { return w.mech && w.mech !== 'table' ? '<span class="ww-mech' + (w.mech === 'unsolved' ? ' unsolved' : w.mech === 'corroborated' ? ' corroborated' : '') + '">' + (MECH_ZH[w.mech] || w.mech) + '</span> ' : ''; };
    html += main.map(function (w) { return '<div class="' + (w.level === 'error' ? 'ww-err' : 'ww-warn') + '">' + tag(w) + esc(w.text) + '</div>'; }).join('');
    if (info.length) html += '<details' + (main.length ? '' : ' open') + '><summary style="cursor:pointer;font-size:12px;color:var(--muted);margin:6px 0">说明 ' + info.length + ' 条</summary>' +
      info.map(function (w) { return '<div class="ww-warn" style="border-left-color:var(--line2);background:none;color:var(--muted)">' + tag(w) + esc(w.text) + '</div>'; }).join('') + '</details>';
  }
  if (!html) html = '<div class="ww-empty">—</div>';
  $('ww-warnings').innerHTML = html;
}

// ---------------------------------------------------------------- import / export
function openImport() {
  modal('导入配置（JSON）', '<div style="font-size:12px;color:var(--dim);margin-bottom:8px">格式同 VALIDATION_CASES.md：单个用例对象、用例数组或 {cases:[…]}（取第一个）。</div>' +
    '<input type="file" id="ww-imp-file" accept=".json,application/json"><textarea id="ww-imp-text" style="width:100%;height:260px;margin-top:8px;background:rgba(0,0,0,.35);color:inherit;border:1px solid var(--line2);font:12px/1.4 ui-monospace,monospace"></textarea><div id="ww-imp-err"></div>',
    '<button class="ww-btn pri sm" id="ww-imp-go">导入</button>', function (box, close) {
      box.querySelector('#ww-imp-file').onchange = function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { box.querySelector('#ww-imp-text').value = rd.result; }; rd.readAsText(f); };
      box.querySelector('#ww-imp-go').onclick = function () {
        var err = box.querySelector('#ww-imp-err');
        try {
          var o = JSON.parse(box.querySelector('#ww-imp-text').value);
          if (Array.isArray(o)) o = o[0]; else if (o && Array.isArray(o.cases)) o = Object.assign({}, o.defaults || {}, o.cases[0]);
          o = clone(o); delete o.expect; delete o.probe; delete o.substatTiers; if (o.actionFrames && o.actionFrames !== false) delete o.actionFrames;
          o.rotation = o.rotation || { mode: 'search', sequence: '' };
          if (!o || !Array.isArray(o.team)) throw new Error('编队需要 1–3 名共鸣者');
          var miss = simFindMissingIds(o); if (miss.length) throw new Error('数据中不存在：' + miss.join(', '));
          var showErr = function (e) { err.innerHTML = '<div class="ww-err">' + esc('导入失败：' + (e && e.message || e)) + '</div>'; };
          ensure(o, 'lazy').then(function () {   // v3.3: validation needs the full records
            var bad = validConfig(o); if (bad) return showErr(bad);
            S.config = normalizeImported(o); S.sel = 0; S.echoSel = 0; S.lastSearch = null; save(); close(); renderInputs(); run(); toast('已导入');
          }, showErr);
        } catch (e) { err.innerHTML = '<div class="ww-err">' + esc('导入失败：' + (e && e.message || e)) + '</div>'; }
      };
    });
}
function openExport() {
  var txt = JSON.stringify(exportConfig(), null, 1);
  modal('导出配置（JSON）', '<div style="font-size:12px;color:var(--dim);margin-bottom:8px">档位副词条已写成数值；可直接用 <code>node engine/cli.js 文件.json</code> 复算。</div><textarea id="ww-exp-text" readonly style="width:100%;height:300px;background:rgba(0,0,0,.35);color:inherit;border:1px solid var(--line2);font:12px/1.4 ui-monospace,monospace">' + esc(txt) + '</textarea>',
    '<button class="ww-btn sm" id="ww-exp-copy">复制</button><button class="ww-btn pri sm" id="ww-exp-dl">下载</button>', function (box) {
      box.querySelector('#ww-exp-copy').onclick = function () { var t = box.querySelector('#ww-exp-text'); t.select(); try { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('已复制'); }, function () { document.execCommand('copy'); toast('已复制'); }); } catch (e) { document.execCommand('copy'); } };
      box.querySelector('#ww-exp-dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'ww-config.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    });
}

// ---------------------------------------------------------------- orchestration
function renderInputs(keepBuildScroll) { renderTeam(); renderBuild(); renderEnemy(); renderSettings(); renderSeq(); renderSearch(); }
function renderAll() { renderTeam(); renderStatus(); renderSummary(); renderGauges(); renderSeq(); renderTimeline(); renderBuffs(); renderSearch(); renderShare(); renderBreakdown(); renderWarnings(); }
function init(text, boot) {
  var data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('数据 JSON 解析失败：' + (e && e.message || e)); }
  if (!data || typeof data !== 'object' || !data.meta || !data.resonators) throw new Error('数据格式错误：缺少 meta / resonators');
  if (data.meta.version !== CFG.version || data.meta.source_commit !== CFG.commit) throw new Error('数据版本不匹配：页面需要 ' + CFG.version + ' @' + String(CFG.commit).slice(0, 8) + '，实际为 ' + data.meta.version + ' @' + String(data.meta.source_commit).slice(0, 8) + '（可能是缓存的旧数据，请强制刷新）');
  if (!data.runtime || data.runtime.schema !== 'ww-runtime-1') throw new Error('数据缺少 runtime（副词条档位 / 动作帧）');
  S.data = data; S.dataText = text;
  S.chars = {}; data.resonators.forEach(function (r) { S.chars[r.id] = r; });
  S.weapons = {}; data.weapons.forEach(function (w) { S.weapons[w.id] = w; });
  S.echoIdx = {}; data.echoes.forEach(function (x) { S.echoIdx[x.id] = 1; });
  Object.keys(boot || {}).forEach(function (id) { if (id !== 'index') mergeChunk(id, boot[id]); });   // v3.3: first-screen chunks
  SIM.assets(data.elementIcons);   // v3.2: window.__simAssets + sim:assets, before any computation
  S.idx = E.indexData(data);
  S.tiers = E.substatTierTable(data.runtime.substatTiers) || [];
  S.tiers.forEach(function (t) { S.tierByKey[t.key] = t; });
  SIM.presets(simPresets());   // v3.2: window.__simPresets + sim:presets (after data load, before any computation)
  $('ww-ver').textContent = '· 数据 ' + data.meta.version + ' · 引擎 ' + (E.VERSION || '') + ' · 模块 ' + Object.keys(MODS).length;
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
  if (saved && (typeof saved !== 'object' || !Array.isArray(saved.team) || simFindMissingIds(saved).length)) saved = null;
  // v3.3: a saved config with non-first-screen resonators loads their chunks before validation (still the first screen: phase 'boot')
  var pre = saved ? ensure(saved, 'boot').then(null, function (e) { console.warn('[ww] saved config chunks failed, using the default preset:', e); saved = null; }) : Promise.resolve();
  return pre.then(function () {
    if (saved && !validConfig(saved)) S.config = saved;
    else S.config = clone(CFG.presets[0].config);
    S.config.rotation = S.config.rotation || { mode: 'search', sequence: '' };
    renderTop(); renderInputs(); renderAll();
    startWorker();
    SIM.shareBoot(data.meta.version, run);   // v3.2: a #s= share link skips the default run (falls back to it on decode failure / missing ids)
  });
}
// __simPresets items: {id (= select value), name, desc, members:[{id,name,el,avatar}], memberIds, team, expectedTotal (= expected), config}
function simPresets() {
  return (CFG.presets || []).map(function (p, i) {
    var ids = ((p.config && p.config.team) || []).map(function (m) { return m && m.id; }).filter(function (x) { return x != null; });
    var mem = ids.map(function (id) { var R = S.chars[id] || {}; return { id: id, name: R.name || String(id), el: R.element || '', avatar: R.avatar || null }; });
    return { id: String(i), name: p.name, desc: p.desc || '', members: mem, memberIds: ids, team: mem.map(function (x) { return x.name; }).join('/'),
      expectedTotal: p.expectedTotal == null ? null : p.expectedTotal, expected: p.expectedTotal == null ? null : p.expectedTotal, config: clone(p.config),
      // v3.3 preset rule: where the card's fixed sequence came from + both candidate totals (null for hand-written presets)
      seqSource: p.seqSource || null, searchTotal: p.searchTotal == null ? null : p.searchTotal, replayTotal: p.replayTotal == null ? null : p.replayTotal,
      replayTrimmed: p.replayTrimmed || 0 };   // v3.4 截尾重放: tail steps dropped from the previous release's sequence
  });
}
document.addEventListener('sim:compare', function () { if (S.view) renderShare(); });
window.__WW_UI__ = { S: S, run: run, renderAll: renderAll, exportConfig: exportConfig, presets: CFG.presets };
if (!E) { fail('引擎初始化失败：未找到 WWEngine（assets/ww-engine.js）'); return; }
if (typeof fetch !== 'function') { fail('浏览器不支持 fetch，无法加载数据'); return; }
if (!LD) { fail('页面缺少分块加载器（sim_chunks.js）'); return; }
// v3.3: index + first-screen chunks (sim:progress phase 'boot'); a chunk failure → __uiError + sim:error {phase:'load', runId:null}
LD.boot().then(function (o) {
  return init(o.index, o);
}, function (e) {
  SIM.fire('sim:error', { game: 'ww', runId: null, message: '数据请求失败：' + (e && e.message || e), phase: 'load', code: (e && e.code) || 'error', chunk: (e && e.chunk) || null, file: (e && e.file) || null });
  throw new Error('数据请求失败：' + (e && e.message || e));
}).then(function () {
  ui('__uiReady');
}).catch(function (e) { console.warn('[ww] load failed:', e); fail(e && e.message || String(e)); });
})();
