import 'dart:async';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/src/context/context_manager.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/pipeline/event_pipeline.dart';
import 'package:flutter_monitor_sdk/src/pipeline/legacy_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_result.dart';
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

  /// 清理资源，在应用关闭时调用。
  void dispose() {
    // 调用所有输出器的 dispose 方法，让它们清理自己的资源。
    for (final output in _config.effectiveOutputs) {
      output.dispose();
    }
  }
}
