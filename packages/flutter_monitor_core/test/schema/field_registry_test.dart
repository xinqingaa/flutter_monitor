import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('contains core signal fields', () {
    final registry = FieldRegistry.defaults();

    expect(
      registry.lookup(FieldPaths.httpMethod)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.pageRoute)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.pageRoute)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.errorMessage)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.authToken)?.privacyLevel,
      PrivacyLevel.forbidden,
    );
    expect(
      registry.lookup(FieldPaths.memoryRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryPressureLevel)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.sdkInitDurationMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.nativeStartElapsedMs)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.appLifecyclePreviousState)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.nativeMemoryPressureLevel)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.uiFrameMaxMs)?.valueType,
      FieldValueType.durationMs,
    );
  });

  test('field definitions serialize to json', () {
    const definition = FieldDefinition(
      path: FieldPaths.httpStatusCode,
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
