/* WW simulator worker (generated into dist/assets/ww-worker.js by pipeline/ww/page/build_page.py).
 * Protocol:  -> {type:'init', engineUrl, text}            <- {type:'ready', modules:[ids]} | {type:'init-error', error}
 *            -> {type:'sim', id, config}                  <- {type:'result', id, view, ms, sequence, total} | {type:'result', id, error}
 * The page posts the data JSON text once; runtime data (substat tiers, action frames) is attached here. */
'use strict';
var E = null, IDX = null, RT = null;
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
      var d = JSON.parse(m.text);
      RT = d.runtime || {};
      IDX = E.indexData(d);
      self.postMessage({ type: 'ready', modules: E.listChars().map(function (c) { return c.id; }) });
    } catch (e) { self.postMessage({ type: 'init-error', error: String(e && e.message || e) }); }
  } else if (m.type === 'sim') {
    var t0 = Date.now();
    try {
      var o = simulate(m.config);
      self.postMessage({ type: 'result', id: m.id, view: o.view, sequence: o.sequence, total: o.total, ms: Date.now() - t0 });
    } catch (e) { self.postMessage({ type: 'result', id: m.id, error: String(e && e.message || e), ms: Date.now() - t0 }); }
  }
};
