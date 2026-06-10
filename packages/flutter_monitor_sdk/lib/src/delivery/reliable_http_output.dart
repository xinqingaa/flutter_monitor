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

class ReliableHttpOutput extends MonitorOutput {
  ReliableHttpOutput({
    required this.endpoint,
    required this.mode,
    required this.policy,
    required OfflineEventQueue queue,
    this.authTokenProvider,
    http.Client? client,
  }) : _queue = queue,
       _client = client ?? http.Client();

  final Uri endpoint;
  final String mode;
  final MonitorProductionPolicy policy;
  final OfflineEventQueue _queue;
  final Future<String?> Function()? authTokenProvider;
  final http.Client _client;

  Future<void>? _initFuture;
  Future<void>? _activeFlush;
  Timer? _intervalTimer;
  Timer? _quickFlushTimer;
  int? _temporaryMaxBatchEvents;
  var _disposed = false;

  @override
  void init() {
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
    final isOutputHealthEvent = event['name'] == EventNames.sdkOutputFlush;
    final result = await _queue.enqueue(queued);
    if (!isOutputHealthEvent &&
        (!result.accepted || result.dropped.isNotEmpty)) {
      _emitDrop(result.reason ?? SdkDropReasons.queueFull, result.dropped);
    }
    final stats = await _queue.stats();
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
    await _queue.deleteExpired(now.subtract(policy.maxEventAge));
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
      await _handleResponse(
        batch,
        response,
        startedAt: startedAt,
        reason: reason,
      );
    } catch (error) {
      if (isAppExiting) {
        debugPrint('Flutter Monitor exit flush failed: $error');
        _emitFlush(
          batch,
          status: EventStatus.error,
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
    http.Response response, {
    required DateTime startedAt,
    required String reason,
  }) async {
    final status = response.statusCode;
    if (status >= 200 && status < 300) {
      await _queue.ack(_ids(batch));
      if (!_containsOutputFlushEvent(batch)) {
        _emitFlush(
          batch,
          status: EventStatus.ok,
          reason: reason,
          startedAt: startedAt,
        );
      }
      return;
    }
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
        _emitDrop(SdkDropReasons.payloadTooLarge, batch);
      }
      return;
    }
    if (status == 400 || status == 401 || status == 403) {
      await _queue.ack(_ids(batch));
      _emitDrop(SdkDropReasons.nonRetryableRejected, batch);
      return;
    }
    if (status >= 500) {
      await _scheduleRetry(batch, SdkRetryReasons.serverError);
      return;
    }
    await _queue.ack(_ids(batch));
    _emitDrop(SdkDropReasons.nonRetryableRejected, batch);
  }

  Future<void> _scheduleRetry(
    List<QueuedMonitorEvent> batch,
    String reason, {
    Duration? retryAfter,
  }) async {
    final delay = retryAfter ?? _retryDelay(batch);
    await _queue.scheduleRetry(
      _ids(batch),
      nextAttemptAt: DateTime.now().add(delay),
    );
    onHealthEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkRetrySchedule,
        level: EventLevel.warning,
        status: EventStatus.ok,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          FieldPaths.sdkRetryCount: _maxAttemptCount(batch) + 1,
          FieldPaths.sdkRetryDelayMs: delay.inMilliseconds,
          FieldPaths.sdkRetryReason: reason,
          FieldPaths.sdkBatchSize: batch.length,
        },
      ),
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

  void _emitDrop(String reason, List<QueuedMonitorEvent> events) {
    if (events.isEmpty) return;
    onHealthEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkQueueDrop,
        level: EventLevel.warning,
        status: EventStatus.error,
        priority: EventPriority.high,
        attributes: <String, Object?>{
          FieldPaths.sdkOutputMode: mode,
          FieldPaths.sdkDropReason: reason,
          FieldPaths.sdkDropCount: events.length,
        },
      ),
    );
  }

  void _emitFlush(
    List<QueuedMonitorEvent> batch, {
    required EventStatus status,
    required String reason,
    required DateTime startedAt,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    onHealthEvent?.call(
      OutputHealthEvent(
        name: EventNames.sdkOutputFlush,
        level: status == EventStatus.ok ? EventLevel.info : EventLevel.warning,
        status: status,
        priority: status == EventStatus.ok
            ? EventPriority.normal
            : EventPriority.high,
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

  bool _containsOutputFlushEvent(List<QueuedMonitorEvent> batch) {
    return batch.any((event) => event.name == EventNames.sdkOutputFlush);
  }

  Future<void> _ensureInitialized() async {
    final init = _initFuture;
    if (init != null) await init;
  }

  @override
  void dispose() {
    _disposed = true;
    _intervalTimer?.cancel();
    _quickFlushTimer?.cancel();
    unawaited(flush(isAppExiting: true, reason: SdkFlushReasons.appExit));
    unawaited(_queue.dispose());
    _client.close();
  }
}

Duration minDuration(Duration a, Duration b) {
  return a <= b ? a : b;
}
