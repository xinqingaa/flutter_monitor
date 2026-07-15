import 'package:flutter_monitor_core/flutter_monitor_core.dart';

import 'raw_signal.dart';

/// Deduplicates repeated errors by `error.fingerprint` within a session window.
///
/// First occurrence of a fingerprint is emitted in full. Later throws are
/// folded and flushed as `error.group.summary` with `summary.count`.
class ErrorSummaryAggregator {
  ErrorSummaryAggregator({
    required this.emit,
    this.window = const Duration(seconds: 60),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final void Function(RawSignal signal) emit;
  final Duration window;
  final DateTime Function() _now;
  final Map<String, _ErrorSummaryBucket> _buckets =
      <String, _ErrorSummaryBucket>{};

  /// Returns `true` when the envelope should be dispatched as a full error.
  bool observe(EventEnvelope envelope) {
    final fingerprint =
        envelope.attributes[FieldPaths.errorFingerprint] as String?;
    if (fingerprint == null || fingerprint.isEmpty) return true;

    final now = _now();
    final existing = _buckets[fingerprint];
    if (existing == null) {
      _buckets[fingerprint] = _ErrorSummaryBucket.fromFirst(envelope, now);
      return true;
    }

    existing.add(envelope, now);
    if (now.difference(existing.windowStartedAt) >= window) {
      _flushBucket(fingerprint);
    }
    return false;
  }

  /// Emits summaries for buckets that saw more than one occurrence.
  void flush() {
    final keys = _buckets.keys.toList(growable: false);
    for (final key in keys) {
      _flushBucket(key);
    }
  }

  void _flushBucket(String fingerprint) {
    final bucket = _buckets.remove(fingerprint);
    if (bucket == null) return;
    if (bucket.count <= 1) return;
    emit(bucket.toSignal(_now()));
  }
}

const int _maxExemplarEventIds = 5;

class _ErrorSummaryBucket {
  _ErrorSummaryBucket({
    required this.fingerprint,
    required this.title,
    required this.type,
    required this.mechanism,
    required this.windowStartedAt,
    required this.firstEventId,
  });

  factory _ErrorSummaryBucket.fromFirst(EventEnvelope envelope, DateTime now) {
    return _ErrorSummaryBucket(
      fingerprint: envelope.attributes[FieldPaths.errorFingerprint] as String,
      title: envelope.attributes[FieldPaths.errorTitle] as String? ??
          envelope.name,
      type: envelope.attributes[FieldPaths.errorType] as String?,
      mechanism: envelope.attributes[FieldPaths.errorMechanism] as String?,
      windowStartedAt: now,
      firstEventId: envelope.eventId,
    )..count = 1;
  }

  final String fingerprint;
  final String title;
  final String? type;
  final String? mechanism;
  final DateTime windowStartedAt;
  final String firstEventId;
  int count = 0;
  final List<String> exemplarEventIds = <String>[];

  void add(EventEnvelope envelope, DateTime now) {
    count += 1;
    if (exemplarEventIds.isEmpty) {
      exemplarEventIds.add(firstEventId);
    }
    if (exemplarEventIds.length < _maxExemplarEventIds) {
      exemplarEventIds.add(envelope.eventId);
    }
  }

  RawSignal toSignal(DateTime now) {
    final exemplars = exemplarEventIds.isEmpty
        ? <String>[firstEventId]
        : List<String>.from(exemplarEventIds);
    return RawSignal(
      source: SignalSources.sdkError,
      name: EventNames.errorGroupSummary,
      signalType: SignalType.metric,
      timestamp: now,
      level: EventLevel.info,
      status: EventStatus.ok,
      priority: EventPriority.high,
      includeBreadcrumbs: false,
      attributes: <String, Object?>{
        FieldPaths.errorFingerprint: fingerprint,
        FieldPaths.errorTitle: title,
        if (type != null) FieldPaths.errorType: type,
        if (mechanism != null) FieldPaths.errorMechanism: mechanism,
        FieldPaths.summaryCount: count,
      },
      payload: <String, Object?>{
        PayloadKeys.exemplarEventIds: exemplars,
      },
    );
  }
}
