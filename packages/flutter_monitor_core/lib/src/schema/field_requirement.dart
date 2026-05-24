import '../model/wire_enum.dart';

enum FieldRequirement implements WireEnum {
  required('required'),
  conditional('conditional'),
  optional('optional'),
  nullable('nullable'),
  defaulted('default');

  const FieldRequirement(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static FieldRequirement fromJson(Object? value) {
    return enumFromWireValue(values, value, FieldRequirement.optional);
  }
}
