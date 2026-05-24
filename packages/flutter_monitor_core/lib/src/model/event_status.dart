import 'wire_enum.dart';

enum EventStatus implements WireEnum {
  ok('ok'),
  error('error'),
  cancelled('cancelled'),
  timeout('timeout'),
  unknown('unknown');

  const EventStatus(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static EventStatus fromJson(Object? value) {
    return enumFromWireValue(values, value, EventStatus.unknown);
  }
}
