import '../model/wire_enum.dart';

enum FieldValueType implements WireEnum {
  string('string'),
  number('number'),
  boolean('boolean'),
  object('object'),
  array('array'),
  timestamp('timestamp'),
  durationMs('duration_ms');

  const FieldValueType(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static FieldValueType fromJson(Object? value) {
    return enumFromWireValue(values, value, FieldValueType.string);
  }
}
