/// Shared contract for enum-like values that are serialized as stable strings.
abstract interface class WireEnum {
  String get wireValue;
}

T enumFromWireValue<T extends WireEnum>(
  Iterable<T> values,
  Object? value,
  T fallback,
) {
  if (value is! String) return fallback;
  for (final item in values) {
    if (item.wireValue == value) return item;
  }
  return fallback;
}
