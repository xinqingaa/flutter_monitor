import 'wire_enum.dart';

/// 业务交互性能观测结果。
///
/// 用于 `FlutterMonitorSDK.measure` 完成态，写入 `business.result` 并映射
/// envelope 的 status/level。
enum MonitorMeasureResult implements WireEnum {
  /// 交互观测正常完成。
  success('success'),

  /// 业务显式标记交互失败。
  failed('failed'),

  /// 业务显式取消观测。
  cancelled('cancelled'),

  /// stage 模式超时自动闭合。
  timeout('timeout'),

  /// 无明确结果。
  unknown('unknown');

  /// 创建 wire enum 值。
  const MonitorMeasureResult(this.wireValue);

  @override
  /// 协议中的字符串值。
  final String wireValue;

  /// 转换为协议 JSON 值。
  String toJson() => wireValue;

  /// 从协议 JSON 值解析交互观测结果。
  static MonitorMeasureResult fromJson(Object? value) {
    return enumFromWireValue(values, value, MonitorMeasureResult.unknown);
  }
}
