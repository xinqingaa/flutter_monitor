import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'monitor_output.dart';

/// 一个将监控事件输出到开发控制台的 MonitorOutput 实现。
///
/// 这对于本地开发和调试非常有用，可以让你在没有后端服务的情况下
/// 查看 SDK 捕获的所有事件的完整结构和数据。
class LogMonitorOutput extends MonitorOutput {
  // 使用 JsonEncoder 来格式化输出，使其更易读。
  final JsonEncoder _encoder = const JsonEncoder.withIndent('  ');

  /// `LogMonitorOutput` 不需要复杂的初始化。
  @override
  void init() {
    debugPrint("LogMonitorOutput initialized. Events will be printed to the console.");
  }

  /// 接收一个事件，格式化后直接打印到控制台。
  @override
  void add(Map<String, dynamic> event) {
    try {
      final formattedJson = _encoder.convert(event);
      // 使用 debugPrint，它在 release 模式下通常不会输出，并且能处理长字符串。
      debugPrint("--- [Flutter Monitor Event] ---");
      debugPrint(formattedJson);
      debugPrint("-----------------------------");
    } catch (e) {
      debugPrint("Error formatting event for logging: $e");
    }
  }

  /// 对于日志输出，flush 是一个空操作，因为每个事件都是立即处理的。
  @override
  Future<void> flush({bool isAppExiting = false}) async {
    // No-op
  }

  /// 无需清理资源。
  @override
  void dispose() {
    // No-op
  }
}
