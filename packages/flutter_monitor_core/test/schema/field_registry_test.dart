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
    expect(paths, isNot(contains('native.memory.used_mb')));
    expect(paths, isNot(contains('native.memory.pressure_level')));
    expect(paths, isNot(contains('error.message')));
    expect(paths, isNot(contains('error.stacktrace')));
  });

  test('registers every canonical FieldPaths value', () {
    final paths = FieldRegistry.defaults().fields
        .map((definition) => definition.path)
        .toSet();

    const canonicalPaths = <String>{
      FieldPaths.schemaVersion,
      FieldPaths.eventId,
      FieldPaths.timestamp,
      FieldPaths.startTime,
      FieldPaths.endTime,
      FieldPaths.durationMs,
      FieldPaths.signalType,
      FieldPaths.name,
      FieldPaths.level,
      FieldPaths.status,
      FieldPaths.priority,
      FieldPaths.sessionId,
      FieldPaths.traceId,
      FieldPaths.spanId,
      FieldPaths.parentSpanId,
      FieldPaths.resource,
      FieldPaths.context,
      FieldPaths.attributes,
      FieldPaths.payload,
      FieldPaths.eventPhase,
      FieldPaths.resourceSdkName,
      FieldPaths.resourceSdkVersion,
      FieldPaths.resourceSdkCoreVersion,
      FieldPaths.resourceSdkNativeVersion,
      FieldPaths.resourceAppAppKey,
      FieldPaths.resourceAppAppName,
      FieldPaths.resourceAppAppVersion,
      FieldPaths.resourceAppBuildNumber,
      FieldPaths.resourceAppPackageName,
      FieldPaths.resourceAppEnvironment,
      FieldPaths.resourceAppChannel,
      FieldPaths.resourceAppFlavor,
      FieldPaths.resourceDevicePlatform,
      FieldPaths.resourceDeviceModel,
      FieldPaths.resourceDeviceManufacturer,
      FieldPaths.resourceDeviceOsVersion,
      FieldPaths.resourceDeviceIsPhysicalDevice,
      FieldPaths.resourceDeviceRefreshRate,
      FieldPaths.resourceDeviceDeviceTier,
      FieldPaths.resourceRuntimeFlutterVersion,
      FieldPaths.resourceRuntimeDartVersion,
      FieldPaths.resourceRuntimeIsDebug,
      FieldPaths.contextUserUserId,
      FieldPaths.contextUserUserType,
      FieldPaths.contextUserUserTags,
      FieldPaths.contextUserCohort,
      FieldPaths.contextRouteName,
      FieldPaths.contextRouteStack,
      FieldPaths.contextRouteSource,
      FieldPaths.contextModuleName,
      FieldPaths.contextModuleScene,
      FieldPaths.contextNetworkType,
      FieldPaths.contextNetworkIsWeakNetwork,
      FieldPaths.contextReleaseReleaseId,
      FieldPaths.contextReleaseFeatureFlags,
      FieldPaths.contextReleaseExperiments,
      FieldPaths.contextLifecycleState,
      FieldPaths.contextLifecyclePreviousState,
      FieldPaths.contextLifecycleIsForeground,
      FieldPaths.contextNativeAvailable,
      FieldPaths.contextNativePlatform,
      FieldPaths.contextNativeProcessId,
      FieldPaths.contextNativeBridgeVersion,
      FieldPaths.contextNativeSignalSource,
      FieldPaths.contextMissing,
      FieldPaths.contextMissingReason,
      FieldPaths.appStartType,
      FieldPaths.appFirstFrameMs,
      FieldPaths.appInteractiveMs,
      FieldPaths.sdkInitDurationMs,
      FieldPaths.nativeStartElapsedMs,
      FieldPaths.pageFirstFrameMs,
      FieldPaths.pageInteractiveMs,
      FieldPaths.pageFrom,
      FieldPaths.pageTo,
      FieldPaths.pageInstanceId,
      FieldPaths.pageLoadMs,
      FieldPaths.httpMethod,
      FieldPaths.httpUrlNormalized,
      FieldPaths.httpStatusCode,
      FieldPaths.httpSuccess,
      FieldPaths.httpErrorType,
      FieldPaths.httpRetryCount,
      FieldPaths.httpCacheStatus,
      FieldPaths.requestSizeBytes,
      FieldPaths.responseSizeBytes,
      FieldPaths.uiTarget,
      FieldPaths.uiAction,
      FieldPaths.businessAction,
      FieldPaths.businessResult,
      FieldPaths.jankCount,
      FieldPaths.frameMaxMs,
      FieldPaths.frameAvgMs,
      FieldPaths.frameBudgetMs,
      FieldPaths.frameFps,
      FieldPaths.frameStability,
      FieldPaths.frameP50Ms,
      FieldPaths.frameP90Ms,
      FieldPaths.frameP99Ms,
      FieldPaths.memoryRssMb,
      FieldPaths.memoryHeapUsedMb,
      FieldPaths.memoryHeapCapacityMb,
      FieldPaths.memoryExternalMb,
      FieldPaths.memoryNativeUsedMb,
      FieldPaths.memoryGrowthMb,
      FieldPaths.memoryGrowthDurationMs,
      FieldPaths.memoryPressureLevel,
      FieldPaths.memorySampleSource,
      FieldPaths.appExitFlushSuccess,
      FieldPaths.nativeSignal,
      FieldPaths.nativeThread,
      FieldPaths.nativeThreadId,
      FieldPaths.nativeCrashType,
      FieldPaths.nativeAnrDurationMs,
      FieldPaths.nativeOomReason,
      FieldPaths.errorType,
      FieldPaths.errorMechanism,
      FieldPaths.errorHandled,
      FieldPaths.errorFatal,
      FieldPaths.errorThread,
      FieldPaths.payloadErrorMessage,
      FieldPaths.payloadErrorStacktrace,
      FieldPaths.payloadErrorLibrary,
      FieldPaths.payloadBreadcrumbs,
      FieldPaths.payloadTruncated,
      FieldPaths.payloadTruncatedReason,
      FieldPaths.payloadTrace,
      FieldPaths.payloadNative,
      FieldPaths.payloadProperties,
      FieldPaths.httpUrlQuery,
      FieldPaths.httpRequestBody,
      FieldPaths.httpResponseBody,
      FieldPaths.httpRequestHeadersCookie,
      FieldPaths.authToken,
    };

    expect(paths, canonicalPaths);
  });
}
