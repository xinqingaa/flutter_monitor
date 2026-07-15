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
      registry.lookup(FieldPaths.contextRouteFullName)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(registry.lookup(FieldPaths.contextRouteFullName)?.indexed, isTrue);
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
      registry.lookup(FieldPaths.httpRequestId)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.httpRouteChanged)?.valueType,
      FieldValueType.boolean,
    );
    expect(registry.lookup(FieldPaths.httpRouteChanged)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.httpCompletionRouteName)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.httpCompletionRouteName)?.indexed,
      isTrue,
    );
    expect(
      registry.lookup(FieldPaths.httpCompletionRouteFullName)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.httpCompletionPageInstanceId)?.privacyLevel,
      PrivacyLevel.queryable,
    );
    expect(
      registry.lookup(FieldPaths.httpQuery)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.httpDetail)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.httpDetailDropped)?.valueType,
      FieldValueType.boolean,
    );
    expect(
      registry.lookup(FieldPaths.httpRequestBody)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.httpResponseBody)?.privacyLevel,
      PrivacyLevel.sensitive,
    );
    expect(
      registry.lookup(FieldPaths.memoryRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryStartRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryEndRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryDeltaRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryEnterRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryExitRssMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryNativeUsedMb)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memoryGrowthDurationMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.memoryPressureLevel)?.valueType,
      FieldValueType.string,
    );
    expect(registry.lookup(FieldPaths.memorySampleSource)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.appExitFlushSuccess)?.valueType,
      FieldValueType.boolean,
    );
    expect(
      registry.lookup(FieldPaths.nativeSignal)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.nativeAnrDurationMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.sdkInitDurationMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.sdkOutputMode)?.valueType,
      FieldValueType.string,
    );
    expect(registry.lookup(FieldPaths.sdkOutputMode)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.sdkQueueLength)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.sdkQueueBytes)?.privacyLevel,
      PrivacyLevel.safe,
    );
    expect(
      registry.lookup(FieldPaths.sdkBatchSize)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.sdkFlushDurationMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.sdkRetryDelayMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.sdkDropReason)?.valueType,
      FieldValueType.string,
    );
    expect(registry.lookup(FieldPaths.sdkDropReason)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.sdkHealthDroppedCount)?.valueType,
      FieldValueType.number,
    );
    expect(registry.lookup(FieldPaths.sdkHealthSentCount)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.sdkConfigAppliedAt)?.valueType,
      FieldValueType.timestamp,
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
      registry.lookup(FieldPaths.pageActivePhase)?.valueType,
      FieldValueType.string,
    );
    expect(
      registry.lookup(FieldPaths.pageActiveTrigger)?.valueType,
      FieldValueType.string,
    );
    expect(registry.lookup(FieldPaths.pageActiveTrigger)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.interactionMode)?.valueType,
      FieldValueType.string,
    );
    expect(registry.lookup(FieldPaths.interactionMode)?.indexed, isTrue);
    expect(
      registry.lookup(FieldPaths.interactionActiveMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.interactionTimeoutMs)?.valueType,
      FieldValueType.durationMs,
    );
    expect(
      registry.lookup(FieldPaths.frameSampleCount)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.frameRefreshRate)?.valueType,
      FieldValueType.number,
    );
    expect(
      registry.lookup(FieldPaths.memorySamplePhase)?.valueType,
      FieldValueType.string,
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
    expect(paths, isNot(contains('native.memory.sample_source')));
    expect(paths, isNot(contains('memory.leak.confirmed')));
    expect(paths, isNot(contains('memory.leak_detected')));
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
      FieldPaths.contextRouteFullName,
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
      FieldPaths.appStartEndReason,
      FieldPaths.appFirstFrameMs,
      FieldPaths.appInteractiveMs,
      FieldPaths.sdkInitDurationMs,
      FieldPaths.sdkOutputMode,
      FieldPaths.sdkQueueLength,
      FieldPaths.sdkQueueBytes,
      FieldPaths.sdkQueueMaxEvents,
      FieldPaths.sdkQueueMaxBytes,
      FieldPaths.sdkBatchSize,
      FieldPaths.sdkBatchBytes,
      FieldPaths.sdkFlushReason,
      FieldPaths.sdkFlushDurationMs,
      FieldPaths.sdkRetryCount,
      FieldPaths.sdkRetryDelayMs,
      FieldPaths.sdkRetryReason,
      FieldPaths.sdkDropCount,
      FieldPaths.sdkDropReason,
      FieldPaths.sdkHealthWindowMs,
      FieldPaths.sdkHealthEnqueuedCount,
      FieldPaths.sdkHealthSentCount,
      FieldPaths.sdkHealthDroppedCount,
      FieldPaths.sdkHealthRetryCount,
      FieldPaths.sdkHealthFlushSuccessCount,
      FieldPaths.sdkHealthFlushFailureCount,
      FieldPaths.sdkConfigVersion,
      FieldPaths.sdkConfigSource,
      FieldPaths.sdkConfigAppliedAt,
      FieldPaths.sdkConfigExpiresAt,
      FieldPaths.nativeStartElapsedMs,
      FieldPaths.pageFirstFrameMs,
      FieldPaths.pageInteractiveMs,
      FieldPaths.pageFrom,
      FieldPaths.pageFromFullName,
      FieldPaths.pageTo,
      FieldPaths.pageToFullName,
      FieldPaths.pageInstanceId,
      FieldPaths.pageActivePhase,
      FieldPaths.pageActiveTrigger,
      FieldPaths.pageLoadMs,
      FieldPaths.httpMethod,
      FieldPaths.httpUrlNormalized,
      FieldPaths.httpStatusCode,
      FieldPaths.httpSuccess,
      FieldPaths.httpErrorType,
      FieldPaths.httpRetryCount,
      FieldPaths.httpCacheStatus,
      FieldPaths.httpRequestId,
      FieldPaths.httpRouteChanged,
      FieldPaths.httpCompletionRouteName,
      FieldPaths.httpCompletionRouteFullName,
      FieldPaths.httpCompletionPageInstanceId,
      FieldPaths.summaryCount,
      FieldPaths.summaryDurationP50Ms,
      FieldPaths.summaryDurationP95Ms,
      FieldPaths.summaryDurationMaxMs,
      FieldPaths.summaryBytesTotal,
      FieldPaths.requestSizeBytes,
      FieldPaths.responseSizeBytes,
      FieldPaths.uiTarget,
      FieldPaths.uiAction,
      FieldPaths.businessAction,
      FieldPaths.businessResult,
      FieldPaths.interactionMode,
      FieldPaths.interactionEndReason,
      FieldPaths.interactionActiveMs,
      FieldPaths.interactionSettleMs,
      FieldPaths.interactionObserveMs,
      FieldPaths.interactionTimeoutMs,
      FieldPaths.jankCount,
      FieldPaths.frameMaxMs,
      FieldPaths.frameAvgMs,
      FieldPaths.frameBudgetMs,
      FieldPaths.frameFps,
      FieldPaths.frameStability,
      FieldPaths.frameP50Ms,
      FieldPaths.frameP90Ms,
      FieldPaths.frameP99Ms,
      FieldPaths.frameSampleCount,
      FieldPaths.frameSlowCount,
      FieldPaths.frameDroppedCount,
      FieldPaths.frameRefreshRate,
      FieldPaths.memoryRssMb,
      FieldPaths.memoryStartRssMb,
      FieldPaths.memoryEndRssMb,
      FieldPaths.memoryDeltaRssMb,
      FieldPaths.memoryEnterRssMb,
      FieldPaths.memoryExitRssMb,
      FieldPaths.memoryHeapUsedMb,
      FieldPaths.memoryHeapCapacityMb,
      FieldPaths.memoryExternalMb,
      FieldPaths.memoryNativeUsedMb,
      FieldPaths.memoryGrowthMb,
      FieldPaths.memoryGrowthDurationMs,
      FieldPaths.memoryPressureLevel,
      FieldPaths.memorySampleSource,
      FieldPaths.memorySamplePhase,
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
      FieldPaths.errorFingerprint,
      FieldPaths.errorTitle,
      FieldPaths.errorStackHead,
      FieldPaths.errorAppFrame,
      FieldPaths.payloadErrorMessage,
      FieldPaths.payloadErrorStacktrace,
      FieldPaths.payloadErrorLibrary,
      FieldPaths.payloadErrorDiagnostics,
      FieldPaths.payloadBreadcrumbs,
      FieldPaths.payloadTruncated,
      FieldPaths.payloadTruncatedReason,
      FieldPaths.payloadTrace,
      FieldPaths.payloadNative,
      FieldPaths.payloadProperties,
      FieldPaths.httpQuery,
      FieldPaths.httpDetail,
      FieldPaths.httpDetailDropped,
      FieldPaths.httpUrlQuery,
      FieldPaths.httpRequestBody,
      FieldPaths.httpResponseBody,
      FieldPaths.httpRequestHeadersCookie,
      FieldPaths.authToken,
    };

    expect(paths, canonicalPaths);
  });
}
