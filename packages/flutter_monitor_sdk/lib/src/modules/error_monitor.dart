import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

class ErrorMonitor {
  final Reporter _reporter;

  ErrorMonitor(this._reporter);

  void init() {
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

  void _reportFlutterError(FlutterErrorDetails details) {
    final data = {
      PayloadKeys.type: LegacyTypes.flutterError,
      PayloadKeys.exception: details.exceptionAsString(),
      if (details.stack != null) PayloadKeys.stack: details.stack.toString(),
      PayloadKeys.library: details.library,
      PayloadKeys.context: details.context?.toString(),
      PayloadKeys.timestamp: DateTime.now().toIso8601String(),
    };
    _reporter.addEvent(LegacyCategories.error, data);
  }

  void _reportDartError(Object error, StackTrace stack) {
    final data = {
      PayloadKeys.type: LegacyTypes.dartError,
      PayloadKeys.error: error.toString(),
      PayloadKeys.stack: stack.toString(),
      PayloadKeys.timestamp: DateTime.now().toIso8601String(),
    };
    _reporter.addEvent(LegacyCategories.error, data);
  }
}
