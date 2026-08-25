# flutter_monitor_core

Dart-only 事件模型包。版本 `2.0.0`。

本包是 Flutter Monitor 的唯一 schema / 字段 / 隐私 / summary 来源。它不采集信号，也不上报网络。

## 职责

- `EventEnvelope` 与 resource / context / attributes / payload
- `EventNames`、`FieldPaths`、field registry、schema validation
- privacy filter、retention registry、event summary、compact log
- `SessionExport` 数据契约（SDK 尚未提供完整导出/导入工作流）

## 使用

业务 App 应依赖 `flutter_monitor_sdk`，不要直接拼装 envelope。

字段与事件名以本包代码和仓库 [`docs/event_model.md`](../../docs/event_model.md) 为准。
