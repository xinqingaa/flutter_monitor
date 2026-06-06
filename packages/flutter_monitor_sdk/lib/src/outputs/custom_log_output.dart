import 'dart:async';
import 'package:flutter/foundation.dart';
import 'monitor_output.dart';

/// 定义一个函数类型，用于处理从 SDK 传出的监控事件。
///
/// 用户可以实现这个函数，将事件对接到他们自己的日志系统中。
/// [event] 是一个包含所有丰富字段的、结构化的事件 Map。
typedef MonitorLogHandler = void Function(Map<String, dynamic> event);

/// 一个高度可定制的日志输出器。
///
/// 本身不执行任何日志记录操作，而是将接收到的每个事件
/// 委托给一个由用户在构造时提供的 [onLog] 回调函数。
/// 这允许用户将 SDK 的监控数据无缝集成到项目现有的日志框架中。
class CustomLogOutput extends MonitorOutput {
  /// 每个 envelope 到达时调用的业务自定义处理函数。
  final MonitorLogHandler onLog;

  /// 创建一个自定义日志输出器。
  ///
  /// [onLog] 是一个必需的回调函数，每当有新事件时就会被调用。
  CustomLogOutput({required this.onLog});

  /// 接收一个事件，并立即通过 [onLog] 回调将其传递给用户。
  @override
  void add(Map<String, dynamic> event) {
    try {
      onLog(event);
    } catch (e) {
      debugPrint("Error executing custom log handler: $e");
    }
  }

  // 对于这种即时处理的模式，flush 和 dispose 通常是空操作。
  @override
  Future<void> flush({bool isAppExiting = false}) async {
    // No-op
  }

  @override
  void dispose() {
    // No-op
  }
}
