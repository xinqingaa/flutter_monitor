# AGENTS.md

这是本仓库面向 agent 的唯一工作规范。
旧的 `CLAUDE.md` 和 `CLAUDE_CN.md` 已删除，避免多份规范长期分叉。

## 项目方向

Flutter Monitor SDK 正在从一个轻量级指标采集 SDK，演进为面向 Flutter
应用的端侧监控与链路化观测 SDK。

本项目不应继续以“不断堆叠孤立指标”为目标。指标采集是基础能力，但真正的产品价值来自于把错误、性能、网络请求、页面状态、卡顿、内存信号和用户行为连接到统一的 session/trace/context 模型中，帮助团队还原真实用户或 QA 会话中发生了什么。

目标方向是：

> 采集监控信号，将它们组织成可关联的 session 与 trace 数据，并服务于问题复现、前端诊断、DevTools 检查、服务端聚合、告警和企业质量治理。

## 当前现状

当前代码库已经具备有价值的信号源：

- `ErrorMonitor` 捕获 Flutter framework 错误和顶层 Dart 错误。
- `PerformanceMonitor` 捕获应用启动、路由/页面加载和 Dio 请求。
- `MonitoredHttpClient` 捕获通过 `http` 包发起的请求。
- `JankMonitor` 捕获 Flutter 帧时序和连续卡顿序列。
- `BehaviorMonitor` 与 `MonitoredGestureDetector` 捕获点击等简单行为事件。
- `Reporter` 为事件补充 app、user、device、platform、timestamp 和 custom data。
- `MonitorOutput` 支持日志、HTTP 和自定义输出。

这些能力原则上应该被保留。后续工作不是因为它们最初是孤立指标就移除它们，而是把它们重新组织到统一上下文中。

## 核心产品原则

1. **监控信号是输入，关联诊断是输出。**  
   错误、API 耗时、页面加载、卡顿、内存和行为事件，只有在能回答“谁受影响、在哪个页面/模块、哪个动作之后、什么设备/网络/版本上下文下、周围还发生了什么”时，才真正服务于排查。

2. **Session 与 trace 上下文是一等能力。**  
   事件后续应携带稳定标识，例如 `sessionId`、`traceId`、`spanId`、`parentSpanId`、route/module/scene 上下文和最近 breadcrumbs。不要新增无法关联回用户会话或页面/模块 trace 的事件类型。

3. **DevTools 与服务端分析职责不同。**  
   DevTools 集成应帮助开发者和 QA 在本地检查当前会话或复现会话。服务端接入应支持历史数据、聚合、趋势分析、告警、版本对比和影响用户分析。两者应共享同一套事件模型，而不是形成两套不兼容的数据结构。

4. **协议稳定先于功能扩张。**  
   上报协议应先定义 schema version、event envelope、事件身份、session/trace 身份、resource metadata、context、attributes、payload、隐私行为和兼容策略，再继续大量新增指标。

5. **面向企业真实场景。**  
   设计时要考虑 QA 复现、用户反馈说不清页面、release/channel/flavor 分析、feature flag、设备等级、弱网、隐私约束、采样、限流、离线缓存、重试和 SDK 自监控。

## 目标架构方向

按四层思考：

- **信号采集层**：error、launch、page、route、API、jank、memory、lifecycle、behavior 和 custom trace 信号。
- **上下文层**：session、route stack、module、scene、user、device、OS、network、release、build、channel、feature flags 和 breadcrumbs。
- **Pipeline 层**：event envelope 构建、schema 校验、采样、隐私过滤、批量、优先级、重试、离线缓存和 output 分发。
- **消费层**：console log、HTTP/backend ingestion、DevTools timeline、DevTools extension panel、本地导出/导入，以及未来可能的 OpenTelemetry-compatible output。

## 文档方向

当前根目录文档和旧 docs 可能描述的是项目早期阶段。除非已经在新方向下重写，否则应将它们视为历史参考。

重要文档应统一收敛到 `docs/`。

计划中的文档结构：

- `docs/background.md`：产品背景、当前现状和迁移方向。
- `docs/event_model.md`：session、trace、span、breadcrumb、metric、error、log、context 和 event envelope 模型。
- `docs/server_protocol.md`：上报 API、schema version、鉴权、错误响应、兼容策略和服务端预期。
- `docs/devtools_integration.md`：Flutter Timeline 集成、DevTools extension 目标、本地 session 导出/导入、本地与服务端边界。
- `docs/architecture.md`：链路化迁移后的 SDK 架构。
- `docs/roadmap.md`：分阶段实施计划。

更新 README 时，应把 README 作为入口文档。详细设计放在 `docs/`，避免 README 变成架构唯一事实源。

## 开发命令

- `flutter pub get` - 安装依赖。
- `flutter test` - 运行 package 测试。
- `flutter analyze` - 运行静态分析。
- `cd example && flutter pub get && flutter run` - 运行示例应用。
- `cd example && flutter test` - 运行 example 测试。

当前 package 测试覆盖非常少。测试通过不代表 SDK 已经达到生产可用状态。

## 现有代码说明

- `lib/flutter_monitor_sdk.dart` 中的 `FlutterMonitorSDK` 是公开门面。
- `MonitorBinding` 协调模块生命周期。
- `Reporter` 当前负责补充上下文并分发松散的 `category + data` map。后续应演进为 event envelope builder 和 pipeline coordinator。
- `HttpOutput` 当前上报 `{"events": [...]}`，但尚未实现目标协议所需的稳定 headers、鉴权、隐私过滤、离线缓存或健壮重试语义。
- `node_server/` 是 mock receiver，不是目标服务端架构。
- 当前源码树仍存在历史遗留的 `lib/src/utIls/` 目录，而代码和文档中使用的是 `lib/src/utils/`。这应在代码清理阶段修复，但不要混入纯文档变更中。

## 实现指导

- 优先渐进迁移。在改进结构的同时保留已有公开价值。
- 不要因为某个信号当前事件结构松散就直接移除它。应先定义它如何映射到未来的 session/trace 模型。
- 事件命名应稳定、明确。能归入 event envelope 或 attributes 的共享语义，不要让各模块随意定义临时字段名。
- 任何新增监控信号，都应说明它如何帮助诊断真实用户、QA、页面/模块、版本或设备/网络问题。
- 任何新增服务端字段，都应考虑隐私、采样、兼容和聚合。
- 任何新增 DevTools 能力，都应服务于本地复现或主动性能优化，而不是简单复制服务端 dashboard。

## 校验预期

纯文档变更应检查引用和结构。代码变更应运行 `flutter analyze` 和相关测试。如果某项测试无法运行或已经失败，应明确说明原因。
