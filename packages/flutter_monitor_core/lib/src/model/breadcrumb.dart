import 'event_level.dart';
import 'json_utils.dart';

class Breadcrumb {
  const Breadcrumb({
    required this.timestamp,
    required this.name,
    this.level = EventLevel.info,
    this.eventId,
    this.sessionId,
    this.traceId,
    this.spanId,
    this.route,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final DateTime timestamp;
  final String name;
  final EventLevel level;
  final String? eventId;
  final String? sessionId;
  final String? traceId;
  final String? spanId;
  final String? route;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  factory Breadcrumb.fromJson(Map<String, Object?> json) {
    return Breadcrumb(
      timestamp:
          dateTimeFromJson(json['timestamp']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      name: json['name'] as String? ?? '',
      level: EventLevel.fromJson(json['level']),
      eventId: json['eventId'] as String?,
      sessionId: json['sessionId'] as String?,
      traceId: json['traceId'] as String?,
      spanId: json['spanId'] as String?,
      route: json['route'] as String?,
      attributes: objectMap(json['attributes']),
      payload: objectMap(json['payload']),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'timestamp': timestamp.toIso8601String(),
    'name': name,
    'level': level.toJson(),
    'eventId': eventId,
    'sessionId': sessionId,
    'traceId': traceId,
    'spanId': spanId,
    'route': route,
    'attributes': attributes,
    'payload': payload,
  });
}
