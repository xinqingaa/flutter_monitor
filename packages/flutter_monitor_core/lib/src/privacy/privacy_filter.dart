import '../schema/field_registry.dart';
import 'privacy_level.dart';

class PrivacyFilter {
  PrivacyFilter({FieldRegistry? registry})
    : registry = registry ?? FieldRegistry.defaults();

  final FieldRegistry registry;

  Map<String, Object?> filterAttributes(Map<String, Object?> attributes) {
    final filtered = <String, Object?>{};
    for (final entry in attributes.entries) {
      final definition = registry.lookup(entry.key);
      if (definition?.privacyLevel == PrivacyLevel.forbidden) {
        continue;
      }
      filtered[entry.key] = entry.value;
    }
    return filtered;
  }
}
