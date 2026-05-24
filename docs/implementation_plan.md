# 实施计划

## 原则

实施顺序应先稳定模型，再调整代码，再扩展能力。

每个阶段都应有明确产物和验收标准。

重构过程中必须保留基础信号源的价值：错误、启动、页面加载、API 耗时、卡顿、用户点击、PV、页面停留都应在新模型中找到归属。任何删除都必须有替代方案和验收证明。

阶段验收不只看“事件能发出去”，还要看“事件能否被串成链路并用于定位问题”。

## Phase 1：文档和模型稳定

目标：

- 稳定事件模型。
- 稳定目标架构。
- 稳定 DevTools 与服务端边界。
- 稳定服务端协议。

产物：

- `docs/event_model.md`
- `docs/architecture.md`
- `docs/devtools_integration.md`
- `docs/server_protocol.md`
- `docs/implementation_plan.md`

验收：

- 所有新增信号都能找到对应 event model 映射。
- 所有文档都不定义互相冲突的数据结构。
- `AGENTS.md` 与 docs 方向一致。
- 文档能说明一个用户 session 如何串起页面、行为、网络、卡顿和错误。

## Phase 2：链路基础设施

目标：

- 引入 session 管理。
- 引入 trace/span 管理。
- 引入 breadcrumbs。
- 引入 context manager。
- 将 Reporter 改造成 event pipeline。

验收：

- 任意事件都能带 `sessionId`。
- 页面、API、行为、卡顿、错误可以关联当前 route/module。
- 错误和卡顿可以携带最近 breadcrumbs。
- output 消费统一 event envelope。
- 上下文异步变化时，事件仍使用发生时的上下文快照。
- SDK 能记录 event envelope 构建失败、事件丢弃、flush 失败等自监控信息。

## Phase 3：现有信号接入链路模型

目标：

- error 接入 event envelope。
- launch/page 接入 trace/span。
- Dio 和 `http` 请求接入 `http.client` span。
- click/PV/page stay 接入 breadcrumb 或 metric。
- jank 接入当前 page trace 和 breadcrumbs。

验收：

- 现有功能不丢失。
- 上报结构符合 `event_model.md`。
- 示例 App 能展示一条完整 session timeline。
- 启动、页面加载、API、点击、PV、页面停留、卡顿、错误均可在 session 中看到。
- 慢页面能关联页面 trace、相关 API 和最近 breadcrumbs。
- 卡顿能关联当前页面/模块、最近行为和设备信息。
- 错误能关联当前 route/module、active trace/span 和最近 breadcrumbs。

## Phase 4：DevTools 本地诊断

目标：

- 写入 Flutter Timeline。
- 提供当前 session timeline。
- 支持本地 session 导出。

验收：

- 开发者能在 DevTools Performance 中看到关键 trace/span。
- QA 能导出 session payload。
- 开发者能基于导出内容查看事件顺序和详情。
- 导出的 session payload 使用统一 event envelope。
- 导出前已执行隐私过滤。
- DevTools 展示的事件与 HTTP 上报事件语义一致。

## Phase 5：服务端协议增强

目标：

- HTTP 上报使用 `server_protocol.md`。
- 支持 schema version。
- 支持鉴权 headers。
- 支持重试、限流、请求大小控制。
- 支持隐私过滤。

验收：

- 服务端能校验 schema。
- SDK 能处理 2xx、4xx、429、5xx。
- SDK 能记录 flush 成功、失败、丢弃事件等自监控信息。
- 服务端能按 session、trace、route、module、version、device tier 聚合。
- 服务端能基于统一事件派生页面 P95、API P95、卡顿率、错误率和影响用户数。

## Phase 6：企业化能力

目标：

- 离线缓存。
- 动态采样。
- 事件优先级。
- feature flag context。
- 内存趋势信号。
- 更多 custom trace API。

验收：

- 弱网或离线场景下关键事件不轻易丢失。
- 高流量场景下 SDK 不产生明显性能风险。
- 企业维度查询所需字段稳定进入 event envelope。
- 采样和限流不会破坏错误、关键卡顿、关键慢页面的定位链路。
- feature flag、channel、flavor、environment 能稳定进入 context。
- 内存信号以趋势和线索形式进入链路，不做缺乏证据的确定性泄漏判断。

## 重构前检查清单

开始代码重构前，应确认：

- `docs/event_model.md` 中的 envelope 字段已足够支撑第一阶段代码。
- `docs/architecture.md` 中的模块边界清晰。
- `docs/server_protocol.md` 不要求 SDK 上报另一套结构。
- `docs/devtools_integration.md` 不要求 DevTools 使用独立模型。
- 每个现有信号源都有目标归属。

## 重构完成检查清单

每轮重构完成后，应检查：

- 是否仍能捕获原有信号；
- 是否能生成统一 event envelope；
- 是否能关联 session；
- 是否能关联 route/module；
- 是否能携带 breadcrumbs；
- 是否能被 log/custom/http/devtools output 消费；
- 是否有测试或示例证明链路可还原；
- 是否没有引入新的孤立指标结构。
