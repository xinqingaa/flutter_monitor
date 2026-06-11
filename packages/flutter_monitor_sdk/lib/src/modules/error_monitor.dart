import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

/// Flutter/Dart 自动错误采集器。
///
/// 该类安装 Flutter framework error 和 Dart uncaught error 回调，并将捕获到的
/// 错误交给 Reporter 生成标准 error envelope。业务已捕获错误应通过
/// `FlutterMonitorSDK.recordError` 主动上报。
class ErrorMonitor {
  final Reporter _reporter;
  FlutterExceptionHandler? _previousFlutterOnError;
  bool Function(Object error, StackTrace stack)? _previousPlatformOnError;
  var _initialized = false;

  /// 创建错误采集器。
  ErrorMonitor(this._reporter);

  /// 注册 Flutter/Dart 错误回调。
  ///
  /// Flutter framework error 仍保留默认控制台输出；Dart 顶层错误被视为已由 SDK
  /// 捕获并返回 true。
  void init() {
    if (_initialized) return;
    _initialized = true;
    _previousFlutterOnError = FlutterError.onError;
    _previousPlatformOnError = PlatformDispatcher.instance.onError;

    // 1. 捕获Flutter框架错误
    FlutterError.onError = (FlutterErrorDetails details) {
      // 可以在这里处理，或者直接上报
      FlutterError.presentError(details); // 保持控制台的默认错误输出
      _reportFlutterError(details);
    };

    // 2. 捕获顶层Dart错误
    PlatformDispatcher.instance.onError = (error, stack) {
      _reportDartError(error, stack);
      return true; // 返回true表示错误已经被处理
    };
  }

  /// 恢复 SDK 初始化前的错误回调。
  void dispose() {
    if (!_initialized) return;
    FlutterError.onError = _previousFlutterOnError;
    PlatformDispatcher.instance.onError = _previousPlatformOnError;
    _previousFlutterOnError = null;
    _previousPlatformOnError = null;
    _initialized = false;
  }

  void _reportFlutterError(FlutterErrorDetails details) {
    _reporter.recordFlutterError(details);
  }

  void _reportDartError(Object error, StackTrace stack) {
    _reporter.recordDartError(error, stack);
  }
}
