# 目标架构

## 目标

本文档定义 Flutter Monitor SDK 的目标架构。SDK 应围绕链路模型组织采集、上下文、pipeline、输出和本地调试能力。

目标架构强调“信号采集”和“链路组织”分离。采集器负责发现事实，pipeline 负责生成统一事件，session/trace/context 负责把事实组织成可诊断链路。

## 架构原则

- 保留有价值的信号源，并为它们补齐链路关系。
- Collector 只负责采集，不负责最终协议。
- Event envelope 只能由 pipeline 统一构建。
- Context、session、trace、breadcrumb 是基础设施，不应散落在各采集器中。
- Output 消费统一事件模型，不反向影响采集逻辑。
- DevTools 和 HTTP 上报共享同一套事件模型。
- SDK 内部应能记录自身状态，例如事件丢弃、flush 失败、队列积压。
- Trace 和 span 都是一等事件，采集器不得用私有结构表达链路阶段。
- 同一语义字段只能有一个规范路径，新增字段前应先查 `docs/event_model.md` 的字段注册表。

## 分层架构

```text
Signal Collectors
  -> Context Manager
    -> Session/Trace Manager
      -> Event Pipeline
        -> Outputs
```

## Signal Collectors

Signal Collectors 负责采集原始信号，不直接决定最终上报格式。

目标模块：

- `ErrorCollector`
- `LaunchCollector`
- `RouteCollector`
- `PagePerformanceCollector`
- `NetworkCollector`
- `BehaviorCollector`
- `JankCollector`
- `MemoryCollector`
- `LifecycleCollector`
- `CustomTraceCollector`

采集器职责：

- 监听对应信号；
- 生成结构化 signal；
- 标记信号来源；
- 提供必要原始数据；
- 不直接拼接最终 event envelope。

## Context Manager

Context Manager 负责维护动态上下文。

应维护：

- app context
- user context
- route context
- module/scene context
- device context
- network context
- release context
- feature flag context
- custom global context

上下文更新应支持运行时变更，例如用户登录、登出、切换账号、切换环境、feature flag 命中。

Context Manager 应提供快照能力。Collector 捕获 signal 时，应使用事件发生时的上下文快照，避免异步上报时上下文已经变化导致归因错误。

## Session/Trace Manager

Session/Trace Manager 负责维护链路关系。

职责：

- 创建和结束 session；
- 创建 trace；
- 创建 span；
- 维护 span parent/child 关系；
- 维护当前 active route trace；
- 维护当前 active user action trace；
- 维护 recent breadcrumbs；
- 提供当前链路快照。

典型 trace：

- app cold start trace
- app hot start trace
- page load trace
- user action trace
- network trace
- custom business trace

Session/Trace Manager 应提供轻量 API：

- `currentSessionId`
- `currentTraceId`
- `startTrace`
- `finishTrace`
- `startSpan`
- `finishSpan`
- `addBreadcrumb`
- `getRecentBreadcrumbs`

这些 API 应被 SDK 内部使用，也可开放必要的业务自定义能力。

## Event Pipeline

Event Pipeline 负责把 signal 转换为 event envelope 并分发到 output。

职责：

- 合并 signal、context、session、trace；
- 构建 event envelope；
- schema validation；
- privacy filtering；
- sampling；
- throttling；
- priority handling；
- batching；
- retry；
- offline cache；
- SDK self-monitoring。

Pipeline 不应把某个 output 的格式泄漏到采集层。

Pipeline 应保证：

- 同一 signal 只生成一条主事件，避免重复上报；
- 事件生成失败时记录 SDK self-monitoring；
- 隐私过滤早于任何 output；
- 字段归一化早于采样和批处理；
- 采样策略可按 signal type、route、module、release、user cohort 配置；
- 高优先级事件可绕过部分低优先级批处理延迟。

## Outputs

Output 负责消费统一事件模型。

目标 output：

- `LogOutput`
- `HttpOutput`
- `CustomOutput`
- `DevToolsOutput`
- `FileExportOutput`
- future `OpenTelemetryOutput`

Output 不应修改事件语义。需要转换格式时，应只做输出适配。

## DevTools Bridge

DevTools Bridge 负责本地调试消费。

职责：

- 写入 Flutter Timeline；
- 暴露当前 session timeline；
- 提供事件详情；
- 支持 session 导出；
- 支持本地导入查看；
- 展示 SDK 自监控状态。

## 数据流

```text
collector captures signal
  -> context manager attaches context
  -> session/trace manager attaches linkage
  -> pipeline builds envelope
  -> pipeline filters/samples/batches
  -> outputs consume event
```

## 模块边界

- Collector 不做上报。
- Context Manager 不做采样。
- Session/Trace Manager 不做隐私过滤。
- Pipeline 不监听 Flutter 原始信号。
- Output 不反向修改 session/trace 状态。
- Output 不重新读取未脱敏原始数据。

## 公开 API 方向

公开 API 应覆盖：

- SDK 初始化；
- 设置用户信息；
- 设置自定义上下文；
- 设置当前模块/场景；
- 开始/结束自定义 trace；
- 添加 breadcrumb；
- 手动上报 error；
- 手动上报 metric；
- 获取 route observer；
- 获取 network interceptors/client；
- flush；
- dispose。

API 应保持简单，但内部事件模型必须稳定。
