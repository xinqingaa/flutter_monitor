import 'wire_enum.dart';

enum EventLevel implements WireEnum {
  debug('debug'),
  info('info'),
  warning('warning'),
  error('error'),
  fatal('fatal');

  const EventLevel(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static EventLevel fromJson(Object? value) {
    return enumFromWireValue(values, value, EventLevel.info);
  }
}
