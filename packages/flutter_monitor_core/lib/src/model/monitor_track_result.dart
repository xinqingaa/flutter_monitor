import 'wire_enum.dart';

enum MonitorTrackResult implements WireEnum {
  started('started'),
  success('success'),
  failed('failed'),
  cancelled('cancelled'),
  unknown('unknown');

  const MonitorTrackResult(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static MonitorTrackResult fromJson(Object? value) {
    return enumFromWireValue(values, value, MonitorTrackResult.unknown);
  }
}
