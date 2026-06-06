import 'wire_enum.dart';

/// 事件严重程度。
///
/// SDK public API 中的 `MonitorEventLevel` 是该枚举的别名。它会写入 envelope
/// 的 `level` 字段，用于日志展示、上报优先级和告警判断。
enum EventLevel implements WireEnum {
  /// 调试信息，通常只用于 SDK 自监控或本地排查。
  debug('debug'),

  /// 普通信息事件。
  info('info'),

  /// 警告事件，表示可能需要关注但不一定已经失败。
  warning('warning'),

  /// 错误事件，表示当前操作或信号已经失败。
  error('error'),

  /// 致命错误，通常用于崩溃、OOM、ANR 等高优先级问题。
  fatal('fatal');

  /// 创建 wire enum 值。
  const EventLevel(this.wireValue);

  @override
  /// 协议中的字符串值。
  final String wireValue;

  /// 转换为协议 JSON 值。
  String toJson() => wireValue;

  /// 从协议 JSON 值解析事件等级。
  static EventLevel fromJson(Object? value) {
    return enumFromWireValue(values, value, EventLevel.info);
  }
}
