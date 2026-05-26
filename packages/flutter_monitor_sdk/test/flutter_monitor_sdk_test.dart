import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';

class RecordingOutput extends MonitorOutput {
  final List<Map<String, dynamic>> events = <Map<String, dynamic>>[];
  var initCount = 0;

  @override
  void init() {
    initCount++;
  }

  @override
  void add(Map<String, dynamic> event) {
    events.add(event);
  }

  @override
  Future<void> flush({bool isAppExiting = false}) async {}
}

void main() {
  test('legacy reporter events are emitted as unified envelopes', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(
          appKey: 'app_key',
          appVersion: '1.2.3',
          buildNumber: '100',
          packageName: 'com.example.demo',
          environment: 'test',
        ),
        outputs: <MonitorOutput>[output],
      ),
    );

    final result = reporter.addEvent('behavior', {
      'type': 'click',
      'identifier': 'login_button',
    });

    expect(result.accepted, isTrue);
    expect(output.initCount, 1);
    expect(output.events, hasLength(1));

    final event = output.events.single;
    expect(event['schemaVersion'], '1.0');
    expect(event['signalType'], 'breadcrumb');
    expect(event['name'], 'ui.click');
    expect(event['sessionId'], isNotEmpty);
    expect((event['resource'] as Map)['app'], containsPair('appKey', 'app_key'));
    expect((event['attributes'] as Map), containsPair('ui.action', 'click'));
    expect((event['attributes'] as Map), containsPair('ui.target', 'login_button'));
    expect(SchemaValidator().validateJson(event.cast<String, Object?>()).isValid, isTrue);
  });

  test('context is captured when the event is reported', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        userInfo: const UserInfo(
          userProperties: <String, Object?>{'plan': 'pro'},
        ),
        customData: const <String, Object?>{'buildFlavor': 'qa'},
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.setUserInfo(
      const UserInfo(
        userId: 'user_a',
        userProperties: <String, Object?>{'plan': 'pro'},
      ),
    );
    reporter.addEvent('behavior', {'type': 'pv'});
    reporter.setUserId('user_b');
    reporter.addEvent('behavior', {'type': 'pv'});

    final firstContext = output.events[0]['context'] as Map;
    final secondContext = output.events[1]['context'] as Map;

    expect((firstContext['user'] as Map)['userId'], 'user_a');
    expect((secondContext['user'] as Map)['userId'], 'user_b');
    expect(
      (output.events[0]['payload'] as Map)['legacy.customData'],
      containsPair('buildFlavor', 'qa'),
    );
    expect(
      (output.events[0]['payload'] as Map)['legacy.userProperties'],
      containsPair('plan', 'pro'),
    );
  });

  test('legacy performance api maps queryable fields and keeps details in payload', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addEvent('performance', {
      'type': 'api',
      'url': 'https://example.com/api/user?id=1',
      'method': 'GET',
      'status': 200,
      'duration_ms': 42,
      'success': true,
    });

    final event = output.events.single;
    final attributes = event['attributes'] as Map;
    final payload = event['payload'] as Map;

    expect(event['name'], 'http.client');
    expect(event['durationMs'], 42);
    expect(attributes['http.method'], 'GET');
    expect(attributes['http.url.normalized'], '/api/user');
    expect(attributes['http.status_code'], 200);
    expect(attributes['http.success'], isTrue);
    expect((payload['legacy.data'] as Map)['url'], 'https://example.com/api/user?id=1');
  });

  test('privacy filter removes forbidden fields before output', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addEvent('manual', {
      'type': 'custom',
      FieldPaths.authToken: 'secret',
      'nested': {FieldPaths.httpRequestHeadersCookie: 'a=b', 'keep': 'value'},
    });

    final payload = output.events.single['payload'] as Map;
    final legacyData = payload['legacy.data'] as Map;

    expect(legacyData.containsKey(FieldPaths.authToken), isFalse);
    expect((legacyData['nested'] as Map).containsKey(FieldPaths.httpRequestHeadersCookie), isFalse);
    expect((legacyData['nested'] as Map)['keep'], 'value');
  });

  test('envelope builder moves unregistered attributes into payload', () {
    final envelope = EnvelopeBuilder().build(
      signal: RawSignal(
        source: 'test',
        name: 'custom.event',
        signalType: SignalType.log,
        timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
        attributes: const <String, Object?>{
          FieldPaths.businessAction: 'checkout',
          'custom.detail': 'kept in payload',
        },
      ),
      contextSnapshot: const ContextSnapshot(
        resource: MonitorResource.empty(),
        context: MonitorContext.empty(),
      ),
      traceSnapshot: const TraceSnapshot(sessionId: 'ses_test'),
    );

    expect(envelope.attributes, containsPair(FieldPaths.businessAction, 'checkout'));
    expect(envelope.attributes.containsKey('custom.detail'), isFalse);
    expect(
      envelope.payload['unregistered.attributes'],
      containsPair('custom.detail', 'kept in payload'),
    );
    expect(SchemaValidator().validate(envelope).isValid, isTrue);
  });
}
