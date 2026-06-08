import '../model/event_envelope.dart';

enum EventSummaryKind {
  startup('startup'),
  page('page'),
  http('http'),
  interaction('interaction'),
  jank('jank'),
  error('error'),
  lifecycle('lifecycle'),
  sdk('sdk'),
  event('event');

  const EventSummaryKind(this.wireValue);

  final String wireValue;
}

class EventSummary {
  const EventSummary({
    required this.kind,
    required this.name,
    required this.eventId,
    this.status,
    this.phase,
    this.sessionId,
    this.traceId,
    this.spanId,
    this.route,
    this.durationMs,
    this.fields = const <String, Object?>{},
    required this.envelope,
  });

  final EventSummaryKind kind;
  final String name;
  final String eventId;
  final String? status;
  final String? phase;
  final String? sessionId;
  final String? traceId;
  final String? spanId;
  final String? route;
  final num? durationMs;
  final Map<String, Object?> fields;
  final EventEnvelope envelope;

  Map<String, Object?> toKeyValueMap() {
    return <String, Object?>{
      'kind': kind.wireValue,
      'name': name,
      if (status != null) 'status': status,
      if (phase != null) 'phase': phase,
      ...fields,
      if (sessionId != null) 'session': sessionId,
      if (traceId != null) 'trace': traceId,
      if (spanId != null) 'span': spanId,
      'event': eventId,
    };
  }
}
