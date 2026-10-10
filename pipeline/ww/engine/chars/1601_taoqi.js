/*
 * 桃祈 (1601) character module — worker-B.
 *
 * 普攻 重器藏锋 (1000901): 普攻 4 段；重击 220.37%；「若长按普攻，则进入磐岩守势…磐岩守势持续3秒后，将会自动施放后发制人」78.7%（防御倍率）
 *   → 木桩不出手 → 后发制人需按住 3 秒：模块 frames.pp=null，时长 = 3 + 1.02（WuwaLAB Strategic Parry）（中，已标注）
 * 共鸣技能 固若金汤 (1000902): 134.92%（防御），生成 3 个【磐岩护壁】，冷却 15，协奏 15
 * 共鸣解放 不动如山 (1000903): 449.71%（防御），冷却 16，125 能量
 * 共鸣回路 攻防转换 (1000907):
 *   「拥有【刚柔化势】时，施放重击后发制人或变奏技能携攻守阵后一定时间内，短按普攻，可施放御反之隙…最多3段…消耗1点【刚柔化势】，同时获得护盾」
 *   「第4段普攻会消耗桃祈所有的【磐岩护壁】，并获得同等数量的【刚柔化势】」「磐岩护壁结束后，会消耗剩余的【磐岩护壁】，并获得等同数量的【刚柔化势】」
 *   → 木桩不攻击 → 护壁只经第 4 段普攻或结束时转换；护壁持续时间未公开 → 估计 15 秒（低）
 * 固有 护心：护壁持续期间防御 +15%（模块触发）；岿然（耐力）不建模
 * 变奏 携攻守阵: 208.76%
 * 延奏 千钧：下一位登场角色共鸣技能伤害加深 38%（解析）
 * 动作帧：WuwaLAB
 * 共鸣链：未建模
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const WALL_DUR = 15;
  return WW.registerChar({
    id: 1601, chainModeled: 0, name: '桃祈', version: '0.1', confidence: 'medium',
    notes: ['护壁持续 15 秒为估计（低）', '后发制人按住 3 秒触发（木桩）→ 时长 4.02 秒（中）', '护盾不建模', '共鸣链未建模'],
    audit: { role: 'support', finishers: ['fc3', 'lib'], window: 25, sig: null, alts: [21010044, 21010015, 21010024], solo: 'taoqi_solo.json', team: 'team_taoqi.json', teamMi: 1 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Concealed Edge'), B.stageFrames('fc', 3, '共鸣回路·Forte: Timed Counters'), {
      hv: '重击·Heavy: Concealed Edge', pp: null, sk: '共鸣技能·Skill: Fortified Defense', lib: '共鸣解放·Liberation: Unmovable',
      I: '变奏入场·Intro: Defense Formation', O: '延奏·Outro: Iron Will',
    }),
    resources: [
      { key: 'bw', name: '磐岩护壁', max: 3, segmented: true, confidence: 'high' },
      { key: 'gr', name: '刚柔化势', max: 3, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', durs: [0.48, 0.58, 1.23, 1.2] }),
        B.stages(H, { n: 3, prefix: 'fc', skill: 6, levelKey: 'forte', label: (k) => '御反之隙第' + B.CN[k - 1] + '段伤害', durs: [0.45, 0.55, 1.32] }), {
          hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击攻击伤害'], levelKey: 'basic', dur: 1.28, label: '重击' }),
          pp: H.act({ key: 'pp', cls: 'H', skill: 1, labels: ['后发制人伤害'], levelKey: 'basic', dur: 4.02, label: '重击·后发制人（磐岩守势 3 秒）' }),
          sk: H.act({ key: 'sk', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: 15, cdKey: 'E', dur: 0.92, label: '固若金汤' }),
          lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 16, cdKey: 'R', dur: 2.42, label: '不动如山' }),
          I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.73 }),
          O: B.outro(H, '千钧'),
        });
      for (const k of ['fc1', 'fc2', 'fc3']) K[k].cls = 'A';
      B.patch(H, /磐岩护壁持续期间/, { mode: 'module', trigger: { on: 'manual' } }, '模块：固若金汤生成护壁时触发，持续 15 秒（估计）', 'inherent');
      H._hx = H.findBuff((b) => b.kind === 'inherent' && /磐岩护壁持续期间/.test(b.text || '')).map((b) => b.id);
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init() { return { bw: 0, gr: 0, st: 0, fst: 0, fcOpen: false, wallUntil: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      this.expire(api);
      switch (btn) {
        case 'A':
          if ((cs.fcOpen || cs.fst > 0) && cs.gr >= 1) return { act: K['fc' + (cs.fst + 1)] };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: cs.gr >= 1 ? K.pp : K.hv };
        case 'E': return api.cdReady('E') ? { act: K.sk } : { blocked: '冷却中' };
        case 'R': return { act: K.lib };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    expire(api) {
      const cs = api.cs;
      if (cs.bw > 0 && cs.wallUntil != null && api.t >= cs.wallUntil) { cs.gr = Math.min(3, cs.gr + cs.bw); cs.bw = 0; cs.wallUntil = null; }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      this.expire(api);
      const open = cs.fcOpen; cs.fcOpen = false;
      if (/^fc\d$/.test(k)) { cs.gr -= 1; cs.fst = +k.slice(2) % 3; if (cs.fst && cs.gr >= 1) cs.fcOpen = true; else cs.fst = 0; return; }
      cs.fst = 0;
      if (/^a\d$/.test(k)) { cs.st = +k.slice(1) % 4; if (k === 'a4' && cs.bw) { cs.gr = Math.min(3, cs.gr + cs.bw); cs.bw = 0; cs.wallUntil = null; } return; }
      switch (k) {
        case 'pp': case 'I': cs.fcOpen = true; break;
        case 'sk':
          cs.bw = 3; cs.wallUntil = api.tEnd + WALL_DUR;
          for (const id of api.H._hx || []) api.fireBuff(id, api.mi, { duration: WALL_DUR });
          break;
        default: break;
      }
      void open;
    },
    // search heuristic (not a game rule): 护壁/刚柔化势→御反之隙
    potential(api) { const K = api.mem.modKit; return (api.cs.gr + 0.5 * api.cs.bw) / 3 * 0.5 * (api.est(K.fc1) + api.est(K.fc2) + api.est(K.fc3)); },
  });
});
