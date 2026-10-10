/*
 * 陆·赫斯 (1510) character module — worker-B.
 *
 * 普攻 光犹如此 (1004701): 地面 4 段（第3段飞刃 5.02%×30）；重击 91.26%（空中连段未单列）
 * 共鸣技能 所有陨落在此重逢 (1004702):
 *   「流金回潮…201.20%…附加【集谐·偏移】…拥有2次可施放次数（冷却 8）」→ 2 次 / 8 秒按 冷却 4 秒近似（中）
 *   「每次施放普攻第4段或空中攻击第3段时，共鸣技能替换为斩杀日冕…普攻伤害…3个形态依次为 环、破、曜。施放任意形态…获得1层【终局之释义】…
 *    环/破：下次按下普攻，可以施放普攻·流金贯行 155.47%。曜：投掷固相日髓…形成日髓阵列（5秒后爆炸 153.45%，普攻伤害）。切换角色重置形态顺序」
 *   「终局之释义：使共鸣解放伤害倍率提升25%，可叠加3层，施放共鸣解放或切换后移除」
 * 共鸣解放 于永冻中释义 (1004703): 745.54%+49.71%×5（普攻伤害）
 * 共鸣回路 自霜中诞生的火光 (1004707):
 *   「斩杀日冕·曜…后，一定时间内在空中按下普攻 → 判决大地裂响 306.90%（普攻伤害），落地时立即引爆日髓阵列」
 *   「【日髓能流】满时（上限300）进入黄金的裁量：无法回复；斩杀日冕伤害倍率提升110%；斩杀日冕·曜后判决大地裂响与日髓阵列倍率提升110%；每次斩杀日冕消耗100点；清空时退出」
 *   「黄金诊律：拥有【黄金诊律】的角色施放延奏技能时，如果下一个登场的角色是陆·赫斯…陆·赫斯获得200点【日髓能流】和12点协奏能量，24秒后…重新获得」
 *   「常态攻击、流金回潮、斩杀日冕、流金贯行、判决大地裂响命中时，能回复【日髓能流】；变奏 +100」→ 每次回复量未公开：估计 普攻每段 15、流金回潮/斩杀日冕/流金贯行 30、判决 40（低）
 *   日髓碎刃（固定伤害 10/0.15 秒）未建模
 * 固有 无因的医谕：「附近队伍中所有角色为敌方怪物附加【集谐·偏移】…后，陆·赫斯攻击提升25%，持续20秒」→ 自身流金回潮/斩杀日冕/变奏即附加，输出期间常驻（中）；
 *   「对有【集谐·干涉】的目标…每10点谐度破坏增幅加深5%」与 雪下的脉搏/续写白昼 —— 谐度未建模（B4）
 * 延奏 致濒死以答：500%；变奏 注入黎明以前：72.67%×3，+100 日髓能流
 * 共鸣链：2 解放倍率 +60%（模块）；其余未建模
 * 专武 白昼之脊 (21040056):「每次为敌方怪物附加【集谐·偏移】后，普攻伤害加深20%，且普攻伤害能无视目标10%防御，持续6秒」→ 常驻（中）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'), require('./0_wb_lib.js'));
  else factory(root.WWEngine, root.WWCharsCommon, root.WWKitB);
})(typeof self !== 'undefined' ? self : this, function (WW, C, B) {
  'use strict';
  const { on } = C;
  const FORMS = ['zr', 'zb', 'zg'];
  const RY = { a1: 15, a2: 15, a3: 15, a4: 15, lj: 30, zr: 30, zb: 30, zg: 30, gx: 30, pj: 40 };
  const scale = (a, m, key, label) => Object.assign({}, a, { key, label: label || a.label, hits: a.hits.map((h) => Object.assign({}, h, { multiplier: h.multiplier.map((x) => x * m) })) });
  return WW.registerChar({
    id: 1510, chainModeled: 2, name: '陆·赫斯', version: '0.1', confidence: 'medium',
    notes: ['日髓能流回复量为估计（低）', '流金回潮 2 次可用按冷却 4 秒近似', '谐度（集谐·偏移/干涉、续写白昼、医谕加深）未建模（B4）', '空中连段与日髓碎刃未建模', '黄金的裁量倍率提升按倍率×(1+1.1) 处理'],
    audit: { role: 'dps', finishers: ['pj', 'lib'], window: 25, sig: 21040056, alts: [21040015, 21040045, 21040074], solo: 'luuk_solo.json', team: 'team_luuk.json', teamMi: 0 },
    frames: Object.assign(B.stageFrames('a', 4, '普攻·Basic: Such is Light'), {
      hv: '重击·Heavy: Such is Light', lj: '共鸣技能·Skill 1: Golden Reflux', zr: '共鸣技能·Skill 2: Aureole of Execution - Ring', zb: '共鸣技能·Skill 3: Aureole of Execution - Breach',
      zg: '共鸣技能·Skill 4: Aureole of Execution - Glare', gx: '共鸣技能·Basic: Golden Impale', pj: '共鸣回路·Basic: Gavel of Earthshaker',
      lib: "共鸣解放·Liberation: Rewritten in Winter's Margins", I: '变奏入场·Intro: Before Injection of Dawn',
    }),
    resources: [
      { key: 'ry', name: '日髓能流', max: 300, segmented: false, confidence: 'low' },
      { key: 'gold', name: '黄金的裁量', max: 1, segmented: true, confidence: 'high', get: (cs) => (cs.gold ? 1 : 0) },
      { key: 'zj', name: '终局之释义', max: 3, segmented: true, confidence: 'high' },
    ],
    kit(H) {
      const ch = H.chain;
      const K = Object.assign(B.stages(H, { n: 4, prefix: 'a', pre: '普攻', durs: [0.52, 0.93, 0.93, 0.65] }), {
        hv: H.act({ key: 'hv', cls: 'H', skill: 1, labels: ['重击伤害'], levelKey: 'basic', dur: 1.0, label: '重击' }),
        lj: H.act({ key: 'lj', cls: 'E', skill: 2, labels: ['流金回潮伤害'], levelKey: 'skill', cooldown: 4, dur: 1.13, label: '流金回潮' }),
        zr: H.act({ key: 'zr', cls: 'E', skill: 2, labels: ['斩杀日冕·环伤害'], levelKey: 'skill', dur: 1.35, label: '斩杀日冕·环' }),
        zb: H.act({ key: 'zb', cls: 'E', skill: 2, labels: ['斩杀日冕·破伤害'], levelKey: 'skill', dur: 1.35, label: '斩杀日冕·破' }),
        zg: H.act({ key: 'zg', cls: 'E', skill: 2, labels: ['斩杀日冕·曜伤害'], levelKey: 'skill', dur: 1.77, label: '斩杀日冕·曜' }),
        gx: H.act({ key: 'gx', cls: 'A', skill: 2, labels: ['普攻·流金贯行伤害'], levelKey: 'skill', dur: 1.13, label: '普攻·流金贯行' }),
        arr: H.act({ key: 'arr', cls: 'Z', skill: 2, labels: ['日髓阵列伤害'], levelKey: 'skill', dur: 0, label: '日髓阵列' }),
        pj: H.act({ key: 'pj', cls: 'A', skill: 6, labels: ['判决大地裂响伤害'], levelKey: 'forte', concertoParam: '判决大地裂响回复协奏能量', dur: 0.68, label: '空中攻击·判决大地裂响' }),
        lib: H.act({ key: 'lib', cls: 'R', skill: 3, labels: ['技能伤害'], levelKey: 'liberation', concertoParam: '回复协奏能量', cost: H.R.energy.liberationCost, cooldown: 25, dur: 4.12, label: '于永冻中释义' }),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.25 }),
        O: B.outro(H, '致濒死以答'),
      });
      for (const k of ['zr', 'zb', 'zg', 'arr', 'pj']) K[k + 'G'] = Object.assign(scale(K[k], 2.1, k, K[k].label + '（黄金的裁量）'), { gold: true });
      for (let n = 0; n <= 3; n++) K['lib' + n] = Object.assign(scale(K.lib, (7.4554 * (1 + 0.25 * n + (ch >= 2 ? 0.6 : 0)) + 0.4971 * 5) / (7.4554 + 0.4971 * 5), 'lib', K.lib.label + (n ? '（终局之释义×' + n + '）' : '')), { cdKey: 'R' });
      K.lib.cdKey = 'R';
      B.onHitAlways(H, /附加【集谐·偏移】或造成【谐度破坏】伤害后，陆·赫斯攻击提升25%/, 'inherent');
      B.onHitAlways(H, /每次为敌方怪物附加【集谐·偏移】后/, 'weapon');
      return K;
    },
    fillerKeys: ['a1', 'a2', 'a3', 'a4'],
    init(api) { const st = api.H.opts.start || {}; return { ry: st.ry || 0, gold: false, zj: 0, form: 0, zs: false, st: 0, nextA: null, pjG: false, gdNext: 0 }; },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs;
      switch (btn) {
        case 'A':
          if (cs.nextA === 'gx') return { act: K.gx };
          if (cs.nextA === 'pj') return { act: cs.pjG ? K.pjG : K.pj };
          return { act: K['a' + ((cs.st % 4) + 1)] };
        case 'H': return { act: K.hv };
        case 'E':
          if (cs.zs) { const f = FORMS[cs.form % 3]; return { act: cs.gold ? K[f + 'G'] : K[f] }; }
          return api.cdReady('lj') ? { act: K.lj } : { blocked: '流金回潮冷却中' };
        case 'R': return { act: K['lib' + Math.min(3, cs.zj)] };
        case 'I': return { act: K.I };
        default: return B.common(api, btn);
      }
    },
    apply(api, act) {
      const cs = api.cs, k = act.key.replace(/G$/, ''), te = api.tEnd;
      const gain = (n) => { if (cs.gold) return; cs.ry = Math.min(300, cs.ry + n); if (cs.ry >= 300) cs.gold = true; };
      const prevNext = cs.nextA; cs.nextA = null;
      if (/^a\d$/.test(k)) { const n = +k.slice(1); cs.st = n % 4; gain(RY[k]); if (n === 4) cs.zs = true; return; }
      if (k === 'lib') { cs.zj = 0; return; }
      switch (k) {
        case 'lj': gain(RY.lj); break;
        case 'zr': case 'zb': case 'zg': {
          const wasGold = cs.gold;
          cs.zs = false; cs.form = (cs.form + 1) % 3; cs.zj = Math.min(3, cs.zj + 1); gain(RY[k]);
          if (wasGold) { cs.ry -= 100; if (cs.ry <= 0) { cs.ry = 0; cs.gold = false; } }
          if (k === 'zg') { cs.nextA = 'pj'; cs.pjG = wasGold; cs.arrPending = wasGold ? 'arrG' : 'arr'; }
          else cs.nextA = 'gx';
          break;
        }
        case 'gx': gain(RY.gx); break;
        case 'pj': gain(RY.pj); if (cs.arrPending) { api.deal(api.mem.modKit[cs.arrPending]); cs.arrPending = null; } cs.st = 0; break;
        case 'I': {
          gain(100);
          if (api.ctx.members.length > 1 && te >= cs.gdNext - 1e-9) { gain(200); api.addConcerto(api.mi, 12); cs.gdNext = te + 24; }
          break;
        }
        default: break;
      }
      // 未接判决：日髓阵列 5 秒后自行爆炸（伤害按施放时结算，时间近似）
      if (prevNext === 'pj' && k !== 'pj' && cs.arrPending) { api.deal(api.mem.modKit[cs.arrPending]); cs.arrPending = null; }
    },
    swapOut(api) { const cs = api.cs; cs.form = 0; cs.zs = false; cs.zj = 0; cs.nextA = null; if (cs.arrPending) { api.deal(api.mem.modKit[cs.arrPending]); cs.arrPending = null; } },
    // search heuristic (not a game rule): 日髓能流 → 黄金的裁量, 终局之释义 → 解放
    potential(api) {
      const cs = api.cs, K = api.mem.modKit;
      return (cs.gold ? cs.ry / 100 * 0.6 * api.est(K.zbG) : cs.ry / 300 * 0.4 * (api.est(K.zrG) + api.est(K.zgG))) + cs.zj * 0.25 * 0.5 * api.est(K.lib) + (cs.zs ? 0.5 * api.est(K.zr) : 0);
    },
  });
});
