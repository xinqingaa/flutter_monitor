# 事件模型

## 目标

本文档定义 Flutter Monitor SDK 的统一事件模型。所有错误、性能、网络、页面、行为、卡顿、内存、生命周期和自定义业务信号，都应进入同一套 session/trace/span/breadcrumb/context 模型。

事件模型的目标是让数据具备三个能力：

- 可回放：能还原一次用户或 QA 会话中发生的关键过程。
- 可聚合：能按页面、模块、版本、设备、网络、用户分群等维度统计。
- 可定位：能把错误、慢请求、页面慢、卡顿和用户操作关联到同一条链路。

## 设计原则

### 信号源保留

错误、启动耗时、页面加载、API 耗时、卡顿、用户点击、PV、页面停留等信号都应被视为基础输入。事件模型的任务不是减少信号，而是把信号放入同一条可诊断链路。

### 关联优先

每个事件都应尽量关联：

- 所属 session；
- 当前 route/module/scene；
- 当前 trace 或 active span；
- 最近 breadcrumbs；
- app/device/network/release/user 上下文。

无法关联上下文的事件仍可上报，但应被标记为 `context.missing = true` 或携带缺失原因，便于后续治理。

### 稳定命名

事件名用于聚合，必须稳定。动态业务值不得进入 `name`，应进入 `attributes` 或 `payload`。

### 分层存储

- `resource` 放稳定资源。
- `context` 放事件发生时的上下文。
- `attributes` 放可检索、可聚合字段。
- `payload` 放事件特有详情。

同一个语义字段只能有一个规范路径。不要在 `resource`、`context`、`attributes` 和 `payload` 中重复表达同一含义。

### Trace 与 Span 一等化

Trace 和 span 都是一等事件：

- `signalType = trace` 表示一次可排查流程的根事件或流程摘要。
- `signalType = span` 表示 trace 内部的一个阶段。

不要用 `signalType = trace` 同时表达根 trace 和内部 span。HTTP 请求、图片解码、列表构建、首帧、页面可交互等阶段应使用 `signalType = span`。

### 隐私默认安全

URL query、request body、response body、token、手机号、身份证、地址等数据默认不进入事件。确需上报时必须经过显式配置和脱敏策略。

隐私过滤必须早于任何 output，包括 log、HTTP、DevTools 和文件导出。

## 核心概念

### Session

`session` 表示一次用户使用过程或一段可分析的 App 活动窗口。

Session 应至少具备：

- `sessionId`
- `startedAt`
- `endedAt`
- `durationMs`
- `isForeground`
- `appLifecycleState`
- `user`
- `resource`

Session 负责承载用户路径、页面切换、关键操作、请求、卡顿和错误。

Session 应作为绝大多数事件的最小关联单位。没有 `sessionId` 的事件只能作为 SDK 自监控或初始化前临时事件处理。

### Trace

`trace` 表示一次可追踪流程，例如：

- 冷启动
- 热启动
- 页面打开
- 用户点击触发的业务流程
- 一次接口调用链
- 一段自定义业务流程

Trace 应至少具备：

- `traceId`
- `name`
- `startTime`
- `endTime`
- `durationMs`
- `rootSpanId`
- `status`
- `context`

Trace 应用于表达“一个可排查流程”。页面打开、用户点击后的业务流程、冷启动、自定义业务流程都应优先建模为 trace。

Trace 事件通常只表示流程整体：

- 开始事件可记录 `startTime` 和 root span。
- 结束事件或摘要事件可记录 `durationMs`、`status` 和聚合结果。
- Trace 内部阶段不得挤进 trace 事件本身，应使用 span 事件表达。

### Span

`span` 表示 trace 中的一个阶段。

典型 span：

- `app.cold_start`
- `route.push`
- `page.first_frame`
- `page.interactive`
- `http.client`
- `image.decode`
- `list.build`
- `custom.step`

Span 应支持父子关系：

- `spanId`
- `parentSpanId`
- `traceId`

Span 应用于表达 trace 内部阶段。一个页面 trace 可以包含 route、first frame、API、渲染、图片、业务计算等多个 span。

Span 事件必须能通过 `traceId` 关联到所属 trace。除 root span 外，span 应尽量提供 `parentSpanId`。

### Breadcrumb

`breadcrumb` 表示问题发生前后的关键足迹。

典型 breadcrumb：

- route enter/leave
- tap
- scroll
- dialog show/dismiss
- http request start/end
- lifecycle change
- jank sequence
- error captured
- custom business action

错误、卡顿、慢页面和关键性能事件应能关联最近 breadcrumbs。

Breadcrumb 数量应有限制，建议以环形缓冲保存最近 50 条。错误、卡顿和慢 trace 上报时可携带相关窗口内的 breadcrumbs。

Breadcrumb 可以独立作为 `signalType = breadcrumb` 的事件进入 session timeline，也可以作为错误、卡顿或慢 trace 的相关上下文快照进入 `payload.breadcrumbs`。两种形态应使用同一字段结构，避免 DevTools 与服务端看到不同语义。

## Event Envelope

所有事件都应使用统一 envelope。

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt_001",
  "timestamp": "2026-05-24T12:00:00.000+08:00",
  "signalType": "span",
  "name": "http.client",
  "level": "info",
  "status": "ok",
  "durationMs": 523,
  "sessionId": "ses_001",
  "traceId": "trace_001",
  "spanId": "span_002",
  "parentSpanId": "span_001",
  "resource": {},
  "context": {},
  "attributes": {},
  "payload": {}
}
```

## 链路示例

### 页面加载链路

```text
trace page.load /product/detail
  span route.push
  span page.first_frame
  span http.client GET /product/{id}
  span image.decode product_cover
  span page.interactive
  breadcrumb ui.tap home_product_card
```

### 用户操作链路

```text
trace action.submit_order
  breadcrumb ui.tap submit_order_button
  span validate.form
  span http.client POST /orders
  span page.update
  error error.dart
```

### 卡顿链路

```text
trace page.load /feed
  breadcrumb route.enter /feed
  breadcrumb ui.scroll feed_list
  span http.client GET /feed
  metric ui.jank.sequence
```

这些链路示例表达的是事件之间的关系，不要求所有事件都必须同步上报为嵌套 JSON。服务端或 DevTools 可以通过 `sessionId`、`traceId`、`spanId`、`parentSpanId` 重建关系。

## 公共字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `schemaVersion` | string | 是 | 事件 schema 版本 |
| `eventId` | string | 是 | 事件唯一 ID |
| `timestamp` | string | 是 | ISO-8601 时间 |
| `signalType` | string | 是 | `trace`、`span`、`metric`、`error`、`breadcrumb`、`log`、`sdk` |
| `name` | string | 是 | 稳定事件名 |
| `level` | string | 否 | `debug`、`info`、`warning`、`error`、`fatal` |
| `status` | string | 否 | `ok`、`error`、`cancelled`、`timeout`、`unknown` |
| `durationMs` | number | 否 | 耗时类事件的持续时间 |
| `sessionId` | string | 条件必填 | 所属 session；业务事件必填，SDK 自监控和初始化前事件可缺省 |
| `traceId` | string | 否 | 所属 trace |
| `spanId` | string | 否 | 当前 span |
| `parentSpanId` | string | 否 | 父 span |
| `resource` | object | 是 | SDK、App、设备和运行环境 |
| `context` | object | 是 | 用户、页面、模块、网络、版本等上下文 |
| `attributes` | object | 否 | 可检索、可聚合的结构化字段 |
| `payload` | object | 否 | 事件特有详细数据 |

### Session 例外

普通业务事件必须携带 `sessionId`。以下事件可以没有 `sessionId`：

- SDK 初始化前捕获到的错误；
- SDK 自监控事件；
- session 创建失败时用于诊断的内部事件。

缺少 `sessionId` 时必须满足：

- `signalType = sdk`，或 `attributes.event.scope` 为 `pre_session`、`sdk_internal`；
- `context.missing = true`；
- `context.missingReason` 说明缺失原因；
- 不参与普通用户行为、页面性能和错误率聚合，除非服务端显式支持。

## Resource

`resource` 描述稳定资源信息。

```json
{
  "sdk": {
    "name": "flutter_monitor_sdk",
    "version": "1.0.0"
  },
  "app": {
    "appKey": "app_xxx",
    "appName": "Demo",
    "appVersion": "1.2.3",
    "buildNumber": "100",
    "packageName": "com.example.demo",
    "environment": "production",
    "channel": "official",
    "flavor": "prod"
  },
  "device": {
    "platform": "android",
    "model": "Pixel 7",
    "osVersion": "14",
    "isPhysicalDevice": true,
    "refreshRate": 120,
    "deviceTier": "high"
  }
}
```

## Context

`context` 描述事件发生时的动态上下文。

```json
{
  "user": {
    "userId": "user_001",
    "userType": "vip",
    "userTags": ["beta"],
    "cohort": "A"
  },
  "route": {
    "name": "/product/detail",
    "stack": ["/home", "/product/detail"],
    "source": "/home"
  },
  "module": {
    "name": "product",
    "scene": "detail"
  },
  "network": {
    "type": "wifi",
    "isWeakNetwork": false
  },
  "release": {
    "releaseId": "com.example.demo@1.2.3+100",
    "featureFlags": ["new_product_detail"]
  }
}
```

`resource.app` 是 app 版本、构建、环境、渠道和 flavor 的规范来源。`context.release` 只描述事件发生时的发布态扩展信息，例如 release id、feature flag、experiment 和 cohort，不重复存放 app version 或 build number。

## 字段注册表

常用聚合字段必须使用以下规范路径：

| 语义 | 规范路径 | 说明 |
|---|---|---|
| SDK 名称 | `resource.sdk.name` | 固定为 SDK 名称 |
| SDK 版本 | `resource.sdk.version` | SDK package 版本 |
| App Key | `resource.app.appKey` | 应用标识 |
| App 版本 | `resource.app.appVersion` | App 语义版本 |
| Build Number | `resource.app.buildNumber` | App 构建号 |
| Environment | `resource.app.environment` | `dev`、`test`、`staging`、`production` |
| Channel | `resource.app.channel` | 分发渠道 |
| Flavor | `resource.app.flavor` | Flutter flavor 或企业自定义 flavor |
| Release ID | `context.release.releaseId` | 可组合 app/package/version/build |
| Feature Flags | `context.release.featureFlags` | 事件发生时命中的 feature flags |
| User ID | `context.user.userId` | 必须支持匿名化或关闭 |
| User Cohort | `context.user.cohort` | 用户分群 |
| Route Name | `context.route.name` | 当前 route 标识 |
| Route Stack | `context.route.stack` | 当前 route stack |
| Route Source | `context.route.source` | 页面来源 |
| Module | `context.module.name` | 业务模块 |
| Scene | `context.module.scene` | 业务场景 |
| Network Type | `context.network.type` | wifi/cellular/none/unknown |
| Weak Network | `context.network.isWeakNetwork` | 弱网判断 |
| Device Tier | `resource.device.deviceTier` | high/medium/low/unknown |
| Refresh Rate | `resource.device.refreshRate` | 设备刷新率 |

新增字段前必须先判断是否已有规范路径。确需新增时，应说明字段是否可聚合、是否敏感、是否影响采样和是否需要服务端索引。

## 隐私分级

字段按隐私风险分为四类：

| 分级 | 说明 | 默认处理 |
|---|---|---|
| `safe` | SDK、版本、设备等级、稳定枚举等低风险字段 | 可进入事件和索引 |
| `queryable` | route、module、normalized URL、状态码、耗时等排查字段 | 可进入事件和索引，但应保持稳定和有限基数 |
| `sensitive` | userId、业务 ID、搜索词、地理位置、原始 URL 等可能识别用户或业务的数据 | 默认脱敏、哈希或截断，需显式配置 |
| `forbidden` | token、cookie、密码、身份证、手机号、完整地址、request/response body 等高风险数据 | 默认禁止进入事件 |

隐私策略要求：

- `attributes` 应优先使用低基数、可聚合字段。
- `payload` 可以保存排查详情，但仍必须经过脱敏。
- URL 默认只上报 normalized path，不上报 query。
- request body 和 response body 默认禁止上报。
- DevTools 展示和 session 导出必须复用 pipeline 的 privacy filtering 结果。

## 命名规则

事件名使用稳定、可聚合的点分命名：

- `app.cold_start`
- `app.hot_start`
- `page.load`
- `page.first_frame`
- `page.interactive`
- `route.enter`
- `route.leave`
- `http.client`
- `ui.tap`
- `ui.jank.sequence`
- `memory.sample`
- `error.flutter`
- `error.dart`
- `custom.trace`

不要把用户 ID、订单 ID、商品 ID 等动态值放入 `name`。动态值应进入 `attributes` 或 `payload`。

## 信号映射

### Trace

Trace 事件使用 `signalType = trace`。

必须包含：

- trace id
- trace name
- start time
- end time 或结束状态
- duration
- status
- root span id
- current route/module/context

Trace 名称必须稳定，例如 `app.cold_start`、`page.load`、`action.submit_order`、`custom.trace`。动态页面 ID、订单 ID、商品 ID 等不得进入 trace name。

### Span

Span 事件使用 `signalType = span`。

必须包含：

- trace id
- span id
- parent span id，root span 可为空
- span name
- start time
- end time 或 duration
- status
- current context snapshot

HTTP 请求、route push、first frame、interactive、image decode、list build、custom step 都应优先建模为 span。

### 错误

错误事件使用 `signalType = error`。

必须包含：

- exception type
- message
- stack
- error mechanism
- fatal
- current route/module
- recent breadcrumbs

建议包含：

- isolate 信息；
- thread/platform 信息；
- handled/unhandled；
- framework/library/context；
- app lifecycle state；
- active trace/span。

### 页面

页面相关信号应挂在页面 trace 下：

- route enter 是 breadcrumb 或 span 起点
- first frame 是 span
- interactive 是 span 或 metric
- page stay 是 metric
- route leave 是 breadcrumb 或 span 终点

页面 trace 应尽量区分：

- route push 到 first frame；
- first frame 到 interactive；
- 页面依赖 API；
- 页面渲染/构建耗时；
- 页面停留时间。

### 网络

网络请求使用 `signalType = span`、`name = http.client`。

必须包含：

- method
- normalized url
- status code
- duration
- success
- error type
- request/response size
- retry count
- cache status

完整 URL、query、body 默认不应直接上报，必须经过脱敏策略。

URL 应提供 normalized form，例如 `/api/product/{id}`，以便聚合。原始 URL 如需保留，应在脱敏后进入 payload，并受配置开关控制。

### 行为

行为信号默认作为 breadcrumb。

关键业务操作可以创建 trace，例如：

- 提交订单
- 支付
- 登录
- 搜索
- 切换核心 tab

普通点击不应制造过多 trace。只有能代表业务流程起点的行为才应创建 trace。

### 卡顿

卡顿事件使用 `ui.jank.sequence`。

必须包含：

- page/module
- jank count
- max frame duration
- average frame duration
- frame budget
- fps
- stability
- device tier
- recent frame percentiles

卡顿应关联当前 session、页面 trace 和最近 breadcrumbs。

卡顿不应只作为孤立 metric。至少应能知道发生在哪个页面/模块，前后有哪些用户操作和网络请求。

### 内存

内存信号使用 `memory.sample` 或 `memory.growth`。

必须包含：

- used memory
- growth duration
- route/module
- lifecycle state
- sample source

内存泄漏判断应谨慎表达为线索，不应在没有证据时直接宣称确定泄漏。

内存事件应优先服务于趋势和线索定位，例如页面退出后内存持续增长、连续 session 中内存水位升高等。

## 不推荐的事件形态

以下形态不应作为目标模型：

```json
{
  "category": "performance",
  "data": {
    "duration_ms": 523
  }
}
```

问题：

- 无 session；
- 无 trace/span；
- 无 route/module；
- 无 resource/context；
- 难以聚合；
- 难以与错误、卡顿、行为关联。

推荐使用统一 envelope，并把耗时类信息放入稳定 name、duration、attributes 和 context。

## 派生指标

服务端可基于事件模型派生指标：

- 页面 P50/P90/P95/P99
- API P50/P90/P95/P99
- 页面卡顿率
- 页面错误率
- session 错误率
- 影响用户数
- 低端设备卡顿率
- 弱网请求失败率
- 版本退化率
- feature flag 影响差异

派生指标应来自统一事件模型，不应要求 SDK 上报另一套独立统计结构。
