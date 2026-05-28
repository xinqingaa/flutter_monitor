import 'wire_enum.dart';

enum MemorySampleSource implements WireEnum {
  dart('dart'),
  native('native'),
  system('system'),
  sdk('sdk'),
  unknown('unknown');

  const MemorySampleSource(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static MemorySampleSource fromJson(Object? value) {
    return enumFromWireValue(values, value, MemorySampleSource.unknown);
  }
}
