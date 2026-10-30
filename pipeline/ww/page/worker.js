/* WW simulator worker (generated into dist/assets/ww-worker.js by pipeline/ww/page/build_page.py).
 * Protocol:  -> {type:'init', engineUrl, text}            <- {type:'ready', modules:[ids]} | {type:'init-error', error}
 *            -> {type:'sim', id, config, add?}            <- {type:'result', id, view, ms, sequence, total} | {type:'result', id, error}
 * v3.3: `text` is the index data (data/ww.json, slim resonator / weapon / echo records); `add` = chunks the page loaded since the last
 * message: {mods: [[url, source]], recs: [{kind, record}]} — module sources are evaluated, full records replace the slim ones at the
 * same array position, and the index is rebuilt (the engine then sees exactly the v3.2 records). Runtime data is attached here. */
'use strict';
var E = null, IDX = null, RT = null, D = null;
var COLL = { resonator: 'resonators', weapon: 'weapons', echo: 'echoes' };
function hydrate(add) {
  if (!add) return;
  (add.mods || []).forEach(function (m) { (0, eval)(m[1] + '\n//# sourceURL=' + m[0]); });
  var n = 0;
  (add.recs || []).forEach(function (r) {
    var arr = D[COLL[r.kind]];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === r.record.id) { arr[i] = r.record; n++; break; }
  });
  if (n || (add.mods || []).length) IDX = E.indexData(D);
}
function simulate(config) {
  var cfg = JSON.parse(JSON.stringify(config));
  if (RT && RT.substatTiers) cfg.substatTiers = RT.substatTiers;
  if (cfg.actionFrames !== false && RT && RT.actionFrames) cfg.actionFrames = RT.actionFrames; else delete cfg.actionFrames;
  var r = E.simulate(cfg, IDX);
  return { view: E.toView(r), sequence: r.sequence, total: r.total };
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type === 'init') {
    try {
      importScripts(m.engineUrl);
      E = self.WWEngine;
      if (!E) throw new Error('引擎未注册（WWEngine）');
      D = JSON.parse(m.text);
      RT = D.runtime || {};
      IDX = E.indexData(D);
      self.postMessage({ type: 'ready', modules: E.listChars().map(function (c) { return c.id; }) });
    } catch (e) { self.postMessage({ type: 'init-error', error: String(e && e.message || e) }); }
  } else if (m.type === 'sim') {
    var t0 = Date.now();
    try {
      hydrate(m.add);
      var o = simulate(m.config);
      self.postMessage({ type: 'result', id: m.id, view: o.view, sequence: o.sequence, total: o.total, ms: Date.now() - t0 });
    } catch (e) { self.postMessage({ type: 'result', id: m.id, error: String(e && e.message || e), ms: Date.now() - t0 }); }
  }
};
