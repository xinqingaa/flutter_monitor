import '../model/event_envelope.dart';
import '../schema/field_registry.dart';
import 'privacy_level.dart';

class PrivacyFilter {
  PrivacyFilter({FieldRegistry? registry})
    : registry = registry ?? FieldRegistry.defaults();

  final FieldRegistry registry;

  Map<String, Object?> filterAttributes(Map<String, Object?> attributes) {
    return _filterMap(attributes);
  }

  Map<String, Object?> filterPayload(Map<String, Object?> payload) {
    return _filterMap(payload);
  }

  EventEnvelope filterEnvelope(EventEnvelope event) {
    return event.copyWith(
      attributes: filterAttributes(event.attributes),
      payload: filterPayload(event.payload),
    );
  }

  Map<String, Object?> _filterMap(Map<String, Object?> values) {
    final filtered = <String, Object?>{};
    for (final entry in values.entries) {
      final definition = registry.lookup(entry.key);
      if (definition?.privacyLevel == PrivacyLevel.forbidden) {
        continue;
      }
      filtered[entry.key] = _filterValue(entry.value);
    }
    return filtered;
  }

  Object? _filterValue(Object? value) {
    if (value is Map) {
      return _filterMap(value.map((key, value) => MapEntry('$key', value)));
    }
    if (value is Iterable && value is! String) {
      return value.map(_filterValue).toList(growable: false);
    }
    return value;
  }
}
