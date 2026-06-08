import 'dart:async';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_manager.dart';
import 'package:flutter_monitor_sdk/src/context/monitor_context_scope.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/modules/frame_window_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';
import 'package:flutter_monitor_sdk/src/native/native_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/pipeline/event_pipeline.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_result.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/breadcrumb_store.dart';
import 'package:flutter_monitor_sdk/src/tracing/session_manager.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_manager.dart';

/// SDK 运行时的数据入口。
///
/// `Reporter` 接收采集器、native bridge、业务 API 产生的原始事实，
/// 将它们整理成 [RawSignal] 后交给 [EventPipeline]。它同时持有 context、
/// session、trace、breadcrumb 的管理器，因此负责保证事件进入统一
/// `EventEnvelope` 前已经具备正确的链路关系。
///
/// 业务侧不直接依赖该类；`FlutterMonitorSDK` facade 会调用这里的稳定入口。
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
  void Function(PageActivitySnapshot snapshot)? onPageActivity;
  final Map<String, _PageTraceRecord> _pageTracesByInstanceId =
      <String, _PageTraceRecord>{};
  final List<String> _pageInstanceStack = <String>[];
  PageActivitySnapshot? _currentPageActivity;
  _StartupPerfRecord? _startupPerfRecord;

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

  /// 解析首批 envelope 前应具备的资源信息。
  ///
  /// 包括设备信息和 native bridge resource snapshot。该方法必须在启动 trace
  /// 和 SDK init span 发出前完成，避免 bootstrap 事件缺少 resource/context。
  Future<void> resolveBootstrapResources() async {
    await _fetchDeviceInfo();
    await resolveNativeBootstrapResource(_config.nativeBridge);
  }

  Future<void> initAsync() => resolveBootstrapResources();

  /// 解析 native bridge 的启动期 resource。
  ///
  /// 这里使用短 timeout，避免 native channel 不可用时阻塞 Flutter 启动。
  /// 失败时会降级为 Flutter-only native context。
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

  /// 开始记录启动阶段的内存证据。
  ///
  /// cold start 和 hot start 都会复用这份临时记录，在 trace 结束时合并到
  /// 启动 trace 的 attributes 中。
  void beginStartupPerformance({required DateTime startTime}) {
    _startupPerfRecord = _StartupPerfRecord(
      startedAt: startTime,
      startRssMb: captureRssMb(),
    );
  }

  /// 结束启动阶段内存证据记录，并返回可并入 trace 的 performance attributes。
  Map<String, Object?> finishStartupPerformance({num? memoryEndRssMb}) {
    final attributes =
        _startupPerfRecord
            ?.copyWith(endRssMb: memoryEndRssMb)
            .performanceAttributes() ??
        const <String, Object?>{};
    _startupPerfRecord = null;
    return attributes;
  }

  /// 捕获当前进程 RSS，平台不支持或读取失败时返回 null。
  num? captureRssMb() {
    try {
      if (kIsWeb) return null;
      return ProcessInfo.currentRss / 1024 / 1024;
    } catch (_) {
      return null;
    }
  }

  /// 接收 native bridge 送来的 native 信号。
  ///
  /// native plugin 只提供平台事实；字段映射和 envelope 构建仍由 SDK pipeline
  /// 完成，避免 native 层形成第二套事件模型。
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

  /// 开始一个内部 trace。
  ///
  /// 用于启动、页面访问、热启动等 SDK 内部链路。普通业务接入不直接调用；
  /// 业务动作应使用 `FlutterMonitorSDK.track`。
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

  /// 结束一个内部 trace，并发出 trace end envelope。
  ///
  /// 如果 trace 不存在，会发出 SDK self-monitoring 事件，便于排查链路闭合问题。
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

  /// 开始一个内部 span。
  ///
  /// span 表示 trace 中的阶段，例如页面加载、HTTP 请求、SDK init。
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

  /// 结束一个内部 span，并发出 span end envelope。
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

  /// 记录一个内部 breadcrumb。
  ///
  /// 该能力服务 SDK 内部或测试；普通业务动作由 [track] 生成业务 breadcrumb。
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

  String? startPageLoad(
    String routeName, {
    String? routeFullName,
    String? previousRouteName,
    String? previousRouteFullName,
    DateTime? startTime,
  }) {
    if (routeName.isEmpty) return null;
    final startedAt = startTime ?? DateTime.now();
    final effectiveRouteFullName = _effectiveRouteFullName(
      routeName,
      routeFullName,
    );
    final effectivePreviousRouteFullName = previousRouteName == null
        ? null
        : _effectiveRouteFullName(previousRouteName, previousRouteFullName);
    final pageInstanceId = '${routeName}_${startedAt.microsecondsSinceEpoch}';
    _closeCurrentPageWindow(PageActivePhases.covered, timestamp: startedAt);
    setCurrentRoute(routeName, fullName: effectiveRouteFullName);
    final traceId = startTrace(
      EventNames.pageVisit,
      startTime: startedAt,
      attributes: <String, Object?>{
        FieldPaths.pageInstanceId: pageInstanceId,
        if (previousRouteName != null) FieldPaths.pageFrom: previousRouteName,
        if (effectivePreviousRouteFullName != null)
          FieldPaths.pageFromFullName: effectivePreviousRouteFullName,
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
        if (effectivePreviousRouteFullName != null)
          FieldPaths.pageFromFullName: effectivePreviousRouteFullName,
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
        if (effectivePreviousRouteFullName != null)
          FieldPaths.pageFromFullName: effectivePreviousRouteFullName,
      },
      payload: <String, Object?>{
        PayloadKeys.routeName: routeName,
        if (previousRouteName != null)
          PayloadKeys.routePrevious: previousRouteName,
      },
    );
    _pageTracesByInstanceId[pageInstanceId] = _PageTraceRecord(
      routeName: routeName,
      routeFullName: effectiveRouteFullName,
      traceId: traceId,
      loadSpanId: loadSpanId,
      pageInstanceId: pageInstanceId,
      startedAt: startedAt,
      previousRouteName: previousRouteName,
      previousRouteFullName: effectivePreviousRouteFullName,
      memoryEnterRssMb: captureRssMb(),
    );
    _pageInstanceStack.add(pageInstanceId);
    _traceManager.setActiveTrace(traceId: traceId);
    _openPageWindow(
      pageInstanceId,
      PageActivePhases.enter,
      timestamp: startedAt,
    );
    return pageInstanceId;
  }

  PipelineResult recordPageView(
    String routeName, {
    String? routeFullName,
    String? pageInstanceId,
    String? activePhase,
    DateTime? timestamp,
  }) {
    final effectiveRouteFullName = _effectiveRouteFullName(
      routeName,
      routeFullName,
    );
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkPage,
        name: EventNames.pageView,
        signalType: SignalType.breadcrumb,
        timestamp: timestamp ?? DateTime.now(),
        level: EventLevel.info,
        status: EventStatus.ok,
        traceId: pageInstanceId == null
            ? _activePageTraceForRoute(routeName)?.traceId
            : _pageTracesByInstanceId[pageInstanceId]?.traceId,
        includeBreadcrumbs: false,
        contextRouteName: routeName,
        contextRouteFullName: effectiveRouteFullName,
        attributes: <String, Object?>{
          if (pageInstanceId != null) FieldPaths.pageInstanceId: pageInstanceId,
          if (activePhase != null) FieldPaths.pageActivePhase: activePhase,
          FieldPaths.contextRouteFullName: effectiveRouteFullName,
        },
        payload: <String, Object?>{
          PayloadKeys.type: EventNames.pageView,
          PayloadKeys.page: routeName,
        },
      ),
    );
  }

  void finishPageFirstFrame(
    String routeName, {
    DateTime? endTime,
    String? pageInstanceId,
  }) {
    final record = pageInstanceId == null
        ? _activePageTraceForRoute(routeName)
        : _pageTracesByInstanceId[pageInstanceId];
    if (record == null || record.firstFrameReported) {
      return;
    }
    final finishedAt = endTime ?? DateTime.now();
    final durationMs = finishedAt.difference(record.startedAt).inMilliseconds;
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
          if (record.previousRouteFullName != null)
            FieldPaths.pageFromFullName: record.previousRouteFullName,
        },
        payload: <String, Object?>{PayloadKeys.routeName: record.routeName},
      );
    }
    _pageTracesByInstanceId[record.pageInstanceId] = record.copyWith(
      firstFrameReported: true,
      loadTraceFinished: true,
    );
    _traceManager.setActiveTrace(traceId: record.traceId);
  }

  bool hasActivePageTrace(String routeName) {
    return _activePageTraceForRoute(routeName) != null;
  }

  void finishPageLoad(
    String routeName, {
    String? nextRouteName,
    String? nextRouteFullName,
    DateTime? endTime,
    String? pageInstanceId,
    String endReason = PageEndReasons.routePop,
    bool resumePrevious = true,
  }) {
    final finishedAt = endTime ?? DateTime.now();
    final record = pageInstanceId == null
        ? _activePageTraceForRoute(routeName)
        : _pageTracesByInstanceId[pageInstanceId];
    if (record == null) return;
    final effectiveNextRouteFullName = nextRouteName == null
        ? null
        : _effectiveRouteFullName(nextRouteName, nextRouteFullName);
    final completedRecord = record.copyWith(
      nextRouteName: nextRouteName,
      nextRouteFullName: effectiveNextRouteFullName,
      memoryExitRssMb: captureRssMb(),
    );
    _closePageWindow(
      record.pageInstanceId,
      PageActivePhases.exit,
      timestamp: finishedAt,
    );
    final recordWithStats =
        _pageTracesByInstanceId[record.pageInstanceId] ?? completedRecord;
    _pageTracesByInstanceId.remove(record.pageInstanceId);
    _pageInstanceStack.remove(record.pageInstanceId);
    if (endReason == PageEndReasons.routePop) {
      _recordCompletedSpan(
        name: EventNames.routePop,
        traceId: record.traceId,
        startTime: finishedAt,
        endTime: finishedAt,
        includeBreadcrumbs: false,
        attributes: <String, Object?>{
          FieldPaths.pageInstanceId: record.pageInstanceId,
          if (record.previousRouteName != null)
            FieldPaths.pageFrom: record.previousRouteName,
          if (record.previousRouteFullName != null)
            FieldPaths.pageFromFullName: record.previousRouteFullName,
          if (nextRouteName != null) FieldPaths.pageTo: nextRouteName,
          if (effectiveNextRouteFullName != null)
            FieldPaths.pageToFullName: effectiveNextRouteFullName,
        },
        payload: <String, Object?>{
          PayloadKeys.routeName: record.routeName,
          if (nextRouteName != null) PayloadKeys.routePrevious: nextRouteName,
        },
      );
    }
    _finishPageTrace(
      recordWithStats.copyWith(
        nextRouteName: nextRouteName,
        nextRouteFullName: effectiveNextRouteFullName,
        memoryExitRssMb: completedRecord.memoryExitRssMb,
      ),
      endTime: finishedAt,
      payload: <String, Object?>{PayloadKeys.pageEndReason: endReason},
    );
    if (resumePrevious && nextRouteName != null && nextRouteName.isNotEmpty) {
      _resumeTopPage(nextRouteName, timestamp: finishedAt);
    }
  }

  void finishActivePageTraces({
    DateTime? endTime,
    String endReason = PageEndReasons.appDispose,
  }) {
    if (_pageTracesByInstanceId.isEmpty) return;
    final finishedAt = endTime ?? DateTime.now();
    final activePages = _pageTracesByInstanceId.values.toList(growable: false);
    final activePhase = endReason == PageEndReasons.appDispose
        ? PageActivePhases.appDispose
        : PageActivePhases.lifecycleBackground;
    _closeCurrentPageWindow(activePhase, timestamp: finishedAt);
    final completedPages = activePages
        .map((record) {
          final recordWithStats =
              _pageTracesByInstanceId[record.pageInstanceId] ?? record;
          return recordWithStats.copyWith(memoryExitRssMb: captureRssMb());
        })
        .toList(growable: false);
    _pageTracesByInstanceId.clear();
    _pageInstanceStack.clear();
    for (final record in completedPages) {
      _finishPageTrace(
        record,
        endTime: finishedAt,
        payload: <String, Object?>{PayloadKeys.pageEndReason: endReason},
      );
    }
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
        eventPhase: EventPhases.instant,
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

  /// 记录业务侧主动上报的已处理错误。
  ///
  /// 该入口对应 public `FlutterMonitorSDK.recordError`，会生成标准 error
  /// envelope，并携带当前 context、trace 和 recent breadcrumbs。
  PipelineResult recordManualError(
    Object error, {
    StackTrace? stackTrace,
    String? type,
    bool handled = true,
    EventLevel level = EventLevel.error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    return _pipeline.capture(
      RawSignal(
        source: SignalSources.sdkError,
        name: EventNames.errorManual,
        signalType: SignalType.error,
        timestamp: DateTime.now(),
        level: level,
        status: EventStatus.error,
        priority: level == EventLevel.fatal
            ? EventPriority.critical
            : EventPriority.high,
        attributes: <String, Object?>{
          FieldPaths.errorType: type ?? error.runtimeType.toString(),
          FieldPaths.errorMechanism: ErrorMechanisms.manual,
          FieldPaths.errorHandled: handled,
          FieldPaths.errorFatal: level == EventLevel.fatal,
        },
        payload: <String, Object?>{
          FieldPaths.payloadErrorMessage: error.toString(),
          if (stackTrace != null)
            FieldPaths.payloadErrorStacktrace: stackTrace.toString(),
          if (properties.isNotEmpty) FieldPaths.payloadProperties: properties,
        },
      ),
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
    String? samplePhase,
    String? routeName,
    String? traceId,
    String? pageInstanceId,
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
        traceId: traceId,
        contextRouteName: routeName,
        attributes: <String, Object?>{
          FieldPaths.memorySampleSource: source.toJson(),
          if (rssMb != null) FieldPaths.memoryRssMb: rssMb,
          if (heapUsedMb != null) FieldPaths.memoryHeapUsedMb: heapUsedMb,
          if (heapCapacityMb != null)
            FieldPaths.memoryHeapCapacityMb: heapCapacityMb,
          if (externalMb != null) FieldPaths.memoryExternalMb: externalMb,
          if (nativeUsedMb != null) FieldPaths.memoryNativeUsedMb: nativeUsedMb,
          if (samplePhase != null) FieldPaths.memorySamplePhase: samplePhase,
          if (pageInstanceId != null) FieldPaths.pageInstanceId: pageInstanceId,
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

  /// 记录一次业务动作 breadcrumb。
  ///
  /// 该入口对应 public `FlutterMonitorSDK.track`。它不设置全局上下文；
  /// [properties] 只进入本次事件的 payload，用于详情排查。
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

  /// 记录一次业务交互性能观测。
  ///
  /// 该入口对应 public `FlutterMonitorSDK.measure`。它不执行、不包裹业务逻辑；
  /// 只把 interaction collector 聚合出的窗口事实写入当前页面 trace。
  PipelineResult recordInteractionMeasure(InteractionMeasureSnapshot snapshot) {
    final page = _topPageTrace();
    final traceId = page?.traceId ?? _traceManager.activeTraceId;
    final attributes = <String, Object?>{
      FieldPaths.businessAction: snapshot.action,
      FieldPaths.businessResult: snapshot.result.toJson(),
      FieldPaths.interactionMode: snapshot.mode.toJson(),
      FieldPaths.interactionEndReason: snapshot.endReason,
      FieldPaths.interactionObserveMs: snapshot.observeFor.inMilliseconds,
      FieldPaths.interactionTimeoutMs: snapshot.timeout.inMilliseconds,
      FieldPaths.interactionActiveMs: snapshot.activeDuration.inMilliseconds,
      FieldPaths.interactionSettleMs: snapshot.settleDuration.inMilliseconds,
      if (snapshot.target != null && snapshot.target!.isNotEmpty)
        FieldPaths.uiTarget: snapshot.target,
      if (page != null) FieldPaths.pageInstanceId: page.pageInstanceId,
      ...snapshot.frameAttributes(
        minSampleCount: _config.effectiveInteractionConfig.minSampleCount,
      ),
    };
    final payloadProperties = <String, Object?>{
      ...snapshot.properties,
      ...snapshot.finishProperties,
    };
    return _recordCompletedSpan(
      name: EventNames.interactionMeasure,
      traceId: traceId,
      startTime: snapshot.startedAt,
      endTime: snapshot.observedUntil,
      status: _measureStatus(snapshot.result),
      level: _measureLevel(snapshot.result),
      source: SignalSources.sdkMeasure,
      includeBreadcrumbs: true,
      attributes: attributes,
      payload: <String, Object?>{
        PayloadKeys.interaction: <String, Object?>{
          PayloadKeys.identifier: snapshot.id,
          PayloadKeys.observedFrameSummary: snapshot.frameSummary(),
          if (snapshot.cancelReason != null)
            PayloadKeys.cancelReason: snapshot.cancelReason,
        },
        if (payloadProperties.isNotEmpty)
          FieldPaths.payloadProperties: payloadProperties,
      },
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

  /// 处理 Flutter/Dart lifecycle 变化。
  ///
  /// 这里负责更新 lifecycle context、记录前后台 duration、切分 session、
  /// 生成 hot start trace，并在后台或退出时触发 flush。
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
      _closeCurrentPageWindow(
        PageActivePhases.lifecycleBackground,
        timestamp: occurredAt,
      );
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
      final currentRoute = _topPageTrace()?.routeName;
      if (currentRoute != null) {
        _resumeTopPage(currentRoute, timestamp: occurredAt);
      }
    }

    if (state == LifecycleStates.detached) {
      finishActivePageTraces(
        endTime: occurredAt,
        endReason: PageEndReasons.lifecycleDetached,
      );
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
    final performanceAttributes = finishStartupPerformance(
      memoryEndRssMb: captureRssMb(),
    );
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
        ...performanceAttributes,
      },
      payload: <String, Object?>{PayloadKeys.startupPhase: endReason},
    );
  }

  /// 动态设置用户信息（内部 legacy 入口）。
  ///
  /// 主 public API 已收敛到 `setContext`；该方法保留给内部测试和旧配置路径。
  void setUserInfo(UserInfo userInfo) {
    _contextManager.setUserInfo(userInfo);
    debugPrint("✅ 用户信息已更新: ${userInfo.userId}");
  }

  /// 动态设置用户 ID（内部 legacy 入口）。
  void setUserId(String userId) {
    _contextManager.setUserId(userId);
    debugPrint("✅ 用户ID已更新: $userId");
  }

  /// 动态设置自定义数据（内部 legacy 入口）。
  ///
  /// customData 不会提升为 attributes，也不作为新的 public API 推荐。
  void setCustomData(Map<String, dynamic> data) {
    _contextManager.setCustomData(data);
    debugPrint("✅ 自定义数据已更新: $data");
  }

  /// 清除用户信息（内部 legacy 入口）。
  void clearUserInfo() {
    _contextManager.clearUserInfo();
    debugPrint("✅ 用户信息已清除");
  }

  /// 清除自定义数据（内部 legacy 入口）。
  void clearCustomData() {
    _contextManager.clearCustomData();
    debugPrint("✅ 自定义数据已清除");
  }

  /// 设置运行时 canonical context。
  ///
  /// 该方法是 public `setContext` 和 `init(initialContext: ...)` 的共同落点，
  /// 负责把业务友好的参数写入 `context.user.*`、`context.module.*`、
  /// `context.release.*` 和 `context.network.*`。
  void setContext({
    String? userId,
    String? userType,
    List<String>? userTags,
    String? cohort,
    String? moduleName,
    String? moduleScene,
    String? releaseId,
    List<String>? featureFlags,
    Map<String, Object?>? experiments,
    String? networkType,
    bool? isWeakNetwork,
  }) {
    if (userId != null ||
        userType != null ||
        userTags != null ||
        cohort != null) {
      _contextManager.setUserContext(
        userId: userId,
        userType: userType,
        userTags: userTags,
        cohort: cohort,
      );
    }
    if (moduleName != null || moduleScene != null) {
      _contextManager.setModule(name: moduleName, scene: moduleScene);
    }
    if (releaseId != null || featureFlags != null || experiments != null) {
      _contextManager.setRelease(
        releaseId: releaseId,
        featureFlags: featureFlags,
        experiments: experiments,
      );
    }
    if (networkType != null || isWeakNetwork != null) {
      _contextManager.setNetwork(
        type: networkType,
        isWeakNetwork: isWeakNetwork,
      );
    }
  }

  /// 按 scope 清理运行时 context。
  ///
  /// 例如用户登出时清理 user scope，避免后续事件继续携带旧用户信息。
  void clearContext(Set<MonitorContextScope> scopes) {
    for (final scope in scopes) {
      switch (scope) {
        case MonitorContextScope.user:
          _contextManager.clearUserContext();
          break;
        case MonitorContextScope.module:
          _contextManager.clearModule();
          break;
        case MonitorContextScope.release:
          _contextManager.clearRelease();
          break;
        case MonitorContextScope.network:
          _contextManager.clearNetwork();
          break;
      }
    }
  }

  /// 更新当前 route context。
  ///
  /// 由 route observer 和页面 trace 管理逻辑调用，后续事件会自动携带该 route。
  void setCurrentRoute(String? routeName, {String? fullName}) {
    _contextManager.setRouteName(routeName, fullName: fullName);
  }

  void activatePageTrace(String? routeName) {
    _activatePageTrace(routeName);
  }

  PageActivitySnapshot? get currentPageActivity => _currentPageActivity;

  void setModule({String? name, String? scene}) {
    _contextManager.setModule(name: name, scene: scene);
  }

  /// flush 所有 output 队列。
  ///
  /// [isAppExiting] 会透传给 output，允许 output 使用退出场景的发送策略。
  Future<void> flush({bool isAppExiting = false}) {
    return _pipeline.flush(isAppExiting: isAppExiting);
  }

  /// 清理资源，在应用关闭或测试结束时调用。
  ///
  /// 会先闭合活跃页面 trace，再 flush，最后调用所有 output 的 dispose。
  Future<void> dispose() async {
    finishActivePageTraces(endReason: PageEndReasons.appDispose);
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
          if (record.previousRouteFullName != null)
            FieldPaths.pageFromFullName: record.previousRouteFullName,
          if (record.nextRouteName != null)
            FieldPaths.pageTo: record.nextRouteName,
          if (record.nextRouteFullName != null)
            FieldPaths.pageToFullName: record.nextRouteFullName,
        },
        payload: <String, Object?>{
          PayloadKeys.routeName: record.routeName,
          if (record.previousRouteName != null)
            PayloadKeys.routePrevious: record.previousRouteName,
          ...payload,
        },
      );
    }
    final traceAttributes = <String, Object?>{
      FieldPaths.pageInstanceId: record.pageInstanceId,
      if (record.previousRouteName != null)
        FieldPaths.pageFrom: record.previousRouteName,
      if (record.previousRouteFullName != null)
        FieldPaths.pageFromFullName: record.previousRouteFullName,
      if (record.nextRouteName != null) FieldPaths.pageTo: record.nextRouteName,
      if (record.nextRouteFullName != null)
        FieldPaths.pageToFullName: record.nextRouteFullName,
      ...record.performanceAttributes(),
    };
    endTrace(
      record.traceId,
      endTime: finishedAt,
      status: status,
      includeBreadcrumbs: false,
      attributes: traceAttributes,
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
          if (record.previousRouteFullName != null)
            FieldPaths.pageFromFullName: record.previousRouteFullName,
          if (record.nextRouteName != null)
            FieldPaths.pageTo: record.nextRouteName,
          if (record.nextRouteFullName != null)
            FieldPaths.pageToFullName: record.nextRouteFullName,
        },
        payload: <String, Object?>{
          PayloadKeys.type: EventNames.pageStay,
          PayloadKeys.page: record.routeName,
          PayloadKeys.durationMs: stayMs,
          ...payload,
        },
      ),
    );
  }

  PipelineResult _recordCompletedSpan({
    required String name,
    required String? traceId,
    required DateTime startTime,
    required DateTime endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    String source = SignalSources.sdkApi,
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
        source: source,
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
    final record = routeName == null
        ? null
        : _activePageTraceForRoute(routeName);
    _traceManager.setActiveTrace(traceId: record?.traceId);
  }

  _PageTraceRecord? _activePageTraceForRoute(String routeName) {
    for (final pageInstanceId in _pageInstanceStack.reversed) {
      final record = _pageTracesByInstanceId[pageInstanceId];
      if (record?.routeName == routeName) return record;
    }
    return null;
  }

  _PageTraceRecord? _topPageTrace() {
    for (final pageInstanceId in _pageInstanceStack.reversed) {
      final record = _pageTracesByInstanceId[pageInstanceId];
      if (record != null) return record;
    }
    return null;
  }

  void _resumeTopPage(String routeName, {DateTime? timestamp}) {
    final record = _activePageTraceForRoute(routeName) ?? _topPageTrace();
    if (record == null) {
      _traceManager.setActiveTrace(traceId: null);
      return;
    }
    setCurrentRoute(record.routeName, fullName: record.routeFullName);
    _traceManager.setActiveTrace(traceId: record.traceId);
    _openPageWindow(
      record.pageInstanceId,
      PageActivePhases.resume,
      timestamp: timestamp,
    );
    recordPageView(
      record.routeName,
      routeFullName: record.routeFullName,
      pageInstanceId: record.pageInstanceId,
      activePhase: PageActivePhases.resume,
      timestamp: timestamp,
    );
  }

  void _openPageWindow(
    String pageInstanceId,
    String phase, {
    DateTime? timestamp,
  }) {
    final record = _pageTracesByInstanceId[pageInstanceId];
    if (record == null) return;
    final openedAt = timestamp ?? DateTime.now();
    final snapshot = PageActivitySnapshot(
      routeName: record.routeName,
      routeFullName: record.routeFullName,
      traceId: record.traceId,
      pageInstanceId: record.pageInstanceId,
      activePhase: phase,
      timestamp: openedAt,
    );
    _currentPageActivity = snapshot;
    onPageActivity?.call(snapshot);
  }

  void addPageFrameStats(FrameStatsSnapshot snapshot) {
    final pageInstanceId = snapshot.pageInstanceId;
    if (pageInstanceId == null) return;
    final record = _pageTracesByInstanceId[pageInstanceId];
    if (record == null) return;
    _pageTracesByInstanceId[pageInstanceId] = record.copyWith(
      frameStats: record.frameStats.add(snapshot),
    );
  }

  void recordPageActivityMemory(PageActivitySnapshot activity) {
    final record = _pageTracesByInstanceId[activity.pageInstanceId];
    if (record == null) return;
    final rssMb = captureRssMb();
    if (rssMb == null) return;
    _pageTracesByInstanceId[activity.pageInstanceId] =
        switch (activity.activePhase) {
          PageActivePhases.enter => record.copyWith(memoryEnterRssMb: rssMb),
          PageActivePhases.exit ||
          PageActivePhases.appDispose ||
          PageActivePhases.lifecycleBackground => record.copyWith(
            memoryExitRssMb: rssMb,
          ),
          _ => record,
        };
  }

  void _closeCurrentPageWindow(String phase, {DateTime? timestamp}) {
    final current = _currentPageActivity;
    if (current == null) return;
    _currentPageActivity = current.copyWith(
      activePhase: phase,
      timestamp: timestamp ?? DateTime.now(),
    );
    onPageActivity?.call(_currentPageActivity!);
    _currentPageActivity = null;
  }

  void _closePageWindow(
    String pageInstanceId,
    String phase, {
    DateTime? timestamp,
  }) {
    if (_currentPageActivity?.pageInstanceId != pageInstanceId) return;
    _closeCurrentPageWindow(phase, timestamp: timestamp);
  }

  String _normalizedUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return rawUrl.split('?').first;
    if (uri.hasScheme) {
      return uri.path.isEmpty ? '/' : uri.path;
    }
    return rawUrl.split('?').first;
  }

  String _effectiveRouteFullName(String routeName, String? routeFullName) {
    final trimmed = routeFullName?.trim();
    return trimmed == null || trimmed.isEmpty ? routeName : trimmed;
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

  EventStatus _measureStatus(MonitorMeasureResult result) {
    return switch (result) {
      MonitorMeasureResult.success => EventStatus.ok,
      MonitorMeasureResult.failed => EventStatus.error,
      MonitorMeasureResult.cancelled => EventStatus.cancelled,
      MonitorMeasureResult.timeout => EventStatus.timeout,
      MonitorMeasureResult.unknown => EventStatus.unknown,
    };
  }

  EventLevel _measureLevel(MonitorMeasureResult result) {
    return switch (result) {
      MonitorMeasureResult.failed ||
      MonitorMeasureResult.timeout => EventLevel.warning,
      _ => EventLevel.info,
    };
  }
}

class PageActivitySnapshot {
  const PageActivitySnapshot({
    required this.routeName,
    required this.routeFullName,
    required this.traceId,
    required this.pageInstanceId,
    required this.activePhase,
    required this.timestamp,
  });

  final String routeName;
  final String routeFullName;
  final String traceId;
  final String pageInstanceId;
  final String activePhase;
  final DateTime timestamp;

  PageActivitySnapshot copyWith({String? activePhase, DateTime? timestamp}) {
    return PageActivitySnapshot(
      routeName: routeName,
      routeFullName: routeFullName,
      traceId: traceId,
      pageInstanceId: pageInstanceId,
      activePhase: activePhase ?? this.activePhase,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}

class _PageTraceRecord {
  const _PageTraceRecord({
    required this.routeName,
    required this.routeFullName,
    required this.traceId,
    required this.loadSpanId,
    required this.pageInstanceId,
    required this.startedAt,
    this.previousRouteName,
    this.previousRouteFullName,
    this.nextRouteName,
    this.nextRouteFullName,
    this.memoryEnterRssMb,
    this.memoryExitRssMb,
    this.frameStats = const _FrameStatsAggregate(),
    this.firstFrameReported = false,
    this.loadTraceFinished = false,
  });

  final String routeName;
  final String routeFullName;
  final String traceId;
  final String loadSpanId;
  final String pageInstanceId;
  final DateTime startedAt;
  final String? previousRouteName;
  final String? previousRouteFullName;
  final String? nextRouteName;
  final String? nextRouteFullName;
  final num? memoryEnterRssMb;
  final num? memoryExitRssMb;
  final _FrameStatsAggregate frameStats;
  final bool firstFrameReported;
  final bool loadTraceFinished;

  _PageTraceRecord copyWith({
    String? nextRouteName,
    String? nextRouteFullName,
    num? memoryEnterRssMb,
    num? memoryExitRssMb,
    _FrameStatsAggregate? frameStats,
    bool? firstFrameReported,
    bool? loadTraceFinished,
  }) {
    return _PageTraceRecord(
      routeName: routeName,
      routeFullName: routeFullName,
      traceId: traceId,
      loadSpanId: loadSpanId,
      pageInstanceId: pageInstanceId,
      startedAt: startedAt,
      previousRouteName: previousRouteName,
      previousRouteFullName: previousRouteFullName,
      nextRouteName: nextRouteName ?? this.nextRouteName,
      nextRouteFullName: nextRouteFullName ?? this.nextRouteFullName,
      memoryEnterRssMb: memoryEnterRssMb ?? this.memoryEnterRssMb,
      memoryExitRssMb: memoryExitRssMb ?? this.memoryExitRssMb,
      frameStats: frameStats ?? this.frameStats,
      firstFrameReported: firstFrameReported ?? this.firstFrameReported,
      loadTraceFinished: loadTraceFinished ?? this.loadTraceFinished,
    );
  }

  Map<String, Object?> performanceAttributes() {
    final memoryDelta = memoryEnterRssMb == null || memoryExitRssMb == null
        ? null
        : memoryExitRssMb! - memoryEnterRssMb!;
    return <String, Object?>{
      ...frameStats.toAttributes(),
      if (memoryEnterRssMb != null)
        FieldPaths.memoryEnterRssMb: memoryEnterRssMb,
      if (memoryExitRssMb != null) FieldPaths.memoryExitRssMb: memoryExitRssMb,
      if (memoryDelta != null) FieldPaths.memoryDeltaRssMb: memoryDelta,
    };
  }
}

class _StartupPerfRecord {
  const _StartupPerfRecord({this.startedAt, this.startRssMb, this.endRssMb});

  final DateTime? startedAt;
  final num? startRssMb;
  final num? endRssMb;

  _StartupPerfRecord copyWith({
    DateTime? startedAt,
    num? startRssMb,
    num? endRssMb,
  }) {
    return _StartupPerfRecord(
      startedAt: startedAt ?? this.startedAt,
      startRssMb: startRssMb ?? this.startRssMb,
      endRssMb: endRssMb ?? this.endRssMb,
    );
  }

  Map<String, Object?> performanceAttributes() {
    final memoryDelta = startRssMb == null || endRssMb == null
        ? null
        : endRssMb! - startRssMb!;
    return <String, Object?>{
      if (startRssMb != null) FieldPaths.memoryStartRssMb: startRssMb,
      if (endRssMb != null) FieldPaths.memoryEndRssMb: endRssMb,
      if (memoryDelta != null) FieldPaths.memoryDeltaRssMb: memoryDelta,
    };
  }
}

class _FrameStatsAggregate {
  const _FrameStatsAggregate({
    this.sampleCount = 0,
    this.slowCount = 0,
    this.droppedCount = 0,
    this.refreshRate,
    this.frameBudgetMs,
    this.maxMs = 0,
    this.totalMs = 0,
    this.p50Ms,
    this.p90Ms,
    this.p99Ms,
  });

  final int sampleCount;
  final int slowCount;
  final int droppedCount;
  final num? refreshRate;
  final num? frameBudgetMs;
  final num maxMs;
  final num totalMs;
  final num? p50Ms;
  final num? p90Ms;
  final num? p99Ms;

  _FrameStatsAggregate add(FrameStatsSnapshot snapshot) {
    final nextSampleCount = sampleCount + snapshot.sampleCount;
    return _FrameStatsAggregate(
      sampleCount: nextSampleCount,
      slowCount: slowCount + snapshot.slowCount,
      droppedCount: droppedCount + snapshot.droppedCount,
      refreshRate: snapshot.refreshRate,
      frameBudgetMs: snapshot.frameBudgetMs,
      maxMs: snapshot.frameMaxMs > maxMs ? snapshot.frameMaxMs : maxMs,
      totalMs: totalMs + snapshot.frameAvgMs * snapshot.sampleCount,
      p50Ms: snapshot.frameP50Ms ?? p50Ms,
      p90Ms: snapshot.frameP90Ms ?? p90Ms,
      p99Ms: snapshot.frameP99Ms ?? p99Ms,
    );
  }

  Map<String, Object?> toAttributes() {
    if (sampleCount == 0) return const <String, Object?>{};
    final avgMs = totalMs / sampleCount;
    final fps = avgMs <= 0 || refreshRate == null
        ? refreshRate
        : refreshRate! < 1000 / avgMs
        ? refreshRate
        : 1000 / avgMs;
    return <String, Object?>{
      FieldPaths.frameSampleCount: sampleCount,
      FieldPaths.frameSlowCount: slowCount,
      FieldPaths.frameDroppedCount: droppedCount,
      if (refreshRate != null) FieldPaths.frameRefreshRate: refreshRate,
      FieldPaths.frameMaxMs: maxMs,
      FieldPaths.frameAvgMs: avgMs,
      if (frameBudgetMs != null) FieldPaths.frameBudgetMs: frameBudgetMs,
      if (fps != null) FieldPaths.frameFps: fps,
      FieldPaths.frameStability: 1 - slowCount / sampleCount,
      if (p50Ms != null) FieldPaths.frameP50Ms: p50Ms,
      if (p90Ms != null) FieldPaths.frameP90Ms: p90Ms,
      if (p99Ms != null) FieldPaths.frameP99Ms: p99Ms,
    };
  }
}
