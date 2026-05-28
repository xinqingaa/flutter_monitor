import 'wire_enum.dart';

enum NativeSignalType implements WireEnum {
  memory('memory'),
  lifecycle('lifecycle'),
  crash('crash'),
  oom('oom'),
  anr('anr');

  const NativeSignalType(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static NativeSignalType fromJson(Object? value) {
    return enumFromWireValue(values, value, NativeSignalType.memory);
  }
}
