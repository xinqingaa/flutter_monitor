import 'package:flutter_monitor_core/flutter_monitor_core.dart';

class RawSignal {
  const RawSignal({
    required this.source,
    required this.name,
    required this.signalType,
    required this.timestamp,
    this.startTime,
    this.endTime,
    this.durationMs,
    this.level,
    this.status,
    this.priority = EventPriority.normal,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final String source;
  final String name;
  final SignalType signalType;
  final DateTime timestamp;
  final DateTime? startTime;
  final DateTime? endTime;
  final num? durationMs;
  final EventLevel? level;
  final EventStatus? status;
  final EventPriority priority;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;
}
