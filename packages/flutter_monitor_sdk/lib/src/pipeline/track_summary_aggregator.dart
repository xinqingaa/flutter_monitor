import 'package:flutter_monitor_core/flutter_monitor_core.dart';

import 'raw_signal.dart';

/// 把超过 `maxTrackEventsPerMinute` 的业务 track 事件聚合为
/// `business.action.summary`，避免静默丢弃 hard 证据。
///
/// 聚合窗口默认 60s：窗口内首个超限事件开始计时，窗口结束后的下一次
/// fold 或外部 flush（进后台/退出/手动）时发出 summary 信号。
class TrackSummaryAggregator {
  TrackSummaryAggregator({
    required this.emit,
    this.window = const Duration(seconds: 60),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  /// summary 信号出口，通常回到 pipeline.capture。
  final void Function(RawSignal signal) emit;

  final Duration window;
  final DateTime Function() _now;
  final Map<String, _TrackSummaryBucket> _buckets =
      <String, _TrackSummaryBucket>{};
  DateTime? _windowStartedAt;

  /// 折叠一条超限 track 事件。
  void fold(EventEnvelope envelope) {
    final action =
        envelope.attributes[FieldPaths.businessAction] as String? ??
        envelope.name;
    _windowStartedAt ??= _now();
    _buckets
        .putIfAbsent(action, () => _TrackSummaryBucket(action))
        .add(envelope);
    final startedAt = _windowStartedAt;
    if (startedAt != null && _now().difference(startedAt) >= window) {
      flush();
    }
  }

  /// 发出所有未发出的 summary。窗口结束、进后台、退出或手动 flush 时调用。
  void flush() {
    if (_buckets.isEmpty) return;
    final buckets = _buckets.values.toList(growable: false);
    _buckets.clear();
    _windowStartedAt = null;
    final now = _now();
    for (final bucket in buckets) {
      emit(bucket.toSignal(now));
    }
  }
}

const int _maxDurationSamples = 128;
const int _maxExemplarEventIds = 5;

class _TrackSummaryBucket {
  _TrackSummaryBucket(this.action);

  final String action;
  int count = 0;
  final List<num> durations = <num>[];
  final List<String> exemplarEventIds = <String>[];

  void add(EventEnvelope envelope) {
    count += 1;
    final durationMs = envelope.durationMs;
    if (durationMs != null && durations.length < _maxDurationSamples) {
      durations.add(durationMs);
    }
    if (exemplarEventIds.length < _maxExemplarEventIds) {
      exemplarEventIds.add(envelope.eventId);
    }
  }

  RawSignal toSignal(DateTime now) {
    final sorted = List<num>.from(durations)..sort();
    num percentile(double q) =>
        sorted[((sorted.length - 1) * q).round().clamp(0, sorted.length - 1)];
    return RawSignal(
      source: SignalSources.sdkTrack,
      name: EventNames.businessActionSummary,
      signalType: SignalType.metric,
      timestamp: now,
      level: EventLevel.info,
      status: EventStatus.ok,
      priority: EventPriority.high,
      attributes: <String, Object?>{
        FieldPaths.businessAction: action,
        FieldPaths.summaryCount: count,
        if (sorted.isNotEmpty) ...<String, Object?>{
          FieldPaths.summaryDurationP50Ms: percentile(0.5),
          FieldPaths.summaryDurationP95Ms: percentile(0.95),
          FieldPaths.summaryDurationMaxMs: sorted.last,
        },
      },
      payload: <String, Object?>{
        PayloadKeys.exemplarEventIds: List<String>.from(exemplarEventIds),
      },
    );
  }
}
