(function(){  var MIGRATE_TABLE = {
    game: 'ww', current: 'ww-calc-3.5',
    order: ['ww-calc-3.2', 'ww-calc-3.3', 'ww-calc-3.4', 'ww-calc-3.4.1', 'ww-calc-3.5'],
    // per version: the value every key had in that version (only keys whose default changed since); dot path = nested key
    defaults: {
      'ww-calc-3.2': { buffTiming: 'start', outroModuleStats: false, rebeccaTurret: false, 'search.portfolio': false, 'search.v35': false, 'search.effort': 'standard' },
      'ww-calc-3.3': { buffTiming: 'start', outroModuleStats: false, rebeccaTurret: false, 'search.portfolio': false, 'search.v35': false, 'search.effort': 'standard' },
      'ww-calc-3.4': { buffTiming: 'start', outroModuleStats: false, rebeccaTurret: false, 'search.portfolio': false, 'search.v35': false, 'search.effort': 'standard' },
      'ww-calc-3.4.1': { buffTiming: 'hit', outroModuleStats: true, rebeccaTurret: true, 'search.portfolio': true, 'search.v35': false, 'search.effort': 'standard' },
      'ww-calc-3.5': { buffTiming: 'hit', outroModuleStats: true, rebeccaTurret: true, 'search.portfolio': true, 'search.v35': true, 'search.effort': 'standard' }
    },
    // v3.5: judgement corrections are NOT revertible defaults (no config key restores them): a link from an older version whose team matches
    // gets a notice explaining why its total may differ; the config itself is never changed for them
    notices: [
      { id: 'v35-unison', since: 'ww-calc-3.5', kind: 'model-correction', revertible: false, anyOf: [1311, 1312], withAnyOf: [1304, 1311, 1312],
        text: 'v3.5 判定修正（心 / 今汐 / 锁暝 同奏）：① 心「循流引兴替」攻击 +50% 现在会在诸相同奏变奏入场时生效；② 队友获得同奏后立即切人，心的「灯同辉」也会记录；③ 协奏已满且带同奏时离场仍按同奏强制延奏处理，下一位角色会响应同奏；④ 心带同奏且协奏已满时，强制放出的延奏会消耗满协奏，不再随后再白拿一次延奏；协奏未满时仍只消耗同奏效果。这是对旧版判定错误的修正，没有开关可以恢复旧算法，所以这条链接的总伤可能和分享时不同。' },
      { id: 'v35-general', since: 'ww-calc-3.5', kind: 'model-correction', revertible: false,
        text: 'v3.5 判定修正（所有队伍）：① 窗口末尾被截断的变奏技能按窗口内比例计伤，且不再结算超出窗口的异常伤害；② 「无视防御 / 减抗」类效果按文本的可叠加层数计算（如驭冕铸雷之权 5 层）；③ 重明之羽改为按共鸣效率给全队加攻击（上限 25%）。这是判定修正，不能切回旧算法，旧链接的总伤可能变化。' }
    ]
  };
  /** migrateConfig(config, linkEngineVersion) → {config, filled, from, known, to}: fills ONLY keys missing from the link's config with the
   *  defaults of the link's engine version (unknown / missing version → earliest in the table); values written in the link are never changed;
   *  filled = dot paths that were filled. The input is not mutated. Same function in the hsr engine (hsr_fixes_patch migrate_config). */
  function migrateConfig(config, linkEngineVersion) {
    var T = MIGRATE_TABLE, known = T.order.indexOf(linkEngineVersion) >= 0, from = known ? linkEngineVersion : T.order[0];
    var out = config && typeof config === 'object' ? JSON.parse(JSON.stringify(config)) : {}, filled = [];
    if (from !== T.current) {
      var d = T.defaults[from] || {};
      Object.keys(d).forEach(function (path) {
        var ks = path.split('.'), o = out;
        for (var i = 0; i < ks.length - 1; i++) {
          if (o[ks[i]] == null) o[ks[i]] = {};
          else if (typeof o[ks[i]] !== 'object') return;
          o = o[ks[i]];
        }
        var k = ks[ks.length - 1];
        if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined) return;
        o[k] = JSON.parse(JSON.stringify(d[path])); filled.push(path);
      });
    }
    var notices = [], ti = [], fi = T.order.indexOf(from);
    ((out && out.team) || []).forEach(function (m) { if (m) ti.push(m.id || m.characterId || m.charId); });
    (T.notices || []).forEach(function (nt) {
      if (fi >= T.order.indexOf(nt.since)) return;
      var has = function (l) { return !l || l.some(function (x) { return ti.indexOf(x) >= 0; }); };
      var other = !nt.withAnyOf || ti.filter(function (x) { return nt.withAnyOf.indexOf(x) >= 0; }).length >= 2;
      if (has(nt.anyOf) && other) notices.push({ id: nt.id, kind: nt.kind, revertible: nt.revertible, text: nt.text });
    });
    return { config: out, filled: filled, from: from, known: known, to: T.current, notices: notices };
  }
  window.__simMigrateConfig=migrateConfig;window.__simMigrateTable=MIGRATE_TABLE;})();