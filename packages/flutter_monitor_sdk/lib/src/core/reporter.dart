import 'dart:async';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_manager.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';
import 'package:flutter_monitor_sdk/src/native/native_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/pipeline/event_pipeline.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_result.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/breadcrumb_store.dart';
import 'package:flutter_monitor_sdk/src/tracing/session_manager.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_manager.dart';

/// Reporter 是 SDK 的数据心脏，负责收集、丰富、缓存和发送所有监控事件。
class Reporter {
  static const int _httpErrorPayloadMaxLength = 300;
  static const Duration _nativeBootstrapResourceTimeout = Duration(
    milliseconds: 120,
  );

  final MonitorConfig _config;
  late final ContextManager _contextManager;
  late final SessionManager _sessionManager;
  late final TraceManager _traceManager;
  late final BreadcrumbStore _breadcrumbStore;
  late final EventPipeline _pipeline;
  final NativeSignalMapper _nativeSignalMapper = const NativeSignalMapper();

  /// 缓存的设备信息，避免每次上报都重新获取。
  Map<String, dynamic>? _deviceInfo;
  var _backgroundFlushPending = false;
  DateTime? _foregroundStartedAt;
  String? _pendingHotStartTraceId;
  final Map<String, _PageTraceRecord> _pageTraces =
      <String, _PageTraceRecord>{};

  Reporter(this._config) {
    _init();
  }

  /// 获取最大队列大小
  int get maxQueueSize => _config.effectiveQueueConfig.maxQueueSize;

  void _init() {
    _contextManager = ContextManager(_config);
    _sessionManager = SessionManager();
    _traceManager = TraceManager();
    _breadcrumbStore = BreadcrumbStore(
      capacity: _config.effectiveQueueConfig.maxQueueSize,
    );
    _pipeline = EventPipeline(
      contextManager: _contextManager,
      sessionManager: _sessionManager,
      traceManager: _traceManager,
      breadcrumbStore: _breadcrumbStore,
      outputs: _config.effectiveOutputs,
    );

    // 初始化所有在配置中提供的输出器
    for (final output in _config.effectiveOutputs) {
      output.init();
    }
  }

  /// Resolve resources that should be present before the first envelope.
  Future<void> resolveBootstrapResources() async {
    await _fetchDeviceInfo();
    await resolveNativeBootstrapResource(_config.nativeBridge);
  }

  Future<void> initAsync() => resolveBootstrapResources();

  Future<void> resolveNativeBootstrapResource(
    MonitorNativeBridge? bridge,
  ) async {
    if (bridge == null) {
      _contextManager.setNativeSnapshot(null);
      return;
    }
    try {
      final snapshot = await bridge.getResourceSnapshot().timeout(
        _nativeBootstrapResourceTimeout,
      );
      _contextManager.setNativeSnapshot(snapshot);
    } catch (error) {
      _contextManager.setNativeSnapshot(
        const NativeResourceSnapshot(
          available: false,
          signalSource: PlatformSignalSources.flutter,
        ),
      );
      debugPrint('Native monitor bridge unavailable: $error');
    }
  }

  PipelineResult recordNativeSignal(NativeSignal signal) {
    try {
      return _pipeline.capture(_nativeSignalMapper.map(signal));
    } catch (error) {
      debugPrint('Native monitor signal failed: ${signal.name}: $error');
      return PipelineResult.rejected([
        SchemaValidationIssue(
          path: FieldPaths.payloadNative,
          code: 'native_signal_failed',
          message: error.toString(),
        ),
      ]);
    }
  }

  /// 使用 'device_info_plus' 插件异步获取设备信息。
  /// 可以在这里自定义需要收集的设备字段。
  Future<void> _fetchDeviceInfo() async {
    debugPrint("🔍 开始获取设备信息");
    final deviceInfoPlugin = DeviceInfoPlugin();
    try {
      if (kIsWeb) {
        final info = await deviceInfoPlugin.webBrowserInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'browserName': info.browserName.name,
          'appVersion': info.appVersion,
          'platform': info.platform,
        };
      } else if (Platform.isAndroid) {
        final info = await deviceInfoPlugin.androidInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'device': info.device,
          'model': info.model,
          'manufacturer': info.manufacturer,
          'version': info.version.release,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      } else if (Platform.isIOS) {
        final info = await deviceInfoPlugin.iosInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'name': info.name,
          'model': info.model,
          'manufacturer': 'Apple',
          'systemVersion': info.systemVersion,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      }
      _contextManager.deviceInfo = _deviceInfo?.cast<String, Object?>();
    } catch (e) {
      debugPrint("Failed to get device info: $e");
    }
  }

  String startTrace(
    String name, {
    DateTime? startTime,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.startTrace(
      name: name,
      startTime: startTime,
      attributes: attributes,
      payload: payload,
    );
    _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: name,
        signalType: SignalType.trace,
        timestamp: record.startTime,
        startTime: record.startTime,
        level: EventLevel.info,
        status: EventStatus.unknown,
        traceId: record.traceId,
        attributes: record.attributes,
        payload: record.payload,
      ),
    );
    return record.traceId;
  }

  PipelineResult? endTrace(
    String traceId, {
    DateTime? endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    bool? includeBreadcrumbs,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.endTrace(
      traceId,
      endTime: endTime,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
    if (record == null) {
      return reportSdkEvent(
        EventNames.sdkTraceEndUnknown,
        level: EventLevel.warning,
        payload: <String, Object?>{PayloadKeys.traceId: traceId},
      );
    }
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: record.name,
        signalType: SignalType.trace,
        timestamp: record.endTime ?? DateTime.now(),
        startTime: record.startTime,
        endTime: record.endTime,
        durationMs: record.durationMs,
        level: record.level,
        status: record.status,
        traceId: record.traceId,
        includeBreadcrumbs: includeBreadcrumbs,
        attributes: record.attributes,
        payload: record.payload,
      ),
    );
  }

  String startSpan(
    String name, {
    String? traceId,
    String? parentSpanId,
    DateTime? startTime,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.startSpan(
      name: name,
      traceId: traceId,
      parentSpanId: parentSpanId,
      startTime: startTime,
      attributes: attributes,
      payload: payload,
    );
    _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: name,
        signalType: SignalType.span,
        timestamp: record.startTime,
        startTime: record.startTime,
        level: EventLevel.info,
        status: EventStatus.unknown,
        traceId: record.traceId,
        spanId: record.spanId,
        parentSpanId: record.parentSpanId,
        attributes: record.attributes,
        payload: record.payload,
      ),
    );
    return record.spanId;
  }

  PipelineResult? endSpan(
    String spanId, {
    DateTime? endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    bool? includeBreadcrumbs,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.endSpan(
      spanId,
      endTime: endTime,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
    if (record == null) {
      return reportSdkEvent(
        EventNames.sdkSpanEndUnknown,
        level: EventLevel.warning,
        payload: <String, Object?>{PayloadKeys.spanId: spanId},
      );
    }
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: record.name,
        signalType: SignalType.span,
        timestamp: record.endTime ?? DateTime.now(),
        startTime: record.startTime,
        endTime: record.endTime,
        durationMs: record.durationMs,
        level: record.level,
        status: record.status,
        traceId: record.traceId,
        spanId: record.spanId,
        parentSpanId: record.parentSpanId,
        includeBreadcrumbs: includeBreadcrumbs,
        attributes: record.attributes,
        payload: record.payload,
      ),
    );
  }

  PipelineResult addBreadcrumb(
    String name, {
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: name,
        signalType: SignalType.breadcrumb,
        timestamp: DateTime.now(),
        level: level,
        status: EventStatus.ok,
        attributes: attributes,
        payload: payload,
      ),
    );
  }

  void startPageLoad(
    String routeName, {
    String? previousRouteName,
    DateTime? startTime,
  }) {
    if (routeName.isEmpty) return;
    final existing = _pageTraces.remove(routeName);
    if (existing != null) {
      _finishPageTrace(
        existing,
        endTime: startTime ?? DateTime.now(),
        status: EventStatus.unknown,
        payload: const <String, Object?>{PayloadKeys.pageReplaced: true},
      );
    }

    final startedAt = startTime ?? DateTime.now();
    final pageInstanceId = '${routeName}_${startedAt.microsecondsSinceEpoch}';
    setCurrentRoute(routeName);
    final traceId = startTrace(
      EventNames.pageVisit,
      startTime: startedAt,
      attributes: <String, Object?>{
        FieldPaths.pageInstanceId: pageInstanceId,
        if (previousRouteName != null) FieldPaths.pageFrom: previousRouteName,
      },
      payload: <String, Object?>{
        PayloadKeys.routeName: routeName,
        if (previousRouteName != null)
          PayloadKeys.routePrevious: previousRouteName,
      },
    );
    _recordCompletedSpan(
      name: EventNames.routePush,
      traceId: traceId,
      startTime: startedAt,
      endTime: startedAt,
      includeBreadcrumbs: false,
      attributes: <String, Object?>{
        FieldPaths.pageInstanceId: pageInstanceId,
        if (previousRouteName != null) FieldPaths.pageFrom: previousRouteName,
      },
      payload: <String, Object?>{
        PayloadKeys.routeName: routeName,
        if (previousRouteName != null)
          PayloadKeys.routePrevious: previousRouteName,
      },
    );
    final loadSpanId = startSpan(
      EventNames.pageLoad,
      traceId: traceId,
      startTime: startedAt,
      attributes: <String, Object?>{
        FieldPaths.pageInstanceId: pageInstanceId,
        if (previousRouteName != null) FieldPaths.pageFrom: previousRouteName,
      },
      payload: <String, Object?>{
        PayloadKeys.routeName: routeName,
        if (previousRouteName != null)
          PayloadKeys.routePrevious: previousRouteName,
      },
    );
    _pageTraces[routeName] = _PageTraceRecord(
      routeName: routeName,
      traceId: traceId,
      loadSpanId: loadSpanId,
      pageInstanceId: pageInstanceId,
      startedAt: startedAt,
      previousRouteName: previousRouteName,
    );
    _traceManager.setActiveTrace(traceId: traceId);
  }

  PipelineResult recordPageView(String routeName) {
    return addBreadcrumb(
      EventNames.pageView,
      payload: <String, Object?>{
        PayloadKeys.type: EventNames.pageView,
        PayloadKeys.page: routeName,
      },
    );
  }

  void finishPageFirstFrame(String routeName, {DateTime? endTime}) {
    final record = _pageTraces[routeName];
    if (record == null || record.firstFrameReported) {
      return;
    }
    final finishedAt = endTime ?? DateTime.now();
    final durationMs = finishedAt.difference(record.startedAt).inMilliseconds;
    final spanId = startSpan(
      EventNames.pageFirstFrame,
      traceId: record.traceId,
      startTime: record.startedAt,
      attributes: <String, Object?>{FieldPaths.pageFirstFrameMs: durationMs},
      payload: <String, Object?>{PayloadKeys.routeName: routeName},
    );
    endSpan(
      spanId,
      endTime: finishedAt,
      includeBreadcrumbs: false,
      attributes: <String, Object?>{FieldPaths.pageFirstFrameMs: durationMs},
      payload: <String, Object?>{PayloadKeys.routeName: routeName},
    );
    if (!record.loadTraceFinished) {
      endSpan(
        record.loadSpanId,
        endTime: finishedAt,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.pageInstanceId: record.pageInstanceId,
          FieldPaths.pageFirstFrameMs: durationMs,
          FieldPaths.pageLoadMs: durationMs,
          if (record.previousRouteName != null)
            FieldPaths.pageFrom: record.previousRouteName,
        },
        payload: <String, Object?>{PayloadKeys.routeName: routeName},
      );
    }
    _pageTraces[routeName] = record.copyWith(
      firstFrameReported: true,
      loadTraceFinished: true,
    );
    _traceManager.setActiveTrace(traceId: record.traceId);
  }

  bool hasActivePageTrace(String routeName) {
    return _pageTraces.containsKey(routeName);
  }

  void finishPageLoad(
    String routeName, {
    String? nextRouteName,
    DateTime? endTime,
  }) {
    final record = _pageTraces.remove(routeName);
    if (record == null) return;
    _finishPageTrace(
      record.copyWith(nextRouteName: nextRouteName),
      endTime: endTime ?? DateTime.now(),
    );
  }

  PipelineResult recordHttpClient({
    required String url,
    required String method,
    required num durationMs,
    int? statusCode,
    required bool success,
    String? error,
    String? errorType,
    num? requestSizeBytes,
    num? responseSizeBytes,
    num? retryCount,
    String? cacheStatus,
    String source = SignalSources.sdkHttp,
    DateTime? startTime,
    DateTime? endTime,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final finishedAt = endTime ?? DateTime.now();
    final startedAt =
        startTime ??
        finishedAt.subtract(Duration(milliseconds: durationMs.round()));
    final errorText = error ?? payload[PayloadKeys.error];
    final effectiveErrorType = success
        ? null
        : _canonicalHttpErrorType(
            errorType: errorType,
            statusCode: statusCode,
            error: errorText is String ? errorText : null,
          );
    final attributes = <String, Object?>{
      FieldPaths.httpMethod: method,
      FieldPaths.httpUrlNormalized: _normalizedUrl(url),
      if (statusCode != null) FieldPaths.httpStatusCode: statusCode,
      FieldPaths.httpSuccess: success,
      if (effectiveErrorType != null)
        FieldPaths.httpErrorType: effectiveErrorType,
      if (retryCount != null) FieldPaths.httpRetryCount: retryCount,
      if (cacheStatus != null) FieldPaths.httpCacheStatus: cacheStatus,
      if (requestSizeBytes != null)
        FieldPaths.requestSizeBytes: requestSizeBytes,
      if (responseSizeBytes != null)
        FieldPaths.responseSizeBytes: responseSizeBytes,
    };
    final compactError = _compactHttpError(
      errorText is String ? errorText : null,
      maxLength: _httpErrorPayloadMaxLength,
    );
    final httpPayload = <String, Object?>{...payload, PayloadKeys.url: url}
      ..remove(PayloadKeys.error);
    final span = _traceManager.startSpan(
      name: EventNames.httpClient,
      startTime: startedAt,
      attributes: attributes,
      payload: <String, Object?>{
        ...httpPayload,
        if (compactError != null) ...compactError,
      },
    );
    final finished = _traceManager.endSpan(
      span.spanId,
      endTime: finishedAt,
      status: success ? EventStatus.ok : EventStatus.error,
      level: EventLevel.info,
    );
    if (finished == null) {
      return reportSdkEvent(
        EventNames.sdkHttpSpanEndFailed,
        level: EventLevel.warning,
        status: EventStatus.error,
        payload: <String, Object?>{PayloadKeys.spanId: span.spanId},
      );
    }
    return _pipeline.capture(
      RawSignal(
        source: source,
        name: finished.name,
        signalType: SignalType.span,
        timestamp: finishedAt,
        startTime: finished.startTime,
        endTime: finishedAt,
        durationMs: finished.durationMs,
        level: EventLevel.info,
        status: success ? EventStatus.ok : EventStatus.error,
        traceId: finished.traceId,
        spanId: finished.spanId,
        parentSpanId: finished.parentSpanId,
        includeBreadcrumbs: !success,
        attributes: finished.attributes,
        payload: finished.payload,
      ),
    );
  }

  PipelineResult recordJankSequence({
    required int frameCount,
    required num frameMaxMs,
    required num frameAvgMs,
    required num frameBudgetMs,
    num? frameFps,
    num? frameStability,
    num? frameP50Ms,
    num? frameP90Ms,
    num? frameP99Ms,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final result = _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkJank,
        name: EventNames.uiJankSequence,
        signalType: SignalType.metric,
        timestamp: DateTime.now(),
        level: EventLevel.info,
        status: EventStatus.ok,
        breadcrumbLimit: 5,
        attributes: <String, Object?>{
          FieldPaths.jankCount: frameCount,
          FieldPaths.frameMaxMs: frameMaxMs,
          FieldPaths.frameAvgMs: frameAvgMs,
          FieldPaths.frameBudgetMs: frameBudgetMs,
          if (frameFps != null) FieldPaths.frameFps: frameFps,
          if (frameStability != null) FieldPaths.frameStability: frameStability,
          if (frameP50Ms != null) FieldPaths.frameP50Ms: frameP50Ms,
          if (frameP90Ms != null) FieldPaths.frameP90Ms: frameP90Ms,
          if (frameP99Ms != null) FieldPaths.frameP99Ms: frameP99Ms,
        },
        payload: payload,
      ),
    );
    return result;
  }

  PipelineResult recordFlutterError(
    FlutterErrorDetails details, {
    DateTime? timestamp,
  }) {
    return _recordRuntimeError(
      name: EventNames.errorFlutter,
      type: ErrorTypes.flutterError,
      mechanism: ErrorMechanisms.flutter,
      message: details.exceptionAsString(),
      stackTrace: details.stack,
      library: details.library,
      context: details.context?.toString(),
      timestamp: timestamp,
    );
  }

  PipelineResult recordDartError(
    Object error,
    StackTrace stackTrace, {
    DateTime? timestamp,
  }) {
    return _recordRuntimeError(
      name: EventNames.errorDart,
      type: ErrorTypes.dartError,
      mechanism: ErrorMechanisms.dart,
      message: error.toString(),
      stackTrace: stackTrace,
      timestamp: timestamp,
    );
  }

  PipelineResult recordMemorySample({
    num? rssMb,
    num? heapUsedMb,
    num? heapCapacityMb,
    num? externalMb,
    num? nativeUsedMb,
    MemorySampleSource source = MemorySampleSource.dart,
    String trigger = TriggerValues.manual,
    DateTime? timestamp,
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkMemory,
        name: EventNames.memorySample,
        signalType: SignalType.metric,
        timestamp: timestamp ?? DateTime.now(),
        level: EventLevel.debug,
        status: EventStatus.ok,
        priority: EventPriority.low,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.memorySampleSource: source.toJson(),
          if (rssMb != null) FieldPaths.memoryRssMb: rssMb,
          if (heapUsedMb != null) FieldPaths.memoryHeapUsedMb: heapUsedMb,
          if (heapCapacityMb != null)
            FieldPaths.memoryHeapCapacityMb: heapCapacityMb,
          if (externalMb != null) FieldPaths.memoryExternalMb: externalMb,
          if (nativeUsedMb != null) FieldPaths.memoryNativeUsedMb: nativeUsedMb,
        },
        payload: <String, Object?>{PayloadKeys.trigger: trigger},
      ),
    );
  }

  PipelineResult recordMemoryGrowth({
    required num growthMb,
    required Duration growthDuration,
    MemorySampleSource source = MemorySampleSource.dart,
    String trigger = TriggerValues.manual,
    int? sampleCount,
    Map<String, Object?> evidence = const <String, Object?>{},
    DateTime? timestamp,
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkMemory,
        name: EventNames.memoryGrowth,
        signalType: SignalType.metric,
        timestamp: timestamp ?? DateTime.now(),
        durationMs: growthDuration.inMilliseconds,
        level: growthMb > 0 ? EventLevel.info : EventLevel.debug,
        status: EventStatus.ok,
        priority: EventPriority.normal,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.memorySampleSource: source.toJson(),
          FieldPaths.memoryGrowthMb: growthMb,
          FieldPaths.memoryGrowthDurationMs: growthDuration.inMilliseconds,
        },
        payload: <String, Object?>{
          PayloadKeys.trigger: trigger,
          if (sampleCount != null) PayloadKeys.sampleCount: sampleCount,
          if (evidence.isNotEmpty) PayloadKeys.evidence: evidence,
        },
      ),
    );
  }

  PipelineResult recordMemoryPressure({
    MemoryPressureLevel level = MemoryPressureLevel.unknown,
    MemorySampleSource source = MemorySampleSource.dart,
    String trigger = TriggerValues.manual,
    DateTime? timestamp,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkMemory,
        name: EventNames.memoryPressure,
        signalType: SignalType.metric,
        timestamp: timestamp ?? DateTime.now(),
        level: level == MemoryPressureLevel.critical
            ? EventLevel.error
            : EventLevel.warning,
        status: level == MemoryPressureLevel.none
            ? EventStatus.ok
            : EventStatus.error,
        priority: EventPriority.high,
        breadcrumbLimit: 5,
        attributes: <String, Object?>{
          FieldPaths.memorySampleSource: source.toJson(),
          FieldPaths.memoryPressureLevel: level.toJson(),
        },
        payload: <String, Object?>{PayloadKeys.trigger: trigger, ...payload},
      ),
    );
  }

  PipelineResult recordMemoryLeakSuspect({
    required num growthMb,
    required Duration growthDuration,
    MemorySampleSource source = MemorySampleSource.dart,
    String trigger = TriggerValues.manual,
    Map<String, Object?> evidence = const <String, Object?>{},
    DateTime? timestamp,
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkMemory,
        name: EventNames.memoryLeakSuspect,
        signalType: SignalType.metric,
        timestamp: timestamp ?? DateTime.now(),
        durationMs: growthDuration.inMilliseconds,
        level: EventLevel.warning,
        status: EventStatus.unknown,
        priority: EventPriority.high,
        breadcrumbLimit: 5,
        attributes: <String, Object?>{
          FieldPaths.memorySampleSource: source.toJson(),
          FieldPaths.memoryGrowthMb: growthMb,
          FieldPaths.memoryGrowthDurationMs: growthDuration.inMilliseconds,
        },
        payload: <String, Object?>{
          PayloadKeys.trigger: trigger,
          PayloadKeys.evidence: evidence,
          PayloadKeys.assertion: PayloadAssertions.suspectOnly,
        },
      ),
    );
  }

  PipelineResult track({
    required String action,
    MonitorTrackResult result = MonitorTrackResult.unknown,
    String? target,
    EventLevel? level,
    String? error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    final status = _trackStatus(result);
    final effectiveLevel = level ?? _trackLevel(result);
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkTrack,
        name: action,
        signalType: SignalType.breadcrumb,
        timestamp: DateTime.now(),
        level: effectiveLevel,
        status: status,
        attributes: <String, Object?>{
          FieldPaths.businessAction: action,
          FieldPaths.businessResult: result.toJson(),
          if (target != null && target.isNotEmpty) FieldPaths.uiTarget: target,
        },
        payload: <String, Object?>{
          if (error != null && error.isNotEmpty)
            FieldPaths.payloadErrorMessage: error,
          if (properties.isNotEmpty) FieldPaths.payloadProperties: properties,
        },
      ),
    );
  }

  PipelineResult reportSdkEvent(
    String name, {
    EventLevel level = EventLevel.info,
    EventStatus status = EventStatus.ok,
    EventPriority priority = EventPriority.normal,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkRuntime,
        name: name,
        signalType: SignalType.sdk,
        timestamp: DateTime.now(),
        level: level,
        status: status,
        priority: priority,
        attributes: attributes,
        payload: payload,
      ),
    );
  }

  PipelineResult _recordRuntimeError({
    required String name,
    required String type,
    required String mechanism,
    required String message,
    StackTrace? stackTrace,
    String? library,
    String? context,
    DateTime? timestamp,
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkError,
        name: name,
        signalType: SignalType.error,
        timestamp: timestamp ?? DateTime.now(),
        level: EventLevel.error,
        status: EventStatus.error,
        priority: EventPriority.high,
        attributes: <String, Object?>{
          FieldPaths.errorType: type,
          FieldPaths.errorMechanism: mechanism,
          FieldPaths.errorHandled: false,
          FieldPaths.errorFatal: false,
        },
        payload: <String, Object?>{
          FieldPaths.payloadErrorMessage: message,
          if (stackTrace != null)
            FieldPaths.payloadErrorStacktrace: stackTrace.toString(),
          if (library != null) FieldPaths.payloadErrorLibrary: library,
          if (context != null) PayloadKeys.context: context,
        },
      ),
    );
  }

  Future<void> handleLifecycleState(String state, {DateTime? timestamp}) async {
    final occurredAt = timestamp ?? DateTime.now();
    final previousState = _contextManager.lifecycleState;
    _contextManager.setLifecycleState(state);
    final contextState = _contextManager.lifecycleState;

    final sessionId = _sessionManager.currentSessionId;
    final isBackgroundState =
        state == LifecycleStates.paused ||
        state == LifecycleStates.hidden ||
        state == LifecycleStates.detached;
    if (previousState == null && state == LifecycleStates.resumed) {
      _foregroundStartedAt = occurredAt;
    }
    if (isBackgroundState) {
      if (_foregroundStartedAt != null) {
        _recordLifecycleDuration(
          name: EventNames.appForegroundDuration,
          startedAt: _foregroundStartedAt!,
          endedAt: occurredAt,
          state: state,
          previousState: previousState,
          isForeground: false,
          sessionId: sessionId,
        );
        _foregroundStartedAt = null;
      }
      if (_sessionManager.backgroundAt == null) {
        _sessionManager.markBackgrounded(occurredAt);
      }
    }

    if (previousState != state) {
      _pipeline.captureForSession(
        sessionId: sessionId,
        signal: RawSignal(
          source: SignalSources.sdkLifecycle,
          name: EventNames.appLifecycle,
          signalType: SignalType.breadcrumb,
          timestamp: occurredAt,
          level: EventLevel.info,
          status: EventStatus.ok,
          includeBreadcrumbs: false,
          attributes: <String, Object?>{
            FieldPaths.contextLifecycleState: state,
            if (previousState != null)
              FieldPaths.contextLifecyclePreviousState: previousState,
            FieldPaths.contextLifecycleIsForeground:
                state == LifecycleStates.resumed,
          },
        ),
      );
    }

    if (state == LifecycleStates.resumed) {
      _backgroundFlushPending = false;
      final resume = _sessionManager.handleResumed(
        timestamp: occurredAt,
        backgroundSessionTimeout:
            _config.effectiveSessionConfig.backgroundSessionTimeout,
      );
      if (_config.effectiveSessionConfig.enableHotStartTrace &&
          resume.backgroundDuration != null) {
        _recordLifecycleDuration(
          name: EventNames.appBackgroundDuration,
          startedAt: occurredAt.subtract(resume.backgroundDuration!),
          endedAt: occurredAt,
          state: state,
          previousState: previousState,
          isForeground: true,
          sessionId: sessionId,
        );
        _beginHotStartTrace(
          timestamp: occurredAt,
          startedNewSession: resume.startedNewSession,
          previousState: previousState,
        );
      }
      _foregroundStartedAt = occurredAt;
    }

    if (_config.effectiveSessionConfig.flushOnBackground &&
        isBackgroundState &&
        !_backgroundFlushPending) {
      _backgroundFlushPending = true;
      try {
        await flush(isAppExiting: state == LifecycleStates.detached);
        reportSdkEvent(
          EventNames.sdkLifecycleFlush,
          attributes: <String, Object?>{FieldPaths.appExitFlushSuccess: true},
          payload: <String, Object?>{
            PayloadKeys.lifecycleTriggerState: state,
            if (contextState != null)
              PayloadKeys.lifecycleContextState: contextState,
          },
        );
      } catch (error) {
        reportSdkEvent(
          EventNames.sdkLifecycleFlush,
          level: EventLevel.warning,
          status: EventStatus.error,
          attributes: <String, Object?>{FieldPaths.appExitFlushSuccess: false},
          payload: <String, Object?>{
            PayloadKeys.lifecycleTriggerState: state,
            if (contextState != null)
              PayloadKeys.lifecycleContextState: contextState,
            PayloadKeys.error: error.toString(),
          },
        );
      }
    }
  }

  void _recordLifecycleDuration({
    required String name,
    required DateTime startedAt,
    required DateTime endedAt,
    required String state,
    required String? previousState,
    required bool isForeground,
    required String sessionId,
  }) {
    final duration = endedAt.difference(startedAt);
    if (duration.isNegative) return;
    _pipeline.captureForSession(
      sessionId: sessionId,
      signal: RawSignal(
        source: SignalSources.sdkLifecycle,
        name: name,
        signalType: SignalType.metric,
        timestamp: endedAt,
        startTime: startedAt,
        endTime: endedAt,
        durationMs: duration.inMilliseconds,
        level: EventLevel.info,
        status: EventStatus.ok,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.contextLifecycleState: state,
          if (previousState != null)
            FieldPaths.contextLifecyclePreviousState: previousState,
          FieldPaths.contextLifecycleIsForeground: isForeground,
        },
      ),
    );
  }

  String? _beginHotStartTrace({
    required DateTime timestamp,
    required bool startedNewSession,
    String? previousState,
  }) {
    if (_pendingHotStartTraceId != null) {
      finishHotStartTrace(
        endTime: timestamp,
        endReason: StartupEndReasons.timeout,
      );
    }
    _pendingHotStartTraceId = startTrace(
      EventNames.appHotStart,
      startTime: timestamp,
      attributes: <String, Object?>{FieldPaths.appStartType: StartTypes.hot},
      payload: <String, Object?>{
        PayloadKeys.sessionStartedNew: startedNewSession,
        if (previousState != null)
          PayloadKeys.lifecyclePreviousState: previousState,
      },
    );
    return _pendingHotStartTraceId;
  }

  PipelineResult? finishHotStartTrace({
    DateTime? endTime,
    String endReason = StartupEndReasons.firstFrame,
  }) {
    final traceId = _pendingHotStartTraceId;
    if (traceId == null) return null;
    _pendingHotStartTraceId = null;
    final finishedAt = endTime ?? DateTime.now();
    final record = _traceManager.trace(traceId);
    final durationMs = record == null
        ? null
        : finishedAt.difference(record.startTime).inMilliseconds;
    return endTrace(
      traceId,
      endTime: finishedAt,
      status: EventStatus.ok,
      includeBreadcrumbs: false,
      attributes: <String, Object?>{
        FieldPaths.appStartType: StartTypes.hot,
        FieldPaths.appStartEndReason: endReason,
        if (durationMs != null && endReason == StartupEndReasons.firstFrame)
          FieldPaths.appFirstFrameMs: durationMs,
        if (durationMs != null && endReason == StartupEndReasons.interactive)
          FieldPaths.appInteractiveMs: durationMs,
      },
      payload: <String, Object?>{PayloadKeys.startupPhase: endReason},
    );
  }

  /// 动态设置用户信息（运行时更新）
  void setUserInfo(UserInfo userInfo) {
    _contextManager.setUserInfo(userInfo);
    debugPrint("✅ 用户信息已更新: ${userInfo.userId}");
  }

  /// 动态设置用户ID（简化方法）
  void setUserId(String userId) {
    _contextManager.setUserId(userId);
    debugPrint("✅ 用户ID已更新: $userId");
  }

  /// 动态设置自定义数据（运行时更新）
  void setCustomData(Map<String, dynamic> data) {
    _contextManager.setCustomData(data);
    debugPrint("✅ 自定义数据已更新: $data");
  }

  /// 清除用户信息（用户登出时调用）
  void clearUserInfo() {
    _contextManager.clearUserInfo();
    debugPrint("✅ 用户信息已清除");
  }

  /// 清除自定义数据
  void clearCustomData() {
    _contextManager.clearCustomData();
    debugPrint("✅ 自定义数据已清除");
  }

  void setCurrentRoute(String? routeName) {
    _contextManager.setRouteName(routeName);
  }

  void activatePageTrace(String? routeName) {
    _activatePageTrace(routeName);
  }

  void setModule({String? name, String? scene}) {
    _contextManager.setModule(name: name, scene: scene);
  }

  Future<void> flush({bool isAppExiting = false}) {
    return _pipeline.flush(isAppExiting: isAppExiting);
  }

  /// 清理资源，在应用关闭时调用。
  Future<void> dispose() async {
    await flush(isAppExiting: true);
    // 调用所有输出器的 dispose 方法，让它们清理自己的资源。
    for (final output in _config.effectiveOutputs) {
      try {
        output.dispose();
      } catch (error) {
        reportSdkEvent(
          EventNames.sdkOutputDisposeFailed,
          level: EventLevel.warning,
          status: EventStatus.error,
          payload: <String, Object?>{
            PayloadKeys.output: output.runtimeType.toString(),
            PayloadKeys.error: error.toString(),
          },
        );
      }
    }
  }

  void _finishPageTrace(
    _PageTraceRecord record, {
    DateTime? endTime,
    EventStatus status = EventStatus.ok,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final finishedAt = endTime ?? DateTime.now();
    final stayMs = finishedAt.difference(record.startedAt).inMilliseconds;
    if (!record.loadTraceFinished) {
      endSpan(
        record.loadSpanId,
        endTime: finishedAt,
        status: EventStatus.unknown,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.pageInstanceId: record.pageInstanceId,
          if (record.previousRouteName != null)
            FieldPaths.pageFrom: record.previousRouteName,
          if (record.nextRouteName != null)
            FieldPaths.pageTo: record.nextRouteName,
        },
        payload: <String, Object?>{
          PayloadKeys.routeName: record.routeName,
          if (record.previousRouteName != null)
            PayloadKeys.routePrevious: record.previousRouteName,
          ...payload,
        },
      );
    }
    endTrace(
      record.traceId,
      endTime: finishedAt,
      status: status,
      includeBreadcrumbs: false,
      attributes: <String, Object?>{
        FieldPaths.pageInstanceId: record.pageInstanceId,
        if (record.previousRouteName != null)
          FieldPaths.pageFrom: record.previousRouteName,
        if (record.nextRouteName != null)
          FieldPaths.pageTo: record.nextRouteName,
      },
      payload: <String, Object?>{
        PayloadKeys.routeName: record.routeName,
        if (record.previousRouteName != null)
          PayloadKeys.routePrevious: record.previousRouteName,
        ...payload,
      },
    );
    _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkPage,
        name: EventNames.pageStay,
        signalType: SignalType.metric,
        timestamp: finishedAt,
        durationMs: stayMs,
        level: EventLevel.info,
        status: EventStatus.ok,
        traceId: record.traceId,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.pageInstanceId: record.pageInstanceId,
          if (record.previousRouteName != null)
            FieldPaths.pageFrom: record.previousRouteName,
          if (record.nextRouteName != null)
            FieldPaths.pageTo: record.nextRouteName,
        },
        payload: <String, Object?>{
          PayloadKeys.type: EventNames.pageStay,
          PayloadKeys.page: record.routeName,
          PayloadKeys.durationMs: stayMs,
        },
      ),
    );
  }

  PipelineResult _recordCompletedSpan({
    required String name,
    required String traceId,
    required DateTime startTime,
    required DateTime endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    bool? includeBreadcrumbs,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final span = _traceManager.startSpan(
      name: name,
      traceId: traceId,
      startTime: startTime,
      attributes: attributes,
      payload: payload,
    );
    final finished = _traceManager.endSpan(
      span.spanId,
      endTime: endTime,
      status: status,
      level: level,
    );
    if (finished == null) {
      return reportSdkEvent(
        EventNames.sdkSpanEndUnknown,
        level: EventLevel.warning,
        payload: <String, Object?>{PayloadKeys.spanId: span.spanId},
      );
    }
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkApi,
        name: finished.name,
        signalType: SignalType.span,
        timestamp: endTime,
        startTime: finished.startTime,
        endTime: finished.endTime,
        durationMs: finished.durationMs,
        level: finished.level,
        status: finished.status,
        traceId: finished.traceId,
        spanId: finished.spanId,
        parentSpanId: finished.parentSpanId,
        includeBreadcrumbs: includeBreadcrumbs,
        attributes: finished.attributes,
        payload: finished.payload,
      ),
    );
  }

  void _activatePageTrace(String? routeName) {
    final record = routeName == null ? null : _pageTraces[routeName];
    _traceManager.setActiveTrace(traceId: record?.traceId);
  }

  String _normalizedUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return rawUrl.split('?').first;
    if (uri.hasScheme) {
      return uri.path.isEmpty ? '/' : uri.path;
    }
    return rawUrl.split('?').first;
  }

  String _canonicalHttpErrorType({
    required String? errorType,
    required int? statusCode,
    required String? error,
  }) {
    if (statusCode != null) return HttpErrorTypes.httpStatus;
    final rawType = errorType?.trim();
    final type = rawType?.toLowerCase();
    final message = error?.toLowerCase() ?? '';
    if (type == HttpErrorTypes.httpStatus) return HttpErrorTypes.httpStatus;
    if (type == HttpErrorTypes.connectionError ||
        type == 'connectionerror' ||
        type == 'connection_error' ||
        type == HttpErrorTypes.networkError ||
        message.contains('socketexception') ||
        message.contains('connection refused') ||
        message.contains('network is unreachable') ||
        message.contains('failed host lookup')) {
      return HttpErrorTypes.connectionError;
    }
    if (type == HttpErrorTypes.timeout ||
        type == 'connectiontimeout' ||
        type == 'receivetimeout' ||
        type == 'sendtimeout' ||
        type == 'timeout' ||
        message.contains('timed out') ||
        message.contains('timeout')) {
      return HttpErrorTypes.timeout;
    }
    if (type == HttpErrorTypes.badCertificate ||
        type == 'badcertificate' ||
        type == 'bad_certificate' ||
        message.contains('certificate')) {
      return HttpErrorTypes.badCertificate;
    }
    if (type == HttpErrorTypes.cancelled ||
        type == 'cancel' ||
        type == 'cancelled' ||
        message.contains('cancel')) {
      return HttpErrorTypes.cancelled;
    }
    return HttpErrorTypes.unknownNetwork;
  }

  Map<String, Object?>? _compactHttpError(
    String? value, {
    required int maxLength,
  }) {
    final normalized = value?.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized == null || normalized.isEmpty) return null;
    final summary = _httpErrorSummary(normalized, maxLength: maxLength);
    final result = <String, Object?>{PayloadKeys.error: summary};
    if (normalized.length > maxLength) {
      result[PayloadKeys.errorTruncated] = true;
      result[PayloadKeys.errorOriginalLength] = normalized.length;
    }
    return result;
  }

  String _httpErrorSummary(String normalized, {required int maxLength}) {
    final lower = normalized.toLowerCase();
    if (lower.contains('connection refused')) return 'connection_refused';
    if (lower.contains('failed host lookup')) return 'failed_host_lookup';
    if (lower.contains('network is unreachable')) return 'network_unreachable';
    if (lower.contains('timed out') || lower.contains('timeout')) {
      return 'timeout';
    }
    if (lower.contains('certificate')) return 'bad_certificate';
    if (lower.contains('cancel')) return 'cancelled';
    if (lower.contains('socketexception')) return 'socket_exception';
    if (normalized.length <= maxLength) return normalized;
    return '${normalized.substring(0, maxLength)}...';
  }

  EventStatus _trackStatus(MonitorTrackResult result) {
    return switch (result) {
      MonitorTrackResult.started ||
      MonitorTrackResult.success => EventStatus.ok,
      MonitorTrackResult.failed => EventStatus.error,
      MonitorTrackResult.cancelled => EventStatus.cancelled,
      MonitorTrackResult.unknown => EventStatus.unknown,
    };
  }

  EventLevel _trackLevel(MonitorTrackResult result) {
    return switch (result) {
      MonitorTrackResult.failed => EventLevel.warning,
      _ => EventLevel.info,
    };
  }
}

class _PageTraceRecord {
  const _PageTraceRecord({
    required this.routeName,
    required this.traceId,
    required this.loadSpanId,
    required this.pageInstanceId,
    required this.startedAt,
    this.previousRouteName,
    this.nextRouteName,
    this.firstFrameReported = false,
    this.loadTraceFinished = false,
  });

  final String routeName;
  final String traceId;
  final String loadSpanId;
  final String pageInstanceId;
  final DateTime startedAt;
  final String? previousRouteName;
  final String? nextRouteName;
  final bool firstFrameReported;
  final bool loadTraceFinished;

  _PageTraceRecord copyWith({
    String? nextRouteName,
    bool? firstFrameReported,
    bool? loadTraceFinished,
  }) {
    return _PageTraceRecord(
      routeName: routeName,
      traceId: traceId,
      loadSpanId: loadSpanId,
      pageInstanceId: pageInstanceId,
      startedAt: startedAt,
      previousRouteName: previousRouteName,
      nextRouteName: nextRouteName ?? this.nextRouteName,
      firstFrameReported: firstFrameReported ?? this.firstFrameReported,
      loadTraceFinished: loadTraceFinished ?? this.loadTraceFinished,
    );
  }
}
