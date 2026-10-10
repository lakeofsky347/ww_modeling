/*
 * 露帕 (1207) character module — stream A 批次 4。热熔 长刃，副C/辅助（追猎/荣光 全队增益，延奏 热熔 +20% / 普攻 +25% 加深）。
 *
 * 普攻 燃星 (1003601)：普攻 4 段；重击；【狼焰】≥50 时重击→狼咬（耗 50 得 1 狼魂）；狼焰≥50 且有 1 狼魂→锐爪（耗 50 得 1 狼魂）。
 *   空中攻击/焰袭/下落/星灭 不建模（地面循环；焰袭与锐爪同为“耗 50 得 1 魂”，用锐爪代表）。
 * 共鸣技能 围猎 (1003602)：+15 狼焰、标记 8 s，之后一定时间内可放 凶噬（+15 狼焰，对标记目标倍率 +50%）。冷却 12。凶噬窗口按 5 s（引擎假设）。
 * 共鸣解放 荣光欢酣于火 (1003603)：清除狼魂、狼焰回满 100，之后短按普攻/技能放 破敌（耗尽狼焰，进入赛点沸腾 12 s：常态攻击获取狼焰效率 +500%，不可放围猎/凶噬）。
 *   35 s 追猎（全队）：攻击 +6%（每次登场角色变奏 +6%，上限 18%），对怒涛/海啸级 热熔加成 +10%（3 名热熔 +10%）；木桩按 Boss 级目标计（中）。
 *   追猎达上限后进入追杀，下一次变奏→你无法逃离！（共鸣解放伤害，清除追猎/荣光）。
 * 固有 荣光：35 s 全队 无视热熔抗性 3% + 每名其他热熔角色 3%（上限 9%）+ 3 名热熔额外 6%（通用解析把它判成未识别触发 → 模块处理）。
 * 回路 焰狼宣告：燃旗（凶噬/狼咬/锐爪/焰袭/解放/狼舞期间 攻击 +12% 8 s）；狼魂 2 点→狼舞的决意（共鸣解放伤害），赛点沸腾中→狼舞的决意·极（并结束沸腾）。
 *   狼魂持续 10 s，到期每点返还 50 狼焰。狼舞后 8 s 内切人，队友放共鸣解放时协助攻击 1 次（此刻，让火焰延燃赛场，共鸣技能伤害）。
 * 【狼焰】常态攻击获取量数据未给出 → 估计 普攻 6/6/8/10、重击 6（低）；赛点沸腾 ×6。
 * 链：1 解放后暴击 +20% 10 s、+10 协奏；2 解放/狼咬/锐爪 全队热熔 +20% 30 s ×2；3 你无法逃离 ×2、荣光改为 15%、追猎额外效果不需 3 热熔；
 *     4 狼舞·极 ×2.25；5 变奏后 解放伤害 +15% 10 s；6 狼舞·极/解放/你无法逃离 无视 30% 防御。chainModeled 6。
 * 动作帧：WuwaLAB（Lupa）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const SIG = 21010036;
  const LF = { a1: 6, a2: 6, a3: 8, a4: 10, hv: 6 };
  return WW.registerChar({
    id: 1207, chainModeled: 6, name: '露帕', version: '0.1', confidence: 'medium',
    notes: ['【狼焰】常态攻击获取量为估计（低）；赛点沸腾 ×6', '空中攻击/焰袭/星灭不建模（地面循环）', '凶噬窗口 5 s（引擎假设）',
      '追猎的怒涛/海啸级条件按 Boss 目标常开（中）', '追杀→你无法逃离！需要追猎叠到 18%（解放后两次登场变奏）'],
    audit: { role: 'subdps', finishers: ['dance', 'climax', 'lib', 'pd'], window: 25, sig: SIG, alts: [21010016, 21010015, 21010045], solo: 'lupa_solo.json', team: 'team_lupa.json', teamMi: 1 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Flaming Star'), {
      hv: '重击·Heavy: Flaming Star', bite: "重击·Heavy: Flaming Star Wolf's Gnawing", claw: "重击·Heavy: Flaming Star Wolf's Claw",
      E: "共鸣技能·Skill 1: Shewolf's Hunt", E2: '共鸣技能·Skill 2: Feral Fang', pd: '共鸣技能·Skill 3: Foebreaker',
      dance: '共鸣技能·Skill 4: Dance With the Wolf', climax: '共鸣技能·Skill 4: Dance With the Wolf - Climax',
      lib: '共鸣解放·Liberation: Fire-Kissed Glory', I: '变奏入场·Intro: Try Focusing Eh?', I2: '变奏入场·Intro 2: Nowhere to Run!',
    }),
    resources: [
      { key: 'lf', name: '狼焰', max: 100, segmented: false, confidence: 'low', basis: '上限 100；常态攻击获取量估计' },
      { key: 'ls', name: '狼魂', max: 2, segmented: true, confidence: 'high', basis: '10 s，到期每点返还 50 狼焰' },
      { key: 'boil', name: '赛点沸腾', max: 1, segmented: true, confidence: 'high', get: (cs, t) => (on(cs.boil, t) ? 1 : 0) },
      { key: 'hunt', name: '追猎攻击', max: 3, segmented: true, confidence: 'medium', get: (cs, t) => (on(cs.huntUntil, t) ? cs.hunt : 0) },
    ],
    kit(H) {
      const ch = H.chain, lc = H.R.energy.liberationCost;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.7, 0.53, 1.12, 1.48] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 0.85, label: '重击' }),
        bite: H.act({ key: 'bite', cls: 'H', skill: 1, labels: ['重击·狼咬伤害'], levelKey: 'basic', dur: 0.83, label: '重击·狼咬' }),
        claw: H.act({ key: 'claw', cls: 'H', skill: 1, labels: ['重击·锐爪伤害'], levelKey: 'basic', dur: 1.6, label: '重击·锐爪' }),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', cooldown: 12, cdKey: 'E', dur: 0.93, label: '围猎' }),
        E2: H.act({ key: 'E2', cls: 'E', skill: 2, labels: ['凶噬伤害'], levelKey: 'skill', dur: 1.05, label: '凶噬（标记 +50%）', scale: { '*': 1.5 } }),
        pd: H.act({ key: 'pd', cls: 'E', skill: 3, labels: ['破敌伤害'], levelKey: 'liberation', dur: 0.97, label: '破敌' }),
        dance: H.act({ key: 'dance', cls: 'E', skill: 6, labels: ['狼舞的决意伤害'], levelKey: 'forte', dur: 2.52, label: '狼舞的决意' }),
        climax: H.act(Object.assign({ key: 'climax', cls: 'E', skill: 6, labels: ['狼舞的决意·极伤害'], levelKey: 'forte', dur: 2.52, label: '狼舞的决意·极' },
          ch >= 4 ? { scale: { '*': 2.25 }, inferred: '链4：倍率 +125%' } : {})),
        arena: H.act({ key: 'arena', cls: 'E', skill: 6, labels: ['此刻，让火焰延燃赛场伤害'], levelKey: 'forte', label: '此刻，让火焰延燃赛场（协助）' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: lc, cooldown: 20, cdKey: 'R', dur: 3.67, label: '荣光欢酣于火' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.17, label: '你在看哪里？' }),
        I2: H.act(Object.assign({ key: 'I2', cls: 'I', skill: 5, labels: ['你无法逃离！伤害'], levelKey: 'intro', concertoParam: '你无法逃离！回复协奏能量', dur: 2.5, label: '你无法逃离！' },
          ch >= 3 ? { scale: { '*': 2 }, inferred: '链3：倍率 +100%' } : {})),
        O: B.outro(H, '搭档啊，与我并肩'),
      });
      // 共鸣解放伤害（狼舞/你无法逃离）：伤害类型由命中行给出（liberation）
      H.buff({ id: 'flag', name: '燃旗·攻击', stats: [{ key: 'atkPct', value: 0.12 }], duration: 8, trigger: { on: 'act', keys: ['E2', 'bite', 'claw', 'lib', 'dance', 'climax'] },
        text: '燃旗：施放凶噬/狼咬/锐爪/焰袭/解放/狼舞期间 攻击提升12%，持续8秒', confidence: 'high' });
      H.buff({ id: 'huntAtk', name: '追猎·攻击', stats: [{ key: 'atkPct', value: 0.06 }], maxStacks: 3, duration: 35, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '追猎：攻击提升6%（变奏 +6%，上限18%）' });
      H.buff({ id: 'huntFu', name: '追猎·热熔加成', stats: [{ key: 'dmg:fusion', value: 0.1 }], maxStacks: 2, duration: 35, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '追猎：攻击怒涛/海啸级目标时热熔伤害加成提升10%（3 热熔 +10%）' });
      H.buff({ id: 'glory', name: '荣光·无视热熔抗性', stats: [{ key: 'resPen:fusion', value: 0.03 }], maxStacks: 5, duration: 35, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '荣光：无视热熔抗性 3%/层（链3：15%）' });
      if (ch >= 1) H.buff({ id: 'c1', name: '链1·暴击', stats: [{ key: 'critRate', value: 0.2 }], duration: 10, trigger: { on: 'act', keys: ['lib'] }, text: '链1：解放后暴击提升20%，持续10秒' });
      if (ch >= 2) H.buff({ id: 'c2', name: '链2·全队热熔', stats: [{ key: 'dmg:fusion', value: 0.2 }], maxStacks: 2, duration: 30, target: 'team', trigger: { on: 'manual' }, mode: 'module', text: '链2' });
      if (ch >= 5) H.buff({ id: 'c5', name: '链5·解放伤害', stats: [{ key: 'dmg:liberation', value: 0.15 }], duration: 10, trigger: { on: 'act', keys: ['I', 'I2'] }, text: '链5' });
      B.patch(H, /荣光|追猎/, { mode: 'off' }, '模块：荣光/追猎由模块按队伍热熔人数处理', 'inherent');
      // 专武 焰痕：重击延长解放增伤 4 秒（1 次），延长成功时全队热熔 +24% 30 秒（解析为 manual → 模块触发）
      if (H.weaponId === SIG) {
        H.mem._wf1 = (H.findBuff((b) => b.kind === 'weapon' && b.stats.some((x) => x.key === 'dmg:liberation'))[0] || {}).id;
        H.mem._wf2 = (H.findBuff((b) => b.kind === 'weapon' && /成功延长效果时/.test(b.text || ''))[0] || {}).id;
        if (H.mem._wf2) H.patchBuff((b) => b.id === H.mem._wf2, { target: 'team', mode: 'module' }, '模块：焰痕 延长成功时触发（全队）');
      }
      B.patch(H, /追猎|荣光/, { mode: 'off' }, '模块处理', 'skill');
      B.patch(H, /看那无名之人|所处皆为猎场|胜利让掌声喝彩/, { mode: 'off' }, '模块处理', 'chain');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { lf: st.lf || 0, ls: 0, lsUntil: null, st: 0, e2Until: null, pdUntil: null, boil: null, hunt: 0, huntUntil: null, chase: false, chaseUsed: false, arenaUntil: null, arenaDone: false }; },
    expire(api) {
      const cs = api.cs;
      if (cs.ls > 0 && cs.lsUntil != null && api.t >= cs.lsUntil) { cs.lf = Math.min(100, cs.lf + 50 * cs.ls); cs.ls = 0; cs.lsUntil = null; }
      if (cs.huntUntil != null && api.t >= cs.huntUntil) { cs.hunt = 0; cs.huntUntil = null; cs.chase = false; }
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, t = api.t;
      this.expire(api);
      switch (btn) {
        case 'A': if (on(cs.pdUntil, t)) return { act: K.pd }; return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': if (cs.lf >= 50 - 1e-9) return { act: cs.ls >= 1 ? K.claw : K.bite }; return { act: K.hv };
        case 'E':
          if (on(cs.pdUntil, t)) return { act: K.pd };
          if (cs.ls >= 2) return { act: on(cs.boil, t) ? K.climax : K.dance };
          if (on(cs.boil, t)) return { blocked: '赛点沸腾中不可施放围猎/凶噬' };
          if (on(cs.e2Until, t)) return { act: K.E2 };
          return api.cdReady('E') ? { act: K.E } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: cs.chase && !cs.chaseUsed && on(cs.huntUntil, t) ? K.I2 : K.I };
        default: return B.common(api, btn);
      }
    },
    teamFusion(api) { let n = 0; for (let j = 0; j < api.teamSize; j++) if (api.memberDef(j).el === 'fusion') n++; return n; },
    fireTeam(api, id, o) { for (let j = 0; j < api.teamSize; j++) api.fireBuff(id, j, Object.assign({ t: api.tEnd }, o || {})); },
    apply(api, act) {
      const cs = api.cs, k = act.key, te = api.tEnd, ch = api.H.chain;
      this.expire(api);
      const gain = (v) => { cs.lf = Math.min(100, cs.lf + v * (on(cs.boil, api.t) ? 6 : 1)); };
      const soul = () => { cs.lf = Math.max(0, cs.lf - 50); cs.ls = Math.min(2, cs.ls + 1); cs.lsUntil = te + 10; if (ch >= 2) this.fireTeam(api, 'c2', { stacks: undefined }); };
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; gain(LF[k]); if (cs.pdUntil) cs.pdUntil = null; return; }
      cs.st = 0;
      if (api.H.weaponId === SIG) {
        if (k === 'I' || k === 'I2' || k === 'lib') { cs.wfUntil = api.t + 6; cs.wfExt = false; }
        else if ((k === 'hv' || k === 'bite' || k === 'claw') && !cs.wfExt && on(cs.wfUntil, api.t)) {
          cs.wfExt = true; cs.wfUntil += 4;
          if (api.mem._wf1) api.fireBuff(api.mem._wf1, api.mi, { t: api.t, duration: cs.wfUntil - api.t });
          if (api.mem._wf2) this.fireTeam(api, api.mem._wf2, { t: api.t, duration: 30 });
        }
      }
      switch (k) {
        case 'hv': gain(LF.hv); break;
        case 'bite': case 'claw': soul(); break;
        case 'E': cs.lf = Math.min(100, cs.lf + 15); cs.e2Until = te + 5; break;
        case 'E2': cs.lf = Math.min(100, cs.lf + 15); cs.e2Until = null; break;
        case 'dance': case 'climax':
          cs.ls = 0; cs.lsUntil = null; cs.arenaUntil = te + 8; cs.arenaDone = false;
          if (k === 'climax') cs.boil = null;
          break;
        case 'pd': cs.lf = 0; cs.pdUntil = null; cs.boil = te + 12; break;
        case 'lib': {
          cs.ls = 0; cs.lsUntil = null; cs.lf = 100; cs.pdUntil = te + 3; cs.e2Until = null;
          const nf = this.teamFusion(api), n3 = nf >= 3 || ch >= 3;
          cs.hunt = 1; cs.huntUntil = te + 35; cs.chase = false; cs.chaseUsed = false;
          this.fireTeam(api, 'huntAtk', { stacks: 1, duration: 35 });
          this.fireTeam(api, 'huntFu', { stacks: n3 ? 2 : 1, duration: 35 });
          const pen = ch >= 3 ? 5 : Math.min(3, 1 + (nf - 1)) + (nf >= 3 ? 2 : 0);
          this.fireTeam(api, 'glory', { stacks: pen, duration: 35 });
          if (ch >= 1) api.addConcerto(api.mi, 10);
          if (ch >= 2) this.fireTeam(api, 'c2');
          break;
        }
        case 'I2':
          cs.chaseUsed = true; cs.chase = false; cs.hunt = 0; cs.huntUntil = null;
          for (const id of ['huntAtk', 'huntFu', 'glory']) for (let j = 0; j < api.teamSize; j++) api.endBuff(id, j);
          break;
        default: break;
      }
    },
    onTeam(api, ev) {
      const cs = api.cs;
      // 追猎：登场角色施放变奏 → 攻击 +6%（上限 18%）；达上限 → 追杀
      if (ev.type === 'intro' && on(cs.huntUntil, ev.t) && cs.hunt < 3) {
        cs.hunt++; for (let j = 0; j < api.teamSize; j++) api.fireBuff('huntAtk', j, { stacks: cs.hunt, duration: Math.max(0.1, cs.huntUntil - ev.t), t: ev.t });
        if (cs.hunt >= 3 && !cs.chaseUsed) cs.chase = true;
      }
      // 此刻，让火焰延燃赛场：狼舞后 8 s 内已切出，队友施放共鸣解放时协助 1 次
      if (ev.type === 'damage' && ev.mi !== api.mi && !api.onField && ev.act && ev.act.cls === 'R' && !ev.coord && !cs.arenaDone && on(cs.arenaUntil, ev.t)) {
        cs.arenaDone = true; api.deal(api.mem.modKit.arena, { t: ev.t });
      }
    },
    actionStats(api, act) {
      const out = [];
      if (api.H.chain >= 6 && /^(climax|lib|I2)$/.test(act.key)) out.push({ key: 'defIgnore', value: 0.3 });
      return out;
    },
    hold(api, act, rem) {
      // 赛点沸腾中攒满 2 魂再放 狼舞·极（search only）
      if (act.key === 'dance' && on(api.cs.boil, api.t) === false && api.cs.pdUntil) return '先放破敌';
      return null;
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return 0.5 * (cs.lf / 100) * api.est(K.bite) + 0.5 * (cs.ls / 2) * api.est(on(cs.boil, api.t) ? K.climax : K.dance) + (on(cs.pdUntil, api.t) ? 0.8 * api.est(K.pd) : 0);
    },
  });
});
