# Flutter Monitor Workbench Product Plan

本文档沉淀 Workbench 前端的产品定位、展示原则、信息架构和交互设计。`platform/docs/workbench_plan.md` 负责 Workbench 架构、Service、Datasource 和协议边界；本文负责回答 Workbench Web 应该如何展示、如何帮助开发者排查问题。

Workbench Web 不是普通 JSON Viewer，也不是传统线上监控大盘。它是面向本地调试、QA 复现、性能分析和链路排查的可视化诊断工作台。它应让开发者先看懂一次 App 使用过程，再回到完整 `EventEnvelope` 细节。

## 产品定位

Workbench 是以 session 为主线的 Flutter 端侧链路诊断工作台，用可视化方式帮助开发者理解一次 App 使用过程中的启动、页面、请求、行为、错误、卡顿、内存和生命周期表现。

Workbench 前端的核心目标：

- 快速发现当前复现链路中最值得排查的问题。
- 根据 QA 提供的 `userId + time range` 快速找到 session。
- 还原一次用户或 QA 会话中的启动、页面进入、停留、请求、行为、错误和卡顿顺序。
- 解释冷启动、热启动、页面进入、页面停留、页面稳定性和异常情况。
- 从任何聚合视图、图表点位或问题列表回到对应 session timeline。
- 保留完整 raw JSON，但不把 raw JSON 作为第一视觉入口。

Workbench Web 可以复用到未来线上排查，但第一阶段优先服务本地调试、QA 快速复现和性能分析。它不定义第二套事件模型，不改变 SDK envelope，不因为数据源不同而拆成多个工作台。

第一阶段的三个场景是**平权兼顾**，不取舍其一，但各自对 UI 的诉求不同：

- **本地实时自调试**：开发者本地跑 example 或真机，刚复现完立刻看。通常只有一个新 session，依赖 SSE 近实时，期望最新链路自动浮出，无需先检索。
- **QA 复现交接**：QA 先复现，给出 `userId + 大概时间`，开发事后再查。依赖强检索（用户、时间范围、版本、环境、页面、问题类型）和 session list。
- **性能回归分析**：反复复现同一路径，关注冷/热启动、页面进入耗时随复现次数的变化趋势。依赖趋势折线、慢阈值线和点位回查。

这三者共同决定信息架构必须同时提供：实时/最近 session 入口（自调试）、独立检索入口（QA）、趋势视图（回归），不能只优化其中一个。

## 典型用户问题

Workbench 应优先回答以下问题：

- QA 给出用户 ID 和大概时间后，如何找到这次复现对应的 session？
- 开发刚复现完问题，如何看到这次冷启动或热启动耗时是否异常？
- 某个页面进入很慢，慢在页面加载、首帧、接口请求还是卡顿？
- 某个页面停留期间发生了哪些错误、失败请求、卡顿或内存压力？
- 用户说不清路径时，如何通过 session timeline 还原操作链路？
- 一次错误、卡顿或失败请求发生前后，用户在哪个页面，做了哪些操作，附近有哪些 breadcrumbs？
- 当前本地或 QA 数据里，哪些 session 最值得先排查？

## 展示原则

Workbench 前端应遵守以下原则：

- **主标签少用统计黑话**：卡片、表格列名和图表主标签尽量不直接展示 `p50`、`p95` 这类术语。UI 应使用“平均耗时”、“中位耗时”、“慢端耗时”、“最近一次”、“最慢一次”、“慢启动次数”、“问题次数”等更容易理解的表达；但 tooltip、字段说明、开发态详情或指标映射表必须保留原始字段名和计算口径，避免展示名和数据口径脱节。
- **可视化优先**：不要只堆表格和 raw JSON。启动趋势、页面耗时、session timeline、问题分布和页面健康应尽量用图表、时间轴、状态标签和摘要卡表达。
- **Session 是主排查容器**：开发者的主要路径应是先找到 session，再在 Session Detail 内查看 timeline、trace、span、event 和 raw JSON。
- **Trace/Span/Event 是内部层级**：它们是链路结构，不应成为用户主要跳转对象。独立链接和 ID 复制可以保留，但不作为核心导航。
- **所有摘要都能回查原始数据**：任何卡片、图表点位、问题列表、页面行、启动记录，都必须能回到对应 session，并自动选中相关节点。
- **先解释再展示 JSON**：Inspector 应先展示诊断摘要、影响上下文和关联链路，再提供 raw envelope。
- **入口清晰**：最近问题 session 可以出现在首页，但必须同时提供“查看全部 Session”入口，避免用户只能从零散事件跳转。
- **数据缺失不阻塞排查**：缺少 `context.user.userId`、route、duration、device 或 network 时，应显示明确空值提示，并允许用户继续按时间、版本、页面、问题类型、session/event ID 查询。
- **不制造第二套模型**：UI view model 只服务展示，不能反向成为 SDK、service、server protocol 或 core schema 的来源。

## 信息架构

Workbench Web 的一级页面建议如下：

```text
Overview
  发现问题和进入排查

Sessions
  查找用户链路和全部 session

Session Detail
  排查主场景，展示 timeline、选中节点和 raw JSON

Startup
  冷启动、热启动趋势和明细

Pages
  页面进入、页面停留和页面稳定性分析

Problems
  错误、卡顿、失败请求、内存压力和异常统一入口
```

这些页面的职责必须清晰：

- Overview 负责告诉开发者“现在最值得看什么”。
- Sessions 负责查找和筛选 session。
- Session Detail 负责完整链路排查。
- Startup 负责启动表现的趋势、明细和慢启动入口。
- Pages 负责页面维度的性能和稳定性。
- Problems 负责统一承接错误、卡顿、失败请求、内存压力和未来 native/lifecycle 异常。

## Overview

Overview 是诊断入口页，不是重型报表页。第一屏应突出当前数据源状态、关键表现和问题入口。

建议信息结构（第一屏，**聚合指标卡领衔**）：

```text
数据源状态条（置顶，服务实时自调试感知）
  SQLite / Live 状态 / 事件数 / Session 数 / 最近上报时间

聚合指标卡（领衔，用人话表达，见“指标语言”）
  启动 / 页面 / 网络 / 卡顿 / 错误
  性能类卡片：次数 + 平均耗时 + 中位耗时 + 慢端耗时 + 最慢一次（可点） + 慢次数
  问题类卡片：问题次数 + 影响 Session + 最近一次 + 高频页面 / 高频接口

最近 / 实时 Session（服务本地自调试：刚复现的链路自动浮出）
  最新 session、是否 live、最近页面、进入按钮

最近问题 Session（服务 triage）
  最近 5-10 条含错误 / 卡顿 / 失败请求 / 异常状态的 session

查看全部 Session（服务 QA：通向独立 Sessions 检索页）
```

**已定结论**：Overview 第一屏以聚合指标卡领衔；“最近/实时 Session”与“查看全部 Session”同屏并存——前者服务本地实时自调试（刚复现的 session 直接浮出），后者通向 QA 检索入口。指标卡主标签不直接展示 `p50/p95` 等术语，但 tooltip 或字段说明中必须保留 `p50Ms/p95Ms` 等原始字段和计算口径。

最近问题 Session 可以展示：

- sessionId 的短展示和复制入口。
- 用户 ID。
- 最近页面。
- 最后事件时间。
- 错误、卡顿、失败请求数量。
- 当前状态。
- 进入 Session Detail 的按钮。

Overview 中的所有指标、列表项和图表点位都应支持进入 Session Detail，并自动选中相关节点。

## Startup

启动分析应同时覆盖冷启动和热启动。冷启动、热启动是开发者和 QA 很容易理解的性能入口，因此 UI 不应直接展示复杂统计术语。

冷启动和热启动卡片字段：

| 字段 | 含义 |
|---|---|
| 次数 | 当前筛选范围内发生了多少次冷启动或热启动 |
| 平均耗时 | 当前范围内的平均启动耗时 |
| 中位耗时 | 一半启动记录低于该耗时，对应原始字段 `p50Ms` |
| 慢端耗时 | 较慢体验侧的启动耗时，用于观察长尾问题，对应原始字段 `p95Ms` |
| 最近一次 | 最新一次启动耗时，服务刚复现后的快速确认 |
| 最慢一次 | 当前范围内耗时最长的一次启动，点击进入对应 session |
| 慢启动次数 | 超过阈值的启动次数，例如冷启动超过 1500ms、热启动超过 800ms |
| 异常次数 | 启动链路中发生 error、首帧异常、卡顿或关键阶段失败的次数 |

启动趋势图优先使用折线图：

```text
x 轴：时间或第几次启动
y 轴：启动耗时
线条：冷启动、热启动
辅助线：慢启动阈值
点位：点击进入对应 Session Detail，并选中启动 trace
```

折线图比散点图或柱状图更适合本地调试和 QA 复现，因为它能表达一段调试过程中的启动表现变化，帮助开发者发现某次复现后突然变慢。

启动详情应支持查看：

- 启动 trace。
- SDK 初始化阶段。
- 首帧阶段。
- 可交互阶段。
- 首个页面加载。
- 启动期间的首批 HTTP 请求。
- 启动期间的 error、jank、memory pressure。

## Pages

页面分析是 Workbench 的核心维度之一。页面是启动、请求、行为、错误、卡顿和停留时长的交汇点，比单纯 event 列表更符合人类排查习惯。

页面概览建议使用页面健康列表：

| 字段 | 含义 |
|---|---|
| 页面 | `context.route.name` 或可展示 route |
| 访问次数 | 当前范围内页面进入次数 |
| 平均进入耗时 | 页面进入或页面加载的平均耗时 |
| 中位进入耗时 | 一半页面进入记录低于该耗时，对应原始字段 `p50Ms` |
| 慢端进入耗时 | 较慢体验侧的页面进入耗时，对应原始字段 `p95Ms` |
| 最慢进入 | 最慢的一次页面进入，点击进入对应 session |
| 平均停留 | 用户在该页面的平均停留时长 |
| 最长停留 | 当前范围内最长停留记录 |
| 错误 | 该页面发生的 error 数量 |
| 卡顿 | 该页面发生的 jank 数量 |
| 失败请求 | 该页面发生的 failed HTTP 数量 |
| 问题 Session | 该页面关联的问题 session 数 |

页面详情应支持：

- 页面进入记录。
- 页面停留记录。
- 页面进入耗时趋势。
- 页面停留时长趋势。
- 页面关联的 HTTP 请求。
- 页面关联的 error、jank、memory pressure。
- 页面相关 session 列表。
- 用户路径来源和去向，例如从哪些页面进入、通常流向哪些页面。

点击页面列表中的页面、慢页面记录、错误、卡顿或失败请求时，应进入 Session Detail 并选中对应页面节点或问题节点。

## Problems

Problems 是统一问题入口，用于聚合稳定性和异常情况。

第一阶段问题类型：

- Error：Flutter framework error、Dart error、业务主动上报错误。
- Failed HTTP：失败请求、状态码异常、请求超时。
- Slow HTTP：慢请求。
- Jank：卡顿序列、慢帧、FPS 异常。
- Memory Pressure：内存压力、内存增长异常线索。

未来预留：

- Native crash。
- ANR。
- OOM。
- Native lifecycle。
- Lifecycle 异常。

Problems 列表建议展示：

- 问题类型。
- 发生时间。
- 页面。
- 用户。
- 版本和环境。
- 关联 session。
- 关联 trace。
- 摘要信息，例如错误消息、HTTP 状态码、卡顿帧数、内存压力等级。

点击任意问题都应进入 Session Detail，并自动选中对应 problem event。Problems 页面不应把用户带入独立 event 页面作为主路径。

## Sessions

Sessions 是查找用户链路的主入口。它应服务 QA 和开发最常见的检索方式。

核心筛选条件：

- 用户 ID。
- 时间范围。
- App 版本。
- 环境。
- 页面。
- 状态。
- 问题类型，例如 error、jank、failed HTTP、slow startup、slow page。
- sessionId、traceId、eventId 精确查找。

Session 列表建议展示：

- sessionId 短展示和复制入口。
- 用户 ID。
- 起止时间。
- 最近页面。
- App 版本和环境。
- 事件数。
- 错误数。
- 卡顿数。
- 失败请求数。
- 当前状态。

如果没有 `context.user.userId`，按用户查询应明确提示不可用，但不能阻塞按时间、页面、版本、错误或性能问题查询。

## Session Detail

Session Detail 是 Workbench 的主排查场景。大多数页面点击最终都应回到这里。

Session Detail 的第一阶段目标从“区段展开列表”升级为 **Session Console**：它既是开发联调时的日志台，也是 QA/debug/production 数据的会话排查容器。Workbench 不关心数据来自 localLive、debug 包还是 production，只消费同一套 `EventEnvelope` 并按会话聚合展示。

推荐布局：

```text
左侧
  当前 session 摘要
  Session 列表或返回入口

中间
  Session Navigator（问题入口 + 分段导航）
  日志流（按页面区段组织，支持信号筛选与自动滚动定位）

右侧
  Inspector
  HTTP 专用 Request / Response 详情
  启动、页面、交互性能、业务埋点、错误、内存、SDK 等 typed Inspector
  Raw JSON
```

左右侧栏应支持桌面端拖拽调整宽度，并把宽度保存在浏览器本地状态中。左侧用于会话列表和检索，右侧用于 Inspector 和 raw JSON；拖拽只改变 Workbench 布局，不改变 datasource、service API 或 envelope。侧栏收起态仍保持固定窄栏，移动端使用单列布局，不提供拖拽。

### Session Console 层级

Session Console 最多展示 5 层，不做无限展开树：

| 层级 | 名称 | 说明 |
|---|---|---|
| L0 | Session | 当前会话容器，展示用户、版本、设备、时间、问题入口和导出能力 |
| L1 | Segment | Workbench view model：启动链路、页面区段、后台/前台恢复、SDK 活动 |
| L2 | Signal Group | 页面性能、HTTP 请求、业务操作/交互性能、错误/卡顿/内存、生命周期、SDK 健康 |
| L3 | Event Node | 单条 `EventEnvelope`，例如 `http.client`、`page.load`、`interaction.measure`、`sdk.health.report` |
| L4 | Inspector Detail | 右侧完整诊断详情；HTTP 展示 Request/Response，所有事件保留 raw JSON |

HTTP 不是替代页面成为全局根节点，而是在 L2 成为和页面性能、业务操作、错误同级的核心信号组；每条 `http.client` 在 L3 是一条 hard evidence 事件，仍保留所属页面、trace、span 和原始 envelope 回查。

### Session Header 规则

Session Header 使用“收起态看问题，展开态看背景”的规则。

收起态只展示一行核心定位信息：

```text
[状态] [Native on/off] sessionId
时间范围 · 持续时长 · 事件数
错误 N · 业务失败 N · 失败 HTTP N · 慢 HTTP N · 慢页面 N · SDK 丢弃 N
```

收起态不展示设备、版本、资源长信息，目标是让开发者打开会话后立即知道这条 session 是否值得排查。

展开态展示四组背景信息：

| 分组 | 字段 |
|---|---|
| 对象 | userId、appVersion、environment、buildNumber、packageName |
| 设备 | platform、model、osVersion、deviceTier、refreshRate |
| 会话路径 | 首个页面、最后页面、页面数、页面停留最长项 |
| 采集健康 | output mode、sent、enqueued、retry、dropped、queue length、detail dropped |

这些都是 Workbench 根据 envelope 派生的展示摘要，不写回 SDK envelope。

Timeline 应从事件表格逐步升级为可视化链路：

- 启动事件使用明显节点。
- 页面进入和停留形成区段。
- HTTP 请求挂在对应页面上下文中。
- error、jank、memory pressure 使用醒目标记叠在对应时间位置。
- breadcrumb 使用轻量小点或折叠组展示。
- 选中节点后，Inspector 展示该节点的解释视图和 raw envelope。

**已定结论：链路形态采用「竖向页面分段时间轴 + 瀑布钻取」**

```text
▼ 启动 ──────────── 1.24s ⚠        [展开瀑布]
  ● sdk.init 120ms · app.cold_start 980ms
▼ /home 进入 ─────── 停留 8.2s      [展开瀑布]
  ● page.load 320ms
  ● http /api/feed 812ms ⚠ 500
  ✕ DioError                       ← 错误醒目
  · 点击 buy_now                    ← breadcrumb 轻量点
```

- 主视图是竖向时间轴：时间自上而下，页面进入/停留形成可折叠区段，HTTP/行为/错误/卡顿挂在所属页面区段内，error/jank 红色醒目，breadcrumb 默认折叠成轻量点。
- 任意 trace（启动、页面打开、接口链）行可“展开瀑布”：按 span 的 `startTime/endTime` 画横向条，呈现阶段的重叠、串行和空档。
- 分工：**时间轴回答“量级与顺序”（发生了什么、错在哪、谁慢），瀑布回答“时间关系”（为什么慢——重叠/串行/空档）**。前者覆盖自调试与 QA，后者主要服务性能回归。
- 分两批落地：先上竖向时间轴，瀑布作为第二批。二者天然可分离（瀑布是挂在时间轴行上的展开），先做时间轴不会让瀑布返工。
- 数据可行性：envelope 已含 `startTime/endTime/durationMs/parentSpanId` 与 `page.visit/route.push/page.stay`，页面分段和瀑布都能在前端 view model 内算出，几乎不需后端改动。

近期实现中，中间主视图采用 Session Navigator + 日志流，不再使用按时间散点的 lane map。散点在长会话中容易重叠，且不适合作为主要点击目标。

Session Navigator 固定在日志流左侧：

- 仅展示会话分段导航，例如启动链路、页面区段、SDK 活动和会话活动；不再保留独立的“快速定位”区块。
- 会话分段必须跟随当前 Tab 与子 chip 过滤：在当前视图下没有事件的分段直接隐藏，被部分过滤的分段在 meta 行中以 `tabRows / totalRows` 标注。
- 每个导航项展示区段名、耗时、事件数（必要时含过滤计数）和问题数。
- 点击区段时，日志流滚动到当前视图下该分段的第一个事件，并同步右侧 Inspector；不再因点击副作用切回 `全部` Tab。
- 当右侧 Inspector 收起时，点击日志节点必须给出可见反馈：HTTP 节点可打开专用 HTTP 详情，其他节点在当前行下方展开轻量 Quick Peek，展示一句话摘要、关键证据、上下文和“展开右侧 Inspector / 复制 ID / 打开原始事件”等操作。Quick Peek 是 Workbench view model，不新增协议字段。

问题入口下沉到日志流顶部 Tab：

- 每个 Tab 自带问题徽标，徽标只汇总本 Tab 关联的问题计数（错误/业务失败/慢页面/卡顿归到 “问题” Tab，失败 HTTP/慢 HTTP/HTTP 详情剥离归到 HTTP Tab，内存压力归到 内存 Tab，SDK 丢弃/重试/发送失败归到 SDK Tab）。
- 选中 Tab 后，Tab 行下方出现一行二级 chip：仅渲染当前 session 实际出现的问题维度，可与 Tab 叠加做问题级筛选；不存在的问题 chip 不渲染。
- 切换 Tab 自动清空二级 chip。日志流、会话分段、行选中都遵循 “Tab → 子 chip → 搜索” 这一过滤组合。

日志流默认展示全部事件，可切换：全部 / 问题 / 页面 / HTTP / 启动 / 交互性能 / 业务埋点 / 内存 / 生命周期 / SDK。分类规则：

- `interaction.measure` 或带 `attributes["interaction.mode"]` 的事件归入交互性能。
- `business.*` 或带 `attributes["business.action"]` 的非交互性能事件归入业务埋点。
- `page.*` 和 `route.*` 归入页面。
- `memory.*` 和 `native.memory.*` 归入内存。
- `sdk.*` 或 `signalType=sdk` 归入 SDK。

每个日志节点必须有一眼摘要，不只展示事件名：

```text
10:33:40  冷启动
612ms · sdk.init 24ms · firstFrame 488ms · interactive 611ms · memory 182MB

10:33:46  GET /api/monitor/v1/recent
200 · 126ms · response 82.4KB · route /app · Res headers · Res body

10:33:51  页面加载 /app
load 236ms · firstFrame 42ms · stay 1m12s · RSS +8MB

10:34:01  交互性能 refresh_feed
active 420ms · settle 180ms · slow frames 3 · action refresh_feed

10:34:05  SDK 健康
queue 33 events / 55KB · retry 2 · dropped 1 · mode production
```

这些摘要是 Workbench view model，只从 envelope 派生，不写回 SDK envelope；HTTP body、headers 等完整证据仍通过单事件 Inspector 回查。

日志行展示规则：

- 第一行：时间 · icon · 标题 · 信号 group badge · 关键状态 badge（如 HTTP 状态码、错误类型）· 耗时 badge · issueLabels。
- 第二行：唯一一条 metric strip；不再渲染 service 端拼接的 `subtitle` 字符串，也不在 row 内重复展示耗时。
- `eventId` 默认不渲染，只在 row 选中态以小字 + 复制按钮的形式出现，并附带 `traceId` 复制入口。
- `route` 仅在跨 segment 上下文（segment header 未标注 route）时才在第二行末尾追加；同一 page segment 内的 row 不再重复 route 信息。

页面节点折叠规则：

- 同一 `attributes['page.instance_id']` 下连续出现的 `page.visit` start、`route.push`、`page.load`、`page.view` 在前端聚合为一张 PageInstanceCard。
- 主行选用 `page.visit (phase=start)`，承担页面进入的核心 metric（加载、首帧、帧摘要）。其余事件作为附属行默认折叠，并在主行下以浅色标签提示存在哪些子事件（如 “路由 / 加载 / 足迹”）。
- 非进入类的 `page.stay`、`page.visit (phase=end)`、`route.pop` 不并入卡片，按原始顺序在卡片之后单独成行，作为页面闭合证据。
- 选中折叠区里的某个附属行时，卡片自动展开并高亮该行；用户手动点开/关闭后，覆盖自动展开行为。
- 折叠仅作用于 view 层，raw envelope 与 service 返回的 row 顺序不变。

滚动行为规则：

- 用户在日志流内点击 row / segment / chip：滚动策略 `block: 'nearest'`，已可见时不滚动，避免反复抖动。
- 由 URL、外部链接或 Inspector 回跳改变 `selectedEventId`：滚动策略 `block: 'center'`，仅在目标行还未在视图内时执行。
- SSE live 数据流入新 row：仅当用户已贴近列表底部（距底 < 80px）时自动跟随；否则保持用户当前阅读位置。
- 任何滚动副作用都不允许覆盖用户当前 Tab 与 chip 选择；只有当目标行在当前 Tab 谓词外才回退到 “全部”。

### HTTP Inspector

HTTP 事件右侧必须使用专用 Inspector，不再只走通用字段摘要。顶部固定摘要：

```text
GET /api/monitor/v1/recent
200 OK · 21ms · response 100.5KB · source dio · route /app
[详情完整] [body truncated] [requestId xxx]
```

Tabs 使用现有 Radix Tabs 组件，定义如下：

| Tab | 内容 |
|---|---|
| 摘要 | method、url、status、duration、request/response size、success/error type、详情完整/截断/剥离状态 |
| 请求 | `payload.url`、`payload["http.query"]`、`payload["http.detail"].request.headers/body` |
| 响应 | `attributes["http.status_code"]`、`payload["http.detail"].response.headers/body`、body 截断长度和 SHA-256 |
| 上下文 | session/trace/span、route/module/scene、user/device/app/release |
| 原始数据 | 完整 EventEnvelope JSON |

空状态必须解释原因：GET 请求无 body、本次没有 request headers、连接失败无 response、旧数据无详情，或 `payload["http.detail_dropped"] = true` 表示压力下降级剥离。注意 HTTP 详情层在 JSON 中使用扁平 key：`payload["http.query"]`、`payload["http.detail"]`，前端不能按 `payload.http.detail` 读取。

HTTP body 展示规则：

- 如果 body 是 JSON 字符串，默认解析后使用 JSON viewer 展示，避免一整行长字符串不可读。
- 如果 body 不是 JSON，按文本展示并开启自动换行。
- 提供“格式化 / 原文”切换；原文用于确认后端真实返回内容，格式化用于日常阅读。
- 大 body 不撑开页面，限定高度并保留复制完整 raw envelope 的入口。

JSON Inspector 渲染规则（response body / request body / request raw / response raw / 原始数据 / 上下文 breadcrumb）：

- 使用节点级可折叠的 JSON 树（基于 `@uiw/react-json-view`），支持 `▸` / `▾` 单节点折叠展开、点击节点旁的 copy 按钮复制子树或路径，并提供顶部 “全部展开 / 折叠 1 层 / 全部折叠” 的批量操作。
- 默认折叠层级：response/request body 与 raw envelope = `collapsed=2`；headers = `collapsed=1`，确保打开 Inspector 后能立刻看到关键结构。
- 容器统一限定 `min-h-[120px]` 与 `max-h-[320px~420px]`，保证大 body 不会挤占其它面板。
- 数值、字符串、布尔、null 在树视图中保留类型颜色（vscode 主题），与代码编辑器折叠体验一致。

### Typed Inspector 规则

右侧 Inspector 按事件类型分派组件：

| 事件类型 | Inspector |
|---|---|
| `http.client` | HTTP Inspector：摘要、请求、响应、上下文、原始数据 |
| `app.cold_start` / `app.hot_start` / `sdk.init` | 启动 Inspector：启动耗时、首帧、可交互、SDK 初始化、启动期内存 |
| `page.*` / `route.*` | 页面 Inspector：路由、加载、首帧、停留、返回/离开、页面帧与内存证据 |
| `interaction.measure` | 交互性能 Inspector：action、mode、active/settle、frame、相关 HTTP |
| `business.*` / `business.action` | 业务埋点 Inspector：业务 action、状态、耗时、业务 payload |
| error / jank | 问题 Inspector：错误类型、mechanism、stack、卡顿帧证据和上下文足迹 |
| `memory.*` / `native.memory.*` | 内存 Inspector：sample/growth/pressure/suspect leak 证据，不把 suspect 当成确定泄漏 |
| `sdk.*` | SDK Inspector：队列、flush、retry、drop、output mode、health report |
| 其他 | 通用 Inspector：一眼看懂、关联链路、上下文、原始数据 |

### Timeline 区段命名规则

Timeline 区段是 Workbench Web 基于原始 envelope 计算出的展示 view model，不是 SDK、core 或 service 协议字段。Workbench 不跨区段复制 route push/pop 事件，也不伪造前后页面节点；事件仍按 raw JSON 所属 `context.route.name`、`traceId`、`startTime/endTime/timestamp` 展示。

- `启动链路`：来自冷启动初始窗口，承接 `app.cold_start`、`sdk.init` 和启动完成前的启动期 `memory.sample`。`app.first_frame_ms` 是启动 trace 上的字段，不作为独立 timeline 事件展示。
- `页面 ${route}`：只由明确页面导航可见证据开启，即 `page.visit` 的 `event.phase=start`、`route.push`，或 `page.view` 且 `page.active_phase=page.resume`、`page.active_trigger=route_pop`。同一 `page.instance_id + traceId` 可以有多个导航可见区段：首次进入区段由 `page.enter + route_push` 表达，返回上一级后的新区段由 `page.resume + route_pop` 表达；后续 HTTP、业务足迹、交互性能、错误、卡顿和页面停留归入最近一个可见区段。归属优先使用 `page.instance_id + traceId`，业务/交互/请求/错误/卡顿节点缺少 `page.instance_id` 时可以用同一页面 `traceId` 回挂。例如 `/detail?id=2 -> /complex_list -> 返回 /detail?id=2` 时，返回后的 `interaction.measure` 应显示在 `页面 /detail?id=2 · 返回后继续` 区段，而不是回挂到首次进入区段。`page.resume + lifecycle_resumed` 只表示 App 前台恢复，不开启页面区段。
- 页面区段标题可根据内容追加诊断语义，但不改变底层数据归属。优先级为：错误/业务失败、交互性能、业务操作、失败请求、卡顿、内存/生命周期。例如 `页面 /detail?id=1 · 业务失败 · 业务操作`、`页面 /detail?id=2 · 交互性能`。
- `页面活动 ${route}`：只用于无法绑定到具体页面实例或不应开启页面区段的当前 route 非页面事件窗口，包括跨页面生命周期、热重启、前台恢复 `page.resume + lifecycle_resumed`、缺少 `page.instance_id` 的内存采样等。具体问题类型仍放入摘要，例如 `失败请求 5`、`错误 2`、`热重启 1`、`后台 8.63s`。
- `会话活动`：缺少 route 上下文的非页面事件窗口。
- `SDK 诊断`：正常 `sdk.health.report`、成功的 `sdk.lifecycle.flush` 等自监控事件默认并入当前页面或会话活动区段，作为节点和摘要指标展示，不单独打断用户操作主线。只有 `sdk.queue.state`、`sdk.retry.schedule`、`sdk.queue.drop`、失败的 `sdk.output.flush`，或带 dropped/retry/flush failure 计数的 `sdk.health.report`，才作为异常 SDK 诊断突出；若无法归入当前页面/活动区段，才兜底展示为独立 SDK 区段。这类事件不应因为缺少 route 被展示为“未知页面”；如果区段内 SDK 事件带有 route，应展示 route。`sdk.queue.drop` 应展示 drop reason、drop count 和 `payload["dropped.summary"]` 中的被丢弃事件摘要。

页面离开与停留的展示按语义区分：`route.pop` 是导航返回动作，`page.visit end` 是被 pop 页面实例闭合，`payload.page.end_reason=route_pop` 且 `attributes.page.to` 存在时显示为 `返回 ${to}`；`page.stay` 是停留指标，不代表页面慢，也不抢占返回/离开动作的视觉终点。页面加载耗时和首帧耗时读取 `page.load` 上的 `page.load_ms` / `page.first_frame_ms`；页面帧表现与 RSS 变化读取同一页面主链路的 `page.visit end`。同 route 多次进入时，Workbench 内部可用 `page.instance_id + traceId` 合并事件，但主界面优先展示 `context.route.fullName`，实例 id 只在 Inspector/raw JSON 诊断中出现。

启动和页面性能证据都来自主链路：启动读取 `app.cold_start` / `app.hot_start` end 上的 `memory.start/end/delta_rss_mb`，不再展示启动 FPS 或启动帧稳定性；页面读取 `page.visit` end 上的 `frame.*` 与 `memory.enter/exit/delta_rss_mb`。Workbench 不展示独立 `ui.frame.window`、页面 activity `memory.sample` 或迁移期过滤字段作为新增性能口径。`interaction.measure` 是页面内业务交互性能节点，节点摘要必须直接展示 `interaction.mode`、`interaction.active_ms`、`interaction.settle_ms` 和 `frame.*`，但它仍归属于所在页面区段，不替代页面主链路性能。

### Memory 展示口径

Workbench 展示 memory 问题时必须按事件名和证据字段拆分，不得把 `warning` level 泛化成内存压力：

- `memory.pressure` / `native.memory.pressure`，或明确带有非 `none` 的 `memory.pressure_level`，才能显示为 `内存压力`。
- `memory.growth` 显示为 `内存增长`，必须展示 `memory.growth_mb`、`memory.growth_duration_ms`，有 `payload.evidence` 时展示 baseline/current。
- `memory.leak.suspect` 显示为 `疑似泄漏线索`，必须保留 `payload.assertion = suspect_only` 和 `payload.evidence.reason/threshold_mb` 等依据。Workbench 不得把它展示为确定泄漏、内存压力或内存溢出。
- `memory.sample` / `native.memory.sample` 只是采样，展示 RSS、heap、native used 和 sample source，不默认标记为问题。

### Native 展示口径

Native 是 Flutter 主链路之外的增强证据层。Workbench 必须保留 Flutter 层和 Native 层两套原始事件，不把它们合并成一条伪造事件：

- Session Header 显示 `Native on/off`，展开态展示 native bridge 版本、platform、native lifecycle 数量和 native memory 数量。
- Timeline 以 Flutter lifecycle、memory、hot start 作为主会话链路，同时按时间展示 `native.lifecycle`、`native.memory.sample`、`native.memory.pressure` 作为相邻底层证据。
- `native.lifecycle` 节点必须展示平台 callback，例如 `onActivityPaused`、`onActivityStopped`、`onActivityResumed`、`onTrimMemory`，并保留 `rawState`、`activity`、`trimLevel/trimLevelName`。
- `native.memory.sample` 展示 native used、heap used/capacity 和 sample source；`native.memory.pressure` 才能展示为 Native 内存压力。
- 启动性能页可用 `context.native.available`、`resource.sdk.nativeVersion` 和 `sdk.init.durationMs` 解释 native bridge 初始化成本，但不能把 native 接入本身判定为性能问题。

Session Detail 内部可以展示 Trace/Span/Event 层级，但这些层级不应迫使用户跳到多个独立页面。独立 Trace Detail 和 Event Detail 可以保留为辅助深链能力，主要用于复制链接、外部分享或直接打开 raw JSON。

## 跳转规则

Workbench 的交互应遵循“先进入 session，再选中节点”的规则。

推荐跳转模型：

```text
点击启动记录
  -> 打开 Session Detail
  -> 自动选中启动 trace

点击页面记录
  -> 打开 Session Detail
  -> 自动选中 page trace 或 page event

点击错误 / 卡顿 / 失败请求
  -> 打开 Session Detail
  -> 自动选中问题 event

点击最近问题 Session
  -> 打开 Session Detail

点击完整 JSON
  -> 在 Inspector 内打开 raw envelope
```

不推荐的主路径：

```text
Overview -> Event Detail -> Trace Detail -> Session Detail
```

推荐的主路径：

```text
Overview -> Session Detail -> Timeline selected node -> Inspector raw JSON
```

这样可以降低用户在 event、span、trace、session 之间反复跳转的理解成本。

## 指标语言

Workbench 第一版 UI 应优先使用“展示名 + 原始字段口径”的双层表达：用户第一眼看到的是人话，开发者追查口径时能在 tooltip、字段说明或开发态详情中看到原始字段。

| 原始字段 | UI 展示名 | 说明 |
|---|---|---|
| `count` | 次数 | 当前筛选范围内的样本数量 |
| `avgMs` | 平均耗时 | 所有样本耗时平均值；如果 service 暂未返回，可由 web 根据事件明细派生 |
| `p50Ms` | 中位耗时 | 一半记录低于这个耗时，比“典型耗时”更准确 |
| `p95Ms` | 慢端耗时 | 代表较慢体验侧的耗时，用于发现长尾问题 |
| `maxMs` | 最慢一次 | 当前范围内最慢记录，应能点击回查 session |
| `latestDurationMs` | 最近一次 | 最新一次记录，适合本地刚复现后确认；如果 service 暂未返回，可由最近事件派生 |
| `slowCount` | 慢次数 | 超过阈值的次数，需要在 tooltip 或字段说明中展示阈值 |
| `errorCount` | 稳定性错误 | 当前范围内稳定性错误事件数量；不包含 completed HTTP 失败，也不包含 `track/measure` 的业务失败 |
| `jankCount` | 卡顿次数 | 当前范围内卡顿事件数量 |
| `failedHttpCount` | 失败请求 | 当前范围内失败 HTTP 数量 |
| `businessFailureCount` | 业务失败 | 当前范围内 `business.result=failed` 的业务动作或交互观测数量，用于诊断业务路径，不作为崩溃/异常统计 |
| `sdk.drop.count` | SDK 丢弃事件 | 当前范围内 SDK 采样、限流、队列满、payload 过大或不可重试拒绝导致的丢弃事件数 |
| `sdk.retry.count` | SDK 重试 | 当前范围内 SDK delivery 计划重试的次数 |
| `sdk.flushFailureCount` | SDK 发送失败 | 当前范围内 `sdk.output.flush` 或 `sdk.lifecycle.flush` 未成功的次数 |
| `sdk.queue.length` | SDK 队列长度 | 最近一条 SDK self-monitoring envelope 携带的队列事件数 |
| `affectedSessionCount` | 问题 Session | 受影响 session 数 |
| `affectedUserCount` | 影响用户 | 受影响用户数；无 `userId` 时不展示或显示不可用 |

性能类卡片优先使用：次数、平均耗时、中位耗时、慢端耗时、最慢一次、慢次数。问题类卡片优先使用：问题次数、问题 Session、最近一次、高频页面或高频接口。

Workbench 的错误页和首页“错误/稳定性”只承接程序与稳定性错误，例如 `signalType=error` 或带 `error.*` 语义的非 HTTP envelope。业务 API 的 `track(action, result=failed)` 和 `measure(action, result=failed)` 表示业务结果失败，应在 session/page 链路中以“业务失败”告警展示，并可通过 `problemType=business_failure` 筛选，但不能推高 session 的异常状态或错误页统计。

首页 SDK 健康卡片只承接 `signalType=sdk` 的自监控 envelope，例如 `sdk.output.flush`、`sdk.queue.drop`、`sdk.retry.schedule`、`sdk.queue.state` 和 `sdk.config.applied`。它用于判断采集链路本身是否可靠，不应与业务 HTTP 失败、页面性能或稳定性错误混成同一个问题数。

如果确实需要展示分位数术语，应该放在高级详情、tooltip 或字段说明中，而不是首页卡片主标题。

**近期实现注意**：现有 `metric-card` 仍直接显示 `p95 / 最大`，与上表冲突。前端主标签应改为 `慢端耗时 / 最慢一次`，并在 tooltip 或字段说明中保留 `p95Ms / maxMs` 原始字段。service 已计算 `p50Ms / p95Ms / maxMs / slowCount`；`avgMs` 与 `latestDurationMs` 可由 service 直接补充，也可由 web 根据事件明细派生。

## 排查维度

排查维度决定用户能怎样筛选、分组和度量影响面。一个维度最多承担三种角色：**筛选**（缩小数据集）、**分组**（per-X 拆解，如按页面/版本）、**影响面**（distinct 计数，如“影响 N 个用户 / N 个 session”）。

维度只能来自 `EventEnvelope` 已携带的字段。若某维度不在 envelope 中，必须先经 `flutter_monitor_core` schema 与 SDK 采集补齐，**不能在 service 层凭空抠取**。索引与查询机制属于 `platform/docs/workbench_plan.md`，本节只定义产品上“暴露哪些维度、什么优先级、各自回答什么排查问题”。

优先级取舍：

- **现在做**（envelope 已带、service 已索引，近零成本）：
  - **时间范围**：后端 `from/to` 已就绪，但 UI 检索表单尚未暴露，应优先补——这是 QA「`userId` + 大概时间」的第一入口。
  - **userId**：已可筛选；补“按用户分组”和“影响用户数”。无 `userId` 时沿用既有优雅降级（`userIdAvailable` 提示，不阻塞其他维度查询）。
  - **版本 / 环境**：补分组，支撑性能回归的版本对比。
  - **页面 route**：分组即 Pages 健康表。
  - **signalType / name / status**：暴露为 Problems 页筛选。
- **紧接着**（在 envelope 内但需加索引，价值高）：`resource.device.deviceTier`（低端机才慢）、`context.network.type / isWeakNetwork`（弱网才超时）、`attributes.http.status_code / http.url.normalized`（哪个接口最差）。它们回答“为什么只有部分用户慢或崩”。
- **缓做**（企业/线上向或本地增量价值低）：`context.release.featureFlags / experiments`（灰度实验对比）、`context.module / scene`、`buildNumber / flavor / channel`、`priority / level`。本地调试阶段加入只会让筛选器臃肿。

维度发散后的长期解是 service 支持“按 `FieldPath` 通用分组/筛选 + 来自 core field registry 的白名单”，热点维度保留索引列，其余走白名单 JSON 路径；但 MVP 不先建通用引擎，先索引 3~4 个热点维度，等维度清单压不住时再上。

## MVP 范围

第一阶段重点强化可视化和主路径，不追求一次性完成所有报表。已约定的推进顺序（先低成本对齐，再上主排查体验）：

1. **指标语言修正 + 时间范围输入框**：主标签从 `p95 / 最大` 调整为 `慢端耗时 / 最慢一次`，tooltip 保留 `p95Ms / maxMs` 原始字段；补检索表单的时间范围（后端已就绪）。最便宜的对齐，先做。
2. **Overview 重排**：状态条 + 聚合指标卡领衔 + 最近/实时 Session + 最近问题 Session + 查看全部 Session 入口。
3. **Session Detail 竖向时间轴**：页面分段 + 节点行 + 问题醒目标记 + breadcrumb 折叠。价值最高的主排查体验。
4. **瀑布钻取**：在时间轴 trace 行上展开 span 瀑布，服务性能回归深挖。
5. **Startup 折线 + 后端冷/热分序列**：冷热启动趋势、慢阈值线、点位回 session（后端补 service 层聚合）。
6. **Sessions 独立检索页**：把检索从 Overview 拆出，强化 QA 的 userId/时间/版本/环境/页面/问题类型查询。
7. **Inspector**：维持“诊断摘要优先、raw JSON 保留”，按需补字段释义。

第二阶段：

- Pages 页面健康列表（route 分组）、页面详情、进入/停留趋势、页面相关问题与 session 联动。
- 紧接着的高价值维度：deviceTier、network/弱网、http 状态/接口（见“排查维度”）。

第三阶段：

- Problems 统一问题入口。
- Error、Jank、Failed HTTP、Slow HTTP、Memory Pressure 列表和筛选。
- 问题点击回到 Session Detail 并选中节点。

后续阶段：

- Session export/import 的可视化体验。
- RemoteServer datasource。
- 版本对比、优化前后对比。
- 更完整的 native、memory、lifecycle 问题分析。
- 维度发散到一定程度后的通用 `FieldPath` 分组/白名单查询。

## 与架构边界

本文只定义 Workbench Web 产品体验，不定义事件模型、SDK API、服务端协议或存储协议。

必须遵守：

- `EventEnvelope` 仍是唯一事实源。
- Workbench Web 可以生成 UI-only view model，但不能反向写入 SDK、service、server protocol 或 core schema。
- 所有展示摘要必须能回查完整 envelope。
- 本地 Workbench service 使用 SQLite 作为唯一存储和查询引擎。
- 未来 RemoteServer datasource 不改变 Workbench Web 的产品主路径。
- 后端补能力只在 service 的查询/索引/聚合层完成，不修改 SDK；SDK 仍只负责采集/组装/过滤/上报 envelope。
- 新增排查维度若不在 envelope 中，必须先经 core schema 与 SDK 采集，不在 service 层伪造，避免孤立指标或第二套模型。
- 本地聚合是轻量聚合（SQL 直算、上限约 5000 事件），不承担 Phase 6 的生产聚合职责。
