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
    this.traceId,
    this.spanId,
    this.parentSpanId,
    this.includeBreadcrumbs,
    this.breadcrumbLimit,
    this.eventPhase,
    this.contextRouteName,
    this.contextRouteFullName,
    this.nativeContext,
    this.contextMissing,
    this.contextMissingReason,
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
  final String? traceId;
  final String? spanId;
  final String? parentSpanId;
  final bool? includeBreadcrumbs;
  final int? breadcrumbLimit;
  final String? eventPhase;
  final String? contextRouteName;
  final String? contextRouteFullName;
  final NativeResourceSnapshot? nativeContext;
  final bool? contextMissing;
  final String? contextMissingReason;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;
}
