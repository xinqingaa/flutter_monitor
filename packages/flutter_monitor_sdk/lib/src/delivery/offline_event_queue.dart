import 'queued_monitor_event.dart';

/// 持久化 delivery 队列。
///
/// 实现只能保存已经完成隐私过滤后的 envelope JSON，不接收 raw signal。
abstract class OfflineEventQueue {
  /// 持久化 store 不可用、降级为内存队列时的通知回调。
  ///
  /// 由 output 设置，用于产生 `sdk.queue.state` 边沿自监控事件，
  /// 避免降级静默发生。
  void Function(Object error)? onStoreFallback;

  Future<void> init();

  Future<OfflineQueueEnqueueResult> enqueue(QueuedMonitorEvent event);

  Future<List<QueuedMonitorEvent>> nextBatch({
    required int maxEvents,
    required int maxBytes,
    required DateTime now,
  });

  Future<void> ack(List<String> eventIds);

  Future<void> scheduleRetry(
    List<String> eventIds, {
    required DateTime nextAttemptAt,
  });

  Future<List<QueuedMonitorEvent>> trimToLimits();

  Future<List<QueuedMonitorEvent>> deleteExpired(DateTime expireBefore);

  Future<OfflineQueueStats> stats();

  Future<void> dispose();
}
