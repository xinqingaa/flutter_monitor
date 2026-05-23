# 背景与方向

## 目的

本文档记录 Flutter Monitor SDK 的产品背景、当前阶段和迁移方向。

项目不是要放弃指标采集。指标采集是基础能力。迁移方向是把这些指标和事件组织进可关联的 session/trace/context 模型中，让它们能支持真实问题诊断，而不是停留在孤立数据点。

## 当前阶段

当前 SDK 更接近一个轻量级监控与指标采集 SDK。它已经可以采集几类有价值的信号：

- Flutter framework 错误和顶层 Dart 错误；
- 应用启动耗时和页面加载耗时；
- Dio 与 `http` 请求耗时和状态；
- 路由 PV 和页面停留时长；
- 通过 `MonitoredGestureDetector` 采集的关键用户行为；
- 基于 Flutter frame timing 的 UI 连续卡顿序列；
- app、user、device、platform、timestamp 和 custom context 补充；
- log、HTTP 和 custom output。

这些能力有价值，应该被保留。当前问题在于它们大多被组织成相互独立的 `category + data` 事件。这样可以知道“有事发生了”，但很难还原“事情是怎么发生的”。

例如，一条卡顿事件可以说明发生了几帧慢帧，但还不能稳定回答：它属于哪个用户 session，当时在哪个页面或业务模块，卡顿前用户做了什么，哪些 API 请求与它重叠，当时的 release/channel/device/network 上下文是什么，后面是否跟着相关错误。

## 为什么迁移

真实企业排查很少从一个干净的指标名开始。它通常来自不完整的人类反馈：

- QA 说某个页面很慢，但说不清完整 route stack。
- 用户说 App 卡住了，但不知道页面名或模块名。
- 某个版本页面性能变差，但团队不知道原因是渲染、网络、数据解析、图片、设备等级还是 feature flag。
- 崩溃报告有堆栈，但缺少崩溃前的用户动作和网络事件。
- 一次优化看起来降低了平均耗时，但团队无法判断低端设备或弱网用户是否真的改善。

孤立指标适合做 dashboard。可关联的 session 与 trace 数据适合做调查。

因此 SDK 应向链路化监控模型演进：

```text
指标采集器
  -> 监控 SDK
    -> 链路化监控 SDK
      -> Flutter 端侧观测基础设施
```

## 产品定位

推荐定位：

> Flutter Monitor SDK 是一个面向 Flutter 应用的端侧监控与链路化观测 SDK。它采集错误、性能、网络、页面、行为、卡顿、内存、生命周期和自定义信号，并通过 session、trace、route/module、user、device、release 和 breadcrumb 上下文把这些信号关联起来，帮助团队复现、诊断、聚合和治理 App 质量问题。

这个定位保留了监控职责。真正变化的是组织模型：采集到的信号应该进入可诊断的时间线，而不是停留为互相独立的事件。

## 核心价值

SDK 应帮助前端团队回答实际排查问题：

- 谁受到了影响？
- 涉及哪个 app version、build、flavor、channel、feature flag、设备等级、OS 和网络？
- 当时在哪个页面、模块、场景、route stack 或 tab？
- 用户或 QA 在问题发生前做了什么？
- 哪些 API 请求开始、失败、重试或与问题重叠？
- 问题发生在启动、路由切换、首帧、页面可交互、滚动、渲染、图片解码、数据解析，还是某段自定义业务 trace 中？
- 是否有关联的卡顿序列、内存增长、生命周期切换或错误？
- 这个问题只发生在某个用户/session，还是能在服务端按版本、页面、设备、渠道和用户分群聚合看到？

SDK 的价值不只是上报某个指标变差。它的价值是帮助开发者足够快地还原现场并采取行动。

## 目标诊断模型

未来模型应让一次用户会话可以被查看为时间线：

```text
session_abc
  app.cold_start
  route.enter /home
  action.tap home_banner
  http.client GET /campaign
  route.enter /product/detail
  page.load /product/detail
  http.client GET /product/{id}
  ui.jank.sequence /product/detail
  error NoSuchMethodError
  route.leave /product/detail
```

每个事件后续都应能挂载到共享上下文：

- `sessionId`
- `traceId`
- `spanId`
- `parentSpanId`
- route、route stack、module、scene 和业务属性
- user 与 cohort 属性
- app version、build number、environment、flavor、channel 和 feature flags
- device、OS、refresh rate、device tier、memory/network 属性
- 最近 breadcrumbs

这个模型可以把页面性能、API 耗时、用户行为、卡顿和错误作为一个故事来排查。

## DevTools 与服务端分工

DevTools 集成和服务端上报应共享同一套事件模型，但服务于不同场景。

DevTools 应聚焦开发和 QA 复现：

- 在 Flutter Timeline/Performance 视图中标记 SDK 事件；
- 展示当前 session timeline；
- 暴露 page/API/action/jank/error 详情，帮助本地诊断；
- 展示当前 route/module/user/device/release 上下文；
- 支持导出和导入本地 session payload，便于 QA 转交开发。

服务端上报应聚焦历史和聚合分析：

- page 与 API 的 P50/P90/P95/P99；
- jank rate、error rate、crash/session impact 和 affected users；
- release、channel、feature flag、device、OS、network 和 user cohort 维度；
- 告警和性能退化检测；
- 优化前后对比；
- 长期 App 质量治理。

DevTools 回答“这次复现发生了什么”。服务端回答“这件事发生了多少次、影响了谁、是否正在变差”。

## 协议方向

当前松散事件结构适合早期开发，但未来面向服务端的事件应使用带 schema version 的稳定 envelope。

未来 event envelope 应包含类似概念：

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt_001",
  "timestamp": "2026-05-23T12:00:00.000Z",
  "sessionId": "ses_abc",
  "traceId": "trace_page_product_detail",
  "spanId": "span_http_product",
  "parentSpanId": "span_page_product_detail",
  "signalType": "trace",
  "name": "http.client",
  "durationMs": 523,
  "resource": {},
  "context": {},
  "attributes": {},
  "payload": {}
}
```

项目可以借鉴 OpenTelemetry 对 traces、metrics、logs 的分层方式，但不需要一开始就完整实现 OTLP。近期目标是先形成稳定的 SDK 协议，让它未来可以干净地映射到服务端存储、分析、DevTools 或 OpenTelemetry-compatible output。

## 企业化要求

为了真正适用于企业 Flutter 应用，SDK 后续应考虑：

- 隐私过滤和敏感字段脱敏；
- 可配置采样和限流；
- 事件优先级和背压；
- 离线缓存和重试；
- SDK 版本之间的 schema 兼容；
- SDK 自监控，例如丢弃事件数量和 flush 失败次数；
- release、environment、flavor、channel 和 feature flag 维度；
- 即使用户无法描述页面，也能通过 route/module/scene 归因；
- QA 转交开发的排查工作流；
- 服务端协议校验和鉴权。

这些要求即使不在第一阶段全部实现，也应尽早影响事件模型设计。

## 迁移原则

1. 保留现有信号源，除非已经有明确替代方案。
2. 围绕 session、trace、route/module context 和 breadcrumbs 重组事件。
3. 先定义协议和事件模型，再大量新增指标。
4. DevTools 与服务端消费应共享同一套数据形态。
5. 采用渐进式迁移，保证 SDK 在迁移过程中仍然可用。
6. 旧文档在新方向下重写前，应视为历史参考。

## 建议文档路线

文档应分层重建：

1. `docs/background.md` - 本文档，说明项目为什么改变方向。
2. `docs/event_model.md` - 定义 session、trace、span、breadcrumb、metric、log、error、resource、context、attributes 和 payload。
3. `docs/server_protocol.md` - 定义服务端接入 API、headers、schema version、鉴权、错误、重试预期和兼容策略。
4. `docs/devtools_integration.md` - 定义 Flutter Timeline 使用方式、DevTools extension 设计、本地 session 导出/导入、本地与服务端边界。
5. `docs/architecture.md` - 定义未来 SDK 模块架构，以及从当前实现迁移过去的路径。
6. `docs/roadmap.md` - 定义分阶段实施计划。

这些文档稳定后，再将 README 重写为清晰的产品入口。
