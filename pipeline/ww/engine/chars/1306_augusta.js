/*
 * 奥古斯塔 (1306) character module. 导电 长刃，重击（护盾）主C。
 *
 * 常态攻击 逐狩 (1003901):
 *   「重击·烁雷·后撤：【战势】满时，重击·鸣铁替换为重击·烁雷·后撤…施放时消耗全部的【战势】。技能施放时…再次短按普攻，可以施放重击·烁雷·旋切。」
 *   「重击·烁雷·升拳：…当施放共鸣技能·斩锋时，若【战势】满，短按共鸣技能或跳跃可以施放…；当施放重击·鸣铁…时，若【战势】满…再次短按普攻或跳跃可以施放」
 *   「【战势】上限为100点。·普攻、重击·鸣铁、空中攻击…共鸣技能·斩锋…造成伤害时可以获得【战势】。·施放变奏技能·灼金的巡行时，回满【战势】。」
 *   → 按键：H(战势满)=后撤 bs，紧接 A=旋切 sp；E(斩锋后、战势满)/A(鸣铁后、战势满)=升拳 up（跳跃键未建模，按描述的另两种输入）。
 *   【战势】逐段获取量数据中没有 → Prydwen：「regular Heavy Attacks… generate about 60% of her Prowess gauge each」「her base Resonance Skill restores full Prowess」
 *     https://www.prydwen.gg/wuthering-waves/characters/augusta → 鸣铁 +60、斩锋 回满（社区，中）；普攻 1–4 段 +10/15/20/20（估计，低）。
 * 共鸣回路 曜阳如我 (1003907): 「【权炳】满时…斩锋替换为不败恒阳·迅击…短按普攻或共鸣技能，可以施放…跃空…落袭」「落袭：施放时消耗全部的【权炳】…获得1层【威慑】」
 *   「【权炳】上限为100点。·常态攻击造成伤害时，可以获得【权炳】。·变奏 回复20%·斩锋 回复10%·誓锋不殒 回复40%」
 *   → 常态攻击逐段获取量未知：按 Prydwen 最快循环（变奏→后撤旋切→E→后撤旋切→R→迅击…）恰好 100 校准：后撤 5、旋切 10、升拳 10、鸣铁 5、普攻每段 3（低）。
 * 共鸣解放 至日的征伐 (1003903): 誓锋不殒（耗能 125、冷却 25、+40% 权炳）；
 *   「当存在2层【威慑】时，长按共鸣解放可施放赫日威临…不消耗共鸣能量，而是消耗2层【威慑】…进入7秒的俯首之刻，俯首之刻持续期间时间暂时停止…施放9次赫日威临·烈阳后…施放赫日威临·不朽者之肃」
 *   → 整段建模为一个动作 sublime（烈阳×9 + 不朽者之肃），时长取 action_frames「Liberation 2: Sublime is the Sun」8.38 s（含 503 帧时停；默认 timeStop=exclude → 只占 0.0x s 战斗时间，见 MECHANICS §10）。
 *   「技能结束时消耗全部的【以众愿为冕】」→ sublime 之后清空。
 * 固有 炽盛决意: 「非战斗状态大于4秒时…若【威慑】少于1层，则补至1层。【以众愿为冕】补充至上限。」→ 开局 威慑 1、以众愿为冕 满（Prydwen「starts combat with 1 Majesty」）。
 * 固有 荣誉的加护: 「造成伤害时，获得…护盾…每0.5秒可生效1次」→ api.shield（引擎“获得护盾时”触发）：专武无视防御层、荣斗铸锋之冠 每 0.5 s 一层。
 * 延奏 不屈的战歌: 「全伤害加深15%」(通用解析)；「施放延奏技能时，让队伍中的奥古斯塔获得1层【威慑】与1层【以众愿为冕】」→ onTeam(outro) 由下一位登场角色的延奏触发。
 * 【以众愿为冕】「每层使导电伤害加成提升15%，上限为1层」(链1 上限2、每层暴伤+15%；链2 每层暴击+20%；链6 上限4) → actionStats。
 * 链3: 后撤/旋切/升拳/落袭/赫日威临 倍率 +25% → scale 1.25。
 * 武器 驭冕铸雷之权 (21010046): 重击伤害提升（变奏/共鸣技能，通用解析）；「自身获得护盾时，重击伤害无视目标7.2%防御…可叠加5层，持续7秒」→ 引擎 shield 触发。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../ww_engine.js'), require('./_common.js'));
  else factory(root.WWEngine, root.WWCharsCommon);
})(typeof self !== 'undefined' ? self : this, function (WW, C) {
  'use strict';
  const SIG = 21010046;
  const PROW = { A1: 10, A2: 15, A3: 20, A4: 20, H: 60 };
  const ASC = { A1: 3, A2: 3, A3: 3, A4: 3, H: 5, bs: 5, sp: 10, up: 10, I: 20, E: 10, R: 40 };
  return WW.registerChar({
    id: 1306, chainModeled: 6, name: '奥古斯塔', version: '0.1', confidence: 'medium',
    notes: ['【战势】鸣铁 +60 / 斩锋回满取 Prydwen（中）；普攻段获取与【权炳】常态攻击获取为估计（低，按 Prydwen 最快循环校准）',
      '赫日威临（9×烈阳+不朽者之肃）建模为单动作 sublime，8.38 s 含 8.38 s 时停（默认 timeStop=exclude：不占战斗时间、计时冻结）',
      '升拳只建模“斩锋后再按 E / 鸣铁后再按 A”两种输入；闪避反击版本未建模', '护盾=固有荣誉的加护，每 0.5 s 一次（触发专武/荣斗铸锋之冠）'],
    audit: { role: 'dps', finishers: ['sublime', 'lx'], window: 25, sig: SIG, alts: [21010016, 21010026, 21010045], solo: 'augusta_solo.json', team: 'team_augusta.json', teamMi: 0 },
    frames: {
      A1: "普攻·Basic: Hunter's Path 1", A2: "普攻·Basic: Hunter's Path 2", A3: "普攻·Basic: Hunter's Path 3", A4: "普攻·Basic: Hunter's Path 4",
      H: "重击·Heavy 1: Hunter's Path", bs: '重击·Heavy 2: Thunderoar - Backstep', sp: '重击·Heavy 2: Thunderoar - Spinslash', up: '重击·Heavy 3: Thunderoar - Uppercut',
      E: "共鸣技能·Skill 1: Warrior's Blade", xj: '共鸣技能·Skill 2: Undying Sunlight - Strike', yk: '共鸣技能·Skill 2: Undying Sunlight - Leap', lx: '共鸣技能·Skill 2: Undying Sunlight - Plunge',
      R: '共鸣解放·Liberation 1: Sword of Eternal Oath', sublime: '共鸣解放·Liberation 2: Sublime is the Sun', I: '变奏入场·Intro: Stride of Goldenflare',
    },
    resources: [
      { key: 'zs', name: '战势', max: 100, segmented: false, confidence: 'low', basis: '上限 100（描述）；鸣铁 +60/斩锋回满（Prydwen），普攻段估计' },
      { key: 'qb', name: '权炳', max: 100, segmented: false, confidence: 'low', basis: '上限 100；变奏20/斩锋10/誓锋不殒40（描述），常态攻击估计' },
      { key: 'ws', name: '威慑', max: 2, segmented: true, confidence: 'high', basis: '落袭 +1、延奏效果期间队友延奏 +1；开局 1（固有）' },
      { key: 'crown', name: '以众愿为冕', max: 4, segmented: true, confidence: 'high', basis: '上限 1（链1:2, 链6:4）' },
    ],
    kit(H) {
      const ch = H.chain, c3 = ch >= 3 ? { scale: { '*': 1.25 }, inferred: '链3：倍率 +25%' } : {};
      const s3 = H.skill(3);
      const sun = s3.hits.filter((h) => !h.alt && h.label === '赫日威临·烈阳伤害').map((h) => Object.assign({}, h, { count: 9 }));
      const pro = s3.hits.filter((h) => !h.alt && h.label === '赫日威临·不朽者之肃伤害');
      const K = {
        H: H.act({ key: 'H', cls: 'H', skill: 1, labels: ['重击·鸣铁伤害'], levelKey: 'basic', dur: 0.75, extra: { stamina: H.param(1, '重击·鸣铁耐力消耗') || 20 } }),
        bs: H.act(Object.assign({ key: 'bs', cls: 'H', skill: 1, labels: ['重击·烁雷·后撤伤害'], levelKey: 'basic', dur: 0.57 }, c3)),
        sp: H.act(Object.assign({ key: 'sp', cls: 'H', skill: 1, labels: ['重击·烁雷·旋切伤害'], levelKey: 'basic', dur: 1.12, extra: { stamina: H.param(1, '重击·烁雷·旋切耐力消耗') || 20 } }, c3)),
        up: H.act(Object.assign({ key: 'up', cls: 'H', skill: 1, labels: ['重击·烁雷·升拳伤害'], levelKey: 'basic', dur: 0.77, extra: { stamina: H.param(1, '重击·烁雷·升拳耐力消耗') || 20 } }, c3)),
        E: H.act({ key: 'E', cls: 'E', skill: 2, labels: ['技能伤害'], levelKey: 'skill', concertoParam: '回复协奏能量', cooldown: H.param(2, '冷却时间') || 15, dur: 0.72 }),
        xj: H.act({ key: 'xj', cls: 'E', skill: 6, labels: ['共鸣技能·不败恒阳·迅击伤害'], levelKey: 'forte', dur: 0.8 }),
        yk: H.act({ key: 'yk', cls: 'E', skill: 6, labels: ['共鸣技能·不败恒阳·跃空伤害'], levelKey: 'forte', dur: 1.1 }),
        lx: H.act(Object.assign({ key: 'lx', cls: 'E', skill: 6, labels: ['共鸣技能·不败恒阳·落袭伤害'], levelKey: 'forte', concertoParam: '共鸣技能·不败恒阳·落袭回复协奏能量', dur: 1.33 }, c3)),
        R: H.act({ key: 'R', cls: 'R', skill: 3, labels: ['共鸣解放·誓锋不殒伤害'], levelKey: 'liberation', cost: H.param(3, '共鸣解放·誓锋不殒消耗共鸣能量') || 125,
          cooldown: H.param(3, '共鸣解放·誓锋不殒冷却时间') || 25, concertoParam: '共鸣解放·誓锋不殒回复协奏能量', dur: 1.77 }),
        sublime: H.act(Object.assign({ key: 'sublime', cls: 'R', skill: 3, hits: sun.concat(pro), levelKey: 'liberation', cdKey: 'sublime',
          cooldown: H.param(3, '共鸣解放·赫日威临冷却时间') || 25, label: '共鸣解放·赫日威临（烈阳×9 + 不朽者之肃）', dur: 8.38 }, c3)),
        I: H.act({ key: 'I', cls: 'I', skill: 5, labels: ['技能伤害'], levelKey: 'intro', concertoParam: '回复协奏能量', dur: 1.22 }),
      };
      H.patchBuff((b) => b.kind === 'outro' && b.stats.some((s) => s.key === 'dmg:electro'), { mode: 'module' }, '模块：【以众愿为冕】层数（奥古斯塔自身）');
      H.patchBuff((b) => b.kind === 'chain' && /以众愿为冕/.test(b.text || ''), { mode: 'module' }, '模块：按【以众愿为冕】层数');
      return K;
    },
    init(api) {
      const ch = api.H.chain, st = api.H.opts.start || {};
      const cap = ch >= 6 ? 4 : ch >= 1 ? 2 : 1;
      return { zs: st.zs || 0, qb: st.qb || 0, ws: st.ws != null ? st.ws : 1, crown: st.crown != null ? st.crown : cap, cap, last: null, chain: 0, outroTo: null, outroUntil: null };
    },
    resolve(api, btn) {
      const K = api.mem.modKit, cs = api.cs, kit = api.mem.kit, full = cs.zs >= 100 - 1e-9;
      switch (btn) {
        case 'A':
          if (cs.last === 'bs') return { act: K.sp };
          if (cs.last === 'xj') return { act: K.yk };
          if (cs.last === 'yk') return { act: K.lx };
          if (cs.last === 'H' && full) return { act: K.up };
          return { act: kit.stages[api.ms.stage % kit.stages.length] };
        case 'H': return { act: full ? K.bs : K.H };
        case 'E':
          if (cs.last === 'xj') return { act: K.yk };
          if (cs.last === 'yk') return { act: K.lx };
          if (cs.last === 'E' && full) return { act: K.up };
          if (cs.qb >= 100 - 1e-9) return { act: K.xj };
          return { act: K.E };
        case 'R': return cs.ws >= 2 ? { act: K.sublime } : { act: K.R };
        case 'I': return { act: K.I };
        case 'Q': return kit.Q ? { act: kit.Q } : null;
        default: return null;
      }
    },
    actionStats(api, act) {
      const cs = api.cs, ch = api.H.chain, out = [];
      if (cs.crown > 0 && act.hits && act.hits.length) {
        out.push({ key: 'dmg:electro', value: 0.15 * cs.crown });
        if (ch >= 1) out.push({ key: 'critDmg', value: 0.15 * cs.crown });
        if (ch >= 2) out.push({ key: 'critRate', value: 0.2 * cs.crown });
      }
      return out;
    },
    apply(api, act) {
      const cs = api.cs, k = act.key;
      if (act.hits && act.hits.length) api.shield({ t0: api.t, t1: api.tEnd });   // 荣誉的加护
      const stage = /^A\d$/.test(k) ? k : null;
      if (stage || k === 'H') cs.zs = Math.min(100, cs.zs + PROW[k]);
      if (k === 'E' || k === 'I') cs.zs = 100;
      if (k === 'bs' || k === 'up') cs.zs = 0;
      if (ASC[k]) cs.qb = Math.min(100, cs.qb + ASC[k]);
      if (k === 'lx') { cs.qb = 0; cs.ws = Math.min(2, cs.ws + 1); }
      if (k === 'sublime') { cs.ws = 0; cs.crown = 0; }
      if (k === 'I' && api.H.chain >= 1) cs.crown = Math.min(cs.cap, cs.crown + 1);
      if (k === 'R') { cs.chainEnd = null; }
      cs.last = k;
    },
    onOutro(api, toMi) { api.cs.outroTo = toMi; api.cs.outroUntil = api.t + 14; },
    onTeam(api, ev) {
      const cs = api.cs;
      if (ev.type === 'swap' && cs.outroTo != null && ev.mi === cs.outroTo) cs.outroTo = null;     // 「若切换至其他角色则如下效果提前结束」
      if (ev.type === 'outro' && ev.mi !== api.mi && ev.mi === cs.outroTo && cs.outroUntil != null && ev.t <= cs.outroUntil + 1e-9) {
        cs.ws = Math.min(2, cs.ws + 1); cs.crown = Math.min(cs.cap, cs.crown + 1); cs.outroTo = null;
      }
      if (ev.type === 'swap' && ev.mi === api.mi) cs.last = null;
    },
    potential(api) {
      const cs = api.cs, K = api.mem.modKit, est = (a) => api.est(a);
      let v = 0;
      if (cs.ws >= 2) v += 0.9 * est(K.sublime);
      else if (cs.ws === 1) v += (cs.qb / 100) * 0.6 * (est(K.sublime) + est(K.lx));
      if (cs.zs >= 100 - 1e-9) v += 0.5 * (est(K.bs) + est(K.sp));
      return v;
    },
  });
});
