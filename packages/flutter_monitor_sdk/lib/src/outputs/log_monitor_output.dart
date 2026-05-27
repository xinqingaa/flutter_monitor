import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'monitor_output.dart';

enum LogMonitorOutputMode { compact, quiet, json, silent }

/// 一个将监控事件输出到开发控制台的 MonitorOutput 实现。
class LogMonitorOutput extends MonitorOutput {
  LogMonitorOutput({
    this.mode = LogMonitorOutputMode.compact,
    this.visibilityPolicy = const CompactLogVisibilityPolicy(),
    CompactLogFormatter? formatter,
  }) : _formatter = formatter ?? const CompactLogFormatter();

  final LogMonitorOutputMode mode;
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
