abstract final class FieldPaths {
  static const schemaVersion = 'schemaVersion';
  static const eventId = 'eventId';
  static const timestamp = 'timestamp';
  static const startTime = 'startTime';
  static const endTime = 'endTime';
  static const durationMs = 'durationMs';
  static const signalType = 'signalType';
  static const name = 'name';
  static const level = 'level';
  static const status = 'status';
  static const priority = 'priority';
  static const sessionId = 'sessionId';
  static const traceId = 'traceId';
  static const spanId = 'spanId';
  static const parentSpanId = 'parentSpanId';
  static const resource = 'resource';
  static const context = 'context';
  static const attributes = 'attributes';
  static const payload = 'payload';
  static const eventPhase = 'event.phase';

  static const resourceSdkName = 'resource.sdk.name';
  static const resourceSdkVersion = 'resource.sdk.version';
  static const resourceSdkCoreVersion = 'resource.sdk.coreVersion';
  static const resourceSdkNativeVersion = 'resource.sdk.nativeVersion';

  static const resourceAppAppKey = 'resource.app.appKey';
  static const resourceAppAppName = 'resource.app.appName';
  static const resourceAppAppVersion = 'resource.app.appVersion';
  static const resourceAppBuildNumber = 'resource.app.buildNumber';
  static const resourceAppPackageName = 'resource.app.packageName';
  static const resourceAppEnvironment = 'resource.app.environment';
  static const resourceAppChannel = 'resource.app.channel';
  static const resourceAppFlavor = 'resource.app.flavor';

  static const resourceDevicePlatform = 'resource.device.platform';
  static const resourceDeviceModel = 'resource.device.model';
  static const resourceDeviceManufacturer = 'resource.device.manufacturer';
  static const resourceDeviceOsVersion = 'resource.device.osVersion';
  static const resourceDeviceIsPhysicalDevice =
      'resource.device.isPhysicalDevice';
  static const resourceDeviceRefreshRate = 'resource.device.refreshRate';
  static const resourceDeviceDeviceTier = 'resource.device.deviceTier';

  static const resourceRuntimeFlutterVersion =
      'resource.runtime.flutterVersion';
  static const resourceRuntimeDartVersion = 'resource.runtime.dartVersion';
  static const resourceRuntimeIsDebug = 'resource.runtime.isDebug';

  static const contextUserUserId = 'context.user.userId';
  static const contextUserUserType = 'context.user.userType';
  static const contextUserUserTags = 'context.user.userTags';
  static const contextUserCohort = 'context.user.cohort';

  static const contextRouteName = 'context.route.name';
  static const contextRouteStack = 'context.route.stack';
  static const contextRouteSource = 'context.route.source';

  static const contextModuleName = 'context.module.name';
  static const contextModuleScene = 'context.module.scene';

  static const contextNetworkType = 'context.network.type';
  static const contextNetworkIsWeakNetwork = 'context.network.isWeakNetwork';

  static const contextReleaseReleaseId = 'context.release.releaseId';
  static const contextReleaseFeatureFlags = 'context.release.featureFlags';
  static const contextReleaseExperiments = 'context.release.experiments';

  static const contextLifecycleState = 'context.lifecycle.state';
  static const contextLifecyclePreviousState =
      'context.lifecycle.previousState';
  static const contextLifecycleIsForeground = 'context.lifecycle.isForeground';

  static const contextNativeAvailable = 'context.native.available';
  static const contextNativePlatform = 'context.native.platform';
  static const contextNativeProcessId = 'context.native.processId';
  static const contextNativeBridgeVersion = 'context.native.bridgeVersion';
  static const contextNativeSignalSource = 'context.native.signalSource';

  static const contextMissing = 'context.missing';
  static const contextMissingReason = 'context.missingReason';

  static const appStartType = 'app.start.type';
  static const appStartEndReason = 'app.start.end_reason';
  static const appFirstFrameMs = 'app.first_frame_ms';
  static const appInteractiveMs = 'app.interactive_ms';
  static const sdkInitDurationMs = 'sdk.init.duration_ms';
  static const nativeStartElapsedMs = 'native.start.elapsed_ms';

  static const pageFirstFrameMs = 'page.first_frame_ms';
  static const pageInteractiveMs = 'page.interactive_ms';
  static const pageFrom = 'page.from';
  static const pageTo = 'page.to';
  static const pageInstanceId = 'page.instance_id';
  static const pageActiveWindowId = 'page.active_window_id';
  static const pageActivePhase = 'page.active_phase';
  static const pageLoadMs = 'page.load_ms';

  static const httpMethod = 'http.method';
  static const httpUrlNormalized = 'http.url.normalized';
  static const httpStatusCode = 'http.status_code';
  static const httpSuccess = 'http.success';
  static const httpErrorType = 'http.error_type';
  static const httpRetryCount = 'http.retry_count';
  static const httpCacheStatus = 'http.cache_status';
  static const requestSizeBytes = 'request.size_bytes';
  static const responseSizeBytes = 'response.size_bytes';

  static const uiTarget = 'ui.target';
  static const uiAction = 'ui.action';
  static const businessAction = 'business.action';
  static const businessResult = 'business.result';

  static const jankCount = 'jank.count';
  static const frameMaxMs = 'frame.max_ms';
  static const frameAvgMs = 'frame.avg_ms';
  static const frameBudgetMs = 'frame.budget_ms';
  static const frameFps = 'frame.fps';
  static const frameStability = 'frame.stability';
  static const frameP50Ms = 'frame.p50_ms';
  static const frameP90Ms = 'frame.p90_ms';
  static const frameP99Ms = 'frame.p99_ms';
  static const frameWindowId = 'frame.window_id';
  static const frameWindowType = 'frame.window_type';
  static const frameWindowPhase = 'frame.window_phase';
  static const frameSampleCount = 'frame.sample_count';
  static const frameSlowCount = 'frame.slow_count';
  static const frameDroppedCount = 'frame.dropped_count';
  static const frameRefreshRate = 'frame.refresh_rate';

  static const memoryRssMb = 'memory.rss_mb';
  static const memoryHeapUsedMb = 'memory.heap_used_mb';
  static const memoryHeapCapacityMb = 'memory.heap_capacity_mb';
  static const memoryExternalMb = 'memory.external_mb';
  static const memoryNativeUsedMb = 'memory.native_used_mb';
  static const memoryGrowthMb = 'memory.growth_mb';
  static const memoryGrowthDurationMs = 'memory.growth_duration_ms';
  static const memoryPressureLevel = 'memory.pressure_level';
  static const memorySampleSource = 'memory.sample_source';
  static const memorySamplePhase = 'memory.sample_phase';
  static const memorySampleDelayMs = 'memory.sample_delay_ms';

  static const appExitFlushSuccess = 'app.exit_flush.success';

  static const nativeSignal = 'native.signal';
  static const nativeThread = 'native.thread';
  static const nativeThreadId = 'native.thread_id';
  static const nativeCrashType = 'native.crash.type';
  static const nativeAnrDurationMs = 'native.anr.duration_ms';
  static const nativeOomReason = 'native.oom.reason';

  static const errorType = 'error.type';
  static const errorMechanism = 'error.mechanism';
  static const errorHandled = 'error.handled';
  static const errorFatal = 'error.fatal';
  static const errorThread = 'error.thread';

  static const payloadErrorMessage = 'payload.error.message';
  static const payloadErrorStacktrace = 'payload.error.stacktrace';
  static const payloadErrorLibrary = 'payload.error.library';
  static const payloadBreadcrumbs = 'payload.breadcrumbs';
  static const payloadTruncated = 'payload.truncated';
  static const payloadTruncatedReason = 'payload.truncated.reason';
  static const payloadTrace = 'payload.trace';
  static const payloadNative = 'payload.native';
  static const payloadProperties = 'payload.properties';

  static const httpUrlQuery = 'http.url.query';
  static const httpRequestBody = 'http.request.body';
  static const httpResponseBody = 'http.response.body';
  static const httpRequestHeadersCookie = 'http.request.headers.cookie';
  static const authToken = 'auth.token';
}
