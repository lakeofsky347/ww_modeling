/*
 * 达妮娅 (1211) character module — stream A 批次 4。热熔 音感仪，副C/辅助（聚爆，熵变强化期间全队热熔 +30%）。
 *
 * 形态：布景之形（初始）/ 幻灭之形。共鸣模态只建模 聚爆（集谐 依赖偏谐，B4 未建模；`module.mode='concord'` 时只关掉聚爆部分）。
 * 布景之形：普攻 4 段 / 重击；拟态泡泡（冷却 20，+25 虚质粒子）；变奏 久疏问候！（+1 黯核、+25 虚质粒子）；
 *   共鸣解放 帷幕终景·布景之形（397.62%，125 能量，冷却 25）→ 熵变强化·幻灭之形 12 s（攻击 +30%），切到幻灭之形。
 * 幻灭之形：普攻 4 段（有【虚质粒子】时消耗：伤害改为共鸣解放伤害、倍率 +50%、共形能量获取 ×2）；重击；轻唤（冷却 4）；
 *   有【黯核】→ 放逐（第 1 段 34.68%×3，第 2 段 112.01% × (1 + 1.5×黯核)，共鸣解放伤害，+40 共形能量；与轻唤共享冷却 4）；变奏 轻叩门扉（熵变强化·幻灭 12 s）；
 *   【共形能量】满 → 帷幕终景·幻灭之形（198.81%×4，消耗共形能量与虚质粒子）→ 熵变强化·布景 30 s（每秒 +1 虚质粒子）+ 蚀域 30 s（每 4 s 136.33%，共鸣解放伤害），切回布景之形。
 * 黯核：熵变强化期间每 12 s +1，变奏 +1，上限 3。固有 伪物弥留：开局（布景之形进入战斗）黯核 2、虚质粒子 20。
 * 获取量数据未给出 → 估计：布景普攻 虚质粒子 5/6/8/10；幻灭普攻 共形能量 6/8/10/12（虚质粒子 ×2）、轻唤 10；幻灭普攻每段消耗 虚质粒子 10（低）。
 * 固有 蚀刻繁彩（聚爆）：熵变强化期间 全队热熔 +30%（模块）。聚爆：变奏/解放/蚀域 2 层，布景/幻灭 第 3、4 段 1 层，同一技能 2 s 内 1 次。
 * 延奏 未竟的谎言（聚爆）：目标受到聚爆伤害加深 60% 30 s（通用解析）；集谐部分关闭。
 * 链：1 暴击伤害 +30%（解析）；2 放逐倍率 +40%，施加聚爆后 热熔 +50% 15 s（只算达妮娅自身）；3–6 未建模 → chainModeled 2。
 * 动作帧：WuwaLAB（Denia）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21050076; // 赝作的矮星
  const VP = { s1: 5, s2: 6, s3: 8, s4: 10 }, CE = { b1: 6, b2: 8, b3: 10, b4: 12, beckon: 10 };
  const burstStacks = { I: 2, I2: 2, lib1: 2, lib2: 2, field: 2, s3: 1, s4: 1, b3: 1, b4: 1 };
  return WW.registerChar({
    id: 1211, chainModeled: 2, name: '达妮娅', version: '0.1', confidence: 'low',
    notes: ['虚质粒子/共形能量 获取与消耗为估计（低）', '只建模共鸣模态·聚爆；集谐/偏谐（B4）未建模', '链 3–6 未建模', '空中攻击、闪避反击不建模'],
    audit: { role: 'subdps', finishers: ['lib1', 'lib2', 'ban2'], window: 25, sig: SIG, alts: [21050036, 21050016, 21050046], solo: 'denia_solo.json', team: 'team_denia.json', teamMi: 1,
      anomaly: ['burst'] },
    frames: Object.assign(B.stageFrames('s', 4, '普攻·Basic: Stagecraft Form Stage'), B.stageFrames('b', 4, '普攻·Forte: Breakdown Form Stage'), {
      sh: '重击·Heavy: Stagecraft Form', bh: '重击·Heavy: Breakdown Form', bubble: '共鸣技能·Skill 1: Phantom Bubble', beckon: '共鸣技能·Skill 2: Beckon',
      ban1: '共鸣技能·Skill 3: Banish - Stage 1', ban2: '共鸣技能·Skill 3: Banish - Stage 2',
      lib1: '共鸣解放·Liberation: Final Act - Stagecraft Form', lib2: '共鸣解放·Liberation: Final Act - Breakdown Form',
      I: "变奏入场·Intro: It's Been A While!", I2: '变奏入场·Intro 2: Knock Knock', field: null,
    }),
    resources: [
      { key: 'form', name: '幻灭之形', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.form === 'break' ? 1 : 0) },
      { key: 'core', name: '黯核', max: 3, segmented: true, confidence: 'high' },
      { key: 'vp', name: '虚质粒子', max: 100, segmented: false, confidence: 'low' },
      { key: 'ce', name: '共形能量', max: 100, segmented: false, confidence: 'low' },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const asLib = (a, k, mult) => Object.assign({}, a, { key: k, label: a.label + '（虚质粒子：解放伤害 +50%）', hits: a.hits.map((h) => Object.assign({}, h, { type: 'liberation' })), scale: { '*': mult } });
      const K = Object.assign(B.stages(H, { n: 4, prefix: 's', pre: '普攻·布景之形', durs: [0.27, 0.55, 0.63, 0.95] }),
        B.stages(H, { n: 4, prefix: 'b', pre: '普攻·幻灭之形', durs: [0.35, 0.87, 0.6, 1.05] }), {
          sh: H.act({ key: 'sh', cls: 'H', skill: 1, labels: ['重击·布景之形伤害'], levelKey: 'basic', dur: 1.57, label: '重击·布景之形' }),
          bh: H.act({ key: 'bh', cls: 'H', skill: 1, labels: ['重击·幻灭之形伤害'], levelKey: 'basic', dur: 1.23, label: '重击·幻灭之形' }),
          bubble: H.act({ key: 'bubble', cls: 'E', skill: 2, labels: ['拟态泡泡·布景之形伤害'], levelKey: 'skill', cooldown: 20, cdKey: 'bubble', dur: 1.07, label: '拟态泡泡' }),
          beckon: H.act({ key: 'beckon', cls: 'E', skill: 2, labels: ['轻唤·幻灭之形伤害'], levelKey: 'skill', cooldown: 4, cdKey: 'ban', dur: 1.0, label: '轻唤' }),
          ban1: H.act({ key: 'ban1', cls: 'E', skill: 2, labels: ['放逐·幻灭之形第一段伤害'], levelKey: 'skill', cooldown: 4, cdKey: 'ban', dur: 0.95, label: '放逐·第1段' }),
          ban2: H.act({ key: 'ban2', cls: 'E', skill: 2, labels: ['放逐·幻灭之形第二段伤害'], levelKey: 'skill', dur: 1.18, label: '放逐·第2段' }),
          lib1: H.act(Object.assign({ key: 'lib1', cls: 'R', skill: 3, labels: ['帷幕终景·布景之形伤害'], levelKey: 'liberation', concertoParam: '帷幕终景·布景之形回复协奏能量', cost: lc, cooldown: 25, cdKey: 'R', dur: 4.32, label: '帷幕终景·布景之形' })),
          lib2: H.act({ key: 'lib2', cls: 'R', skill: 3, labels: ['帷幕终景·幻灭之形伤害'], levelKey: 'liberation', concertoParam: '帷幕终景·幻灭之形回复协奏能量', cooldown: 25, cdKey: 'R2', dur: 2.85, label: '帷幕终景·幻灭之形' }),
          field: H.act({ key: 'field', cls: 'R', skill: 6, labels: ['蚀域每次伤害'], levelKey: 'forte', label: '蚀域' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['久疏问候！伤害'], levelKey: 'intro', concertoParam: '久疏问候！回复协奏能量', dur: 0.88, label: '久疏问候！' }),
          I2: H.act({ key: 'I2', cls: 'I', skill: 5, labels: ['轻叩门扉伤害'], levelKey: 'intro', concertoParam: '轻叩门扉回复协奏能量', dur: 1.35, label: '轻叩门扉' }),
          O: B.outro(H, '未竟的谎言'),
        });
      for (let k = 1; k <= 4; k++) K['bv' + k] = asLib(K['b' + k], 'bv' + k, 1.5);
      H.buff({ id: 'entB', name: '熵变强化·幻灭之形', stats: [{ key: 'atkPct', value: 0.3 }], duration: 12, trigger: { on: 'manual' }, mode: 'module', text: '熵变强化·幻灭之形：攻击提升30%' });
      H.buff({ id: 'etch', name: '蚀刻繁彩·全队热熔', stats: [{ key: 'dmg:fusion', value: 0.3 }], duration: 12, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '处于熵变强化时（聚爆）队伍中的角色热熔伤害加成提升30%' });
      if (ch >= 2) H.buff({ id: 'c2', name: '链2·热熔', stats: [{ key: 'dmg:fusion', value: 0.5 }], duration: 15, trigger: { on: 'manual' }, mode: 'module', text: '链2（聚爆）：施加聚爆后 热熔 +50% 15 s（只算达妮娅自身）' });
      if (H.weaponId === SIG) {
        const r = Math.max(1, Math.min(5, H.weaponRank || 1));
        H.patchBuff((b) => b.kind === 'weapon' && /聚爆|集谐/.test(b.text || ''), { mode: 'off' }, '模块：附加聚爆后触发');
        H.buff({ id: 'wLib', name: '赝作的矮星·解放伤害', stats: [{ key: 'dmg:liberation', value: [0.36, 0.45, 0.54, 0.63, 0.72][r - 1] }], duration: 5, trigger: { on: 'manual' }, mode: 'module', text: '附加聚爆效应后，共鸣解放伤害加成提升，持续5秒' });
        H.buff({ id: 'wAtk', name: '赝作的矮星·攻击', stats: [{ key: 'atkPct', value: [0.24, 0.3, 0.36, 0.42, 0.48][r - 1] }], duration: 15, trigger: { on: 'manual' }, mode: 'module', text: '该效果生效期间，附加聚爆效应的角色攻击提升，持续15秒（只算达妮娅自身）' });
      }
      B.patch(H, /蚀刻繁彩|伪物弥留/, { mode: 'off' }, '模块处理', 'inherent');
      B.patch(H, /熵变强化/, { mode: 'off' }, '模块处理', 'skill');
      H.patchBuff((b) => b.kind === 'outro' && b.stats.some((x) => /^deep:all/.test(x.key)), { mode: 'off' }, '集谐模态的延奏（偏谐，未建模）');
      B.patch(H, /坠入此世一片潮水|黑夜与风中|从远方|若能以谎言|祝愿你于静默中/, { mode: 'off' }, '模块处理 / 未建模', 'chain');
      return K;
    },
    fillerKeys: ['s1', 's2', 's3', 's4'],
    init(api) { const st = api.H.opts.start || {}; return { form: 'stage', core: 2, vp: st.vp != null ? st.vp : 20, ce: st.ce || 0, st: 0, bst: 0, entB: null, entS: null, entT: 0, coreT: 0, field: null, fieldNext: null, ban2: false, icd: {} }; },
    tick(api, t) {
      const cs = api.cs, ch = api.H.chain;
      // 熵变强化·布景：每秒 +1 虚质粒子；熵变强化期间每 12 s +1 黯核
      if (on(cs.entS, cs.entT)) { const dt = Math.max(0, Math.min(t, cs.entS) - cs.entT); cs.vp = Math.min(100, cs.vp + dt * (ch >= 3 ? 4 : 1)); }
      const entOn = (x) => on(cs.entS, x) || on(cs.entB, x);
      if (entOn(cs.entT)) { cs.coreT += Math.max(0, Math.min(t, Math.max(cs.entS || 0, cs.entB || 0)) - cs.entT); while (cs.coreT >= 12) { cs.coreT -= 12; cs.core = Math.min(3, cs.core + 1); } }
      cs.entT = t;
      // 蚀域
      while (cs.field != null && cs.fieldNext != null && cs.fieldNext <= Math.min(t, cs.field) + 1e-9) {
        api.deal(api.mem.modKit.field, { t: cs.fieldNext, coordAttack: false }); this.burst(api, 'field', 2, cs.fieldNext); cs.fieldNext += api.H.chain >= 4 ? 3 : 4;
      }
    },
    burst(api, key, n, t) {
      if (api.H.opts.mode === 'concord') return;
      const cs = api.cs; if (cs.icd[key] != null && t - cs.icd[key] < 2) return;
      cs.icd[key] = t; api.addAnomaly('burst', n, { t });
      if (api.H.chain >= 2) api.fireBuff('c2', api.mi, { t });
      if (api.H.weaponId === SIG) { api.fireBuff('wLib', api.mi, { t }); api.fireBuff('wAtk', api.mi, { t }); }
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, brk = cs.form === 'break';
      this.tick(api, api.t);
      switch (btn) {
        case 'A':
          if (cs.ban2) return { act: K.ban2 };
          if (brk) { const k = (cs.bst % 4) + 1; return { act: cs.vp > 0 ? K['bv' + k] : K['b' + k] }; }
          return { act: K['s' + ((cs.st % 4) + 1)] };
        case 'H': return { act: brk ? K.bh : K.sh };
        case 'E':
          if (cs.ban2) return { act: K.ban2 };
          if (brk) { if (!api.cdReady('ban')) return { blocked: '冷却中' }; return { act: cs.core > 0 ? K.ban1 : K.beckon }; }
          return api.cdReady('bubble') ? { act: K.bubble } : { blocked: '冷却中' };
        case 'R':
          if (brk) return cs.ce >= 100 - 1e-9 ? { act: K.lib2 } : { blocked: '共形能量未满' };
          return { act: K.lib1 };
        case 'I': return { act: brk ? K.I2 : K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      if (act.key === 'ban2') return [{ key: 'multUp', value: 1.5 * api.cs.core + (api.H.chain >= 2 ? 0.4 : 0) }];
      return [];
    },
    entB(api, te) { const cs = api.cs; cs.entB = te + 12; cs.entS = null; api.fireBuff('entB', api.mi, { t: te, duration: 12 }); for (let j = 0; j < api.teamSize; j++) api.fireBuff('etch', j, { t: te, duration: 12 }); },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd;
      this.tick(api, te);
      if (burstStacks[k] || burstStacks[k.replace(/^bv/, 'b')]) this.burst(api, k.replace(/^bv/, 'b'), burstStacks[k] || burstStacks[k.replace(/^bv/, 'b')], te);
      if (/^s\d$/.test(k)) { cs.st = +k.slice(1) % 4; cs.vp = Math.min(100, cs.vp + VP[k]); return; }
      if (/^b\d$/.test(k) || /^bv\d$/.test(k)) {
        const base = 'b' + k.slice(-1); cs.bst = +k.slice(-1) % 4;
        const enh = k.startsWith('bv');
        if (enh) cs.vp = Math.max(0, cs.vp - 10);
        cs.ce = Math.min(100, cs.ce + CE[base] * (enh ? 2 : 1));
        return;
      }
      cs.st = 0; cs.bst = 0;
      switch (k) {
        case 'bubble': cs.vp = Math.min(100, cs.vp + 25); break;
        case 'beckon': cs.ce = Math.min(100, cs.ce + CE.beckon); break;
        case 'ban1': cs.ban2 = true; break;
        case 'ban2': cs.ban2 = false; cs.core = 0; cs.ce = Math.min(100, cs.ce + 40); break;
        case 'I': cs.core = Math.min(3, cs.core + 1); cs.vp = Math.min(100, cs.vp + 25); break;
        case 'I2': cs.core = Math.min(3, cs.core + 1); cs.vp = Math.min(100, cs.vp + 25); this.entB(api, te); break;
        case 'lib1': this.entB(api, te); cs.form = 'break'; cs.bst = 0; break;
        case 'lib2':
          cs.ce = 0; cs.vp = 0; cs.form = 'stage'; cs.st = 0; cs.entB = null; cs.entS = te + 30; cs.entT = te;
          for (let j = 0; j < api.teamSize; j++) api.fireBuff('etch', j, { t: te, duration: 30 });
          api.endBuff('entB', api.mi);
          cs.field = te + 30; cs.fieldNext = te + (api.H.chain >= 4 ? 3 : 4);
          break;
        default: break;
      }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.4 * (cs.ce / 100) * api.est(K.lib2) + 0.2 * cs.core * api.est(K.ban2) + (cs.field != null && on(cs.field, api.t) ? 0.5 * Math.max(0, (Math.min(cs.field, api.duration) - api.t) / 4) * api.est(K.field) : 0);
    },
  });
});
