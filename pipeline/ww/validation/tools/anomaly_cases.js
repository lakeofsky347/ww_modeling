// 生成异常效应用例（N1–N10），expect 取参考 B（wuwa-calc-site）公式的逐跳值；保留 cases.json 已有用例。
const fs = require('fs'), path = require('path');
const V = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(V, 'refs/wuwa-calc-site/site/src/logic/combat/negativeStatus.ts'), 'utf8');
const T = {};
for (const [k, key] of [['Fusion Burst', 'burst'], ['Electro Flare', 'flare'], ['Aero Erosion', 'erosion'], ['Spectro Frazzle', 'frazzle'], ['Glacio Chafe', 'chafe']]) {
  const m = src.match(new RegExp("'" + k + "':\\s*\\[([^\\]]+)\\]")); T[key] = m[1].split(',').map(Number);
}
const mult = (t, n) => { const a = T[t]; if (n < a.length) return a[n]; const l = a[a.length - 1], d = l - a[a.length - 2]; return l + d * (n - a.length + 1); };
// B: statusBaseDmg 3674 固定；单位等级固定 90；DEF/RES 公式按 B 的 damage.ts
const defB = (enemyLv, reduce = 0) => { const u = 800 + 8 * 90, e = (8 * enemyLv + 792) * (1 - reduce); return u / (u + e); };
const resB = (r) => (r < 0 ? 1 - r / 2 : 1 - r);
const hitB = (t, n, o = {}) => 3674 * mult(t, n) / 10000 * (1 + (o.bonus || 0)) * (1 + (o.amp || 0)) * (1 + (o.taken || 0)) * resB(0.1 - (o.shred || 0)) * defB(90);
const r1 = (x) => Math.round(x * 10) / 10;
const W = { id: 21010023, level: 90, rank: 1 };
const mem = (id, level = 90) => [{ id, level, chain: 0, weapon: W, echoes: [] }];
const C = [];
const add = (name, iso, team, probe, ticksB, note, extra = {}) => {
  const tv = ticksB.map((x) => r1(x));
  C.push(Object.assign({ name, isolates: iso, team, probe, expect: { tolerancePct: 0.5, first: tv[0], ticks: tv },
    _ref: { 'B_wuwa-calc-site': { ticks: tv, sum: r1(ticksB.reduce((a, b) => a + b, 0)), count: tv.length, note } , 'A_wuwa-tools': '未建模异常效应，无参考值' } }, extra));
};
add('N1 风蚀 1 层 卡提希娅（逐跳）', ['anomalyBase', 'multiplier'], mem(1409), { member: 0, anomaly: 'erosion', stacks: 1, ticks: 3 },
  [1, 1, 1].map(() => hitB('erosion', 1)), 'B：OnTick 3s，首跳在 t=3s；引擎/原始数据 bExecutePeriodicEffectOnApplication=True → 首跳 t=0。逐跳数值一致，时序差 3s。');
add('N2 风蚀 3 层 卡提希娅（逐跳）', ['anomalyBase', 'multiplier'], mem(1409), { member: 0, anomaly: 'erosion', stacks: 3, ticks: 5 },
  [1, 1, 1, 1, 1].map(() => hitB('erosion', 3)), 'B 风蚀 maxStacks=10（原始数据 cap=3）、持续 15s；引擎 14.8s 共 5 跳（t=0,3,6,9,12），B 为 t=3..15 共 5 跳。');
add('N3 光噪 10 层 菲比（逐跳衰减）', ['anomalyBase', 'multiplier', 'decay'], mem(1506), { member: 0, anomaly: 'frazzle', stacks: 10, ticks: 6 },
  [10, 9, 8, 7, 6, 5].map((n) => hitB('frazzle', n)), 'B：每次到期结算后 −1 层，B 的到期间隔 1.5s；引擎/原始数据 3s。按层数逐跳数值相同，但 B 的 DPS 为引擎 2 倍（结构差异）。');
add('N4 电磁 10 层 心（逐跳减半）', ['anomalyBase', 'multiplier', 'decay'], mem(1311), { member: 0, anomaly: 'flare', stacks: 10, ticks: 6 },
  [10, 5, 2].map((n) => hitB('flare', n)), 'B：5s 到期结算后层数减半(floor)并刷新持续 → 10/5/2/1 共 4 跳（第 4 跳 1 层 = ' + r1(hitB('flare', 1)) + '）；引擎 15s 不刷新 → 3 跳。expect 只列共有的前 3 跳。');
add('N5 聚爆 10 层引爆 爱弥斯', ['anomalyBase', 'multiplier'], mem(1210), { member: 0, anomaly: 'burst', stacks: 10, ticks: 1 },
  [hitB('burst', 10)], 'B：层数 ≥10 时按当前层数结算后清空；与引擎一致。');
add('N6 霜渐 5 层 绯雪（施加即结算）', ['anomalyBase', 'multiplier'], mem(1108), { member: 0, anomaly: 'chafe', stacks: 5, ticks: 1 },
  [hitB('chafe', 5)], 'B：OnBuffAdd 结算；表用 2450 起（对应原始 10011000/10011100），非 10010000 半值表。');
add('N7 光噪 10 层 + 光噪伤害加成 30%（加成区）', ['bonus'], mem(1506), { member: 0, anomaly: 'frazzle', stacks: 10, ticks: 1, extraStats: [{ key: 'dmg:anomaly:frazzle', value: 0.3 }] },
  [hitB('frazzle', 10, { bonus: 0.3 })], 'B：以状态名开头的 DMG Bonus 进入 (1+dmgBonus)。');
add('N8 风蚀 3 层 + 风蚀加深 50% + 目标受伤 +10%（加深区）', ['deepen', 'targetTaken'], mem(1409), { member: 0, anomaly: 'erosion', stacks: 3, ticks: 1, extraStats: [{ key: 'deep:anomaly:erosion', value: 0.5 }] },
  [hitB('erosion', 3, { amp: 0.5, taken: 0.1 })], 'B：(1+0.5)×(1+0.1)=1.65 独立相乘；引擎 1+0.5+0.1=1.60 同区相加 → 预期差 −3.03%（结构差异）。',
  { enemy: { level: 90, resTier: 0.1, resShred: 0, damageTaken: 0.1 } });
add('N9 电磁 10 层 + 减抗 20%（抗性 −10%）', ['resistance'], mem(1311), { member: 0, anomaly: 'flare', stacks: 10, ticks: 1, extraStats: [{ key: 'resShred:all', value: 0.2 }] },
  [hitB('flare', 10, { shred: 0.2 })], '有效抗性 −10% → 1.05，两侧一致。');
add('N10 风蚀 3 层 施加者 Lv80（等级基础值）', ['anomalyBase', 'defense'], mem(1409, 80), { member: 0, anomaly: 'erosion', stacks: 3, ticks: 1 },
  [hitB('erosion', 3)], 'B：基础值固定 3674、单位等级固定 90；引擎/原始数据 Lv80 基础 2005、DEF 按 Lv80 → 预期大幅偏低（结构差异，原始数据支持引擎）。');
add('N11 光噪 10 层 + 队伍全伤害加深 15%（不应计入）', ['amplifyScope'], mem(1506), { member: 0, anomaly: 'frazzle', stacks: 10, ticks: 1, extraStats: [{ key: 'deep:all', value: 0.15 }] },
  [hitB('frazzle', 10)], 'B：@Team 的普通 DMG Amplify 不进入异常（仅目标侧或状态名开头的 buff）；引擎同样过滤 → 应与 N3 首跳相同。');
const f = path.join(V, 'cases.json');
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
const keep = d.cases.filter((c) => !/^N\d+ /.test(c.name));
d.cases = keep.concat(C);
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
console.log('kept', keep.length, 'added', C.length, 'total', d.cases.length);
