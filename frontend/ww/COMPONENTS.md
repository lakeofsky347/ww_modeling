# 鸣潮页面 · 前端对接约定

样式全部在 `assets/theme/ww.css`，引擎只负责往下面这些容器里塞 HTML，用约定的 class，不写自己的样式。
`ww/index.html` 里 `<script id="ww-mock">` 那一整段是示例数据，引擎接入后删掉即可。

## 容器 id（固定，不要改名）
| id | 内容 |
|---|---|
| `ww-ver` | 版本号文字 |
| `ww-top-actions` | 顶栏按钮：预设、导入、导出、开始模拟 |
| `ww-team` | 编队卡位 |
| `ww-build` | 当前共鸣者：技能等级、武器、声骸 |
| `ww-enemy` | 目标设置 |
| `ww-settings` | 模拟设置 |
| `ww-summary` | 汇总卡 |
| `ww-gauges` | 共鸣能量 / 协奏能量环 |
| `ww-seq` | 动作序列编辑 |
| `ww-timeline` | 排轴时间轴（只展示） |
| `ww-buffs` | 增益与状态列表 |
| `ww-search` | 自动搜索候选对比 |
| `ww-share` | 伤害占比 |
| `ww-breakdown` | 乘区拆解和明细表 |
| `ww-warnings` | 提示与警告 |
| `ww-modal-root` | 弹窗挂载点 |

## 属性
任何元素加 `data-el="glacio|fusion|electro|aero|spectro|havoc|physical"`，内部就能用 `var(--el)` 取该属性颜色；
`<i class="ww-el"></i>` 自动显示对应的自绘属性符号。

## 组件
- 编队：`.ww-team > .ww-slot[data-el]`（`.sel` 选中，`.empty` 空位），内部 `.role` `.ava>.ww-el` `.nm` `.meta` `.ww-chain>i(.on)×6`
- 声骸：`.ww-echoes > .ww-echo > .cost .main .set`
- 表单：`.ww-grid2/3/4 > label.ww-field > span + input/select`；分段按钮 `.ww-seg > button(.on)`；小标题 `.ww-sub`
- 按钮：`.ww-btn`，主按钮加 `.pri`，小号加 `.sm`
- 标签：`.ww-tag`，变体 `.gold` `.cyan` `.el`（配合 `data-el`）`.low`；星级 `.ww-stars`
- 汇总：`.ww-cards > .ww-card(.hero) > .k .v .s`
- 能量环：`.ww-gauge[style="--p:0~100"] > .ring[data-val] + .lbl`，协奏能量加 `.concerto`，属性色用 `style="--c:var(--spectro)"`
- 占比：`.ww-bars > .row[data-el] > .nm .ww-bar>i[style=width] .num`；堆叠条 `.ww-stack>i`，图例 `.ww-legend`
- 时间轴：`.ww-tl > .ruler>span…` + `.ww-lane[data-el] > .who + .track > .ww-act`
  - 动作类型 class：`A` 普攻、`H` 重击、`E` 共鸣技能、`R` 共鸣解放（发光）、`Q` 声骸技能（金色）
  - 附加 `I` = 变奏入场（青色菱形），`O` = 延奏离场（金色三角）
  - 位置用 `style="left:x%;width:w%"`，切人竖线 `.ww-swap[style=left]`
- 乘区：`.ww-mult > .z>b(名称)+数值`，中间 `.x` 放乘号
- 表格：`table.ww-tbl`，数字列 `td.num`
- 提示：`.ww-warn` `.ww-err` `.ww-empty`
- 弹窗：`.ww-modal-bg > .ww-modal > header + .body + footer`，选择网格 `.ww-pick > .it(.cur)[data-el]`；提示条 `.ww-toast`

## 加载与置信度
同星铁、终末地：数据就绪调 `window.__uiReady()`，失败调 `window.__uiError(msg)`；
低置信条目加 `data-confidence="low"` 和 `title=lowReason`，或者直接用 `.ww-tag.low`。

## 第二批（建模师提的三样）
- 动作序列：`.ww-seq > .ww-step[data-el][draggable=true] > .k(角色) + 文字 + button.del`
  - `I`/`O` 同时间轴（变奏、延奏），拖动中加 `.dragging`，插入位置那一格加 `.drop-before`，非法动作加 `.invalid`
  - 动作按钮面板：`.ww-palette > button[data-el]`
  - 拖拽排序逻辑由引擎实现（原生 HTML5 drag 事件即可），样式只负责这几个状态 class
- 增益：`.ww-buffs > .ww-buff[data-el](.off) > .nm(.ww-el+名称) .src .stk .cov(.ww-bar>i + 百分比)`
  - 时间轴覆盖条：在 `.ww-lane .track` 里追加 `.ww-buffbar[style="--c:颜色"] > i[style="left:x%;width:w%"]…`，多条叠放加 `.stacked`
- 搜索对比：`.ww-cands > .hd(表头) + .ww-cand(.best .cur) > .rk .desc(.t .s) .num .num.total .gap`
  - `.cur` = 当前已套用的方案，`.best` = 最优；点击整行套用

## 第三批
- 声骸副词条：`.ww-subs > .ww-sub-row > .nm + .ww-tiers > button(.on)[data-p="出现概率"]`，档位值放按钮文字里，概率可选
- 机制可信度：乘区格子直接写 `<span class="z" data-mech="{mech}" title="依据">`，`table` 不显示标记，
  `corroborated` 显示淡青色实线“已印证”，`community` 显示青色虚线“待验证”，`unsolved` 显示红色虚线“估计”。
  乘区拆解下方建议放一条图例：`.ww-mech-legend > span.table/.corroborated/.community/.unsolved`（文字：表格推导 / 社区印证 / 待验证 / 估计）。验证通过只改数据里的 mech 值，页面不用动。
  其他位置（提示区等）需要单独的标记时用 `.ww-mech` / `.ww-mech.unsolved`
- 有效抗性为负时给对应 `.z` 加 `.neg`
- 敌人抵抗：`.ww-res > .ww-seg(10% / 40% / 免疫) + label.ww-field(减抗%)`，乘区拆解里显示最终有效抗性

## 第四批（引擎核心接入后）
- 动作时长是估计值：`.ww-act` / `.ww-step` 加 `.est`，再按来源加 `data-dur`：
  `frames`（社区帧数表）显示淡斜纹和“~”，`default`（默认值）显示原来的浓斜纹和“≈”；`title` 写来源，回退的条目写回退原因
  `config`（用户自填，`est:false`）不加 `.est`，只加 `data-dur="config"`，底部显示一条细金线
- 没有角色模块：`.ww-slot` 加 `.no-module`（角标显示“仅手动”）；搜索区外层加 `.ww-disabled`，上面放一条 `.ww-disabled-note` 说明原因
- 角色专属资源：`.ww-res-meter > span(名称) + .ww-res-bar[data-el] > i(.on)×格数 + span(数值)`；连续量用 `.ww-res-bar.cont[style="--p:0~100"]`
  - 时间轴里可以加一行资源曲线：`.ww-lane.res > .who + .track > svg > path`（引擎直接给 path；svg 写 `viewBox="0 0 100 10" preserveAspectRatio="none"`，要填充面积再加一条 `path.area`）
- 识别不出条件、默认关闭的增益：`.ww-buff.off.auto-off`

## 低置信在鸣潮页的显示
通用的“待复核”角标在鸣潮页关掉了，按位置换成紧凑标记，引擎照旧只加 `data-confidence="low"` 和 `title`：
增益行显示琥珀小点和左侧细线；资源行和资源条名称后加“≈”，曲线变虚线；明细表首格后加“低置信”小角标；动作块顶部加一条琥珀细线；`.ww-tag` 本身已经表达，不重复。

## 第五批（异常效应、耐力、后台）
- 异常效应行：`.ww-lane.status[data-el] > .who + .track`，里面放
  - 持续段 `.ww-status[data-stk="层数"][style="left;width"]`
  - 结算跳字 `.ww-tick[style="left:x%"]`，引爆类（聚爆之类）加 `.burst`
- 明细与占比：异常效应伤害行 `tr.status`（缩进 + ↳），标签用 `.ww-tag.status[data-el]`（虚线框）
- 耐力：角色卡里 `.ww-stamina[style="--p"]`（低于阈值加 `.low`）；时间轴资源行可加 `.ww-lane.res.stamina`；因耐力不足被拒的动作加 `.no-stamina`
- 后台：不在场触发的协同攻击 `.ww-act.offfield`；在场区间底色 `.track > .onfield > i[style="left;width"]`，一眼能看出谁全程没上场

## 截断（按比例计入）
- 跨过窗口边界的动作块：`.ww-act[data-truncated][data-credit="0~1"][title="计入 13%"]`，右端渐隐 + 虚线边 + “✂”
- 明细表对应行也可加 `tr[data-truncated]`，首格显示“截断”角标
- 窗口终点线（可选）：时间轴第一条 `.track` 里放 `<i class="ww-window-end" style="left:x%">`

## 稳态开局 / 残值
- 汇总卡模式标：`.ww-tag.mode.steady`（稳态开局）、`.ww-tag.mode.residual`（含残值引导），`title` 写选择理由
- 窗口外仍生效的增益：在 `.ww-buffbar` 里追加 `<i class="residual" title="窗口结束后仍剩 x.x 秒，不计入伤害">`，不用写 left/width。
  每条轨道右端固定留 18px 的“窗口外”槽位，残值统一画成槽位里的斜纹短条加“⇢”，时长写在 title 里
- 稳态开局：每条 `.track` 起点放 `<i class="ww-carry">`，表示状态继承自上一轮

## 共鸣链未建模
- 链节点：用户选了但模块没建模的那几节，`<i class="on unmodeled">`（空心虚线菱形 + 琥珀点）
- 提示标签：`.ww-tag.chain-cap`，文字“按 N 链”，`title` 写“共鸣链未建模，按 N 链计算”；放在卡位里会自动贴在右上角“号位”下方，也可放在配置区共鸣链下拉旁边
- 字段名以建模师贴出的为准，样式只依赖上面两个 class

## 时停口径
- 汇总卡标签：`.ww-tag.timestop`，文字“时停 +x 秒”（`timeStopSaved`），为 0 时加 `.zero` 变淡；带一个小时钟图标
- 口径开关：`.ww-seg.timestop-seg`，两个按钮“时停不计时 / 按完整动画”，选中为淡紫色
- 时间轴（可选）：时停区段 `.track > i.ww-freeze[style="left;width"]`，淡紫色细竖纹

## 窗口末尾时停红利
- 汇总卡：`<span class="ww-tag tail-freeze" title="...">尾段时停 X%</span>`，放在时停标签旁边。
- 时间轴：对应的 `.ww-act` 加 `data-tail-freeze`，会画琥珀色虚线外框。

## 角色头像（三个游戏通用）
- 引擎在要显示头像的地方（角色选择、编队卡位、时间轴泳道 `.who`）只输出一个占位元素：
  `<span class="gava md" data-icon="assets/avatars/1304.webp" data-el="spectro" data-name="守岸人"></span>`
  - `data-icon` = 数据里的 `avatar` 字段（相对包根目录）；`avatar` 为 `null` 时**不写** `data-icon`
  - `data-el` 写数据里的原始属性值即可：英文键（`spectro`、`Thunder`、`Cryst`…）或中文名（`衍射`、`雷`、`寒冷`…）都认，认不出显示中性灰
  - `data-name` 写角色名，徽章取首字（跳过开头括号、标点；英文名取首字母大写）
- `assets/theme/avatar.js`（已由 apply-theme.py 注入）负责填充：有图叠 `<img loading=lazy>`，没图或加载失败退回徽章（属性色底 + 首字）。
  引擎重绘、改 `data-icon/data-name/data-el` 都会自动重新处理，不用手动调用；需要时可调 `window.__gava.refresh(root)`
- 尺寸：`.sm` 20px、`.md` 32px、`.lg` 56px，或 `style="--gava-size:40px"`；默认 1.4em
- 外框随主题：星铁圆形星环、终末地切角方框、鸣潮菱形金边。编队卡位 `.ww-slot .ava` 里放 `.gava` 可直接替代 `.ww-el`
- 不要往 `.gava` 里写子元素，也不要给它写边框、圆角；`data-gava`、`data-gava-el`、`.gava-img/.gava-loaded/.gava-err` 是脚本内部状态
