abstract final class EventNames {
  static const appColdStart = 'app.cold_start';
  static const appInteractive = 'app.interactive';
  static const appLifecycle = 'app.lifecycle';
  static const appForegroundDuration = 'app.foreground_duration';
  static const appBackgroundDuration = 'app.background_duration';
  static const appHotStart = 'app.hot_start';

  static const sdkInit = 'sdk.init';
  static const sdkLifecycleFlush = 'sdk.lifecycle.flush';
  static const sdkMemorySampleUnavailable = 'sdk.memory.sample_unavailable';
  static const sdkOutputDispatchFailed = 'sdk.output.dispatch_failed';
  static const sdkOutputFlushFailed = 'sdk.output.flush_failed';
  static const sdkOutputDisposeFailed = 'sdk.output.dispose_failed';
  static const sdkPipelineValidationFailed = 'sdk.pipeline.validation_failed';
  static const sdkPipelineEnvelopeBuildFailed =
      'sdk.pipeline.envelope_build_failed';
  static const sdkTraceEndUnknown = 'sdk.trace.end_unknown';
  static const sdkSpanEndUnknown = 'sdk.span.end_unknown';
  static const sdkHttpSpanEndFailed = 'sdk.http.span_end_failed';
  static const sdkOutputFlush = 'sdk.output.flush';
  static const sdkQueueDrop = 'sdk.queue.drop';
  static const sdkQueueState = 'sdk.queue.state';
  static const sdkRetrySchedule = 'sdk.retry.schedule';
  static const sdkConfigApplied = 'sdk.config.applied';
  static const sdkHealthReport = 'sdk.health.report';

  static const pageVisit = 'page.visit';
  static const pageView = 'page.view';
  static const pageLoad = 'page.load';
  static const pageStay = 'page.stay';

  static const routePush = 'route.push';
  static const routePop = 'route.pop';

  static const httpClient = 'http.client';

  /// 压力降级时由队列聚合产生的 HTTP 摘要事件。
  static const httpClientSummary = 'http.client.summary';

  /// track 超限或队列降级时聚合产生的业务动作摘要事件。
  static const businessActionSummary = 'business.action.summary';

  static const uiClick = 'ui.click';
  static const uiJankSequence = 'ui.jank.sequence';

  static const interactionMeasure = 'interaction.measure';

  static const memorySample = 'memory.sample';
  static const memoryGrowth = 'memory.growth';
  static const memoryPressure = 'memory.pressure';
  static const memoryLeakSuspect = 'memory.leak.suspect';

  static const nativeMemorySample = 'native.memory.sample';
  static const nativeMemoryPressure = 'native.memory.pressure';
  static const nativeLifecycle = 'native.lifecycle';
  static const nativeWarning = 'native.warning';
  static const nativeCrash = 'native.crash';
  static const nativeOom = 'native.oom';
  static const nativeAnr = 'native.anr';

  static const errorFlutter = 'error.flutter';
  static const errorDart = 'error.dart';
  static const errorManual = 'error.manual';

  /// 同 fingerprint 重复错误的聚合摘要。
  static const errorGroupSummary = 'error.group.summary';
}
