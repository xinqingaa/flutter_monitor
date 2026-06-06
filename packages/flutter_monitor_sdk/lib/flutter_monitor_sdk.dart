import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/monitor_context_scope.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/modules/performance_monitor.dart';
import 'package:flutter_monitor_sdk/src/utils/monitored_http_client.dart';

export 'package:flutter_monitor_sdk/src/context/monitor_context_scope.dart';
export 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
export 'package:flutter_monitor_sdk/src/modules/jank_monitor.dart'
    show JankConfig;
export 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';
export 'package:flutter_monitor_sdk/src/utils/page_render_monitor.dart';
export 'package:flutter_monitor_sdk/src/utils/performance_utils.dart';
export 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/log_monitor_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/http_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/custom_log_output.dart';
export 'package:flutter_monitor_core/flutter_monitor_core.dart'
    show EventLevel, EventStatus, MonitorEventLevel, MonitorTrackResult;

class FlutterMonitorSDK {
  FlutterMonitorSDK._();

  static bool _isInitialized = false;

  static bool get isInitialized => _isInitialized;

  static RouteObserver<PageRoute<dynamic>> get routeObserver {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 routeObserver。',
      );
    }
    return MonitorBinding.instance.performanceMonitor.routeObserver;
  }

  static Interceptor createDioInterceptor() {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再创建 Dio interceptor。',
      );
    }
    return MonitorDioInterceptor(MonitorBinding.instance.reporter);
  }

  static http.Client createHttpClient({http.Client? inner}) {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再创建 http client。',
      );
    }
    return MonitoredHttpClient(
      MonitorBinding.instance.reporter,
      inner ?? http.Client(),
    );
  }

  static void markPageRendered(String routeName) {
    if (!_isInitialized) return;
    MonitorBinding.instance.performanceMonitor.routeObserver.onPageRendered(
      routeName,
    );
  }

  static void setContext({
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
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setContext(
      userId: userId,
      userType: userType,
      userTags: userTags,
      cohort: cohort,
      moduleName: moduleName,
      moduleScene: moduleScene,
      releaseId: releaseId,
      featureFlags: featureFlags,
      experiments: experiments,
      networkType: networkType,
      isWeakNetwork: isWeakNetwork,
    );
  }

  static void clearContext({required Set<MonitorContextScope> scopes}) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.clearContext(scopes);
  }

  static void track({
    required String action,
    MonitorTrackResult result = MonitorTrackResult.unknown,
    String? target,
    MonitorEventLevel? level,
    String? error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.track(
      action: action,
      result: result,
      target: target,
      level: level,
      error: error,
      properties: properties,
    );
  }

  static void recordError(
    Object error, {
    StackTrace? stackTrace,
    String? type,
    bool handled = true,
    MonitorEventLevel level = MonitorEventLevel.error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.recordManualError(
      error,
      stackTrace: stackTrace,
      type: type,
      handled: handled,
      level: level,
      properties: properties,
    );
  }

  static Future<void> recordLifecycleState(
    AppLifecycleState state, {
    DateTime? timestamp,
  }) {
    if (!_isInitialized) return Future<void>.value();
    return MonitorBinding.instance.handleLifecycleState(
      _lifecycleStateName(state),
      timestamp: timestamp,
    );
  }

  static Future<void> flush({bool isAppExiting = false}) {
    if (!_isInitialized) return Future<void>.value();
    return MonitorBinding.instance.flush(isAppExiting: isAppExiting);
  }

  static Future<void> dispose() async {
    if (!_isInitialized) return;
    await MonitorBinding.instance.dispose();
    _isInitialized = false;
  }

  static Future<void> init({
    required MonitorConfig config,
    required DateTime appStartTime,
  }) async {
    if (_isInitialized) {
      debugPrint("FlutterMonitorSDK has already been initialized.");
      return;
    }

    await MonitorBinding.init(config: config, appStartTime: appStartTime);
    _isInitialized = true;
    debugPrint("FlutterMonitorSDK initialized successfully.");
  }

  static String _lifecycleStateName(AppLifecycleState state) {
    return switch (state) {
      AppLifecycleState.detached => LifecycleStates.detached,
      AppLifecycleState.hidden => LifecycleStates.hidden,
      AppLifecycleState.inactive => LifecycleStates.inactive,
      AppLifecycleState.paused => LifecycleStates.paused,
      AppLifecycleState.resumed => LifecycleStates.resumed,
    };
  }
}

class SDKNotInitializedException implements Exception {
  final String message;
  SDKNotInitializedException(this.message);
  @override
  String toString() => 'SDKNotInitializedException: $message';
}
