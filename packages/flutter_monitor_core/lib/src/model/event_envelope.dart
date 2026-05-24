import '../schema/schema_version.dart';
import 'event_level.dart';
import 'event_priority.dart';
import 'event_status.dart';
import 'json_utils.dart';
import 'monitor_context.dart';
import 'monitor_resource.dart';
import 'signal_type.dart';

class EventEnvelope {
  const EventEnvelope({
    this.schemaVersion = SchemaVersion.current,
    required this.eventId,
    required this.timestamp,
    this.startTime,
    this.endTime,
    this.durationMs,
    required this.signalType,
    required this.name,
    this.level,
    this.status,
    this.priority = EventPriority.normal,
    this.sessionId,
    this.traceId,
    this.spanId,
    this.parentSpanId,
    this.resource = const MonitorResource.empty(),
    this.context = const MonitorContext.empty(),
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final SchemaVersion schemaVersion;
  final String eventId;
  final DateTime timestamp;
  final DateTime? startTime;
  final DateTime? endTime;
  final num? durationMs;
  final SignalType signalType;
  final String name;
  final EventLevel? level;
  final EventStatus? status;
  final EventPriority priority;
  final String? sessionId;
  final String? traceId;
  final String? spanId;
  final String? parentSpanId;
  final MonitorResource resource;
  final MonitorContext context;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  factory EventEnvelope.fromJson(Map<String, Object?> json) {
    return EventEnvelope(
      schemaVersion: SchemaVersion.parse(
        json['schemaVersion'] as String? ?? '1.0',
      ),
      eventId: json['eventId'] as String? ?? '',
      timestamp:
          dateTimeFromJson(json['timestamp']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      startTime: dateTimeFromJson(json['startTime']),
      endTime: dateTimeFromJson(json['endTime']),
      durationMs: json['durationMs'] as num?,
      signalType: SignalType.fromJson(json['signalType']),
      name: json['name'] as String? ?? '',
      level: json.containsKey('level')
          ? EventLevel.fromJson(json['level'])
          : null,
      status: json.containsKey('status')
          ? EventStatus.fromJson(json['status'])
          : null,
      priority: EventPriority.fromJson(json['priority']),
      sessionId: json['sessionId'] as String?,
      traceId: json['traceId'] as String?,
      spanId: json['spanId'] as String?,
      parentSpanId: json['parentSpanId'] as String?,
      resource: json['resource'] is Map
          ? MonitorResource.fromJson(objectMap(json['resource']))
          : const MonitorResource.empty(),
      context: json['context'] is Map
          ? MonitorContext.fromJson(objectMap(json['context']))
          : const MonitorContext.empty(),
      attributes: objectMap(json['attributes']),
      payload: objectMap(json['payload']),
    );
  }

  EventEnvelope copyWith({
    SchemaVersion? schemaVersion,
    String? eventId,
    DateTime? timestamp,
    DateTime? startTime,
    DateTime? endTime,
    num? durationMs,
    SignalType? signalType,
    String? name,
    EventLevel? level,
    EventStatus? status,
    EventPriority? priority,
    String? sessionId,
    String? traceId,
    String? spanId,
    String? parentSpanId,
    MonitorResource? resource,
    MonitorContext? context,
    Map<String, Object?>? attributes,
    Map<String, Object?>? payload,
  }) {
    return EventEnvelope(
      schemaVersion: schemaVersion ?? this.schemaVersion,
      eventId: eventId ?? this.eventId,
      timestamp: timestamp ?? this.timestamp,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      durationMs: durationMs ?? this.durationMs,
      signalType: signalType ?? this.signalType,
      name: name ?? this.name,
      level: level ?? this.level,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      sessionId: sessionId ?? this.sessionId,
      traceId: traceId ?? this.traceId,
      spanId: spanId ?? this.spanId,
      parentSpanId: parentSpanId ?? this.parentSpanId,
      resource: resource ?? this.resource,
      context: context ?? this.context,
      attributes: attributes ?? this.attributes,
      payload: payload ?? this.payload,
    );
  }

  Map<String, Object?> toJson() {
    final json = jsonMap({
      'schemaVersion': schemaVersion.toString(),
      'eventId': eventId,
      'timestamp': timestamp.toIso8601String(),
      'startTime': dateTimeToJson(startTime),
      'endTime': dateTimeToJson(endTime),
      'durationMs': durationMs,
      'signalType': signalType.toJson(),
      'name': name,
      'level': level?.toJson(),
      'status': status?.toJson(),
      'priority': priority.toJson(),
      'sessionId': sessionId,
      'traceId': traceId,
      'spanId': spanId,
      'parentSpanId': parentSpanId,
    });

    json['resource'] = resource.toJson();
    json['context'] = context.toJson();
    json['attributes'] = attributes;
    json['payload'] = payload;
    return json;
  }
}
