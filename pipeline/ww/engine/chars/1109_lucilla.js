/*
 * 洛瑟菈 (1109) character module — stream A 批次 4。冷凝 音感仪，辅助/副C（霜渐 或 声骸 两种共鸣模态）。
 *
 * 共鸣模态：默认 霜渐（`module.mode='echo'` → 声骸）。两种模态的命中行在 ww.json 中同名、类型分别为 basic/echo → 模块按模态筛选。
 * 印象（上限 150）每 50 冲洗 1 张照片（上限 3）：剪辑 +100、追光 +50、普攻第 3 段·可圈可点 +50（完美焦距，默认）、补光/乏善可陈 +25。
 * 普攻 1–2 + 第 3 段·可圈可点 235.27%；E：幻象定帧 13.26%×3 + 追光 548.98%（冷却 16；+20 协奏；霜渐模态 1 层霜渐；
 *   固有 慢镜头：霜渐 → 登场角色附近目标 冷凝抗性 −8% 30 s / 声骸 → 全队 声骸技能 +25% 30 s）。
 * R 历历在目（3 张照片，不耗能量，冷却 25）142.74%：霜渐 → 普攻 +30% 10 s、4 层胶卷 30 s / 声骸 → 声骸技能 +30% 10 s、1 层变焦；进入 追忆。
 * 追忆：A → 溯念留形 1、2、3（第 3 段按照片数持续：每张照片 1 次 遗忘 285.48%（霜渐模态 1 层霜渐），消耗照片；铭记：每张照片 +2 胶卷 / +1 变焦）→ 断舍离 84.81%×3+593.64%（+20 协奏）退出追忆。
 * 胶卷：除洛瑟菈外的登场角色附加霜渐时，消耗 1 层，洛瑟菈附加 2 层霜渐（0.5 s 一次）。变焦：登场角色声骸技能暴击伤害 +10%/层（模块，按全队记）。
 * 变奏 剪辑 97.42%（1 层）；追忆中 剪辑·硬切 149.41%（1 层）。延奏 蒙太奇：霜渐 → 目标受到霜渐伤害加深 60% 30 s（模块）；声骸 → 下一位 声骸技能加深 50% 14 s（解析）。
 * 链：1 追光后 暴击 +20% 10 s；2 追忆期间及之后 30 s 霜渐伤害加深 +80% / 声骸技能 +40%；3 断舍离 倍率 +100%；4 遗忘 攻击 +10%/层 ≤3 6 s；5 遗忘 倍率 +50%；
 *   6 铭记（断舍离 +200%/照片）→ 建模；击败相关 不建模。chainModeled 6。
 * 动作帧：WuwaLAB（Lucilla）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  return WW.registerChar({
    id: 1109, chainModeled: 6, name: '洛瑟菈', version: '0.1', confidence: 'medium',
    notes: ['默认 共鸣模态·霜渐、完美焦距（可圈可点 / 追光）', '变焦 按全队声骸技能暴击伤害记（应为登场角色）', '追忆中第 3 段 按照片数一次性结算'],
    audit: { role: 'support', finishers: ['let', 'spot'], window: 25, sig: 21050086, solo: 'lucilla_solo.json', team: 'team_hiyuki.json', teamMi: 1, anomaly: ['chafe'] },
    frames: {
      b1: '普攻·Basic: Snapshot 1', b2: '普攻·Basic: Snapshot 2', b3: '普攻·Basic: Snapshot 3 - Commendable', spot: '共鸣技能·Skill: Spotlight',
      R: '共鸣解放·Liberation: Clear As Day', t1: '普攻·Basic: Tracing Forms 1', t2: '普攻·Basic: Tracing Forms 2', t3: null, obl: null, let: '普攻·Basic: Letting It Go',
      I: '变奏入场·Intro: Clip It', I2: '变奏入场·Intro 2: Clip It:  Hard Cut',
    },
    resources: [{ key: 'imp', name: '印象', max: 150, segmented: false, confidence: 'high' }, { key: 'photo', name: '照片', max: 3, segmented: true, confidence: 'high' }, { key: 'film', name: '胶卷', max: 10, segmented: true, confidence: 'high' }],
    kit(H) {
      const ch = H.chain, echo = H.opts.mode === 'echo', ty = echo ? 'echo' : 'basic';
      const sel = (a, extra) => { const hs = a.hits.filter((h) => h.type === ty || (h.type !== 'basic' && h.type !== 'echo')); return H.act(Object.assign({ key: a.key, cls: a.cls, skill: a.skill, hits: hs, levelKey: a.levelKey, dur: a.duration, label: a.label }, extra || {})); };
      const K = {
        b1: H.act({ key: 'b1', cls: 'A', skill: 1, labels: ['普攻第一段伤害'], levelKey: 'basic', dur: 0.5 }),
        b2: H.act({ key: 'b2', cls: 'A', skill: 1, labels: ['普攻第二段伤害'], levelKey: 'basic', dur: 0.53 }),
        b3: H.act({ key: 'b3', cls: 'A', skill: 1, labels: ['普攻第三段·可圈可点伤害'], levelKey: 'basic', dur: 1.77, label: '第3段·可圈可点' }),
        spot: H.act({ key: 'spot', cls: 'E', skill: 2, labels: ['幻象定帧伤害', '追光伤害'], levelKey: 'skill', cooldown: 16, cdKey: 'E', dur: 1.78, label: '幻象定帧·追光' }),
        R: sel(H.act({ key: 'R', cls: 'R', skill: 3, labels: ['历历在目伤害'], levelKey: 'liberation', dur: 4.43, label: '历历在目' }), { concertoParam: '回复协奏能量', cost: 0, cooldown: 25, cdKey: 'R' }),
        t1: H.act({ key: 't1', cls: 'A', skill: 3, labels: ['普攻·溯念留形第一段伤害'], levelKey: 'liberation', dur: 0.45, label: '溯念留形·1' }),
        t2: H.act({ key: 't2', cls: 'A', skill: 3, labels: ['普攻·溯念留形第二段伤害'], levelKey: 'liberation', dur: 0.9, label: '溯念留形·2' }),
        t3: H.act({ key: 't3', cls: 'A', skill: 3, labels: ['普攻·溯念留形第三段伤害'], levelKey: 'liberation', dur: 1.17, label: '溯念留形·3' }),
        let: sel(H.act({ key: 'let', cls: 'A', skill: 3, labels: ['断舍离伤害'], levelKey: 'liberation', dur: 1.28, label: '断舍离' })),
        obl: sel(H.act({ key: 'obl', cls: 'A', skill: 6, labels: ['遗忘伤害'], levelKey: 'forte', label: '遗忘' })),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['剪辑伤害'], levelKey: 'intro', concertoParam: '剪辑回复协奏能量', dur: 1.35, label: '剪辑' }),
        I2: H.act({ key: 'I2', cls: 'I', skill: 5, labels: ['剪辑·硬切伤害'], levelKey: 'intro', concertoParam: '剪辑·硬切回复协奏能量', dur: 0.87, label: '剪辑·硬切' }),
        O: B.outro(H, '蒙太奇'),
      };
      for (const k of ['R', 'let']) if (!K[k].hits.length) H.mem.warn.push({ level: 'warn', text: `洛瑟菈: ${k} 按模态筛选后无命中行` });
      B.patch(H, /慢镜头|既视感|铭记|胶卷|变焦/, { mode: 'off' }, '模块：按共鸣模态触发');
      H.buff({ id: 'slow', name: echo ? '慢镜头·声骸技能' : '慢镜头·冷凝减抗', stats: [echo ? { key: 'dmg:echo', value: 0.25 } : { key: 'resShred:glacio', value: 0.08 }], duration: 30, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '施放追光：' + (echo ? '队伍声骸技能 +25%' : '登场角色附近目标 冷凝抗性 −8%') + ' 30 s' });
      H.buff({ id: 'rUp', name: echo ? '历历在目·声骸技能' : '历历在目·普攻', stats: [{ key: echo ? 'dmg:echo' : 'dmg:basic', value: 0.3 }], duration: 10, trigger: { on: 'manual' }, mode: 'module', text: '施放历历在目 +30% 10 s' });
      if (echo) H.buff({ id: 'zoom', name: '变焦', stats: [{ key: 'critDmg:echo', value: 0.1 }], maxStacks: 4, duration: 30, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '每层变焦 登场角色声骸技能暴击伤害 +10%（按全队记）' });
      H.patchBuff((b) => b.kind === 'outro' && b.stats.some((x) => x.key === 'deep:echo'), { mode: echo ? 'auto' : 'off' }, '模块：按共鸣模态');
      if (!echo) H.buff({ id: 'oChafe', name: '蒙太奇·霜渐加深', stats: [{ key: 'deep:anomaly:chafe', value: 0.6 }], duration: 30, target: 'team', trigger: { on: 'outro' }, mode: 'auto', text: '延奏（霜渐模态）：目标受到霜渐伤害加深 60% 30 s' });
      B.patch(H, /遥远的晌午|酣睡的月光|过去悄然沉默|在如烟的时间里/, { mode: 'off' }, '模块处理', 'chain');
      if (ch >= 1) H.buff({ id: 'c1', name: '链1·暴击', stats: [{ key: 'critRate', value: 0.2 }], duration: 10, trigger: { on: 'act', keys: ['spot'] }, text: '链1' });
      if (ch >= 2) H.buff({ id: 'c2', name: '链2', stats: [echo ? { key: 'dmg:echo', value: 0.4 } : { key: 'deep:anomaly:chafe', value: 0.8 }], duration: 9999, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链2：追忆期间及之后 30 s' });
      if (ch >= 4) H.buff({ id: 'c4', name: '链4·攻击', stats: [{ key: 'atkPct', value: 0.1 }], maxStacks: 3, duration: 6, trigger: { on: 'manual' }, mode: 'module', text: '链4' });
      return K;
    },
    fillerKeys: ['b1', 'b2', 'b3'],
    init(api) { const s = api.H.opts.start || {}; return { st: 0, tst: 0, imp: s.imp || 0, photo: s.photo || 0, film: 0, filmUntil: null, recall: false, need: false, memo: 0, filmT: -9 }; },
    gainImp(api, n) { const cs = api.cs; cs.imp += n; while (cs.imp >= 50 && cs.photo < 3) { cs.imp -= 50; cs.photo++; } cs.imp = Math.min(cs.photo >= 3 ? 0 : 50, cs.imp); },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      if (cs.recall) {
        switch (btn) {
          case 'A': if (cs.need) return { act: K.let }; return { act: cs.tst === 0 ? K.t1 : cs.tst === 1 ? K.t2 : K.t3 };
          case 'E': case 'R': case 'H': return { blocked: '追忆中' };
          case 'I': return { act: K.I2 };
          default: return B.common(api, btn);
        }
      }
      switch (btn) {
        case 'A': return { act: K['b' + ((cs.st % 3) + 1)] };
        case 'H': return null;
        case 'E': return api.cdReady('E') ? { act: K.spot } : { blocked: '冷却中' };
        case 'R': return cs.photo >= 3 ? { act: K.R } : { blocked: '照片不足 3 张' };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const ch = api.H.chain, out = [];
      if (act.key === 'let') { let up = ch >= 3 ? 1 : 0; if (up) out.push({ key: 'multUp', value: up }); if (ch >= 6 && api.cs.memo) out.push({ key: 'dmg:all', value: 2 * api.cs.memo }); }
      if (act.key === 'obl' && ch >= 5) out.push({ key: 'multUp', value: 0.5 });
      if (act.key === 't3') { /* 时长随照片数（apply 中结算 遗忘） */ }
      return out;
    },
    chafe(api, n, t) { if (api.H.opts.mode !== 'echo' && n) api.addAnomaly('chafe', n, { t }); },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain, echo = api.H.opts.mode === 'echo', K = api.mem.modKit;
      if (/^b\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (n === 3) this.gainImp(api, 50); return; }
      switch (k) {
        case 'spot':
          this.gainImp(api, 50); api.addConcerto(api.mi, 20); this.chafe(api, 1, te);
          for (let j = 0; j < api.teamSize; j++) api.fireBuff('slow', j, { t: te });
          cs.st = 1; break;
        case 'I': this.gainImp(api, 100); this.chafe(api, 1, te); break;
        case 'I2': this.chafe(api, 1, te); cs.tst = 2; break;
        case 'R':
          cs.photo = 3; cs.recall = true; cs.tst = 0; cs.need = false; cs.memo = 0;
          api.fireBuff('rUp', api.mi, { t: te });
          if (echo) for (let j = 0; j < api.teamSize; j++) api.fireBuff('zoom', j, { t: te, stacks: 1 });
          else { cs.film = Math.min(10, cs.film + 4); cs.filmUntil = te + 30; }
          if (ch >= 2) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c2', j, { t: te });
          break;
        case 't1': cs.tst = 1; break;
        case 't2': cs.tst = 2; break;
        case 't3': {
          const n = cs.photo;
          for (let i = 0; i < n; i++) {
            const tt = api.t + 0.6 * (i + 1);
            api.deal(K.obl, { t: Math.min(te, tt), coordAttack: false }); this.chafe(api, 1, Math.min(te, tt));
            if (ch >= 4) api.fireBuff('c4', api.mi, { t: tt });
          }
          if (n) { if (echo) for (let j = 0; j < api.teamSize; j++) api.fireBuff('zoom', j, { t: te, stacks: n }); else { cs.film = Math.min(10, cs.film + 2 * n); cs.filmUntil = Math.max(cs.filmUntil || 0, te + 30); } }
          if (ch >= 6) cs.memo = Math.min(3, n);
          cs.photo = 0; cs.imp = 0; cs.need = true; break;
        }
        case 'let':
          api.addConcerto(api.mi, 20); cs.recall = false; cs.need = false; cs.tst = 0; cs.memo = 0; cs.st = 0;
          if (ch >= 2) for (let j = 0; j < api.teamSize; j++) api.fireBuff('c2', j, { t: te, duration: 30 });
          break;
        default: break;
      }
    },
    onTeam(api, ev) {
      if (ev.type !== 'anomaly' || ev.kind !== 'chafe' || ev.mi === api.mi) return;
      const cs = api.cs;
      if (cs.film > 0 && on(cs.filmUntil, ev.t) && ev.t - cs.filmT >= 0.5 - 1e-9) { cs.film--; cs.filmT = ev.t; api.addAnomaly('chafe', 2, { t: ev.t }); }
    },
    potential(api) { const cs = api.cs, K = api.mem.modKit; return (cs.photo / 3) * 0.4 * (api.est(K.let) + 3 * api.est(K.obl)); },
  });
});
