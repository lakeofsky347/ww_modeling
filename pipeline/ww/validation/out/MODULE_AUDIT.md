# 角色模块健康检查（module_audit）

生成：2026-10-09 17:56 SGT · 引擎 ww-engine-0.2 · 数据 3.7.8 · 本次检查 64 个（表中合计 64 个，含以前运行的结果）· 模块覆盖 64/64

## 用法

```
用法：node validation/tools/module_audit.js [选项]
  （在 pipeline/ww 下运行；也可从任意目录用绝对路径运行）
选项：
  --only id,id     只检查这些角色（id 或中文名）
  --changed        只检查模块文件自上次运行（out/module_audit.json 记录的哈希）以来有变化的角色；
                   _common.js / 0_wb_lib.js 变化时视为全部变化；首次运行 = 全部
  --quick          跳过专武对比（最慢的一项）
  --json <path>    JSON 输出（默认 validation/out/module_audit.json）
  --md <path>      Markdown 输出（默认 validation/out/MODULE_AUDIT.md）
  --data <path>    ww.json（默认 ../out/ww.json）
  --frames <path|none>  动作帧（默认 validation/action_frames.json）
  --verbose        打印每个角色的搜索序列与检查细节
  --help
退出码：本次检查的角色有任一 FAIL → 1；否则 0（WARN、EXPECTED 不影响退出码）。
  预期行为：validation/tools/audit_expected.json 中匹配（id + 检查 + 可选正则）的 WARN 降级为 EXPECTED，单独列出。
  --only/--changed 时，未检查的角色沿用上次 module_audit.json 的结果写入报告（结果合并）。
配置来源：模块 audit 元数据 {role, finishers, window, sig, alts, solo, team, teamMi, anomaly, anomalyMin, sigNote, note}
  > validation/tools/signature_weapons.json > 自动（示例配置 engine/chars/examples、engine/examples；无则合成单人配置）。
```

### 检查项与阈值

| 检查 | 内容 | FAIL | WARN |
|---|---|---|---|
| 搜索 | 单人自动搜索（窗口见下方“模式”） | 单一动作 > 60%（只刷一个动作）；40s 内能量满过却从不放 R；audit.finishers 未出现；模块资源从未减少 | 40s 内能量从未满、没放 R；support 定位时“能量满却不放 R”降为 WARN |
| 专武 | compareGear（researchRotation + 交叉回放）对比 2–3 把同类武器；dps 看单人，subdps/support 看队伍 | 未排第一且落后 > 0.5% | 落后 ≤ 0.5%（搜索噪声）；专武为数据推断；support 无队伍配置；专武 TODO |
| 异常 | 本人异常伤害占比（不含虚湮；模块源码含 addAnomaly 或 audit/表中 anomaly 视为施加者；源码为 0 时依次重试：去掉 external 选项 → 切换模式开关 → 队伍 → 长窗口） | audit.anomaly / 表中声明的施加者为 0% | 仅源码检测到且为 0%（条件施加）；> 90% |
| 虚湮 | 只减防不造成伤害：同一序列在原数据 / 虚湮减防表清零的数据上重放，增伤 = 比值 − 1（优先队伍预设，否则单人） | 模块会施加却从未施加；已施加但增伤 ≤ 0 | 增伤 > 15%；或超过观测最高层数的理论防御区增益 + 0.5 个百分点 |
| 耐力 | 重击占动作数 | — | > 70% |
| 时停 | 本人含时停帧的动作：伤害占全队总伤害的比例（单人 = 本人）、占窗口战斗时间（扣除时停）与按完整动画的比例；逐动作使用次数 vs 冷却（战斗时间内相邻两次间隔 ≥ 冷却、次数 ≤ ⌊窗口/冷却⌋+1）与能量（R 施放前能量 ≥ 消耗）；模块资源门槛未独立核对 | 任一动作超冷却/能量上限 | 伤害占比 > 50%（单人或队伍） |
| 链 | 模块 chainModeled（共鸣链建模范围） | — | 引擎已有该字段而模块未提供（引擎无该字段时记“未提供”，不告警） |
| 时长 | 40s 单人动作的时长来源：帧 / 配置 / 模块估计 / 默认 | — | 估计+默认 > 50% |
| 队伍 | 辅助在默认队伍中是否上场、是否放 R、是否有变奏/延奏 | 从未上场 | 无变奏/延奏；队伍中不放 R；无队伍配置 |
| 错误 | 异常抛出、NaN、负伤害、总伤害 0、不可搜索、模块命中行缺失 | 任一 | — |

模式：不硬编码。单人第一个窗口 = 模块 audit.window > 单人预设 duration > 25s，第二个 = max(40, 第一个)（相同则只跑一次）；队伍用预设自己的 duration / start（含 start.steady）/ search（含 residual、residualWeight）/ timeStop，未写的按引擎默认（timeStop=exclude 时停不计战斗时间；search.residual=auto 队伍开、权重 0.5；残值只影响搜索排序，不计入伤害）。每次运行实际采用的模式从引擎结果读取，写入 JSON 的 rows[].modes 与下表“模式”列。

定位（role）：模块 audit.role > signature_weapons.json > 推断（队伍中个人伤害占比 ≥ 35% 视为 dps，无队伍按 dps）。默认对比武器按类型取常驻 5★ / 活动 5★ / 4★ 暴击系（1:浩境粼光/源能机锋/纹秋；2:千古洑流/镭射切变/翼锋；3:停驻之烟/相位涟漪/阳焰；4:擎渊怒涛/脉冲协臂/金掌；5:漪澜浮录/玻色星仪/清音）。

## 结果

PASS 50 · EXPECTED 1 · WARN 13 · FAIL 0

| id | 角色 | 状态 | 定位 | 模式（单人 / 队伍） | 搜索 | 专武 | 异常 | 虚湮 | 耐力 | 时停（伤害/战斗时间/动画） | 链 chainModeled | 时长 | 队伍 | 错误 | 原因 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1102 | 散华 | **WARN** | support | 25s / 30s·残值 | PASS 最高 18.8% · R×2 | SKIP | SKIP | - | PASS 16.2% | PASS 12.7% / 0.5% / 6.5% | 6 | WARN 估计 84.4% | PASS | PASS | [durations] 帧 15.6% · 配置 0% · 模块估计 0% · 默认 84.4% |
| 1103 | 白芷 | **PASS** | support | 25s / 30s·残值 | PASS 最高 28.2% · R×1 | SKIP | SKIP | - | PASS 0% | PASS 0% / 0.2% / 9% | 6 | PASS 估计 42.6% | PASS | PASS | — |
| 1104 | 凌阳 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 35.6% · R×2 | SKIP | SKIP | - | PASS 6.7% | PASS 4.6% / 12.1% / 26.1% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1105 | 折枝 | **PASS** | subdps | 20s / 30s·残值 | PASS 最高 29.2% · R×2 | PASS 1/4 | SKIP | - | PASS 29.2% | PASS 0% / 0.3% / 14.1% | 2 | PASS 估计 0% | PASS | PASS | — |
| 1106 | 釉瑚 | **WARN** | support | 25s / 30s·残值 | EXPECTED 最高 39.5% · R×0 | SKIP | SKIP | - | PASS 41.9% | PASS 0% / 0% / 0% | 6 | WARN 估计 81.4% | PASS | PASS | [durations] 帧 18.6% · 配置 0% · 模块估计 81.4% · 默认 0% |
| 1107 | 珂莱塔 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 26.5% · R×6 | PASS 1/4 | SKIP | - | PASS 20.4% | PASS 17.1% / 11.5% / 35% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1108 | 绯雪 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 25.9% · R×3 | PASS 1/4 | PASS 22.6% | - | PASS 11.1% | PASS 23.4% / 16.2% / 56.2% | 5 | PASS 估计 4.9% | PASS | PASS | — |
| 1109 | 洛瑟菈 | **WARN** | support | 25s / 30s·残值 | PASS 最高 27.3% · R×2 | PASS 1/4 | PASS 3.5% | - | PASS 0% | PASS 2.3% / 17.7% / 35.3% | 6 | PASS 估计 5.9% | WARN | PASS | [team] 队伍 team_hiyuki.json：上场动作 2 个，R×0，变奏/延奏 1 次（队伍中也不放 R）；个人占比 5% |
| 1110 | 穗穗 | **EXPECTED** | support | 25s / 30s·残值 | EXPECTED 最高 19% · R×0 | PASS 1/4 | PASS 6.4% | - | PASS 19% | PASS 0% / 0% / 0% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1202 | 炽霞 | **PASS** | dps | 25s / - | PASS 最高 30.4% · R×1 | SKIP | SKIP | - | PASS 0% | PASS 20.3% / 14.1% / 28.1% | 6 | PASS 估计 13.5% | SKIP | PASS | — |
| 1203 | 安可 | **PASS** | dps | 30s / 30s·残值 | PASS 最高 20% · R×2 | SKIP | SKIP | - | PASS 25% | PASS 0% / 0.2% / 7.9% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1204 | 莫特斐 | **PASS** | support | 25s / 30s·残值 | PASS 最高 24.6% · R×2 | SKIP | SKIP | - | PASS 2.7% | PASS 5% / 0.4% / 16.4% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1205 | 长离 | **PASS** | dps | 20s / 30s·残值 | PASS 最高 23.1% · R×2 | PASS 1/4 | SKIP | - | PASS 31.6% | PASS 17.9% / 0.2% / 16% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1206 | 布兰特 | **PASS** | subdps | 25s / 25s·残值 | PASS 最高 29.6% · R×2 | PASS 1/4 | SKIP | - | PASS 0% | PASS 5.1% / 15.7% / 31.5% | 1 | PASS 估计 48.1% | PASS | PASS | — |
| 1207 | 露帕 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 15% · R×2 | PASS 1/4 | SKIP | - | PASS 24% | PASS 20.4% / 0.4% / 29.7% | 6 | PASS 估计 30% | PASS | PASS | — |
| 1208 | 嘉贝莉娜 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 17.3% · R×2 | PASS 1/4 | SKIP | - | PASS 42.9% | SKIP 0% / 0% / 0% | 6 | PASS 估计 3.8% | PASS | PASS | — |
| 1209 | 莫宁 | **PASS** | support | 25s / 30s·残值 | PASS 最高 20.3% · R×2 | PASS 1/4 | SKIP | - | PASS 16.2% | PASS 22.1% / 0.2% / 20.2% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1210 | 爱弥斯 | **PASS** | dps | 30s / 30s·残值 | PASS 最高 16.7% · R×2 | PASS 1/4 | PASS 38.2% | - | PASS 4.2% | PASS 37.7% / 40.6% / 86.2% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1211 | 达妮娅 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 36.8% · R×3 | PASS 1/4 | PASS 8.2% | - | PASS 36.8% | PASS 27.7% / 11.9% / 37.4% | 2 | PASS 估计 21.1% | PASS | PASS | — |
| 1212 | 景燃 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 12% · R×1 | PASS 1/4 | SKIP | - | PASS 20% | PASS 10.8% / 0.2% / 18.9% | 2 | PASS 估计 0% | PASS | PASS | — |
| 1301 | 卡卡罗 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 20% · R×1 | SKIP | SKIP | - | PASS 30% | PASS 9.6% / 6.7% / 13.4% | 0 | PASS 估计 42.5% | PASS | PASS | — |
| 1302 | 吟霖 | **WARN** | subdps | 25s / 25s·残值 | PASS 最高 23.1% · R×2 | WARN 2/4 | SKIP | - | PASS 20% | PASS 15.4% / 12.8% / 25.6% | 5 | PASS 估计 0% | PASS | PASS | [signature] 掣傀之手 第 2/4，落后 0%（队伍 team_yinlin.json；在搜索噪声内） |
| 1303 | 渊武 | **PASS** | support | 25s / 25s·残值 | PASS 最高 29.5% · R×2 | SKIP | SKIP | - | PASS 29.5% | PASS 14.8% / 8.9% / 17.9% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1304 | 今汐 | **WARN** | dps | 20s / 25s·残值 | PASS 最高 23.5% · R×1 | PASS 1/4 | SKIP | - | PASS 23.5% | WARN 61.2% / 14.8% / 45% | 6 | PASS 估计 2.9% | PASS | PASS | [timestop] 含时停动作 伤害 61.2%（单人） / 48.2%（队伍）；占战斗时间 14.8%，按动画 45%（时停 6.1s，口径 exclude） > 50%（结果依赖“时停不计时”口径） |
| 1305 | 相里要 | **WARN** | dps | 25s / 25s·残值 | PASS 最高 27.6% · R×2 | WARN 2/4 | SKIP | - | PASS 27.6% | PASS 16.5% / 12% / 29.3% | 0 | PASS 估计 0% | PASS | PASS | [signature] 诸方玄枢 第 2/4，落后 0.1%（单人 25s；在搜索噪声内） |
| 1306 | 奥古斯塔 | **WARN** | dps | 25s / 25s·残值 | PASS 最高 25.7% · R×4 | WARN 2/4 | SKIP | - | PASS 45.7% | PASS 21.6% / 0.2% / 33.7% | 6 | PASS 估计 19.6% | PASS | PASS | [signature] 驭冕铸雷之权 第 2/4，落后 0.5%（单人 25s；在搜索噪声内） |
| 1307 | 卜灵 | **PASS** | support | 25s / 25s·残值 | PASS 最高 21.2% · R×2 | SKIP | PASS 9.1% | - | PASS 19.2% | PASS 11.7% / 0.9% / 16.3% | 0 | PASS 估计 38.5% | PASS | PASS | — |
| 1308 | 丽贝卡 | **PASS** | support | 25s / 25s·残值 | PASS 最高 45.2% · R×1 | PASS 1/4 | SKIP | - | PASS 65% | PASS 0% / 0.2% / 12.2% | 0 | PASS 估计 3.2% | PASS | PASS | — |
| 1309 | 漂泊者·导电 | **PASS** | subdps | 25s / 25s·残值 | PASS 最高 10% · R×2 | SKIP | PASS 6.5% | - | PASS 0% | PASS 15.8% / 0.2% / 15.1% | 0 | PASS 估计 4% | PASS | PASS | — |
| 1310 | 漂泊者·导电 | **PASS** | subdps | 25s / 25s·残值 | PASS 最高 10% · R×2 | SKIP | PASS 6.5% | - | PASS 0% | PASS 15.8% / 0.2% / 15.1% | 0 | PASS 估计 4% | PASS | PASS | — |
| 1311 | 心 | **WARN** | subdps | 40s / 30s·残值 | PASS 最高 23.5% · R×2 | PASS 1/4 | PASS 11.8% | - | PASS 44.1% | PASS 38.5% / 23.3% / 54% | 6 | PASS 估计 0% | WARN | PASS | [team] 队伍 team_hsin_jinhsi.json：上场动作 18 个，R×0，变奏/延奏 3 次（队伍中也不放 R）；个人占比 39.3% |
| 1312 | 锁暝 | **PASS** | subdps | 25s / 25s·残值 | PASS 最高 38.5% · R×1 | PASS 1/4 | SKIP | - | PASS 69.2% | SKIP 0% / 0% / 0% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1402 | 秧秧 | **PASS** | support | 25s / 25s·残值 | PASS 最高 22.9% · R×3 | SKIP | SKIP | - | PASS 37.1% | PASS 28.5% / 17.7% / 35.4% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1403 | 秋水 | **PASS** | support | 25s / 25s·残值 | PASS 最高 19% · R×1 | SKIP | SKIP | - | PASS 5.4% | PASS 8.2% / 6% / 11.3% | 0 | PASS 估计 7.9% | PASS | PASS | — |
| 1404 | 忌炎 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 16.7% · R×1 | PASS 1/4 | SKIP | - | PASS 24.1% | SKIP 0% / 0% / 0% | 6 | PASS 估计 2.1% | PASS | PASS | — |
| 1405 | 鉴心 | **PASS** | support | 25s / 25s·残值 | PASS 最高 18.8% · R×2 | SKIP | SKIP | - | PASS 15.8% | SKIP 0% / 0% / 0% | 0 | PASS 估计 6.3% | PASS | PASS | — |
| 1406 | 漂泊者·气动 | **WARN** | support | 25s / 30s·残值 | PASS 最高 23.4% · R×2 | PASS 1/4 | WARN | - | PASS 15.6% | PASS 12.4% / 0.4% / 28.5% | 6 | PASS 估计 0% | PASS | PASS | [anomaly] 源码会施加 erosion，但单人/队伍运行中占比 0%（未在 audit.anomaly 声明 → 视为条件施加；模块说明：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实） |
| 1407 | 夏空 | **WARN** | subdps | 25s / 30s·残值 | PASS 最高 20.5% · R×2 | PASS 1/4 | PASS 14.2% | - | PASS 10% | SKIP 0% / 0% / 0% | 6 | WARN 估计 63.6% | PASS | PASS | [durations] 帧 36.4% · 配置 0% · 模块估计 63.6% · 默认 0% |
| 1408 | 漂泊者·气动 | **WARN** | support | 25s / 30s·残值 | PASS 最高 23.4% · R×2 | PASS 1/4 | WARN | - | PASS 15.6% | PASS 12.4% / 0.4% / 28.5% | 6 | PASS 估计 0% | PASS | PASS | [anomaly] 源码会施加 erosion，但单人/队伍运行中占比 0%（未在 audit.anomaly 声明 → 视为条件施加；模块说明：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实） |
| 1409 | 卡提希娅 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 14.6% · R×6 | PASS 1/4 | PASS 15.7% | - | PASS 21.7% | PASS 23.3% / 20.3% / 53.5% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1410 | 尤诺 | **PASS** | support | 25s / 30s·残值 | PASS 最高 13% · R×2 | PASS 1/4 | SKIP | - | PASS 21.7% | PASS 10.7% / 0.7% / 16.7% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1411 | 仇远 | **PASS** | subdps | 25s / 40s·残值 | PASS 最高 28.6% · R×2 | PASS 1/4 | SKIP | - | PASS 25% | PASS 9% / 0.2% / 15.5% | 5 | PASS 估计 0% | PASS | PASS | — |
| 1412 | 西格莉卡 | **PASS** | dps | 25s / 40s·残值 | PASS 最高 51.9% · R×1 | PASS 1/4 | SKIP | - | PASS 63% | PASS 11.9% / 0.2% / 15.4% | 5 | PASS 估计 0% | PASS | PASS | — |
| 1413 | 清宵 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 14.3% · R×1 | PASS 1/4 | SKIP | - | PASS 10% | PASS 49.4% / 12.2% / 44.2% | 5 | PASS 估计 0% | PASS | PASS | — |
| 1501 | 漂泊者·衍射 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 17.8% · R×2 | SKIP | PASS 12.3% | - | PASS 2.9% | PASS 17.5% / 0.4% / 17.6% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1502 | 漂泊者·衍射 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 17.8% · R×2 | SKIP | PASS 12.3% | - | PASS 2.9% | PASS 17.5% / 0.4% / 17.6% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1503 | 维里奈 | **PASS** | support | 25s / 25s·残值 | PASS 最高 32.4% · R×2 | SKIP | SKIP | - | PASS 41.2% | PASS 5.6% / 2.9% / 10% | 6 | PASS 估计 46.2% | PASS | PASS | — |
| 1504 | 灯灯 | **PASS** | subdps | 25s / 25s·残值 | PASS 最高 25% · R×2 | SKIP | SKIP | - | PASS 35.7% | SKIP 0% / 0% / 0% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1505 | 守岸人 | **WARN** | support | 20s / 25s·残值 | EXPECTED 最高 25.6% · R×0 | PASS 1/4 | SKIP | - | PASS 2.6% | PASS 0% / 0% / 0% | 1 | WARN 估计 70.1% | PASS | PASS | [durations] 帧 29.9% · 配置 0% · 模块估计 0% · 默认 70.1% |
| 1506 | 菲比 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 23.2% · R×2 | PASS 1/4 | PASS 0.3% | - | PASS 39.4% | PASS 14% / 0.2% / 14.9% | 3 | PASS 估计 0% | PASS | PASS | — |
| 1507 | 赞妮 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 42.9% · R×2 | PASS 1/4 | SKIP | - | PASS 42.9% | PASS 24.6% / 9.1% / 31.4% | 6 | PASS 估计 17.1% | PASS | PASS | — |
| 1508 | 千咲 | **PASS** | support | 25s / 30s·残值 | PASS 最高 19.5% · R×1 | PASS 1/4 | SKIP | PASS 增伤 3.33% | PASS 16% | PASS 16.6% / 0.2% / 14.9% | 6 | PASS 估计 39% | PASS | PASS | — |
| 1509 | 琳奈 | **WARN** | support | 25s / 30s·残值 | PASS 最高 21.9% · R×2 | WARN 2/4 | SKIP | - | PASS 36.2% | PASS 11% / 0.2% / 16.2% | 5 | PASS 估计 0% | PASS | PASS | [signature] 溢彩荧辉 第 2/4，落后 0.1%（队伍 team_lynae.json；在搜索噪声内） |
| 1510 | 陆·赫斯 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 17.4% · R×2 | PASS 1/4 | SKIP | - | PASS 0% | PASS 15.3% / 0.2% / 16.7% | 2 | PASS 估计 0% | PASS | PASS | — |
| 1511 | 露西 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 24% · R×1 | PASS 1/4 | SKIP | - | PASS 60% | PASS 39.4% / 5% / 26.5% | 0 | PASS 估计 0% | PASS | PASS | — |
| 1601 | 桃祈 | **PASS** | support | 25s / 25s·残值 | PASS 最高 43.5% · R×1 | SKIP | SKIP | - | PASS 47.8% | PASS 28.3% / 0.2% / 9.9% | 0 | PASS 估计 14.3% | PASS | PASS | — |
| 1602 | 丹瑾 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 35.7% · R×3 | SKIP | SKIP | - | PASS 10% | PASS 17.3% / 0.4% / 26.4% | 0 | PASS 估计 12.9% | PASS | PASS | — |
| 1603 | 椿 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 42.9% · R×1 | PASS 1/4 | SKIP | - | PASS 42.9% | PASS 11.1% / 1.6% / 17.6% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1604 | 漂泊者·湮灭 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 14% · R×1 | SKIP | SKIP | - | PASS 17.5% | PASS 18.7% / 9.1% / 18.1% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1605 | 漂泊者·湮灭 | **PASS** | dps | 25s / 25s·残值 | PASS 最高 14% · R×1 | SKIP | SKIP | - | PASS 17.5% | PASS 18.7% / 9.1% / 18.1% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1606 | 洛可可 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 38.5% · R×2 | PASS 1/4 | SKIP | - | PASS 38.5% | PASS 13.6% / 0.2% / 13.5% | 6 | PASS 估计 38.5% | PASS | PASS | — |
| 1607 | 坎特蕾拉 | **PASS** | subdps | 25s / 30s·残值 | PASS 最高 20.7% · R×2 | PASS 1/4 | SKIP | - | PASS 5.6% | PASS 4% / 0.2% / 14.5% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1608 | 弗洛洛 | **PASS** | dps | 30s / 30s·残值 | PASS 最高 24.2% · R×2 | PASS 1/4 | SKIP | - | PASS 21.2% | PASS 0% / 0% / 0% | 6 | PASS 估计 0% | PASS | PASS | — |
| 1610 | 秧秧·玄翎 | **PASS** | dps | 25s / 30s·残值 | PASS 最高 12.9% · R×2 | PASS 1/4 | SKIP | PASS 增伤 3.87% | PASS 9.1% | PASS 25.9% / 0.2% / 20.2% | 6 | PASS 估计 4.5% | PASS | PASS | — |

## 预期行为（EXPECTED，来自 validation/tools/audit_expected.json；不计入 WARN、不影响退出码）

| id | 角色 | 检查 | 审计说明 | 预期原因 | 来源 |
|---|---|---|---|---|---|
| 1106 | 釉瑚 | 搜索 | 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查） | 釉瑚的 R 是全队治疗（无伤害增益），单人纯伤害窗口不放 R 正确；队伍 team_youhu.json 中会放 R。 | stream A 建模师 |
| 1110 | 穗穗 | 搜索 | 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查） | 穗穗的 R 价值在队伍（霜渐上限/增益），单人纯伤害窗口不放 R；队伍 team_hiyuki.json 中会放 R。 | stream A 建模师 |
| 1505 | 守岸人 | 搜索 | 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查） | 按游戏规则，单人时星域只能停留在第 1 阶段（浅析，只加共鸣效率）；第 2/3 阶段需要队友变奏入场推进，所以单人纯伤害窗口里不放 R 是正确行为。 | 建模师 |

## 明细

### 1102 散华（WARN，模块 v0.1 · medium，1102_sanhua.js）

- 配置：单人 合成；队伍 team_camellya_sanhua.json；定位 support（模块 audit）
- 单人 25s：104,681，`A A A A A E A A A A A H A A A A A A A A A A E A A A A A H R A A H H H E H`
- 单人 40s：169,841，`E A A A A A A A A A A A A A A A A A A A A E A A A A A H A A A A A A A R A A E A A A A A H A A A A A A A A A A E A A A A A H R H`
- 队伍 team_camellya_sanhua.json：469,489，个人占比 9.5%，`E R H S1 R A H A H A E H A H A E S2 E S1 A S3 R S1`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：焦瞑冻土 ×1（时停 1.5s，伤害 12.7%，冷却 16s 上限 2）
- 时停动作（队伍）：焦瞑冻土 ×1（时停 1.5s，伤害 3.1%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 18.8%；R×2；资源消耗 透视/冰造物
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 16.2%（25s）
- 时停：PASS — 含时停动作 伤害 12.7%（单人） / 3.1%（队伍）；占战斗时间 0.5%，按动画 6.5%（时停 1.5s，口径 exclude）
- 链：PASS — 6
- 时长：WARN — 帧 15.6% · 配置 0% · 模块估计 0% · 默认 84.4%
- 队伍：PASS — 队伍 team_camellya_sanhua.json：上场动作 4 个，R×1，变奏/延奏 1 次；个人占比 9.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：透视 4/2 · 冰造物 5/2
- 注：无单人示例配置，使用合成配置（4C 暴击/元素/元素/攻击/攻击，无套装）

### 1103 白芷（PASS，模块 v0.1 · medium，1103_baizhi.js）

- 配置：单人 baizhi_solo.json；队伍 team_baizhi.json；定位 support（模块 audit）
- 单人 25s：27,419，`A E A R A A A A A A A A A A A A A A A A A A A A A A A E A A A A A A A A A A A`
- 单人 40s：42,441，`A E A R A A A A A A A A A A A A A A A A A A A A A A A E A A A A A A A A A A A A A A A A A A A A A A A E A A A A A A A A A`
- 队伍 team_baizhi.json：518,010，个人占比 0.4%，`R S1 R H A A A H E A H E A H A A S2 S3 R S1 A A A A A A E A H E A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：刹那合弥 ×1（时停 2.2s，伤害 0%，冷却 25s 上限 2）
- 时停动作（队伍）：刹那合弥 ×1（时停 2.2s，伤害 0%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 28.2%；R×1；资源消耗 念意/频隙回响
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0.2%，按动画 9%（时停 2.2s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 57.4% · 配置 0% · 模块估计 42.6% · 默认 0%
- 队伍：PASS — 队伍 team_baizhi.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 0.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：念意 3/4 · 频隙回响 4/4

### 1104 凌阳（PASS，模块 v0.1 · medium，1104_lingyang.js）

- 配置：单人 lingyang_solo.json；队伍 team_lingyang.json；定位 dps（模块 audit）
- 单人 25s：212,858，`A R A H E A E A E A E A E A E E A A A A E A E A E H E A E E`
- 单人 40s：349,687，`A R A H E A E A E A E A E A E E A A A A E A E A E H A E A E A E R H A E A E A E A E A E E`
- 队伍 team_lingyang.json：474,230，个人占比 74.7%，`R S2 R S1 H A E A E A E R H A E A E S2 E E S3 E S1 A E A E A S2 E E H E S1 A E E A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：狮子奋迅 ×1（时停 3.5s，伤害 4.6%，冷却 20s 上限 2）
- 时停动作（队伍）：狮子奋迅 ×1（时停 3.5s，伤害 4.2%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 35.6%；R×2；资源消耗 狮魂/行狮
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 6.7%（25s）
- 时停：PASS — 含时停动作 伤害 4.6%（单人） / 4.2%（队伍）；占战斗时间 12.1%，按动画 26.1%（时停 3.5s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_lingyang.json 个人占比 74.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：狮魂 2/100 · 行狮 2/1

### 1105 折枝（PASS，模块 v0.1 · medium，1105_zhezhi.js）

- 配置：单人 zhezhi_solo.json；队伍 team_jinhsi_cold.json；定位 subdps（signature_weapons.json）
- 单人 20s：133,432，`E R A A H E A H E A H E A A H E E A A H E A H Q E`
- 单人 40s：265,259，`E R A A H E A H E A H E A A H E E A A H A E H E A H E H Q A A E H E R A H A A E H E A H E H E H`
- 队伍 team_jinhsi_cold.json：310,698，个人占比 18.7%，`R E S1 R S2 R E H S1 A A A A E A E A A A E H E S2 E H E S3 Q E S1 H E H A E Q A S2`
- 模式 单人：20s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：虚实境趣 ×1（时停 2.8s，伤害 0%，冷却 25s 上限 1）
- 时停动作（队伍）：虚实境趣 ×1（时停 2.8s，伤害 0%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 29.2%；R×2；资源消耗 灵韵/鹤影/极意/墨鹤剩余
- 专武：PASS — 琼枝冰绡 第 1/4（队伍 team_jinhsi_cold.json）；排名：琼枝冰绡（专武） > 漪澜浮录 -1% > 玻色星仪 -2.9% > 清音 -3.4%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 29.2%（40s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0.3%，按动画 14.1%（时停 2.8s，口径 exclude）
- 链：PASS — 2
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_jinhsi_cold.json：上场动作 8 个，R×1，变奏/延奏 2 次；个人占比 18.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：灵韵 8/45 · 鹤影 8/1 · 极意 2/2 · 墨鹤剩余 26/21

### 1106 釉瑚（WARN，模块 v0.1 · medium，1106_youhu.js）

- 配置：单人 youhu_solo.json；队伍 team_youhu.json；定位 support（模块 audit）
- 单人 25s：59,997，`A E A H A H A H A A H H A H A A H A H A H E A A H A H A`
- 单人 40s：99,578，`A E A H A H A H A A H H A H A H A A E A H H A H A A H A H A H H A A H A E A H A H H A`
- 队伍 team_youhu.json：363,750，个人占比 1.5%，`R S2 R S1 H A E A E A E R S2 E E S1 H A E A E A E A E A E A E S3`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（队伍）：如意卜 ×1（时停 4.7s，伤害 0.9%，冷却 25s 上限 2）
- 搜索：EXPECTED — 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查）
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 41.9%（40s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0.9%（队伍）；占战斗时间 0%，按动画 0%（时停 0s，口径 exclude）
- 链：PASS — 6
- 时长：WARN — 帧 18.6% · 配置 0% · 模块估计 81.4% · 默认 0%
- 队伍：PASS — 队伍 team_youhu.json：上场动作 2 个，R×1，变奏/延奏 2 次；个人占比 1.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：吉兆 4/4 · 霜色 5/1 · 祯祥 17/1

### 1107 珂莱塔（PASS，模块 v0.1 · medium，1107_carlotta.js）

- 配置：单人 carlotta_solo.json；队伍 team_carlotta.json；定位 dps（signature_weapons.json）
- 单人 25s：221,072，`R E A A A E A A A A A H A H A E E A A A A H A H E E`
- 单人 40s：306,676，`A R E A A A E A A A A A H A H A E E A A A A H A H A E A H A E A A A H A H A H A H E E A A H A A A`
- 队伍 team_carlotta.json：458,629，个人占比 86.5%，`R S2 R S1 R E A A A A E A A A A A A A E E S2 E E S3 E S2 E S1 A A H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：新浪潮时代 ×1（时停 3s，伤害 4.4%，冷却 25s 上限 2）；新浪潮时代·致死以终 ×1（时停 2.8s，伤害 12.7%，模块资源/无（未独立核对））
- 时停动作（队伍）：新浪潮时代 ×1（时停 3s，伤害 6.8%，冷却 25s 上限 2）；新浪潮时代·致死以终 ×1（时停 2.8s，伤害 13.8%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 26.5%；R×6；资源消耗 灵萃/可塑晶质/镜向箔/枪花轮舞
- 专武：PASS — 死与舞 第 1/4（单人 25s）；排名：死与舞（专武） > 相位涟漪 -7.7% > 停驻之烟 -16% > 阳焰 -28.7%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 20.4%（40s）
- 时停：PASS — 含时停动作 伤害 17.1%（单人） / 20.6%（队伍）；占战斗时间 11.5%，按动画 35%（时停 5.9s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_carlotta.json 个人占比 86.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：灵萃 2/120 · 可塑晶质 19/6 · 镜向箔 1/4 · 枪花轮舞 1/1 · 揭幕者 0/1

### 1108 绯雪（PASS，模块 v0.1 · low，1108_hiyuki.js）

- 配置：单人 hiyuki_solo.json；队伍 team_hiyuki.json；定位 dps（模块 audit）
- 单人 25s：262,688，`A A A E A H R A E A R A A A A A A A A A H A A A E A H`
- 单人 40s：395,589，`A A A E A H R A E A R A A A A A A A A A A A A H E A A A A A H A A A R E A H A A A`
- 队伍 team_hiyuki.json：634,519，个人占比 88.3%，`S2 E S1 A H R E A R S3 R S1 A H E S3 S1 A A A A H A A A A A A A A A S2 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：预求我身·见心 ×1（时停 4s，伤害 6%，冷却 25s 上限 2）；预求我身·归刃 ×1（时停 6s，伤害 17.4%，冷却 25s 上限 2）
- 时停动作（队伍）：预求我身·见心 ×1（时停 4s，伤害 3.3%，冷却 25s 上限 2）；预求我身·归刃 ×1（时停 6s，伤害 9.5%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 25.9%；R×3；资源消耗 预求身/心念/寒意/武霜·居合
- 专武：PASS — 灼霜 第 1/4（单人 25s）；排名：灼霜（专武） > 赫奕流明 -19.9% > 千古洑流 -21.5% > 不屈命定之冠 -36.7%
- 异常：PASS — chafe 占 22.6%（单人 25s）
- 耐力：PASS — 重击占动作 11.1%（25s）
- 时停：PASS — 含时停动作 伤害 23.4%（单人） / 12.9%（队伍）；占战斗时间 16.2%，按动画 56.2%（时停 10s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 95.1% · 配置 0% · 模块估计 4.9% · 默认 0%
- 队伍：PASS — 队伍 team_hiyuki.json 个人占比 88.3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：预求身 1/1 · 心念 4/300 · 寒意 3/120 · 武霜·居合 2/3 · 淬寒·枯霜 0/2 · 锻雪·归刃 0/0

### 1109 洛瑟菈（WARN，模块 v0.1 · medium，1109_lucilla.js）

- 配置：单人 lucilla_solo.json；队伍 team_hiyuki.json；定位 support（模块 audit）
- 单人 25s：162,718，`A A A E A A R A A A A A A A A A A A A E A A`
- 单人 40s：269,216，`A A A E A A R A A A A A A A A A A A A A A E A A A A A A A R A A A A`
- 队伍 team_hiyuki.json：634,519，个人占比 5%，`S2 E S1 A H R E A R S3 R S1 A H E S3 S1 A A A A H A A A A A A A A A S2 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：历历在目 ×1（时停 4.4s，伤害 2.3%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 27.3%；R×2；资源消耗 照片
- 专武：PASS — 存帧 第 1/4（队伍 team_hiyuki.json）；排名：存帧（专武） > 漪澜浮录 -5.2% > 玻色星仪 -5.3% > 清音 -5.4%
- 异常：PASS — chafe 占 3.5%（单人 25s）
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 2.3%（单人） / 0%（队伍）；占战斗时间 17.7%，按动画 35.3%（时停 4.4s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 94.1% · 配置 0% · 模块估计 5.9% · 默认 0%
- 队伍：WARN — 队伍 team_hiyuki.json：上场动作 2 个，R×0，变奏/延奏 1 次（队伍中也不放 R）；个人占比 5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：印象 0/0 · 照片 2/3 · 胶卷 0/10

### 1110 穗穗（EXPECTED，模块 v0.1 · low，1110_suisui.js）

- 配置：单人 suisui_solo.json；队伍 team_hiyuki.json；定位 support（模块 audit）
- 单人 25s：56,473，`E A A A A A E A E A A A A A A A A E H A H H A A A A E E`
- 单人 40s：80,285，`E A A A A A E A E A A A A A A A E A H H H E A A A A A A A E A E H A H A H A E H A H`
- 队伍 team_hiyuki.json：634,519，个人占比 6.7%，`S2 E S1 A H R E A R S3 R S1 A H E S3 S1 A A A A H A A A A A A A A A S2 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（队伍）：康衢之谣 ×1（时停 4.4s，伤害 0%，冷却 25s 上限 2）
- 搜索：EXPECTED — 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查）
- 专武：PASS — 栖霞饮露 第 1/4（队伍 team_hiyuki.json）；排名：栖霞饮露（专武） > 星序协响 -4.3% > 掣傀之手 -4.5% > 和光回唱 -4.7%
- 异常：PASS — chafe 占 6.4%（单人 25s）
- 耐力：PASS — 重击占动作 19%（40s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0%，按动画 0%（时停 0s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_hiyuki.json：上场动作 2 个，R×1，变奏/延奏 2 次；个人占比 6.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：濯雨时 1/1 · 水云息 2/120 · 芳菲信 1/600

### 1202 炽霞（PASS，模块 v0.1 · medium，1202_chixia.js）

- 配置：单人 chixia_solo.json；队伍 无；定位 dps（模块 audit）
- 单人 25s：209,561，`E E A A A A E A R E A A A A A E A E A A A E A`
- 单人 40s：322,602，`E E A A A A E R A E A A A A A E A E A A A E A A A A A A A E A E A A A A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 时停动作（单人）：炽烈焰火 ×1（时停 3.5s，伤害 20.3%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 30.4%；R×1；资源消耗 热压弹/咻咻斗意次数
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 20.3%（单人）；占战斗时间 14.1%，按动画 28.1%（时停 3.5s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 86.5% · 配置 0% · 模块估计 13.5% · 默认 0%
- 队伍：SKIP — 无队伍配置
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：热压弹 5/36 · 咻咻斗意次数 4/1

### 1203 安可（PASS，模块 v0.1 · medium，1203_encore.js）

- 配置：单人 encore_solo.json；队伍 team_encore.json；定位 dps（模块 audit）
- 单人 30s：229,519，`E E R A A A A E H A E A E H E A H H H H A A A A A E E A A A A A`
- 单人 40s：303,604，`E E R A A A A E H A E A E H E H H A H H H H H E E A A A A A H A A E E R A A A A`
- 队伍 team_encore.json：438,692，个人占比 65.7%，`R E S2 R E H S1 E E R A A A A H S2 E S1 E A A A A S3 E S2 H Q S1 E E S2 R H E S1 A A A A A`
- 模式 单人：30s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：黑咩大暴走 ×1（时停 2.3s，伤害 0%，冷却 16s 上限 2）
- 时停动作（队伍）：黑咩大暴走 ×1（时停 2.3s，伤害 0%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 20%；R×2；资源消耗 失序值/黑咩大暴走
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 25%（40s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0.2%，按动画 7.9%（时停 2.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_encore.json 个人占比 65.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：失序值 2/100 · 黑咩大暴走 1/1

### 1204 莫特斐（PASS，模块 v0.1 · medium，1204_mortefi.js）

- 配置：单人 mortefi_solo.json；队伍 team_mortefi.json；定位 support（模块 audit）
- 单人 25s：85,572，`E R A A A A A A E A A A A A A A A A A A E A A E A A A A E R A A A A A A H`
- 单人 40s：129,259，`E R A A A A A A E A A A A A A A A A A A E A A E A A A A E R A A A A A A A A A E A A A A E A A A E A A A A A A A A`
- 队伍 team_mortefi.json：522,639，个人占比 3.7%，`R S1 R H A A A H E A H E A H A A S3 R E S1 A A A E A A A H E A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：暴烈终曲 ×2（时停 2s，伤害 5%，冷却 20s 上限 2，最小间隔 20.1s）
- 时停动作（队伍）：暴烈终曲 ×1（时停 2s，伤害 0.4%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 24.6%；R×2；资源消耗 怒气值/浮翼狂想/节奏自由
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 2.7%（25s）
- 时停：PASS — 含时停动作 伤害 5%（单人） / 0.4%（队伍）；占战斗时间 0.4%，按动画 16.4%（时停 4s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_mortefi.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 3.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：怒气值 5/100 · 浮翼狂想 2/1 · 节奏自由 2/25

### 1205 长离（PASS，模块 v0.1 · medium，1205_changli.js）

- 配置：单人 changli_solo_search.json；队伍 team_aemeath.json；定位 dps（signature_weapons.json）
- 单人 20s：216,321，`E Q R H A E A A A A A A E A H H H H H`
- 单人 40s：427,072，`E R Q H A E A A A A A A E A H A A A A H A Q E A A A A A A A A A A A H E R H A`
- 队伍 team_aemeath.json：496,412，个人占比 64.8%，`R S2 R S1 R S2 E Q H A E A S3 E Q S2 H E A A A A A A H S1 A A E E S2 E A`
- 模式 单人：20s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：离火照丹心 ×1（时停 3.2s，伤害 17.9%，冷却 20s 上限 2）
- 时停动作（队伍）：离火照丹心 ×1（时停 3.2s，伤害 9.2%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 23.1%；R×2；资源消耗 离火/赫羽三相次数/心眼
- 专武：PASS — 赫奕流明 第 1/4（单人 20s）；排名：赫奕流明（专武） > 千古洑流 -14.2% > 镭射切变 -22.6% > 翼锋 -28.6%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 31.6%（20s）
- 时停：PASS — 含时停动作 伤害 17.9%（单人） / 9.2%（队伍）；占战斗时间 0.2%，按动画 16%（时停 3.2s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_aemeath.json 个人占比 64.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：离火 4/4 · 赫羽三相次数 4/1 · 心眼 9/1

### 1206 布兰特（PASS，模块 v0.1 · low，1206_brant.js）

- 配置：单人 brant_solo.json；队伍 team_brant.json；定位 subdps（模块 audit）
- 单人 25s：305,890，`E R A E A A E E A A E A A E A E A A`
- 单人 40s：482,010，`E R A E A A E E A A E A A E E A A R E A E A E A A E A`
- 队伍 team_brant.json：382,621，个人占比 64.8%，`R A E A E E A A A E A E S1 E R E H H S3 R S1`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：直到世界尽头 ×1（时停 3.9s，伤害 5.1%，冷却 24s 上限 2）
- 时停动作（队伍）：直到世界尽头 ×1（时停 3.9s，伤害 4.1%，冷却 24s 上限 2）
- 搜索：PASS — 最高单动作占比 29.6%；R×2；资源消耗 喝彩/燃焰/空中
- 专武：PASS — 不灭航路 第 1/4（队伍 team_brant.json）；排名：不灭航路（专武） > 镭射切变 -10% > 千古洑流 -16% > 翼锋 -21.6%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 5.1%（单人） / 4.1%（队伍）；占战斗时间 15.7%，按动画 31.5%（时停 3.9s，口径 exclude）
- 链：PASS — 1
- 时长：PASS — 帧 51.9% · 配置 0% · 模块估计 48.1% · 默认 0%
- 队伍：PASS — 队伍 team_brant.json：上场动作 12 个，R×1，变奏/延奏 1 次；个人占比 64.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：喝彩 3/100 · 燃焰 2/1 · 空中 3/1

### 1207 露帕（PASS，模块 v0.1 · medium，1207_lupa.js）

- 配置：单人 lupa_solo.json；队伍 team_lupa.json；定位 subdps（模块 audit）
- 单人 25s：167,257，`R H H A A A E E E A A H H E A A A A E E R H H A E`
- 单人 40s：240,768，`R H H A A A E E E A A H H E A A A A E E R H H A E A A A A H E H E A A A A A A H`
- 队伍 team_lupa.json：577,161，个人占比 20.7%，`R H S1 R H E A H E A H A A A H S3 R E S2 H H A A E E E A A A H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：荣光欢酣于火 ×2（时停 3.7s，伤害 20.4%，冷却 20s 上限 2，最小间隔 21.18s）
- 时停动作（队伍）：荣光欢酣于火 ×1（时停 3.7s，伤害 2.4%，冷却 20s 上限 2）；你无法逃离！ ×1（时停 1.4s，伤害 7%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 15%；R×2；资源消耗 狼焰/狼魂/赛点沸腾
- 专武：PASS — 焰痕 第 1/4（队伍 team_lupa.json）；排名：焰痕（专武） > 苍鳞千嶂 -2.7% > 源能机锋 -3.5% > 浩境粼光 -3.9%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 24%（25s）
- 时停：PASS — 含时停动作 伤害 20.4%（单人） / 9.4%（队伍）；占战斗时间 0.4%，按动画 29.7%（时停 7.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 70% · 配置 0% · 模块估计 30% · 默认 0%
- 队伍：PASS — 队伍 team_lupa.json：上场动作 14 个，R×1，变奏/延奏 2 次；个人占比 20.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：狼焰 8/100 · 狼魂 3/2 · 赛点沸腾 2/1 · 追猎攻击 0/1

### 1208 嘉贝莉娜（PASS，模块 v0.1 · low，1208_galbrena.js）

- 配置：单人 galbrena_solo.json；队伍 team_galbrena.json；定位 dps（模块 audit）
- 单人 25s：280,093，`H E R A H H H A A H E H A A A A A A A H H A A H A H H A A E H A H H H`
- 单人 40s：458,610，`H E R A H H H A A H E H A A A A A A A H H A A H A A A H E H A A A A A A A H H A A H A A A H E R H H H A`
- 队伍 team_galbrena.json：480,394，个人占比 76.6%，`R S1 H R H H H A A H E A A A A A A A S2 S3 R E S2 E A A A H A S1 H H A A H H H E H H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 17.3%；R×2；资源消耗 罪火/净炼火/恶魔位格
- 专武：PASS — 光影双生 第 1/4（单人 25s）；排名：光影双生（专武） > 溢彩荧辉 -17.7% > 相位涟漪 -19.4% > 死与舞 -20.8%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 42.9%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 6
- 时长：PASS — 帧 96.2% · 配置 0% · 模块估计 3.8% · 默认 0%
- 队伍：PASS — 队伍 team_galbrena.json 个人占比 76.6%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：罪火 3/100 · 净炼火 20/100 · 余火 0/0 · 恶魔位格 2/1 · 死运既定 0/4

### 1209 莫宁（PASS，模块 v0.1 · medium，1209_mornye.js）

- 配置：单人 mornye_solo.json；队伍 team_lupa.json；定位 support（模块 audit）
- 单人 25s：39,686，`A A R A A E A A A H E A A A A H A A A A H A A A A A H A A A A H A A A A H`
- 单人 40s：67,473，`A A R A A E A A A H E A A A A H A A A A H A A A A A H A A A A H A A A E H A R A A A A H A A A A H A A A A A H A A A A`
- 队伍 team_lupa.json：577,161，个人占比 3.7%，`R H S1 R H E A H E A H A A A H S3 R E S2 H H A A E E E A A A H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：临界协议 ×1（时停 5s，伤害 22.1%，冷却 25s 上限 2）
- 时停动作（队伍）：临界协议 ×1（时停 5s，伤害 2.5%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 20.3%；R×2；资源消耗 静质量能/相对动能/广域观测模式
- 专武：PASS — 宙算仪轨 第 1/4（队伍 team_lupa.json）；排名：宙算仪轨（专武） > 时和岁稔 -1.6% > 浩境粼光 -1.7% > 源能机锋 -1.8%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 16.2%（25s）
- 时停：PASS — 含时停动作 伤害 22.1%（单人） / 2.5%（队伍）；占战斗时间 0.2%，按动画 20.2%（时停 5s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_lupa.json：上场动作 3 个，R×1，变奏/延奏 2 次；个人占比 3.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：静质量能 1/100 · 相对动能 8/100 · 广域观测模式 1/1

### 1210 爱弥斯（PASS，模块 v0.2 · medium，1210_aemeath.js）

- 配置：单人 aemeath_solo.json；队伍 team_aemeath.json；定位 dps（signature_weapons.json）
- 单人 30s：315,693，`E A E R A A A E A A E A A A E A A A E A E E H R`
- 单人 40s：388,405，`A R A A A E E A A E A A A E A A A E A A A E H R E A A A E A A A E`
- 队伍 team_aemeath.json：496,412，个人占比 33.6%，`R S2 R S1 R S2 E Q H A E A S3 E Q S2 H E A A A A A A H S1 A A E E S2 E A`
- 模式 单人：30s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：飞至启明之时·星辉破界而来·过载 ×1（时停 4.4s，伤害 11%，冷却 25s 上限 2）；为寂静赋形·光翼共奏·登台 ×2（时停 1s，伤害 7.9%，模块资源/无（未独立核对），最小间隔 8.1s）；为寂静赋形·光翼共奏·降临 ×1（时停 1.7s，伤害 3.9%，模块资源/无（未独立核对））；飞至启明之时·星辉破界而来·终结 ×1（时停 5.7s，伤害 14.9%，冷却 25s 上限 2）
- 时停动作（队伍）：飞至启明之时·星辉破界而来·过载 ×1（时停 4.4s，伤害 14.4%，冷却 25s 上限 2）；为寂静赋形·光翼共奏·登台 ×1（时停 1s，伤害 5.5%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 16.7%；R×2；资源消耗 同步率/共鸣率/形态/于此释放（秒）/光翼共奏之时/聚爆轨迹
- 专武：PASS — 永远的启明星 第 1/4（单人 30s）；排名：永远的启明星（专武） > 千古洑流 -11.8% > 镭射切变 -18.9% > 翼锋 -21.7%
- 异常：PASS — burst 占 38.2%（单人 30s）
- 耐力：PASS — 重击占动作 4.2%（30s）
- 时停：PASS — 含时停动作 伤害 37.7%（单人） / 19.9%（队伍）；占战斗时间 40.6%，按动画 86.2%（时停 13.7s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_aemeath.json 个人占比 33.6%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：同步率 5/200 · 共鸣率 1/4 · 形态 5/2 · 于此释放（秒） 22/60 · 光翼共奏之时 4/1 · 聚爆轨迹 4/6

### 1211 达妮娅（PASS，模块 v0.1 · low，1211_denia.js）

- 配置：单人 denia_solo.json；队伍 team_denia.json；定位 subdps（模块 audit）
- 单人 25s：141,198，`A A A R A A A A E A R E H H A A A A H A A A A H A A A A A A A`
- 单人 40s：233,457，`E R A A A A E A R H H H H H H H H H H H A A A A A A A A H H H R A A E A A A`
- 队伍 team_denia.json：653,875，个人占比 2.4%，`A R S3 R S2 R S1 A A E A A A E A A A E A A A E E E H R S2`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：帷幕终景·布景之形 ×1（时停 4.2s，伤害 7.6%，冷却 25s 上限 2）；帷幕终景·幻灭之形 ×1（时停 2.2s，伤害 20.1%，冷却 25s 上限 2）
- 时停动作（队伍）：帷幕终景·布景之形 ×1（时停 4.2s，伤害 1.6%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 36.8%；R×3；资源消耗 幻灭之形/黯核/虚质粒子/共形能量
- 专武：PASS — 赝作的矮星 第 1/4（队伍 team_denia.json）；排名：赝作的矮星（专武） > 掣傀之手 -0.4% > 和光回唱 -0.5% > 星序协响 -1%
- 异常：PASS — burst 占 8.2%（单人 25s）
- 耐力：PASS — 重击占动作 36.8%（40s）
- 时停：PASS — 含时停动作 伤害 27.7%（单人） / 1.6%（队伍）；占战斗时间 11.9%，按动画 37.4%（时停 6.4s，口径 exclude）
- 链：PASS — 2
- 时长：PASS — 帧 78.9% · 配置 0% · 模块估计 21.1% · 默认 0%
- 队伍：PASS — 队伍 team_denia.json：上场动作 3 个，R×1，变奏/延奏 3 次；个人占比 2.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：幻灭之形 1/1 · 黯核 2/3 · 虚质粒子 9/84.9 · 共形能量 1/100

### 1212 景燃（PASS，模块 v0.1 · medium，1212_jingran.js）

- 配置：单人 jingran_solo.json；队伍 team_jingran.json；定位 dps（模块 audit）
- 单人 25s：256,903，`E A R H E A H A A A H A A A H A A A E A A A A H E`
- 单人 40s：339,643，`E A R H E A H A A A H A A A H A A A E A A A A H A A E A A A A A A A H E A A A A A A A`
- 队伍 team_jingran.json：556,619，个人占比 67.8%，`S2 R S1 R H A A A H E A H E A H S3 R S2 E H E A A A A A E A S3 E S2 A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：万鬼同葬 ×1（时停 4.7s，伤害 10.8%，冷却 25s 上限 2）
- 时停动作（队伍）：万鬼同葬 ×1（时停 4.7s，伤害 9.8%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 12%；R×1；资源消耗 负阴/炁/命火/行途
- 专武：PASS — 千般渡 第 1/4（单人 25s）；排名：千般渡（专武） > 苍鳞千嶂 -17.6% > 驭冕铸雷之权 -22.5% > 时和岁稔 -25.5%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 20%（25s）
- 时停：PASS — 含时停动作 伤害 10.8%（单人） / 9.8%（队伍）；占战斗时间 0.2%，按动画 18.9%（时停 4.7s，口径 exclude）
- 链：PASS — 2
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_jingran.json 个人占比 67.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：负阴 3/1 · 炁 6/300 · 命火 4/100 · 行途 3/3 · 鬼护 0/50

### 1301 卡卡罗（PASS，模块 v0.1 · medium，1301_calcharo.js）

- 配置：单人 calcharo_solo.json；队伍 team_calcharo.json；定位 dps（模块 audit）
- 单人 25s：194,507，`H E E E R A A A A A A A E E E A A A H H H H E E E H`
- 单人 40s：282,876，`H E E E R A A A A A A A E E E A A H H H H E E E A A A A A H H H A E E E H H H H`
- 队伍 team_calcharo.json：188,594，个人占比 35.4%，`E A A A E H A A R A A A E E A H A A A S1 E E E R H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：幻影蚀刻 ×1（时停 1.7s，伤害 9.6%，冷却 20s 上限 2）
- 时停动作（队伍）：幻影蚀刻 ×1（时停 1.7s，伤害 15.1%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 20%；R×1；资源消耗 残忍/杀意/杀戮武装（秒）
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 30%（40s）
- 时停：PASS — 含时停动作 伤害 9.6%（单人） / 15.1%（队伍）；占战斗时间 6.7%，按动画 13.4%（时停 1.7s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 57.5% · 配置 0% · 模块估计 42.5% · 默认 0%
- 队伍：PASS — 队伍 team_calcharo.json 个人占比 35.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：残忍 3/3 · 杀意 2/5 · 杀戮武装（秒） 13/11

### 1302 吟霖（WARN，模块 v0.1 · medium，1302_yinlin.js）

- 配置：单人 yinlin_solo.json；队伍 team_yinlin.json；定位 subdps（模块 audit）
- 单人 25s：119,560，`E R E A A A H Q A A A E E A H A A A H A A A H A A E`
- 单人 40s：213,982，`E R E A A A H Q A H E E A H A A A A H A A A H E E H R Q A A A A E E H`
- 队伍 team_yinlin.json：317,164，个人占比 6.4%，`R S1 R H E H E H E A A A S3 R E S1 E H E H A S2`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：破天雷灭击 ×1（时停 3.2s，伤害 15.4%，冷却 16s 上限 2）
- 时停动作（队伍）：破天雷灭击 ×1（时停 3.2s，伤害 5.1%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 23.1%；R×2；资源消耗 审判值/磁殛状态
- 专武：WARN — 掣傀之手 第 2/4，落后 0%（队伍 team_yinlin.json；在搜索噪声内）；排名：漪澜浮录 +0% > 掣傀之手（专武） > 玻色星仪 -0.9% > 清音 -1.3%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 20%（40s）
- 时停：PASS — 含时停动作 伤害 15.4%（单人） / 5.1%（队伍）；占战斗时间 12.8%，按动画 25.6%（时停 3.2s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_yinlin.json：上场动作 2 个，R×1，变奏/延奏 2 次；个人占比 6.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：审判值 4/100 · 磁殛状态 12/4 · 惩罚印记 0/1

### 1303 渊武（PASS，模块 v0.1 · medium，1303_yuanwu.js）

- 配置：单人 yuanwu_solo.json；队伍 team_yuanwu.json；定位 support（模块 audit）
- 单人 25s：69,622，`E H R A E A A A A A A A A A A A A A A A H H E H H H H H H H H H A H A A E E A A A A A A`
- 单人 40s：114,919，`E H R A A E A A A A A A A A A A A A A E H H H H H H H H H E H H H A A A E A E A A A A A A A A A A A E A A A H H H H R A E A A A A A A`
- 队伍 team_yuanwu.json：255,274，个人占比 5.7%，`E R S1 E R A E A A A E E A H E H H E A H E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：寂土重明 ×1（时停 2.2s，伤害 14.8%，冷却 20s 上限 2）
- 时停动作（队伍）：寂土重明 ×1（时停 2.2s，伤害 4%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 29.5%；R×2；资源消耗 锋芒/雷之楔（秒）/雷厉风行（秒）
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 29.5%（25s）
- 时停：PASS — 含时停动作 伤害 14.8%（单人） / 4%（队伍）；占战斗时间 8.9%，按动画 17.9%（时停 2.2s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_yuanwu.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 5.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：锋芒 1/100 · 雷之楔（秒） 56/12 · 雷厉风行（秒） 42/10

### 1304 今汐（WARN，模块 v0.1 · medium，1304_jinhsi.js）

- 配置：单人 jinhsi_solo.json；队伍 team_buling.json；定位 dps（signature_weapons.json）
- 单人 20s：200,424，`R E A A A A E A E A A A E E H Q A E A H`
- 单人 40s：283,825，`R E A A A A E A E A A A E E H H E H H E H H E H Q E H A A A A E E A`
- 队伍 team_buling.json：434,850，个人占比 70.5%，`R S2 R S1 R E A A A E A E E S2 E E E H E A H E A H E S1 E`
- 模式 单人：20s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：移岁诛邪 ×1（时停 3.9s，伤害 21.8%，冷却 24s 上限 1）；惊龙破空（韶光 50） ×1（时停 2.2s，伤害 39.4%，模块资源/无（未独立核对））
- 时停动作（队伍）：移岁诛邪 ×1（时停 3.9s，伤害 14.3%，冷却 24s 上限 2）；惊龙破空（韶光 50） ×1（时停 2.2s，伤害 33.9%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 23.5%；R×1；资源消耗 韶光/形态
- 专武：PASS — 时和岁稔 第 1/4（单人 20s）；排名：时和岁稔（专武） > 浩境粼光 -13.5% > 源能机锋 -17% > 纹秋 -21.4%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 23.5%（40s）
- 时停：WARN — 含时停动作 伤害 61.2%（单人） / 48.2%（队伍）；占战斗时间 14.8%，按动画 45%（时停 6.1s，口径 exclude） > 50%（结果依赖“时停不计时”口径）
- 链：PASS — 6
- 时长：PASS — 帧 97.1% · 配置 0% · 模块估计 0% · 默认 2.9%
- 队伍：PASS — 队伍 team_buling.json 个人占比 70.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：韶光 1/50 · 形态 1/3

### 1305 相里要（WARN，模块 v0.1 · medium，1305_xiangliyao.js）

- 配置：单人 xiangliyao_solo.json；队伍 team_xiangliyao.json；定位 dps（模块 audit）
- 单人 25s：250,428，`E H R E A E A A A E A E A E E H H H H H E A A E H H A A A`
- 单人 40s：395,386，`E H R E A E A A A E A E A E E H H H H H E A E A H H H A H A E E A A A H H E A A A E A A A R E`
- 队伍 team_xiangliyao.json：323,710，个人占比 89.4%，`R S1 E R E A E A A A E E A E H E S2 A E E A S1 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：思维矩阵 ×1（时停 4.3s，伤害 16.5%，冷却 25s 上限 2）
- 时停动作（队伍）：思维矩阵 ×1（时停 4.3s，伤害 19.3%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 27.6%；R×2；资源消耗 演算效能/超算效能/幻方
- 专武：WARN — 诸方玄枢 第 2/4，落后 0.1%（单人 25s；在搜索噪声内）；排名：焰光裁定 +0.1% > 诸方玄枢（专武） > 擎渊怒涛 -2.9% > 袍泽之固 -36%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 27.6%（25s）
- 时停：PASS — 含时停动作 伤害 16.5%（单人） / 19.3%（队伍）；占战斗时间 12%，按动画 29.3%（时停 4.3s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_xiangliyao.json 个人占比 89.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：演算效能 3/100 · 超算效能 3/5 · 幻方 3/3

### 1306 奥古斯塔（WARN，模块 v0.1 · medium，1306_augusta.js）

- 配置：单人 augusta_solo.json；队伍 team_augusta.json；定位 dps（模块 audit）
- 单人 25s：388,251，`E E H R H A H H A E H E A A R A A H A E E A A A H A A A A H A A A A H`
- 单人 40s：669,390，`E E H R H A H H A E A A H R H A H H A E E A A A A A H A A A A A E A A H A H H A E E R A A A E A A R H`
- 队伍 team_augusta.json：567,878，个人占比 99.4%，`R E S1 R E E H H A E A A R S2 S1 H H A H H A H H A E E A A A H A E S2 E S1 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：共鸣解放·赫日威临（烈阳×9 + 不朽者之肃） ×1（时停 8.4s，伤害 21.6%，冷却 25s 上限 2）
- 时停动作（队伍）：共鸣解放·赫日威临（烈阳×9 + 不朽者之肃） ×1（时停 8.4s，伤害 20.5%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 25.7%；R×4；资源消耗 战势/权炳/威慑/以众愿为冕
- 专武：WARN — 驭冕铸雷之权 第 2/4，落后 0.5%（单人 25s；在搜索噪声内）；排名：苍鳞千嶂 +0.5% > 驭冕铸雷之权（专武） > 时和岁稔 -7.6% > 源能机锋 -9.9%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 45.7%（25s）
- 时停：PASS — 含时停动作 伤害 21.6%（单人） / 20.5%（队伍）；占战斗时间 0.2%，按动画 33.7%（时停 8.4s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 80.4% · 配置 0% · 模块估计 0% · 默认 19.6%
- 队伍：PASS — 队伍 team_augusta.json 个人占比 99.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：战势 10/100 · 权炳 3/100 · 威慑 2/2 · 以众愿为冕 1/1

### 1307 卜灵（PASS，模块 v0.1 · medium，1307_buling.js）

- 配置：单人 buling_solo.json；队伍 team_buling.json；定位 support（模块 audit）
- 单人 25s：23,424，`R E A H A A A A H A A A A A A A A A H A H E A A A A H A A A A A H`
- 单人 40s：46,221，`R E A A A A H A H A A A A A A A A A H A H E A A H A A A A A A A A H A A A H A H A R A A H A A A A E H A`
- 队伍 team_buling.json：434,850，个人占比 0.6%，`R S2 R S1 R E A A A E A E E S2 E E E H E A H E A H E S1 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：飞雷诀 ×1（时停 3.9s，伤害 11.7%，冷却 24s 上限 2）
- 时停动作（队伍）：飞雷诀 ×1（时停 3.9s，伤害 0.6%，冷却 24s 上限 2）
- 搜索：PASS — 最高单动作占比 21.2%；R×2；资源消耗 卦象（艮=1 震=2，左→右）/少阳+少阴/五雷荡煞阵（秒）
- 专武：SKIP — 无专武
- 异常：PASS — flare 占 9.1%（单人 40s）
- 耐力：PASS — 重击占动作 19.2%（40s）
- 时停：PASS — 含时停动作 伤害 11.7%（单人） / 0.6%（队伍）；占战斗时间 0.9%，按动画 16.3%（时停 3.9s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 61.5% · 配置 0% · 模块估计 38.5% · 默认 0%
- 队伍：PASS — 队伍 team_buling.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 0.6%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：卦象（艮=1 震=2，左→右） 11/2121 · 少阳+少阴 1/2 · 五雷荡煞阵（秒） 10/24

### 1308 丽贝卡（PASS，模块 v0.1 · medium，1308_rebecca.js）

- 配置：单人 rebecca_solo.json；队伍 team_rebecca.json；定位 support（模块 audit）
- 单人 25s：171,618，`H E R A A H E E H H H H E H H H H H H H`
- 单人 40s：264,188，`H E R A A H E E H H H E H A E H H H H H H H H E A H E A A H H`
- 队伍 team_rebecca.json：250,262，个人占比 26.5%，`E H R A A S1 E R E H H H H E S3 R S1 A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：狂欢时间！ ×1（时停 3s，伤害 0%，冷却 25s 上限 2）
- 时停动作（队伍）：狂欢时间！ ×1（时停 3s，伤害 0%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 45.2%；R×1；资源消耗 模式（0 猎手 / 1 铁胆）/狂热/手感火热/小孩子才做选择！（秒）
- 专武：PASS — 碎骨 第 1/4（队伍 team_rebecca.json）；排名：碎骨（专武） > 华彩乐段 -0.1% > 蜃影 -0.1% > 飞逝 -0.1%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 65%（25s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0.2%，按动画 12.2%（时停 3s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 96.8% · 配置 0% · 模块估计 3.2% · 默认 0%
- 队伍：PASS — 队伍 team_rebecca.json：上场动作 5 个，R×1，变奏/延奏 1 次；个人占比 26.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：模式（0 猎手 / 1 铁胆） 3/1 · 狂热 2/120 · 手感火热 14/120 · 小孩子才做选择！（秒） 13/10.6

### 1309 漂泊者·导电（PASS，模块 v0.1 · medium，1309_rover_electro.js）

- 配置：单人 rover_electro_solo.json；队伍 team_rover_electro.json；定位 subdps（模块 audit）
- 单人 25s：183,332，`E A A R A A A A A A A E E E E E E E E E E E E E E E E E E E E`
- 单人 40s：318,938，`E A R A A A A A A A A E A E A E E E E E E E E E E E E E E E E E A A E A A A A A A E E E R E E E E E`
- 队伍 team_rover_electro.json：404,623，个人占比 8.3%，`E R S1 A E H R A E H H H E A A A A H R E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：最终战略 ×1（时停 3.7s，伤害 15.8%，冷却 25s 上限 2）
- 时停动作（队伍）：最终战略 ×1（时停 3.7s，伤害 7.2%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 10%；R×2；资源消耗 电涌/霆怒
- 专武：SKIP — 无专武
- 异常：PASS — flare 占 6.5%（单人 25s）
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 15.8%（单人） / 7.2%（队伍）；占战斗时间 0.2%，按动画 15.1%（时停 3.7s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 96% · 配置 0% · 模块估计 4% · 默认 0%
- 队伍：PASS — 队伍 team_rover_electro.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 8.3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：电涌 2/120 · 霆怒 26/100

### 1310 漂泊者·导电（PASS，模块 v0.1 · medium，1309_rover_electro.js）

- 配置：单人 rover_electro_f_solo.json；队伍 team_rover_electro_f.json；定位 subdps（模块 audit）
- 单人 25s：183,332，`E A A R A A A A A A A E E E E E E E E E E E E E E E E E E E E`
- 单人 40s：318,938，`E A R A A A A A A A A E A E A E E E E E E E E E E E E E E E E E A A E A A A A A A E E E R E E E E E`
- 队伍 team_rover_electro_f.json：404,623，个人占比 8.3%，`E R S1 A E H R A E H H H E A A A A H R E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：最终战略 ×1（时停 3.7s，伤害 15.8%，冷却 25s 上限 2）
- 时停动作（队伍）：最终战略 ×1（时停 3.7s，伤害 7.2%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 10%；R×2；资源消耗 电涌/霆怒
- 专武：SKIP — 无专武
- 异常：PASS — flare 占 6.5%（单人 25s）
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 15.8%（单人） / 7.2%（队伍）；占战斗时间 0.2%，按动画 15.1%（时停 3.7s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 96% · 配置 0% · 模块估计 4% · 默认 0%
- 队伍：PASS — 队伍 team_rover_electro_f.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 8.3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：电涌 2/120 · 霆怒 26/100

### 1311 心（WARN，模块 v0.2 · low，1311_hsin.js）

- 配置：单人 hsin_solo.json；队伍 team_hsin_jinhsi.json；定位 subdps（模块 audit）
- 单人 40s：245,702，`E A H A A A H R E H H H H H H H H E A A A A H R H A A A H A A H H A`
- 单人 40s：245,702，`E A H A A A H R E H H H H H H H H E A A A A H R H A A A H A A H H A`
- 队伍 team_hsin_jinhsi.json：500,029，个人占比 39.3%，`R S2 S1 R E A A E A A E S2 H S3 E S1 E S2 A A H A H A H A H A A E H A A`
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：转相 ×1（时停 4.2s，伤害 0%，冷却 25s 上限 2）；万相流转，此心自明·共鸣技能·照世相·万阙连衡 ×1（时停 0.5s，伤害 8.6%，冷却 12s 上限 4）；万相流转，此心自明·重击·照世相·镇寰宇 ×1（时停 2.5s，伤害 10.4%，模块资源/无（未独立核对））；引枢作清辉·万阙垂天 ×1（时停 5s，伤害 19.4%，能量）
- 搜索：PASS — 最高单动作占比 23.5%；R×2；资源消耗 应世心/照世心/相/统御众机（秒）/敕令
- 专武：PASS — 玉阙玄华 第 1/4（队伍 team_hsin_jinhsi.json）；排名：玉阙玄华（专武） > 漪澜浮录 -6.3% > 玻色星仪 -8.8% > 清音 -9.3%
- 异常：PASS — flare 占 11.8%（单人 40s，module.mode='flare'（默认模式下 0%））
- 耐力：PASS — 重击占动作 44.1%（40s）
- 时停：PASS — 含时停动作 伤害 38.5%（单人） / 0%（队伍）；占战斗时间 23.3%，按动画 54%（时停 12.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：WARN — 队伍 team_hsin_jinhsi.json：上场动作 18 个，R×0，变奏/延奏 3 次（队伍中也不放 R）；个人占比 39.3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：应世心 2/100 · 照世心 4/300 · 相 1/2 · 统御众机（秒） 5/13 · 敕令 14/21
- 注：模块 audit.note：专武效果需响应同奏，单人窗口无法触发 → 按队伍排名（modules2.test 同口径）

### 1312 锁暝（PASS，模块 v0.1 · low，1312_suoming.js）

- 配置：单人 suoming_solo.json；队伍 team_suoming.json；定位 subdps（模块 audit）
- 单人 25s：166,620，`R H H H H H H H H H E A E`
- 单人 40s：212,183，`H H R H H H H H H H H E A A A A A A E A A A A A A A A A E A`
- 队伍 team_suoming.json：305,457，个人占比 57.8%，`S1 S3 R S2 R S1 H A R S2 H H H H H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 38.5%；R×1；资源消耗 念深/妄执/同奏（秒）
- 专武：PASS — 沉冥 第 1/4（队伍 team_suoming.json）；排名：沉冥（专武） > 赫奕流明 -0.2% > 千古洑流 -1.3% > 行进序曲 -5.1%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 69.2%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_suoming.json：上场动作 9 个，R×1，变奏/延奏 4 次；个人占比 57.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：念深 1/1 · 妄执 1/800 · 同奏（秒） 4/5

### 1402 秧秧（PASS，模块 v0.1 · medium，1402_yangyang.js）

- 配置：单人 yangyang_solo.json；队伍 team_yangyang.json；定位 support（模块 audit）
- 单人 25s：77,533，`R E H A H A H A H A H A H A H A A A E A A H A H R H A H A H A E H A A`
- 单人 40s：120,164，`R E H A H A H A H A H A H A H A H A E A A A A A R H H A A H A H A E H A H A A A A A H A H A A A R E A A A H A H A A`
- 队伍 team_yangyang.json：323,753，个人占比 6.5%，`S3 R S1 R E S3 E S1 A A A A A E A S2 H A R S1 S3 H S1 E A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：朔风旋涌 ×2（时停 2.2s，伤害 28.5%，冷却 16s 上限 2，最小间隔 16.45s）
- 时停动作（队伍）：朔风旋涌 ×1（时停 2.2s，伤害 4.9%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 22.9%；R×3；资源消耗 流响
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 37.1%（25s）
- 时停：PASS — 含时停动作 伤害 28.5%（单人） / 4.9%（队伍）；占战斗时间 17.7%，按动画 35.4%（时停 4.4s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_yangyang.json：上场动作 4 个，R×1，变奏/延奏 2 次；个人占比 6.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：流响 6/3

### 1403 秋水（PASS，模块 v0.1 · medium，1403_aalto.js）

- 配置：单人 aalto_solo.json；队伍 team_aalto.json；定位 support（模块 audit）
- 单人 25s：88,180，`E R A A A A A A A A A A A A A A A E H A A A A A A A A A A A A A A E A A H`
- 单人 40s：134,993，`A A E R A A A A A A A A A A A A A A E A H A A A A A A A A A A A A E A A A A A A A A A A A A A A A A E A A A A A A A A A A A A`
- 队伍 team_aalto.json：334,251，个人占比 7.6%，`S3 R S1 R E S3 E S1 A A A A A E A S2 E H R S1 E A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：雾里观花 ×1（时停 1.3s，伤害 8.2%，冷却 20s 上限 2）
- 时停动作（队伍）：雾里观花 ×1（时停 1.3s，伤害 2.9%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 19%；R×1；资源消耗 雾滴
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 5.4%（25s）
- 时停：PASS — 含时停动作 伤害 8.2%（单人） / 2.9%（队伍）；占战斗时间 6%，按动画 11.3%（时停 1.3s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 92.1% · 配置 0% · 模块估计 7.9% · 默认 0%
- 队伍：PASS — 队伍 team_aalto.json：上场动作 4 个，R×1，变奏/延奏 2 次；个人占比 7.6%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：雾滴 1/6

### 1404 忌炎（PASS，模块 v0.1 · medium，1404_jiyan.js）

- 配置：单人 jiyan_solo.json；队伍 team_jiyan.json；定位 dps（模块 audit）
- 单人 25s：213,027，`E R A A A A E A A A A A A A E A A A A A A A A A A E A A A`
- 单人 40s：318,635，`E A A A R A A A E A A A A A E A A A A A A A A A A E A A A A A A A A A A E A A A A A A A A A A E`
- 队伍 team_jiyan.json：372,960，个人占比 98.4%，`R E S1 E R A A A A A E A A A A A A A E A A A A A A A A A A E A A A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 16.7%；R×1；资源消耗 破阵值/破阵状态（秒）
- 专武：PASS — 苍鳞千嶂 第 1/4（单人 25s）；排名：苍鳞千嶂（专武） > 源能机锋 -6.2% > 浩境粼光 -9.2% > 纹秋 -20%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 24.1%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 6
- 时长：PASS — 帧 97.9% · 配置 0% · 模块估计 2.1% · 默认 0%
- 队伍：PASS — 队伍 team_jiyan.json 个人占比 98.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：破阵值 3/60 · 破阵状态（秒） 8/10 · 锐意之势（链6） 0/0
- 注：模块 audit.note：后动（Rhd）含 2.9s 冻结帧（时停未建模），搜索在 25s 内常选先 E 消耗破阵值；不列为必用招式

### 1405 鉴心（PASS，模块 v0.1 · medium，1405_jianxin.js）

- 配置：单人 jianxin_solo.json；队伍 team_danjin.json；定位 support（模块 audit）
- 单人 25s：123,238，`A E R A A A A A H E A A A A A A H H E`
- 单人 40s：201,460，`A E R A A A A A H E A A A A A A H H E A A A A A H A R E A A A A`
- 队伍 team_danjin.json：252,509，个人占比 7.2%，`S3 R S1 R S2 R E S1 E E A A E A E E E A A E E E H A E A E E E A A E H R A E E E A E H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 18.8%；R×2；资源消耗 气
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 15.8%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 0
- 时长：PASS — 帧 93.8% · 配置 0% · 模块估计 6.3% · 默认 0%
- 队伍：PASS — 队伍 team_danjin.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 7.2%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：气 3/120

### 1406 漂泊者·气动（WARN，模块 v0.1 · medium，1406_rover_aero.js）

- 配置：单人 rover_aero_solo.json；队伍 team_cartethyia_rover_aero.json；定位 support（模块 audit）
- 单人 25s：167,748，`R E A A H H A A E E A A E E E A A H H A A E A A E E E A A E H H A A E A E E R E`
- 单人 40s：260,476，`E A A R H H A A E E A A E E E A A H H A A E A A E E E A A H H A A E E A A E E E A A R H H A A E A E E E A A E H H A A E A E E E`
- 队伍 team_cartethyia_rover_aero.json：600,119，个人占比 3%，`R E S2 R S1 E R E A A E A A A H H H H R E S2 A A H S3 E S1 A A A S2 A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：万象归墟 ×2（时停 3.5s，伤害 12.4%，冷却 24s 上限 2，最小间隔 24.07s）
- 时停动作（队伍）：万象归墟 ×1（时停 3.5s，伤害 1.7%，冷却 24s 上限 2）
- 搜索：PASS — 最高单动作占比 23.4%；R×2；资源消耗 弦风息
- 专武：PASS — 血誓盟约 第 1/4（队伍 team_cartethyia_rover_aero.json）；排名：血誓盟约（专武） > 千古洑流 -5.8% > 镭射切变 -6% > 西升 -6.2%
- 异常：WARN — 源码会施加 erosion，但单人/队伍运行中占比 0%（未在 audit.anomaly 声明 → 视为条件施加；模块说明：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实）
- 耐力：PASS — 重击占动作 15.6%（40s）
- 时停：PASS — 含时停动作 伤害 12.4%（单人） / 1.7%（队伍）；占战斗时间 0.4%，按动画 28.5%（时停 7s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_cartethyia_rover_aero.json：上场动作 3 个，R×1，变奏/延奏 1 次；个人占比 3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：弦风息 10/120 · 蚀境象 0/0
- 注：模块 audit.note：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实

### 1407 夏空（WARN，模块 v0.1 · medium，1407_ciaccona.js）

- 配置：单人 ciaccona_solo.json；队伍 team_cartethyia_ciaccona.json；定位 subdps（模块 audit）
- 单人 25s：214,698，`E R H A A A A A A A A A E A A A H A A A A A A A E H A A A A`
- 单人 40s：361,698，`E R H A A A A A A A A A E A A A H A A A A A A A A E A A A H A A A A A A A E R A A A A A`
- 队伍 team_cartethyia_ciaccona.json：701,074，个人占比 32%，`R S2 R S1 E R E A A E A A A H H H H R E S2 A A H S1 H S2 A A E A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 20.5%；R×2；资源消耗 音律/音律独奏（秒）/演绎（秒）
- 专武：PASS — 林间的咏叹调 第 1/4（队伍 team_cartethyia_ciaccona.json）；排名：林间的咏叹调（专武） > 相位涟漪 -1.7% > 停驻之烟 -2.5% > 阳焰 -5.2%
- 异常：PASS — erosion 占 14.2%（单人 25s）
- 耐力：PASS — 重击占动作 10%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 6
- 时长：WARN — 帧 36.4% · 配置 0% · 模块估计 63.6% · 默认 0%
- 队伍：PASS — 队伍 team_cartethyia_ciaccona.json：上场动作 12 个，R×1，变奏/延奏 3 次；个人占比 32%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：音律 2/3 · 音律独奏（秒） 30/8 · 演绎（秒） 24/16

### 1408 漂泊者·气动（WARN，模块 v0.1 · medium，1406_rover_aero.js）

- 配置：单人 rover_aero_f_solo.json；队伍 team_cartethyia_rover_aero_f.json；定位 support（模块 audit）
- 单人 25s：167,748，`R E A A H H A A E E A A E E E A A H H A A E A A E E E A A E H H A A E A E E R E`
- 单人 40s：260,476，`E A A R H H A A E E A A E E E A A H H A A E A A E E E A A H H A A E E A A E E E A A R H H A A E A E E E A A E H H A A E A E E E`
- 队伍 team_cartethyia_rover_aero_f.json：600,119，个人占比 3%，`R E S2 R S1 E R E A A E A A A H H H H R E S2 A A H S3 E S1 A A A S2 A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：万象归墟 ×2（时停 3.5s，伤害 12.4%，冷却 24s 上限 2，最小间隔 24.07s）
- 时停动作（队伍）：万象归墟 ×1（时停 3.5s，伤害 1.7%，冷却 24s 上限 2）
- 搜索：PASS — 最高单动作占比 23.4%；R×2；资源消耗 弦风息
- 专武：PASS — 血誓盟约 第 1/4（队伍 team_cartethyia_rover_aero_f.json）；排名：血誓盟约（专武） > 千古洑流 -5.8% > 镭射切变 -6% > 西升 -6.2%
- 异常：WARN — 源码会施加 erosion，但单人/队伍运行中占比 0%（未在 audit.anomaly 声明 → 视为条件施加；模块说明：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实）
- 耐力：PASS — 重击占动作 15.6%（40s）
- 时停：PASS — 含时停动作 伤害 12.4%（单人） / 1.7%（队伍）；占战斗时间 0.4%，按动画 28.5%（时停 7s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_cartethyia_rover_aero_f.json：上场动作 3 个，R×1，变奏/延奏 1 次；个人占比 3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：弦风息 10/120 · 蚀境象 0/0
- 注：模块 audit.note：风蚀只来自 碧霄断行 的异常转化（需要队伍里有其它异常）+ 延奏上限 +3；卡提希娅队里没有可转化的异常 → 本人异常占比 0 属实

### 1409 卡提希娅（PASS，模块 v0.3 · low，1409_cartethyia.js）

- 配置：单人 cartethyia_solo.json；队伍 team_cartethyia.json；定位 dps（signature_weapons.json）
- 单人 25s：415,320，`E R R A A H H R A A A E E R A E R H H H H R A`
- 单人 40s：613,811，`E R R A A H H R A A A E E R A E R H A H H R A A A A H H E A A A A H H A A A A A A`
- 队伍 team_cartethyia.json：460,077，个人占比 99.7%，`R S1 E R E E R A A H R H H H H H H A R E S2 S1 A A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：听骑士从心祈愿 ×1（时停 3.3s，伤害 0%，冷却 25s 上限 2）；听骑士从心祈愿·看潮怒风哮之刃 ×1（时停 5s，伤害 23.3%，冷却 25s 上限 2）
- 时停动作（队伍）：听骑士从心祈愿 ×1（时停 3.3s，伤害 0%，冷却 25s 上限 2）；听骑士从心祈愿·看潮怒风哮之刃 ×1（时停 5s，伤害 24.2%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 14.6%；R×6；资源消耗 决意/风蚀效应（目标，动作结束时）/显化（秒）/剑之影/之心/之意/之力
- 专武：PASS — 不屈命定之冠 第 1/4（单人 25s）；排名：不屈命定之冠（专武） > 千古洑流 -27.5% > 翼锋 -27.6% > 镭射切变 -33.5%
- 异常：PASS — erosion 占 15.7%（单人 25s）
- 耐力：PASS — 重击占动作 21.7%（25s）
- 时停：PASS — 含时停动作 伤害 23.3%（单人） / 24.2%（队伍）；占战斗时间 20.3%，按动画 53.5%（时停 8.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_cartethyia.json 个人占比 99.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：决意 1/120 · 风蚀效应（目标，动作结束时） 3/3 · 显化（秒） 12/12 · 剑之影 3/3 · 之心/之意/之力 1/3

### 1410 尤诺（PASS，模块 v0.1 · medium，1410_iuno.js）

- 配置：单人 iuno_solo.json；队伍 team_iuno.json；定位 support（模块 audit）
- 单人 25s：219,753，`R A E H A E A A A A E H H A E H E E H E A A A`
- 单人 40s：406,864，`R A E H A E A A H E H E H H E E H A E A A A A E A R E H E A A A A A`
- 队伍 team_iuno.json：744,153，个人占比 3.8%，`R H S1 R E E H H A E A A H R H A H H A S3 R E S1 H A E E H E A A H A A A A H A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：溺失月海 ×1（时停 4s，伤害 10.7%，冷却 25s 上限 2）
- 时停动作（队伍）：溺失月海 ×1（时停 4s，伤害 3.2%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 13%；R×2；资源消耗 灵性/月相（1弦月/2新月）/苍白死光的祝颂
- 专武：PASS — 万物持存的注释 第 1/4（队伍 team_iuno.json）；排名：万物持存的注释（专武） > 脉冲协臂 0% > 擎渊怒涛 0% > 金掌 -0.8%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 21.7%（25s）
- 时停：PASS — 含时停动作 伤害 10.7%（单人） / 3.2%（队伍）；占战斗时间 0.7%，按动画 16.7%（时停 4s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_iuno.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 3.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：灵性 10/95 · 月相（1弦月/2新月） 3/2 · 苍白死光的祝颂 1/10

### 1411 仇远（PASS，模块 v0.1 · medium，1411_qiuyuan.js）

- 配置：单人 qiuyuan_solo.json；队伍 team_sigrika.json；定位 subdps（模块 audit）
- 单人 25s：203,928，`H A R E H A A A H A H A A A A H A H A A A A A A A A H A`
- 单人 40s：348,347，`H A R E H A A A A A A A A H A H A A A A E A A A A H A H A A A A H R A A A A H A H A H A H`
- 队伍 team_sigrika.json：542,564，个人占比 17.5%，`R E S1 R H A A A A H A A A E H H S2 A E A A A A S3 R S2 S1 A A A H A H A A A A H H H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：40s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：万钧一断 ×1（时停 3.8s，伤害 9%，冷却 25s 上限 2）
- 时停动作（队伍）：万钧一断 ×1（时停 3.8s，伤害 3%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 28.6%；R×2；资源消耗 挑灯问剑/淋漓醉墨
- 专武：PASS — 裁竹 第 1/4（队伍 team_sigrika.json）；排名：裁竹（专武） > 千古洑流 -3.7% > 血誓盟约 -7.6% > 西升 -12.3%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 25%（25s）
- 时停：PASS — 含时停动作 伤害 9%（单人） / 3%（队伍）；占战斗时间 0.2%，按动画 15.5%（时停 3.8s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_sigrika.json：上场动作 10 个，R×1，变奏/延奏 4 次；个人占比 17.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：挑灯问剑 9/600 · 淋漓醉墨 3/1

### 1412 西格莉卡（PASS，模块 v0.1 · medium，1412_sigrika.js）

- 配置：单人 sigrika_solo.json；队伍 team_sigrika.json；定位 dps（模块 audit）
- 单人 25s：191,908，`H R H E A A H E H H H H H H H H H H E A A A H H H H A`
- 单人 40s：305,181，`H R H E A A H E H H H H H H H H H H E A A A H H H H A A A E H H E A A E A H H H H`
- 队伍 team_sigrika.json：542,564，个人占比 82.5%，`R E S1 R H A A A A H A A A E H H S2 A E A A A A S3 R S2 S1 A A A H A H A A A A H H H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：40s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：如那期望般！ ×1（时停 3.8s，伤害 11.9%，冷却 25s 上限 2）
- 时停动作（队伍）：如那期望般！ ×1（时停 3.8s，伤害 8%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 51.9%；R×1；资源消耗 符文/句点/日灵能量/「天赋？」
- 专武：PASS — 昭日译注 第 1/4（单人 25s）；排名：昭日译注（专武） > 擎渊怒涛 -7.7% > 脉冲协臂 -8.1% > 金掌 -27%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 63%（25s）
- 时停：PASS — 含时停动作 伤害 11.9%（单人） / 8%（队伍）；占战斗时间 0.2%，按动画 15.4%（时停 3.8s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_sigrika.json 个人占比 82.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：符文 2/2 · 句点 2/100 · 日灵能量 1/30 · 「天赋？」 2/1 · 语义的祝福 0/0

### 1413 清宵（PASS，模块 v0.1 · medium，1413_qingxiao.js）

- 配置：单人 qingxiao_solo.json；队伍 team_qingxiao.json；定位 dps（模块 audit）
- 单人 25s：248,823，`A A E E R A E H A A A A A A A H A A A A A A A A A A A A`
- 单人 40s：394,000，`A E R A E A E H A A A A A A A H A A A A A A A E E A A A A E H A A A A A A H A A`
- 队伍 team_qingxiao.json：621,789，个人占比 72.4%，`R S1 R E S3 R E S2 E H H A H H H A A E S1 A A A H A A A A H S2 A E A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：天光云影沧澜兴 ×1（时停 5s，伤害 23.6%，冷却 25s 上限 2）；重击·天钧荡煞·昙体仙身（天心空明强化） ×1（时停 3s，伤害 25.8%，模块资源/无（未独立核对））
- 时停动作（队伍）：天光云影沧澜兴 ×1（时停 5s，伤害 16%，冷却 25s 上限 2）；重击·天钧荡煞·昙体仙身（天心空明强化） ×1（时停 3s，伤害 21%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 14.3%；R×1；资源消耗 琴心/剑韵/心剑意/昙体仙身
- 专武：PASS — 云琅 第 1/4（单人 25s）；排名：云琅（专武） > 千古洑流 -23.4% > 镭射切变 -33.1% > 西升 -37.3%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 10%（40s）
- 时停：PASS — 含时停动作 伤害 49.4%（单人） / 37%（队伍）；占战斗时间 12.2%，按动画 44.2%（时停 8s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_qingxiao.json 个人占比 72.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：琴心 2/100 · 剑韵 2/100 · 心剑意 2/100 · 昙体仙身 2/1 · 心识锁定（目标） 0/7

### 1501 漂泊者·衍射（PASS，模块 v0.1 · medium，1501_rover_spectro.js）

- 配置：单人 rover_spectro_solo.json；队伍 team_phoebe_rover.json；定位 subdps（模块 audit）
- 单人 25s：239,331，`R E A A A A A E A A A A E A A A E A A A A A A E A E A A A A A E A A A A R E A A A E A A A`
- 单人 40s：366,503，`R E A A A A A E A A A A E A A A E A A A A A A E A E A A A A A E A A A A R E A A A E A A A A E A E A A A A A E A A A A E H A A E A A A A H E`
- 队伍 team_phoebe_rover.json：459,203，个人占比 26%，`R E S2 R E S1 E R H A A A H H H S2 E A E S1 H H H H H H H E A A A H A A A H E A A S3`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：回响奏鸣 ×2（时停 2.2s，伤害 17.5%，冷却 20s 上限 2，最小间隔 20.37s）
- 时停动作（队伍）：回响奏鸣 ×1（时停 2.2s，伤害 5.7%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 17.8%；R×2；资源消耗 尘微之声
- 专武：SKIP — 无专武
- 异常：PASS — frazzle 占 12.3%（单人 25s）
- 耐力：PASS — 重击占动作 2.9%（40s）
- 时停：PASS — 含时停动作 伤害 17.5%（单人） / 5.7%（队伍）；占战斗时间 0.4%，按动画 17.6%（时停 4.3s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_phoebe_rover.json：上场动作 7 个，R×1，变奏/延奏 3 次；个人占比 26%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：尘微之声 8/70 · 微光（秒） 0/0

### 1502 漂泊者·衍射（PASS，模块 v0.1 · medium，1501_rover_spectro.js）

- 配置：单人 rover_spectro_f_solo.json；队伍 team_zani_rover.json；定位 subdps（模块 audit）
- 单人 25s：239,331，`R E A A A A A E A A A A E A A A E A A A A A A E A E A A A A A E A A A A R E A A A E A A A`
- 单人 40s：366,503，`R E A A A A A E A A A A E A A A E A A A A A A E A E A A A A A E A A A A R E A A A E A A A A E A E A A A A A E A A A A E H A A E A A A A H E`
- 队伍 team_zani_rover.json：318,039，个人占比 34.7%，`R E S2 R S1 R A A A R H S2 E S1 E H A H H H E H E H S2 E A E A A A A A E S3 E S2 A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：回响奏鸣 ×2（时停 2.2s，伤害 17.5%，冷却 20s 上限 2，最小间隔 20.37s）
- 时停动作（队伍）：回响奏鸣 ×1（时停 2.2s，伤害 7.9%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 17.8%；R×2；资源消耗 尘微之声
- 专武：SKIP — 无专武
- 异常：PASS — frazzle 占 12.3%（单人 25s）
- 耐力：PASS — 重击占动作 2.9%（40s）
- 时停：PASS — 含时停动作 伤害 17.5%（单人） / 7.9%（队伍）；占战斗时间 0.4%，按动画 17.6%（时停 4.3s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_zani_rover.json：上场动作 14 个，R×1，变奏/延奏 3 次；个人占比 34.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：尘微之声 8/70 · 微光（秒） 0/0

### 1503 维里奈（PASS，模块 v0.1 · medium，1503_verina.js）

- 配置：单人 verina_solo.json；队伍 team_carlotta_verina.json；定位 support（signature_weapons.json）
- 单人 25s：28,937，`R E H H H H H H H H A A A A A A A E A A H A A H H H A A A A A H H E`
- 单人 40s：47,803，`R E H H H H H H H H A A A A A A A E H A H H A A A A A H A A A A A E R A H A A A H H H H A A A A A E H A`
- 队伍 team_carlotta_verina.json：385,959，个人占比 0.8%，`R S1 E R A A A E A A S2 R E S1 A A H A E E A H S2 E S1 A H A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：草木生长 ×1（时停 1.8s，伤害 5.6%，冷却 25s 上限 2）
- 时停动作（队伍）：草木生长 ×1（时停 1.8s，伤害 0.4%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 32.4%；R×2；资源消耗 光合能量/光合标记（秒）
- 专武：SKIP — 常驻角色，无限定专武 → 跳过专武检查
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 41.2%（25s）
- 时停：PASS — 含时停动作 伤害 5.6%（单人） / 0.4%（队伍）；占战斗时间 2.9%，按动画 10%（时停 1.8s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 53.8% · 配置 0% · 模块估计 46.2% · 默认 0%
- 队伍：PASS — 队伍 team_carlotta_verina.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 0.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：光合能量 8/2 · 光合标记（秒） 32/12

### 1504 灯灯（PASS，模块 v0.1 · medium，1504_lumi.js）

- 配置：单人 lumi_solo.json；队伍 team_lumi.json；定位 subdps（模块 audit）
- 单人 25s：90,245，`E H R A A A H A A A H E E A A H A A A A H H H E H H H E`
- 单人 40s：149,246，`E H R A A A H A A A H E E E E E E H H A A A A H A A E H H H E A A A H A A A H H E H H R`
- 队伍 team_lumi.json：330,775，个人占比 5%，`R S1 R A E H A E A S3 R E S1 A H S2 S1 H H E A H A A A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 搜索：PASS — 最高单动作占比 25%；R×2；资源消耗 模式（0 黄 / 1 红）/黄灯光能/红灯光能/聚光剩余次数
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 35.7%（25s）
- 时停：SKIP — 无含时停帧的动作
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_lumi.json：上场动作 2 个，R×1，变奏/延奏 2 次；个人占比 5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：模式（0 黄 / 1 红） 5/1 · 黄灯光能 1/100 · 红灯光能 3/100 · 聚光剩余次数 10/6

### 1505 守岸人（WARN，模块 v0.1 · medium，1505_shorekeeper.js）

- 配置：单人 shorekeeper_solo.json；队伍 team_jinhsi.json；定位 support（signature_weapons.json）
- 单人 20s：26,078，`E Q A A A A A A A A A A A A A A A A A A A A A A A A A A A A A E A A A A A A A`
- 单人 40s：52,041，`Q E A A A A A A A A H A A A A A A A A A A A A A A A A A A A A A A E A A A A Q A A A A A A A A A A A A A A A A A A A A A A A A A A A A E A A A A A A A A H`
- 队伍 team_jinhsi.json：516,794，个人占比 3.4%，`R S2 R S1 R E A A E A A E E Q H E H H E H A E A S3`
- 模式 单人：20s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（队伍）：终末回环·治疗量 ×1（时停 3.5s，伤害 0%，冷却 25s 上限 2）；故此证明·洞悉 ×1（时停 2.2s，伤害 3.4%，模块资源/无（未独立核对））
- 搜索：EXPECTED — 40s 单人从不放 R（能量曾满；辅助的 R 价值多为长线增益/治疗，纯伤害窗口内可能不划算，见队伍检查）
- 专武：PASS — 星序协响 第 1/4（队伍 team_jinhsi.json）；排名：星序协响（专武） > 玻色星仪 -2.7% > 清音 -5.2% > 漪澜浮录 -5.2%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 2.6%（40s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 3.4%（队伍）；占战斗时间 0%，按动画 0%（时停 0s，口径 exclude）
- 链：PASS — 1
- 时长：WARN — 帧 29.9% · 配置 0% · 模块估计 0% · 默认 70.1%
- 队伍：PASS — 队伍 team_jinhsi.json：上场动作 2 个，R×1，变奏/延奏 2 次；个人占比 3.4%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：实论数据 2/5 · 坍缩核 15/5 · 星域 0/0

### 1506 菲比（PASS，模块 v0.2 · medium，1506_phoebe.js）

- 配置：单人 phoebe_solo.json；队伍 team_zani.json；定位 dps（signature_weapons.json）
- 单人 25s：297,903，`H R E A A A H A A A H A A A H A A A H H H H H H H A A A A A A H H`
- 单人 40s：532,705，`H R E A A A H A A A H A A A H A A A H H H H H H H A A A A A A H H A A A A E H A A A H A A A H A A A A A H A R H`
- 队伍 team_zani.json：510,363，个人占比 16.9%，`R S2 E R S1 R A A E A A R S3 E S2 H H H H H S1 A E H H H H H A E E A A H S3`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：启明之誓愿（赦罪） ×1（时停 3.7s，伤害 14%，冷却 25s 上限 2）
- 时停动作（队伍）：启明之誓愿 ×1（时停 3.7s，伤害 2.7%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 23.2%；R×2；资源消耗 祈愿/福音
- 专武：PASS — 和光回唱 第 1/4（单人 25s）；排名：和光回唱（专武） > 漪澜浮录 -13.2% > 玻色星仪 -27.3% > 清音 -27.7%
- 异常：PASS — frazzle 占 0.3%（单人 25s，去掉 module.frazzle='external'）
- 耐力：PASS — 重击占动作 39.4%（25s）
- 时停：PASS — 含时停动作 伤害 14%（单人） / 2.7%（队伍）；占战斗时间 0.2%，按动画 14.9%（时停 3.7s，口径 exclude）
- 链：PASS — 3
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_zani.json 个人占比 16.9%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：祈愿 1/120 · 福音 8/60 · 状态 0/1 · 光噪效应（目标，动作结束时） 0/10

### 1507 赞妮（PASS，模块 v0.1 · medium，1507_zani.js）

- 配置：单人 zani_solo.json；队伍 team_zani.json；定位 dps（模块 audit）
- 单人 25s：160,589，`A R A E A A R A A E H H H H A E H E A H E H H H H H E H`
- 单人 40s：222,851，`A R A E A A R E A H H H H E A H H E E A H H H H E A H H H E A A E H H A H A E A E`
- 队伍 team_zani.json：510,363，个人占比 77.1%，`R S2 E R S1 R A A E A A R S3 E S2 H H H H H S1 A E H H H H H A E E A A H S3`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：晨昏交替之时·重燃 ×1（时停 3.3s，伤害 4.9%，冷却 25s 上限 2）；晨昏交替之时·终绝将至之刻 ×1（时停 2.2s，伤害 19.7%，模块资源/无（未独立核对））
- 时停动作（队伍）：晨昏交替之时·重燃 ×1（时停 3.3s，伤害 2.6%，冷却 25s 上限 2）；晨昏交替之时·终绝将至之刻 ×1（时停 2.2s，伤害 10.8%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 42.9%；R×2；资源消耗 冗余动能/焰光/灼焰（秒）/烈阳余烬
- 专武：PASS — 焰光裁定 第 1/4（单人 25s）；排名：焰光裁定（专武） > 擎渊怒涛 -18.3% > 脉冲协臂 -18.4% > 金掌 -33.3%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 42.9%（25s）
- 时停：PASS — 含时停动作 伤害 24.6%（单人） / 13.4%（队伍）；占战斗时间 9.1%，按动画 31.4%（时停 5.6s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 82.9% · 配置 0% · 模块估计 17.1% · 默认 0%
- 队伍：PASS — 队伍 team_zani.json 个人占比 77.1%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：冗余动能 3/100 · 焰光 4/50 · 灼焰（秒） 5/20 · 烈阳余烬 2/1

### 1508 千咲（PASS，模块 v0.1 · medium，1508_chisa.js）

- 配置：单人 chisa_solo.json；队伍 team_cartethyia_chisa.json；定位 support（模块 audit）
- 单人 25s：160,945，`E A R A H A A A A E A A A A A E A A H H A A A A H`
- 单人 40s：212,261，`E A R A H A A A A E A A A A A A A H A A A A H A A A A H A A A A H A A A A H A A A`
- 队伍 team_cartethyia_chisa.json：793,008，个人占比 2.7%，`R E S2 R S1 R E A A E A A A H H H R E S2 A A H E A A A H S1 A S2 A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：即刻·归无 ×1（时停 3.7s，伤害 16.6%，冷却 25s 上限 2）
- 时停动作（队伍）：即刻·归无 ×1（时停 3.7s，伤害 2.6%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 19.5%；R×1；资源消耗 锯环残响/电锯模式/虚无绞痕（秒）/万缕·汇终（秒）
- 专武：PASS — 昙切 第 1/4（队伍 team_cartethyia_chisa.json）；排名：昙切（专武） > 源能机锋 -5.5% > 浩境粼光 -5.6% > 纹秋 -6.2%
- 异常：SKIP — 只施加虚湮（无伤害），见「虚湮」检查
- 虚湮：PASS — 减防增伤 3.33%（最高 6 层，减防 12%，理论上限 6.37%，在场 98.7%；队伍 team_cartethyia_chisa.json）
- 耐力：PASS — 重击占动作 16%（25s）
- 时停：PASS — 含时停动作 伤害 16.6%（单人） / 2.6%（队伍）；占战斗时间 0.2%，按动画 14.9%（时停 3.7s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 61% · 配置 0% · 模块估计 39% · 默认 0%
- 队伍：PASS — 队伍 team_cartethyia_chisa.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 2.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：锯环残响 3/100 · 电锯模式 1/1 · 虚无绞痕（秒） 38/30 · 万缕·汇终（秒） 10/15

### 1509 琳奈（WARN，模块 v0.1 · medium，1509_lynae.js）

- 配置：单人 lynae_solo.json；队伍 team_lynae.json；定位 support（模块 audit）
- 单人 25s：163,971，`A R E A A A H H E A H H H A A H E A A H H A A H A A E A A H A A`
- 单人 40s：278,164，`R E A A A A H H E A H H H A H E A A A A H A E H H A A H A H A H H R E A A A A H A H H H A A E`
- 队伍 team_lynae.json：680,104，个人占比 2.6%，`R S1 E E R H H A E A A H R H A H H A H H A E S2 R H S1 H A E A A H H A H H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：爆炸喷涂 ×1（时停 4s，伤害 11%，冷却 25s 上限 2）
- 时停动作（队伍）：爆炸喷涂 ×1（时停 4s，伤害 2.6%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 21.9%；R×2；资源消耗 溢彩/流光/本色
- 专武：WARN — 溢彩荧辉 第 2/4，落后 0.1%（队伍 team_lynae.json；在搜索噪声内）；排名：相位涟漪 +0.1% > 溢彩荧辉（专武） > 停驻之烟 -0.2% > 飞逝 -0.5%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 36.2%（40s）
- 时停：PASS — 含时停动作 伤害 11%（单人） / 2.6%（队伍）；占战斗时间 0.2%，按动画 16.2%（时停 4s，口径 exclude）
- 链：PASS — 5
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_lynae.json：上场动作 1 个，R×1，变奏/延奏 1 次；个人占比 2.6%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：溢彩 1/120 · 流光 12/120 · 本色 4/3 · 绮彩巡游 0/1

### 1510 陆·赫斯（PASS，模块 v0.1 · medium，1510_luuk.js）

- 配置：单人 luuk_solo.json；队伍 team_luuk.json；定位 dps（模块 audit）
- 单人 25s：229,947，`A A E R A A E E A A A A E E A A A A E A A A A A A A E E A`
- 单人 40s：396,700，`A A R E A A E E A A A A E E A A A A E A A A A A A E E A A A E E A A A A E A A A A A R A A E`
- 队伍 team_luuk.json：448,491，个人占比 57.5%，`R E S1 A R A A A A E E A A A E S3 R E S1 S2 E H H A H H E H S1 A A A A A E E A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：于永冻中释义 ×1（时停 4.1s，伤害 15.3%，冷却 25s 上限 2）
- 时停动作（队伍）：于永冻中释义 ×1（时停 4.1s，伤害 11%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 17.4%；R×2；资源消耗 日髓能流/黄金的裁量/终局之释义
- 专武：PASS — 白昼之脊 第 1/4（单人 25s）；排名：白昼之脊（专武） > 擎渊怒涛 -24.2% > 脉冲协臂 -27.5% > 金掌 -42.1%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 0%（25s）
- 时停：PASS — 含时停动作 伤害 15.3%（单人） / 11%（队伍）；占战斗时间 0.2%，按动画 16.7%（时停 4.1s，口径 exclude）
- 链：PASS — 2
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_luuk.json 个人占比 57.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：日髓能流 3/300 · 黄金的裁量 1/1 · 终局之释义 1/3

### 1511 露西（PASS，模块 v0.1 · medium，1511_lucy.js）

- 配置：单人 lucy_solo.json；队伍 team_lucy.json；定位 dps（模块 audit）
- 单人 25s：308,658，`A A E H H H H H H E A A A A H H H H R H H H H H A`
- 单人 40s：464,403，`A A E H H H H H H E A A A A H H H H R E H H E H H E A A A A A A A A H H A A A`
- 队伍 team_lucy.json：589,517，个人占比 64%，`E S3 R E S1 E H H H H E A A A A H H H H R S2 R H E H A A E A S1 E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：死锁 ×1（时停 1s，伤害 3.4%，冷却 14s 上限 2）；暗网深潜 ×1（时停 4.4s，伤害 35.9%，冷却 25s 上限 2）
- 时停动作（队伍）：死锁 ×1（时停 1s，伤害 2.7%，冷却 14s 上限 3）；暗网深潜 ×1（时停 4.4s，伤害 26.3%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 24%；R×1；资源消耗 传输协议/根权限/算法压缩/SQL
- 专武：PASS — 蜃影 第 1/4（单人 25s）；排名：蜃影（专武） > 相位涟漪 -35.2% > 死与舞 -35.3% > 停驻之烟 -41%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 60%（25s）
- 时停：PASS — 含时停动作 伤害 39.4%（单人） / 29%（队伍）；占战斗时间 5%，按动画 26.5%（时停 5.4s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_lucy.json 个人占比 64%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：传输协议 2/100 · 根权限 2/100 · 算法压缩 1/1 · SQL 2/1
- 注：模块 audit.note：暗网深潜（dd）需要在多线程后 8 秒内放 R：开场满能量时搜索直接放网络行者，不保留能量（开场能量 60 时搜索会用 dd，25s 29.3 万 vs 25.6 万）→ 搜索贪心问题，见 CORE_CHANGES worker-B B12

### 1601 桃祈（PASS，模块 v0.1 · medium，1601_taoqi.js）

- 配置：单人 taoqi_solo.json；队伍 team_taoqi.json；定位 support（模块 audit）
- 单人 25s：47,102，`A E A R H H H H H H H H A A A A E H A A A H H`
- 单人 40s：69,709，`H E A R A H H H H H H H A A A A A E H A A A A H A A A A E H H H H H A`
- 队伍 team_taoqi.json：386,917，个人占比 4.3%，`R S2 R E S1 E A E A A A E E H H E S3 R E S1 E A E A A A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：不动如山 ×1（时停 2.4s，伤害 28.3%，冷却 16s 上限 2）
- 时停动作（队伍）：不动如山 ×1（时停 2.4s，伤害 3.3%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 43.5%；R×1；资源消耗 磐岩护壁/刚柔化势
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 47.8%（25s）
- 时停：PASS — 含时停动作 伤害 28.3%（单人） / 3.3%（队伍）；占战斗时间 0.2%，按动画 9.9%（时停 2.4s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 85.7% · 配置 0% · 模块估计 14.3% · 默认 0%
- 队伍：PASS — 队伍 team_taoqi.json：上场动作 2 个，R×1，变奏/延奏 1 次；个人占比 4.3%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：磐岩护壁 2/3 · 刚柔化势 6/3

### 1602 丹瑾（PASS，模块 v0.1 · medium，1602_danjin.js）

- 配置：单人 danjin_solo.json；队伍 team_danjin.json；定位 dps（模块 audit）
- 单人 25s：215,611，`A A E R A E E E A E A E E A E E E A H A E E E E E E E E E E E E H A A E E R A E E E H A`
- 单人 40s：343,749，`A A E R A E E E A A E E A E E E E H A E E A E E E A E E A E E E E H A R E E H E A E E E A E E A E E E H A E E E E E E H E E E E E E H R A H`
- 队伍 team_danjin.json：252,509，个人占比 86.2%，`S3 R S1 R S2 R E S1 E E A A E A E E E A A E E E H A E A E E E A A E H R A E E E A E H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：绯红绽放 ×2（时停 3.3s，伤害 17.3%，冷却 16s 上限 2，最小间隔 19.75s）
- 时停动作（队伍）：绯红绽放 ×2（时停 3.3s，伤害 17.3%，冷却 16s 上限 2，最小间隔 18.09s）
- 搜索：PASS — 最高单动作占比 35.7%；R×3；资源消耗 彤华
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 10%（40s）
- 时停：PASS — 含时停动作 伤害 17.3%（单人） / 17.3%（队伍）；占战斗时间 0.4%，按动画 26.4%（时停 6.5s，口径 exclude）
- 链：PASS — 0
- 时长：PASS — 帧 87.1% · 配置 0% · 模块估计 12.9% · 默认 0%
- 队伍：PASS — 队伍 team_danjin.json 个人占比 86.2%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：彤华 5/120

### 1603 椿（PASS，模块 v0.1 · medium，1603_camellya.js）

- 配置：单人 camellya_solo.json；队伍 team_camellya.json；定位 dps（模块 audit）
- 单人 25s：317,745，`A H A R H A E H A H H A`
- 单人 40s：483,890，`A H A R H A H E H A H A H A A H A H E A H`
- 队伍 team_camellya.json：506,116，个人占比 99.8%，`R E S1 A R H A H A E H A H A H A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：芳华绽烬 ×1（时停 4s，伤害 11.1%，冷却 25s 上限 2）
- 时停动作（队伍）：芳华绽烬 ×1（时停 4s，伤害 9.1%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 42.9%；R×1；资源消耗 红椿·蕊/红椿·蕾/含苞（秒）
- 专武：PASS — 裁春 第 1/4（单人 25s）；排名：裁春（专武） > 千古洑流 -18.7% > 镭射切变 -26.1% > 翼锋 -30.9%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 42.9%（40s）
- 时停：PASS — 含时停动作 伤害 11.1%（单人） / 9.1%（队伍）；占战斗时间 1.6%，按动画 17.6%（时停 4s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_camellya.json 个人占比 99.8%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：红椿·蕊 13/100 · 红椿·蕾 1/10 · 含苞（秒） 8/15 · 盛绽 0/0

### 1604 漂泊者·湮灭（PASS，模块 v0.1 · medium，1604_rover_havoc.js）

- 配置：单人 rover_havoc_solo.json；队伍 team_rover_havoc.json；定位 dps（模块 audit）
- 单人 25s：199,028，`A A E R A A A A A A H H A A A A H A A E A A H A A A A H A A A A A A A A`
- 单人 40s：321,525，`A A E R A A A H A A H H A A A A E H A A A A H A A A A H A A H A A E A A A H H A A A A H A A A A A A A A E A A A A`
- 队伍 team_rover_havoc.json：275,173，个人占比 18.9%，`R E S3 R E S1 S2 A R A E E A E E E A A E E A E E E H A E E H H A E E A E E H A R E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：临渊死寂 ×1（时停 2.3s，伤害 18.7%，冷却 16s 上限 2）
- 时停动作（队伍）：临渊死寂 ×1（时停 2.3s，伤害 12.1%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 14%；R×1；资源消耗 暗流/暗涌
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 17.5%（40s）
- 时停：PASS — 含时停动作 伤害 18.7%（单人） / 12.1%（队伍）；占战斗时间 9.1%，按动画 18.1%（时停 2.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_rover_havoc.json 个人占比 18.9%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：暗流 2/100 · 暗涌 1/1

### 1605 漂泊者·湮灭（PASS，模块 v0.1 · medium，1604_rover_havoc.js）

- 配置：单人 rover_havoc_f_solo.json；队伍 team_rover_havoc_f.json；定位 dps（模块 audit）
- 单人 25s：199,028，`A A E R A A A A A A H H A A A A H A A E A A H A A A A H A A A A A A A A`
- 单人 40s：321,525，`A A E R A A A H A A H H A A A A E H A A A A H A A A A H A A H A A E A A A H H A A A A H A A A A A A A A E A A A A`
- 队伍 team_rover_havoc_f.json：275,173，个人占比 18.9%，`R E S3 R E S1 S2 A R A E E A E E E A A E E A E E E H A E E H H A E E A E E H A R E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：25s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：临渊死寂 ×1（时停 2.3s，伤害 18.7%，冷却 16s 上限 2）
- 时停动作（队伍）：临渊死寂 ×1（时停 2.3s，伤害 12.1%，冷却 16s 上限 2）
- 搜索：PASS — 最高单动作占比 14%；R×1；资源消耗 暗流/暗涌
- 专武：SKIP — 无专武
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 17.5%（40s）
- 时停：PASS — 含时停动作 伤害 18.7%（单人） / 12.1%（队伍）；占战斗时间 9.1%，按动画 18.1%（时停 2.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_rover_havoc_f.json 个人占比 18.9%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：暗流 2/100 · 暗涌 1/1

### 1606 洛可可（PASS，模块 v0.1 · medium，1606_roccia.js）

- 配置：单人 roccia_solo.json；队伍 team_camellya_roccia.json；定位 subdps（模块 audit）
- 单人 25s：214,815，`A H A R E A H A H H A H A E A A A H A H A H A E A`
- 单人 40s：350,676，`A H A R E A H A H H H H E A A H A H A H A E A H A H A R H A H A E A A H A H A`
- 队伍 team_camellya_roccia.json：588,216，个人占比 22.5%，`R E S2 H R H E A A H A S1 A R H A H A E H A S3 E S1 A S2 H`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：即兴喜剧，开场 ×1（时停 3.3s，伤害 13.6%，冷却 20s 上限 2）
- 时停动作（队伍）：即兴喜剧，开场 ×1（时停 3.3s，伤害 6.5%，冷却 20s 上限 2）
- 搜索：PASS — 最高单动作占比 38.5%；R×2；资源消耗 想象力/飞跃幻想
- 专武：PASS — 悲喜剧 第 1/4（队伍 team_camellya_roccia.json）；排名：悲喜剧（专武） > 脉冲协臂 -3.3% > 擎渊怒涛 -7.5% > 金掌 -8.8%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 38.5%（40s）
- 时停：PASS — 含时停动作 伤害 13.6%（单人） / 6.5%（队伍）；占战斗时间 0.2%，按动画 13.5%（时停 3.3s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 61.5% · 配置 0% · 模块估计 38.5% · 默认 0%
- 队伍：PASS — 队伍 team_camellya_roccia.json：上场动作 10 个，R×1，变奏/延奏 2 次；个人占比 22.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：想象力 11/270 · 飞跃幻想 9/1

### 1607 坎特蕾拉（PASS，模块 v0.1 · medium，1607_cantarella.js）

- 配置：单人 cantarella_solo.json；队伍 team_phrolova_cantarella.json；定位 subdps（模块 audit）
- 单人 25s：214,651，`A R E H E A A A E A A A A A E A A A H A E A A A A E A A A A A A A A A E`
- 单人 40s：349,895，`A R E H E A A A E A A A A A E A A A H A E A A A A A A A A A A A A A E H E A A A E A A A E A A A A A A A A A E R A A`
- 队伍 team_phrolova_cantarella.json：432,949，个人占比 47.7%，`H R S2 A R E H E A A A E A S1 H E A S2 E S1 A A S2 H A E A A A E A A A A A A A A`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：海面之下·陷溺 ×1（时停 3.6s，伤害 4%，冷却 25s 上限 2）
- 时停动作（队伍）：海面之下·陷溺 ×1（时停 3.6s，伤害 2%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 20.7%；R×2；资源消耗 迷离/颤栗/蜃境（秒）/织梦水母剩余
- 专武：PASS — 海的呢喃 第 1/4（队伍 team_phrolova_cantarella.json）；排名：海的呢喃（专武） > 漪澜浮录 -4.1% > 玻色星仪 -11.2% > 清音 -11.3%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 5.6%（25s）
- 时停：PASS — 含时停动作 伤害 4%（单人） / 2%（队伍）；占战斗时间 0.2%，按动画 14.5%（时停 3.6s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_phrolova_cantarella.json：上场动作 27 个，R×1，变奏/延奏 3 次；个人占比 47.7%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：迷离 12/5 · 颤栗 2/3 · 蜃境（秒） 17/8 · 织梦水母剩余 18/21

### 1608 弗洛洛（PASS，模块 v0.1 · medium，1608_phrolova.js）

- 配置：单人 phrolova_solo.json；队伍 team_phrolova.json；定位 dps（模块 audit）
- 单人 30s：188,083，`E A A A A E A A A E H E E A A H A A H A A H A A H A A E E A A H H`
- 单人 40s：301,375，`E E A A A E A A A A H E R A A A A A A A A A A A A A A A A A A R A E A H H`
- 队伍 team_phrolova.json：433,911，个人占比 38.5%，`H R S3 R H E A S2 E R A H A A A H A H A E A H A A H A H A A S1`
- 模式 单人：30s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（队伍）：往日深渊的圆舞曲 ×1（时停 4s，伤害 0%，模块资源/无（未独立核对））
- 搜索：PASS — 最高单动作占比 24.2%；R×2；资源消耗 乐声/定音/指挥（秒）
- 专武：PASS — 幽冥的忘忧章 第 1/4（单人 30s）；排名：幽冥的忘忧章（专武） > 漪澜浮录 -1.5% > 玻色星仪 -18.1% > 清音 -21%
- 异常：SKIP — 不施加异常
- 耐力：PASS — 重击占动作 21.2%（30s）
- 时停：PASS — 含时停动作 伤害 0%（单人） / 0%（队伍）；占战斗时间 0%，按动画 0%（时停 0s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 100% · 配置 0% · 模块估计 0% · 默认 0%
- 队伍：PASS — 队伍 team_phrolova.json 个人占比 38.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：乐声 1/6 · 余响 0/10 · 定音 1/1 · 指挥（秒） 19/24 · 强化赫卡忒剩余次数 0/10

### 1610 秧秧·玄翎（PASS，模块 v0.1 · medium，1610_xuanling.js）

- 配置：单人 xuanling_solo.json；队伍 team_xuanling_chisa.json；定位 dps（模块 audit）
- 单人 25s：288,669，`A A A A R E H A A A E A A E A E A E A A A E H A E E A E E E E`
- 单人 40s：515,714，`A A A A R E H A A A A E A E A A E A E A A A E H E A E A E A E A E A A A E H R E H A A A`
- 队伍 team_xuanling_chisa.json：615,168，个人占比 94.5%，`E A R S1 R H E S3 R S1 H A A A A A A A S2 S1 E E A A E A E H A A A A A A A S3 E S1 A E`
- 模式 单人：25s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 单人：40s · 时停不计时 · 残值引导关 · 冷/预设开局
- 模式 队伍：30s · 时停不计时 · 残值引导开(×0.5) · 冷/预设开局
- 时停动作（单人）：裁羽寂万音 ×1（时停 5s，伤害 25.9%，冷却 25s 上限 2）
- 时停动作（队伍）：裁羽寂万音 ×1（时停 5s，伤害 14.5%，冷却 25s 上限 2）
- 搜索：PASS — 最高单动作占比 12.9%；R×2；资源消耗 流响/苍翎/剑式（1=羽）/聆风祀声（秒）
- 专武：PASS — 天之苍苍 第 1/4（单人 25s）；排名：天之苍苍（专武） > 千古洑流 -26.4% > 镭射切变 -36.5% > 翼锋 -39.6%
- 异常：SKIP — 只施加虚湮（无伤害），见「虚湮」检查
- 虚湮：PASS — 减防增伤 3.87%（最高 6 层，减防 12%，理论上限 6.37%，在场 98.9%；队伍 team_xuanling_chisa.json）
- 耐力：PASS — 重击占动作 9.1%（40s）
- 时停：PASS — 含时停动作 伤害 25.9%（单人） / 14.5%（队伍）；占战斗时间 0.2%，按动画 20.2%（时停 5s，口径 exclude）
- 链：PASS — 6
- 时长：PASS — 帧 95.5% · 配置 0% · 模块估计 4.5% · 默认 0%
- 队伍：PASS — 队伍 team_xuanling_chisa.json 个人占比 94.5%
- 错误：PASS — 无
- 资源（40s，减少次数/最大值）：流响 20/100 · 苍翎 4/2 · 剑式（1=羽） 6/1 · 聆风祀声（秒） 6/12

## 尚无模块的角色

无
