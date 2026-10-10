/*
 * 弗洛洛 (1608) character module — worker-B.
 *
 * 普攻 生与死的乐章 (1003701): 3 段；「施放普攻第3段时进入重世状态。」
 *   「谱曲终末：弗洛洛每25秒可激活谱曲。同时满足…拥有6枚【乐声】、谱曲处于激活状态、不处于【定音】状态时，重击替换为谱曲终末…本次伤害为共鸣技能伤害。
 *    每层余响可使本次伤害倍率额外增加（每层余响增加倍率=82.55%）。施放此技能时，同时视为施放声骸技能…随后获得【定音】状态。」
 * 共鸣技能 稍纵即逝的梦呓 (1003702): 冷却 12，「施放时进入重世状态」
 * 共鸣回路 新世界狂想曲 (1003707): 「处于重世状态时，地面短按普攻施放亡与死的乐章…共鸣技能伤害…施放时退出重世状态」「…短按共鸣技能施放永不消逝的梦呓…施放时退出重世状态」
 *   「余响上限为24层。弗洛洛不为队伍中登场角色，施放强化攻击·弦乐/管乐/彩乐·赫卡忒时，可获得1层余响。」
 *   「【乐声】上限6枚…普攻第3段、亡与死的乐章命中目标时，可获取1枚【乐声·弦乐】。共鸣技能稍纵即逝的梦呓、永不消逝的梦呓命中目标时，可获取1枚【乐声·管乐】。」
 * 共鸣解放 往日深渊的圆舞曲 (1003703): 「处于【定音】状态时，解锁…施放后退出【定音】状态，进入指挥状态，持续24秒。指挥状态：攻击提升120%…按获取顺序演奏【乐声】，每枚【乐声】演奏4秒。」
 *   「若弗洛洛为队伍中登场角色…点击普攻，指挥赫卡忒施放普攻·赫卡忒…累计施放2次普攻后，下次普攻·赫卡忒将替换为强化攻击·赫卡忒。」
 *   「若弗洛洛不为队伍中登场角色…赫卡忒将自动施放普攻·赫卡忒攻击目标。队伍中角色施放声骸技能时，赫卡忒将施放强化攻击·赫卡忒…最多可触发10次该效果，同名声骸仅可触发1次该效果。」
 *   「若切换回弗洛洛，提前结束指挥状态。」「谢幕：…处于指挥状态时，弗洛洛非变奏技能登场 / 处于指挥状态时，点击共鸣解放」
 *   → 离场自动普攻·赫卡忒节奏未公开：每 1.5 s 一轮 2 段（低，module.hecatePeriod）；队员声骸技能（Q；坎特蕾拉“视为声骸技能”的陷溺/斑驳幻梦/感知汲取亦计）→ 强化攻击（每成员每种一次，上限 10，中）
 * 变奏 致命组歌 / 永生组歌 (1003706): 「进入指挥状态后，下次致命组歌替换为永生组歌」
 * 延奏 未完成的曲目 (1003709): 下一位登场角色湮灭加深 20%、重击加深 25%（解析自动）；「弗洛洛处于指挥状态时施放此技能…切换至其他角色时，赫卡忒将额外施放2次强化攻击·赫卡忒」
 * 固有 变音符：「施放致命组歌、永生组歌、声骸技能时，下一枚获得的【乐声】会变为【乐声·彩乐】」；八重奏：「进入战斗状态获得10层余响…每拥有1层余响，暴击伤害提升2.5%…溢出 1 层暴伤 +1%，最多 100%」→ 模块光环
 * 共鸣链：1 亡与死的乐章/永不消逝的梦呓 ×1.8；2 谱曲终末 ×1.75、余响加成 ×1.75、+14 余响；3 声骸伤害加深 80%（解析）；4 声骸技能 → 全队全属性 +20%（触发补 谱曲终末）；
 *   6 强化攻击 ×1.24；重世幻象 216.42%（未建模，低）；离场指挥时目标受到伤害 +40%（按加深计，低）；在场指挥时湮灭 +60%（光环）。
 * 专武 幽冥的忘忧章 (21050066)：「造成声骸技能伤害后12秒内，共鸣技能伤害加成提升32%，声骸技能伤害加深32%，且造成伤害时无视目标8%防御」→ 赫卡忒（声骸伤害）/ Q 造成伤害时触发（模块）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21050066;
  const NOTE_ZH = { s: '弦乐', w: '管乐', c: '彩乐' };
  return WW.registerChar({
    id: 1608, chainModeled: 6, name: '弗洛洛', version: '0.1', confidence: 'medium',
    notes: ['离场赫卡忒自动普攻节奏为估计（每 1.5 s 一轮，低）', '队员声骸技能触发强化攻击·赫卡忒（每成员一次；坎特蕾拉视为声骸技能的动作各计一次，中）',
      '余响：开局 10 层（八重奏）、离场强化攻击 +1；暴伤光环', '链6 重世幻象未建模（低）'],
    audit: { role: 'dps', finishers: ['coda', 'waltz'], window: 30, sig: 21050066, alts: [21050015, 21050045, 21050074], solo: 'phrolova_solo.json', team: 'team_phrolova.json', teamMi: 0 },
    frames: {
      waltz: '共鸣解放·Liberation: Waltz of Forsaken Depths',   // 4s 全程时停；17:20 起按 WuWaSim toa：非耗能解放不扣时停 → 默认按完整 4s 计入（如有实测可在帧条目加 tsVerified）
      A1: '普攻·Basic: Movement of Life and Death 1', A2: '普攻·Basic: Movement of Life and Death 2', A3: '普攻·Basic: Movement of Life and Death 3',
      H: '重击·Heavy: Movement of Life and Death', coda: '重击·Heavy: Scarlet Coda', wsA: '普攻·Basic: Movement of Fate and Finality',
      E: '共鸣技能·Skill 1: Whispers in a Fleeting Dream', E2: '共鸣技能·Skill 2: Murmurs in a Haunting Dream',
      curtain: '共鸣解放·Liberation: Curtain Call',
      hA1: '普攻·Basic: Hecate 1', hA2: '普攻·Basic: Hecate 2', hs: '共鸣回路·Basic: Hecate - Strings', hw: '共鸣回路·Basic: Hecate - Winds', hc: '共鸣回路·Basic: Hecate - Cadenza',
      I: '变奏入场·Intro: Suite of Quietus', I2: '变奏入场·Intro 2: Suite of Immortality',
    },
    resources: [
      { key: 'notes', name: '乐声', max: 6, segmented: true, confidence: 'high', get: (cs) => cs.notes.length },
      { key: 'yx', name: '余响', max: 24, segmented: false, confidence: 'high' },
      { key: 'dy', name: '定音', max: 1, segmented: true, confidence: 'high' },
      { key: 'zh', name: '指挥（秒）', max: 24, segmented: false, confidence: 'high', get: (cs, t) => +B.rem(cs.zhUntil, t).toFixed(2) },
      { key: 'hec', name: '强化赫卡忒剩余次数', max: 10, segmented: false, confidence: 'medium' },
    ],
    kit(H) {
      const ch = H.chain;
      const K = B.stages(H, { n: 3, durs: [0.73, 0.6, 1.35] });
      const c1 = ch >= 1 ? { '*': 1.8 } : null, c6 = ch >= 6 ? { '*': 1.24 } : null;
      Object.assign(K, {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.03 }),
        coda: H.act({ key: 'coda', cls: 'H', skill: 1, labels: ['谱曲终末伤害'], levelKey: 'basic', concertoParam: '谱曲终末回复协奏能量', dur: 2.87, scale: ch >= 2 ? { '*': 1.75 } : null }),
        wsA: H.act({ key: 'wsA', cls: 'A', skill: 6, labels: ['亡与死的乐章伤害'], levelKey: 'forte', dur: 1.53, scale: c1 }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 12, cdKey: 'E', dur: 0.57 }),
        E2: H.act({ key: 'E2', cls: 'E', skill: 6, labels: ['永不消逝的梦呓伤害'], levelKey: 'forte', dur: 1.32, scale: c1 }),
        // 时停：action_frames「共鸣解放·Liberation: Waltz of Forsaken Depths」4s，time_stop [0,240] = 全程时停。引擎不建模时停（见 CORE_CHANGES worker-B #3），
        // 全程时停（240f）。17:20 toa 语义：不耗能 → 默认不扣时停（完整 4s），除非帧条目带 tsVerified → 取帧数据；无帧数据时回落到 opts.waltzDur（默认 0.25s）
        waltz: H.act({ key: 'waltz', cls: 'R', skill: 3, hits: [], levelKey: 'liberation', concertoParam: '往日深渊的圆舞曲回复协奏能量', dur: H.opts.waltzDur != null ? H.opts.waltzDur : 0.25, label: '往日深渊的圆舞曲', inferred: '全程时停（240f）' }),
        curtain: H.act({ key: 'curtain', cls: 'R', skill: 3, labels: ['谢幕伤害'], levelKey: 'liberation', dur: 1.38 }),
        hA1: H.act({ key: 'hA1', cls: 'A', skill: 3, labels: ['普攻·赫卡忒第一段伤害'], levelKey: 'liberation', dur: 0.67 }),
        hA2: H.act({ key: 'hA2', cls: 'A', skill: 3, labels: ['普攻·赫卡忒第二段伤害'], levelKey: 'liberation', dur: 0.82 }),
        hauto: H.act({ key: 'hauto', cls: 'A', skill: 3, labels: ['普攻·赫卡忒第一段伤害', '普攻·赫卡忒第二段伤害'], levelKey: 'liberation', label: '普攻·赫卡忒（离场自动）' }),
        hs: H.act({ key: 'hs', cls: 'A', skill: 3, labels: ['强化攻击·弦乐·赫卡忒伤害'], levelKey: 'liberation', dur: 1.52, scale: c6 }),
        hw: H.act({ key: 'hw', cls: 'A', skill: 3, labels: ['强化攻击·管乐·赫卡忒伤害'], levelKey: 'liberation', dur: 1.17, scale: c6 }),
        hc: H.act({ key: 'hc', cls: 'A', skill: 3, labels: ['强化攻击·彩乐·赫卡忒伤害'], levelKey: 'liberation', dur: 1.17, scale: c6 }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['致命组歌伤害'], levelKey: 'intro', concertoParam: '致命组歌回复协奏能量', dur: 1.33 }),
        I2: H.act({ key: 'I2', cls: 'I', skill: 5, labels: ['永生组歌伤害'], levelKey: 'intro', concertoParam: '永生组歌回复协奏能量', dur: 1.55 }),
        O: B.outro(H, '未完成的曲目'),
      });
      const yxRow = (H.skill(1).params || []).find((p) => p.label === '每层余响增加倍率');
      H.mem._yxPer = yxRow ? parseFloat(yxRow.values[Math.min(yxRow.values.length - 1, (H.level.basic || 10) - 1)]) / 100 : 0.8255;
      B.patch(H, /八重奏/, { mode: 'module' }, '模块：按余响层数的暴伤光环', 'inherent');
      B.patch(H, /施放声骸技能时，队伍中的角色全属性伤害加成提升20%/, { trigger: { on: 'any', any: [{ on: 'cast', kinds: ['Q'] }, { on: 'act', keys: ['coda'] }] } }, '模块：谱曲终末视为声骸技能', 'chain');
      B.patch(H, /处于指挥状态时，若弗洛洛为队伍中登场角色，湮灭伤害加成提升60%/, { mode: 'module', target: 'self' }, '模块：在场指挥光环', 'chain');
      if (H.weaponId === SIG) {
        B.patch(H, /造成声骸技能伤害后12秒内/, { mode: 'module', duration: 12, trigger: { on: 'manual' } }, '模块：造成声骸技能伤害（赫卡忒/Q）时触发 12 秒', 'weapon');
        H.mem._wIds = H.findBuff((b) => b.kind === 'weapon' && /造成声骸技能伤害后12秒内/.test(b.text || '')).map((b) => b.id);
      }
      return K;
    },
    fillerKeys: ['A1', 'A2', 'A3', 'wsA', 'E2'],
    init(api) {
      const st = api.H.opts.start || {};
      return { st: 0, cz: false, notes: (st.notes || []).slice(0, 6), nextC: false, dy: !!st.dingyin, puUntil: 0, yx: st.yx != null ? st.yx : 10, yxOver: 0,
        zhUntil: null, zhStart: null, zhNotes: [], hst: 0, hec: 0, used: [], immortal: false, auto: { next: 0 }, oxtra: false };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const zh = on(cs.zhUntil, t);
      switch (btn) {
        case 'A':
          if (zh) return { act: cs.hst >= 2 ? K[this.noteKey(cs, t)] : K['hA' + (cs.hst + 1)] };
          if (cs.cz) return { act: K.wsA };
          return { act: K['A' + ((cs.st % 3) + 1)] };
        case 'H':
          if (zh) return { blocked: '指挥状态' };
          if (cs.notes.length >= 6 && !cs.dy && t >= cs.puUntil - 1e-9) {
            const yxk = api.H.mem._yxPer * cs.yx * (api.H.chain >= 2 ? 1.75 : 1);
            const main = K.coda.hits.reduce((a, h) => (!a || (h.multiplier[0] > a.multiplier[0]) ? h : a), null);
            const extra = Object.assign({}, main, { label: '余响加成×' + cs.yx, count: 1, multiplier: main.multiplier.map(() => yxk), confidence: 'medium', lowReason: '每层余响增加倍率 82.55%（描述）按加算' });
            return { act: Object.assign({}, K.coda, { hits: K.coda.hits.concat([extra]), label: '谱曲终末（余响 ' + cs.yx + '）' }) };
          }
          return { act: K.H };
        case 'E':
          if (zh) return { blocked: '指挥状态' };
          if (cs.cz) return { act: K.E2 };
          return api.cdReady('E') ? { act: K.E } : { blocked: '稍纵即逝的梦呓冷却中' };
        case 'R':
          if (zh) return { act: K.curtain };
          if (cs.dy) return { act: K.waltz };
          return { blocked: '需处于定音状态' };
        case 'I': return { act: cs.immortal ? K.I2 : K.I };
        default: return B.common(api, btn);
      }
    },
    noteKey(cs, t) { const i = Math.floor(Math.max(0, t - cs.zhStart) / 4); const n = cs.zhNotes[Math.min(cs.zhNotes.length - 1, i)] || 's'; return 'h' + n; },
    addNote(cs, kind) { if (cs.dy) return; const n = cs.nextC ? 'c' : kind; cs.nextC = false; cs.notes.push(n); if (cs.notes.length > 6) cs.notes.shift(); },
    gainYx(cs, n) { const room = 24 - cs.yx; const add = Math.min(room, n); cs.yx += add; cs.yxOver = Math.min(100, cs.yxOver + (n - add)); },
    fireW(api) { for (const id of api.mem._wIds || []) api.fireBuff(id, api.mi, { duration: 12 }); },
    enhanced(api, why) {
      const cs = api.cs, K = api.mem.modKit;
      const k = this.noteKey(cs, api.s.t);
      const c6 = api.H.chain >= 6 && api.s.active !== api.mi ? [{ key: 'deep:all', value: 0.4 }] : [];
      api.deal(K[k], { count: 1, stats: c6 });
      this.fireW(api);
      if (api.s.active !== api.mi) this.gainYx(cs, 1);
    },
    actionStats(api, act) {
      const cs = api.cs;
      if (api.H.chain >= 6 && act.key === 'coda') return [];
      return [];
    },
    auras(api, target) {
      const cs = api.cs, out = [];
      if (target !== api.mi) return out;
      out.push({ key: 'critDmg', value: 0.025 * Math.min(24, cs.yx) + 0.01 * Math.min(100, cs.yxOver) }); // 八重奏
      if (on(cs.zhUntil, api.t)) { out.push({ key: 'atkPct', value: 1.2 }); if (api.H.chain >= 6 && api.s.active === api.mi) out.push({ key: 'dmg:havoc', value: 0.6 }); }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.t, te = api.tEnd;
      if (/^A\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (n === 3) { cs.cz = true; this.addNote(cs, 's'); } } else if (!/^h/.test(k)) cs.st = 0;
      switch (k) {
        case 'wsA': cs.cz = false; this.addNote(cs, 's'); break;
        case 'E': cs.cz = true; this.addNote(cs, 'w'); break;
        case 'E2': cs.cz = false; this.addNote(cs, 'w'); break;
        case 'coda': cs.dy = true; cs.puUntil = t + 25; cs.nextC = true; if (api.H.chain >= 2) this.gainYx(cs, 14); break;
        case 'waltz':
          cs.dy = false; cs.zhStart = te; cs.zhUntil = te + 24; cs.zhNotes = cs.notes.slice(); cs.notes = []; cs.hst = 0; cs.hec = 10; cs.used = []; cs.immortal = true; cs.auto = { next: te };
          if (api.H.chain >= 3) cs.zhNotes = cs.zhNotes.map(() => 'c');
          break;
        case 'curtain': cs.zhUntil = te; cs.immortal = false; cs.zhNotes = []; break;
        case 'hA1': cs.hst = 1; this.fireW(api); break;
        case 'hA2': cs.hst = 2; this.fireW(api); break;
        case 'hs': case 'hw': case 'hc': cs.hst = 0; this.fireW(api); break;
        case 'I': cs.nextC = true; break;
        case 'I2': cs.nextC = true; cs.immortal = false; break;
        case 'Q': cs.nextC = true; this.fireW(api); break;
        default: break;
      }
    },
    onOutro(api) { if (on(api.cs.zhUntil, api.t)) api.cs.oxtra = true; },
    onTeam(api, ev) {
      const cs = api.cs, me = api.mi, K = api.mem.modKit;
      const zh = on(cs.zhUntil, ev.t || api.t);
      if ((ev.type === 'intro' || ev.type === 'swap') && ev.mi === me && cs.zhUntil != null && zh) {
        // 切换回弗洛洛：提前结束指挥状态；非变奏登场 → 谢幕
        if (ev.type === 'swap') api.deal(K.curtain, { coord: false });
        cs.zhUntil = ev.t; cs.immortal = ev.type === 'swap' ? false : cs.immortal; return;
      }
      if (!zh || api.s.active === me) return;
      if ((ev.type === 'intro' || ev.type === 'swap') && cs.oxtra) { cs.oxtra = false; for (let i = 0; i < 2; i++) this.enhanced(api, 'outro'); }
      if (ev.type !== 'damage' || ev.coord) return;
      // 离场自动普攻·赫卡忒（估计节奏）
      const per = api.H.opts.hecatePeriod || 1.5;
      const end = Math.min((ev.t || 0) + (ev.dur || 0), cs.zhUntil, api.ctx.duration);
      let n = 0;
      while (cs.auto.next <= end + 1e-9) { n++; cs.auto.next += per; }
      if (n) { api.deal(K.hauto, { count: n, stats: api.H.chain >= 6 ? [{ key: 'deep:all', value: 0.4 }] : [] }); this.fireW(api); }
      // 队员声骸技能 → 强化攻击（同名声骸一次）
      const a = ev.act || {};
      const isEcho = a.cls === 'Q' || (api.memberDef(ev.mi).R.id === 1607 && ['R', 'E2', 'drain'].includes(a.key));
      const tag = ev.mi + ':' + (a.cls === 'Q' ? 'Q' + (a.echoId || '') : a.key);
      if (isEcho && cs.hec > 0 && !cs.used.includes(tag)) { cs.used.push(tag); cs.hec -= 1; this.enhanced(api, 'echo'); }
    },
    // search heuristic (not a game rule): progress toward 谱曲终末 / 指挥 value
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t, D = api.ctx.duration;
      // 指挥 window value: on-field Hecate loop (hA1+hA2+enhanced) rate ×(1+120% atk ≈ 1.6), plus off-field echo triggers
      const loop = api.est(K.hA1) + api.est(K.hA2) + api.est(K.hs);
      const rate = 1.6 * loop / Math.max(0.5, (K.hA1.duration || 0.7) + (K.hA2.duration || 0.8) + (K.hs.duration || 1.2));
      const V = (sec) => Math.max(0, sec) * rate;
      const coda = api.est(K.coda) + api.H.mem._yxPer * cs.yx * 0.3 * api.est(K.coda) / 5.9;
      let v = 0;
      if (on(cs.zhUntil, t)) v += 0.9 * V(Math.min(B.rem(cs.zhUntil, t), D - t)) + cs.hec * 0.1 * api.est(K.hs) + 0.6 * api.est(K.curtain);
      else if (cs.dy) v += 0.3 * V(Math.min(24, D - t - 4)) + 0.4 * api.est(K.curtain);
      else v += (cs.notes.length / 6) * 0.5 * (coda + 0.3 * V(Math.min(24, D - t - 8)));
      return v;
    },
  });
});
