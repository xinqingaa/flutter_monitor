# DevTools 与 Session Export 边界

## 当前状态

本文件描述 DevTools 和 QA session 交接的设计边界，并明确区分当前已实现能力与后续扩展。

当前代码状态：

| 能力 | 状态 |
|---|---|
| 统一 `EventEnvelope` | 已实现 |
| core `SessionExport` 数据结构与 JSON round-trip | 已实现 |
| Workbench Session 工作区和 Raw JSON 回查 | 已实现 |
| SDK session exporter/importer | 未实现 |
| Flutter Timeline writer | 未实现 |
| SDK DevTools bridge/output | 未实现 |
| 自定义 Flutter DevTools extension | 未实现 |

因此，当前本地诊断入口是 `localLive` + Monitor Service + Workbench，而不是 Flutter DevTools extension。文档和 README 不应把 Timeline、导出/导入 UI 或自定义 DevTools 面板列为现有功能。

## 已有数据契约

`flutter_monitor_core` 已定义 `SessionExport`：

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2026-05-24T12:10:00.000+08:00",
  "source": {
    "type": "workbench",
    "sdkVersion": "1.0.0",
    "coreVersion": "1.0.0"
  },
  "session": {
    "sessionId": "ses_001",
    "startedAt": "2026-05-24T12:00:00.000+08:00",
    "endedAt": "2026-05-24T12:10:00.000+08:00"
  },
  "events": [],
  "sdkHealth": {},
  "privacy": {
    "filtered": true,
    "policyVersion": "1.0"
  }
}
```

这个结构只定义可共享的数据形态，不代表 SDK 已提供导出 API。`events` 必须继续使用 `docs/event_model.md` 定义的 envelope；source、session、privacy 和 SDK health 只是导出元数据。

## 当前替代工作流

本地或 QA 排查使用：

```text
Flutter App
  -> MonitorMode.localLive
  -> Monitor Service
  -> Workbench Session / Event Detail / Raw JSON
```

Workbench 可通过 `sessionId`、`eventId`、`traceId`、用户、时间和资源维度定位数据。它已经覆盖原 DevTools 设计中的主要“本次复现发生了什么”场景，但当前不提供标准 `SessionExport` 文件下载或导入。

## 设计中的诊断视图

以下是未来 DevTools 或本地诊断查看器应消费的视图契约，不代表当前 SDK 已经提供对应 UI：

### Session Timeline

按时间顺序展示当前 session 的启动、页面、action、HTTP、错误、jank、memory 和 native 事件。每条记录至少应能查看 timestamp、signal type、name、level/status、duration、route/module、trace/span、priority 和可用的 event ID。

### Trace Detail

展示 root trace、span 关系、duration、status、页面首帧/可交互观测点、HTTP、jank、memory、error 和 native 关联事件，以及最近 breadcrumbs。Trace Detail 不应重新计算一套与 envelope 不同的 priority 或 status。

### Event Detail 与 Context Snapshot

事件详情应展示公共字段、resource、context、attributes、payload、breadcrumbs、相关 trace/span、privacy filtering 状态和 schema validation 状态。Context Snapshot 必须体现事件发生时的 route stack、module、user、network、release、device、lifecycle 和 native 状态，而不是当前页面的实时值。

### Memory / Jank / Native View

显式开启诊断信号后，可以展示 frame budget、jank sequence、FPS/stability、memory sample、memory growth、memory pressure 和相关 route/action/http/native 信号。内存增长只能标记为 suspect，不能在 DevTools 中宣称确定泄漏。Native crash、OOM、ANR 只有在真正进入 envelope 后才能展示，不能依据 schema 预留生成假事件。

### SDK Health

诊断工具应能查看 event queue size、dropped event count、flush success/failure、sampling、rate limit、privacy filtering、offline cache、active session、active trace、native bridge 和 schema validation failure。Health 视图消费 `sdk.*` 事件或统一 health summary，不根据 HTTP 状态或 UI 状态另造协议。

## 后续集成约束

未来实现 Timeline 或 DevTools extension 时，应复用下面的数据流：

```text
EventPipeline
  -> 已完成 privacy filtering 的 EventEnvelope
  -> Timeline adapter / Session store / Exporter
  -> Flutter DevTools 或独立查看器
```

必须遵守：

- 只消费 pipeline 输出的脱敏 envelope；
- 不重新读取 collector 原始数据；
- 不定义独立 signal type、字段路径或导出事件结构；
- native 信号必须先经过 SDK mapper 和 pipeline；
- Timeline 参数只携带必要的低敏字段；
- breadcrumb 和 memory sample 默认不逐条写入 Timeline，避免噪声；
- schema major 不兼容时拒绝结构化导入，但保留明确错误信息；
- 未识别的 minor 字段应保留在 Raw JSON 中。

## 可选 Timeline 映射

如果后续增加 Flutter Timeline adapter，建议只映射关键事件：

- `app.cold_start`、`app.hot_start`；
- `page.visit`、`page.load`；
- `http.client`；
- error；
- 显式开启后的 `ui.jank.sequence`、memory pressure 和 interaction measure；
- 已经可靠采集并进入 envelope 的 native 事件。

Timeline 是 envelope 的派生展示，不能成为新的事实源。

## 本地诊断场景

- 页面加载慢：查看 page trace、route、first frame、HTTP；显式开启后再参考 jank 和 memory。
- 点击后卡顿：查看 action breadcrumb、后续 span、jank sequence 和 memory sample。
- 请求慢：查看 HTTP span 是否归属于页面 trace 或 action trace，以及跨页 completion context。
- 冷/热启动慢：查看启动 trace、SDK init、首帧和 lifecycle resume；可交互点只有在真实采集后才能展示。
- 内存上涨：查看 memory growth、route/module/network、HTTP、native pressure 和 suspect 线索。
- QA 复现：在保留 privacy filtering 状态的前提下导出同一 session，交给开发侧导入或回查。

## QA 导出与开发导入

未来 exporter/importer 应满足：

- `events` 只包含同一 session 的原始 envelope，保持原始 `eventId` 和事件顺序；
- 导出前完成 privacy filtering，不包含未经脱敏的敏感字段；
- Flutter 与 native 信号放在同一个 `events` 数组；
- SDK self-monitoring 可选包含，用于判断 drop/retry 是否影响证据完整性；
- schema major 不兼容时明确拒绝结构化导入；minor 新字段不认识时保留 Raw JSON；
- 导入不得尝试恢复已脱敏字段，也不得把 UI summary 写回 raw envelope。

## 导出与导入要求

未来实现 exporter/importer 时：

- 导出事件必须来自同一 session，并保持原始 `eventId` 和事件顺序；
- 导出前必须完成 privacy filtering；
- SDK self-monitoring 可一并导出，用于判断证据是否因 drop/retry 受损；
- native 与 Flutter 信号放在同一个 `events` 数组；
- 导入不能尝试恢复已脱敏字段；
- UI 派生摘要不得写进 raw envelope；
- 文件中的每条事件都应能通过 core `EventEnvelope.fromJson` 解析或以 Raw JSON 降级展示。

## 职责边界

DevTools 或 session export 适合回答一次复现中的事件顺序、上下文和链路关系，不负责：

- 跨用户历史查询；
- 长期趋势和影响面；
- 告警、权限和多租户；
- native crash dump 符号化；
- 未脱敏敏感数据展示。

这些能力分别属于 Monitor Service、生产治理平台或原生工具链。
