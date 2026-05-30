# Flutter Monitor Workbench Plan

Workbench 是 Flutter Monitor 的统一链路排查工作台。它面向 `EventEnvelope`、session、trace、span、breadcrumb、context、resource、attributes 和 payload，提供完整会话链路的可视化、查询、实时观察和性能分析能力。

Workbench 不是 SDK runtime，不是官方 Flutter DevTools extension，也不是生产服务端。它不定义事件模型，不定义上报协议，不改变 SDK 采集边界。

本文档负责 Workbench 架构、Service、Datasource、存储和协议边界。Workbench Web 的产品定位、页面展示原则、信息架构和交互设计见 `docs/workbench_product_plan.md`。当前本地 Workbench service 的具体 HTTP API、`3700` / `4700` 端口边界、raw envelope 与 query summary 响应口径见 `docs/workbench_service_api.md`。

## 三层概念

Flutter Monitor 的排查体验分为三层，三层共享统一 `EventEnvelope`，但职责和实时性不同：

1. 控制台 compact log
   - 面向开发者肉眼快速扫日志。
   - 只展示 `EventSummary` / compact key-value 摘要，不输出完整 JSON。
   - compact 行必须包含 `eventId`、`sessionId`、`traceId`，有 span 时包含 `spanId`，用于回查完整 envelope。
   - 控制台不是完整数据源，不承担 session timeline、聚合或长期查询。

2. Workbench
   - 面向本地调试、QA 复现和未来线上排查。
   - 使用完整 `EventEnvelope` 还原 session timeline、trace detail、event detail、breadcrumbs 和性能问题上下文。
   - 可以通过 SSE 近实时观察本地或 QA 复现链路，也可以通过查询接口查看已经落库的历史数据。
   - Workbench 是统一 UI，不因数据来自本地、导入文件或未来远端服务端而创建多套工作台。

3. 写入/查询服务
   - 本地阶段是轻量 workbench service，使用 SQLite 作为唯一存储和查询引擎。
   - 未来生产阶段是 Phase 6 Server，负责鉴权、可靠写入、采样限流、离线重试、聚合和长期治理。
   - 即使只服务本地 Workbench，也应区分 SDK 写入链路和 Workbench 查询链路，避免把调试实时性和生产上报策略混为一谈。

对应的 SDK 输出模式也只保留三类：

| 模式 | 用途 | 策略 |
|---|---|---|
| `consoleOnly` | 普通开发 | 只输出 compact log，不写入 Workbench |
| `localLive` | 本地联调 / QA 快速复现 | 小 batch、短 flush 间隔、关键事件立即 flush，优先保证链路完整和尽快可见 |
| `production` | 未来线上 | 请求大小限制、离线缓存、重试、优先级、采样限流 |

`localLive` 是显式调试模式。真实 App 可以开启它连接本地或测试 Workbench，但仍应走批量写入和关键时机 flush，不应退化成一条事件一个 HTTP 请求。

三种输出模式的链路流转：

```text
consoleOnly
  SDK collectors
    -> EventEnvelope
    -> EventSummary
    -> compact log
```

```text
localLive
  SDK collectors
    -> EventEnvelope
    -> HttpOutput small batch / short flush
    -> local workbench service
    -> SQLite store + SQL query index
    -> SSE
    -> Workbench Web live timeline
```

```text
production
  SDK collectors
    -> EventEnvelope
    -> production output policy
       batch / request size / offline / retry / priority / sampling
    -> Phase 6 ingest API
    -> production validation / storage / index / aggregation
    -> Phase 6 query API
    -> Workbench Web RemoteServer datasource
```

Workbench 的实时体验来自 service 到 web 的 SSE，不要求 SDK 逐条 HTTP 上报。SDK 写入链路始终应保持批量语义，只是在 `localLive` 中采用更短 flush 间隔和关键事件立即 flush。

## 定位

Workbench 负责完整链路排查 UI：

- 还原 session timeline。
- 查看 trace/span 层级与页面链路。
- 查看 event detail 和 raw JSON。
- 查看 error、jank、failed HTTP 携带的 breadcrumbs。
- 查看 route、user、device、network、release、lifecycle 等 context/resource 快照；module/scene 属于可选增强上下文，不作为基础接入前置条件。
- 通过 SSE 实时观察 SDK 上报事件。
- 按人类排查入口检索 session，例如 `userId + time range + appVersion/environment`、页面、错误、慢请求、卡顿和启动问题。

Workbench 与其他模块的边界：

- SDK：采集、组装、过滤和上报统一 `EventEnvelope`。
- `flutter_monitor_core`：唯一事件模型、schema、字段注册、隐私规则和摘要规则来源。
- Workbench service：接收、暂存、索引、查询和实时推送 envelope。
- Workbench web：展示、筛选、联动和排查，不定义新协议。
- DevTools 集成：负责 Flutter Timeline、SDK bridge 和 session export/import。
- Phase 6 Server：负责生产上报协议、可靠性、采样限流、聚合和长期质量治理。

## 架构

Workbench 使用前后端分离结构。根目录仍是 Dart pub workspace root，`workbench/` 是独立 JS/TS workspace root。当前本地服务已收敛到 `workbench/service`，不保留旧本地 server 入口。

```text
flutter_monitor/
  pubspec.yaml
  packages/
    flutter_monitor_core/
    flutter_monitor_sdk/
    flutter_monitor_native/

workbench/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json

  service/
    package.json
    src/
      api/
      ingest/
      store/
      index/
      query/
      stream/
      health/
      server.ts

  web/
    package.json
    src/
      app/
      datasource/
      pages/
      components/
      timeline/
      detail/
      performance/

  shared/
    package.json
    src/
      wire/
      api-client/
      datasource/
      summary/

scripts/
  workbench.sh
  run_example.sh
```

架构原则：

- Dart pub workspace 与 JS/TS workspace 并列管理，避免把 Node monorepo 混入 `packages/` 发布包边界。
- service 管数据接收、落库/暂存、索引、查询和实时推送。
- web 管诊断展示和交互。
- web 只消费 service 返回的 `EventEnvelope` 和派生摘要。
- 派生摘要不得成为第二套协议，必须能回查完整 envelope。
- Workbench 的数据结构必须保持与 SDK HTTP 上报和 session export 兼容。
- Workbench web 应按 datasource adapter 设计：本地 service、SSE live、session export、未来远端查询服务都应映射成同一组查询和展示模型。
- `workbench/shared` 只能承载 TypeScript 侧 wire shape mirror、API client、datasource interface 和 UI helper，不能成为新的模型事实源。

推荐 datasource：

- `LocalLive`：连接本地 service，使用批量写入接口和 SSE 做近实时调试。
- `LocalStore`：读取本地 SQLite 索引，用于 QA 复现和历史 session 查询。
- `SessionExport`：导入 DevTools/session export 或 NDJSON。
- `RemoteServer`：未来连接 Phase 6 查询 API。该 datasource 不改变 Workbench UI，也不要求 SDK 使用另一套 envelope。

Workbench Web 面向 datasource 的稳定接口：

```text
listSessions(filters)
getSession(sessionId)
getTrace(traceId)
getEvent(eventId)
searchEvents(query)
getPerformanceOverview(filters)
subscribeEvents(filters)
```

这些接口返回的是规范 envelope、session export 或从 envelope 派生的只读摘要。UI 可以构建内部 view model，但 view model 不反向写入 SDK、service API 或 server protocol。

## 技术选型

Workbench 采用 JS/TS 技术栈：

| 层级 | 选择 | 说明 |
|---|---|---|
| workspace | pnpm | `workbench/` 内独立 JS/TS workspace，不污染 Dart pub workspace |
| language | TypeScript | service、web、shared 共用类型约束 |
| service | Express + TypeScript | 优先保持本地 collector/query service 简单可维护 |
| web | React + Vite + TypeScript | 支撑高交互 timeline、detail、JSON viewer 和 datasource adapter |
| routing | TanStack Router 或 React Router | URL 中表达 session、trace、event 和筛选条件 |
| query/cache | TanStack Query | 管理 service query、live refresh 和状态缓存 |
| realtime | SSE | 本地和 QA 复现足够简单稳定，浏览器原生支持 `EventSource` |
| MVP storage | SQLite | 作为唯一本地存储和查询引擎，支撑重启后回查、QA 复现和本地轻量聚合 |
| import/export | session export / NDJSON | 作为导入导出格式，不作为主查询存储 |

暂不引入 Nest、MySQL、Postgres、账号系统、权限系统和长期部署能力。Workbench 的第一阶段复杂度主要在诊断 UI 和 datasource 适配，不在重服务端框架。

长期应由 `flutter_monitor_core` 导出 JSON schema、field registry 或 summary artifact 供 Workbench 消费。短期 `workbench/shared` 可以定义最小 `EventEnvelopeJson` mirror，但必须标记为 wire shape mirror，不得反向成为 core 的来源。

## 数据契约

Workbench 只消费统一事件模型：

- 单事件使用 `EventEnvelope`。
- 会话导入/导出使用 core 定义的 session export 格式。
- 查询和筛选字段优先使用 `FieldPaths` 注册字段。
- 未注册的诊断详情只能作为 payload 展示，不提升为 Workbench 私有索引协议。
- 所有 UI 摘要都必须保留 `eventId`、`sessionId`、`traceId`，有 span 时保留 `spanId`。
- `track.properties`、payload 详情和未注册 attributes 可用于本地调试型 JSON 搜索，但默认不作为正式聚合索引。
- 用户维度检索依赖 `context.user.userId`。如果 App 没有提供 userId，Workbench 不能凭空按用户查，只能按时间、版本、页面、错误、性能问题、session/trace/event ID 等通用维度查。

Workbench 可以生成 UI-only view model，但必须满足：

- view model 只在 web 内部使用。
- view model 不被 SDK、service API、DevTools 或服务端协议依赖。
- view model 中的每个摘要项都能回查原始 envelope。

## Service

Workbench service 是本地 collector、查询服务、索引层和实时事件推送层。它可以很轻，但必须从第一版开始区分写入链路和查询链路。

### 写入链路

SDK 写入 service 的接口应保持批量语义：

- SDK output 向 `POST /api/monitor/v1/events` 发送单条或批量完整 envelope。
- 本地调试可以显式启用近实时模式，但仍应使用小 batch、短 flush 间隔、关键时机 flush，而不是一条事件一个请求。
- 关键时机包括 error、fatal、关键卡顿、关键慢页面、进入后台/退出前 flush、用户手动触发调试 flush。
- Workbench Web 的实时刷新来自 service 到 web 的 SSE；这不等于 SDK 必须每条事件实时 HTTP 请求。
- 真实 App 默认不应以无策略实时上报模式运行。近实时上报必须由初始化配置显式开启。

### 查询链路

Workbench 查询不应要求使用者先知道 `sessionId` 或 `traceId`。`sessionId` / `traceId` / `eventId` 是链路事实主键，但人类排查入口还包括：

- `context.user.userId` + time range；
- `resource.app.environment` / `resource.app.appVersion` / `resource.app.buildNumber`；
- `context.route.name`；
- `signalType`、`name`、`status`、`level`、`priority`；
- `durationMs`、HTTP 状态码、慢页面、慢请求、卡顿、错误；
- device platform/model/tier；
- full JSON detail search，仅限本地调试或明确标记为非正式索引。

典型 QA 路径：

```text
QA 提供 userId 和大概时间
  -> Workbench 查询 session list
  -> 选择目标 session
  -> 打开 session timeline
  -> 进入 trace / event / breadcrumb detail
  -> 回查完整 EventEnvelope JSON
```

### API

service 保持与 SDK `HttpOutput` 兼容。当前本地 API 清单、请求参数、响应示例和字段来源统一维护在 `docs/workbench_service_api.md`。这里仅保留设计边界：

- 写入接口接收完整 SDK `EventEnvelope`，缺少 `eventId` 的事件不得被 service 补写成 SDK 字段。
- raw envelope 查询接口返回入库 envelope 本身，例如 recent、event detail、session detail、trace detail 和 search。
- session list、performance overview、groups 和 health 可以返回 Workbench query summary，但这些摘要不是 SDK schema 字段。
- service 提供 SSE 实时流：`GET /api/monitor/v1/stream`。

service 内部模块：

```text
ingest
  normalize batch / single event
  validate basic envelope shape
  preserve raw envelope

store
  SQLite store for local persistence and SQL query

index
  eventId
  sessionId
  traceId
  userId + time
  route / environment / appVersion / status / signalType / name

query
  session list
  session timeline
  trace detail
  event detail
  full JSON debug search

stream
  SSE clients
  heartbeat
  live event push

health
  event count
  session count
  last ingest time
  storage mode
```

### SSE

SSE 规则：

- 每次接收到新 envelope 后向已连接 web client 推送。
- 推送内容不得改写 envelope 本体。
- 可使用轻量 wrapper 表达事件类型，例如 `event: monitor.event`。
- 支持心跳事件，避免长连接静默断开。
- 断线重连依赖浏览器 `EventSource`。

### 存储

MVP 存储策略：

- SQLite 是 Workbench service 的唯一存储。
- SQLite 同时承担持久化和查询引擎职责，不再使用内存 ring buffer 作为主存储或查询来源。
- service 启动时必须打开 SQLite 数据库；未显式配置路径时使用 `workbench/.data/events.sqlite`。
- 按 event、session、trace、userId + time、route、environment、appVersion、status、signalType 和 name 建立 SQLite 索引。
- 支持最近数据、会话数据、trace 数据、用户时间范围和性能概览回查。
- 通过保留策略限制本地数据库规模，避免长期本地调试导致 SQLite 文件无限增长。

Workbench 本地存储使用 SQLite，而不是直接引入 MySQL：

- SQLite 足够支撑本机调试、QA 复现、按 userId/time/session/trace 查询和轻量聚合。
- 浏览器 IndexedDB 可用于 web 侧缓存、导入文件和 UI 状态，但不得作为 Workbench service 的主存储。
- MySQL 等服务端数据库等到需要多人、跨机器、长期保存或生产部署时再引入。
- NDJSON 可以作为导入导出或调试转储格式，不作为 Workbench 主查询存储。

service 不承担：

- 生产鉴权。
- 多租户。
- 长期持久化。
- 告警。
- remote config。
- 采样决策。
- 离线缓存。
- 生产聚合。

## Web

Workbench web 是完整链路排查 UI。

### 前端产品架构

Workbench Web 不应只是事件列表和 raw JSON viewer。前端需要形成稳定的信息架构、状态管理、组件边界和二级页面，负责把高密度 `EventEnvelope` 翻译成人类可排查的诊断语言。

页面分工：

- `/`：首页 Overview，回答“当前有没有数据、哪里最值得排查、最近有哪些问题 session”。
- `/sessions/:sessionId`：Session 详情，展示一次用户链路的 timeline、关键指标、trace/event 联动和上下文。
- `/traces/:traceId`：Trace 详情，聚焦一次启动、页面打开、接口链路或业务流程的 span/event 顺序。
- `/events/:eventId`：Event 详情，展示字段释义、诊断摘要、关联上下文和完整 raw envelope。
- 后续 `/performance`：性能分析页，聚合启动、页面、HTTP、卡顿、内存等指标。

前端目录原则：

```text
workbench/web/src/
  app/
    router/
    providers/
    query-client/

  routes/
    overview/
    session-detail/
    trace-detail/
    event-detail/

  features/
    overview/
    session/
    timeline/
    inspector/
    performance/

  shared/
    datasource/
    event-model/
    field-dictionary/
    formatting/

  components/
    ui/
    common/
```

状态管理分层：

- server state 使用 TanStack Query，负责 service query、缓存、刷新、loading/error 状态和 SSE 后的失效刷新。
- route state 使用 URL 表达 `sessionId`、`traceId`、`eventId` 和过滤条件，确保排查入口可分享和可回放。
- UI state 优先使用 React local state。只有当筛选、选择状态或 datasource 配置需要跨页面共享时，才引入轻量 client store。

组件设计原则：

- `components/ui` 承载基础 UI primitives 和 shadcn 风格组件，允许项目内定制，不把视觉和业务诊断逻辑耦合。
- `features/*` 承载领域组件，例如 session explorer、timeline row、event inspector、metric panel。
- 所有领域组件只消费 datasource 返回的规范 envelope 或只读 view model。
- view model 只服务 web 展示，不能写回 SDK、service API 或 server protocol。

### 首页信息架构

首页第一屏负责发现问题，不负责展示全部详情。必须突出以下信息：

- 数据源状态：LocalLive / SQLite / Import / Remote、live 状态、事件数、session 数、最近上报时间。
- Startup Overview：冷启动、热启动的 count、p50、p95、max、最近慢启动。
- Page Performance：各页面打开、首帧、可交互或停留耗时的 Top N 和慢页面数量。
- HTTP Overview：请求数、失败率、p95、慢请求和失败请求入口。
- Stability Overview：错误、卡顿、内存压力、native 异常的数量和受影响 session。
- Recent Problem Sessions：最近有 error、jank、failed HTTP、slow startup、slow page 的 session。

首页卡片或表格中的每个摘要都必须能跳转到 session、trace 或 event 原始数据。

### 字段释义与 Inspector

Raw JSON 信息最全，但信息密度过高。Event Inspector 必须同时提供“解释后的诊断视图”和“原始字段视图”。

解释后的诊断视图至少回答：

- 这是什么事件：错误、启动、页面、网络、行为、卡顿、内存、生命周期、native 或 business。
- 发生在哪里：session、trace、span、route、module、scene。
- 影响谁：user、device、app version、environment、release、network。
- 状态如何：level、status、duration、priority、error type、HTTP status、frame duration、memory pressure 等。
- 为什么值得关注：slow startup、slow page、failed HTTP、jank burst、error、memory pressure 等问题标签。
- 前后发生了什么：breadcrumbs、同 trace 事件、前后 timeline 事件。

原始字段视图必须保留：

- envelope 公共字段。
- `resource`
- `context`
- `attributes`
- `payload`
- full raw envelope。

Workbench Web 可以维护一份短期 field dictionary，用于字段释义和空值说明：

| 字段 | 展示名 | 含义 | 来源 | 隐私 | 检索 |
|---|---|---|---|---|---|
| `context.route.name` | 当前页面 | 事件发生时所在 route | SDK context | internal | 是 |
| `context.user.userId` | 用户 ID | 接入方提供的用户标识 | SDK context | user | 是 |
| `resource.app.appVersion` | App 版本 | 事件发生时的应用版本 | SDK resource | internal | 是 |
| `resource.app.environment` | 环境 | dev/test/staging/production | SDK resource | internal | 是 |
| `attributes.http.statusCode` | HTTP 状态码 | 网络请求响应码 | network collector | internal | 是 |
| `payload.breadcrumbs` | Breadcrumbs | 问题前后的上下文足迹 | SDK payload | mixed | 否 |

长期应由 `flutter_monitor_core` 导出 schema、field registry 或 summary artifact 供 Workbench 消费。短期 web 内的 field dictionary 必须标记为 UI 释义层，不得反向成为事件模型来源。

### 技术基座

Workbench Web 采用：

- React + Vite + TypeScript。
- Tailwind CSS + 项目内 shadcn 风格组件。
- Radix Primitives 用于 Tabs、Dialog、Select、Tooltip 等可访问交互。
- TanStack Query 管理 service query 和缓存。
- TanStack Router 或 React Router 管理二级页面与 URL 状态。
- lucide-react 继续作为图标库。
- 后续按需引入 TanStack Table、TanStack Virtual 和 Recharts。

选型理由：

- Workbench 是诊断工具，需要高密度、强定制 UI，不适合被传统后台组件库的视觉和交互模式锁死。
- shadcn 风格组件的代码归项目所有，便于围绕 timeline、inspector 和 field explanation 深度定制。
- TanStack Query 能把服务端状态、刷新、错误和 SSE 后的缓存失效从组件中剥离。
- 二级页面必须通过 URL 表达当前 session/trace/event，便于 QA 和开发共享排查入口。

### MVP 视图

- Session list：最近 session、事件数、起止时间、关键状态、错误/卡顿/HTTP 失败计数。
- Session search：按 userId、时间范围、版本、环境、route、错误和性能问题查找 session。
- Session timeline：按时间展示 startup、page、http、jank、error、lifecycle、memory、native、business track。
- Event detail：完整 envelope JSON、attributes、payload、context、resource。
- Trace detail：trace 下的 span、breadcrumb、相关 event。
- Breadcrumb viewer：关键事件携带的 breadcrumb 摘要和原始内容。
- Filter/search：`eventId`、`sessionId`、`traceId`、`spanId`、`signalType`、`name`、`status`、`route`。
- Live mode：通过 SSE 实时追加新事件。
- SDK/service health：collector 状态、最近上报时间、缓存事件数。
- Performance overview：冷启动/热启动、页面加载、HTTP、卡顿、错误的本地轻量聚合。

### UI 原则

- 以排查效率为主，信息密度高但结构清晰。
- 所有摘要都能跳转到 raw envelope。
- 时间线优先展示用户路径和问题上下文。
- 不为展示效果修改 envelope 语义。
- 不把 Workbench 私有字段写回 SDK 或 service 协议。

web 不承担：

- SDK 配置编辑。
- 生产报表。
- 长期趋势分析。
- 告警配置。
- 多用户协作。
- 权限系统。

## 脚本编排

根目录提供统一脚本入口，隐藏 pnpm 与多进程细节：

```text
bash scripts/workbench.sh install
bash scripts/workbench.sh service
bash scripts/workbench.sh web
bash scripts/workbench.sh dev
bash scripts/workbench.sh build
bash scripts/workbench.sh status
bash scripts/workbench.sh stop
```

端口约定：

```text
workbench service: http://localhost:3700
workbench web:     http://localhost:4700
API:               /api/monitor/v1/*
SSE:               /api/monitor/v1/stream
```

开发态：

```text
scripts/workbench.sh dev
  -> pnpm --dir workbench install when needed
  -> start workbench/service
  -> start workbench/web
```

发布或演示态可以由 service 托管 web build：

```text
workbench/web/dist
  -> workbench/service static assets
```

`scripts/run_example.sh` 默认启动 Workbench：

```text
scripts/run_example.sh
  -> check or start workbench service
  -> check or start workbench web
  -> print Workbench web URL
  -> inject FM_SERVER_URL=http://<host>:3700/api/monitor/v1/events
  -> inject test API base URL when needed
  -> run Flutter example
  -> stop workbench when Flutter example exits
```

`--server-url` 用于连接外部上报地址；`--no-workbench` 用于只跑 Flutter example。

## 与 DevTools 的边界

Workbench 和 DevTools 集成是互补关系。

Workbench 负责：

- 完整 session timeline。
- trace detail。
- event detail。
- breadcrumb detail。
- raw JSON viewer。
- QA 复现链路排查。

DevTools 集成负责：

- 将 SDK trace/span 写入 Flutter Timeline。
- 在官方 DevTools Performance 中呈现关键 mark/instant/flow。
- 提供 SDK bridge。
- 提供 session export/import。
- 对齐 Flutter runtime 性能分析入口。

DevTools 集成不重复建设完整 Workbench UI。Workbench 可以消费 DevTools export/bridge 数据，但两者必须共享统一 envelope 和 session export 格式。

## 与 Server 的边界

Workbench 面向本地调试、QA 复现、性能分析和未来线上排查。Workbench UI 可以复用，底层 datasource 可以不同。

Phase 6 Server 面向生产协议与长期质量治理：

- 上报鉴权。
- 重试和限流。
- 请求大小控制。
- 离线缓存。
- 动态采样。
- 事件优先级。
- 聚合查询。
- 趋势分析。
- 告警。

Workbench service 不代表最终生产服务端，不承担生产可靠性和长期聚合职责。

边界结论：

- local workbench service 是本地数据源和调试服务，不是 Phase 6 Server。
- Workbench web 可以同时接 local datasource 和 future remote datasource，但不因此定义第二套 event model。
- Phase 6 Server 的写入 API 负责可靠接收，查询 API 负责给 Workbench 提供 session、trace、event 和聚合数据。
- 本地 Workbench 可以近实时，生产上报必须遵守 batch、优先级、大小限制、重试、离线缓存和采样限流。

未来线上编排：

```text
SDK production output
  -> Phase 6 ingest API
  -> schema validation
  -> privacy / sampling / rate limit
  -> queue / storage / index
  -> query API / aggregation API
  -> Workbench RemoteServer datasource
```

Workbench Web 不因线上化改变产品形态。线上阶段只是把 datasource 从 `LocalLive` / `LocalStore` 切到 `RemoteServer`，查询结果仍必须能回查完整 `EventEnvelope`。

Phase 6 Server 承担：

- 鉴权。
- 多环境。
- 长期存储。
- 重试与错误码。
- 请求大小限制。
- 采样限流。
- 离线缓存协同。
- 聚合。
- 趋势。
- 告警。
- 多用户和多租户。

这些能力不进入 local workbench service 的 MVP。

## MVP 范围

第一版 Workbench 只交付本地诊断闭环：

- 迁移 collector/query service 到 `workbench/service`。
- 建立 `workbench/` JS/TS workspace。
- 新增 SSE stream。
- 新建 React/Vite web。
- 支持 session list。
- 支持 session timeline。
- 支持 event detail 和 raw JSON。
- 支持 trace detail。
- 支持 breadcrumb viewer。
- 支持基础过滤和搜索。
- 支持按 `context.user.userId` 和时间范围查询 session；没有 userId 时仍可按时间、版本、页面、错误和性能问题查询。
- 保持 `scripts/run_example.sh` 可启动或连接 workbench service/web，并在 Flutter example 退出时停止本轮启动的 Workbench。

## 实施顺序

### Phase W0：文档收口

- 将 Workbench 的定位、目录、技术栈、datasource、脚本和验收标准集中在本文档。
- `docs/implementation_plan.md` 只保留 SDK 总计划里的 Workbench 插入点和本文档引用。

### Phase W1：迁移本地调试服务

- 新建 `workbench/` JS/TS workspace。
- 将本地 collector/query service 收敛为 `workbench/service`。
- 保持现有 `/api/monitor/v1/*` API 兼容。
- 删除旧本地 server 入口，避免产生两套本地服务认知。

### Phase W2：Service 结构化

- 拆分 ingest、store、index、query、stream、health。
- 补充 `GET /api/monitor/v1/stream`。
- 补充 `GET /api/monitor/v1/health`。
- 确保 SSE 不改写 envelope。

### Phase W3：查询能力

- 增加 session list 查询。
- 增加 `userId`、time range、app version、environment、route、status、name、signalType 查询。
- 没有 `context.user.userId` 时返回明确的不可用提示，不阻塞通用维度查询。

### Phase W4：Web 骨架

- 新建 React/Vite Workbench Web。
- 建立 datasource adapter。
- 实现 recent、live、session list 的最小 UI。
- 支持 event raw JSON 打开。

### Phase W5：排查视图

- 实现 session timeline。
- 实现 trace detail。
- 实现 event detail。
- 实现 breadcrumb viewer。
- 支持 error、jank、failed HTTP 的上下文联动。

### Phase W6：本地持久化

- 使用 SQLite 作为本地唯一存储和查询引擎。
- 支持重启后回查最近 session。
- 支持 session export/import 或 NDJSON import 的 UI 入口。

### Phase W7：性能概览

- 增加启动、页面、HTTP、错误、卡顿的本地轻量聚合。
- 聚合结果必须能回查原始 session、trace 或 event。

### Phase W8：Remote datasource 预留

- 固化 datasource interface。
- 为 Phase 6 Server query API 预留 `RemoteServer`。
- Workbench Web 不因 remote datasource 改变事件模型。

## 验收标准

Workbench MVP 完成时应满足：

- example 使用默认 `scripts/run_example.sh` 后，SDK 事件能进入 `workbench/service`。
- web 能实时看到新事件，无需手动刷新接口。
- web 能打开一个 session 并查看完整 timeline。
- web 能通过 `userId + time range` 查到 session list；App 未提供 userId 时，应明确提示该条件不可用。
- 任意 timeline event 能查看完整 envelope JSON。
- failed HTTP、error、jank 能展示 breadcrumb 数量、摘要和原始 breadcrumb 内容。
- 页面 trace 能展示 `page.visit`、`route.push`、`page.load`、`page.first_frame`、`page.stay` 的顺序和 duration。
- startup trace 能展示 `app.cold_start`、`sdk.init`、`app.first_frame`。
- 业务 `track` 事件能展示 `business.action`、`business.result`、`ui.target` 和 `payload.properties`。
- service API 仍兼容 SDK `HttpOutput`。
- service SSE 推送不改变 envelope 本体。
- SDK 到 service 的近实时写入必须使用显式配置和批量语义。
- Workbench 不引入第二套事件模型。

## 非目标

以下内容不属于 Workbench MVP：

- 生产服务端。
- 长期持久化。
- 账号体系。
- 权限和多租户。
- 告警。
- 大规模聚合。
- remote config。
- 离线缓存。
- DevTools extension。
- native bridge。
- SDK runtime 采集能力。
