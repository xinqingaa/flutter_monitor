# Platform Docs

本目录维护 Platform JS/TS workspace 文档。Workbench 是 UI 产品名。项目级事件模型、字段注册、采集口径、DevTools 和生产服务端协议仍在根目录 `docs/` 中维护。

## Documents

- [Platform 架构与计划](workbench_plan.md)：Monitor Service、Datasource、存储、脚本编排、MVP 和验收标准。
- [Workbench 功能清单](FEATURES.md)：当前期望的一级模块与能力边界（大屏 / HTTP / 埋点 / 异常）；与 `product_plan.md` 冲突时以本清单为准。
- [Workbench DESIGN](DESIGN.md)：active 的视觉、交互与页面设计事实源；HTTP 样板已确认并用于全站实现。
- [Workbench 前端重构计划](FRONTEND_REFACTOR_PLAN.md)：4 个验收阶段、8 个实施步骤，以及每阶段的范围、产物、验证和停止条件。
- [Workbench Phase 5 体验升级计划](PHASE5_UX_PLAN.md)：shadcn 官方能力、筛选体验、Tremor 大屏与逐轮验收约束。
- [Workbench Keep / Kill / Steal](KEEP_KILL_STEAL.md)：推倒重来时的取舍；数据层可留，页面默认作废，JsonViewer 仅克制复用。
- [Workbench 产品计划](product_plan.md)：历史产品定位与交互口径，可作参考；重构期功能边界见 `FEATURES.md`。
- [Workbench Service API（已废弃）](service_api.md)：历史 endpoint 说明；当前请以 `http://localhost:3700/docs`（Swagger）和 [`services/monitor-service/docs/boundaries.md`](../services/monitor-service/docs/boundaries.md) 为准。

当前 Workbench 正式一级入口为大屏、HTTP、埋点、异常；Session 是从各入口进入的二级链路排查层。旧 Overview/Sessions/Startup/Pages/Network/Jank 路径只做兼容重定向，不再构成并行信息架构。

## 常用查询路径

Monitor Service（默认 `http://localhost:3700`，完整 API 见 `/docs` Swagger）的两条高频排查路径。所有查询端点（`recent`、`sessions`、`search`、`performance/*`、`dimensions`）支持同一组通用过滤参数，可单值或逗号分隔多值：`sessionId`、`userId`、`from`/`to`、`appKey`、`appVersion`、`buildNumber`、`environment`、`channel`、`devicePlatform`、`deviceModel`、`deviceTier`、`osVersion`、`route`、`status`、`name`、`signalType`、`problemType`、`limit`、`offset`。

### 针对接口（HTTP）的聚合查询

数据基础：`http.client` 是 hard 证据全量保留，可查维度在 `attributes`（`http.method`、`http.url.normalized`、`http.status_code`、`http.success`、`http.error_type`、`http.request_id`、`response.size_bytes`、`durationMs`），详情在 `payload.http.query` / `payload.http.detail`。

```sh
# HTTP 整体摘要：总量、错误数、耗时 avg/max + 事件明细（可叠加任意通用过滤参数）
curl 'http://localhost:3700/api/monitor/v1/performance/http?appVersion=1.0&from=2026-06-12T00:00:00'

# 原始 http.client 事件流（用于自定义聚合或回查 raw envelope）
curl 'http://localhost:3700/api/monitor/v1/recent?name=http.client&limit=200'

# 按接口路径分组（客户端聚合 http.url.normalized 示例）
curl -s 'http://localhost:3700/api/monitor/v1/recent?name=http.client&limit=500' \
  | jq '[.events[] | {url: .attributes."http.url.normalized", ms: .durationMs}]
        | group_by(.url)
        | map({url: .[0].url, count: length, avgMs: (map(.ms) | add / length)})'

# 全文搜索（命中 payload，包括 query/body）
curl 'http://localhost:3700/api/monitor/v1/search?query=/api/orders'
```

Workbench Web（默认 `http://localhost:4700`）的"性能 → 网络"页内置按 `http.url.normalized` 的接口分布、成功率、失败类型分布和请求页面热区，每条聚合结果可点回原始 envelope。长期分位数（p50/p95）、错误率告警等企业级聚合属于 Phase 6 范围。

### 按 userId / sessionId 还原用户操作链路

前提：App 侧登录后调用了 `FlutterMonitorSDK.setContext(userId: ...)`（见 `docs/signal_collection.md` 配置章节）。排查路径是"userId → session 列表 → session 内时间线 → trace 详情"：

```sh
# 第 1 步：按 userId 找到该用户的会话；摘要自带 errorCount、
# failedHttpCount、businessFailureCount、status、首末时间和设备/版本维度，
# 可直接挑出问题会话。jank/memory/native 只有 SDK 显式开启并采到数据后
# 才作为诊断计数出现。
curl 'http://localhost:3700/api/monitor/v1/sessions?userId=333'

# 第 2 步：取该会话的完整事件链路（按时间排序的全部 envelope）。
# route.push/page.visit（去了哪些页面）→ track（点了什么）→ http.client
# （发了什么请求）→ error.*（出了什么问题）；显式开启诊断信号后，
# 也可看到 ui.jank.sequence / memory.*，
# 全部共享同一 sessionId，事件间靠 traceId 关联
curl 'http://localhost:3700/api/monitor/v1/sessions/ses_1781253093076468_0'

# 第 3 步：放大某次流程（一次冷启动、一次页面打开、一条接口调用链）
curl 'http://localhost:3700/api/monitor/v1/traces/trace_1781253102477508_8'

# 单事件 raw envelope 回查
curl 'http://localhost:3700/api/monitor/v1/events/evt_1781253109115985_34'
```

Workbench Web 对应入口是"会话"列表（支持 userId 筛选）→ 会话详情页的 session timeline，点任意节点可看 raw JSON。QA 复现交接场景：QA 在 localLive 模式复现问题后，把 `sessionId`（或 userId + 时间段）给开发，开发用上述三步还原现场，不依赖口述操作路径。

## Boundary

Platform 只消费统一 `EventEnvelope`，不定义第二套事件模型。字段、状态、信号名、链路关系和隐私等级以根目录文档和 `packages/flutter_monitor_core` 为准。

当 Workbench 展示发现数据不对时，先判断问题归属：

- 纯布局、交互、查询和可视化问题：修改 `platform/web`。
- 字段缺失、语义不对、状态流转不对：先审查根目录 `docs/`，再看 `flutter_monitor_core`、`flutter_monitor_sdk` 或 `flutter_monitor_native`。
- 服务端查询摘要口径问题：先确认摘要能否从原始 envelope 推导，不能把摘要字段写回 envelope。

端口规则：`4700` 是 Workbench Web 开发入口，`3700` 是 Monitor Service API。调试时如果这两个端口已有本项目 platform 进程活跃，默认复用。
