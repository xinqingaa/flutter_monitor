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

## 状态码

| HTTP 状态码 | 处理方式 |
|---|---|
| 2xx | 成功或部分成功 |
| 400 | 请求格式错误，不重试 |
| 401/403 | 鉴权失败，不重试，记录 SDK self-monitoring |
| 413 | 请求过大，拆包后重试 |
| 429 | 限流，按 `retryAfterMs` 重试 |
| 5xx | 服务端异常，可重试 |

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

## Schema 兼容

服务端必须识别 `schemaVersion`。

兼容策略：

- patch version 不破坏字段语义；
- minor version 可新增字段；
- major version 可改变结构；
- 服务端应能拒绝不支持的 major version；
- SDK 应能记录协议拒绝原因。

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
