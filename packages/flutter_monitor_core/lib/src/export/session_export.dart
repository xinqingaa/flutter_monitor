import '../model/event_envelope.dart';
import '../model/json_utils.dart';
import '../schema/schema_version.dart';

class SessionExportSource {
  const SessionExportSource({
    required this.type,
    this.sdkVersion,
    this.coreVersion,
  });

  final String type;
  final String? sdkVersion;
  final String? coreVersion;

  factory SessionExportSource.fromJson(Map<String, Object?> json) {
    return SessionExportSource(
      type: json['type'] as String? ?? '',
      sdkVersion: json['sdkVersion'] as String?,
      coreVersion: json['coreVersion'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'type': type,
    'sdkVersion': sdkVersion,
    'coreVersion': coreVersion,
  });
}

class SessionExportSession {
  const SessionExportSession({
    required this.sessionId,
    this.startedAt,
    this.endedAt,
  });

  final String sessionId;
  final DateTime? startedAt;
  final DateTime? endedAt;

  factory SessionExportSession.fromJson(Map<String, Object?> json) {
    return SessionExportSession(
      sessionId: json['sessionId'] as String? ?? '',
      startedAt: dateTimeFromJson(json['startedAt']),
      endedAt: dateTimeFromJson(json['endedAt']),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'sessionId': sessionId,
    'startedAt': dateTimeToJson(startedAt),
    'endedAt': dateTimeToJson(endedAt),
  });
}

class SessionExportPrivacy {
  const SessionExportPrivacy({required this.filtered, this.policyVersion});

  final bool filtered;
  final String? policyVersion;

  factory SessionExportPrivacy.fromJson(Map<String, Object?> json) {
    return SessionExportPrivacy(
      filtered: json['filtered'] as bool? ?? false,
      policyVersion: json['policyVersion'] as String?,
    );
  }

  Map<String, Object?> toJson() =>
      jsonMap({'filtered': filtered, 'policyVersion': policyVersion});
}

class SessionExport {
  const SessionExport({
    this.schemaVersion = SchemaVersion.current,
    required this.exportedAt,
    required this.source,
    required this.session,
    this.events = const <EventEnvelope>[],
    this.sdkHealth = const <String, Object?>{},
    required this.privacy,
  });

  final SchemaVersion schemaVersion;
  final DateTime exportedAt;
  final SessionExportSource source;
  final SessionExportSession session;
  final List<EventEnvelope> events;
  final Map<String, Object?> sdkHealth;
  final SessionExportPrivacy privacy;

  factory SessionExport.fromJson(Map<String, Object?> json) {
    final rawEvents = json['events'];
    return SessionExport(
      schemaVersion: SchemaVersion.parse(
        json['schemaVersion'] as String? ?? '1.0',
      ),
      exportedAt:
          dateTimeFromJson(json['exportedAt']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      source: SessionExportSource.fromJson(objectMap(json['source'])),
      session: SessionExportSession.fromJson(objectMap(json['session'])),
      events: rawEvents is Iterable
          ? rawEvents
                .whereType<Map>()
                .map((event) => EventEnvelope.fromJson(objectMap(event)))
                .toList(growable: false)
          : const <EventEnvelope>[],
      sdkHealth: objectMap(json['sdkHealth']),
      privacy: SessionExportPrivacy.fromJson(objectMap(json['privacy'])),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'schemaVersion': schemaVersion.toString(),
    'exportedAt': exportedAt.toIso8601String(),
    'source': source.toJson(),
    'session': session.toJson(),
    'events': events.map((event) => event.toJson()).toList(growable: false),
    'sdkHealth': sdkHealth,
    'privacy': privacy.toJson(),
  });
}
