import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

import 'offline_event_queue.dart';
import 'queue_degradation.dart';
import 'queued_monitor_event.dart';

class MemoryOfflineEventQueue implements OfflineEventQueue {
  MemoryOfflineEventQueue({required MonitorProductionPolicy policy})
    : _policy = policy;

  final MonitorProductionPolicy _policy;
  final List<QueuedMonitorEvent> _events = <QueuedMonitorEvent>[];

  @override
  void Function(Object error)? onStoreFallback;

  @override
  Future<void> init() async {}

  @override
  Future<OfflineQueueEnqueueResult> enqueue(QueuedMonitorEvent event) async {
    var candidate = event;
    if (candidate.bytes > _policy.maxEventBytes) {
      candidate = stripHttpDetailForQueue(candidate);
    }
    if (candidate.bytes > _policy.maxEventBytes) {
      return OfflineQueueEnqueueResult(
        accepted: false,
        reason: SdkDropReasons.payloadTooLarge,
        dropped: <QueuedMonitorEvent>[candidate],
      );
    }

    final existingIndex = _events.indexWhere(
      (queued) => queued.eventId == candidate.eventId,
    );
    if (existingIndex >= 0) {
      _events[existingIndex] = candidate;
    } else {
      _events.add(candidate);
    }
    final dropped = await trimToLimits();
    return OfflineQueueEnqueueResult(accepted: true, dropped: dropped);
  }

  @override
  Future<List<QueuedMonitorEvent>> nextBatch({
    required int maxEvents,
    required int maxBytes,
    required DateTime now,
  }) async {
    final ready =
        _events.where((event) => !event.nextAttemptAt.isAfter(now)).toList()
          ..sort(_deliveryCompare);
    final batch = <QueuedMonitorEvent>[];
    var bytes = 0;
    for (final event in ready) {
      if (batch.isNotEmpty &&
          (batch.length >= maxEvents || bytes + event.bytes > maxBytes)) {
        break;
      }
      if (event.bytes > maxBytes && batch.isNotEmpty) break;
      batch.add(event);
      bytes += event.bytes;
      if (batch.length >= maxEvents || bytes >= maxBytes) break;
    }
    return batch;
  }

  @override
  Future<void> ack(List<String> eventIds) async {
    final ids = eventIds.toSet();
    _events.removeWhere((event) => ids.contains(event.eventId));
  }

  @override
  Future<void> scheduleRetry(
    List<String> eventIds, {
    required DateTime nextAttemptAt,
  }) async {
    final ids = eventIds.toSet();
    for (var i = 0; i < _events.length; i++) {
      final event = _events[i];
      if (!ids.contains(event.eventId)) continue;
      _events[i] = event.copyWith(
        attemptCount: event.attemptCount + 1,
        nextAttemptAt: nextAttemptAt,
      );
    }
  }

  @override
  Future<List<QueuedMonitorEvent>> trimToLimits() async {
    if (_events.length <= _policy.maxQueueEvents &&
        _totalBytes <= _policy.maxQueueBytes) {
      return const <QueuedMonitorEvent>[];
    }
    final result = degradeToLimits(
      events: _events,
      maxEvents: _policy.maxQueueEvents,
      maxBytes: _policy.maxQueueBytes,
    );
    _events
      ..clear()
      ..addAll(result.kept);
    return result.dropped;
  }

  @override
  Future<List<QueuedMonitorEvent>> deleteExpired(DateTime expireBefore) async {
    final dropped = _events
        .where((event) => event.createdAt.isBefore(expireBefore))
        .toList(growable: false);
    _events.removeWhere((event) => event.createdAt.isBefore(expireBefore));
    return dropped;
  }

  @override
  Future<OfflineQueueStats> stats() async {
    return OfflineQueueStats(length: _events.length, bytes: _totalBytes);
  }

  @override
  Future<void> dispose() async {
    _events.clear();
  }

  int get _totalBytes =>
      _events.fold<int>(0, (sum, event) => sum + event.bytes);

  int _deliveryCompare(QueuedMonitorEvent a, QueuedMonitorEvent b) {
    final priority = _priorityRank(
      b.priority,
    ).compareTo(_priorityRank(a.priority));
    if (priority != 0) return priority;
    return a.createdAt.compareTo(b.createdAt);
  }

  int _priorityRank(EventPriority priority) {
    return switch (priority) {
      EventPriority.low => 0,
      EventPriority.normal => 1,
      EventPriority.high => 2,
      EventPriority.critical => 3,
    };
  }
}
