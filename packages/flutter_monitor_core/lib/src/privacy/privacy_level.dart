import '../model/wire_enum.dart';

enum PrivacyLevel implements WireEnum {
  safe('safe'),
  queryable('queryable'),
  sensitive('sensitive'),
  forbidden('forbidden'),
  mixed('mixed');

  const PrivacyLevel(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static PrivacyLevel fromJson(Object? value) {
    return enumFromWireValue(values, value, PrivacyLevel.mixed);
  }
}
