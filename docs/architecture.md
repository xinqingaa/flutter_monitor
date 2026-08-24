# 当前架构

## 架构原则

Flutter Monitor 是一个 Dart pub workspace。根目录负责组织文档、脚本和检查，实际能力拆分在三个 Dart/Flutter package 与一个 JS/TS platform workspace 中。

架构遵守四条主线：

1. `flutter_monitor_core` 是唯一事件模型和字段事实源。
2. 所有 Flutter 与 native 信号都先进入 SDK pipeline，再生成 `EventEnvelope`。
3. 输出、服务端摘要和 Workbench view model 都只能消费 envelope，不能反向改写事件事实。
4. 未实现的 DevTools、CLI、MCP、生产治理能力只能复用当前模型，不能创建第二套协议。

![Flutter Monitor V2 数据采集与上报链路](image/03-v2-data-collection-reporting.png)

## Workspace 布局

```text
flutter_monitor/
  docs/                         项目背景、架构、模型、采集与协议
  packages/
    flutter_monitor_core/       Dart-only 模型核心
    flutter_monitor_sdk/        Flutter runtime SDK
      example/                  PulseFit 接入示例
    flutter_monitor_native/     可选 Android/iOS native bridge
  platform/
    docs/                       Workbench 与 Platform 文档
    shared/                     TypeScript wire mirror
    services/monitor-service/   NestJS + SQLite Monitor Service
    web/                        React/Vite Workbench
  scripts/                      workspace、Platform 和 example 脚本
  AGENTS.md                     项目方向与硬约束
  SKILL.md                      仓库变更工作流
```

依赖方向：

```text
flutter_monitor_core
  <- flutter_monitor_sdk
  <- flutter_monitor_native

EventEnvelope
  -> Monitor Service
  -> Workbench
```

`flutter_monitor_native` 在 Dart 层复用 core 类型并实现 SDK 定义的 bridge 接口；它不独立上报。Platform 通过 TypeScript 类型镜像消费 wire JSON，但不反向成为 Dart schema 来源。

## `flutter_monitor_core`

`packages/flutter_monitor_core` 不依赖 Flutter，负责稳定的数据和协议约定：

- `EventEnvelope`、breadcrumb、trace context、resource、context；
- signal type、event status、level、priority 等 wire enum；
- `FieldPaths`、`PayloadKeys`、协议常量和事件名；
- field registry、schema version 和 schema validation；
- privacy rule、privacy filter；
- retention registry；
- event summary、compact log；
- `SessionExport` 数据结构。

core 不负责采集、网络、文件、platform channel 或 UI。`SessionExport` 当前只是共享数据契约，SDK 尚未提供完整的 session 导出/导入工作流。

## `flutter_monitor_sdk`

`packages/flutter_monitor_sdk` 是业务接入的主 package。当前源码按职责分为：

```text
lib/src/
  context/       动态上下文与发生时快照
  core/          MonitorBinding、Reporter、MonitorConfig
  delivery/      离线队列、可靠 HTTP、降级与 SDK health
  lifecycle/     Flutter lifecycle 与 session 恢复
  modules/       error_monitor、performance_monitor（page/route）、
                 frame_window_collector、frame_timing_dispatcher、
                 jank_monitor、memory_collector、interaction_measure_collector
  native/        bridge 抽象、controller、signal mapper
  outputs/       output 接口、日志输出与模式解析
  pipeline/      RawSignal、EnvelopeBuilder、validation/control/aggregator
  startup/       冷启动与 SDK init trace
  tracing/       session、trace/span、breadcrumb
  utils/         Dio/http、页面包装、HTTP 详情和辅助工具
```

业务公开 API 只通过 `FlutterMonitorSDK` 暴露：

- `isInitialized`；
- `init(...)`；
- `routeObserver`、`markPageRendered(...)`；
- `createDioInterceptor()`、`createHttpClient()`；
- `setContext(...)`、`clearContext(...)`；
- `track(...)`、`recordError(...)`；
- 显式开启后的 `measure(...)`；
- `flush(...)`、`dispose()`。

barrel 还导出接入辅助类型，例如 `MonitorConfig`、`MonitorMode`、`MonitorSignalConfig`、`AppInfo`、`MonitorInitialContext`、`MonitorContextScope`、`MonitorMeasureHandle`、`LogMonitorOutputMode`、`MonitorNativeBridge`、`PageRenderMonitor`、`MonitorPageScope` 和 `PerformanceUtils`。它们不是第二套事件模型。

`MonitorBinding`、`Reporter`、`RawSignal`、`FieldPaths`、手动 trace/span 和任意 attributes/payload 不属于普通业务接入面。

## 运行时数据流

```text
Flutter callback / HTTP wrapper / Native bridge
  -> RawSignal
  -> ContextSnapshot
  -> TraceSnapshot
  -> EnvelopeBuilder
  -> SchemaValidator
  -> PrivacyFilter
  -> Breadcrumb / Aggregation / PipelineControl
  -> MonitorOutput
```

关键规则：

- 异步事件在开始时冻结 route、context 和 trace 归属，完成时不重新绑定当前页面。
- collector 不直接构建最终 JSON，也不直接调用网络 output。
- schema validation 和 privacy filter 在事件进入输出前完成。
- production 的采样、限流和聚合由 pipeline control 统一执行。
- raw `EventEnvelope` 是事实源；summary 和 compact log 都是派生结果。
- SDK 自身的 enqueue、retry、drop、flush failure 进入统一 `sdk.*` 事件或 health summary。

## 分层设计

### Core 模型层

`flutter_monitor_core` 是所有包共享的协议核心，负责：

- `EventEnvelope`、session、trace、span、breadcrumb、resource、context、attributes 和 payload 模型；
- `signalType`、level、status、priority 等 wire enum；
- `FieldPaths`、`PayloadKeys`、字段注册表、schema version 和 schema validation；
- privacy level、脱敏规则、字段裁剪和 retention registry；
- event summary、compact log 和 `SessionExport` 数据结构；
- 与 Flutter runtime 无关的序列化和协议工具。

core 不负责 Flutter、platform channel、Dio/http instrumentation、文件、网络或 UI。`attributes` 的稳定字段必须来自 field registry；未注册的诊断详情只能进入经过隐私过滤和大小裁剪的 `payload`，不得成为服务端索引字段。

### Context 层

SDK 的 `ContextManager` 负责维护可变上下文，并在事件生成时形成不可变 `ContextSnapshot`。core 中的数据模型包括 `UserContext`、`RouteContext`、`ModuleContext`、`NetworkContext`、`ReleaseContext`、`LifecycleContext` 和 `NativeRuntimeContext`。没有独立的 ResourceProvider / UserContextController 等类；App、设备、runtime 等稳定信息由 `ContextManager` 写入 `MonitorResource`。

登录、登出、路由或网络变化只影响后续事件，不得改写已经捕获的事件。异步 HTTP 或页面事件应在开始时冻结 owner route、trace 和 context，完成时只追加 completion context。

### Trace 层

`SessionManager`、`TraceManager`、`BreadcrumbStore` 和 `utils/IdGenerator` 共同维护链路关系：

- session 是绝大多数业务事件的最小归属单位；
- cold start、hot start、page visit、关键 action 和自定义业务流程优先建模为 trace；
- route、page load、first frame、HTTP request、image decode、list build 和 custom step 建模为 span；
- breadcrumbs 使用环形缓冲，错误、失败 HTTP、慢 trace、jank 和 native warning 携带相关窗口；
- breadcrumb 快照优先选择同一 trace 或 route 的足迹，再补充最近的全局关键足迹，并裁剪 stacktrace 和嵌套 payload。

### Collector 层

Flutter runtime collector 包括 error、launch、route/page、network、business track、jank、memory 和 lifecycle。SDK **不自动采集** 点击或滚动；也没有公开的 `startTrace` / `startSpan` API。业务动作只通过 `FlutterMonitorSDK.track` 进入 pipeline，显式开启后才有 `measure`。Native plugin 提供 resource、memory、memory pressure 和 lifecycle raw signal；crash、OOM、ANR 当前只有 schema 与 mapper 边界。

采集器只捕获事实并输出 `RawSignal`，不构造最终 JSON，不执行采样、重试、隐私过滤或直接调用 output。所有 native signal 必须由 SDK mapper 转为 `RawSignal` 后进入同一 pipeline。

### Pipeline 层

`EventPipeline`、`EnvelopeBuilder`、`SchemaValidator`、`PrivacyFilter`、采样/限流控制、聚合器、队列、重试调度器和 `SdkHealthMonitor` 共同组成运行时管线：

- schema validation 和 privacy filtering 发生在 output、离线存储和日志之前；
- 高优先级错误和 SDK health 事件不能被普通低优先级批处理长期阻塞；
- 单个 raw signal 默认只生成一条主事件，聚合摘要必须能回查原始事件；
- 队列只保存完成隐私处理的 envelope JSON；
- pipeline 自身的 enqueue、retry、drop、flush failure 通过 `sdk.*` 事件或 health summary 记录。

### Output 层

普通业务只使用三种 public mode：

| Mode | 当前职责 |
|---|---|
| `consoleOnly` | `LogMonitorOutput` 输出 compact、quiet、json 或 silent 日志 |
| `localLive` | 小 batch 写入本地 Monitor Service，供 Workbench 实时排查 |
| `production` | SQLite offline queue、batch、retry、TTL、优先级驱逐和 SDK health |

Output 只能消费已经构建并脱敏的 `EventEnvelope`，不能修改事件语义、重新读取 collector 原始数据或各自监听 App lifecycle。当前没有 DevTools、文件或 OpenTelemetry output；未来实现时必须复用本文件和 `docs/devtools_integration.md` 定义的模型。

## Context 与链路

`ContextManager` 保存 SDK 当前已知的 resource 和动态 context。每个事件生成时捕获快照，避免后续登录、路由、网络或 lifecycle 变化污染已经发生的事件。

链路层由以下组件维护：

- `SessionManager`：管理一次 App 活动窗口及后台超时切分；
- `TraceManager`：管理 trace/span 记录和 active 链路；
- `BreadcrumbStore`：保留最近关键操作和诊断足迹；
- `TraceSnapshot`：将事件发生时的链路关系交给 pipeline。

页面 trace 是默认页面主线。HTTP 请求归属调用时页面；跨页完成只记录 completion context，不改变 owner route。

## 采集层

默认启用的高确定性主链路：

- Flutter framework 和 Dart uncaught error；
- 冷启动、热启动、SDK init 和 lifecycle；
- 页面、路由、页面加载与停留；
- Dio interceptor 与 `http.Client` wrapper；
- 业务 `track`。

默认关闭的诊断信号：

- frame stats；
- jank；
- RSS memory；
- interaction measure；
- native bridge。

是否启动这些诊断 collector 由 `MonitorSignalConfig` 决定。输出模式不替代采集开关。

## 输出与可靠投递

public 输出模式只有三种：

| 模式 | 当前实现 |
|---|---|
| `consoleOnly` | `LogMonitorOutput` 输出 compact/quiet/json/silent log |
| `localLive` | `ReliableHttpOutput` 小 batch 写入本地 Monitor Service |
| `production` | SQLite offline queue、batch、retry、TTL、优先级驱逐和 SDK health |

可靠投递的核心组件位于 `delivery/`：

- `SqliteOfflineEventQueue`，不可用时可降级为 `MemoryOfflineEventQueue`；
- `ReliableHttpOutput`；
- `queue_degradation.dart` / `QueueDegradationResult`；
- `SdkHealthMonitor`。

队列只保存经过 schema validation 和 privacy filter 的 envelope。HTTP 响应处理、重试和 drop 语义见 `docs/server_protocol.md`。

当前没有 `DevToolsOutput`、文件输出或 OpenTelemetry output。未来如增加，只能消费同一 `EventEnvelope`。

## Native Bridge

`flutter_monitor_native` 是可选插件。当前 Android/iOS 实现提供：

- native resource snapshot；
- native memory snapshot；
- memory pressure / low memory warning；
- native lifecycle callback。

SDK 通过 `MonitorNativeBridge` 抽象使用 MethodChannel 和 EventChannel：

```text
Android / iOS callback
  -> FlutterMonitorNativeBridge
  -> NativeBridgeController
  -> NativeSignalMapper
  -> RawSignal
  -> EventPipeline
```

未配置 bridge 时使用 no-op 路径，默认 Flutter 主链路不受影响。core 和 mapper 已为 native crash、OOM、ANR 定义事件边界，但当前 Android/iOS plugin 没有可靠捕获实现，不能把这些能力列为已完成。

Native bridge 的稳定约束如下：

- SDK 只依赖 `MonitorNativeBridge` 抽象，不强依赖 native plugin；
- MethodChannel 用于请求 resource/memory snapshot，EventChannel 用于异步 native signal；未来如改用 Pigeon，不得改变 envelope 或服务端协议；
- 配置 bridge 时，SDK 在 bootstrap resource resolve 阶段以短 deadline 获取一次 resource snapshot，失败时降级为 `context.native.available = false`；
- native plugin 只提供平台事实，不创建第二套 session、trace、字段注册、HTTP output 或上传队列；
- native signal 的标准字段映射发生在 SDK mapper/pipeline，平台原始证据保存在受控的 `payload.native`；
- 异常生命周期拿不到完整上下文时，必须保留 missing reason 或可补全的 raw signal，不得伪造完整 envelope。

Native bridge 允许扩展 OOM、ANR 和 crash 的 bridge 入口，但在实际捕获能力落地前，文档、Workbench 和服务端都只能将它们标记为预留信号。

## Platform

`platform` 是 EventEnvelope 的消费层：

- Monitor Service 接收单条或批量 envelope，保存 raw JSON 并建立 SQLite 索引；
- query API 返回 recent、Catalog、Session、Trace、Analytics、Performance 等派生视图；
- SSE 通知 Workbench 失效查询缓存；
- Workbench 用 URL scope、Catalog、详情和 Session 工作区完成排查；
- 所有摘要都应携带可用的 `eventId`、`sessionId`、`traceId` 以回查 raw envelope。

Platform 的具体职责和 API 边界见 `platform/docs/architecture.md` 与 `platform/services/monitor-service/docs/boundaries.md`。

## 未实现边界

以下内容不属于当前代码能力：

- Flutter DevTools extension、Timeline writer 和 SDK DevTools bridge；
- 完整 session export/import UI 与运行时工作流；
- CLI、MCP；
- 可靠 native crash、OOM、ANR 捕获；
- remote config 下发闭环；
- 多租户、权限、告警、长期冷热存储和生产运维平台。

这些能力未来如实现，必须复用 core schema 和现有服务端协议边界。

## 禁止事项

- 不得在 SDK、native、Service 或 Workbench 中定义第二套事件模型。
- 不得让 collector 或 native plugin 绕过 SDK pipeline 直接上报。
- 不得把 query summary 或 UI view model 写回 raw envelope。
- 不得在事件完成时用当前页面覆盖事件开始时的归属。
- 不得在缺少证据时把 memory growth 表述为确定泄漏。
- 不得把预留 schema 写成已经落地的采集能力。
