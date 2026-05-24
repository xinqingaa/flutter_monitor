import 'wire_enum.dart';

enum SignalType implements WireEnum {
  trace('trace'),
  span('span'),
  metric('metric'),
  error('error'),
  breadcrumb('breadcrumb'),
  log('log'),
  sdk('sdk');

  const SignalType(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static SignalType fromJson(Object? value) {
    return enumFromWireValue(values, value, SignalType.log);
  }
}
