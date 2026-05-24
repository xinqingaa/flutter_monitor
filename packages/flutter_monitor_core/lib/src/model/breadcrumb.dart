import 'event_level.dart';
import 'json_utils.dart';

class Breadcrumb {
  const Breadcrumb({
    required this.timestamp,
    required this.name,
    this.level = EventLevel.info,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final DateTime timestamp;
  final String name;
  final EventLevel level;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  factory Breadcrumb.fromJson(Map<String, Object?> json) {
    return Breadcrumb(
      timestamp:
          dateTimeFromJson(json['timestamp']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      name: json['name'] as String? ?? '',
      level: EventLevel.fromJson(json['level']),
      attributes: objectMap(json['attributes']),
      payload: objectMap(json['payload']),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'timestamp': timestamp.toIso8601String(),
    'name': name,
    'level': level.toJson(),
    'attributes': attributes,
    'payload': payload,
  });
}
