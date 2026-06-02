# Workbench Service API

本文档描述当前本地 `workbench/service` 的 HTTP API。它服务于本地调试、QA 复现和 Workbench Web 查询，不等同于 `docs/server_protocol.md` 中面向 Phase 6 的生产服务端协议。

## 端口与入口

| 地址 | 用途 | 说明 |
|---|---|---|
| `http://localhost:4700/` | Workbench Web 开发入口 | Vite dev server，读取 `workbench/web/src`，开发时优先访问这里。 |
| `http://localhost:3700/` | Workbench service 静态入口 | service 会优先托管 `workbench/web/dist`，否则 fallback 到 `workbench/service/public`。如果 dist 或 public 是旧产物，这里可能显示旧工作台。 |
| `http://localhost:3700/api/monitor/v1/*` | Workbench service API | SDK 写入、Workbench 查询和 SSE 都走这里。 |

开发阶段应把 `4700` 作为主工作台入口，把 `3700` 作为 API service。`3700 /` 只适合 build 后预览或 legacy fallback，不代表当前前端源码。

## 数据边界

Workbench service 只接收和存储 SDK 发来的 `EventEnvelope`。原始 envelope 查询接口必须返回入库 envelope 本身，不应把 service 自己生成的字段写回 envelope。

允许的 service 行为：

- 用 SQLite `sequence`、索引列和时间戳支持查询排序。
- 从 envelope 中提取 `sessionId`、`traceId`、`context.user.userId`、`context.route.name`、`resource.app.*` 等字段作为查询索引。
- 在查询接口外层返回 `count`、`accepted`、`rejected`、`eventCount` 等响应元信息。
- 在 session/performance/group 接口返回 Workbench query summary。

禁止的 service 行为：

- 不得为缺失的 SDK 字段补值后写回 `envelope_json`。
- 不得把 Workbench query summary 当作 SDK schema 字段。
- 不得把 `durationSummary`、`errorCount`、`jankCount` 等摘要字段混入原始 event envelope。

`eventId` 必须由 SDK 提供。缺少 `eventId` 的事件会被拒收；service 可以使用 SQLite 内部 `sequence` 排序，但不能把 `evt_server_*` 写入 envelope。

## 通用筛选参数

以下查询接口按需支持同一组筛选参数：

| 参数 | 来源字段 | 说明 |
|---|---|---|
| `userId` | `context.user.userId` | 用户 ID。 |
| `from` | `timestamp` / `startTime` | 起始时间，ISO 字符串。 |
| `to` | `timestamp` / `startTime` | 结束时间，ISO 字符串。 |
| `appVersion` | `resource.app.appVersion` | App 版本。 |
| `environment` | `resource.app.environment` | dev、test、staging、production 等环境。 |
| `route` | `context.route.name` | 页面 route。 |
| `status` | `status` | 事件状态。 |
| `name` | `name` | 事件名，例如 `app.cold_start`。 |
| `signalType` | `signalType` | signal 类型，例如 `trace`、`span`、`error`。 |
| `limit` | query only | 返回条数上限，当前最大 500。 |

## 写入接口

### `POST /api/monitor/v1/events`

接收单条 event envelope 或 `{ "events": [...] }` 批量 body。

```json
{
  "events": [
    {
      "eventId": "evt_001",
      "timestamp": "2026-05-29T10:00:00.000Z",
      "signalType": "trace",
      "name": "app.cold_start",
      "status": "ok",
      "sessionId": "ses_001",
      "traceId": "trace_001",
      "resource": {},
      "context": {},
      "attributes": {},
      "payload": {}
    }
  ]
}
```

成功响应：

```json
{
  "accepted": 1,
  "rejected": 0,
  "total": 35,
  "eventIds": ["evt_001"],
  "errors": []
}
```

如果 batch 中部分事件缺少 `eventId`，这些事件会被拒收，其他有效事件仍可入库：

```json
{
  "accepted": 1,
  "rejected": 1,
  "total": 35,
  "eventIds": ["evt_001"],
  "errors": [
    {
      "code": "MISSING_EVENT_ID",
      "message": "eventId is required",
      "retryable": false
    }
  ]
}
```

如果没有可接收事件：

```json
{
  "error": "missing_event_id",
  "accepted": 0,
  "rejected": 1,
  "errors": [
    {
      "code": "MISSING_EVENT_ID",
      "message": "eventId is required",
      "retryable": false
    }
  ]
}
```

### `POST /report`

Legacy 兼容入口，行为接近 `POST /api/monitor/v1/events`。新 SDK 和 Workbench 文档不应推荐使用它。

## 原始 Envelope 查询

以下接口返回完整 SDK envelope，适合排查 raw JSON。

### `GET /api/monitor/v1/recent?limit=80`

返回最近事件：

```json
{
  "count": 1,
  "events": [
    {
      "eventId": "evt_001",
      "timestamp": "2026-05-29T10:00:00.000Z",
      "signalType": "trace",
      "name": "app.cold_start",
      "resource": {},
      "context": {},
      "attributes": {},
      "payload": {}
    }
  ]
}
```

### `GET /api/monitor/v1/events/:eventId`

按 eventId 返回单个 envelope：

```json
{
  "event": {}
}
```

未找到时：

```json
{
  "error": "event_not_found"
}
```

### `GET /api/monitor/v1/sessions/:sessionId`

返回某个 session 下的完整 envelope 列表，按时间升序。

```json
{
  "sessionId": "ses_001",
  "count": 10,
  "events": []
}
```

### `GET /api/monitor/v1/traces/:traceId`

返回某个 trace 下的完整 envelope 列表，按时间升序。

```json
{
  "traceId": "trace_001",
  "count": 3,
  "events": []
}
```

### `GET /api/monitor/v1/search?query=http.client&limit=50`

对 envelope JSON 做本地搜索，可叠加通用筛选参数。

```json
{
  "query": "http.client",
  "count": 1,
  "events": []
}
```

## 查询摘要接口

以下接口返回 Workbench query summary。摘要字段不是 SDK envelope 字段，但每条摘要都应尽量携带 `eventId`、`sessionId` 或 `traceId` 以便回查原始 envelope。

### `GET /api/monitor/v1/health`

```json
{
  "ok": true,
  "service": "flutter_monitor_workbench_service",
  "sseClients": 1,
  "storageMode": "sqlite",
  "eventCount": 35,
  "sessionCount": 2,
  "traceCount": 4,
  "lastIngestAt": "2026-05-29T13:49:20.261Z"
}
```

### `GET /api/monitor/v1/sessions?...filters`

返回 session 列表摘要。

```json
{
  "count": 1,
  "userIdAvailable": true,
  "userIdQueryAvailable": true,
  "sessions": [
    {
      "sessionId": "ses_001",
      "count": 10,
      "firstTimestamp": "2026-05-29T10:00:00.000Z",
      "lastTimestamp": "2026-05-29T10:01:00.000Z",
      "firstEventId": "evt_001",
      "lastEventId": "evt_010",
      "userId": "user_001",
      "appVersion": "1.0.0",
      "environment": "dev",
      "route": "/",
      "status": "ok",
      "errorCount": 0,
      "jankCount": 0,
      "failedHttpCount": 0
    }
  ]
}
```

摘要字段来源：

| 摘要字段 | 来源 / 计算口径 |
|---|---|
| `count` | 该 session 下 envelope 数量。 |
| `firstTimestamp` / `lastTimestamp` | session 内首尾事件的 `timestamp`。 |
| `firstEventId` / `lastEventId` | session 内首尾事件的 `eventId`。 |
| `userId` | 首个包含 `context.user.userId` 的事件。 |
| `appVersion` / `environment` | 首个包含 `resource.app.*` 的事件。 |
| `route` | 最后一条包含 `context.route.name` 的事件。 |
| `status` | 有非 HTTP 的稳定性错误则为 `error`，否则取最近可用 `status`。 |
| `errorCount` | 非 completed HTTP 的稳定性错误事件数；HTTP 失败不计入该字段。 |
| `jankCount` | `name=ui.jank.sequence` 的事件数。 |
| `failedHttpCount` | `name=http.client`、`attributes["event.phase"]="instant"`，且 `status=error` 或 `attributes["http.success"]=false` 的事件数。 |

### `GET /api/monitor/v1/performance/overview?...filters`

返回五类性能摘要：

```json
{
  "startup": {},
  "pages": {},
  "http": {},
  "jank": {},
  "errors": {}
}
```

每类结构：

```json
{
  "count": 6,
  "errorCount": 0,
  "durationSummary": {
    "sourceFields": ["durationMs"],
    "sampleCount": 6,
    "averageMs": 355.6,
    "maxMs": 555,
    "latestMs": 509
  },
  "events": []
}
```

`durationSummary` 是 Workbench query summary：

| 字段 | 来源 / 计算口径 |
|---|---|
| `sourceFields` | 当前摘要使用的 SDK envelope 字段路径。通用 `durationSummary` 使用顶层 `durationMs`，专属摘要可使用标准 attributes。 |
| `sampleCount` | 当前类别中存在有效统计值的事件数。 |
| `averageMs` | 统计值算术平均值。 |
| `maxMs` | 最大统计值。 |
| `latestMs` | 按事件时间倒序，最近一条有统计值的记录。 |
| `maxEventId` | 最大统计值对应的 `eventId`，用于回查。 |
| `latestEventId` | 最近统计值对应的 `eventId`，用于回查。 |

除兼容用的 `durationSummary` 外，`performance/overview` 会返回按 signal 语义拆分的专属摘要，避免把停留时长、错误状态或卡顿帧指标误展示成通用耗时。

`startup` 额外字段：

| 字段 | 来源 / 计算口径 |
|---|---|
| `coldStart` | `name=app.cold_start` 的 `durationMs`。当前 SDK 口径下它表示“冷启动到首帧”的累计耗时。 |
| `firstFrame` | `name=app.first_frame` 的 `attributes["app.first_frame_ms"]`，缺失时降级到 `durationMs`。它是冷启动 trace 的首帧终点口径，通常与 `coldStart` 同值，不应在图表中作为独立阶段重复叠加。 |
| `sdkInit` | `name=sdk.init` 的 `attributes["sdk.init.duration_ms"]`，缺失时降级到 `durationMs`。 |
| `backgroundInterval` | `name=app.background_duration` 的 `durationMs`。它表示后台停留间隔，只作为 lifecycle 和恢复上下文，不进入热重启耗时统计。 |
| `hotResume` | `name=app.hot_start` 的 `durationMs`，且 `attributes["app.start.type"] = "hot"`。`attributes["app.start.end_reason"]` 说明闭合口径，例如 `first_frame` 或 `interactive`。旧 SDK 数据如果只有 `durationMs = 0` 或仅在 payload 中带 `background_duration_ms`，应标记为 `sdk_hot_resume_duration_missing`。 |

Workbench 启动详情页按这个口径展示：

- `启动阶段散点`：不连线、不做时间桶聚合；每个点对应一条启动链路里的已采集指标，包括冷启动到首帧、SDK 初始化和首帧前其他耗时。
- `后台间隔`：单独展示 `app.background_duration.durationMs`，不与毫秒级启动耗时混轴。
- `热重启耗时`：只展示 `app.hot_start.durationMs`，不回退到 `app.background_duration`，避免把后台停留间隔伪装成热重启性能。

`pages` 额外字段：

| 字段 | 来源 / 计算口径 |
|---|---|
| `load` | `name=page.load` 的 `attributes["page.load_ms"]`，缺失时降级到 `durationMs`。 |
| `firstFrame` | `name=page.first_frame` 的 `attributes["page.first_frame_ms"]`，缺失时降级到 `durationMs`。 |
| `stay` | `name=page.stay` 的 `durationMs`。 |
| `routeSummaries` | 按 `context.route.name` 分组的页面加载摘要。停留时长不混入加载摘要。 |

`http` 额外字段：

| 字段 | 来源 / 计算口径 |
|---|---|
| `failedCount` | `name=http.client`、`attributes["event.phase"]="instant"`，且 `status=error` 或 `attributes["http.success"]=false` 的数量。 |
| `slowCount` | `name=http.client`、`attributes["event.phase"]="instant"`，且 `durationMs >= 1000` 的数量。 |
| `affectedSessionCount` | 当前 HTTP 事件影响的 distinct `sessionId` 数。 |
| `routeSummaries` | 按 `context.route.name` 分组，统计请求数和最慢请求。 |
| `endpointSummaries` | 按 `attributes["http.url.normalized"]` 分组。 |
| `statusSummaries` | 按 `attributes["http.status_code"]` 或失败类型分组。 |

Workbench 只统计符合新规范的 completed single-span HTTP envelope：`name=http.client` 且 `attributes["event.phase"]="instant"`。旧的 `event.phase=end` HTTP 数据不做兼容，清理 SQLite 后重新采集。

`jank` 额外字段：

| 字段 | 来源 / 计算口径 |
|---|---|
| `affectedSessionCount` | 当前卡顿事件影响的 distinct `sessionId` 数。 |
| `totalJankFrames` | `attributes["jank.count"]` 求和。 |
| `maxFrame` | `attributes["frame.max_ms"]` 摘要。 |
| `avgFrame` | `attributes["frame.avg_ms"]` 摘要。 |
| `jankFrames` | `attributes["jank.count"]` 摘要。 |
| `routeSummaries` | 按 `context.route.name` 分组，统计卡顿次数和最慢帧。 |

`errors` 额外字段：

Workbench 错误页关注稳定性错误，不混入 completed HTTP 失败；HTTP 失败统一在 `http.failedCount`、网络页和 Session 失败请求中展示。

| 字段 | 来源 / 计算口径 |
|---|---|
| `affectedSessionCount` | 当前稳定性错误事件影响的 distinct `sessionId` 数。 |
| `typeSummaries` | 按 `attributes["error.type"]` 分组，缺失时使用 `name`。 |
| `mechanismSummaries` | 按 `attributes["error.mechanism"]` 分组，缺失时使用 `name`。 |
| `routeSummaries` | 按 `context.route.name` 分组。 |
| `recent` | 最近稳定性错误事件轻量 view model。 |

`events` 是轻量 view model，不是完整 envelope。字段来自：

| 字段 | 来源 |
|---|---|
| `eventId` | `eventId` |
| `sessionId` | `sessionId` |
| `traceId` | `traceId` |
| `signalType` | `signalType` |
| `name` | `name` |
| `route` | `context.route.name` |
| `durationMs` | `durationMs` |
| `level` | `level` |
| `status` | `status` |
| `timestamp` | `timestamp` |
| `attributes` | `attributes` |
| `resource` | `resource`，用于 Workbench Web 解释 native bridge、app/device/runtime 等上下文。 |
| `context` | `context`，用于 Workbench Web 解释 route、native availability、lifecycle 等上下文。 |

### `GET /api/monitor/v1/performance/pages?...filters`

返回 `performance/overview` 中的 `pages` 摘要。

### `GET /api/monitor/v1/performance/http?...filters`

返回 `performance/overview` 中的 `http` 摘要。

### `GET /api/monitor/v1/groups?by=session|trace|route|name`

返回分组摘要。

```json
{
  "by": "session",
  "count": 1,
  "groups": [
    {
      "sessionId": "ses_001",
      "count": 10,
      "firstEventId": "evt_001",
      "lastEventId": "evt_010"
    }
  ]
}
```

## 实时接口

### `GET /api/monitor/v1/stream`

SSE 事件流。service 在收到 accepted events 后推送原始 envelope。

## Dev / Test 接口

以下接口只服务本地测试：

- `GET /api/test/slow?delayMs=&bytes=`
- `GET /api/test/status/:statusCode`

这些接口不是 SDK 上报协议，不应出现在生产接入文档中。
