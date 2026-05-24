import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('round-trips event envelope json', () {
    final timestamp = DateTime.parse('2026-05-24T12:00:00.000+08:00');
    final envelope = EventEnvelope(
      eventId: 'evt_001',
      timestamp: timestamp,
      startTime: timestamp,
      endTime: timestamp.add(const Duration(milliseconds: 523)),
      durationMs: 523,
      signalType: SignalType.span,
      name: 'http.client',
      level: EventLevel.info,
      status: EventStatus.ok,
      sessionId: 'ses_001',
      traceId: 'trace_001',
      spanId: 'span_001',
      resource: const MonitorResource(
        sdk: SdkResource(name: 'flutter_monitor_sdk', coreVersion: '0.1.0'),
        app: AppResource(appKey: 'app_xxx', appVersion: '1.2.3'),
      ),
      context: const MonitorContext(
        route: RouteContext(
          name: '/product/detail',
          stack: ['/home', '/product/detail'],
        ),
        module: ModuleContext(name: 'product', scene: 'detail'),
      ),
      attributes: const {
        'http.method': 'GET',
        'http.url.normalized': '/api/product/{id}',
        'http.status_code': 200,
      },
      payload: const {'response.preview': 'ok'},
    );

    final json = envelope.toJson();
    final parsed = EventEnvelope.fromJson(json);

    expect(json['schemaVersion'], '1.0');
    expect(parsed.eventId, envelope.eventId);
    expect(parsed.signalType, SignalType.span);
    expect(parsed.resource.app?.appVersion, '1.2.3');
    expect(parsed.context.route?.stack, ['/home', '/product/detail']);
    expect(parsed.attributes['http.status_code'], 200);
  });

  test('enum values use stable wire values', () {
    expect(SignalType.span.toJson(), 'span');
    expect(EventLevel.warning.toJson(), 'warning');
    expect(EventStatus.timeout.toJson(), 'timeout');
    expect(EventPriority.critical.toJson(), 'critical');
    expect(PrivacyLevel.forbidden.toJson(), 'forbidden');
  });
}
