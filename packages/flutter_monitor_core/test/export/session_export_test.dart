import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('round-trips session export json', () {
    final exportedAt = DateTime.parse('2026-05-24T12:10:00.000+08:00');
    final event = EventEnvelope(
      eventId: 'evt_001',
      timestamp: exportedAt,
      signalType: SignalType.breadcrumb,
      name: 'route.enter',
      sessionId: 'ses_001',
      resource: const MonitorResource(
        sdk: SdkResource(name: 'flutter_monitor_sdk'),
      ),
      context: const MonitorContext(route: RouteContext(name: '/home')),
    );

    final export = SessionExport(
      exportedAt: exportedAt,
      source: const SessionExportSource(
        type: 'devtools',
        sdkVersion: '2.0.0',
        coreVersion: '2.0.0',
      ),
      session: SessionExportSession(
        sessionId: 'ses_001',
        startedAt: exportedAt.subtract(const Duration(minutes: 10)),
        endedAt: exportedAt,
      ),
      events: [event],
      sdkHealth: const {'dropped': 0},
      privacy: const SessionExportPrivacy(filtered: true, policyVersion: '1.0'),
    );

    final parsed = SessionExport.fromJson(export.toJson());

    expect(parsed.schemaVersion, SchemaVersion.current);
    expect(parsed.source.type, 'devtools');
    expect(parsed.session.sessionId, 'ses_001');
    expect(parsed.events.single.name, 'route.enter');
    expect(parsed.privacy.filtered, isTrue);
  });
}
