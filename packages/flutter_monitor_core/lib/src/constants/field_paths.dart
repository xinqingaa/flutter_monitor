abstract final class FieldPaths {
  static const appStartType = 'app.start.type';
  static const appStartDurationMs = 'app.start.duration_ms';
  static const appFirstFrameMs = 'app.first_frame_ms';
  static const appInteractiveMs = 'app.interactive_ms';
  static const sdkInitDurationMs = 'sdk.init.duration_ms';
  static const nativeStartElapsedMs = 'native.start.elapsed_ms';
  static const appLifecycleState = 'app.lifecycle.state';
  static const appLifecyclePreviousState = 'app.lifecycle.previous_state';
  static const appForegroundDurationMs = 'app.foreground_duration_ms';
  static const appBackgroundDurationMs = 'app.background_duration_ms';
  static const appExitFlushSuccess = 'app.exit_flush.success';

  static const pageRoute = 'page.route';
  static const pageRouteSource = 'page.route.source';
  static const pageModule = 'page.module';
  static const pageScene = 'page.scene';
  static const pageFirstFrameMs = 'page.first_frame_ms';
  static const pageInteractiveMs = 'page.interactive_ms';
  static const pageStayMs = 'page.stay_ms';

  static const httpMethod = 'http.method';
  static const httpUrlNormalized = 'http.url.normalized';
  static const httpStatusCode = 'http.status_code';
  static const httpSuccess = 'http.success';
  static const httpErrorType = 'http.error_type';
  static const httpRetryCount = 'http.retry_count';
  static const httpCacheStatus = 'http.cache_status';
  static const requestSizeBytes = 'request.size_bytes';
  static const responseSizeBytes = 'response.size_bytes';

  static const errorType = 'error.type';
  static const errorMessage = 'error.message';
  static const errorStacktrace = 'error.stacktrace';
  static const errorHandled = 'error.handled';
  static const errorMechanism = 'error.mechanism';
  static const errorThread = 'error.thread';

  static const uiFrameMaxMs = 'ui.frame.max_ms';
  static const uiFrameCount = 'ui.frame.count';
  static const uiJankCount = 'ui.jank.count';
  static const uiJankDurationMs = 'ui.jank.duration_ms';

  static const memoryRssMb = 'memory.rss_mb';
  static const memoryHeapUsedMb = 'memory.heap_used_mb';
  static const memoryHeapCapacityMb = 'memory.heap_capacity_mb';
  static const memoryExternalMb = 'memory.external_mb';
  static const memoryNativeUsedMb = 'memory.native_used_mb';
  static const memoryGrowthMb = 'memory.growth_mb';
  static const memoryGrowthDurationMs = 'memory.growth_duration_ms';
  static const memoryPressureLevel = 'memory.pressure_level';
  static const memorySampleSource = 'memory.sample_source';

  static const nativePlatform = 'native.platform';
  static const nativeSignal = 'native.signal';
  static const nativeThread = 'native.thread';
  static const nativeThreadId = 'native.thread_id';
  static const nativeCrashType = 'native.crash.type';
  static const nativeAnrDurationMs = 'native.anr.duration_ms';
  static const nativeOomReason = 'native.oom.reason';
  static const nativeMemoryUsedMb = 'native.memory.used_mb';
  static const nativeMemoryPressureLevel = 'native.memory.pressure_level';

  static const httpUrlQuery = 'http.url.query';
  static const httpRequestBody = 'http.request.body';
  static const httpResponseBody = 'http.response.body';
  static const httpRequestHeadersCookie = 'http.request.headers.cookie';
  static const authToken = 'auth.token';
}
