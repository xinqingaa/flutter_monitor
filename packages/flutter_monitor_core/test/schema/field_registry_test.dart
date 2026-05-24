import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('contains core signal fields', () {
    final registry = FieldRegistry.defaults();

    expect(
      registry.lookup(FieldPaths.contextRouteName)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.contextRouteName)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.resourceDeviceDeviceTier)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.httpMethod)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.errorMechanism)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.payloadErrorMessage)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.payloadErrorStacktrace)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.contextReleaseFeatureFlags)?.valueType,
      FieldValueType.array,
    );
    expect(
      registry.lookup(FieldPaths.contextLifecycleState)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.contextLifecyclePreviousState)?.valueType,
      FieldValueType.string,
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
      registry.lookup(FieldPaths.contextNativePlatform)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.contextNativeAvailable)?.valueType,
      FieldValueType.boolean,
    );
    expect(
      registry.lookup(FieldPaths.contextNativeProcessId)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.contextNativeBridgeVersion)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.contextNativeSignalSource)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.nativeMemoryPressureLevel)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.frameMaxMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.contextMissingReason)?.privacyLevel,
      PrivacyLevel.safe,
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

  test('does not register deprecated duplicate fields', () {
    final paths = FieldRegistry.defaults().fields
        .map((definition) => definition.path)
        .toSet();

    expect(paths, isNot(contains('page.route')));
    expect(paths, isNot(contains('page.route.source')));
    expect(paths, isNot(contains('page.module')));
    expect(paths, isNot(contains('page.scene')));
    expect(paths, isNot(contains('page.stay_ms')));
    expect(paths, isNot(contains('device.tier')));
    expect(paths, isNot(contains('app.lifecycle.state')));
    expect(paths, isNot(contains('app.lifecycle.previous_state')));
    expect(paths, isNot(contains('native.platform')));
    expect(paths, isNot(contains('error.message')));
    expect(paths, isNot(contains('error.stacktrace')));
  });
}
