import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'monitor_output.dart';

/// 控制台日志输出模式。
enum LogMonitorOutputMode {
  /// 输出单行摘要，适合本地快速观察 session timeline。
  compact,

  /// 只输出可见性策略允许的关键摘要，减少日志噪音。
  quiet,

  /// 输出完整 envelope JSON，适合调试字段和协议。
  json,

  /// 不输出任何日志，常用于测试或临时关闭控制台输出。
  silent,
}

/// 一个将监控事件输出到开发控制台的 MonitorOutput 实现。
///
/// 适合本地开发、自测和 example。生产环境通常应使用 HTTP/file 等稳定 output。
class LogMonitorOutput extends MonitorOutput {
  /// 创建控制台日志 output。
  ///
  /// [mode] 控制输出形式；[visibilityPolicy] 只在 quiet 模式下决定哪些摘要可见；
  /// [formatter] 可替换为自定义 compact formatter。
  LogMonitorOutput({
    this.mode = LogMonitorOutputMode.compact,
    this.visibilityPolicy = const CompactLogVisibilityPolicy(),
    CompactLogFormatter? formatter,
  }) : _formatter = formatter ?? const CompactLogFormatter();

  /// 输出模式。
  final LogMonitorOutputMode mode;

  /// quiet 模式下的可见性策略。
  final CompactLogVisibilityPolicy visibilityPolicy;
  final CompactLogFormatter _formatter;
  final JsonEncoder _encoder = const JsonEncoder.withIndent('  ');

  @override
  void init() {
    debugPrint('LogMonitorOutput initialized. mode=${mode.name}');
  }

  @override
  void add(Map<String, dynamic> event) {
    if (mode == LogMonitorOutputMode.silent) return;

    try {
      if (mode == LogMonitorOutputMode.json) {
        _printJson(event);
        return;
      }

      final envelope = EventEnvelope.fromJson(event.cast<String, Object?>());
      final summary = _formatter.summarizer.summarize(envelope);
      if (mode == LogMonitorOutputMode.quiet &&
          !visibilityPolicy.shouldDisplay(summary)) {
        return;
      }
      debugPrint(_formatter.format(summary));
    } catch (e) {
      debugPrint('Error formatting event for logging: $e');
    }
  }

  void _printJson(Map<String, dynamic> event) {
    final formattedJson = _encoder.convert(event);
    debugPrint('--- [Flutter Monitor Event] ---');
    debugPrint(formattedJson);
    debugPrint('-----------------------------');
  }

  @override
  Future<void> flush({bool isAppExiting = false}) async {
    // No-op
  }

  @override
  void dispose() {
    // No-op
  }
}
