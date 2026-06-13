import 'package:flutter_monitor_core/flutter_monitor_core.dart';

import 'queued_monitor_event.dart';

/// 离线队列超限时的降级结果。
class QueueDegradationResult {
  const QueueDegradationResult({
    required this.kept,
    required this.dropped,
    required this.upserts,
    required this.removedIds,
  });

  /// 降级后队列应保留的全量事件。
  final List<QueuedMonitorEvent> kept;

  /// 被审计丢弃的事件（计入 health report）。
  final List<QueuedMonitorEvent> dropped;

  /// 需要写回存储的事件：被剥离详情的事件与新建/更新的 summary 事件。
  final Map<String, QueuedMonitorEvent> upserts;

  /// 需要从存储删除的 eventId：被丢弃的与被聚合进 summary 的。
  final Set<String> removedIds;
}

/// 队列超限降级阶梯，原则是“压缩而非丢弃”：
///
/// 1. 驱逐最旧 sampleable（审计丢弃）；
/// 2. 字节超限时剥离最旧 `payload.http.detail`/`http.query`（保留 hash）；
/// 3. 丢弃最旧普通 compressible（审计丢弃）；
/// 4. 可聚合 hard（http.client、business track）聚合为 summary 事件；
/// 5. 物理极限按最旧丢 hard（审计丢弃）。
QueueDegradationResult degradeToLimits({
  required List<QueuedMonitorEvent> events,
  required int maxEvents,
  required int maxBytes,
}) {
  final working = List<QueuedMonitorEvent>.from(events);
  final dropped = <QueuedMonitorEvent>[];
  final upserts = <String, QueuedMonitorEvent>{};
  final removedIds = <String>{};

  var totalBytes = working.fold<int>(0, (sum, event) => sum + event.bytes);
  bool overLimit() => working.length > maxEvents || totalBytes > maxBytes;

  void removeAt(int index, {required bool audit}) {
    final event = working.removeAt(index);
    totalBytes -= event.bytes;
    removedIds.add(event.eventId);
    upserts.remove(event.eventId);
    if (audit) dropped.add(event);
  }

  int oldestWhere(bool Function(QueuedMonitorEvent event) test) {
    var index = -1;
    for (var i = 0; i < working.length; i++) {
      final event = working[i];
      if (!test(event)) continue;
      if (index < 0 || event.createdAt.isBefore(working[index].createdAt)) {
        index = i;
      }
    }
    return index;
  }

  while (overLimit()) {
    // 1. sampleable 最先驱逐。
    final sampleable = oldestWhere(
      (event) => event.retention == EventRetention.sampleable,
    );
    if (sampleable >= 0) {
      removeAt(sampleable, audit: true);
      continue;
    }

    // 2. 字节超限时优先剥离 HTTP 详情层，不丢事件。
    if (totalBytes > maxBytes) {
      final strippable = oldestWhere(_hasHttpDetail);
      if (strippable >= 0) {
        final original = working[strippable];
        final stripped = _stripHttpDetail(original);
        working[strippable] = stripped;
        totalBytes += stripped.bytes - original.bytes;
        upserts[stripped.eventId] = stripped;
        continue;
      }
    }

    // 3. 普通 compressible 让位（审计丢弃）。
    final compressible = oldestWhere(
      (event) => event.retention == EventRetention.compressible,
    );
    if (compressible >= 0) {
      removeAt(compressible, audit: true);
      continue;
    }

    // 4. 可聚合 hard 先聚合为 summary。
    final foldable = oldestWhere(_isFoldableHard);
    if (foldable >= 0) {
      final event = working[foldable];
      // 不审计为丢弃：事实被压缩进 summary。
      removeAt(foldable, audit: false);
      final key = _summaryGroupKey(event);
      final existingIndex = working.indexWhere(
        (candidate) => _summaryGroupKeyOfSummary(candidate) == key,
      );
      final folded = _foldIntoSummary(
        existing: existingIndex >= 0 ? working[existingIndex] : null,
        event: event,
      );
      if (existingIndex >= 0) {
        totalBytes -= working[existingIndex].bytes;
        working[existingIndex] = folded;
      } else {
        working.add(folded);
      }
      totalBytes += folded.bytes;
      upserts[folded.eventId] = folded;
      continue;
    }

    // 5. 物理极限：按最旧丢 hard（或任何剩余事件），必须审计。
    final oldest = oldestWhere((event) => true);
    if (oldest < 0) break;
    removeAt(oldest, audit: true);
  }

  return QueueDegradationResult(
    kept: working,
    dropped: dropped,
    upserts: upserts,
    removedIds: removedIds,
  );
}

bool _hasHttpDetail(QueuedMonitorEvent event) {
  final payload = event.envelope['payload'];
  if (payload is! Map) return false;
  if (payload[PayloadKeys.httpDetailDropped] == true) return false;
  return payload.containsKey(PayloadKeys.httpDetail) ||
      payload.containsKey(PayloadKeys.httpQuery);
}

/// Returns a copy with HTTP detail/query stripped when possible.
///
/// This is used both by queue pressure degradation and by single-envelope
/// max-size handling. If the event has no detail layer, the original instance
/// is returned unchanged.
QueuedMonitorEvent stripHttpDetailForQueue(QueuedMonitorEvent event) {
  if (!_hasHttpDetail(event)) return event;
  return _stripHttpDetail(event);
}

/// 剥离详情层：移除 query 与 headers/body 原文，保留每侧的 hash 与原始长度。
QueuedMonitorEvent _stripHttpDetail(QueuedMonitorEvent event) {
  final envelope = Map<String, dynamic>.from(event.envelope);
  final payload = Map<String, Object?>.from(
    (envelope['payload'] as Map?)?.cast<String, Object?>() ??
        const <String, Object?>{},
  );
  payload.remove(PayloadKeys.httpQuery);
  final detail = payload[PayloadKeys.httpDetail];
  if (detail is Map) {
    final reduced = <String, Object?>{};
    for (final side in <String>[PayloadKeys.request, PayloadKeys.response]) {
      final sideValue = detail[side];
      if (sideValue is! Map) continue;
      final hashOnly = <String, Object?>{
        if (sideValue[PayloadKeys.bodySha256] != null)
          PayloadKeys.bodySha256: sideValue[PayloadKeys.bodySha256],
        if (sideValue[PayloadKeys.bodyOriginalLength] != null)
          PayloadKeys.bodyOriginalLength:
              sideValue[PayloadKeys.bodyOriginalLength],
      };
      if (hashOnly.isNotEmpty) reduced[side] = hashOnly;
    }
    if (reduced.isEmpty) {
      payload.remove(PayloadKeys.httpDetail);
    } else {
      payload[PayloadKeys.httpDetail] = reduced;
    }
  }
  payload[PayloadKeys.httpDetailDropped] = true;
  envelope['payload'] = payload;
  // 重新构造以重算 bytes（copyWith 会沿用旧值）。
  return QueuedMonitorEvent(
    eventId: event.eventId,
    envelope: envelope,
    priority: event.priority,
    createdAt: event.createdAt,
    nextAttemptAt: event.nextAttemptAt,
    attemptCount: event.attemptCount,
    retention: event.retention,
  );
}

bool _isFoldableHard(QueuedMonitorEvent event) {
  if (event.retention != EventRetention.hard) return false;
  if (event.name == EventNames.httpClient) return true;
  if (event.signalType == SignalType.breadcrumb.toJson()) {
    final attributes = event.envelope['attributes'];
    return attributes is Map &&
        attributes.containsKey(FieldPaths.businessAction);
  }
  return false;
}

String _summaryGroupKey(QueuedMonitorEvent event) {
  final attributes = event.envelope['attributes'];
  final attrs = attributes is Map ? attributes : const <String, Object?>{};
  if (event.name == EventNames.httpClient) {
    return [
      EventNames.httpClientSummary,
      event.sessionId,
      attrs[FieldPaths.httpUrlNormalized] ?? '',
      attrs[FieldPaths.httpSuccess] ?? '',
    ].join('|');
  }
  return [
    EventNames.businessActionSummary,
    event.sessionId,
    attrs[FieldPaths.businessAction] ?? event.name,
  ].join('|');
}

String? _summaryGroupKeyOfSummary(QueuedMonitorEvent event) {
  if (event.name != EventNames.httpClientSummary &&
      event.name != EventNames.businessActionSummary) {
    return null;
  }
  final attributes = event.envelope['attributes'];
  final attrs = attributes is Map ? attributes : const <String, Object?>{};
  if (event.name == EventNames.httpClientSummary) {
    return [
      EventNames.httpClientSummary,
      event.sessionId,
      attrs[FieldPaths.httpUrlNormalized] ?? '',
      attrs[FieldPaths.httpSuccess] ?? '',
    ].join('|');
  }
  return [
    EventNames.businessActionSummary,
    event.sessionId,
    attrs[FieldPaths.businessAction] ?? '',
  ].join('|');
}

const int _maxSummaryDurationSamples = 128;
const int _maxExemplarEventIds = 5;

QueuedMonitorEvent _foldIntoSummary({
  required QueuedMonitorEvent? existing,
  required QueuedMonitorEvent event,
}) {
  final eventEnvelope = event.envelope;
  final eventAttrs =
      (eventEnvelope['attributes'] as Map?)?.cast<String, Object?>() ??
      const <String, Object?>{};
  final isHttp = event.name == EventNames.httpClient;
  final summaryName = isHttp
      ? EventNames.httpClientSummary
      : EventNames.businessActionSummary;

  Map<String, dynamic> envelope;
  if (existing != null) {
    envelope = Map<String, dynamic>.from(existing.envelope);
  } else {
    envelope = <String, dynamic>{
      'schemaVersion': eventEnvelope['schemaVersion'] ?? '1.0',
      'eventId':
          'evt_sum_${summaryName.hashCode.toRadixString(16)}_'
          '${DateTime.now().microsecondsSinceEpoch}',
      'timestamp': eventEnvelope['timestamp'],
      'signalType': SignalType.metric.toJson(),
      'name': summaryName,
      'level': EventLevel.info.toJson(),
      'status': EventStatus.ok.toJson(),
      'priority': EventPriority.high.toJson(),
      if (eventEnvelope['sessionId'] != null)
        'sessionId': eventEnvelope['sessionId'],
      if (eventEnvelope['resource'] != null)
        'resource': eventEnvelope['resource'],
      if (eventEnvelope['context'] != null) 'context': eventEnvelope['context'],
      'attributes': <String, Object?>{
        FieldPaths.eventPhase: EventPhases.instant,
        if (isHttp) ...<String, Object?>{
          if (eventAttrs[FieldPaths.httpUrlNormalized] != null)
            FieldPaths.httpUrlNormalized:
                eventAttrs[FieldPaths.httpUrlNormalized],
          if (eventAttrs[FieldPaths.httpSuccess] != null)
            FieldPaths.httpSuccess: eventAttrs[FieldPaths.httpSuccess],
        } else
          FieldPaths.businessAction:
              eventAttrs[FieldPaths.businessAction] ?? event.name,
      },
      'payload': <String, Object?>{},
    };
  }

  final attributes = Map<String, Object?>.from(
    (envelope['attributes'] as Map?)?.cast<String, Object?>() ??
        const <String, Object?>{},
  );
  final payload = Map<String, Object?>.from(
    (envelope['payload'] as Map?)?.cast<String, Object?>() ??
        const <String, Object?>{},
  );

  final count = (attributes[FieldPaths.summaryCount] as num? ?? 0) + 1;
  attributes[FieldPaths.summaryCount] = count;

  final durations = List<num>.from(
    (payload[PayloadKeys.summaryDurationsMs] as List?)?.whereType<num>() ??
        const <num>[],
  );
  final durationMs = eventEnvelope['durationMs'];
  if (durationMs is num && durations.length < _maxSummaryDurationSamples) {
    durations.add(durationMs);
  }
  if (durations.isNotEmpty) {
    final sorted = List<num>.from(durations)..sort();
    num percentile(double q) =>
        sorted[((sorted.length - 1) * q).round().clamp(0, sorted.length - 1)];
    attributes[FieldPaths.summaryDurationP50Ms] = percentile(0.5);
    attributes[FieldPaths.summaryDurationP95Ms] = percentile(0.95);
    attributes[FieldPaths.summaryDurationMaxMs] = sorted.last;
    payload[PayloadKeys.summaryDurationsMs] = durations;
  }

  final previousBytes = attributes[FieldPaths.summaryBytesTotal] as num? ?? 0;
  attributes[FieldPaths.summaryBytesTotal] =
      previousBytes + _foldedBytes(eventAttrs, event);

  final exemplars = List<String>.from(
    (payload[PayloadKeys.exemplarEventIds] as List?)?.whereType<String>() ??
        const <String>[],
  );
  if (exemplars.length < _maxExemplarEventIds) {
    exemplars.add(event.eventId);
  }
  payload[PayloadKeys.exemplarEventIds] = exemplars;

  envelope['attributes'] = attributes;
  envelope['payload'] = payload;
  envelope['timestamp'] = eventEnvelope['timestamp'] ?? envelope['timestamp'];

  return QueuedMonitorEvent(
    eventId: envelope['eventId'] as String,
    envelope: envelope,
    priority: EventPriority.high,
    createdAt: existing?.createdAt ?? event.createdAt,
  );
}

num _foldedBytes(Map<String, Object?> attrs, QueuedMonitorEvent event) {
  final request = attrs[FieldPaths.requestSizeBytes];
  final response = attrs[FieldPaths.responseSizeBytes];
  if (request is num || response is num) {
    return (request is num ? request : 0) + (response is num ? response : 0);
  }
  return event.bytes;
}
