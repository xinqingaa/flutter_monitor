# 服务端协议

## 目标

服务端协议负责接收 SDK 统一事件模型，并支持批量上报、鉴权、兼容、重试、聚合和告警。

服务端不应要求 SDK 针对不同模块发送不同协议结构。所有信号应通过统一 event envelope 上报。

## Endpoint

建议默认接口：

```text
POST /api/monitor/events
```

## Headers

建议 headers：

| Header | 必填 | 说明 |
|---|---:|---|
| `Content-Type: application/json` | 是 | 请求格式 |
| `X-App-Key` | 是 | 应用标识 |
| `X-SDK-Name` | 是 | SDK 名称 |
| `X-SDK-Version` | 是 | SDK 版本 |
| `X-Schema-Version` | 是 | event schema 版本 |
| `X-Request-Id` | 是 | 上报请求 ID |
| `Authorization` | 否 | 服务端鉴权 |
| `Content-Encoding` | 否 | gzip 等压缩方式 |

## Request Body

```json
{
  "schemaVersion": "1.0",
  "requestId": "req_001",
  "sentAt": "2026-05-24T12:00:00.000+08:00",
  "appKey": "app_xxx",
  "events": []
}
```

`events` 中的每一项必须符合 `docs/event_model.md` 定义的 event envelope。

## 批量边界

SDK 应支持按事件数量和请求体大小拆包。建议配置项：

- `maxEventsPerBatch`
- `maxBytesPerBatch`
- `maxEventBytes`
- `compressionThresholdBytes`

单个事件超过 `maxEventBytes` 时，应优先裁剪 `payload` 中可裁剪字段，并记录 SDK self-monitoring；仍然超限时丢弃该事件，不应无限重试。

请求体超过服务端限制并收到 `413` 时，SDK 应拆分 batch 后重试。若拆分到单事件仍失败，应按不可重试失败处理。

## 幂等语义

`eventId` 是事件幂等键。服务端应允许同一 `eventId` 的重复上报，并按幂等语义去重。

SDK 重试时不得为同一事件重新生成 `eventId`，否则服务端无法区分重试和新事件。

`requestId` 只表示一次 HTTP 上报请求，不参与事件去重。同一个 batch 拆包或重试时可以使用新的 `requestId`，但事件自身的 `eventId` 必须保持不变。

## Response Body

成功：

```json
{
  "code": 0,
  "message": "ok",
  "accepted": 10,
  "rejected": 0,
  "retryAfterMs": null
}
```

部分失败：

```json
{
  "code": 207,
  "message": "partial accepted",
  "accepted": 8,
  "rejected": 2,
  "errors": [
    {
      "eventId": "evt_001",
      "code": "SCHEMA_INVALID",
      "message": "missing sessionId"
    }
  ]
}
```

部分失败中的 `errors` 应指明每个失败事件是否可重试：

```json
{
  "eventId": "evt_001",
  "code": "SCHEMA_INVALID",
  "message": "missing sessionId",
  "retryable": false
}
```

SDK 只应重试 `retryable = true` 的事件。`SCHEMA_INVALID`、`AUTH_FAILED`、`PAYLOAD_TOO_LARGE_SINGLE_EVENT` 等不可重试错误应记录 SDK self-monitoring，并按优先级策略决定是否丢弃或降级保存。

## 状态码

| HTTP 状态码 | 处理方式 |
|---|---|
| 2xx | 成功或部分成功 |
| 400 | 请求格式错误，不重试 |
| 401/403 | 鉴权失败，不重试，记录 SDK self-monitoring |
| 413 | 请求过大，拆包后重试 |
| 429 | 限流，按 `retryAfterMs` 重试 |
| 5xx | 服务端异常，可重试 |

若服务端使用 HTTP `207` 表示部分成功，response body 仍应使用本文档的部分失败结构。若服务端统一使用 HTTP `200` 表示接收成功但部分事件被拒绝，也必须通过 `accepted`、`rejected` 和 `errors` 表达事件级结果。

## 重试语义

SDK 应支持：

- 指数退避；
- 最大重试次数；
- 最大队列长度；
- 最大离线缓存大小；
- 事件优先级；
- App 退出前尽力 flush；
- 网络恢复后重试。

错误、崩溃、关键卡顿、关键页面性能事件优先级应高于普通行为 breadcrumb。

重试边界：

- 网络错误、超时、429、5xx 和事件级 `retryable = true` 可以重试。
- 400、401、403、schema invalid、鉴权失败和单事件超限默认不重试。
- 重试必须保持原始 `eventId`。
- 重试队列达到上限时，应优先保留高优先级事件，并记录丢弃计数。
- App 退出前 flush 是尽力语义，不保证所有低优先级事件都成功上报。

## Schema 兼容

服务端必须识别 `schemaVersion`。

兼容策略：

- patch version 不破坏字段语义；
- minor version 可新增字段；
- major version 可改变结构；
- 服务端应能拒绝不支持的 major version；
- SDK 应能记录协议拒绝原因。

服务端拒绝不支持的 schema major version 时，应返回明确错误码，例如 `SCHEMA_UNSUPPORTED_MAJOR`。SDK 收到后不应重试同一批事件，但应记录 SDK self-monitoring，便于开发者发现版本不兼容。

## 隐私与安全

协议层应支持：

- HTTPS；
- 鉴权 token；
- 敏感字段脱敏；
- URL normalize；
- request/response body 默认不上报；
- payload 大小限制；
- 用户标识匿名化；
- 环境隔离。

服务端协议不应依赖未脱敏字段完成核心聚合。聚合字段应来自 `docs/event_model.md` 的字段注册表，例如 normalized URL、route、module、app version、device tier 和 network type。

## 服务端聚合维度

服务端应支持按以下维度查询和聚合：

- app version
- build number
- environment
- channel
- flavor
- feature flag
- route
- module
- scene
- device tier
- OS version
- network type
- user cohort

## 服务端派生指标

服务端应基于事件模型派生：

- 页面耗时分位数；
- API 耗时分位数；
- 页面卡顿率；
- 错误率；
- crash/session impact；
- 影响用户数；
- 版本退化；
- feature flag 差异；
- 弱网失败率；
- 低端设备性能表现。
