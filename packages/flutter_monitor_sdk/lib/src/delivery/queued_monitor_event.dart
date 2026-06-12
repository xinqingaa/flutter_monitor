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
    EventRetention? retention,
  }) : nextAttemptAt = nextAttemptAt ?? createdAt,
       bytes = bytes ?? utf8.encode(jsonEncode(envelope)).length,
       retention =
           retention ?? RetentionRegistry.instance.resolveJson(envelope);

  final String eventId;
  final Map<String, dynamic> envelope;
  final EventPriority priority;
  final DateTime createdAt;
  final DateTime nextAttemptAt;
  final int attemptCount;
  final int bytes;

  /// 本地降级语义（hard/compressible/sampleable），不进入 wire envelope，
  /// 只用于队列驱逐顺序和压缩动作。
  final EventRetention retention;

  String get sessionId => _stringValue('sessionId') ?? '';
  String get traceId => _stringValue('traceId') ?? '';
  String get name => _stringValue('name') ?? '';
  String get signalType => _stringValue('signalType') ?? '';
  String get routeName => _nestedString('context', 'route', 'name') ?? '';
  String get moduleName => _nestedString('context', 'module', 'name') ?? '';
  String get moduleScene => _nestedString('context', 'module', 'scene') ?? '';
  String get source {
    final payload = envelope['payload'];
    if (payload is Map) {
      final value = payload[PayloadKeys.source];
      if (value is String) return value;
    }
    return '';
  }

  QueuedMonitorEvent copyWith({
    Map<String, dynamic>? envelope,
    EventPriority? priority,
    DateTime? createdAt,
    DateTime? nextAttemptAt,
    int? attemptCount,
    int? bytes,
    EventRetention? retention,
  }) {
    return QueuedMonitorEvent(
      eventId: eventId,
      envelope: envelope ?? this.envelope,
      priority: priority ?? this.priority,
      createdAt: createdAt ?? this.createdAt,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      attemptCount: attemptCount ?? this.attemptCount,
      bytes: bytes ?? this.bytes,
      retention: retention ?? this.retention,
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
      'retention': retention.toJson(),
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
      retention: record['retention'] is String
          ? EventRetention.fromJson(record['retention'])
          : RetentionRegistry.instance.resolveJson(decoded),
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

  String? _nestedString(String first, String second, String third) {
    final firstValue = envelope[first];
    if (firstValue is! Map) return null;
    final secondValue = firstValue[second];
    if (secondValue is! Map) return null;
    final thirdValue = secondValue[third];
    return thirdValue is String && thirdValue.isNotEmpty ? thirdValue : null;
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
