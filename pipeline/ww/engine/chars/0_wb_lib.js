/*
 * worker-B shared helpers for character modules (no character registered here).
 * File name starts with a digit so that both chars/index.js (Node) and page/build_page.py (browser bundle, sorted
 * `^\d+_.*\.js`) load it right after _common.js and before every <id>_*.js module.
 * Browser global: WWKitB. Node: require('./0_wb_lib.js').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./_common.js'));
  else root.WWKitB = factory(root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { on, CN } = C;
  /** n basic stages (labels 「<pre>第N段伤害」) as module acts key<prefix>1..n; durs = per-stage estimates (used only without frames) */
  function stages(H, o) {
    const K = {};
    for (let k = 1; k <= o.n; k++) {
      const lab = o.label ? o.label(k) : (o.pre || '') + '第' + CN[k - 1] + '段伤害';
      K[(o.prefix || 'A') + k] = H.act(Object.assign({ key: (o.prefix || 'A') + k, cls: o.cls || 'A', skill: o.skill || 1, labels: Array.isArray(lab) ? lab : [lab], levelKey: o.levelKey || 'basic',
        ownStage: true, dur: (o.durs || [])[k - 1] || 0.6 }, o.extra || {}));
    }
    return K;
  }
  /** frames map for stages: prefix → '<cat>·<label> N' */
  function stageFrames(prefix, n, lab) { const o = {}; for (let k = 1; k <= n; k++) o[prefix + k] = lab + ' ' + k; return o; }
  /** echo / outro passthrough for resolve */
  function common(api, btn) {
    if (btn === 'Q') return api.mem.kit.Q ? { act: api.mem.kit.Q } : null;
    if (btn === 'O') { const K = api.mem.modKit; return K.O ? { act: K.O } : null; }
    return null;
  }
  /** outro act from skill type 11 hits (build_ww link_outro) or an empty one */
  function outro(H, label, o) {
    const s = H.skill(11);
    return H.act(Object.assign({ key: 'O', cls: 'O', skill: 11, hits: s && s.hits ? s.hits : [], levelKey: 'outro', label: label || (s ? s.name : '延奏') }, o || {}));
  }
  /** patch parsed buffs whose source/text matches re */
  function patch(H, re, p, why, kind) {
    return H.patchBuff((b) => (!kind || b.kind === kind) && re.test((b.src || '') + '|' + (b.text || '')), p, why);
  }
  /** “攻击命中目标时 … 持续N秒” style self buffs that a DPS keeps up permanently → always on (medium) */
  function onHitAlways(H, re, kind) {
    return patch(H, re, (b) => ({ trigger: { on: 'always' }, mode: 'on', stats: b.stats.map((x) => ({ key: x.key, value: x.value * (b.maxStacks || 1) })), maxStacks: 1 }),
      '模块：命中即触发、输出期间常驻满层（中）', kind);
  }
  /**
   * runtime combination of module acts that the game chains automatically (e.g. 椿 第4段长按 → 自动第5段):
   * hits concatenated, duration / energy / concerto summed (durations already resolved from frames), cached per member.
   */
  function combo(api, keys, o) {
    const mem = api.mem, ck = keys.join('+') + (o && o.key ? '@' + o.key : '');
    mem._combo = mem._combo || {};
    if (!mem._combo[ck]) {
      const as = keys.map((k) => mem.modKit[k]);
      const a0 = as[0];
      mem._combo[ck] = Object.assign({}, a0, {
        key: (o && o.key) || a0.key, label: (o && o.label) || as.map((a) => a.label).join('+'), hits: [].concat(...as.map((a) => a.hits)),
        duration: as.reduce((s, a) => s + (a.duration || 0), 0), energy: as.reduce((s, a) => s + (a.energy || 0), 0),
        concerto: as.reduce((s, a) => s + (a.concerto || 0), 0), cancel: as[as.length - 1].cancel != null ? as.slice(0, -1).reduce((s, a) => s + (a.duration || 0), 0) + as[as.length - 1].cancel : null,
        noSwap: null, frameLabel: as.map((a) => a.frameLabel || a.key).join(' + '), durSource: as.every((a) => a.durSource === 'frames') ? 'frames' : 'module-estimate',
        comboOf: keys,
      }, o && o.extra || {});
    }
    return mem._combo[ck];
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  /** timed flag: remaining seconds */
  const rem = (until, t) => (on(until, t) ? until - t : 0);
  /**
   * hit defined only in description text (e.g. 延奏「造成X%攻击的导电伤害」): cloned from a parsed hit of the
   * same character (element / scaling template), flat multiplier at every level, no energy / concerto (medium).
   */
  function textHit(H, base, o) {
    const mv = Array.isArray(o.mv) ? o.mv : new Array(10).fill(o.mv);
    return Object.assign({}, base, { label: o.label, labelEn: o.label, count: o.count || 1, multiplier: mv, damageId: null, damageIds: [],
      type: o.type || base.type, element: o.element || base.element, scaling: o.scaling || base.scaling,
      energy: [o.energy || 0], concerto: [o.concerto || 0], confidence: o.confidence || 'medium', textOnly: true }, o.extra || {});
  }
  return { stages, stageFrames, common, outro, patch, onHitAlways, combo, clamp, rem, on, textHit, CN };
});
