# Phase 5：Workbench 体验升级计划

## Meta

- status: proposed
- last_updated: 2026-07-11
- baseline: 四入口与二级 Session 数据闭环可复用；现有页面视觉和组合不作为基线
- decision order: [`FEATURES.md`](FEATURES.md) → [`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md) → [`DESIGN.md`](DESIGN.md) → 工程惯例
- implementation order: docs → 必要 service → datasource/web → 验证与人工验收

## 背景与本轮门禁

当前工作区存在一轮未验收的 Phase 5 尝试。该尝试只能作为问题样本，不能作为新基线，也不能因已经写入代码或通过构建而被视为完成。

正式实施前必须先完成现有改动审计：

1. 逐文件识别当前未提交改动，不覆盖用户无关改动。
2. 以当前数据层、路由和 EventEnvelope 链路为复用基础，页面视觉按官方 shadcn 基线重建。
3. `FEATURES.md`、`DESIGN.md` 和本计划完成用户确认前，不开始大规模页面实现。

`status` 只能按 `proposed → in_progress → review → complete` 推进。构建通过不等于用户验收，未验收时禁止写 `complete`。

## 目标

1. 用 shadcn 官方组件与 Dashboard Blocks 的结构重建 Workbench App Shell、Sidebar、Breadcrumb、Catalog Table 和筛选控件。
2. 保留四入口信息架构、数据查询、URL 状态和 Session 二级深链；不保留现有自定义 semantic tokens 的视觉约束。
3. 补齐全站时间、Select、文本筛选与 ID 候选选择体验。
4. 用 Tremor 实现五张可 drilldown 的大屏图表，并彻底移除 echarts 与旧 performance 页面残留。
5. 所有 service 摘要和图表点击目标都能通过 `eventId` 回查原始 `EventEnvelope`；不改 SDK/core，不建立第二套模型。

## 非范围

- 不迁移到 MUI、Ant Design 或 Element Plus。
- 不恢复 Overview、Sessions、Startup、Pages、Jank 等旧一级入口。
- 不重做完整 Session Console，不做多 Session 浏览或对比。
- 不把 memory、jank、native 放回默认主路径。
- 不改 SDK/core 事件模型，不给 `EventEnvelope` 回写 service 派生字段。
- 不引入第二套图表引擎，不保留“暂时还可能用到”的 echarts 死代码。
- 不借本轮做无关视觉翻新或数据层重构。
- 本轮优先完成 PC；移动端不作为首轮阻塞条件。

## 已锁定的产品结果

### 一级与二级结构

- 一级导航固定为：大屏 / HTTP / 埋点 / 异常。
- Session 仅由大屏、Catalog 或 Record 深链进入。
- 桌面使用可折叠 Sidebar；窄屏使用 shadcn Sidebar 的移动 Sheet 语义，不把 56px 图标栏强塞进手机视口。
- 页面 Header 统一承载移动导航触发、Breadcrumb、live 状态与页面级操作；业务页不得各自手写另一套 Header 壳。

### 大屏第一屏

- 共享范围条。
- 不超过 4 个可点核心指标。
- 5 张 Tremor 图。
- 最近失败 HTTP / 异常与业务失败列表。

五张图固定为：

| 图表 | 口径 | 默认范围 | 点击结果 |
| --- | --- | --- | --- |
| 质量趋势 | HTTP 失败、error、业务失败的时间分桶 | 未指定范围时近 24 小时、按小时 | 进入对应 Catalog，并写入该桶 `from` / `to` 与类型筛选 |
| HTTP 健康 | 请求量柱 + 失败率线 | 跟随范围条 | 进入该桶 HTTP Catalog |
| 埋点结果趋势 | success / failed / cancelled 堆叠柱 | 跟随范围条 | 进入该桶与结果预筛的埋点 Catalog |
| 业务动作排行 | Action 总量与失败数 TopN | 跟随范围条 | 进入 Action 预筛的埋点 Catalog |
| 启动趋势 | 冷启动平均耗时、慢启动次数和代表事件 | 跟随范围条 | 进入代表事件所在 Session |

图表标题使用“质量趋势”“HTTP 健康”“埋点结果趋势”“业务动作排行”“启动趋势”等人话；p50/p95 只能出现在 tooltip 或口径说明中。图表必须具有 loading、empty、error 和当前范围说明，不得用零值伪装无数据。

## 组件策略

shadcn 是复制进仓库维护的组件源码。本轮以官方 registry 源码、官方文档示例和官方 Dashboard Blocks 为最高基线，不再把现有项目 token 映射作为前提。

### 必须落地的官方能力

| 能力 | 用途 | 业务层允许做的事 |
| --- | --- | --- |
| Sidebar | App Shell、桌面折叠、移动 Sheet、导航分组 | 提供四入口配置、live/刷新动作和产品标识 |
| Breadcrumb | 页面层级、Record/Session 二级位置 | 将路由元数据映射为人话标签 |
| Table | HTTP / 埋点 / 异常 Catalog 骨架 | 保留领域列、行选择、键盘打开与 sticky header |
| Command + Popover | ID Combobox | 接真实候选、异步状态、模糊选择与清除 |
| Select | 有限枚举筛选 | 映射“全部方法/全部环境”等稳定空态 |
| Dropdown Menu | 行操作与更多筛选 | 放低频命令，不隐藏核心筛选 |
| Pagination | 服务端分页 | 映射 URL 中 page/pageSize，保留结果总数 |
| Skeleton | 首次加载 | 尺寸稳定，不覆盖可继续输入的筛选条 |
| Separator / Sheet / Tooltip | 结构和窄屏交互 | 只做 token 与业务文案适配 |

### 禁止的实现方式

- 页面内重新写 Sidebar、Breadcrumb、Table、Popover 的临时 div 版本。
- 只复制 shadcn 文件名或 className 外形，却不保留官方状态、键盘和移动端行为。
- 为追求“官方默认外观”绕开 `styles.css` semantic tokens。
- 把 Catalog、Record、Scope 等领域组件塞进 `components/ui/`。
- 用 Card 套 Card 组织页面区块，或用营销式大圆角卡片墙承载工作台。

### 来源与维护门禁

- `components.json` 必须记录当前 shadcn 配置。
- `components/ui/*` 保持 primitive 边界；业务组合留在 `features/*` 或 `app/*`。
- 每个引入的官方组件先保留官方 API，再做最小 token 映射；行为偏离官方实现时在 PR/交付记录说明原因。
- lucide 继续作为图标来源；不手绘已有语义图标。

## 数据与交互契约

### 时间

- 可见时间统一为本地时区 `YYYY-MM-DD HH:mm:ss`。
- 原始 ISO 时间或毫秒值放在 tooltip / `title` 中，数据本身不被格式化后回写。
- Catalog、Preview、Record 摘要、最近问题与 Session 时间线共用一个 formatter 和测试用例。
- 相对时间只能作为补充，不能替代绝对时间。

### Select

- 未选择时必须显示“全部环境”“全部版本”“全部方法”等明确值。
- “全部”是 UI 空态，URL 中删除该参数，不发送空字符串作为有效筛选。
- 清除筛选后回到第一页，并清理已不属于结果集的 `eventId` / `detail`。

### 文本筛选

- 输入值与已提交 URL 值分离：输入后约 300ms debounce，再使用 router `replace` 更新 URL，避免每个字符污染浏览器历史。
- 清空立即删除该筛选并回到第一页，不等待 debounce。
- 回车可立即提交但不是唯一查询方式。
- 后台查询不得锁住输入框；已有结果在刷新时尽量保留。

### ID Combobox

- `userId`、`sessionId` 和 HTTP `requestId` 使用真实 service 候选；禁止假数据和只在前端当前页过滤。
- 候选匹配为大小写不敏感 substring；排序固定为：完全匹配 → 前缀匹配 → 其余包含匹配 → 最近出现时间 → 稳定字典序。
- 示例候选 `123`、`12`、`345`：输入 `12` 返回 `12`、`123`；输入 `3` 返回 `345`、`123`。
- 输入约 200–300ms 后请求；旧请求需取消或忽略过期响应。
- loading、无候选、请求失败、清除、键盘上下选择和 Esc 关闭均有明确状态。
- 选中后把规范 ID 写入 URL；清除后删除对应参数并回到第一页。

### Service suggest/dimensions

优先扩展现有 dimensions 能力，不新增与现有查询重复的协议。接口必须支持：

- 候选种类：`userId`、`sessionId`、`requestId`。
- `q` substring 查询、`limit` 上限和共享范围筛选。
- 返回 `value`、可选计数/最近时间；若返回 `eventId`，必须可通过 detail API 回查 envelope。
- SQLite 查询使用现有派生索引；不得扫描并拼装一套持久化业务模型，也不得写回 envelope。
- service 与 datasource 类型、Swagger/边界文档和 smoke test 同步更新。

### 图表查询

- 长期口径由 service 做时间分桶；前端不得拉取当前一页 Catalog 后冒充趋势。
- 默认时间范围由查询层明确补为近 24 小时，并在响应或 UI 中可见。
- 每个分桶返回明确的 `from` / `to`、各系列计数和 drilldown 类型。
- 启动概况若提供代表事件，必须包含 `eventId` 与 `sessionId`，且能回查 envelope。
- 图表响应是 Workbench 查询 view model，不成为新的 SDK/core 协议。

## 分轮实施

每轮完成后先由用户验收，再进入下一轮。不得一次性铺完后只交付构建结果。

### 第 0 轮：恢复基线与锁定文档

步骤 0.1：审计现有改动

- 审计当前未提交改动，分离上一轮 Phase 5 尝试与用户其它改动。
- 撤回失败尝试，恢复 Phase 1–4 的四入口、Catalog/Record 和 Session 深链。
- 记录审计结果，避免误删用户改动或数据层资产。

步骤 0.2：文档收口

- 更新 `FEATURES.md`：把五张图、筛选体验、最近 Session 与真实候选能力写成功能事实。
- 更新 `DESIGN.md`：写清官方 shadcn 来源、Shell 结构、移动 Sidebar、表格/筛选模式、Tremor 状态和 drilldown。
- 本计划保持 `in_progress`，不提前记录交付完成。

验收物：无新 UI；提交文档 diff、基线验证结果和待实现页面清单。

### 第 1 轮：官方 Shell 与 Catalog 骨架

步骤 1.1：shadcn 基础能力

- 建立 `components.json`，按官方 registry 引入 Sidebar、Breadcrumb、Table、Command/Popover、Select、Dropdown Menu、Pagination、Skeleton、Separator。
- 先使用官方 theme 和组件默认状态，覆盖 hover、focus、disabled、loading 等官方行为。
- 用官方 Dashboard Block 的组合关系重建 App Shell；保留 live、刷新、折叠和四入口。

步骤 1.2：四入口迁移

- 大屏、HTTP、埋点、异常迁入统一 Page Header / Breadcrumb / 主滚动容器。
- 三类 Catalog 使用统一 Table/Data Table 组合，但保留各领域列和 Preview/Record 语义。
- Session 路由使用同一二级 Header，保持 `sessionId + eventId + traceId` 深链。
- 首轮验证 1440px、1280px 和 1024px PC 视口；移动端另行规划。

验收物：1440px、1280px、1024px 的四入口与 Session PC 截图；Sidebar 桌面行为；HTTP 表格键盘与 Record 返回链路。此轮不以移动端或五张图作为验收重点。

### 第 2 轮：筛选体验与 service 候选

步骤 2.1：service 与 datasource

- 扩展 dimensions/suggest 的 userId、sessionId、requestId 查询、排序与范围约束。
- 补充 SQLite 查询、接口类型、Swagger/边界文档和 smoke test。
- 为后续趋势确认 timeseries 的范围、桶边界、系列与代表启动事件契约；若现有尝试不满足契约则重写。

步骤 2.2：全站筛选

- 统一时间 formatter。
- 修复所有 Select 的“全部 xxx”空态。
- URL/action/error 等文本筛接入 300ms debounce、清空重置和 `replace` 历史策略。
- userId/sessionId/requestId 接入 Command Combobox，覆盖示例排序与异步状态。

验收物：用真实数据演示 ID 模糊候选；逐项验证 URL、刷新、前进后退、清空、分页与 selection 清理；对比列表/Preview/Session 时间一致性。

### 第 3 轮：Tremor 大屏与 echarts 清理

步骤 3.1：五张可下钻图

- 使用 Tremor AreaChart/ComboChart/BarChart/BarList 等官方组件实现五图。
- 图表只消费 service 聚合结果，映射 semantic tokens，保持 border-first 和紧凑密度。
- 图例、tooltip、键盘/点击目标、loading、empty、error、禁用下钻原因完整。
- 图表与四个指标卡、最近问题共用范围，并保持第一屏可扫描。

步骤 3.2：清理与闭环

- 删除 echarts 依赖、初始化封装、旧 performance 页面和已无路由消费者的残留样式/测试。
- 检查路由重定向仍指向四入口，不恢复双重信息架构。
- 对五图逐项验证目标 Catalog 的类型与时间预筛，以及启动图的 Session `eventId` 定位。

验收物：大屏桌面与窄屏截图；五图各至少一次真实 drilldown；无数据与错误态；依赖与源码全局搜索证明无 echarts。

### 第 4 轮：最终验证与文档结项

步骤 4.1：自动验证

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
git diff --check
```

按变更风险补充 service 单测和目标组件测试；最后运行 `bash scripts/check.sh`。若失败来自本轮范围外的既有问题，必须明确列出，不得伪报全绿。

步骤 4.2：人工验收

- 视口：1440px、1280px、1024px；移动端另行验收。
- 页面：大屏、HTTP、埋点、异常、Session。
- 状态：正常、loading、empty、noResults、error、后台刷新。
- 交互：Sidebar、Breadcrumb、Table 键盘、Date Picker、Select、debounce、Combobox、分页、Session 切换、Record、浏览器返回、五图 drilldown。
- 数据：任取 Catalog 摘要、图表代表事件和 Session 节点，均能通过 `eventId` 回查原始 envelope。

用户验收通过后，才把本文件状态改为 `complete`，并在 `DESIGN.md` 记录 Phase 5 样板确认日期与结论。

## 验收红线

出现任一项即不通过：

- Shell 仍由页面内临时 div 拼成，只是换了 shadcn 类名。
- 移动端仍显示压缩后的桌面图标栏，或出现页面级横向滚动。
- Select 未选中时 trigger 空白。
- 文本筛选仍只能靠回车，或每个按键新增一条浏览器历史。
- ID 候选来自假数据、当前页过滤，或排序不满足约定。
- 图表不可点击、点击后不带范围/类型、无数据展示为零值正常态。
- 图表摘要或启动代表事件无法回查 `EventEnvelope`。
- echarts 与 Tremor 双引擎并存。
- Session 重回一级导航，或 memory/jank/native 重回默认第一屏。
- 文档、service、datasource 和 UI 的筛选字段或时间口径不一致。

## 状态跟踪

| 轮次 | 步骤一 | 步骤二 | 用户验收 | 状态 |
| --- | --- | --- | --- | --- |
| 0. 基线与文档 | 已完成 | 已完成 | 一次性交付中 | complete |
| 1. Shell 与 Catalog | 待开始 | 待开始 | 待验收 | pending |
| 2. 筛选与 service | 待开始 | 待开始 | 待验收 | pending |
| 3. Tremor 与清理 | 待开始 | 待开始 | 待验收 | pending |
| 4. 最终验证 | 待开始 | 待开始 | 待验收 | pending |

开始或完成某一步时同步更新本表。不得一次性把未实际完成或未由用户验收的轮次标为完成。
