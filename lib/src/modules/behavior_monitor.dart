import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

class BehaviorMonitor {
  final Reporter _reporter;

  BehaviorMonitor(this._reporter);

  void init() {
    // 可以在这里添加全局行为监听，例如监听App前后台切换
    debugPrint("BehaviorMonitor initialized.");
  }

  // 提供给 MonitoredGestureDetector 使用
  void reportClick({required String identifier}) {
    final data = {
      'type': 'click',
      'identifier': identifier,
    };
    _reporter.addEvent('behavior', data);
  }
}
