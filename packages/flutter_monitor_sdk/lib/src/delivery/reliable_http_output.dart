import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
import 'package:http/http.dart' as http;

import 'offline_event_queue.dart';
import 'queued_monitor_event.dart';
import 'sdk_health_monitor.dart';

class ReliableHttpOutput extends MonitorOutput {
  ReliableHttpOutput({
    required this.endpoint,
    required this.mode,
    required this.policy,
    required OfflineEventQueue queue,
    this.authTokenProvider,
    http.Client? client,
    SdkHealthMonitor? healthMonitor,
  }) : _queue = queue,
       _client = client ?? http.Client(),
       _health = healthMonitor;

  final Uri endpoint;
  final String mode;
  final MonitorProductionPolicy policy;
  final OfflineEventQueue _queue;
  final Future<String?> Function()? authTokenProvider;
  final http.Client _client;
  final SdkHealthMonitor? _health;

  Future<void>? _initFuture;
  Future<void>? _activeFlush;
  Timer? _intervalTimer;
  Timer? _quickFlushTimer;
  int? _temporaryMaxBatchEvents;
  var _disposed = false;

  @override
  void init() {
    _queue.onStoreFallback = (error) => _health?.recordStoreFallback(error);
    _initFuture = _queue.init();
    _intervalTimer = Timer.periodic(policy.flushInterval, (_) {
      unawaited(flush(reason: SdkFlushReasons.interval));
    });
  }

  @override
  void add(Map<String, dynamic> event) {
    if (_disposed) return;
    unawaited(_enqueue(event));
  }

  Future<void> _enqueue(Map<String, dynamic> event) async {
    await _ensureInitialized();
    final queued = QueuedMonitorEvent.fromEnvelope(event);
    final result = await _queue.enqueue(queued);
    _health?.recordEnqueued();
    if (!result.accepted || result.dropped.isNotEmpty) {
      _health?.recordDroppedQueuedEvents(
        result.reason ?? SdkDropReasons.queueFull,
        result.dropped,
      );
    }
    final stats = await _queue.stats();
    _health?.updateQueueStats(length: stats.length, bytes: stats.bytes);
    if (stats.length >= policy.maxBatchEvents) {
      unawaited(flush(reason: SdkFlushReasons.batchSize));
      return;
    }
    if (_isFastFlushEvent(event)) {
      _scheduleQuickFlush();
    }
  }

  @override
  Future<void> flush({
    bool isAppExiting = false,
    String reason = SdkFlushReasons.manual,
  }) async {
    if (_disposed && !isAppExiting) return;
    if (_activeFlush != null) return _activeFlush;
    _activeFlush = _flushNow(isAppExiting: isAppExiting, reason: reason);
    try {
      await _activeFlush;
    } finally {
      _activeFlush = null;
    }
  }

  Future<void> _flushNow({
    required bool isAppExiting,
    required String reason,
  }) async {
    await _ensureInitialized();
    final now = DateTime.now();
    final expired = await _queue.deleteExpired(
      now.subtract(policy.maxEventAge),
    );
    _health?.recordDroppedQueuedEvents(SdkDropReasons.expired, expired);
    final maxEvents = _temporaryMaxBatchEvents ?? policy.maxBatchEvents;
    _temporaryMaxBatchEvents = null;
    final batch = await _queue.nextBatch(
      maxEvents: maxEvents,
      maxBytes: policy.maxBatchBytes,
      now: now,
    );
    if (batch.isEmpty) return;

    final startedAt = DateTime.now();
    try {
      final response = await _postBatch(batch).timeout(
        isAppExiting
            ? minDuration(policy.requestTimeout, const Duration(seconds: 2))
            : policy.requestTimeout,
      );
      await _handleResponse(batch, response);
    } catch (error) {
      _health?.recordFlushFailure();
      if (isAppExiting) {
        debugPrint('Flutter Monitor exit flush failed: $error');
        _emitFlushFailure(
          batch,
          reason: reason,
          startedAt: startedAt,
          payload: <String, Object?>{PayloadKeys.error: error.toString()},
        );
        return;
      }
      await _scheduleRetry(batch, SdkRetryReasons.timeout);
    }
  }

  Future<http.Response> _postBatch(List<QueuedMonitorEvent> batch) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final token = await authTokenProvider?.call();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return _client.post(
      endpoint,
      headers: headers,
      body: jsonEncode(<String, Object?>{
        'events': batch.map((event) => event.envelope).toList(growable: false),
      }),
    );
  }

  Future<void> _handleResponse(
    List<QueuedMonitorEvent> batch,
    http.Response response,
  ) async {
    final status = response.statusCode;
    if (status >= 200 && status < 300) {
      await _queue.ack(_ids(batch));
      _health?.recordFlushSuccess();
      _health?.recordSent(batch.length);
      return;
    }
    _health?.recordFlushFailure();
    if (status == 429) {
      await _scheduleRetry(
        batch,
        SdkRetryReasons.rateLimited,
        retryAfter: _retryAfter(response),
      );
      return;
    }
    if (status == 413) {
      if (batch.length > 1) {
        _temporaryMaxBatchEvents = max(1, batch.length ~/ 2);
        await _scheduleRetry(
          batch,
          SdkRetryReasons.partialRetryable,
          retryAfter: Duration.zero,
        );
      } else {
        await _queue.ack(_ids(batch));
        _health?.recordDroppedQueuedEvents(
          SdkDropReasons.payloadTooLarge,
          batch,
        );
      }
      return;
    }
    if (status == 400 || status == 401 || status == 403) {
      await _queue.ack(_ids(batch));
      _health?.recordDroppedQueuedEvents(
        SdkDropReasons.nonRetryableRejected,
        batch,
      );
      return;
    }
    if (status >= 500) {
      await _scheduleRetry(batch, SdkRetryReasons.serverError);
      return;
    }
    await _queue.ack(_ids(batch));
    _health?.recordDroppedQueuedEvents(
      SdkDropReasons.nonRetryableRejected,
      batch,
    );
  }

  /// 重试计划按事件各自的累计重试次数判定。
  ///
  /// 重试超限的事件按 `retry_exhausted` 丢弃；同一 batch 中未超限的事件
  /// 重新入队，不会被旧事件连坐。
  Future<void> _scheduleRetry(
    List<QueuedMonitorEvent> batch,
    String reason, {
    Duration? retryAfter,
  }) async {
    final exhausted = batch
        .where((event) => event.attemptCount >= policy.maxRetryAttempts)
        .toList(growable: false);
    if (exhausted.isNotEmpty) {
      await _queue.ack(_ids(exhausted));
      _health?.recordDroppedQueuedEvents(
        SdkDropReasons.retryExhausted,
        exhausted,
      );
    }
    final retryable = batch
        .where((event) => event.attemptCount < policy.maxRetryAttempts)
        .toList(growable: false);
    if (retryable.isEmpty) return;
    final delay = retryAfter ?? _retryDelay(retryable);
    await _queue.scheduleRetry(
      _ids(retryable),
      nextAttemptAt: DateTime.now().add(delay),
    );
    _health?.recordRetryScheduled(
      retryCount: _maxAttemptCount(retryable) + 1,
      delay: delay,
      reason: reason,
      batchSize: retryable.length,
    );
  }

  Duration _retryDelay(List<QueuedMonitorEvent> batch) {
    final attempts = batch.fold<int>(
      0,
      (maxAttempt, event) => max(maxAttempt, event.attemptCount),
    );
    final multiplier = pow(2, attempts).toInt();
    final baseMs = policy.retryBaseDelay.inMilliseconds * multiplier;
    final cappedMs = min(baseMs, policy.retryMaxDelay.inMilliseconds);
    final jitterMs = cappedMs <= 0
        ? 0
        : Random().nextInt(max(1, cappedMs ~/ 4));
    return Duration(milliseconds: cappedMs + jitterMs);
  }

  Duration? _retryAfter(http.Response response) {
    final header = response.headers['retry-after'];
    if (header == null || header.isEmpty) return null;
    final seconds = int.tryParse(header);
    if (seconds != null) return Duration(seconds: seconds);
    final date = DateTime.tryParse(header);
    if (date == null) return null;
    final delay = date.difference(DateTime.now());
    return delay.isNegative ? Duration.zero : delay;
  }

  bool _isFastFlushEvent(Map<String, dynamic> event) {
    final priority = EventPriority.fromJson(event['priority'] as String?);
    return priority == EventPriority.high || priority == EventPriority.critical;
  }

  void _scheduleQuickFlush() {
    _quickFlushTimer ??= Timer(policy.quickFlushDelay, () {
      _quickFlushTimer = null;
      unawaited(flush(reason: SdkFlushReasons.criticalEvent));
    });
  }

  List<String> _ids(List<QueuedMonitorEvent> batch) {
    return batch.map((event) => event.eventId).toList(growable: false);
  }

  /// flush 失败的边沿事件；成功 flush 只累计进 health 计数器，不发事件。
  void _emitFlushFailure(
    List<QueuedMonitorEvent> batch, {
    required String reason,
    required DateTime startedAt,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    onHealthEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkOutputFlush,
        level: EventLevel.warning,
        status: EventStatus.error,
        priority: EventPriority.high,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          FieldPaths.sdkFlushReason: reason,
          FieldPaths.sdkFlushDurationMs: DateTime.now()
              .difference(startedAt)
              .inMilliseconds,
          FieldPaths.sdkBatchSize: batch.length,
          FieldPaths.sdkBatchBytes: batch.fold<int>(
            0,
            (sum, event) => sum + event.bytes,
          ),
        },
        payload: payload,
      ),
    );
  }

  int _maxAttemptCount(List<QueuedMonitorEvent> batch) {
    return batch.fold<int>(
      0,
      (maxAttempt, event) => max(maxAttempt, event.attemptCount),
    );
  }

  Future<void> _ensureInitialized() async {
    final init = _initFuture;
    if (init != null) await init;
  }

  @override
  void dispose() {
    _intervalTimer?.cancel();
    _quickFlushTimer?.cancel();
    _disposed = true;
    unawaited(flush(isAppExiting: true, reason: SdkFlushReasons.appExit));
    unawaited(_queue.dispose());
    _client.close();
  }
}

Duration minDuration(Duration a, Duration b) {
  return a <= b ? a : b;
}
