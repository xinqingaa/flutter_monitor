import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('contains core signal fields', () {
    final registry = FieldRegistry.defaults();

    expect(registry.lookup('http.method')?.privacyLevel, PrivacyLevel.safe);
    expect(registry.lookup('page.route')?.privacyLevel, PrivacyLevel.queryable);
    expect(
      registry.lookup('error.message')?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(registry.lookup('auth.token')?.privacyLevel, PrivacyLevel.forbidden);
  });

  test('field definitions serialize to json', () {
    const definition = FieldDefinition(
      path: 'http.status_code',
      valueType: FieldValueType.number,
      privacyLevel: PrivacyLevel.safe,
      indexed: true,
    );

    expect(definition.toJson(), {
      'path': 'http.status_code',
      'valueType': 'number',
      'requirement': 'optional',
      'privacyLevel': 'safe',
      'indexed': true,
    });
  });
}
