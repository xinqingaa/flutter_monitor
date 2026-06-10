import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('exposes core constants', () {
    expect(flutterMonitorCorePackageName, 'flutter_monitor_core');
    expect(flutterMonitorSchemaVersion, '1.0');
    expect(defaultBreadcrumbLimit, 50);
  });

  test('exposes canonical field paths', () {
    expect(FieldPaths.contextRouteName, 'context.route.name');
    expect(FieldPaths.resourceDeviceDeviceTier, 'resource.device.deviceTier');
    expect(FieldPaths.memoryRssMb, 'memory.rss_mb');
    expect(FieldPaths.memoryPressureLevel, 'memory.pressure_level');
    expect(FieldPaths.nativeSignal, 'native.signal');
    expect(FieldPaths.authToken, 'auth.token');
    expect(FieldPaths.sdkOutputMode, 'sdk.output.mode');
    expect(FieldPaths.sdkDropReason, 'sdk.drop.reason');
    expect(FieldPaths.sdkRetryDelayMs, 'sdk.retry.delay_ms');
  });

  test('exposes canonical event names for memory lifecycle and native', () {
    expect(EventNames.appColdStart, 'app.cold_start');
    expect(EventNames.pageVisit, 'page.visit');
    expect(EventNames.pageLoad, 'page.load');
    expect(EventNames.routePop, 'route.pop');
    expect(EventNames.httpClient, 'http.client');
    expect(EventNames.interactionMeasure, 'interaction.measure');
    expect(EventNames.uiJankSequence, 'ui.jank.sequence');
    expect(EventNames.memorySample, 'memory.sample');
    expect(EventNames.memoryLeakSuspect, 'memory.leak.suspect');
    expect(EventNames.nativeMemorySample, 'native.memory.sample');
    expect(EventNames.nativeCrash, 'native.crash');
    expect(EventNames.appForegroundDuration, 'app.foreground_duration');
    expect(EventNames.sdkLifecycleFlush, 'sdk.lifecycle.flush');
    expect(EventNames.sdkOutputFlush, 'sdk.output.flush');
    expect(EventNames.sdkQueueDrop, 'sdk.queue.drop');
    expect(EventNames.sdkRetrySchedule, 'sdk.retry.schedule');
    expect(EventNames.sdkConfigApplied, 'sdk.config.applied');
    expect(
      EventNames.sdkPipelineValidationFailed,
      'sdk.pipeline.validation_failed',
    );
  });

  test('exposes stable payload keys and protocol values', () {
    expect(PayloadKeys.routeName, 'route.name');
    expect(PayloadKeys.httpSource, 'http.source');
    expect(PayloadKeys.errorTruncated, 'error.truncated');
    expect(PayloadKeys.errorOriginalLength, 'error.original_length');
    expect(PayloadKeys.startupPhase, 'startup.phase');
    expect(PayloadKeys.unregisteredAttributes, 'unregistered.attributes');
    expect(FieldPaths.appStartEndReason, 'app.start.end_reason');
    expect(FieldPaths.interactionMode, 'interaction.mode');

    expect(ErrorTypes.dartError, 'dart_error');
    expect(EventPhases.start, 'start');
    expect(EventPhases.end, 'end');
    expect(EventPhases.instant, 'instant');
    expect(HttpErrorTypes.httpStatus, 'http_status');
    expect(HttpErrorTypes.connectionError, 'connection_error');
    expect(HttpErrorTypes.timeout, 'timeout');
    expect(HttpErrorTypes.badCertificate, 'bad_certificate');
    expect(HttpPayloadSources.packageHttp, 'package:http');
    expect(StartupPhases.firstFrame, 'first_frame');
    expect(StartupEndReasons.firstFrame, 'first_frame');
    expect(StartupEndReasons.interactive, 'interactive');
    expect(PageActivePhases.enter, 'page.enter');
    expect(PageActivePhases.resume, 'page.resume');
    expect(PageActiveTriggers.routePush, 'route_push');
    expect(PageActiveTriggers.routePop, 'route_pop');
    expect(PageActiveTriggers.lifecycleResumed, 'lifecycle_resumed');
    expect(PageActiveTriggers.lifecycleBackground, 'lifecycle_background');
    expect(InteractionEndReasons.autoWindow, 'auto_window');
    expect(InteractionEndReasons.timeout, 'timeout');
    expect(SdkOutputModes.consoleOnly, 'consoleOnly');
    expect(SdkOutputModes.localLive, 'localLive');
    expect(SdkOutputModes.production, 'production');
    expect(SdkFlushReasons.criticalEvent, 'critical_event');
    expect(SdkDropReasons.queueFull, 'queue_full');
    expect(SdkRetryReasons.rateLimited, 'rate_limited');
    expect(SdkConfigSources.cachedRemote, 'cached_remote');
  });

  test('exposes stable wire values for memory and native protocol enums', () {
    expect(MonitorMeasureMode.common.toJson(), 'common');
    expect(MonitorMeasureMode.stage.toJson(), 'stage');
    expect(MonitorMeasureMode.fromJson('stage'), MonitorMeasureMode.stage);
    expect(MonitorMeasureResult.success.toJson(), 'success');
    expect(MonitorMeasureResult.timeout.toJson(), 'timeout');
    expect(
      MonitorMeasureResult.fromJson('cancelled'),
      MonitorMeasureResult.cancelled,
    );

    expect(MemorySampleSource.dart.toJson(), 'dart');
    expect(MemorySampleSource.native.toJson(), 'native');
    expect(MemorySampleSource.fromJson('system'), MemorySampleSource.system);
    expect(MemorySampleSource.fromJson('bad'), MemorySampleSource.unknown);

    expect(MemoryPressureLevel.none.toJson(), 'none');
    expect(MemoryPressureLevel.critical.toJson(), 'critical');
    expect(
      MemoryPressureLevel.fromJson('moderate'),
      MemoryPressureLevel.moderate,
    );
    expect(MemoryPressureLevel.fromJson('bad'), MemoryPressureLevel.unknown);

    expect(NativeSignalType.memory.toJson(), 'memory');
    expect(NativeSignalType.lifecycle.toJson(), 'lifecycle');
    expect(NativeSignalType.fromJson('oom'), NativeSignalType.oom);
    expect(NativeSignalType.fromJson('bad'), NativeSignalType.memory);
  });
}
