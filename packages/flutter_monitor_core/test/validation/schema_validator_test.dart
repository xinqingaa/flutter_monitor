import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  final validator = SchemaValidator();

  EventEnvelope validSpan({String? spanId = 'span_001', num? durationMs = 12}) {
    return EventEnvelope(
      eventId: 'evt_001',
      timestamp: DateTime.parse('2026-05-24T12:00:00.000+08:00'),
      durationMs: durationMs,
      signalType: SignalType.span,
      name: 'http.client',
      sessionId: 'ses_001',
      traceId: 'trace_001',
      spanId: spanId,
      resource: const MonitorResource(
        sdk: SdkResource(name: 'flutter_monitor_sdk'),
      ),
      context: const MonitorContext(route: RouteContext(name: '/home')),
    );
  }

  test('accepts valid span events', () {
    final result = validator.validate(validSpan());

    expect(result.isValid, isTrue);
    expect(result.warnings, isEmpty);
  });

  test('accepts serialized envelope json', () {
    final json = validSpan().toJson();
    final result = validator.validateJson(json);

    expect(result.isValid, isTrue);
    expect(result.warnings, isEmpty);
  });

  test('rejects span events without spanId', () {
    final result = validator.validate(validSpan(spanId: ''));

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('span_id_required'),
    );
  });

  test('rejects negative duration', () {
    final result = validator.validate(validSpan(durationMs: -1));

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('duration_negative'),
    );
  });

  test('accepts registered event phase attributes', () {
    final result = validator.validate(
      validSpan().copyWith(
        endTime: DateTime.parse('2026-05-24T12:00:00.012+08:00'),
        attributes: const <String, Object?>{FieldPaths.eventPhase: 'end'},
      ),
    );

    expect(result.isValid, isTrue);
  });

  test('rejects invalid event phase values', () {
    final result = validator.validate(
      validSpan().copyWith(
        attributes: const <String, Object?>{FieldPaths.eventPhase: 'finished'},
      ),
    );

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('invalid_event_phase'),
    );
  });

  test('end phase trace and span events require completion fields', () {
    final result = validator.validate(
      validSpan(durationMs: null).copyWith(
        attributes: const <String, Object?>{FieldPaths.eventPhase: 'end'},
      ),
    );

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      containsAll(<String>['end_time_required', 'duration_required']),
    );
  });

  test('rejects deprecated duplicate attribute fields', () {
    final event = validSpan().copyWith(
      attributes: const {'page.route': '/home', 'device.tier': 'high'},
    );
    final result = validator.validate(event);

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      everyElement('deprecated_field'),
    );
  });

  test('rejects unknown attribute fields', () {
    final event = validSpan().copyWith(
      attributes: const {'custom.unregistered': 'value'},
    );
    final result = validator.validate(event);

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('unknown_attribute'),
    );
  });

  test('rejects forbidden attribute fields', () {
    final event = validSpan().copyWith(
      attributes: const {FieldPaths.authToken: 'secret'},
    );
    final result = validator.validate(event);

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('forbidden_field'),
    );
  });

  test('rejects invalid registered attribute types', () {
    final event = validSpan().copyWith(
      attributes: const {FieldPaths.httpStatusCode: '200'},
    );
    final result = validator.validate(event);

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('invalid_attribute_type'),
    );
  });

  test('rejects deprecated raw context fields', () {
    final result = validator.validateJson({
      'schemaVersion': '1.0',
      'eventId': 'evt_001',
      'timestamp': '2026-05-24T12:00:00.000+08:00',
      'signalType': 'sdk',
      'name': 'sdk.health',
      'resource': <String, Object?>{},
      'context': {
        'lifecycle': {'appLifecycleState': 'resumed'},
      },
    });

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.path),
      contains('context.lifecycle.appLifecycleState'),
    );
  });

  test('warns when business event has no sessionId', () {
    final event = validSpan().copyWith(sessionId: '');
    final result = validator.validate(event);

    expect(result.isValid, isTrue);
    expect(
      result.warnings.map((issue) => issue.code),
      contains('session_id_missing'),
    );
  });

  test('rejects invalid context missing reason', () {
    final event = validSpan().copyWith(
      context: const MonitorContext(
        missing: true,
        missingReason: 'free_text_reason',
      ),
    );
    final result = validator.validate(event);

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('invalid_missing_reason'),
    );
  });

  test('accepts registered context missing reason', () {
    final event = validSpan().copyWith(
      context: const MonitorContext(
        missing: true,
        missingReason: ContextMissingReasons.preSession,
      ),
    );
    final result = validator.validate(event);

    expect(result.isValid, isTrue);
  });

  test('validates raw json required object fields', () {
    final result = validator.validateJson({
      'schemaVersion': '1.0',
      'eventId': 'evt_001',
      'timestamp': '2026-05-24T12:00:00.000+08:00',
      'signalType': 'span',
      'name': 'http.client',
      'traceId': 'trace_001',
      'spanId': 'span_001',
    });

    expect(result.isValid, isFalse);
    expect(result.errors.map((issue) => issue.path), contains('resource'));
    expect(result.errors.map((issue) => issue.path), contains('context'));
  });

  test('validates raw json schema version format', () {
    final result = validator.validateJson({
      'schemaVersion': '1',
      'eventId': 'evt_001',
      'timestamp': '2026-05-24T12:00:00.000+08:00',
      'signalType': 'sdk',
      'name': 'sdk.health',
      'resource': <String, Object?>{},
      'context': <String, Object?>{},
    });

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.code),
      contains('invalid_schema_version'),
    );
  });

  test('rejects invalid raw enum values', () {
    final result = validator.validateJson({
      'schemaVersion': '1.0',
      'eventId': 'evt_001',
      'timestamp': '2026-05-24T12:00:00.000+08:00',
      'signalType': 'unknown_signal',
      'name': 'sdk.health',
      'priority': 'must_keep',
      'resource': <String, Object?>{},
      'context': <String, Object?>{},
    });

    expect(result.isValid, isFalse);
    expect(
      result.errors.map((issue) => issue.path),
      containsAll(['signalType', 'priority']),
    );
  });
}
