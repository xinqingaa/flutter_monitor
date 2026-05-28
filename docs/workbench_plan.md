# Flutter Monitor Workbench Plan

Workbench 是 Flutter Monitor 的统一链路排查工作台。它面向 `EventEnvelope`、session、trace、span、breadcrumb、context、resource、attributes 和 payload，提供完整会话链路的可视化、查询、实时观察和性能分析能力。

Workbench 不是 SDK runtime，不是官方 Flutter DevTools extension，也不是生产服务端。它不定义事件模型，不定义上报协议，不改变 SDK 采集边界。

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
   - 本地阶段可以是轻量 `node_server` / workbench service，使用内存、文件或 SQLite。
   - 未来生产阶段是 Phase 6 Server，负责鉴权、可靠写入、采样限流、离线重试、聚合和长期治理。
   - 即使只服务本地 Workbench，也应区分 SDK 写入链路和 Workbench 查询链路，避免把调试实时性和生产上报策略混为一谈。

对应的 SDK 输出模式也只保留三类：

| 模式 | 用途 | 策略 |
|---|---|---|
| `consoleOnly` | 普通开发 | 只输出 compact log，不写入 Workbench |
| `localLive` | 本地联调 / QA 快速复现 | 小 batch、短 flush 间隔、关键事件立即 flush，优先保证链路完整和尽快可见 |
| `production` | 未来线上 | 请求大小限制、离线缓存、重试、优先级、采样限流 |

`localLive` 是显式调试模式。真实 App 可以开启它连接本地或测试 Workbench，但仍应走批量写入和关键时机 flush，不应退化成一条事件一个 HTTP 请求。

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

Workbench 使用前后端分离结构。第一阶段可以继续从 `node_server` 演进，未来再迁移到 `workbench/service` 与 `workbench/web`：

```text
workbench/
  service/
    # local collector + query API + index + SSE
  web/
    # React/Vite diagnostic UI
```

架构原则：

- service 管数据接收、落库/暂存、索引、查询和实时推送。
- web 管诊断展示和交互。
- web 只消费 service 返回的 `EventEnvelope` 和派生摘要。
- 派生摘要不得成为第二套协议，必须能回查完整 envelope。
- Workbench 的数据结构必须保持与 SDK HTTP 上报和 session export 兼容。
- Workbench web 应按 datasource adapter 设计：本地 service、SSE live、session export、未来远端查询服务都应映射成同一组查询和展示模型。

推荐 datasource：

- `LocalLive`：连接本地 service，使用批量写入接口和 SSE 做近实时调试。
- `LocalStore`：读取本地 SQLite/文件/内存索引，用于 QA 复现和历史 session 查询。
- `SessionExport`：导入 DevTools/session export 或 NDJSON。
- `RemoteServer`：未来连接 Phase 6 查询 API。该 datasource 不改变 Workbench UI，也不要求 SDK 使用另一套 envelope。

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

service 保持与 SDK `HttpOutput` 兼容：

- `POST /api/monitor/v1/events`
- `GET /api/monitor/v1/recent?limit=50`
- `GET /api/monitor/v1/events/:eventId`
- `GET /api/monitor/v1/sessions/:sessionId`
- `GET /api/monitor/v1/traces/:traceId`
- `GET /api/monitor/v1/groups?by=...`

建议补充查询 API：

- `GET /api/monitor/v1/sessions?userId=&from=&to=&appVersion=&environment=&route=&status=&limit=`
- `GET /api/monitor/v1/search?query=&from=&to=&limit=`
- `GET /api/monitor/v1/performance/pages?from=&to=&appVersion=&environment=`
- `GET /api/monitor/v1/performance/http?from=&to=&appVersion=&environment=`

service 提供实时流：

- `GET /api/monitor/v1/stream`

### SSE

SSE 规则：

- 每次接收到新 envelope 后向已连接 web client 推送。
- 推送内容不得改写 envelope 本体。
- 可使用轻量 wrapper 表达事件类型，例如 `event: monitor.event`。
- 支持心跳事件，避免长连接静默断开。
- 断线重连依赖浏览器 `EventSource`。

### 存储

MVP 存储策略：

- 使用内存 ring buffer。
- 按 event、session、trace 建立查询索引。
- 支持最近数据、会话数据和 trace 数据回查。
- 可重启丢失数据。

如果要从“临时 inspector”推进到可用 Workbench MVP，优先选择 SQLite 或文件 NDJSON，而不是直接引入 MySQL：

- SQLite 足够支撑本机调试、QA 复现、按 userId/time/session/trace 查询和轻量聚合。
- 浏览器 IndexedDB 可用于 web 侧缓存、导入文件和 UI 状态，但不宜作为 SDK collector 主存储。
- MySQL 等服务端数据库等到需要多人、跨机器、长期保存或生产部署时再引入。

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

## 当前 node_server 定位

`node_server` 当前是本地调试 service 与完整 JSON 回查服务雏形。它接收 SDK pipeline 输出的完整 `EventEnvelope`，并提供按 `eventId`、`sessionId`、`traceId` 查询的最小能力。

`node_server` 不是 Phase 6 生产服务端，也不代表最终服务端架构。它服务本地调试、QA 复现和 Workbench MVP，用于快速验证完整链路能否被采集、查询和还原。

当前能力：

- 启动脚本：
  - `bash scripts/node_server.sh install`
  - `bash scripts/node_server.sh start`
  - `bash scripts/node_server.sh dev`
- `POST /api/monitor/v1/events`：接收单条或批量完整 envelope。
- `GET /api/monitor/v1/events/:eventId`：查询单个完整事件。
- `GET /api/monitor/v1/sessions/:sessionId`：查询 session timeline。
- `GET /api/monitor/v1/traces/:traceId`：查询 trace 组。
- `GET /api/monitor/v1/recent?limit=50`：查询最近事件。
- `GET /api/monitor/v1/groups?by=session|trace|route|name`：查看简单分组。
- `/`：本地 HTML inspector，用于快速查看最近事件和完整 JSON。

后续 `node_server` 可以演进为 local workbench service，但必须遵守：

- 只消费统一 `EventEnvelope`。
- 保持 `/api/monitor/v1/*` 兼容。
- 增加 batch 写入状态、service health 和 SSE stream。
- 增加 userId/time/session 查询索引。
- 将内存 store 替换为文件 NDJSON 或 SQLite。
- summary endpoint 的规则必须来自 core，不靠 UI 或 Node 侧猜字段。
- remote config、采样、限流和鉴权只能作为本地模拟能力，不能代表生产实现。

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

- `node_server` / local workbench service 是本地数据源和调试服务，不是 Phase 6 Server。
- Workbench web 可以同时接 local datasource 和 future remote datasource，但不因此定义第二套 event model。
- Phase 6 Server 的写入 API 负责可靠接收，查询 API 负责给 Workbench 提供 session、trace、event 和聚合数据。
- 本地 Workbench 可以近实时，生产上报必须遵守 batch、优先级、大小限制、重试、离线缓存和采样限流。

## MVP 范围

第一版 Workbench 只交付本地诊断闭环：

- 迁移 collector/query service 到 `workbench/service`。
- 新增 SSE stream。
- 新建 React/Vite web。
- 支持 session list。
- 支持 session timeline。
- 支持 event detail 和 raw JSON。
- 支持 trace detail。
- 支持 breadcrumb viewer。
- 支持基础过滤和搜索。
- 支持按 `context.user.userId` 和时间范围查询 session；没有 userId 时仍可按时间、版本、页面、错误和性能问题查询。
- 保持 `scripts/run_example.sh --local-server` 可启动或连接 workbench service。

## 验收标准

Workbench MVP 完成时应满足：

- example 使用 `--local-server` 后，SDK 事件能进入 `workbench/service`。
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
