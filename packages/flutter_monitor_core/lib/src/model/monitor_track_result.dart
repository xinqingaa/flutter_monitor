import 'wire_enum.dart';

/// 业务动作结果。
///
/// `FlutterMonitorSDK.track` 使用该枚举描述业务动作的结果，并写入
/// `business.result`，同时映射为 envelope 的 status/level。
enum MonitorTrackResult implements WireEnum {
  /// 动作开始。
  started('started'),

  /// 动作成功。
  success('success'),

  /// 动作失败。
  failed('failed'),

  /// 动作被取消。
  cancelled('cancelled'),

  /// 结果未知。
  unknown('unknown');

  /// 创建 wire enum 值。
  const MonitorTrackResult(this.wireValue);

  @override
  /// 协议中的字符串值。
  final String wireValue;

  /// 转换为协议 JSON 值。
  String toJson() => wireValue;

  /// 从协议 JSON 值解析业务动作结果。
  static MonitorTrackResult fromJson(Object? value) {
    return enumFromWireValue(values, value, MonitorTrackResult.unknown);
  }
}
