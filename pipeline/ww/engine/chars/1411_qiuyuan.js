/*
 * 仇远 (1411) character module — worker-B.
 *
 * 普攻 质黑相青 (1004101): 3 段普攻 + 重击 165.61%
 * 共鸣技能 穿林打叶 (1004102):「短按…造成气动伤害，此次伤害视为声骸技能伤害」冷却 14（长按 不辞远 未单列，同冷却，伤害相近）
 * 共鸣解放 万钧一断 (1004103): 795.24%（声骸技能伤害）;「仇远暴击高于50%时，每多出1%暴击…附近队伍中的登场角色提升2%暴击伤害，持续30秒。最高可提升30%暴击伤害」
 * 共鸣回路 裁竹为锋 (1004107):
 *   「【挑灯问剑】达到200点时，普攻替换为普攻答剑·质黑相青…最多四段…视为重击伤害」
 *   「【挑灯问剑】达到400点时，获得【竹照】…附近队伍中的登场角色声骸技能伤害加成提升30%，持续30秒」
 *   「【挑灯问剑】满时（600）…进入【淋漓醉墨】…持续8秒…长按普攻可消耗【挑灯问剑】依次施放 弦歌不辍、割股之心、忠烈死节…视为施放声骸技能…耗尽时提前退出…结束时清空」
 *   「普攻第三段 +100；答剑每段 +100；闪避反击 +100；变奏 +400；淋漓醉墨期间无法获得」
 *   → 三段答剑每段消耗量未公开：按 600/3 = 200 估计（中）
 * 固有 且从容:「进入【淋漓醉墨】…10秒，每22秒1次。目标受到 弦歌不辍、割股之心、忠烈死节 的伤害提升50%。忠烈死节命中额外回复30点协奏能量」（模块：伤害加深 50%）
 * 固有 与尔同销万古愁:「施放声骸技能时…【金药玉馔】。下次获得【挑灯问剑】时…攻击提升10%，持续20秒」（模块）
 * 变奏 攻其必救 (1004106): 重击伤害；+400 挑灯问剑；之后普攻为答剑第三段
 * 延奏 出其不趋 (1004109): 100% 声骸技能伤害；下一位登场角色声骸技能伤害加深 50% 14 秒（解析）
 * 共鸣链：1 暴击 +20%；4 攻击 +20%；5 无视防御 15%（模块）；2 竹照额外声骸伤害加深 30%（模块）；3/6 未建模（荷蓑出林、停滞）
 * 专武 裁竹 (21020066): 解竹（施放变奏/普攻后 10 秒内施放声骸技能 → 重击 +30%，2 层）—解析为 cast Q/A 触发；模块改为核心 echoCast 事件（B9）触发：自身 Q 声骸或模块 echoCast 动作
 * 队友事件：答剑·弦歌/割股/忠烈、共鸣技能、共鸣解放、延奏均标记 echoCast（西格莉卡 1412 用于 语义的祝福/日灵能量）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21020066;
  const DJ = ['xg', 'gg', 'zl'];
  return WW.registerChar({
    id: 1411, chainModeled: 5, name: '仇远', version: '0.1', confidence: 'medium',
    notes: ['淋漓醉墨三段答剑每段消耗 200 挑灯问剑（估计，中）', '共鸣技能长按（不辞远）未单列', '链3/链6 未建模', '重击后普攻→答剑第四段：原文未限定挑灯问剑≥200，按任意时刻处理（中）'],
    audit: { role: 'subdps', finishers: ['zl', 'lib'], window: 25, sig: SIG, alts: [21020015, 21020046, 21020064], solo: 'qiuyuan_solo.json', team: 'team_sigrika.json', teamMi: 1 },
    frames: Object.assign(B.stageFrames('a', 3, '普攻·Basic: Inkwash'), B.stageFrames('dj', 4, '普攻·Basic: Thus Spoke the Blade - Inkwash'), {
      hv: '重击·Heavy: Inkwash', xg: '重击·Heavy: Thus Spoke the Blade - To Teach', gg: '重击·Heavy: Thus Spoke the Blade - To Save', zl: '重击·Heavy: Thus Spoke the Blade - To Sacrifice',
      es: '共鸣技能·Skill: Through the Groves', lib: '共鸣解放·Liberation: Sundering Strike', I: '变奏入场·Intro: Attack the Must-Defend', O: '延奏·Outro: Strike Before Ready',
    }),
    resources: [
      { key: 'td', name: '挑灯问剑', max: 600, segmented: false, confidence: 'high' },
      { key: 'ldm', name: '淋漓醉墨', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.ldmUntil, t) ? 1 : 0) },
    ],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 3, prefix: 'a', durs: [0.32, 0.55, 1.07] }),
        B.stages(H, { n: 4, prefix: 'dj', skill: 6, levelKey: 'forte', label: (k) => '答剑·质黑相青第' + B.CN[k - 1] + '段伤害', durs: [0.65, 1.0, 0.75, 0.88] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.85, label: '重击' }),
          xg: H.act({ key: 'xg', cls: 'A', skill: 6, labels: ['答剑·弦歌不辍伤害'], levelKey: 'forte', dur: 1.65, label: '答剑·弦歌不辍', extra: { echoCast: true } }),
          gg: H.act({ key: 'gg', cls: 'A', skill: 6, labels: ['答剑·割股之心伤害'], levelKey: 'forte', dur: 0.95, label: '答剑·割股之心', extra: { echoCast: true } }),
          zl: H.act({ key: 'zl', cls: 'A', skill: 6, labels: ['答剑·忠烈死节伤害'], levelKey: 'forte', dur: 0.78, label: '答剑·忠烈死节', extra: { echoCast: true } }),
          es: H.act({ key: 'es', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 14, dur: 1.35, label: '穿林打叶', extra: { echoCast: true } }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 3.83, label: '万钧一断', extra: { echoCast: true } }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.23 }),
          O: B.outro(H, '出其不趋', { extra: { echoCast: true } }),
        });
      // 「答剑…视为重击伤害」: 数据已为 heavy；三段答剑视为施放声骸技能 → 武器 解竹 由模块在 apply 中 fireBuff
      if (H.weaponId === SIG) B.patch(H, /解竹/, { trigger: { on: 'manual' }, mode: 'manual' }, '模块：核心 echoCast 事件（自身声骸技能）在变奏/普攻后 10 秒内触发', 'weapon');
      H._jz = H.findBuff((b) => b.kind === 'weapon' && /解竹/.test((b.src || '') + '|' + (b.text || ''))).map((b) => b.id);
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3'],
    init(api) { const st = api.H.opts.start || {}; return { td: st.td || 0, ldmUntil: null, ldmI: 0, qcrUntil: null, qcrCd: 0, zzUntil: null, jy: false, jyUntil: null, st: 0, djN: 0, afterI: false, afterH: false, lastAI: -99, critAuraUntil: null, critAura: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      const ldm = on(cs.ldmUntil, t) && cs.td > 0;
      switch (btn) {
        case 'A':
          if (ldm) return { act: K[DJ[cs.ldmI % 3]] };
          if (cs.afterI) return { act: K.dj3 };
          if (cs.afterH) return { act: K.dj4 };   // 原文未限定答剑状态，按任意时刻生效处理（中）「施放（重击）后一定时间内，短按普攻将施放普攻答剑·质黑相青第四段」
          if (cs.td >= 200) return { act: K['dj' + ((cs.djN % 4) + 1)] };
          return { act: K['a' + ((cs.st % 3) + 1)] };
        case 'H': return ldm ? { act: K.gg } : { act: K.hv };
        case 'E': return api.cdReady('es') ? { act: K.es } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    actionStats(api, act) {
      const cs = api.cs, t = api.t, ch = api.H.chain, out = [];
      if (DJ.includes(act.key) && on(cs.qcrUntil, t)) out.push({ key: 'deep:all', value: 0.5 });
      if (on(cs.jyUntil, t)) out.push({ key: 'atkPct', value: 0.1 });
      if (ch >= 1) out.push({ key: 'critRate', value: 0.2 });
      if (ch >= 4) out.push({ key: 'atkPct', value: 0.2 });
      if (ch >= 5) out.push({ key: 'defIgnore', value: 0.15 });
      return out;
    },
    auras(api, target) {
      const cs = api.cs, t = api.t, out = [];
      if (api.s.active !== target) return out;
      if (on(cs.zzUntil, t)) { out.push({ key: 'dmg:echo', value: 0.3 }); if (api.H.chain >= 2) out.push({ key: 'deep:echo', value: 0.3 }); }
      if (on(cs.critAuraUntil, t) && cs.critAura > 0) out.push({ key: 'critDmg', value: cs.critAura });
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, t = api.t;
      const ldm = on(cs.ldmUntil, t);
      const gain = (n) => {
        if (on(cs.ldmUntil, te)) return;
        if (cs.jy) { cs.jy = false; cs.jyUntil = te + 20; }
        const before = cs.td; cs.td = Math.min(600, cs.td + n);
        if (before < 400 && cs.td >= 400) cs.zzUntil = te + 30;
        if (cs.td >= 600) { cs.ldmUntil = te + 8; cs.ldmI = 0; if (t >= cs.qcrCd - 1e-9) { cs.qcrUntil = te + 10; cs.qcrCd = t + 22; } }
      };
      if (k !== 'I') cs.afterI = false;
      cs.afterH = k === 'hv';
      if (/^a\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 3; if (n === 3) gain(100); }
      else if (/^dj\d$/.test(k)) { cs.djN = +k.slice(2) % 4; gain(100); }
      else if (DJ.includes(k)) {
        cs.td = Math.max(0, cs.td - 200); cs.ldmI++;
        if (k === 'zl' && on(cs.qcrUntil, t)) api.addConcerto(api.mi, 30);
        if (cs.td <= 0) { cs.ldmUntil = te; cs.td = 0; cs.qcrUntil = on(cs.qcrUntil, te) ? cs.qcrUntil : null; }
      }
      else switch (k) {
        case 'I': gain(400); cs.afterI = true; cs.lastAI = te; break;
        case 'lib': {
          const cr = api.livePanel().critRate;
          cs.critAura = Math.min(0.3, Math.max(0, cr - 0.5) * 2); cs.critAuraUntil = te + 30; break;
        }
        default: break;
      }
      if (/^a\d$|^dj\d$/.test(k)) cs.lastAI = te;
      if (ldm && !on(cs.ldmUntil, te)) cs.td = 0;
      if (act.echoCast) cs.jy = true;
      if (k === 'I') cs.lastAI = te;
    },
    // B9（核心 echoCast 事件）：自身施放声骸技能（Q 声骸或模块 echoCast 动作）时，变奏/普攻后 10 秒内 → 专武 解竹
    onTeam(api, ev) {
      if (ev.type !== 'echoCast' || ev.mi !== api.mi || api.H.weaponId !== SIG) return;
      const t = ev.tEnd != null ? ev.tEnd : (ev.t != null ? ev.t : api.t);
      if (t - api.cs.lastAI <= 10) for (const id of api.H._jz || []) api.fireBuff(id, api.mi, { duration: 12 });
    },
    swapOut(api) { const cs = api.cs; if (on(cs.ldmUntil, api.t)) { cs.ldmUntil = api.t; cs.td = 0; } cs.qcrUntil = null; },
    // search heuristic (not a game rule): 挑灯问剑 → 淋漓醉墨三段答剑
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      const fin = api.est(K.xg) + api.est(K.gg) + api.est(K.zl);
      if (on(cs.ldmUntil, api.t)) return cs.td / 600 * fin;
      return cs.td / 600 * 1.2 * fin;
    },
  });
});
