import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'monitor_output.dart';

/// 一个通过 HTTP/HTTPS 将监控事件上报到远程服务器的 `MonitorOutput` 实现。
///
/// 支持批量上报、定时上报和在 App 退出时自动上报，以提高效率和数据可靠性。
class HttpOutput extends MonitorOutput {
  /// 监控数据上报的目标服务器URL地址。
  final String serverUrl;

  /// 是否开启定时上报功能。
  /// 如果为 `true`，会根据 [periodicReportDuration] 定期尝试清空并上报事件队列。
  /// 默认为 `false`，即仅在事件数量达到 [batchReportSize] 时才上报。
  final bool enablePeriodicReporting;

  /// 定时上报的时间间隔。
  /// 仅在 [enablePeriodicReporting] 为 `true` 时生效。
  /// 默认为 20 秒。
  final Duration periodicReportDuration;

  /// 批量上报的事件数量阈值。
  /// 当队列中的事件数量达到此值时，会立即触发一次上报。
  /// 默认为 10 条。
  final int batchReportSize;

  /// 是否监听 App 的生命周期，在 App 进入后台或关闭时自动上报数据。
  /// 这可以有效防止因用户突然关闭应用导致的数据丢失。
  /// 默认为 `true`。
  final bool flushOnAppExit;

  /// 内部事件队列，用于缓存待上报的监控事件。
  final List<Map<String, dynamic>> _eventQueue = [];

  /// 用于实现定时上报的定时器。
  Timer? _batchTimer;

  /// App 生命周期监听器，用于在 App 状态变化时触发上报。
  AppLifecycleListener? _lifecycleListener;

  /// 创建一个 `HttpOutput` 实例。
  ///
  /// 需要提供 [serverUrl] 作为上报目的地。
  /// 其他参数如 [enablePeriodicReporting], [batchReportSize] 等用于配置上报策略。
  HttpOutput({
    required this.serverUrl,
    this.enablePeriodicReporting = false,
    this.periodicReportDuration = const Duration(seconds: 20),
    this.batchReportSize = 10,
    this.flushOnAppExit = true,
  });

  @override
  void init() {
    if (enablePeriodicReporting) {
      _batchTimer = Timer.periodic(periodicReportDuration, (_) => flush());
    }
    if (flushOnAppExit) {
      _lifecycleListener = AppLifecycleListener(
        // 当 App 隐藏、暂停或即将销毁时，进行一次“尽力而为”的上报。
        onHide: () => flush(isAppExiting: true),
        onPause: () => flush(isAppExiting: true),
        onDetach: () => flush(isAppExiting: true),
      );
    }
    debugPrint("HttpOutput initialized. Reporting to: $serverUrl");
  }

  @override
  void add(Map<String, dynamic> event) {
    _eventQueue.add(event);
    // 当事件数量达到批量上报的阈值时，立即上报。
    if (_eventQueue.length >= batchReportSize) {
      flush();
    }
  }

  @override
  Future<void> flush({bool isAppExiting = false}) async {
    if (_eventQueue.isEmpty) return;

    // 复制队列内容，然后立即清空原队列，防止在上报期间有新事件进入导致数据错乱。
    final List<Map<String, dynamic>> eventsToSend = List.from(_eventQueue);
    _eventQueue.clear();

    try {
      final body = json.encode({'events': eventsToSend});
      final headers = {'Content-Type': 'application/json'};

      final response = await http.post(
        Uri.parse(serverUrl),
        headers: headers,
        body: body,
      ).timeout(const Duration(seconds: 10)); // 增加超时时间以应对弱网

      if (response.statusCode >= 200 && response.statusCode < 300) {
        debugPrint("Reported ${eventsToSend.length} events successfully via HTTP.");
      } else {
        debugPrint('Failed to report events: ${response.statusCode} ${response.body}');
        // MODIFIED: 只有在非 App 退出时，上报失败才将事件重新加回队列等待下次机会。
        if (!isAppExiting) {
          _eventQueue.addAll(eventsToSend);
        }
      }
    } catch (e) {
      debugPrint('Error reporting events: $e');
      // MODIFIED: 同样，只有在非 App 退出时，发生异常才重试。
      if (!isAppExiting) {
        _eventQueue.addAll(eventsToSend);
      }
    }
  }

  @override
  void dispose() {
    _batchTimer?.cancel();
    _lifecycleListener?.dispose();
    // 确保在 dispose 时也尝试最后上报一次，以防队列中仍有未发送的事件。
    flush(isAppExiting: true);
  }
}
