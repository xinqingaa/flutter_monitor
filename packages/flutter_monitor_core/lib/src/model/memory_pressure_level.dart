import 'wire_enum.dart';

enum MemoryPressureLevel implements WireEnum {
  none('none'),
  moderate('moderate'),
  critical('critical'),
  unknown('unknown');

  const MemoryPressureLevel(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static MemoryPressureLevel fromJson(Object? value) {
    return enumFromWireValue(values, value, MemoryPressureLevel.unknown);
  }
}
