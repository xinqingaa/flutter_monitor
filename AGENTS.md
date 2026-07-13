# AGENTS.md

这是本仓库面向 agent 的项目方向与硬约束规范。执行具体变更时还必须遵守根目录 `SKILL.md` 中的工作流，确保文档、core、sdk/native 和 Workbench 不分叉。

## 项目目标

Flutter Monitor 的目标是成为一个 **以链路为组织方式的 Flutter 端侧监控 workspace**。

SDK 应采集错误、启动、页面、网络、行为、生命周期和自定义业务信号，并通过统一上下文将这些信号组织成可回放、可聚合、可定位的用户会话链路。卡顿、帧数、内存、native 和 `measure` 等依赖采样或平台时机的低可信诊断信号必须进入同一模型，但默认关闭，只能通过配置显式开启。

目标效果：

- 开发者能还原一次真实用户或 QA 会话中发生了什么。
- 页面或模块出现问题时，能定位相关操作、请求、错误、生命周期、设备、网络、版本和业务上下文；显式开启诊断信号后，可补充卡顿、帧数、内存和 native 线索。
- 用户无法准确描述页面或操作路径时，仍能通过 session timeline 和 breadcrumbs 辅助排查。
- DevTools 能支持本地复现、性能优化和 QA 交接。
- 服务端能支持长期聚合、趋势分析、告警、版本对比和影响面分析。

## Workspace 与包边界

本仓库目标架构使用官方 Dart pub workspaces。

根目录作为 workspace root，承载文档、CI、脚本和 workspace 配置，不作为发布包。

第一阶段目标包：

- `packages/flutter_monitor_core`：唯一事件模型、schema、字段注册、隐私规则、session export/import 和共享配置来源。
- `packages/flutter_monitor_sdk`：Flutter runtime 主 SDK，包含采集器、context、tracing、pipeline、outputs、DevTools bridge 和业务接入 API。
- `packages/flutter_monitor_native`：可选 Flutter plugin，提供 native memory、memory pressure、native lifecycle、OOM、ANR、native crash 等增强信号。
- `platform`：JS/TS workspace，承载 Monitor Service、Workbench Web 与共享 TypeScript 层；消费统一 `EventEnvelope` 做本地调试、QA 复现、session timeline、性能分析和 raw JSON 回查，不定义第二套模型。

未来工具入口：

- `flutter_monitor_cli`
- `flutter_monitor_devtools`：未来可选的自定义 DevTools extension/UI 包，消费 `flutter_monitor_sdk` 暴露或导出的数据，不承担 runtime 采集。
- `flutter_monitor_mcp`

所有未来入口都必须复用 `flutter_monitor_core`。不得为 CLI、DevTools、native、MCP 或服务端创建第二套事件模型、导出格式或上报协议。

## 核心模型

所有监控能力都应围绕链路模型设计。核心概念包括：

- `session`：一次用户使用过程或一段可分析的 App 活动窗口。
- `trace`：一次可追踪流程，例如冷启动、热启动、页面打开、用户操作、接口调用链、native 异常或业务流程。
- `span`：trace 中的一个阶段，例如 SDK 初始化、路由切换、首帧、可交互、接口请求、图片解码、列表构建、native memory sample 或自定义业务步骤。
- `breadcrumb`：问题发生前后的关键上下文足迹，例如页面进入、点击、请求、弹窗、生命周期变化、卡顿、内存压力、native warning 和错误。
- `context`：事件发生时的动态上下文，例如 `context.route.*`、`context.module.*`、`context.user.*`、`context.network.*`、`context.release.*`、`context.lifecycle.*` 和 `context.native.*`。
- `resource`：SDK、App、设备、系统和运行环境等稳定资源信息。
- `attributes`：用于检索、聚合和分析的结构化字段。
- `payload`：事件特有的详细数据，可裁剪，不作为主要索引来源。

事件应尽量能回答：

- 谁受影响？
- 在哪个页面、模块、场景或 route stack？
- 发生在哪个 session、trace 或 span 中？
- 前后有哪些 breadcrumbs？
- 当时 `resource.device.*`、`context.network.*`、`resource.app.*`、`context.release.featureFlags` 是什么；显式开启诊断信号后，内存和 `context.native.*` 状态是什么？
- 这个事件如何服务于问题定位、复现、聚合或告警？

## 核心信号

SDK 应覆盖但不限于以下信号：

- 错误：Flutter framework error、Dart error、业务主动上报错误、native crash。
- 启动：冷启动、热启动、首帧、可交互时间。
- 页面：路由进入/离开、页面加载、页面停留、页面可交互、页面来源。
- 网络：Dio、`http`、请求/响应耗时、状态码、错误类型、请求/响应大小、重试、缓存。
- 行为：点击、关键操作、页面访问、业务动作、用户路径。
- 卡顿：连续慢帧、帧耗时分布、FPS、稳定性、设备等级、页面上下文。默认关闭，显式开启后只作为诊断线索。
- 内存：memory sample、growth、pressure、native memory、suspect leak 线索。默认关闭，不得把增长宣称为确定泄漏。
- 生命周期：前后台切换、启动恢复、退出前 flush。
- Native：native memory、memory pressure、OOM、ANR、native crash、native lifecycle。
- 自定义 trace：业务方主动标记的流程、阶段和指标。

冷启动和热启动必须作为核心 trace。内存和 Native 能力必须进入统一模型，但默认不采集；Native 必须通过 bridge 或 optional extension 接入，不得绕过 SDK pipeline。

## DevTools 与服务端分工

DevTools 与服务端应共享同一套事件模型，但承担不同职责。

DevTools 侧目标：

- 在 Flutter Timeline/Performance 中呈现 SDK trace/span 标记。
- 展示当前 session timeline。
- 展示 page/API/action/jank/memory/native/error 的上下文和详情。
- 支持 QA 复现后导出 session，开发侧导入排查。
- 服务于本地调试、性能优化和问题复现。

服务端侧目标：

- 接收稳定协议上报的数据。
- 支持按 `resource.app.*`、`context.route.*`、`context.module.*`、`resource.device.*`、`context.network.*`、`context.release.featureFlags`、`context.native.platform` 和 `context.user.cohort` 聚合。
- 支持启动/页面/API 分位数、错误率、卡顿率、native crash/ANR/OOM rate、内存趋势、影响用户数、趋势和告警。
- 支持优化前后对比和企业质量治理。

不要让 DevTools 和服务端形成两套互不兼容的数据结构。

## 协议与数据模型优先级

在继续扩展大量功能前，应优先稳定：

- event envelope；
- schema version；
- event id；
- session/trace/span 关系；
- trace/span 作为一等事件的 signal type 语义；
- resource/context/attributes/payload 分层；
- 时间戳、start/end time、duration、level、status、signal type、name 等公共字段；
- 字段规范路径和命名注册；
- 字段可空性、必填条件和隐私等级；
- 隐私过滤和敏感字段策略；
- 采样、限流、重试、离线缓存和事件优先级；
- 服务端鉴权、错误码和兼容策略；
- DevTools/session export/import 格式；
- native bridge 与 native 信号映射。

字段设计应服务于检索、聚合、排查和长期兼容。不要让各包随意发散字段名。

## 企业化要求

设计和实现时应持续考虑企业使用场景：

- 多环境：`resource.app.environment`，取值包括 dev、test、staging、production。
- 多版本：`resource.app.appVersion`、`resource.app.buildNumber`、`context.release.releaseId`、`resource.app.flavor`、`resource.app.channel`。
- 灰度与实验：`context.release.featureFlags`、`context.release.experiments`、`context.user.cohort`。
- 用户与隐私：userId、userType、userTags、脱敏、匿名化、授权开关。
- 设备与网络：`resource.device.deviceTier`、`resource.device.osVersion`、`resource.device.refreshRate`、memory、`context.network.type`、`context.network.isWeakNetwork`。
- Native：native memory、OOM、ANR、native crash、platform lifecycle。
- 稳定性：采样、限流、离线缓存、重试、队列上限、事件优先级、失败统计。
- 协作：QA 复现、session 导出/导入、问题交接、用户反馈定位。

## 文档分工

- `AGENTS.md`：项目目标、workspace 约束、代码演进门禁和方向边界。
- `SKILL.md`：具体变更工作流，包括 docs -> core -> sdk/native -> platform 的执行顺序、端口复用和验证规则。
- `docs/background.md`：项目背景、迁移原因和现有能力归位。
- `docs/event_model.md`：统一 event schema、字段状态、signal mapping、resource、context、attributes、payload、privacy 和完整示例。
- `docs/signal_collection.md`：各类信号的采集来源、触发时机、链路关联、字段映射、限制和降级策略，以及接入方视角的输出模式行为规则与自定义配置。
- `docs/server_protocol.md`：服务端上报协议、schema version、鉴权、错误处理、重试、批量、remote config 和兼容策略。
- `docs/devtools_integration.md`：Flutter Timeline、DevTools bridge、本地 session 导出/导入和本地/服务端边界。
- `docs/architecture.md`：workspace 目标架构、包职责、代码目录、模块边界和运行时数据流。
- `docs/plan.md`：当前状态总览、分阶段实施计划、验收标准和待办验证清单。
- `platform/docs/README.md`：Platform 文档索引和消费侧边界。
- `platform/docs/product.md`：Workbench 信息架构、共享交互与各模块现状。
- `platform/docs/architecture.md`：Platform 架构、Monitor Service / Web 边界与排查食谱。

README 只作为项目入口，不作为架构、协议或 schema 的唯一事实源。

## 实现门禁

任何能力、重构、事件、字段、输出、native bridge、DevTools 展示、服务端协议或文档变更，都必须检查：

- 是否进入统一 event envelope；
- 是否有 session/trace/span/breadcrumb/context 关联策略；
- 是否有字段规范路径；
- 是否定义字段状态、可空性和隐私等级；
- 是否考虑采样、限流、离线、重试、事件优先级；
- 是否能被 DevTools 和服务端共享消费；
- 是否保持 `flutter_monitor_core` 作为唯一模型来源；
- 是否避免 native、CLI、DevTools、MCP 或服务端创建第二套协议。

禁止事项：

- 不要新增无法关联上下文的孤立业务指标。
- 不要让各包各自定义不兼容的数据结构。
- 不要在文档和代码之间制造两套不同的事件模型。
- 不要让 native plugin 绕过 SDK pipeline 直接上报。
- 不要让工具入口使用与服务端协议不兼容的导出格式。
- 不要在缺少证据时把内存增长宣称为确定泄漏。

## Git 提交规范

当用户要求“提交到 git”、“帮我 commit”或类似操作时，agent 应主动完成以下流程，不需要用户手动编写 commit message：

- 先查看 `git status --short`、`git diff --stat` 和必要的 `git diff`，确认本次未提交内容的主题与边界。
- 不得把明显无关的用户改动混入同一个提交；如果工作区存在无法判断归属的无关改动，应先向用户确认。
- 提交前按改动风险运行合适的验证命令；若未运行或失败，必须在回复中说明。
- commit message 遵守仓库既有 Conventional Commits 风格：`type(scope): 中文摘要`。
- 常用 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`。
- 常用 `scope`：`core`、`sdk`、`example`、`server`、`docs`、`scripts`。
- 当一次提交横跨多个目录时，scope 选择本次改动的主责任域；例如协议/schema/SDK 输出主线优先用 `sdk` 或 `core`，纯文档用 `docs`，示例体验主线用 `example`。
- 中文摘要应概括用户可感知的结果，避免只写“更新代码”“修改文件”等无信息内容。

示例：

- `feat(sdk): 收口 Phase 3 业务埋点 API 与 raw JSON 质量`
- `fix(sdk): 限制 failed HTTP breadcrumb 数量`
- `docs(core): 补充事件模型字段注册约束`
