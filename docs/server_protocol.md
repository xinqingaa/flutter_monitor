# 服务端协议

## 文档范围

本文定义 SDK 与 Monitor Service 之间当前真实可用的写入合同，并记录生产服务扩展时必须保持的兼容边界。

- 当前 API 清单以 `http://localhost:3700/docs` 和 `/docs-json` 为准。
- 查询、SQLite 索引和 Workbench summary 边界见 `platform/services/monitor-service/docs/boundaries.md`。
- 单个事件结构以 `docs/event_model.md` 为准。

当前仓库中的 Monitor Service 定位为本地开发、QA 和小规模验证服务，不等同于完整生产 APM 后端。

## 当前写入 Endpoint

```text
POST /api/monitor/v1/events
Content-Type: application/json
```

SDK 的 `localLive` 和 `production` 都通过 `ReliableHttpOutput` 发送 batch：

```json
{
  "events": [
    {
      "schemaVersion": "1.0",
      "eventId": "evt_001",
      "timestamp": "2026-05-24T12:00:00.000+08:00",
      "signalType": "span",
      "name": "http.client",
      "status": "ok",
      "priority": "normal",
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

本地 Service 为调试方便也接受：

- 单个带 `eventId` 的 envelope object；
- envelope array；
- `{ "events": [...] }` batch。

正式 SDK 输出只使用 `{ "events": [...] }`。

## 当前 Headers

| Header | 当前行为 |
|---|---|
| `Content-Type: application/json` | SDK 固定发送 |
| `Authorization: Bearer <token>` | 配置 `authTokenProvider` 时发送；本地 Service 当前不校验 |

App、SDK、core、native 和 schema 信息已经存在于每个 envelope 的 `resource` 与 `schemaVersion` 中。当前协议没有额外要求 `X-App-Key`、`X-SDK-Version` 等 header。

## 当前接收与存储语义

Monitor Service 当前执行以下检查：

1. body 中能否解析出至少一个 object event；
2. 每个事件是否包含非空字符串 `eventId`；
3. SQLite 是否能成功保存事件。

当前本地 Service 不执行完整 core schema validation、鉴权、租户隔离或 schema major 协商。SDK 在发送前已经通过本地 `SchemaValidator` 和 `PrivacyFilter`；生产服务仍应在服务端再次校验，不能依赖客户端绝对可信。

SQLite 的 `event_id` 是 unique key。重复 `eventId` 使用 upsert 更新对应 raw envelope 和索引，因此 SDK 重试必须保持原始 `eventId`。

生产服务在此基础上应增加完整 schema validation、鉴权、租户隔离、请求大小限制和 schema major 协商，但不能改变 event-level `EventEnvelope` 作为事实源的约束。

## 当前 Response

全部或部分接收时返回 HTTP `202`：

```json
{
  "accepted": 2,
  "rejected": 1,
  "total": 120,
  "eventIds": ["evt_001", "evt_002"],
  "errors": [
    {
      "code": "MISSING_EVENT_ID",
      "message": "eventId is required",
      "retryable": false
    }
  ]
}
```

当前错误响应：

| HTTP | `error` / code | 含义 |
|---|---|---|
| `400` | `no_events` | body 中没有可解析事件 |
| `400` | `missing_event_id` / `MISSING_EVENT_ID` | 所有事件都缺少 `eventId` |
| `500` | `store_failed` / `STORE_FAILED` | SQLite 写入失败，可重试 |

SDK 当前把任意 `2xx` 视为整个已发送 batch 已确认。它不会解析 `202` body 做事件级重试。因此本地 Service 的“部分接收”只适合发现无效调试数据；生产服务若需要严格 partial acceptance，必须与客户端一起升级事件级 ack 协议，不能只修改 response body。

## Batch 与大小边界

客户端实际默认值由 `MonitorProductionPolicy` 定义：

| 配置 | default production | localLive |
|---|---:|---:|
| `maxBatchEvents` | 50 | 20 |
| `maxBatchBytes` | 1 MB | 1 MB |
| `maxEventBytes` | 256 KB | 512 KB |
| `requestTimeout` | 8 秒 | 5 秒 |
| `maxEventAge` | 3 天 | 12 小时 |

Monitor Service 的 JSON body limit 默认是 `10mb`，可通过 `FM_WORKBENCH_BODY_LIMIT` 覆盖。客户端仍必须先遵守自己的 batch/event 上限，不能把 Service body limit 当成正常组包大小。

单事件超过上限时，SDK 会先尝试剥离可裁剪的 HTTP detail；仍超限则按 drop policy 处理并记录 SDK self-monitoring。

## 客户端响应与重试行为

`ReliableHttpOutput` 当前按 HTTP status 执行动作：

| 响应 | SDK 行为 |
|---|---|
| `2xx` | ack 整个 batch |
| `400/401/403` | 不重试，ack 后记录 `non_retryable_rejected` |
| `413` 且 batch 多事件 | 缩小 batch 后立即重试 |
| `413` 且单事件 | 丢弃并记录 `payload_too_large` |
| `429` | 读取 `Retry-After` 并计划重试 |
| `5xx` | 指数退避加 jitter 后重试 |
| 超时或网络错误 | 计划重试；退出 flush 只记录失败并保留队列 |

重试按事件各自的 `attemptCount` 判断。超过 `maxRetryAttempts` 的事件按 `retry_exhausted` 丢弃，未超限事件继续留在队列。超过 `maxEventAge` 的事件按 `expired` 清理。

事件优先级来自 envelope 的 `priority`，建议语义如下：

| 优先级 | 事件示例 |
|---|---|
| `critical` | fatal error、未来可靠的 native crash/OOM/ANR、critical SDK health |
| `high` | error、关键 jank、慢启动、慢页面、memory pressure、flush failure |
| `normal` | page trace、completed HTTP、custom trace、成功的 SDK health |
| `low` | 普通 breadcrumb、普通 log、普通 memory sample |

队列达到上限时应优先保留高优先级事件，并记录被驱逐数量。partial acceptance 只有在客户端解析事件级 ack 后才成立；当前 SDK 将任意 `2xx` 视为整个 batch ack，因此生产服务不能单方面引入不可被客户端理解的部分确认语义。

## 隐私与 HTTP 详情

所有事件在进入 output 前必须经过 `PrivacyFilter`。但这不代表 HTTP payload 默认没有敏感信息：当前 `MonitorHttpConfig` 默认采集 query、headers、request body 和 response body，并将详情字段标记为 sensitive；接入方应根据业务数据配置 redactor 或关闭相应采集项。

服务端必须：

- 只从注册字段和受控索引列构建查询维度；
- 不把派生 Host、业务码或 query summary 写回 `envelope_json`；
- 不依赖未脱敏 body 完成核心聚合；
- 对日志、备份、访问权限和数据保留周期单独实施服务端治理。

## Schema 兼容

每个 envelope 自带 `schemaVersion`。兼容原则：

- patch 不改变既有字段语义；
- minor 可以新增向后兼容字段；
- major 可以改变结构，需要客户端与服务端协商升级；
- 服务端不得静默改写不认识的字段；
- query summary 和 TypeScript view model 不构成新的 SDK schema。

当前本地 Service 保存 raw JSON，不拒绝不支持的 schema major。生产服务应补充 major version 校验，并把不兼容响应定义为明确的不可重试错误。

生产协议可使用 `SCHEMA_INVALID`、`SCHEMA_UNSUPPORTED_MAJOR`、`AUTH_FAILED`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`EVENT_TOO_LARGE`、`SERVER_BUSY` 和 `SERVER_ERROR` 等稳定错误码。错误响应必须说明是否可重试，SDK 不应对 schema、鉴权和单事件超限错误无限重试。

## Native 事件

Native signal 必须先通过 `flutter_monitor_native` bridge 和 SDK mapper 进入统一 envelope，再使用同一 endpoint。native plugin 不得独立建立 HTTP 协议、上传队列或 session id。

当前插件可靠提供的是 resource、memory、memory pressure 和 lifecycle。crash、OOM、ANR 只有 schema/mapper 预留，服务端不能据此假设客户端已经可靠采集。

异常生命周期可能无法拿到完整 context。此时应保留 `context.missing` 或 `context.missingReason`，并尽力将 native raw signal 写入离线缓存，由后续 SDK pipeline 补全；不能由服务端伪造 session、route 或用户上下文。

## 查询协议

查询 API 包括 health、recent、Catalog、dimensions、Session、Trace、Event、Performance、Analytics、search、groups 和 SSE。endpoint 与参数变化以 Swagger 为准，稳定的数据边界以 Platform 文档为准，本文不重复维护完整清单。

所有查询摘要必须满足：

- 能通过 `eventId`、`sessionId` 或 `traceId` 回查 raw envelope；
- 不覆盖 SDK 字段；
- 不作为另一套上报协议。

## 生产服务扩展边界

以下能力是生产后端可增加的治理能力，不是当前 Monitor Service 合同：

- token 校验、租户与环境隔离；
- 服务端完整 schema validation；
- 事件级 partial ack；
- 限流配额和标准化错误码；
- remote config / kill switch；
- 多副本幂等、长期存储、审计、告警和聚合任务。

扩展这些能力时必须保持 `EventEnvelope` 为事件事实源，并与 SDK 的 ack/retry 行为一起演进。

## 隐私、安全与请求元数据

所有事件在 SDK 进入 output 前经过 `PrivacyFilter`，但 HTTP query、headers、request body 和 response body 是否采集仍由 `MonitorHttpConfig` 决定。当前默认配置可能采集这些 sensitive payload，真实 App 必须配置 redactor 或关闭相应采集项。

服务端必须：

- 通过 HTTPS、token 和环境/租户边界保护写入接口；
- 只从注册字段和受控索引列构建查询维度；
- 不把派生 Host、业务码、query summary 或 UI summary 写回 `envelope_json`；
- 不依赖未脱敏 body 完成核心聚合；
- 对日志、备份、访问权限和数据保留周期单独实施治理。

请求级 `appKey`、SDK 版本、core 版本和 request ID 只用于鉴权、路由、兼容检查和诊断，不替代事件内的 `resource.app.*` 与 `resource.sdk.*`。如果请求级元数据与事件级 resource 冲突，应记录协议错误或拒绝，不得静默覆盖事件事实。

## Remote Config 预留

未来服务端可以在成功响应中携带带版本号的 remote config，控制采样、限流、privacy 开关、collector 开关、queue、batch、flush 和 retry 参数。SDK 不得依赖 remote config 才能安全运行；配置失效时必须回退到本地默认值或上一份有效配置，并记录 `sdk.config.*`。

Remote config 只是 production policy 的输入，不是新的事件模型。它不能改变字段语义、绕过 privacy filtering，也不能让服务端直接向 Workbench 写入 SDK 字段。

## 服务端聚合维度与派生指标

生产服务可按以下注册字段和链路标识聚合：

- `context.user.userId`、`context.user.cohort`；
- `resource.app.appVersion`、`buildNumber`、`environment`、`channel`、`flavor`；
- `context.release.featureFlags`、`context.route.name`、`context.module.name`；
- `resource.device.deviceTier`、`osVersion`、`context.network.type`；
- `sessionId`、`traceId`、`context.native.platform`、`memory.pressure_level`。

可派生启动/页面/API 分位数、错误率、卡顿率、native crash/ANR/OOM rate、内存趋势、影响用户数、版本退化、feature flag 差异和弱网失败率。派生指标必须能通过 `eventId`、`sessionId` 或 `traceId` 回查 raw envelope，不得要求 SDK 另报一套聚合指标。
