import 'event_level.dart';

/// SDK public API 使用的事件等级别名。
///
/// 当前与 core 的 [EventLevel] 完全一致，保留 `MonitorEventLevel` 命名是为了让业务
/// facade 的参数语义更直观。
typedef MonitorEventLevel = EventLevel;
