# AGENTS.md

这是本仓库面向 agent 的唯一工作规范。后续 agent 应以本文档作为项目方向、文档建设和代码演进的约束来源。

## 项目目标

Flutter Monitor SDK 的目标是成为一个 **以链路为组织方式的 Flutter 端侧监控 SDK**。

SDK 应采集错误、性能、网络、页面、行为、卡顿、内存、生命周期和自定义业务信号，并通过统一上下文将这些信号组织成可回放、可聚合、可定位的用户会话链路。

目标效果是：

- 开发者能还原一次真实用户或 QA 会话中发生了什么。
- 页面或模块出现性能问题时，能定位相关操作、请求、卡顿、错误、设备、网络、版本和业务上下文。
- 用户无法准确描述页面或操作路径时，仍能通过 session timeline 和 breadcrumbs 辅助排查。
- DevTools 能支持本地复现、性能优化和 QA 交接。
- 服务端能支持长期聚合、趋势分析、告警、版本对比和影响面分析。

## 核心模型

所有监控能力都应围绕链路模型设计。核心概念包括：

- `session`：一次用户使用过程或一段可分析的 App 活动窗口。
- `trace`：一次可追踪的流程，例如冷启动、页面打开、用户操作、接口调用链或业务流程。
- `span`：trace 中的一个阶段，例如路由切换、首帧、接口请求、图片解码、列表构建或自定义业务步骤。
- `breadcrumb`：问题发生前后的关键上下文足迹，例如页面进入、点击、请求、弹窗、生命周期变化、卡顿和错误。
- `context`：与事件相关的 route、module、scene、user、device、network、release、channel、feature flag 等上下文。
- `resource`：SDK、App、设备、系统和运行环境等稳定资源信息。
- `attributes`：用于检索、聚合和分析的结构化字段。
- `payload`：事件特有的详细数据。

事件应尽量能回答：

- 谁受影响？
- 在哪个页面、模块、场景或 route stack？
- 发生在哪个 session、trace 或 span 中？
- 前后有哪些 breadcrumbs？
- 当时设备、网络、版本、渠道和 feature flag 是什么？
- 这个事件如何服务于问题定位、复现、聚合或告警？

## 信号范围

SDK 应覆盖但不限于以下信号：

- 错误：Flutter framework error、Dart error、业务主动上报错误。
- 启动：冷启动、热启动、首帧、可交互时间。
- 页面：路由进入/离开、页面加载、页面停留、页面可交互、页面来源。
- 网络：Dio、`http`、请求/响应耗时、状态码、错误类型、请求/响应大小、重试、缓存。
- 行为：点击、关键操作、页面访问、业务动作、用户路径。
- 卡顿：连续慢帧、帧耗时分布、FPS、稳定性、设备等级、页面上下文。
- 内存：内存水位、增长趋势、页面退出后的异常存活线索。
- 生命周期：前后台切换、启动恢复、退出前 flush。
- 自定义 trace：业务方主动标记的流程、阶段和指标。

新增信号时，应优先设计它如何进入 session/trace/span/breadcrumb/context，避免只停留在单条事件字段设计。

## DevTools 与服务端分工

DevTools 与服务端应共享同一套事件模型，但承担不同职责。

DevTools 侧目标：

- 在 Flutter Timeline/Performance 中呈现 SDK 标记。
- 展示当前 session timeline。
- 展示 page/API/action/jank/error 的上下文和详情。
- 支持 QA 复现后导出 session，开发侧导入排查。
- 服务于本地调试、性能优化和问题复现。

服务端侧目标：

- 接收稳定协议上报的数据。
- 支持按版本、页面、模块、设备、网络、渠道、feature flag 和用户分群聚合。
- 支持 P50/P90/P95/P99、错误率、卡顿率、影响用户数、趋势和告警。
- 支持优化前后对比和企业质量治理。

不要让 DevTools 和服务端形成两套互不兼容的数据结构。

## 协议与数据模型优先级

在继续扩展大量功能前，应优先稳定：

- event envelope；
- schema version；
- event id；
- session/trace/span 关系；
- resource/context/attributes/payload 分层；
- 时间戳、duration、level、signal type、name 等公共字段；
- 隐私过滤和敏感字段策略；
- 采样、限流、重试、离线缓存和事件优先级；
- 服务端鉴权、错误码和兼容策略。

字段设计应服务于检索、聚合、排查和长期兼容。不要让各模块随意发散字段名。

## 企业化要求

设计和实现时应持续考虑企业使用场景：

- 多环境：dev、test、staging、production。
- 多版本：appVersion、buildNumber、release、flavor、channel。
- 灰度与实验：feature flag、experiment、cohort。
- 用户与隐私：userId、userType、userTags、脱敏、匿名化、授权开关。
- 设备与网络：device tier、OS、refresh rate、memory、network type、weak network。
- 稳定性：采样、限流、离线缓存、重试、队列上限、事件优先级、失败统计。
- 协作：QA 复现、session 导出/导入、问题交接、用户反馈定位。

## 文档分工

- `AGENTS.md`：项目目标、工作约束和方向边界。
- `docs/background.md`：项目背景、迁移原因和方向解释。
- `docs/event_model.md`：session、trace、span、breadcrumb、metric、error、log、resource、context、attributes、payload 定义。
- `docs/server_protocol.md`：服务端上报协议、schema version、鉴权、错误处理、重试和兼容策略。
- `docs/devtools_integration.md`：Flutter Timeline、DevTools extension、本地 session 导出/导入和本地/服务端边界。
- `docs/architecture.md`：目标 SDK 架构和模块职责。
- `docs/implementation_plan.md`：分阶段实施计划和验收标准。

README 只作为项目入口，不作为架构或协议的唯一事实源。

## 实现约束

- 新增能力必须说明它如何进入链路模型。
- 新增事件必须优先考虑 session、trace、span、breadcrumb 和 context 关联。
- 新增字段必须考虑隐私、采样、兼容、聚合和服务端查询。
- 新增 DevTools 能力必须服务于本地复现、调试或性能优化。
- 新增服务端能力必须服务于长期分析、聚合、告警或影响面判断。
- 不要新增无法关联上下文的孤立指标。
- 不要让各模块各自定义不兼容的数据结构。
- 不要在文档和代码之间制造两套不同的事件模型。

## 开发命令

- `flutter pub get` - 安装依赖。
- `flutter test` - 运行 package 测试。
- `flutter analyze` - 运行静态分析。
- `cd example && flutter pub get && flutter run` - 运行示例应用。
- `cd example && flutter test` - 运行 example 测试。

纯文档变更应检查引用和结构。代码变更应运行 `flutter analyze` 和相关测试。如果某项测试无法运行或已经失败，应明确说明原因。
