import 'wire_enum.dart';

/// 事件执行状态。
///
/// 用于 envelope 的 `status` 字段，描述 trace/span/action/request 等信号最终是成功、
/// 失败、取消、超时还是未知。
enum EventStatus implements WireEnum {
  /// 成功完成。
  ok('ok'),

  /// 发生错误。
  error('error'),

  /// 被取消。
  cancelled('cancelled'),

  /// 超时。
  timeout('timeout'),

  /// 状态未知或无法判断。
  unknown('unknown');

  /// 创建 wire enum 值。
  const EventStatus(this.wireValue);

  @override
  /// 协议中的字符串值。
  final String wireValue;

  /// 转换为协议 JSON 值。
  String toJson() => wireValue;

  /// 从协议 JSON 值解析事件状态。
  static EventStatus fromJson(Object? value) {
    return enumFromWireValue(values, value, EventStatus.unknown);
  }
}
