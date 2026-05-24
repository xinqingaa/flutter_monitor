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

### 隐私默认安全

URL query、request body、response body、token、手机号、身份证、地址等数据默认不进入事件。确需上报时必须经过显式配置和脱敏策略。

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

## Event Envelope

所有事件都应使用统一 envelope。

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt_001",
  "timestamp": "2026-05-24T12:00:00.000+08:00",
  "signalType": "trace",
  "name": "http.client",
  "level": "info",
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
| `signalType` | string | 是 | `trace`、`metric`、`error`、`breadcrumb`、`log` |
| `name` | string | 是 | 稳定事件名 |
| `level` | string | 否 | `debug`、`info`、`warning`、`error`、`fatal` |
| `durationMs` | number | 否 | 耗时类事件的持续时间 |
| `sessionId` | string | 是 | 所属 session |
| `traceId` | string | 否 | 所属 trace |
| `spanId` | string | 否 | 当前 span |
| `parentSpanId` | string | 否 | 父 span |
| `resource` | object | 是 | SDK、App、设备和运行环境 |
| `context` | object | 是 | 用户、页面、模块、网络、版本等上下文 |
| `attributes` | object | 否 | 可检索、可聚合的结构化字段 |
| `payload` | object | 否 | 事件特有详细数据 |

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
    "version": "1.2.3",
    "buildNumber": "100",
    "featureFlags": ["new_product_detail"]
  }
}
```

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

网络请求使用 `http.client` span。

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
