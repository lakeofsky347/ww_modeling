# Stream A 进度日志

## 2026-10-09 16:45 SGT · 核心：残值引导 / 稳态开局 / 帧源第 3 轮 + 批次 1 前两个角色

**模块**
- 1306 奥古斯塔 v0.1 · medium：单人 25 s 31.3 万；专武排 1/4（领先苍鳞千嶂 1.2%）；audit PASS。
- 1208 嘉贝莉娜 v0.1 · low：单人 28.0 万（换成 WuWaSim 帧之前是 25.1 万）；专武排 1/4；audit PASS（帧来源 WuWaSim）。

**核心改动**
- 搜索残值项。
- 稳态开局。
- 视图字段：runMode、residual、carry。
- 页面渲染（.ww-tag.mode、i.residual、.ww-carry）。
- 帧来源按口径区分：WuWaSim / Riley / echoes / discrepancies。
- 可选的 timeStop exclude。
- stream B 请求：B2、B5、B6、B8 已完成，B1 部分完成。
- 治疗 / 护盾触发。
- multUp。
- 预设自动纳入。

**队伍预设窗口**：改为 40 s，卡提希娅队保留 25 s。

**验证**
- node 测试 78/78。
- cases.json 76 OK。
- verify_ww_page：只有 1 项 FAIL（mobile overflow），原因是前端 16:15 版的 gamenav.js；把它换回旧版后 sw=390。
- module_audit：26 个角色，PASS 20 · WARN 4 · FAIL 2。FAIL 是 1508 / 1610（stream B）的虚湮检查，属于审计口径问题（B7）。

**未完成**
- 守岸人 / 维里奈在默认口径下仍多数不放 R。根因是时停计时口径，见 MECHANICS §10。
- 批次 1 余下 5 个角色（莫宁、露帕、布兰特、散华、吟霖）和 team_galbrena 还没做。

## 2026-10-09 17:05 SGT · 时停防刷 / 共鸣链覆盖 / B 项移交（stream A）

**新增 / 修复**
- 页面 runtime frames 保留 time_stop（KEEP_FR），页面与 CLI 的 exclude 口径一致（原来页面实际按 include 算）。
- 时停：`result.timeStopSaved` / `timeStopMode`，视图 `summary.timeStopSaved`、动作 `freeze`；页面 `.ww-tag.timestop`（0 时 `.zero`）、`.ww-seg.timestop-seg`（时停不计时 / 按完整动画）、`<i class="ww-freeze">`。
- 时停防刷：整段时停动作全部有门控，未加实时下限；test/timestop.test.js 15 项（清宵 强化重击 ≤ 心剑次数、弗洛洛 圆舞曲 ≤ 定音次数、守岸人 洞悉 ≤ 每星域 1 次、伤害占比、增益持续、timeStopSaved）。
- 共鸣链：`chainModeled`（result.members[i] / view.team[i]，`WW.chainModeledOf`），超出按 N 链计算，warning `chain-unmodeled`；页面 `i.on.unmodeled` + `.ww-tag.chain-cap`。39 个模块文件（42 个 id）都声明了 chainModeled。
- B12a `hold`（露西 暗网深潜、丹瑾 120 彤华）；B12b 辅助轮转（所有公开配队辅助都放 R）。test/b12.test.js 8 项。
- B3 套装 12、B9 echoCast/shield 事件、B11 套装 32 + 击败条件默认关闭（露西补丁删除）、B4 只加钩子（保持未建模）。
- build_pages.py：endfield 的 `data/zmd/kits.json` 改为纯文本「源数据：EndfieldData kits（未随包发布）」，总伤不变。
- 新模块：1102 散华、1206 布兰特、1302 吟霖；预设 team_camellya_sanhua / team_brant / team_yinlin / team_galbrena / brant_solo / yinlin_solo；清宵队加入页面预设（时停）。

**数值**：布兰特单人 30.6 万、吟霖单人 12.0 万、嘉贝莉娜单人 28.0 万；椿/散华/守岸人 46.9 万、长离/布兰特/守岸人 38.3 万、尤诺/吟霖/守岸人 31.7 万、嘉贝莉娜/仇远/守岸人 48.0 万、清宵队 65.1 万（include 32.2 万）。

**验证**：node 测试 134/134；cases.json 76 OK；verify_ww_page 42/42（EXPECT 更新：默认 524056、珂莱塔 504211 等，见脚本注释）；module_audit 42 个角色 PASS 33 · WARN 9 · FAIL 0；dist/index.html md5 未变。

**未完成**：莫宁 1209、露帕 1207 及批次 2/3 余下角色；尤诺/西格莉卡改用 echoCast/shield 事件。

B: claimed 1301,1303,1305,1307,1308,1309,1310,1312,1504 (导电 Electro: 卡卡罗、渊武、相里要、卜灵、丽贝卡、漂泊者·导电×2、锁暝、灯灯) — worker-B, 2026-10-09 17:08 SGT

## 2026-10-09 17:10 SGT · 批次 4（stream A）开始
- A: claimed 热熔 1209 莫宁、1207 露帕、1202 炽霞、1203 安可、1204 莫特斐、1211 达妮娅、1212 景燃；冷凝 1103 白芷、1104 凌阳、1106 釉瑚、1108 绯雪、1109 洛瑟菈、1110 穗穗。
- 导电 1301/1303/1305/1307/1308/1309/1310/1312/1504 交给 worker B（B 写 “B: claimed” 后由 B 实现；stream A 不动）。

B: done 1301,1303,1305,1307,1308,1309,1310,1312,1504 — worker-B, 2026-10-09 SGT（详见 engine/chars/PROGRESS.md / CORE_CHANGES B13）

## 2026-10-09 17:2x SGT · 时停 toa 修正 + 基准对齐（stream A）
- 引擎：只扣耗能 R 的时停（tsVerified 例外）；组合动作取最大值；timeStopScope:'all' 对照；MECHANICS §10 补充（含 Prydwen 增益冻结说法“待验证”、动作清单、期望变化）。
- probeAnomaly 改为纯表探针（不套模块 frostbite / anomalyStats，可用 probe.frostbite / probe.moduleStats 打开）→ N6 霜渐（绯雪）回到 1726.8。
- 配置对齐：lead 清宵 80.4 万/44.8 万 与 预设 65.1 万/36.8 万 唯一差异是窗口（40 s vs 30 s）；搜索预算、开局、endCredit、帧数据（runtime 精简版与 validation 版逐值相同）全部一致。team_benchmark.js 现默认按预设口径（文件自带 duration/rotation/search），`--duration 40` 复现统一窗口，`--scope all` 逐值复现 lead 表；末尾输出 Spearman 与对清宵比值。
- 验证：node 测试全部通过；cases.json 76 OK；verify_ww_page 42/42（EXPECT 已更新并注明）；dist md5 不变；dist3 已重建。

## 2026-10-09 17:4x SGT · B13 跟进 + 批次 4 收尾（stream A）
- B13：心 UNISON 含 1312（删 unisonIds 绕行）；同奏增益跨提供者共享上限（_common.tzzyRoom）；周期钩子 api.every/mod.tick（卜灵 五雷荡煞阵已改用）；点按/长按、丽贝卡射速未改（见 CORE_CHANGES B13 处理结果）。
- 批次 4 示例：13 个单人 + 9 个公开配队（team_denia/jingran/lupa/mortefi/baizhi/hiyuki/lingyang/youhu/encore；sources 字段注明出处）；页面新增预设：达妮娅队、安可队、绯雪队。
- 修复：绯雪 rustMates 用 Set 被深拷贝丢失 → 对象；露帕专武 焰痕 延长/全队热熔（专武 1/4）；finishers 调整（绯雪 iaiS、洛瑟菈 去 obl、穗穗 去 I、釉瑚 去 R、安可 去 black）；audit_expected 加 釉瑚/穗穗“单人不放 R”。signature_weapons.json 补 1108/1109/1110/1211/1212。
- 验证：node 测试 182/182；cases 76 OK；verify 42/42；module_audit PASS 52 · EXPECTED 1 · WARN 11 · FAIL 0，覆盖 64/64；dist md5 不变；dist3 已重建（ww/index.html 无 ../assets、../data）。
- 待核：绯雪队 87.3 万（30 s）偏高——霜冻每次附加都按上限层数（穗穗把上限提到 13）结算，霜渐占队伍伤害 52%，规则理解置信度低；安可 黑咩（black）25 s 内达不到。

## 2026-10-09 18:xx SGT follow-ups（霜冻/奥古斯塔/安可/来源）
- 霜冻：穗穗上限 +3 改为不叠加（raiseAnomalyCap 同来源替换）；雪锈 额外段改为平 102%（addMult）；scale:0 修正（影响 1406/1408 转化）。绯雪队 30 s 872,640→634,519（清宵 1.02×，社区 1.076×）。见 MECHANICS §12。
- 奥古斯塔 赫日威临 帧条目 tsVerified（游戏文本 + arabwuwa 11.58 s）。team_augusta 420,089→567,878。
- 安可 hold（狂热内失序满先放黑咩），finishers 恢复 black；audit 1203 PASS。
- 配队 sources 换成具体页面 URL：team_lupa / team_denia / team_hiyuki（+reference）/ team_jingran。
- 验证：node 测试 182/182；cases 76 OK；verify 42/42（EXPECT 不变，注释记录 3 个非 EXPECT 预设变化）；module_audit PASS 50 · EXPECTED 1 · WARN 13 · FAIL 0，覆盖 64/64；dist md5 不变；dist3 已重建。
- team_benchmark 40 s：exclude Spearman 0.6（去尤诺 0.4），尤诺/清宵 1.765（社区 0.758）；include Spearman 0.1。

## 2026-10-09 18:1x SGT 发布门槛：尾段时停（tail-freeze）
- 全部 17 个页面预设 + team_iuno 30 s：没有任何“扣除时停”的大招在窗口末尾起手，尾段时停 0%（奥古斯塔队 最后 赫日威临 @10.30 s / 116,413 / 20.5%，完整动画也在 25 s 内）。只有 40 s 基准里的尤诺队受影响：赫日威临 @39.92 s，137,770，12.3%。
- 引擎：`result.tailFreeze {pct, bonus, damage, idx, sec}`、`view.summary.tailFreezePct / tailFreeze`、lane 动作 `tailFreeze`、warning `ts-window-edge`（>3% 为 warn）。只做标记，不改伤害（游戏中计时冻结时命中照常结算）。页面：`.ww-tag.tail-freeze`「尾段时停 X%」+ `.ww-act[data-tail-freeze]`。
- verify 44/44（新增：预设均无尾段时停；奥古斯塔预设改 11 s → 标签 32.2%、赫日威临 标记、warning 1 条、页面 == CLI）；node 184/184（新增 test/tailfreeze.test.js）；cases 76 OK；audit PASS 50 · EXPECTED 1 · WARN 13 · FAIL 0；dist md5 不变；dist3 已重建。
- dist/README.md 待验证：尤诺队比值（1.765 vs 0.76）与“每轮 DPS”口径计划。
