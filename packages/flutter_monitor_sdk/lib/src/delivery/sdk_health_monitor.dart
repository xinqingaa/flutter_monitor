import 'dart:async';

import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';

import 'queued_monitor_event.dart';

/// SDK 可靠性自监控聚合器。
///
/// 以“计数器 + 周期摘要 + 边沿触发”取代逐条自监控事件：enqueue、sent、
/// drop、retry、flush 计数在内存中累计，默认每 60s 聚合为一条
/// `sdk.health.report`；进入后台或退出前由 Reporter 强制补发当前窗口。
/// 只有状态跳变（队列首次饱和、store 降级、首次进入重试状态）才立即
/// 产生一条边沿事件。
class SdkHealthMonitor {
  SdkHealthMonitor({
    required this.mode,
    this.window = const Duration(seconds: 60),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    _windowStartedAt = _now();
  }

  final String mode;
  final Duration window;
  final DateTime Function() _now;

  /// 聚合摘要与边沿事件的出口，由 Reporter 接回统一 `sdk.*` envelope。
  void Function(OutputHealthEvent event)? onEvent;

  Timer? _timer;
  late DateTime _windowStartedAt;

  int _enqueuedCount = 0;
  int _sentCount = 0;
  int _retryCount = 0;
  int _flushSuccessCount = 0;
  int _flushFailureCount = 0;
  final Map<String, _DropBucket> _dropsByReason = <String, _DropBucket>{};
  int? _queueLength;
  int? _queueBytes;
  var _queueSaturationSignaled = false;
  var _retrying = false;

  void start() {
    _timer ??= Timer.periodic(window, (_) {
      report(trigger: SdkFlushReasons.interval);
    });
  }

  void recordEnqueued([int count = 1]) {
    _enqueuedCount += count;
  }

  void recordSent(int count) {
    _sentCount += count;
  }

  void recordFlushSuccess() {
    _flushSuccessCount += 1;
    _retrying = false;
  }

  void recordFlushFailure() {
    _flushFailureCount += 1;
  }

  /// 记录一次重试计划。
  ///
  /// 仅在从健康状态首次进入重试状态时发出一条 `sdk.retry.schedule` 边沿
  /// 事件；后续重试只累计计数，flush 成功后状态复位。
  void recordRetryScheduled({
    required int retryCount,
    required Duration delay,
    required String reason,
    required int batchSize,
  }) {
    _retryCount += 1;
    if (_retrying) return;
    _retrying = true;
    onEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkRetrySchedule,
        level: EventLevel.warning,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          FieldPaths.sdkRetryCount: retryCount,
          FieldPaths.sdkRetryDelayMs: delay.inMilliseconds,
          FieldPaths.sdkRetryReason: reason,
          FieldPaths.sdkBatchSize: batchSize,
        },
      ),
    );
  }

  /// 记录 pipeline 阶段（采样/限流）丢弃的 envelope。
  void recordDroppedEnvelope(String reason, EventEnvelope envelope) {
    _dropBucket(reason).add(
      name: envelope.name,
      signalType: envelope.signalType.toJson(),
      priority: envelope.priority.toJson(),
      route: envelope.context.route?.name ?? '',
      module: envelope.context.module?.name ?? '',
      scene: envelope.context.module?.scene ?? '',
    );
  }

  /// 记录 delivery 队列阶段丢弃的事件。
  void recordDroppedQueuedEvents(
    String reason,
    List<QueuedMonitorEvent> events,
  ) {
    if (events.isEmpty) return;
    final bucket = _dropBucket(reason);
    for (final event in events) {
      bucket.add(
        name: event.name,
        signalType: event.signalType,
        priority: event.priority.toJson(),
        source: event.source,
        route: event.routeName,
        module: event.moduleName,
        scene: event.moduleScene,
      );
    }
    if (reason == SdkDropReasons.queueFull && !_queueSaturationSignaled) {
      _queueSaturationSignaled = true;
      _emitQueueState(
        reason: SdkQueueStateReasons.queueSaturated,
        status: EventStatus.error,
      );
    }
  }

  void updateQueueStats({required int length, required int bytes}) {
    _queueLength = length;
    _queueBytes = bytes;
  }

  /// SQLite store 损坏或不可用、降级为内存队列时的边沿事件。
  void recordStoreFallback(Object error) {
    _emitQueueState(
      reason: SdkQueueStateReasons.storeFallbackMemory,
      status: EventStatus.error,
      error: error,
    );
  }

  /// 输出当前窗口摘要并重置计数。
  ///
  /// [trigger] 取值与 `SdkFlushReasons` 对齐：`interval`、`background`、
  /// `app_exit`、`manual`。窗口内无任何活动时不产生事件。
  void report({required String trigger}) {
    final now = _now();
    final windowMs = now.difference(_windowStartedAt).inMilliseconds;
    final droppedCount = _dropsByReason.values.fold<int>(
      0,
      (sum, bucket) => sum + bucket.count,
    );
    final hasActivity =
        _enqueuedCount > 0 ||
        _sentCount > 0 ||
        _retryCount > 0 ||
        _flushSuccessCount > 0 ||
        _flushFailureCount > 0 ||
        droppedCount > 0;
    if (!hasActivity) {
      _windowStartedAt = now;
      _queueSaturationSignaled = false;
      return;
    }

    final hasProblem = droppedCount > 0 || _flushFailureCount > 0;
    onEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkHealthReport,
        level: hasProblem ? EventLevel.warning : EventLevel.info,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          FieldPaths.sdkHealthWindowMs: windowMs,
          FieldPaths.sdkHealthEnqueuedCount: _enqueuedCount,
          FieldPaths.sdkHealthSentCount: _sentCount,
          FieldPaths.sdkHealthDroppedCount: droppedCount,
          FieldPaths.sdkHealthRetryCount: _retryCount,
          FieldPaths.sdkHealthFlushSuccessCount: _flushSuccessCount,
          FieldPaths.sdkHealthFlushFailureCount: _flushFailureCount,
          if (_queueLength != null) FieldPaths.sdkQueueLength: _queueLength,
          if (_queueBytes != null) FieldPaths.sdkQueueBytes: _queueBytes,
        },
        payload: <String, Object?>{
          PayloadKeys.trigger: trigger,
          if (_dropsByReason.isNotEmpty)
            PayloadKeys.dropsByReason: <String, Object?>{
              for (final entry in _dropsByReason.entries)
                entry.key: entry.value.toJson(),
            },
        },
      ),
    );
    _resetWindow(now);
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }

  _DropBucket _dropBucket(String reason) {
    return _dropsByReason.putIfAbsent(reason, _DropBucket.new);
  }

  void _resetWindow(DateTime now) {
    _enqueuedCount = 0;
    _sentCount = 0;
    _retryCount = 0;
    _flushSuccessCount = 0;
    _flushFailureCount = 0;
    _dropsByReason.clear();
    _queueSaturationSignaled = false;
    _windowStartedAt = now;
  }

  void _emitQueueState({
    required String reason,
    required EventStatus status,
    Object? error,
  }) {
    onEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkQueueState,
        level: EventLevel.warning,
        status: status,
        priority: EventPriority.high,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          if (_queueLength != null) FieldPaths.sdkQueueLength: _queueLength,
          if (_queueBytes != null) FieldPaths.sdkQueueBytes: _queueBytes,
        },
        payload: <String, Object?>{
          PayloadKeys.reason: reason,
          if (error != null) PayloadKeys.error: error.toString(),
        },
      ),
    );
  }
}

/// 同一 drop reason 下被丢弃事件的安全聚合摘要。
///
/// 只按 name、signalType、priority、source、route、module、scene 聚合并
/// 记录 count，不复制 attributes 或业务 payload。
class _DropBucket {
  final Map<String, _DroppedEventSummary> _events =
      <String, _DroppedEventSummary>{};
  var count = 0;

  void add({
    required String name,
    required String signalType,
    required String priority,
    String source = '',
    String route = '',
    String module = '',
    String scene = '',
  }) {
    count += 1;
    final key = '$name\n$signalType\n$priority\n$source\n$route\n$module\n$scene';
    final summary = _events.putIfAbsent(
      key,
      () => _DroppedEventSummary(
        name: name,
        signalType: signalType,
        priority: priority,
        source: source,
        route: route,
        module: module,
        scene: scene,
      ),
    );
    summary.count += 1;
  }

  Map<String, Object?> toJson() {
    final summaries = _events.values.toList(growable: false)
      ..sort((a, b) {
        final byCount = b.count.compareTo(a.count);
        if (byCount != 0) return byCount;
        return a.name.compareTo(b.name);
      });
    return <String, Object?>{
      'count': count,
      'events': summaries
          .map((summary) => summary.toJson())
          .toList(growable: false),
    };
  }
}

class _DroppedEventSummary {
  _DroppedEventSummary({
    required this.name,
    required this.signalType,
    required this.priority,
    required this.source,
    required this.route,
    required this.module,
    required this.scene,
  });

  final String name;
  final String signalType;
  final String priority;
  final String source;
  final String route;
  final String module;
  final String scene;
  var count = 0;

  Map<String, Object?> toJson() {
    return <String, Object?>{
      'name': name,
      'signalType': signalType,
      'priority': priority,
      if (source.isNotEmpty) 'source': source,
      if (route.isNotEmpty) 'route': route,
      if (module.isNotEmpty) 'module': module,
      if (scene.isNotEmpty) 'scene': scene,
      'count': count,
    };
  }
}
