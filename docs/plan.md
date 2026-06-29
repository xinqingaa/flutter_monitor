# Flutter Monitor 收敛计划

## 当前结论

Flutter Monitor 当前已经具备作为 Flutter-only 端侧监控 workspace 使用的基础闭环，可以进入收敛发布阶段。

本次收敛不再维护 Phase 0-8 式长期路线图，也不再把暂缓能力列为近期优先级。后续文档只保留两类事实：

- 已完成：当前已经落地、可以被 SDK、Monitor Service 和 Workbench 使用的能力。
- 未完成：发布版暂不承诺、暂缓或只保留实验边界的能力。

发布口径应保持克制：

- 可以用于本地开发、QA 复现、内部灰度和 Flutter-only 生产接入验证。
- 不宣称已经完成完整 APM 平台、企业级多租户治理、完整 DevTools extension、可靠 native crash/OOM/ANR 捕获或自动根因分析。
- raw `EventEnvelope` 仍是唯一事实源；Workbench、service、compact log、summary 和后续 evidence 都只能作为派生视图。

## 支持范围

当前版本支持以下使用方式：

- `consoleOnly`：本地开发中输出 compact 或 full log。
- `localLive`：本地或 QA 复现时批量写入 Monitor Service，并在 Workbench 中查看 session timeline、event detail 和 raw JSON。
- `production`：内部灰度或小范围真实 App 验证时使用 SDK 队列、batch、retry、采样、限流、优先级和 self-monitoring。

当前版本适合回答：

- 一次 session 中发生了哪些页面跳转、请求、行为、错误、卡顿、内存线索和生命周期变化。
- 某个错误、失败请求、慢请求或卡顿发生在哪个页面、哪个 trace、哪个 span 和哪些 breadcrumbs 之后。
- SDK 自身是否出现队列丢弃、flush 失败、重试、限流、采样或 payload 过大等可靠性问题。
- QA 或开发能否通过 `sessionId`、`eventId`、`traceId`、route、user context 和时间范围回查 raw envelope。

当前版本不适合作为以下能力的完成声明：

- 完整线上 APM、告警、长期趋势治理和企业质量平台。
- 可靠 native crash、OOM、ANR 捕获。
- 对象级内存泄漏定位。
- WebSocket/SSE 长链接消息级监控。
- 自动根因分析或自动修复。
- 完整 DevTools extension / Timeline 面板。

## 已完成

### Workspace 与模型边界

- 根目录作为 workspace root，承载文档、CI、脚本和 workspace 配置。
- `packages/flutter_monitor_core` 作为唯一事件模型、字段注册、privacy、summary 和 export 来源。
- `packages/flutter_monitor_sdk` 作为 Flutter runtime 主 SDK，负责采集、context、session、trace/span、pipeline、outputs 和业务 API。
- `packages/flutter_monitor_native` 保留为可选增强层，不作为 Flutter-only 基础接入前置条件。
- `platform` 作为 JS/TS 消费层，承载 Monitor Service、Workbench Web 和共享 TypeScript 层。
- DevTools、CLI、MCP、native 和服务端不定义第二套事件模型或导出协议。

### Core 事件模型

- 统一 `EventEnvelope`、schema version、event id、session/trace/span/breadcrumb/context/resource/attributes/payload 分层已经落地。
- 字段路径、协议常量、字段注册、隐私等级、索引建议和 summary 规则集中在 core。
- 事件 summary / compact log 是 envelope 的派生视图，不反向成为协议。
- 隐私过滤、字段黑名单、schema validation、JSON round-trip 和主要常量测试已经建立。
- 启动、页面、HTTP、错误、行为、交互、卡顿、内存、生命周期、native 预留和自定义 trace 都有统一建模口径。

### SDK Runtime Pipeline

- SDK 已建立 raw signal -> context snapshot -> trace snapshot -> envelope -> validation -> privacy -> breadcrumb -> output 的主流程。
- Reporter 已收敛为 SDK 内部 pipeline 入口。
- 业务主动埋点通过 `FlutterMonitorSDK.track(...)`，交互性能通过 `FlutterMonitorSDK.measure(...)`。
- SDK 支持 session manager、trace/span manager、breadcrumb store、context manager 和 event pipeline。
- 事件发生时使用当时的 context/trace snapshot，避免异步完成时错误吞掉当前页面上下文。
- HTTP 请求归属已收敛为“发起页”为主线；如果未来出现跨页完成，只把响应页记录到 `http.completion.*` 诊断字段。

### Flutter-only 信号采集

- 启动：`app.cold_start`、`app.hot_start`、`sdk.init`。
- 页面：`page.visit`、`page.load`、`page.stay`、`page.view`、route push/pop/resume。
- 网络：Dio 和 `http.Client` 的 `http.client` span，包含耗时、状态、错误、请求归属和 breadcrumbs。
- 错误：Flutter framework error、Dart uncaught error、业务主动 `recordError`。
- 行为：`track` 进入标准业务 action 事件和 breadcrumb store。
- 交互性能：`measure` 支持普通交互点和阶段型交互窗口。
- 卡顿：`ui.jank.sequence` 可关联 route、page trace、frame summary 和 breadcrumbs。
- 内存：基础 RSS sample、growth、pressure/suspect 线索和页面/启动边界 memory delta。
- 生命周期：前后台切换、foreground/background duration、hot start、exit flush 证据。

### 生产接入可靠性

- 对外输出模式收敛为 `consoleOnly`、`localLive`、`production`。
- `MonitorProductionPolicy` 统一配置队列、batch、retry、采样、限流、flush 和优先级。
- production 下支持 SQLite 离线队列、batch 发送、退避重试、TTL、retry 上限、优先级驱逐和退出前 flush。
- 队列满、采样、限流、payload 裁剪、不可重试拒绝、事件过期、flush 失败等场景会产生 SDK self-monitoring 证据。
- 高价值事件优先保留，低价值高频事件可按策略采样或限流。
- 服务不可用、弱网、超时、429、5xx 等场景不会阻塞 App 主流程。

### Monitor Service 与 Workbench

- Monitor Service 支持 batch ingest、raw envelope 存储、recent、session、trace、event、dimensions、search、performance overview 和 SSE live。
- Workbench 支持 session list、session timeline、页面区段、HTTP、错误、卡顿、SDK 活动、event detail 和 raw JSON 回查。
- Workbench 只消费统一 envelope，不补写 SDK 字段，不成为第二套协议。
- 可通过 `eventId`、`sessionId`、`traceId` 回查完整事件。
- 页面链路以 route/page 事件为主线，HTTP 等异步事件不应改变页面主线顺序。
- SDK self-monitoring 在 Workbench 中按 SDK 可靠性事件展示，不再混入未知页面。

### Example 与验证

- example 已覆盖启动页、tab、二级页、登录/注册、视频、弹层、API、交互性能、卡顿和内存场景。
- 已跑通 core 单测、SDK 单测和 platform TypeScript 检查。
- 已使用 Workbench raw API 和 session console 多次验证 session timeline、HTTP 归属、raw JSON 回查和 SDK self-monitoring。
- 已验证最新会话中没有复现“HTTP 响应完成页覆盖请求发起页”的旧问题。

## 未完成

以下能力不进入当前收敛发布承诺。它们可以作为已知限制、后续 backlog 或实验能力保留，但不再作为当前发布前必须完成的优先级。

### Native 增强

- `flutter_monitor_native` 仍是可选/实验边界。
- native memory、memory pressure、native lifecycle 可作为增强方向，但不作为 Flutter-only 接入前置条件。
- native crash、OOM、ANR 只保留 schema、字段和 bridge 方向，不宣称可靠捕获。
- 未接入 native 时，SDK 必须保持 Flutter-only 正常运行。

### DevTools、CLI 与 MCP

- 完整 DevTools extension、Flutter Timeline 面板、session export/import UI 暂缓。
- CLI、MCP、独立 DevTools tooling 暂缓。
- 后续如继续实现，只能消费 core envelope/export 或 Monitor Service API，不能创建第二套模型。

### Remote Config

- 当前采样、限流、HTTP 采集深度、队列、batch、flush 和 retry 主要来自本地初始化配置。
- remote config / kill switch 的服务端接口和配置下发闭环暂未作为发布必备能力完成。
- 若真实 App 灰度需要远程开关，应在接入侧先准备独立兜底开关或通过重新发版/配置切换控制。

### Evidence Pack 与自动诊断

- evidence pack、issue group、agent hints、diagnostics API 暂缓。
- 当前 Workbench 以 session timeline、performance overview、event detail 和 raw JSON 为主要排查入口。
- 不宣称自动定位根因；所有问题判断仍需开发者结合 App 代码、业务上下文和 raw envelope。

### Workbench 独立化与长期服务端能力

- Web 仍位于 `platform/web`，Monitor Service 位于 `platform/services/monitor-service`。
- 暂不迁移为根目录独立 `web` 包。
- 多租户、权限、审计、告警、长期冷热存储、企业质量治理大盘和生产级运维能力暂未完成。
- SQLite/local service 更适合作为本地、QA、内部灰度和小规模验证入口。

### 长链接与长停留页面

- WebSocket/SSE 长链接消息级监控暂未建模。
- 长停留页面性能切片暂未完成。
- 业务交互性能窗口已有 SDK 侧基础能力，但 Workbench 中更细的 interaction 列表、聚合筛选和重叠提示仍可后续增强。

### Lifecycle 与边界场景

- 热重启、后台恢复、短间隔 lifecycle 抖动和 session 首事件缺失等边界仍需要真实设备多轮采证。
- Workbench 可展示已有 raw envelope，但对缺失 session 起点、event id 不连续或 cold start 缺失的诊断提示还可以增强。
- 内存能力只表达 sample、growth 和 suspect 线索，不做对象级泄漏结论。

### 真实 App 长周期验证

- 当前已经具备接入真实 App 的能力，但长期线上稳定性仍需要真实 App 的 QA/debug 包和内部灰度继续验证。
- 建议至少记录启动开销、弱网/断网恢复、后台恢复、长 session、低端机、高频事件、服务不可用、大 payload、隐私过滤和查询性能。
- 如果后续不再继续迭代，应把这些验证结果作为发布说明或接入文档中的风险边界，而不是继续扩展路线图。

## 发布收敛计划

### 文档收敛

- `docs/plan.md` 保持当前两段式结构：已完成、未完成。
- README 只保留项目入口、能力摘要、快速开始、端口、验证命令和限制说明。
- `docs/event_model.md`、`docs/signal_collection.md`、`docs/server_protocol.md` 继续作为协议和语义事实源。
- `platform/docs/*` 只描述 Monitor Service 与 Workbench 的消费侧边界。
- 删除或下沉“Phase 优先级”“近期最高优先级”“长期路线图”类措辞，避免给人仍在持续大规模开发的预期。

### 代码收敛

- 冻结稳定 API：初始化、输出模式、`track`、`measure`、`recordError`、context、Dio interceptor、`http.Client` wrapper。
- 不再新增大能力，只修复影响当前支持范围的 bug。
- 保持 `flutter_monitor_core` 为唯一字段和协议来源。
- Workbench/service 不补写 SDK 字段，只修查询、展示和 raw 回查问题。
- native、DevTools、CLI、MCP 只保留边界，不进入当前发布阻塞项。

### 验证收敛

发布前至少运行：

```sh
fvm dart test packages/flutter_monitor_core/test
fvm flutter test --no-pub packages/flutter_monitor_sdk/test
```

Platform 按环境选择：

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
```

如果本地 `pnpm` 因已运行的 Workbench 或 `node_modules` 状态无法交互执行，可使用已有 compiler 做等价 TypeScript 检查，并在发布说明中记录原因。

### 使用收敛

推荐使用方式：

- 本地开发：`consoleOnly`。
- QA 复现：`localLive` + Monitor Service + Workbench。
- 内部灰度：`production` + 保守 `MonitorProductionPolicy` + 明确回滚/关闭策略。

接入最小集：

- 初始化 SDK。
- 添加 Navigator observer。
- 接入 Dio interceptor 或 `http.Client` wrapper。
- 只在关键业务动作使用 `track`。
- 只在关键交互使用 `measure`。
- 使用统一 context 写入 user、release、environment、feature flags 等上下文。
- 在 Workbench 中确认 session timeline、HTTP、错误、卡顿、SDK self-monitoring 和 raw JSON 都能回查。

发布说明应明确：

- 当前是 Flutter-only 主线可用版本。
- Native、DevTools、remote config、evidence pack、长链接监控和企业级服务端能力暂未完成。
- 内存能力是诊断线索，不是确定泄漏检测。
- 自动诊断不是当前能力，最终判断需要开发者结合代码和业务上下文。
