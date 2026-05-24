Map<String, Object?> jsonMap(Map<String, Object?> values) {
  final result = <String, Object?>{};
  for (final entry in values.entries) {
    final value = entry.value;
    if (value == null) continue;
    if (value is Map && value.isEmpty) continue;
    if (value is Iterable && value.isEmpty) continue;
    result[entry.key] = value;
  }
  return result;
}

Map<String, Object?> objectMap(Object? value) {
  if (value is! Map) return <String, Object?>{};
  return value.map((key, value) => MapEntry(key.toString(), value));
}

List<String>? stringList(Object? value) {
  if (value is! Iterable) return null;
  return value.whereType<String>().toList(growable: false);
}

DateTime? dateTimeFromJson(Object? value) {
  if (value is! String) return null;
  return DateTime.tryParse(value);
}

String? dateTimeToJson(DateTime? value) => value?.toIso8601String();
