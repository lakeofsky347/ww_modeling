/*
 * Shared helpers for character modules (plain JS, browser + node).
 * Browser: load ww_engine.js, then chars/_common.js, then chars/<id>_*.js (each registers itself on window.WWEngine).
 * Node:    require('./chars') registers all modules.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WWCharsCommon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const EPS = 1e-9;
  const CN = ['一', '二', '三', '四', '五', '六'];
  /** multiplier of a hit row at a level (1-based) */
  function multAt(hit, level) { const a = hit.multiplier || []; return a[Math.max(0, Math.min(a.length - 1, level - 1))] || 0; }
  /** timed-window helper: active(t) */
  function on(until, t) { return until != null && until > t + EPS; }
  /** recharge counter (e.g. 长离 赫羽三相 2 charges / 12s) */
  function charges(c, t, max, period) {
    if (c.n >= max) return max;
    return Math.min(max, c.n + Math.floor((t - c.since + EPS) / period));
  }
  function useCharge(c, t, max, period) {
    const cur = charges(c, t, max, period);
    if (cur <= 0) return false;
    if (cur >= max) { c.n = max - 1; c.since = t; }
    else { const k = Math.floor((t - c.since + EPS) / period); c.since += k * period; c.n = cur - 1; }
    return true;
  }
  /**
   * Hit row from a skill's `unlinkedDamage` (ww.json damage rows that no description multiplier references, e.g. 延奏 rows).
   * The row carries `rate` (single level) instead of `multiplier`; confidence stays low (row ↔ description matched by the module).
   * spec: {label, mult (override, fraction), count, why}
   */
  function rowHit(H, skillSel, damageId, spec) {
    spec = spec || {};
    const s = H.skill(skillSel);
    const r = s && (s.unlinkedDamage || []).find((x) => x.damageId === damageId);
    if (!r) { H.mem.warn.push({ level: 'warn', text: `${H.R.name}: 模块找不到 damage 行 ${damageId}` }); return null; }
    const m = spec.mult != null ? spec.mult : (r.rate ? r.rate[r.rate.length - 1] : 0);
    return Object.assign({}, r, { label: spec.label || r.typeName || '伤害', multiplier: [m], count: spec.count || 1, confidence: 'low',
      lowReason: spec.why || 'ww.json unlinkedDamage 行（描述未直接引用），由角色模块按描述数值对应' });
  }
  /**
   * “在场角色造成伤害后 N 秒内每秒至多 1 次” coordinated-attack window (折枝 墨鹤 / 维里奈 光合标记 / 心 敕令 …).
   * w = {until, left, next}; returns number of procs for a damage event covering [t, t+dur] (+tail seconds).
   */
  function perSecond(w, t, dur, tail, cap) {
    if (!w || w.until == null || w.until <= t + EPS || (w.left != null && w.left <= 0)) return 0;
    const start = Math.max(w.next || 0, t);
    const end = Math.min(t + (dur || 0) + (tail || 0), w.until, cap == null ? Infinity : cap);
    if (end < start - EPS) return 0;
    let n = Math.floor(end - start + EPS) + 1;
    if (w.left != null) n = Math.min(w.left, n);
    w.next = start + n; if (w.left != null) w.left -= n;
    return n;
  }
  // 【同奏增益】is one shared effect across providers (心 1311 / 锁暝 1312 each register their own buff id m<k>_tzzy):
  // per target the total stacks are capped at 2, +1 if 心 is in the team (固有 信步拾清欢), +1 more at 心 S6. Returns the stacks provider `own` may hold on target j.
  function tzzyRoom(api, j, own) {
    const ms = api.ctx.members, hsin = ms.find((m) => m.R.id === 1311);
    const cap = 2 + (hsin ? 1 : 0) + (hsin && (hsin.chain || 0) >= 6 ? 1 : 0);
    let others = 0;
    ms.forEach((m, k) => { if (k === own) return; const b = api.buffInst('m' + k + '_tzzy', j); if (b) others += b.stacks; });
    return Math.max(0, cap - others);
  }
  return { EPS, CN, multAt, on, charges, useCharge, rowHit, perSecond, tzzyRoom };
});
