# Workbench 产品

Workbench 是 Flutter Monitor 的排查工作台：面向开发者与 QA，用统一 `EventEnvelope` 还原 HTTP、埋点、异常与会话链路。它不是 SDK，不定义第二套事件模型。

视觉与交互以 shadcn（new-york）+ Tailwind v4 为基线：专业、克制，优先扫描、筛选、定位和 raw 回查。Raw JSON 放在详情深读区，不抢第一视觉。主验收视口为桌面 1440 / 1280。

---

## 信息架构

```text
一级导航（仅文字，无 Icon）
  概览        /
  Session     /sessions
  HTTP        /http
  埋点        /business
  异常        /errors

二级
  Session 工作区     /sessions/$sessionId?eventId=&traceId=
  HTTP 独立详情页    /http/$eventId
  埋点独立详情页     /business/$eventId
  异常独立详情页     /errors/$eventId
  Catalog Sheet      展开预览（行内按钮 / Preview 次按钮）
```

Session 为一级入口：列表在 `/sessions`，链路工作区在 `/sessions/$sessionId`。旧 Overview / Startup / Pages / Network / Jank 等路径只做兼容重定向。侧栏不再展示「最近 Session」。

壳层：侧栏、面包屑、Live 开关、刷新。Live 开启时通过 SSE 失效查询缓存，不抢走当前选中行。

---

## 共享能力

### 范围筛选（Scope）

概览、Session、HTTP、埋点、异常顶部共用总 Scope（资源与用户维度）：

- 时间 `from` / `to`
- `userId`（真实候选 Combobox）
- `appKey`、`packageName`、`appVersion`、`environment`、`devicePlatform`

`sessionId` 与 `route` **不在总 Scope 条展示**。它们仍使用同一套 URL 参数，由各 Catalog 领域筛选条编辑；一级导航与 `pickScopeSearch` 会继续携带，保证深链与跨页排查口径可复现。概览不提供这两项的 UI，但若 URL 已带值仍会生效。

筛选同步到 URL，并在本地持久化；一级导航、面包屑和详情返回时完整携带 Scope（`pickScopeSearch`）。文本类筛大约 300ms debounce，清空立即重置。所有总筛选始终平铺展示，空间不足时换行，不收进「更多筛选」或 Sheet。选择框统一复用 `MultiSelect` / `MultiCombobox` 样式，空态触发器只显示短维度名（应用 / 版本 / 环境…），不加「全部」前缀；宽度保持紧凑。总 Scope 与各领域筛选条统一使用右侧「重置筛选」按钮（`ghost` + `RotateCcw`），左侧为筛选项、右侧为操作。

总 Scope 的时间默认全部时间，即 URL 不写 `from` / `to`。时间范围支持精确到分钟，交互为**单一** DateRangePicker：一个触发器打开 Popover，左侧为快捷范围（近 12 小时、近 24 小时、近 3 天、近 7 天、近 30 天与「全部时间」），右侧为单月日历（`mode=range`，两次点击选起止日）与两个独立的 `time` 输入（对齐 shadcn Time Picker，不再使用双月日历或 `datetime-local`）。快捷项只负责写入同一组固定 `from` / `to`；手工修改日期或时刻后按自定义范围处理，保证概览、列表、详情和手动刷新时口径一致且可复现。

概览消费总 Scope（含 URL 中可能存在的 `sessionId` / `route`）。响应使用 `resolvedRange` 说明当前查询实际跨度和快照时间。图表时间桶点击可以把桶的 `from` / `to` 作为一次性下钻条件覆盖当前时间范围并带入 Catalog。

### Catalog 模式

HTTP / 埋点 / 异常 / Session 共用同一套 Catalog 工作流：

1. **列表**：分页、排序、loading / empty / error / noResults（通用表格）
2. **Preview**（宽屏 ≥1400px）：选中行摘要与操作；Session / HTTP / 埋点 / 异常 Catalog 列表与 Preview 用竖向分隔条按像素拖拽调宽（本地持久化），窄屏仍只显示列表
3. **单击行**：只选中 Preview，不自动开 Sheet
4. **展开预览**：行内 `PanelRight` 按钮，或 Preview「展开预览」→ Sheet
5. **打开详情 / 双击行**：进入独立详情页（HTTP `/http/$id`、埋点 `/business/$id`、异常 `/errors/$id`、Session `/sessions/$id`）；二级页顶栏返回操作为仅图标按钮（`aria-label` 保留「返回列表」等语义）
6. **查看 Session**：仅事件域（HTTP / 埋点 / 异常）保留

领域筛选条（HTTP / Session / 埋点 / 异常）统一：同高度控件、`MultiSelect` / `MultiCombobox` 多选与选中态、右侧「重置筛选」（与总 Scope 同款）、不展示条数；文本筛约 300ms debounce。

- HTTP / 埋点 / 异常领域条另含多选 `sessionId`（真实候选 Combobox）与 `route`
- Session 领域条继续提供 Session ID / 路由 / 状态 / 问题类型

时间统一展示为 `YYYY-MM-DD HH:mm:ss`。可复制 `eventId` / `sessionId` / `traceId`（HTTP 另含 `requestId`）。

### Catalog 展示协议

一级 Catalog（Session / HTTP / 埋点 / 异常）共用「通用列块 + 域特有列」：

- **文案**：面向用户的 label 一律中文；禁止表头出现 `UserID` / `UserId` / `Action` / `Message` 等混用。
- **通用尾列顺序（固定）**：路由 → 环境 → 用户 → 版本。取值对应 `context.route.name`、`resource.app.environment`、`context.user.userId`、`resource.app.appVersion`。
- **版本列**：只展示 `appVersion`；`buildNumber` 不进一级表格，仅在详情环境画像中展示。
- **HTTP 请求 ID**：属于 HTTP 域特有列与筛选项，必须保留在列表中，不并入通用列块。
- **Session 列**：HTTP / 埋点 / 异常主表在通用尾列之后、操作列之前展示 `sessionId`；Session 列表本身以 Session 为主列，不再重复尾列 Session。

推荐列序：

| 域 | 列序 |
|---|---|
| Session | 时间 · Session · 状态 · 问题 · 事件 · 路由 · 环境 · 用户 · 版本 · 操作 |
| HTTP | 时间 · 方法 · URL · 状态码 · 业务码 · 耗时 · 请求 ID · 路由 · 环境 · 用户 · 版本 · Session · 操作 |
| 埋点 | 时间 · 动作 · 结果 · 路由 · 环境 · 用户 · 版本 · Session · 操作 |
| 异常 | 时间 · 类型 · 消息 · 次数 · 处理状态 · 路由 · 环境 · 用户 · 版本 · Session · 操作 |

Preview 尾部 facts 统一：路由 · 环境 · 用户 · 版本 · 平台 · 时间；域摘要接在前面。ids 区用：事件 ID · Session · Trace ·（HTTP）请求 ID。

HTTP 详情顶栏：第一行域结果（状态码 / 业务码 / method / 耗时 / 路由）；第二行上下文摘要（用户 · 版本 · 环境 · 平台 · Session）。

### 详情环境画像

独立详情页与 Session 工作区「上下文」Tab 使用结构化环境画像，不直接 dump `resource` / `context` JSON。分组包括：用户、页面、业务上下文、发布、网络、生命周期、Native、应用、设备、运行时、SDK、链路 ID。`buildNumber`、feature flags、route stack、设备型号等只在此层展示。完整 envelope 仍放 Raw Tab。

---

## HTTP（样板）

路径：`/http`。数据：`GET /api/monitor/v1/catalog/http` 摘要列表 + 按需 `events/:eventId` 拉完整 envelope。

### 筛选

- Scope + 领域筛：URL（模糊）、method、成败、`requestId`、HTTP 状态码、业务码、Host、仅慢请求（阈值）、多选 `sessionId` / `route`
- 列表默认展示 path（可开关完整 URL）
- 业务码由 service 在 ingest 时从响应 body 顶层 `code` 派生索引，不改 SDK；详情缺失时有 `businessCodeState` 区分

### 列表与选中

- 列序：时间 · 方法 · URL · 状态码 · 业务码 · 耗时 · 请求 ID · 路由 · 环境 · 用户 · 版本 · Session · 操作
- 按时间或耗时排序；分页 25 / 50 / 100
- 单击行：只选中 Preview
- 行内展开 / Preview「展开预览」：打开 Sheet
- 打开详情 / 双击：进 `/http/$eventId`
- 行菜单：打开详情、展开预览、查看 Session、复制 ID

### Preview、Sheet 与独立详情页

- Preview：状态、关键事实、「打开详情」进独立页、「展开预览」开 Sheet、查看 Session
- Sheet：请求 / 响应 / 上下文 / Raw；上一条 / 下一条；全屏进独立页；可复制 cURL
- 独立详情页：同 Sheet 深读内容，可回列表、查看 Session
- 详情被剥离或截断时如实展示（如 `detailDropped`），不伪造 body

### 明确不做

- 不做 in-flight 请求（SDK 只上报 completed `http.client`）
- 列表行不内联 headers / body

---

## 概览

路径：`/`。概览是完整的监控驾驶舱，在当前维度 Scope 内统一观察启动、页面、Session、HTTP、埋点和异常，并直接进入 Catalog、事件详情或 Session 工作区。

内容使用长页 Dashboard 编排：

1. 启动质量、HTTP 请求、页面体验、稳定性四类彩色 KPI。
2. 启动耗时趋势、页面加载耗时趋势、HTTP 健康与耗时分布、Session 健康。
3. 埋点动作排行、页面进入次数排行、异常类型与版本 / 环境质量对比。
4. 最近问题列表与可回查的 Session 链路时间线。

每个图表必须有 hover tooltip、图例反馈和点击反馈。点击分类、扇区、柱或时间桶后直接进入对应 Catalog；代表事件直接进入独立详情或带 `eventId` / `traceId` 的 Session 工作区，不经过领域分析页。

Session KPI 表示范围内至少有一条事件的去重 Session 数，界面文案使用「活跃 Session」。异常保持现有 Catalog 口径，即稳定性错误与业务失败的无重复并集，并排除 completed HTTP；业务失败同时出现在埋点失败统计与异常集合中，界面必须明确标注，不能把四个领域数量相加为总事件量。

默认不展示内存、帧数、jank、native。主标签避免直接使用 p50 / p95 等术语。

概览图表使用查询快照与手动刷新，不要求 SSE 驱动实时动画。响应展示 `generatedAt`；Catalog 与 Session 继续使用现有 Live 失效机制。旧 `/sessions/analytics`、`/http/analytics`、`/business/analytics`、`/errors/analytics` 只保留兼容重定向，分别回到对应 Catalog。

---

## 埋点

路径：`/business`。集合：带 `business.action` 的单次埋点与 `business.action.summary`；`measure` 不进主集合。

- 筛：action、result（success / failed / cancelled）、多选 `sessionId` / `route`
- 列：时间 · 动作 · 结果 · 路由 · 环境 · 用户 · 版本 · Session · 操作
- 交互与 HTTP 一致：展开 Sheet / 打开详情进 `/business/$eventId`
- Record：属性 / 关联 / 上下文（环境画像） / Raw；关联区展示同 session 近期 HTTP / 埋点 / error 摘要卡

**当前局限：** 关联区偏展示；详情页深度仍弱于 HTTP（无 cURL 级检视）。

---

## 异常

路径：`/errors`。集合：稳定性 `error` 与 `business.result=failed` 的无重复并集；排除 completed HTTP、jank、memory、native。

- 筛：errorType、mechanism、fatal / handled、仅业务失败、多选 `sessionId` / `route`
- 列：时间 · 类型 · 消息 · 次数 · 处理状态 · 路由 · 环境 · 用户 · 版本 · Session · 操作
- 交互与 HTTP 一致：展开 Sheet / 打开详情进 `/errors/$eventId`
- Record：错误信息 / stack / breadcrumbs，以及环境画像与 Raw

不做告警规则引擎或订阅推送。

**当前局限：** 详情页精修程度低于 HTTP；与概览「最近问题」的联动仍浅。

---

## Session

### 列表（一级）

路径：`/sessions`。与 HTTP / 埋点 / 异常同一套 Catalog：表格、Preview、展开 Sheet、打开详情进工作区。

列：时间 · Session · 状态 · 问题 · 事件 · 路由 · 环境 · 用户 · 版本 · 操作。

### 工作区（二级）

路径：`/sessions/$sessionId`，常用 query：`eventId`（可选 `traceId`）。由列表「打开详情 / 双击 / Sheet 全屏」进入。

### 如何进入

- 一级导航 Session → 列表 → 工作区
- 各 Catalog 的 Preview / 行菜单「查看 Session」
- 概览启动类下钻（携带可回查 `eventId`）

### 当前界面

- 顶栏：Session ID Combobox 切换会话（切换后清空 eventId）、时间跨度、用户、版本、问题计数
- 左：事件列表，Tab 为全部 / 启动 / 页面 / HTTP / 埋点 / 问题
- 右：选中事件的摘要 / 上下文 / Raw（JsonViewer）
- 窄屏用 Sheet 看详情

### 当前局限

- Session 列表尚无服务端 total 计数（分页用 hasMore 近似）
- 相对旧版 Console / 分段 Timeline / EventInspector，工作区能力已简化
- Session 内按 `traceId` 高亮 / 过滤仍弱；从工作区回来源 Catalog 的路径弱

---

## 明确不做

- 一级导航不恢复旧 Overview / Startup / Pages / Problems 拆分（Session 列表除外）
- 默认主路径不展示内存 / 帧数 / jank / native
- 列表行不内联 headers / body；Raw 不作首页装饰
- 不为业务码或设备 ID 改 SDK（业务码 service 派生；设备 ID 暂不做）
- 不做多租户、线上长期告警治理（超出当前本地 / 调试 Workbench 边界）
