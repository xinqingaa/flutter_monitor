import 'dart:async';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_manager.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/pipeline/event_pipeline.dart';
import 'package:flutter_monitor_sdk/src/pipeline/legacy_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_result.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/breadcrumb_store.dart';
import 'package:flutter_monitor_sdk/src/tracing/session_manager.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_manager.dart';

/// Reporter 是 SDK 的数据心脏，负责收集、丰富、缓存和发送所有监控事件。
class Reporter {
  final MonitorConfig _config;
  late final ContextManager _contextManager;
  late final SessionManager _sessionManager;
  late final TraceManager _traceManager;
  late final BreadcrumbStore _breadcrumbStore;
  late final EventPipeline _pipeline;
  final LegacySignalMapper _legacySignalMapper = LegacySignalMapper();

  /// 缓存的设备信息，避免每次上报都重新获取。
  Map<String, dynamic>? _deviceInfo;

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

  /// 异步初始化，确保设备信息获取完成
  Future<void> initAsync() async {
    // 异步获取设备信息，确保在第一次上报前完成
    await _fetchDeviceInfo();
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
          'version': info.version.release,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      } else if (Platform.isIOS) {
        final info = await deviceInfoPlugin.iosInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'name': info.name,
          'model': info.model,
          'systemVersion': info.systemVersion,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      }
      _contextManager.deviceInfo = _deviceInfo?.cast<String, Object?>();
    } catch (e) {
      debugPrint("Failed to get device info: $e");
    }
  }

  /// 核心方法：添加一个事件到队列。
  /// 这是所有监控器与Reporter交互的入口。
  PipelineResult addEvent(String eventCategory, Map<String, dynamic> data) {
    final signal = _legacySignalMapper.map(
      category: eventCategory,
      data: data,
      timestamp: DateTime.now(),
    );
    return _pipeline.capture(signal);
  }

  String startTrace(
    String name, {
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.startTrace(
      name: name,
      attributes: attributes,
      payload: payload,
    );
    _pipeline.capture(
      RawSignal(
        source: 'sdk.api',
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
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.endTrace(
      traceId,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
    if (record == null) return null;
    return _pipeline.capture(
      RawSignal(
        source: 'sdk.api',
        name: record.name,
        signalType: SignalType.trace,
        timestamp: record.endTime ?? DateTime.now(),
        startTime: record.startTime,
        endTime: record.endTime,
        durationMs: record.durationMs,
        level: record.level,
        status: record.status,
        traceId: record.traceId,
        attributes: record.attributes,
        payload: record.payload,
      ),
    );
  }

  String startSpan(
    String name, {
    String? traceId,
    String? parentSpanId,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.startSpan(
      name: name,
      traceId: traceId,
      parentSpanId: parentSpanId,
      attributes: attributes,
      payload: payload,
    );
    _pipeline.capture(
      RawSignal(
        source: 'sdk.api',
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
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traceManager.endSpan(
      spanId,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
    if (record == null) return null;
    return _pipeline.capture(
      RawSignal(
        source: 'sdk.api',
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
        source: 'sdk.api',
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
      output.dispose();
    }
  }
}
