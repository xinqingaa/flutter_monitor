import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/modules/performance_monitor.dart';
import 'package:flutter_monitor_sdk/src/utils/monitored_http_client.dart';

export 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';
export 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
export 'package:flutter_monitor_sdk/src/modules/performance_monitor.dart';
export 'package:flutter_monitor_sdk/src/modules/jank_monitor.dart';
export 'package:flutter_monitor_sdk/src/utils/monitored_gesture_detector.dart';
export 'package:flutter_monitor_sdk/src/utils/page_render_monitor.dart';
export 'package:flutter_monitor_sdk/src/utils/performance_utils.dart';
export 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/log_monitor_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/http_output.dart';
export 'package:flutter_monitor_sdk/src/outputs/custom_log_output.dart';
export 'package:flutter_monitor_core/flutter_monitor_core.dart'
    show EventLevel, EventStatus;

class FlutterMonitorSDK {
  FlutterMonitorSDK._();

  static final FlutterMonitorSDK _instance = FlutterMonitorSDK._();
  static FlutterMonitorSDK get instance => _instance;

  static bool _isInitialized = false;

  static RouteObserver get routeObserver {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 routeObserver。',
      );
    }
    return MonitorBinding.instance.performanceMonitor.routeObserver;
  }

  static Interceptor get dioInterceptor {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 dioInterceptor。',
      );
    }
    // SDK 内部负责创建拦截器实例，并传入所需的依赖（reporter）
    // 使用者无需关心其内部实现
    return MonitorDioInterceptor(MonitorBinding.instance.reporter);
  }

  static http.Client get httpClient {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 httpClient。',
      );
    }
    // 同样，SDK 内部负责创建实例
    return MonitoredHttpClient(MonitorBinding.instance.reporter, http.Client());
  }

  static void onPageRendered(String? pageName) {
    if (!_isInitialized) return;
    MonitorBinding.instance.performanceMonitor.routeObserver.onPageRendered(
      pageName,
    );
  }

  static String startTrace(
    String name, {
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 startTrace。',
      );
    }
    return MonitorBinding.instance.reporter.startTrace(
      name,
      attributes: attributes,
      payload: payload,
    );
  }

  static void endTrace(
    String traceId, {
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.endTrace(
      traceId,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
  }

  static String startSpan(
    String name, {
    String? traceId,
    String? parentSpanId,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 startSpan。',
      );
    }
    return MonitorBinding.instance.reporter.startSpan(
      name,
      traceId: traceId,
      parentSpanId: parentSpanId,
      attributes: attributes,
      payload: payload,
    );
  }

  static void endSpan(
    String spanId, {
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.endSpan(
      spanId,
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
  }

  static void addBreadcrumb(
    String name, {
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.addBreadcrumb(
      name,
      level: level,
      attributes: attributes,
      payload: payload,
    );
  }

  static void setModule({String? name, String? scene}) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setModule(name: name, scene: scene);
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

  /// 动态设置用户ID（运行时更新）
  void setUserId(String userId) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setUserId(userId);
  }

  /// 动态设置用户信息（运行时更新）
  void setUserInfo(UserInfo userInfo) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setUserInfo(userInfo);
  }

  /// 动态设置自定义数据（运行时更新）
  void setCustomData(Map<String, dynamic> data) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setCustomData(data);
  }

  /// 清除用户信息（用户登出时调用）
  void clearUserInfo() {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.clearUserInfo();
  }

  /// 清除自定义数据
  void clearCustomData() {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.clearCustomData();
  }

  void reportEvent(String eventType, Map<String, dynamic> data) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.addEvent(eventType, data);
  }
}

class SDKNotInitializedException implements Exception {
  final String message;
  SDKNotInitializedException(this.message);
  @override
  String toString() => 'SDKNotInitializedException: $message';
}
