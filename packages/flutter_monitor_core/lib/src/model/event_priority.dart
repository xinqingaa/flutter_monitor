import 'wire_enum.dart';

enum EventPriority implements WireEnum {
  critical('critical'),
  high('high'),
  normal('normal'),
  low('low');

  const EventPriority(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static EventPriority fromJson(Object? value) {
    return enumFromWireValue(values, value, EventPriority.normal);
  }
}
