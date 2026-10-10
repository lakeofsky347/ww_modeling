# ww_modeling — 鸣潮伤害建模与模拟器

基于社区数据整理，仅供娱乐参考。

纯静态网页，全部计算在浏览器本地完成：自选队伍与配装，引擎按动作帧排轴（支持自动搜索），结算单目标期望伤害，并逐乘区标出数据可信度。

- 数据版本：**3.7.8**（游戏 3.7.0；上游 [Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data) commit `9218d61`）
- 64 名共鸣者全部有角色模块，均可自动搜索

## 一、怎么用

| 方式 | 文件 | 说明 |
|---|---|---|
| **① 网页（推荐）** | [`dist/ww/`](dist/ww/) | 自包含静态包：`python3 -m http.server -d dist 8000`，打开 http://localhost:8000/ww/ （需带末尾斜杠）。部署参考 [`dist/nginx.conf.example`](dist/nginx.conf.example) |
| **② 命令行** | [`pipeline/ww/engine/cli.js`](pipeline/ww/engine/cli.js) | `node pipeline/ww/engine/cli.js pipeline/ww/engine/examples/team_jinhsi.json --timeline` |

常用命令：

    npm test          # 引擎与角色模块测试（node --test，184 项）
    npm run build     # 重新生成 dist/ww/（引擎 bundle + worker + 页面 + data/ww.json）
    npm run sim -- pipeline/ww/engine/examples/team_jinhsi.json

需要 Node ≥ 18、Python ≥ 3.9，无第三方依赖。

## 二、目录

    dist/ww/                  构建产物（index.html、assets/ww-engine.js、assets/ww-worker.js、assets/theme、assets/avatars、data/ww.json）
    frontend/ww/              页面骨架与组件说明（COMPONENTS.md）
    frontend/theme/           主题样式、WebGL 背景、游戏切换标签栏、头像脚本、图标
    frontend/apply-theme.py   主题注入脚本（构建时调用）
    pipeline/build_pages.py   页面构建入口（--layout per-game，默认只构建 ww）
    pipeline/ww/engine/       伤害/排轴引擎 ww_engine.js + 角色模块 chars/（64 名） + 测试 + 示例
    pipeline/ww/page/         页面应用 app.js、worker.js、构建脚本 build_page.py
    pipeline/ww/build_ww.py   从解包数据生成 pipeline/out/ww.json
    pipeline/ww/validation/   校验：动作帧表 action_frames.json、副词条档位、用例、报告 REPORT.md / TEAM_BENCHMARK.md
    pipeline/out/ww.json      处理后的模拟数据（构建输入）
    assets-src/icons/ww/      角色头像源文件 + manifest.json
    pipeline/ww/MECHANICS.md   机制说明；VALIDATION_CASES.md 用例格式

## 三、重新生成数据（可选）

`pipeline/out/ww.json` 已随仓库提供，直接 `npm run build` 即可。若要从游戏数据重新生成：

    git clone https://github.com/Arikatsu/WutheringWaves_Data ww-WutheringWaves_Data   # 仓库根目录下，不提交
    git -C ww-WutheringWaves_Data checkout 9218d612ad815e398e064e577e42aaf878899968
    python3 pipeline/ww/build_ww.py              # 数值与 encore.moe 核对，页面缓存到 cache/encore/（不提交）
    python3 pipeline/ww/selftest_ww.py
    npm run build

`pipeline/ww/validation/raw/` 下的脚本是生成动作帧表、副词条档位时的一次性研究脚本，依赖未随仓库发布的社区网页抓取与参考仓库，仅作记录。

## 四、数据来源

- 游戏数据表：[Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data)
- 数值核对：[encore.moe](https://encore.moe/)
- 动作帧数：WuwaLAB 社区帧数表（按 60fps 换算；测于 3.7.8 之前，可能过期）、[WuWaSim](https://github.com/Philipp-DI/WuWaSim)（时停口径参照其 toa 模式）
- 声骸副词条档位：库洛官方概率公示（仅用于界面档位与校验，不参与伤害计算）
- 角色头像：encore.moe，128×128 webp；版权归库洛游戏所有，仅用于非商业同人用途

## 五、校验与可信度

- 单次命中伤害与开源计算器 wuwa-tools 10/10 一致（逐乘区对照见 [pipeline/ww/validation/REPORT.md](pipeline/ww/validation/REPORT.md)）；异常效应（风蚀/光噪/电磁/聚爆/霜渐）单跳与 wuwa-calc-site 一致
- 角色模块审计：64 个模块 PASS 50 · WARN 13 · FAIL 0（[MODULE_AUDIT.md](pipeline/ww/validation/out/MODULE_AUDIT.md)）

鸣潮没有原版可对照，伤害乘区按来源分档并在界面上用角标标出：

- **表格推导**：直接由解包数据得出
- **社区印证**：两个独立开源计算器一致，但未经游戏内实测
- **待验证**：社区说法存在分歧（受击方与攻击方加深是否同区；抗性 ≥80% 的分段公式）
- **估计**：暂用估计值（协奏能量结算时机、谐度破坏公式、切人时机）

## 六、已知限制

- 时停口径（待验证）：只有消耗共鸣能量的共鸣解放主镜头不计入战斗时间；页面可切换“按完整动画”对比
- 动作帧来自社区数据，可能与当前版本不符；估计时长以斜纹标出，可手动修改
- 共鸣链：多数后期角色只建模到 0 链，超出部分按已建模链数计算（界面标“按 N 链”）
- 谐度/偏移机制尚未完整建模；只算单目标，护盾不计，治疗只统计总量
- 尤诺队在 40 秒基准下相对排名偏高，原因尚未完全核实（见 TEAM_BENCHMARK.md）
