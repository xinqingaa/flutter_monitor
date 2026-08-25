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
      priority: EventPriority.high,
      sessionId: 'ses_001',
      traceId: 'trace_001',
      spanId: 'span_001',
      resource: const MonitorResource(
        sdk: SdkResource(name: 'flutter_monitor_sdk', coreVersion: '2.0.0'),
        app: AppResource(appKey: 'app_xxx', appVersion: '1.2.3'),
      ),
      context: const MonitorContext(
        route: RouteContext(
          name: '/product/detail',
          fullName: '/product/detail?id=42',
          stack: ['/home', '/product/detail?id=42'],
        ),
        module: ModuleContext(name: 'product', scene: 'detail'),
        release: ReleaseContext(
          releaseId: 'com.example.demo@1.2.3+100',
          featureFlags: ['new_product_detail'],
          experiments: {'product_detail_v2': 'variant_a'},
        ),
        lifecycle: LifecycleContext(
          state: 'resumed',
          previousState: 'paused',
          isForeground: true,
        ),
        native: NativeRuntimeContext(
          available: true,
          platform: 'android',
          processId: 12345,
          bridgeVersion: '2.0.0',
          signalSource: 'android',
        ),
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
    expect(json['priority'], 'high');
    expect(parsed.eventId, envelope.eventId);
    expect(parsed.signalType, SignalType.span);
    expect(parsed.priority, EventPriority.high);
    expect(parsed.resource.app?.appVersion, '1.2.3');
    expect(parsed.context.route?.fullName, '/product/detail?id=42');
    expect(parsed.context.route?.stack, ['/home', '/product/detail?id=42']);
    expect(parsed.context.release?.featureFlags, ['new_product_detail']);
    expect(
      parsed.context.release?.experiments?['product_detail_v2'],
      'variant_a',
    );
    expect(parsed.context.lifecycle?.state, 'resumed');
    expect(parsed.context.lifecycle?.previousState, 'paused');
    expect(parsed.context.native?.available, isTrue);
    expect(parsed.context.native?.processId, 12345);
    expect(parsed.attributes['http.status_code'], 200);
  });

  test('keeps empty required objects in json', () {
    final envelope = EventEnvelope(
      eventId: 'evt_empty',
      timestamp: DateTime.parse('2026-05-24T12:00:00.000+08:00'),
      signalType: SignalType.sdk,
      name: 'sdk.health',
    );

    final json = envelope.toJson();

    expect(json['resource'], <String, Object?>{});
    expect(json['context'], <String, Object?>{});
    expect(json['attributes'], <String, Object?>{});
    expect(json['payload'], <String, Object?>{});
    expect(SchemaValidator().validateJson(json).isValid, isTrue);
  });

  test('enum values use stable wire values', () {
    expect(SignalType.span.toJson(), 'span');
    expect(EventLevel.warning.toJson(), 'warning');
    expect(EventStatus.timeout.toJson(), 'timeout');
    expect(EventPriority.critical.toJson(), 'critical');
    expect(MonitorTrackResult.failed.toJson(), 'failed');
    expect(MonitorMeasureMode.stage.toJson(), 'stage');
    expect(MonitorMeasureResult.cancelled.toJson(), 'cancelled');
    expect(
      MonitorTrackResult.fromJson('cancelled'),
      MonitorTrackResult.cancelled,
    );
    expect(PrivacyLevel.forbidden.toJson(), 'forbidden');
  });
}
