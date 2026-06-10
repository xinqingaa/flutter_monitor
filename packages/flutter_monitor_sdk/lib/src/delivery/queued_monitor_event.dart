import 'dart:convert';

import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// 已通过 privacy filtering、等待 delivery 的 envelope。
class QueuedMonitorEvent {
  QueuedMonitorEvent({
    required this.eventId,
    required this.envelope,
    required this.priority,
    required this.createdAt,
    DateTime? nextAttemptAt,
    this.attemptCount = 0,
    int? bytes,
  }) : nextAttemptAt = nextAttemptAt ?? createdAt,
       bytes = bytes ?? utf8.encode(jsonEncode(envelope)).length;

  final String eventId;
  final Map<String, dynamic> envelope;
  final EventPriority priority;
  final DateTime createdAt;
  final DateTime nextAttemptAt;
  final int attemptCount;
  final int bytes;

  String get sessionId => _stringValue('sessionId') ?? '';
  String get traceId => _stringValue('traceId') ?? '';
  String get name => _stringValue('name') ?? '';
  String get signalType => _stringValue('signalType') ?? '';

  QueuedMonitorEvent copyWith({
    Map<String, dynamic>? envelope,
    EventPriority? priority,
    DateTime? createdAt,
    DateTime? nextAttemptAt,
    int? attemptCount,
    int? bytes,
  }) {
    return QueuedMonitorEvent(
      eventId: eventId,
      envelope: envelope ?? this.envelope,
      priority: priority ?? this.priority,
      createdAt: createdAt ?? this.createdAt,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      attemptCount: attemptCount ?? this.attemptCount,
      bytes: bytes ?? this.bytes,
    );
  }

  Map<String, Object?> toRecord() {
    return <String, Object?>{
      'eventId': eventId,
      'sessionId': sessionId,
      'traceId': traceId,
      'name': name,
      'signalType': signalType,
      'priority': priority.toJson(),
      'createdAt': createdAt.millisecondsSinceEpoch,
      'nextAttemptAt': nextAttemptAt.millisecondsSinceEpoch,
      'attemptCount': attemptCount,
      'bytes': bytes,
      'envelope': jsonEncode(envelope),
    };
  }

  factory QueuedMonitorEvent.fromRecord(Map<String, Object?> record) {
    final envelopeText = record['envelope'] as String;
    final decoded = jsonDecode(envelopeText) as Map<String, dynamic>;
    return QueuedMonitorEvent(
      eventId: record['eventId'] as String,
      envelope: decoded,
      priority: EventPriority.fromJson(record['priority'] as String?),
      createdAt: DateTime.fromMillisecondsSinceEpoch(
        record['createdAt'] as int,
      ),
      nextAttemptAt: DateTime.fromMillisecondsSinceEpoch(
        record['nextAttemptAt'] as int,
      ),
      attemptCount: record['attemptCount'] as int? ?? 0,
      bytes: record['bytes'] as int? ?? utf8.encode(envelopeText).length,
    );
  }

  static QueuedMonitorEvent fromEnvelope(
    Map<String, dynamic> envelope, {
    DateTime? now,
  }) {
    final capturedAt = now ?? DateTime.now();
    return QueuedMonitorEvent(
      eventId: envelope['eventId'] as String,
      envelope: Map<String, dynamic>.from(envelope),
      priority: EventPriority.fromJson(envelope['priority'] as String?),
      createdAt: capturedAt,
    );
  }

  String? _stringValue(String key) {
    final value = envelope[key];
    return value is String ? value : null;
  }
}

class OfflineQueueStats {
  const OfflineQueueStats({required this.length, required this.bytes});

  final int length;
  final int bytes;
}

class OfflineQueueEnqueueResult {
  const OfflineQueueEnqueueResult({
    required this.accepted,
    this.dropped = const <QueuedMonitorEvent>[],
    this.reason,
  });

  final bool accepted;
  final List<QueuedMonitorEvent> dropped;
  final String? reason;
}
