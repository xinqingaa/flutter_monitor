# Flutter Monitor Workbench Plan

Workbench 是 Flutter Monitor 的本地与 QA 链路排查工作台。它面向 `EventEnvelope`、session、trace、span、breadcrumb、context、resource、attributes 和 payload，提供完整会话链路的可视化、查询和实时观察能力。

Workbench 不是 SDK runtime，不是官方 Flutter DevTools extension，也不是生产服务端。它不定义事件模型，不定义上报协议，不改变 SDK 采集边界。

## 定位

Workbench 负责完整链路排查 UI：

- 还原 session timeline。
- 查看 trace/span 层级与页面链路。
- 查看 event detail 和 raw JSON。
- 查看 error、jank、failed HTTP 携带的 breadcrumbs。
- 查看 route、module、user、device、network、release、lifecycle 等 context/resource 快照。
- 通过 SSE 实时观察 SDK 上报事件。

Workbench 与其他模块的边界：

- SDK：采集、组装、过滤和上报统一 `EventEnvelope`。
- `flutter_monitor_core`：唯一事件模型、schema、字段注册、隐私规则和摘要规则来源。
- Workbench service：接收、暂存、查询和实时推送 envelope。
- Workbench web：展示、筛选、联动和排查，不定义新协议。
- DevTools 集成：负责 Flutter Timeline、SDK bridge 和 session export/import。
- Phase 6 Server：负责生产上报协议、可靠性、采样限流、聚合和长期质量治理。

## 架构

Workbench 使用前后端分离结构：

```text
workbench/
  service/
    # Node/Express collector + query API + SSE
  web/
    # React/Vite diagnostic UI
```

架构原则：

- service 管数据接收、查询和实时推送。
- web 管诊断展示和交互。
- web 只消费 service 返回的 `EventEnvelope` 和派生摘要。
- 派生摘要不得成为第二套协议，必须能回查完整 envelope。
- Workbench 的数据结构必须保持与 SDK HTTP 上报和 session export 兼容。

## 数据契约

Workbench 只消费统一事件模型：

- 单事件使用 `EventEnvelope`。
- 会话导入/导出使用 core 定义的 session export 格式。
- 查询和筛选字段优先使用 `FieldPaths` 注册字段。
- 未注册的诊断详情只能作为 payload 展示，不提升为 Workbench 私有索引协议。
- 所有 UI 摘要都必须保留 `eventId`、`sessionId`、`traceId`，有 span 时保留 `spanId`。

Workbench 可以生成 UI-only view model，但必须满足：

- view model 只在 web 内部使用。
- view model 不被 SDK、service API、DevTools 或服务端协议依赖。
- view model 中的每个摘要项都能回查原始 envelope。

## Service

Workbench service 是本地 collector、查询服务和实时事件推送层。

### API

service 保持与 SDK `HttpOutput` 兼容：

- `POST /api/monitor/v1/events`
- `GET /api/monitor/v1/recent?limit=50`
- `GET /api/monitor/v1/events/:eventId`
- `GET /api/monitor/v1/sessions/:sessionId`
- `GET /api/monitor/v1/traces/:traceId`
- `GET /api/monitor/v1/groups?by=...`

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
- Session timeline：按时间展示 startup、page、http、jank、error、lifecycle、memory、native、business track。
- Event detail：完整 envelope JSON、attributes、payload、context、resource。
- Trace detail：trace 下的 span、breadcrumb、相关 event。
- Breadcrumb viewer：关键事件携带的 breadcrumb 摘要和原始内容。
- Filter/search：`eventId`、`sessionId`、`traceId`、`spanId`、`signalType`、`name`、`status`、`route`。
- Live mode：通过 SSE 实时追加新事件。
- SDK/service health：collector 状态、最近上报时间、缓存事件数。

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

Workbench 面向本地调试和 QA 复现。

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
- 保持 `scripts/run_example.sh --local-server` 可启动或连接 workbench service。

## 验收标准

Workbench MVP 完成时应满足：

- example 使用 `--local-server` 后，SDK 事件能进入 `workbench/service`。
- web 能实时看到新事件，无需手动刷新接口。
- web 能打开一个 session 并查看完整 timeline。
- 任意 timeline event 能查看完整 envelope JSON。
- failed HTTP、error、jank 能展示 breadcrumb 数量、摘要和原始 breadcrumb 内容。
- 页面 trace 能展示 `page.visit`、`route.push`、`page.load`、`page.first_frame`、`page.stay` 的顺序和 duration。
- startup trace 能展示 `app.cold_start`、`sdk.init`、`app.first_frame`。
- 业务 `track` 事件能展示 `business.action`、`business.result`、`ui.target` 和 `payload.properties`。
- service API 仍兼容 SDK `HttpOutput`。
- service SSE 推送不改变 envelope 本体。
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
