# 实施计划

## 原则

实施顺序应先稳定 workspace 边界和模型，再调整代码，再扩展能力。

阶段验收不只看“事件能发出去”，还要看“事件能否被串成链路并用于定位问题”。

重构过程中必须保留基础信号源的价值：错误、启动、页面加载、API 耗时、卡顿、用户点击、PV、页面停留都应在新模型中找到归属。任何删除都必须有替代方案和验收证明。

```mermaid
flowchart TD
  P0["Phase 0<br/>Workspace 与包边界"]
  P1["Phase 1<br/>Core schema 与事件模型"]
  P2["Phase 2<br/>SDK runtime pipeline"]
  P3["Phase 3<br/>现有 Flutter 信号接入"]
  P4["Phase 4<br/>内存 / Native bridge / 增强 lifecycle"]
  P5["Phase 5<br/>DevTools 本地诊断"]
  P6["Phase 6<br/>服务端协议与稳定性"]
  P7["Phase 7<br/>工具入口扩展"]

  P0 -->|"先确定包边界"| P1
  P1 -->|"模型与字段契约稳定后铺管线"| P2
  P2 -->|"管线可用后迁移信号"| P3
  P3 -->|"基础信号稳定后增强"| P4
  P4 -->|"统一 envelope 可被本地消费"| P5
  P4 -->|"统一 envelope 可被服务端消费"| P6
  P5 -->|"导出与诊断能力复用"| P7
  P6 -->|"协议与导出能力复用"| P7
```

阶段依赖的核心是先稳定模型和 pipeline，再迁移现有信号，最后扩展 DevTools、服务端和工具入口。

## Phase 0：Workspace 与包边界

目标：

- 将当前仓库规划为官方 Dart pub workspaces。
- 根目录作为 workspace root，不作为发布包。
- 建立三个第一阶段包边界：
  - `packages/flutter_monitor_core`
  - `packages/flutter_monitor_sdk`
  - `packages/flutter_monitor_native`
- 当前 Flutter SDK 代码未来迁入 `packages/flutter_monitor_sdk`。
- `flutter_monitor_native` 作为可选 plugin，不被主 SDK 强依赖。

验收：

- workspace root 的职责清晰：文档、CI、脚本、workspace 配置。
- `flutter_monitor_core` 是唯一 event model/schema/privacy/export schema 来源。
- `flutter_monitor_sdk` 依赖 core。
- `flutter_monitor_native` 依赖 core，并通过 bridge 与 SDK 对接。
- 文档中不再把多包作为未来待评估事项。

## Phase 1：Core Schema 与事件模型

目标：

- 在 `flutter_monitor_core` 中建立统一模型。
- 稳定 event envelope、schema version、field registry、privacy level。
- 建立唯一字段契约，覆盖 public envelope、resource、context、attributes 和 payload。
- 清理同一语义的重复字段，例如 `context.route.*` / `context.module.*`、`resource.device.deviceTier`、`context.lifecycle.*`、`context.native.platform`、`durationMs`、`payload.error.*`、`memory.native_used_mb` 等。
- 定义 session export/import 格式。
- 定义 schema validation 基础能力。
- 同步 `flutter_monitor_core` 的 `FieldPaths`、`FieldRegistry`、context/resource model、schema validation、privacy filtering 和测试。
- 稳定信号采集设计，覆盖采集来源、触发时机、链路关联和降级策略。

验收：

- 所有 signal type 都能映射到统一 event envelope。
- 字段状态、可空性、隐私等级、索引建议明确。
- 一个语义只有一个规范字段路径。
- 任何字段都明确属于 `resource`、`context`、`attributes` 或 `payload` 之一。
- 文档示例不再出现字段契约禁止的旧字段。
- `flutter_monitor_core` 中的字段常量与 `docs/event_model.md` 的唯一字段契约一致。
- 字段注册表包含所有目标字段的类型、隐私等级和索引建议。
- core 测试覆盖字段注册、字段黑名单、schema validation、privacy filtering 和主要 JSON round-trip。
- 冷启动、热启动、页面、网络、行为、卡顿、内存、native、错误、自定义 trace 均有 schema。
- `docs/signal_collection.md` 覆盖启动、页面、网络、错误、行为、卡顿、内存、生命周期、native 和自定义 trace。
- DevTools、server protocol、native package 不定义第二套模型。
- Phase 2 只允许基于统一字段契约构建 pipeline。

## Phase 2：SDK Runtime Pipeline 基础设施与兼容适配

目标：

- 在 `flutter_monitor_sdk` 中建立 runtime 基础设施：
  - raw signal；
  - context snapshot；
  - trace snapshot；
  - context manager；
  - session manager；
  - trace/span manager；
  - breadcrumb store；
  - event pipeline；
  - envelope builder；
  - outputs。
- 将 Reporter 从最终事件分发器升级为兼容入口，或用 pipeline 入口替代。
- 让旧 `Reporter.addEvent(category, data)` 调用可以进入 pipeline，但旧结构不再作为目标协议。
- 接入支撑 session 切分和 hot start 的最小 lifecycle 信号。

本阶段不要求：

- 迁移所有现有 collector；
- 完整实现 HTTP 重试、离线缓存和 remote config；
- 完整实现 DevTools 面板；
- 实现 native 深度能力；
- 移除旧公开 API。

验收：

- legacy/manual event 能生成统一 `EventEnvelope`。
- 任意业务事件至少能带 `sessionId`。
- output 消费统一 event envelope 或 envelope JSON。
- 上下文异步变化时，事件仍使用发生时的 context snapshot。
- Reporter 仍兼容旧 `category + data` 调用，但内部不再把该结构作为最终协议源。
- SDK 能记录 envelope 构建失败、事件丢弃、flush 失败等 self-monitoring 事件。
- 原 SDK example/test 继续通过。

## Phase 3：现有 Flutter 信号接入

目标：

- error 接入 event envelope。
- click/PV/page stay 接入 breadcrumb 或 metric。
- route/page load 接入 trace/span。
- cold start、hot start 接入 trace/span。
- Dio 和 `http` 请求接入 `http.client` span。
- jank 接入当前 page trace 和 breadcrumbs。
- 最小 lifecycle 事件参与 session 切分、hot start 和 exit flush。

建议迁移顺序：

1. error；
2. behavior / click / PV；
3. route / page load / page stay；
4. startup / hot start；
5. Dio / `http`；
6. jank。

验收：

- 现有功能不丢失。
- 上报结构符合 `docs/event_model.md`。
- 示例 App 能展示一条完整 session timeline。
- 启动、热启动、页面加载、API、点击、PV、页面停留、卡顿、错误、最小 lifecycle 均可在 session 中看到。
- 慢页面能关联页面 trace、相关 API 和最近 breadcrumbs。
- 卡顿能关联当前 `context.route.*` / `context.module.*`、最近行为和 `resource.device.*`。
- 错误能关联当前 `context.route.*` / `context.module.*`、active `traceId` / `spanId` 和最近 breadcrumbs。

## Phase 4：内存、Native Bridge 与增强 Lifecycle

目标：

- 接入 Flutter/Dart 可获得的 memory sample、growth、pressure 线索。
- 增强 lifecycle：foreground/background duration、exit flush 结果、异常生命周期线索。
- 定义并接入 `MonitorNativeBridge`。
- 在 `flutter_monitor_native` 中提供可选 native memory/lifecycle 基础能力。
- 预留 native crash、OOM、ANR schema 和离线缓存策略。

验收：

- memory.sample、memory.growth、memory.pressure 进入统一 envelope。
- 内存泄漏只表达为 suspect，不做缺乏证据的确定性判断。
- 增强 lifecycle 可补充 foreground/background duration、exit flush 结果和异常生命周期线索。
- native 包不绕过 pipeline 上报。
- native 信号可关联 session/trace/context；无法关联时明确 missing reason。
- 主 SDK 不因 native 能力增加强制平台配置。

## Phase 5：DevTools 本地诊断

目标：

- 写入 Flutter Timeline。
- 提供当前 session timeline。
- 提供 trace detail、event detail、context snapshot、SDK health。
- 支持本地 session export/import。
- 展示 jank、memory 和 native signals。

验收：

- 开发者能在 DevTools Performance 中看到关键 trace/span。
- QA 能导出 session payload。
- 开发者能基于导出内容查看事件顺序和详情。
- 导出的 session payload 使用统一 event envelope。
- 导出前已执行隐私过滤。
- DevTools 展示的事件与 HTTP 上报事件语义一致。
- native signals 在 DevTools 中只作为统一 envelope 展示，不单独建模。

## Phase 6：服务端协议与稳定性

目标：

- HTTP 上报使用 `docs/server_protocol.md`。
- 支持 schema version。
- 支持鉴权 headers。
- 支持重试、限流、请求大小控制。
- 支持离线缓存。
- 支持动态采样和事件优先级。
- 支持 remote config 预留。

验收：

- 服务端能校验 schema。
- SDK 能处理 2xx、4xx、413、429、5xx。
- SDK 能记录 flush 成功、失败、丢弃事件等 self-monitoring 信息。
- 服务端能按 `sessionId`、`traceId`、`context.route.name`、`context.module.name`、`resource.app.appVersion`、`resource.device.deviceTier`、`context.native.platform` 聚合。
- 服务端能基于统一事件派生启动 P95、页面 P95、API P95、卡顿率、错误率、native crash/ANR/OOM rate、内存趋势和影响用户数。
- 采样和限流不会破坏错误、native crash、OOM、关键卡顿、关键慢页面的定位链路。

## Phase 7：工具入口扩展

目标：

- 预留 CLI、MCP、独立 DevTools tooling 的包边界。
- 工具入口复用 `flutter_monitor_core`。
- 工具入口消费 session export 和 event envelope。
- `flutter_monitor_devtools` 如出现，应定位为自定义 DevTools extension/UI 包，消费 SDK bridge/export 数据，不承担 runtime 采集。

验收：

- CLI/MCP 不定义第二套 event model。
- CLI/MCP 不要求 SDK 生成另一套导出格式。
- 工具入口可以读取 DevTools export 或服务端导出的 session payload。
- workspace 包边界不需要再次推翻。

## 重构前检查清单

开始代码重构前，应确认：

- `docs/architecture.md` 中 workspace 包边界清晰。
- `docs/event_model.md` 中 envelope 字段足够支撑第一阶段代码。
- `docs/signal_collection.md` 中各类信号采集来源和降级策略清晰。
- `docs/server_protocol.md` 不要求 SDK 上报另一套结构。
- `docs/devtools_integration.md` 不要求 DevTools 使用独立模型。
- `AGENTS.md` 不包含与 workspace 目标冲突的约束。
- 每个现有信号源都有目标归属。

## 每轮重构完成检查清单

每轮重构完成后，应检查：

- 是否仍能捕获原有信号；
- 是否能生成统一 event envelope；
- 是否能关联 session；
- 是否能关联 `context.route.*` / `context.module.*`；
- 是否能携带 breadcrumbs；
- 是否能被 log/custom/http/devtools/file output 消费；
- 是否有测试或示例证明链路可还原；
- 是否没有引入新的孤立指标结构；
- 是否没有让 native、DevTools、CLI、MCP 形成第二套协议；
- 是否保持 `flutter_monitor_core` 作为唯一模型来源。
