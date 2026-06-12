# Monitor Service 数据边界

本文档描述 Monitor Service 的数据与查询边界。HTTP endpoint 清单与交互调试请使用 Swagger：

- 本地：`http://localhost:3700/docs`
- OpenAPI JSON：`http://localhost:3700/docs-json`

## 端口与入口

| 地址 | 用途 |
|---|---|
| `http://localhost:3700/docs` | Swagger API 文档 |
| `http://localhost:3700/api/monitor/v1/*` | Monitor Service API |
| `http://localhost:4700/` | Workbench Web（Vite dev） |

## Raw Envelope 边界

Monitor Service 只接收和存储 SDK 发来的 `EventEnvelope`。

允许：

- 用 SQLite `sequence`、索引列和时间戳支持查询排序
- 从 envelope 提取索引字段（`sessionId`、`userId`、`route` 等）
- 在响应外层返回 `count`、`accepted`、`eventCount` 等元信息
- 在 session/performance 接口返回 Workbench query summary

禁止：

- 为缺失的 SDK 字段补值后写回 `envelope_json`
- 把 query summary 当作 SDK schema 字段写回 envelope
- 把 `durationSummary`、`errorCount` 等摘要字段混入 raw event envelope

`eventId` 必须由 SDK 提供。缺少 `eventId` 的事件会被拒收。

## Session 摘要口径

| 摘要字段 | 说明 |
|---|---|
| `errorCount` | 非 completed HTTP、非业务失败的稳定性错误 |
| `failedHttpCount` | `http.client` instant 阶段且失败的事件 |
| `businessFailureCount` | `business.result=failed` 的业务动作 |
| `jankCount` | `name=ui.jank.sequence` 的事件数 |

摘要字段不是 SDK envelope 字段，但应尽量携带 `eventId`/`sessionId`/`traceId` 以便回查 raw JSON。
