import 'queued_monitor_event.dart';

/// 持久化 delivery 队列。
///
/// 实现只能保存已经完成隐私过滤后的 envelope JSON，不接收 raw signal。
abstract class OfflineEventQueue {
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

  Future<int> deleteExpired(DateTime expireBefore);

  Future<OfflineQueueStats> stats();

  Future<void> dispose();
}
