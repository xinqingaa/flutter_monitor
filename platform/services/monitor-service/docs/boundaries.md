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

## Session Console View Model

`/api/monitor/v1/sessions/:sessionId/console` 返回的 `SessionConsoleRow` 是 Workbench 专用 view model，禁止替代 SDK schema 字段。Workbench 信息架构按下列规则消费：

- `pageInstanceId` / `pageActivePhase` / `pageActiveTrigger`：从 `attributes['page.instance_id']` 等字段提取，仅作为 UI 折叠分组的 key，不改变 raw envelope。
- `metrics`：service 已经按 `group` 收口最重要的 metric。Workbench 行内仅展示 `metrics`，不再消费 service 端组装的字符串字段。
- `subtitle`：已废弃。service 不再写入；遗留 client 仍可读取，但 Workbench 当前一切展示已迁移到 `title + badges + metrics`。新功能不要再向 row 写视图字符串，view 模型应保持结构化。
- `problemChips`：保留作为问题面索引；Workbench 把它映射成 Tab 徽标 + 二级 chip，不再以独立"快速定位"区块展示。

Service 端不应为 UI 信息架构（Tab、chip、page card 折叠等）追加新的字段；若 Workbench 需要新维度，应优先使用现有 row attributes 推导。
