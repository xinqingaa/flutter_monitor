# Platform 架构

`platform/` 是独立的 JS/TS workspace，承载 Monitor Service、Workbench Web 与 TypeScript 共享层。它只消费统一 `EventEnvelope`，不定义第二套事件模型、导出格式或上报协议。字段与采集口径以根目录 `docs/` 和 `packages/flutter_monitor_core` 为准。

---

## 布局

```text
platform/
  docs/                         本文档集
  services/monitor-service/     NestJS Monitor Service（3700）
  web/                          Workbench UI（Vite，4700）
  shared/                       TypeScript wire / 类型镜像
  .data/                        本地 SQLite（gitignore）
```

| 地址 | 用途 |
|---|---|
| `http://localhost:4700/` | Workbench Web |
| `http://localhost:3700/api/monitor/v1/*` | Monitor Service API |
| `http://localhost:3700/docs` | Swagger |
| `http://localhost:3700/docs-json` | OpenAPI JSON |

启动：`./scripts/platform.sh`（或 `pnpm` 在 `platform/` 下分别起 service / web）。调试时若本项目进程已占用 `3700` / `4700`，默认复用。

---

## 三层职责

```text
SDK collectors
  -> EventEnvelope
  -> localLive / production output（批量写入）
  -> Monitor Service ingest
  -> SQLite 存储 + 索引
  -> query API / SSE
  -> Workbench Web
```

| 层 | 职责 |
|---|---|
| `flutter_monitor_core` | 唯一 schema、字段注册、摘要与隐私规则 |
| `flutter_monitor_sdk` | 采集、链路、pipeline、输出；`localLive` 连本地 service |
| Monitor Service | 接收、校验、索引、查询摘要、SSE；不补写 SDK 字段进 envelope |
| Workbench Web | 展示、筛选、联动、raw 回查；view model 不是协议；Catalog 共用展示协议与 `EnvironmentProfile` 结构化上下文 |

SDK 输出模式：`consoleOnly`（仅 compact log）、`localLive`（短 batch、关键 flush，供本地 / QA）、`production`（限流、离线、重试等）。Workbench 实时性来自 service→web 的 SSE，不要求 SDK 逐条 HTTP。

---

## 数据边界

允许：

- 用 SQLite `sequence`、索引列与时间戳支持排序查询
- 从 envelope 提取索引（`sessionId`、`userId`、`route`、HTTP 派生 Host / 业务码等）
- 响应外层返回 `count`、`total`、`limit`、`offset` 等元信息
- session / performance / catalog / dashboard 返回 **query summary**（可回查 `eventId`）

禁止：

- 为缺失 SDK 字段补值后写回 `envelope_json`
- 把 summary 字段混入 raw event envelope
- 把 UI 专用 view model 当成 core schema

`eventId` 必须由 SDK 提供；缺失则拒收。

更细的口径见 [`services/monitor-service/docs/boundaries.md`](../services/monitor-service/docs/boundaries.md)。HTTP endpoint 清单以 Swagger 为准。

### 常用查询面

| 能力 | 说明 |
|---|---|
| `GET .../catalog/http` | HTTP Catalog 分页摘要；Host / 业务码为索引派生 |
| `GET .../catalog/business` | 埋点 Catalog（含 action summary，不含 measure） |
| `GET .../catalog/errors` | error ∪ 业务失败 |
| `GET .../sessions`、`.../sessions/:id` | Session 列表与全量事件 |
| `GET .../events/:eventId` | 单条 raw envelope |
| `GET .../dimensions?q=` | `userId` / `sessionId` / `requestId` 真实候选 |
| `GET .../performance/timeseries`、`.../dashboard/business-actions` | 概览分桶与 Action TopN |
| `GET .../analytics/overview` | 概览驾驶舱摘要：启动、页面、Session、HTTP、埋点、异常、排行与关注项 |
| `GET .../analytics/sessions`、`http`、`business`、`errors` | 兼容查询摘要；Workbench 不再提供对应二级分析路由 |
| SSE live | 推送新事件以失效前端查询 |

Session 摘要字段（`errorCount`、`failedHttpCount`、`businessFailureCount` 等）是 query view model，不是 envelope 字段。

通用过滤参数（可单值或逗号多值）贯穿 recent / sessions / search / performance / dimensions：`sessionId`、`userId`、`from`/`to`、`appKey`、`appVersion`、`environment`、`route`、`status`、`name`、`signalType` 等。

概览 Analytics 与 Catalog 消费同一套总 Scope，包括 `from` / `to`、用户和 Session；服务端在当前查询范围内解析 `resolvedRange`，并限制时间点与 Top N 数量。Analytics 响应是可回查 `eventId` / `sessionId` / `traceId` 的 query view model，不进入 raw envelope。

Analytics 面向大量本地事件，时间分桶、去重、Top N、矩阵和分位数必须优先由 SQLite 聚合完成，不能把全部 `envelope_json` 载入 Web 或 Node 后再统计。服务端限制约 120 个时间点和矩阵规模，并按跨度选择小时、天、周或月粒度。HTTP 耗时补充 p50 / p95 / max（SQLite 无原生 percentile 时用受控排序计算）。

---

## Workbench Web

- 栈：Vite + React + TypeScript、TanStack Router / Query、shadcn、Tailwind v4
- 目录习惯：`components/ui` 官方 primitive；`features/`、`routes/`、`app/` 业务接线；`shared/datasource` 调 Monitor Service
- Datasource：HTTP API + SSE；页面状态以 URL search 为主（筛选、分页、`eventId`、`detail`）
- 时间、应用、版本、环境、包名、用户、平台等总 Scope 跨一级导航持久化并始终平铺展示；`sessionId` / `route` 使用同一 URL 参数，由 Catalog 领域筛选条编辑，导航时经 `pickScopeSearch` 携带
- 概览和 Catalog 使用相同时间范围；图表第一阶段使用查询快照与手动刷新，SSE 不驱动图表动画

产品交互见 [`product.md`](product.md)。

---

## 排查食谱

### 按 HTTP

```sh
# Catalog 摘要（Workbench HTTP 页同口径）
curl 'http://localhost:3700/api/monitor/v1/catalog/http?limit=50'

# 原始 http.client 流
curl 'http://localhost:3700/api/monitor/v1/recent?name=http.client&limit=200'

# 单事件 raw
curl 'http://localhost:3700/api/monitor/v1/events/<eventId>'
```

Workbench：打开 **HTTP**，用 Scope + 领域筛定位行 → Preview / Record → **查看 Session**。

### 按用户还原会话

前提：App 登录后 `FlutterMonitorSDK.setContext(userId: …)`。

```sh
curl 'http://localhost:3700/api/monitor/v1/sessions?userId=<id>'
curl 'http://localhost:3700/api/monitor/v1/sessions/<sessionId>'
curl 'http://localhost:3700/api/monitor/v1/traces/<traceId>'
```

Workbench：一级导航 Session 列表，或从 Catalog / HTTP 详情带 `eventId` 进入 Session 工作区。

---

## Example Demo

体育健康 example App（`packages/flutter_monitor_sdk/example`）与 Monitor Service 上的 `/api/example/v1/*` mock 是**业务演示**，不是 Workbench 客户端。

硬约束摘要：

- Example 禁止调 Monitor 查询 API；业务 HTTP 仅 Dio + SDK interceptor
- Mock 信封 `{ code, message, data }`，`code === 0` 为成功；业务失败多为 HTTP 200 + 非 0 code
- SDK `localLive` 写入 ingest 允许（旁路配置）
- 完整页面、白名单埋点与验收见 [`EXAMPLE_DEMO.md`](EXAMPLE_DEMO.md)

---

## 问题归属

Workbench 展示不对时：

1. 先看 raw API / Raw JSON，确认 envelope 是否正确  
2. envelope 对 → 改 `platform/web` 或 service 查询摘要  
3. envelope 错 → 回根目录 `docs/` → `flutter_monitor_core` → SDK / native  
4. 不得在 service 层发明 envelope 里没有的稳定字段  
