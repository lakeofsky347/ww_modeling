/*
 * 散华 (1102) character module. 冷凝 迅刀，速切副C/辅助（延奏 下一位普攻伤害加深 38%）。
 *
 * 共鸣回路 无明心音 (1000507):
 *   「按住普攻时，指针将会移动，若指针在【冰痕】区域时松开普攻，散华将施放重击爆裂…此次伤害为重击伤害。」
 *   「重击爆裂会引爆攻击范围内的【冰棘】、【冰棱】和【冰川】…冰绽造成的伤害为共鸣技能伤害。」
 *   「每拥有1层【透视】都会扩大【冰痕】区域，最多可拥有2层…第5段普攻/变奏/朔雪永冻 +1，焦瞑冻土 +2，重击爆裂移除所有【透视】」；透视/冰川/冰棱 持续 5 s，冰棘 8 s。
 *   → H：有【透视】时 = 重击爆裂 det（按小游戏成功处理，引擎假设），否则普通重击。冰绽 = 引爆仍存在的冰造物（各自倍率行），每个 +15 协奏（技能参数「…爆炸回复协奏能量 15」，冰棘无此参数 → 0）。
 * 朔雪永冻(E) → 冰棱；焦瞑冻土(R) → 冰川；凛刺(变奏) → 冰棘。
 * 固有 凝冰（变奏后共鸣技能伤害 +20% 8 s）通用解析；瀑雪「第5段普攻后…冰绽造成的伤害提升20%，持续8秒」→ 模块，只作用于冰绽。
 * 链1 第5段普攻 暴击 +15%（通用解析触发改为 A5）；链4 解放 +10 能量、5 s 内下次重击爆裂 +120%；链5 冰绽暴伤 +100%（模块，只作用于冰绽；“未引爆也会爆炸”未建模）；
 * 链6 引爆冰棱/冰川后全队攻击 +10%（2 层，20 s）。
 * 轴（Prydwen https://www.prydwen.gg/wuthering-waves/characters/sanhua ，2026-10-05）：变奏 → 解放 → 技能 → 重击爆裂 → 重击爆裂 → 延奏；“三个冰造物各 15 协奏”。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const { on } = C;
  return WW.registerChar({
    id: 1102, chainModeled: 6, name: '散华', version: '0.1', confidence: 'medium',
    notes: ['重击爆裂按小游戏成功处理（需至少 1 层透视，引擎假设）', '冰绽每个冰棱/冰川 +15 协奏（技能参数），冰棘爆炸无协奏参数', '链5“未引爆也会爆炸”与链3（生命<70%）未建模',
      '普攻 1–3 段帧数据两个来源冲突（action_frames 记 null）→ 默认时长'],
    audit: { role: 'support', sig: null, team: 'team_camellya_sanhua.json', teamMi: 1, finishers: ['det'] },
    frames: { det: '重击·Heavy: Detonate' },
    resources: [
      { key: 'clarity', name: '透视', max: 2, segmented: true, confidence: 'high', basis: 'A5/变奏/技能 +1，解放 +2，重击爆裂清空；每层 5 s', get: (cs, t) => (on(cs.clarUntil, t) ? cs.clarity : 0) },
      { key: 'ice', name: '冰造物', max: 3, segmented: true, confidence: 'high', basis: '冰棘 8 s / 冰棱 5 s / 冰川 5 s', get: (cs, t) => ['thorn', 'prism', 'glacier'].filter((k) => on(cs[k], t)).length },
    ],
    kit(H) {
      const K = {
        det: H.act({ key: 'det', cls: 'H', skill: 6, labels: ['爆裂伤害'], levelKey: 'forte', concertoParam: '爆裂回复协奏能量', label: '重击·爆裂', dur: 1.68 }),
        thorn: H.act({ key: 'thorn', cls: 'E', skill: 6, labels: ['冰棘爆炸伤害'], levelKey: 'forte', label: '冰绽·冰棘' }),
        prism: H.act({ key: 'prism', cls: 'E', skill: 6, labels: ['冰棱爆炸伤害'], levelKey: 'forte', label: '冰绽·冰棱' }),
        glacier: H.act({ key: 'glacier', cls: 'E', skill: 6, labels: ['冰川爆炸伤害'], levelKey: 'forte', label: '冰绽·冰川' }),
      };
      H.patchBuff((b) => b.kind === 'chain' && /孤身孑然/.test(b.src || ''), { trigger: { on: 'act', keys: ['A5'] }, mode: 'auto' }, '模块：只由第5段普攻触发');
      H.patchBuff((b) => b.kind === 'chain' && /颠覆无常|剑修五蕴|曙色天光/.test(b.src || ''), { mode: 'module' }, '模块：冰绽/重击爆裂/引爆时处理');
      H.patchBuff((b) => b.kind === 'inherent' && /瀑雪/.test(b.src || ''), { mode: 'module' }, '模块：只作用于冰绽');
      return K;
    },
    init() { return { clarity: 0, clarUntil: null, thorn: null, prism: null, glacier: null, avUntil: null, c4Until: null }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, kit = api.mem.kit;
      switch (btn) {
        case 'A': return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'H': return on(cs.clarUntil, api.t) && cs.clarity > 0 ? { act: K.det } : (kit.H ? { act: kit.H } : null);
        case 'E': return { act: kit.E };
        case 'R': return { act: kit.R };
        case 'I': return { act: kit.I };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      return act.key === 'det' && on(api.cs.c4Until, api.t) ? [{ key: 'dmg:heavy', value: 1.2 }] : [];
    },
    apply(api, act) {
      const cs = api.cs, k = act.key, t = api.tEnd, ch = api.H.chain, K = api.mem.modKit;
      const clar = (n) => { cs.clarity = Math.min(2, (on(cs.clarUntil, api.t) ? cs.clarity : 0) + n); cs.clarUntil = t + 5; };
      if (k === 'A5') { clar(1); cs.avUntil = t + 8; }
      if (k === 'I') { clar(1); cs.thorn = t + 8; }
      if (k === 'E') { clar(1); cs.prism = t + 5; }
      if (k === 'R') { clar(2); cs.glacier = t + 5; if (ch >= 4) { api.addEnergy(api.mi, 10); cs.c4Until = t + 5; } }
      if (k === 'det') {
        cs.clarity = 0; cs.clarUntil = null; cs.c4Until = null;
        const st = [].concat(on(cs.avUntil, api.t) ? [{ key: 'dmg:skill', value: 0.2 }] : [], ch >= 5 ? [{ key: 'critDmg', value: 1 }] : []);
        let c6 = 0;
        for (const s of ['thorn', 'prism', 'glacier']) {
          if (!on(cs[s], api.t)) continue;
          api.deal(K[s], { stats: st, coord: false, t });
          if (s !== 'thorn') { api.addConcerto(api.mi, 15); c6++; }
          cs[s] = null;
        }
        if (ch >= 6 && c6) {
          const b = api.mem.buffDefs.find((x) => x.kind === 'chain' && /曙色天光/.test(x.src || ''));
          if (b) for (let j = 0; j < api.teamSize; j++) for (let n = 0; n < c6; n++) api.fireBuff(b.id, j, { t });
        }
      }
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, t = api.t;
      let v = 0;
      for (const s of ['thorn', 'prism', 'glacier']) if (on(cs[s], t)) v += 0.8 * api.est(K[s]);
      if (on(cs.clarUntil, t) && cs.clarity > 0) v += 0.5 * api.est(K.det);
      return v;
    },
  });
});
