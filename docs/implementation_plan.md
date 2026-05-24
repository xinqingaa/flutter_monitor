# 实施计划

## 原则

实施顺序应先稳定 workspace 边界和模型，再调整代码，再扩展能力。

阶段验收不只看“事件能发出去”，还要看“事件能否被串成链路并用于定位问题”。

重构过程中必须保留基础信号源的价值：错误、启动、页面加载、API 耗时、卡顿、用户点击、PV、页面停留都应在新模型中找到归属。任何删除都必须有替代方案和验收证明。

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
- 定义 session export/import 格式。
- 定义 schema validation 基础能力。
- 稳定信号采集设计，覆盖采集来源、触发时机、链路关联和降级策略。

验收：

- 所有 signal type 都能映射到统一 event envelope。
- 字段状态、可空性、隐私等级、索引建议明确。
- 冷启动、热启动、页面、网络、行为、卡顿、内存、native、错误、自定义 trace 均有 schema。
- `docs/signal_collection.md` 覆盖启动、页面、网络、错误、行为、卡顿、内存、生命周期、native 和自定义 trace。
- DevTools、server protocol、native package 不定义第二套模型。

## Phase 2：SDK Runtime Pipeline

目标：

- 在 `flutter_monitor_sdk` 中建立 runtime 基础设施：
  - context manager；
  - session manager；
  - trace/span manager；
  - breadcrumb store；
  - event pipeline；
  - outputs。
- 将 Reporter 从事件分发器升级为 pipeline 入口或被 pipeline 替代。

验收：

- 任意业务事件都能带 `sessionId`。
- 页面、API、行为、卡顿、错误可以关联当前 route/module。
- 错误、卡顿、慢 trace 可以携带最近 breadcrumbs。
- output 消费统一 event envelope。
- 上下文异步变化时，事件仍使用发生时的 context snapshot。
- SDK 能记录 envelope 构建失败、事件丢弃、flush 失败等 self-monitoring 事件。

## Phase 3：现有 Flutter 信号接入

目标：

- error 接入 event envelope。
- cold start、hot start、page load 接入 trace/span。
- Dio 和 `http` 请求接入 `http.client` span。
- click/PV/page stay 接入 breadcrumb 或 metric。
- jank 接入当前 page trace 和 breadcrumbs。

验收：

- 现有功能不丢失。
- 上报结构符合 `docs/event_model.md`。
- 示例 App 能展示一条完整 session timeline。
- 启动、页面加载、API、点击、PV、页面停留、卡顿、错误均可在 session 中看到。
- 慢页面能关联页面 trace、相关 API 和最近 breadcrumbs。
- 卡顿能关联当前页面/模块、最近行为和设备信息。
- 错误能关联当前 route/module、active trace/span 和最近 breadcrumbs。

## Phase 4：内存、生命周期与 Native Bridge

目标：

- 接入 Flutter/Dart 可获得的 memory sample、growth、pressure 线索。
- 接入 lifecycle：foreground/background/resume/exit flush。
- 定义并接入 `MonitorNativeBridge`。
- 在 `flutter_monitor_native` 中提供可选 native memory/lifecycle 基础能力。
- 预留 native crash、OOM、ANR schema 和离线缓存策略。

验收：

- memory.sample、memory.growth、memory.pressure 进入统一 envelope。
- 内存泄漏只表达为 suspect，不做缺乏证据的确定性判断。
- lifecycle 事件可参与 session 切分、hot start 和 exit flush。
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
- 服务端能按 session、trace、route、module、version、device tier、native platform 聚合。
- 服务端能基于统一事件派生启动 P95、页面 P95、API P95、卡顿率、错误率、native crash/ANR/OOM rate、内存趋势和影响用户数。
- 采样和限流不会破坏错误、native crash、OOM、关键卡顿、关键慢页面的定位链路。

## Phase 7：工具入口扩展

目标：

- 预留 CLI、MCP、独立 DevTools tooling 的包边界。
- 工具入口复用 `flutter_monitor_core`。
- 工具入口消费 session export 和 event envelope。

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
- 是否能关联 route/module；
- 是否能携带 breadcrumbs；
- 是否能被 log/custom/http/devtools/file output 消费；
- 是否有测试或示例证明链路可还原；
- 是否没有引入新的孤立指标结构；
- 是否没有让 native、DevTools、CLI、MCP 形成第二套协议；
- 是否保持 `flutter_monitor_core` 作为唯一模型来源。
