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

  test('warns when business event has no sessionId', () {
    final event = validSpan().copyWith(sessionId: '');
    final result = validator.validate(event);

    expect(result.isValid, isTrue);
    expect(
      result.warnings.map((issue) => issue.code),
      contains('session_id_missing'),
    );
  });
}
