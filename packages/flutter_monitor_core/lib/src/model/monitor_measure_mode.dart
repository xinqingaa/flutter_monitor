import 'wire_enum.dart';

/// 业务交互性能观测模式。
///
/// `common` 表示围绕调用时刻自动观察短窗口；`stage` 表示业务显式开始并
/// 通过 handle 结束的一段交互阶段。
enum MonitorMeasureMode implements WireEnum {
  /// 普通交互点，SDK 自动闭合观测窗口。
  common('common'),

  /// 明确开始/结束的业务交互阶段。
  stage('stage');

  /// 创建 wire enum 值。
  const MonitorMeasureMode(this.wireValue);

  @override
  /// 协议中的字符串值。
  final String wireValue;

  /// 转换为协议 JSON 值。
  String toJson() => wireValue;

  /// 从协议 JSON 值解析交互观测模式。
  static MonitorMeasureMode fromJson(Object? value) {
    return enumFromWireValue(values, value, MonitorMeasureMode.common);
  }
}
