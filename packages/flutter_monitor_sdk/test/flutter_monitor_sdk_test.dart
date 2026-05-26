import 'package:flutter/material.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/monitored_http_client.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

class RecordingOutput extends MonitorOutput {
  final List<Map<String, dynamic>> events = <Map<String, dynamic>>[];
  var initCount = 0;
  var flushCount = 0;
  bool? lastFlushIsAppExiting;

  @override
  void init() {
    initCount++;
  }

  @override
  void add(Map<String, dynamic> event) {
    events.add(event);
  }

  @override
  Future<void> flush({bool isAppExiting = false}) async {
    flushCount++;
    lastFlushIsAppExiting = isAppExiting;
  }
}

class ThrowingDisposeOutput extends RecordingOutput {
  @override
  void dispose() {
    throw StateError('dispose failed');
  }
}

class _FakeHttpClient extends http.BaseClient {
  _FakeHttpClient(this.response);

  final http.StreamedResponse response;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return response;
  }
}

void main() {
  test('log output prints compact summaries for important events', () {
    final messages = <String>[];
    final previousDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      if (message != null) messages.add(message);
    };
    addTearDown(() {
      debugPrint = previousDebugPrint;
    });

    final output = LogMonitorOutput();
    output.add(
      EventEnvelope(
        eventId: 'evt_http',
        timestamp: DateTime.parse('2026-05-26T15:46:09.206020'),
        durationMs: 612,
        signalType: SignalType.span,
        name: 'http.client',
        level: EventLevel.info,
        status: EventStatus.error,
        sessionId: 'ses_1',
        traceId: 'trace_1',
        spanId: 'span_1',
        context: const MonitorContext(route: RouteContext(name: '/')),
        attributes: const <String, Object?>{
          FieldPaths.eventPhase: 'end',
          FieldPaths.httpMethod: 'GET',
          FieldPaths.httpUrlNormalized: '/users/flutter',
          FieldPaths.httpStatusCode: 403,
          FieldPaths.httpSuccess: false,
        },
      ).toJson().cast<String, dynamic>(),
    );

    expect(messages, hasLength(1));
    expect(messages.single, contains('[FM] kind=http name=http.client'));
    expect(messages.single, contains('code=403'));
    expect(messages.single, contains('duration_ms=612'));
    expect(messages.single, contains('event=evt_http'));
  });

  test('log output hides noisy successful events in compact mode', () {
    final messages = <String>[];
    final previousDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      if (message != null) messages.add(message);
    };
    addTearDown(() {
      debugPrint = previousDebugPrint;
    });

    final output = LogMonitorOutput();
    output.add(
      EventEnvelope(
        eventId: 'evt_route',
        timestamp: DateTime.parse('2026-05-26T15:46:00.522551'),
        signalType: SignalType.span,
        name: 'route.push',
        status: EventStatus.ok,
        attributes: const <String, Object?>{FieldPaths.eventPhase: 'end'},
      ).toJson().cast<String, dynamic>(),
    );
    output.add(
      EventEnvelope(
        eventId: 'evt_http_ok',
        timestamp: DateTime.parse('2026-05-26T15:46:00.522551'),
        durationMs: 120,
        signalType: SignalType.span,
        name: 'http.client',
        status: EventStatus.ok,
        attributes: const <String, Object?>{
          FieldPaths.eventPhase: 'end',
          FieldPaths.httpStatusCode: 200,
          FieldPaths.httpSuccess: true,
        },
      ).toJson().cast<String, dynamic>(),
    );

    expect(messages, isEmpty);
  });

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
    expect(
      (event['resource'] as Map)['app'],
      containsPair('appKey', 'app_key'),
    );
    expect((event['attributes'] as Map), containsPair('ui.action', 'click'));
    expect(
      (event['attributes'] as Map),
      containsPair('ui.target', 'login_button'),
    );
    expect(
      SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
      isTrue,
    );
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

  test(
    'legacy performance api maps queryable fields and keeps details in payload',
    () {
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
      expect(
        (payload['legacy.data'] as Map)['url'],
        'https://example.com/api/user?id=1',
      );
    },
  );

  test('legacy jank sequence uses documented event name and frame fields', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addEvent('performance', {
      'type': 'jank_sequence',
      'jank_count': 5,
      'max_duration_ms': 71.396,
      'average_duration_ms': 57.0778,
      'frame_budget_ms': 8.33,
      'device_performance': {
        'fps': 18.49,
        'stability': 0.0,
        'percentiles': {'p50': 4.5, 'p90': 58.3, 'p99': 1032.9},
      },
    });

    final event = output.events.single;
    final attributes = event['attributes'] as Map;

    expect(event['name'], 'ui.jank.sequence');
    expect(event['signalType'], 'metric');
    expect(attributes[FieldPaths.jankCount], 5);
    expect(attributes[FieldPaths.frameMaxMs], 71.396);
    expect(attributes[FieldPaths.frameAvgMs], 57.0778);
    expect(attributes[FieldPaths.frameBudgetMs], 8.33);
    expect(attributes[FieldPaths.frameFps], 18.49);
    expect(attributes[FieldPaths.frameP99Ms], 1032.9);
    expect(
      SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
      isTrue,
    );
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
    expect(
      (legacyData['nested'] as Map).containsKey(
        FieldPaths.httpRequestHeadersCookie,
      ),
      isFalse,
    );
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

    expect(
      envelope.attributes,
      containsPair(FieldPaths.businessAction, 'checkout'),
    );
    expect(envelope.attributes.containsKey('custom.detail'), isFalse);
    expect(
      envelope.payload['unregistered.attributes'],
      containsPair('custom.detail', 'kept in payload'),
    );
    expect(SchemaValidator().validate(envelope).isValid, isTrue);
  });

  test('trace and span runtime APIs emit first-class envelope events', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    final traceId = reporter.startTrace(
      'custom.checkout',
      attributes: const <String, Object?>{
        FieldPaths.businessAction: 'checkout',
      },
    );
    final parentSpanId = reporter.startSpan('custom.validate_cart');
    final childSpanId = reporter.startSpan('custom.pay');
    reporter.endSpan(childSpanId, status: EventStatus.ok);
    reporter.endSpan(parentSpanId, status: EventStatus.ok);
    reporter.endTrace(traceId, status: EventStatus.ok);

    final traceEvents = output.events
        .where((event) => event['signalType'] == 'trace')
        .toList(growable: false);
    final spanEvents = output.events
        .where((event) => event['signalType'] == 'span')
        .toList(growable: false);

    expect(traceEvents, hasLength(2));
    expect(spanEvents, hasLength(4));
    expect(traceEvents.first['traceId'], traceId);
    expect(traceEvents.last['durationMs'], isA<num>());
    expect(traceEvents.last['status'], 'ok');
    expect(spanEvents[1]['spanId'], childSpanId);
    expect(spanEvents[1]['parentSpanId'], parentSpanId);
    expect(spanEvents[2]['durationMs'], isA<num>());

    for (final event in output.events) {
      expect(
        SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
        isTrue,
      );
    }
  });

  test('manual breadcrumbs are attached to later error payload', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addBreadcrumb('ui.tap.checkout');
    reporter.addEvent('error', {
      'type': 'dart_error',
      'error': 'boom',
      'stack': 'trace',
    });

    final errorEvent = output.events.last;
    final payload = errorEvent['payload'] as Map;
    final breadcrumbs = payload[FieldPaths.payloadBreadcrumbs] as List;

    expect(errorEvent['signalType'], 'error');
    expect((breadcrumbs.single as Map)['name'], 'ui.tap.checkout');
  });

  test('breadcrumb payloads never carry nested breadcrumb snapshots', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addBreadcrumb(
      'ui.tap.home',
      payload: const <String, Object?>{'target': 'home'},
    );
    reporter.addEvent('error', {
      'type': 'dart_error',
      'error': 'first boom',
      'stack': 'trace',
    });
    reporter.addEvent('error', {
      'type': 'dart_error',
      'error': 'second boom',
      'stack': 'trace',
    });

    final secondError = output.events.last;
    final breadcrumbs =
        (secondError['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;

    expect(secondError['signalType'], 'error');
    expect(breadcrumbs.length, 2);
    for (final breadcrumb in breadcrumbs.cast<Map>()) {
      final payload =
          breadcrumb['payload'] as Map? ?? const <Object?, Object?>{};
      expect(payload.containsKey(FieldPaths.payloadBreadcrumbs), isFalse);
      expect(payload.containsKey(FieldPaths.payloadErrorStacktrace), isFalse);
      final legacyData = payload['legacy.data'];
      if (legacyData is Map) {
        expect(legacyData.containsKey('stack'), isFalse);
      }
    }
  });

  test('flush delegates to outputs', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    await reporter.flush(isAppExiting: true);

    expect(output.flushCount, 1);
    expect(output.lastFlushIsAppExiting, isTrue);
  });

  test('lifecycle updates context and flushes on background', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    await reporter.handleLifecycleState(
      'paused',
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );

    final lifecycleEvent = output.events.firstWhere(
      (event) => event['name'] == 'app.lifecycle',
    );
    final context = lifecycleEvent['context'] as Map;
    final lifecycle = context['lifecycle'] as Map;

    expect(lifecycle['state'], 'paused');
    expect(lifecycle['isForeground'], isFalse);
    expect(output.flushCount, 1);
    expect(output.lastFlushIsAppExiting, isFalse);
    expect(
      output.events.any((event) => event['name'] == 'sdk.lifecycle.flush'),
      isTrue,
    );
  });

  test('background lifecycle sequence flushes once until resumed', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    await reporter.handleLifecycleState(
      'inactive',
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );
    await reporter.handleLifecycleState(
      'hidden',
      timestamp: DateTime.parse('2026-05-25T12:00:01.000+08:00'),
    );
    await reporter.handleLifecycleState(
      'paused',
      timestamp: DateTime.parse('2026-05-25T12:00:02.000+08:00'),
    );

    expect(output.flushCount, 1);
    expect(
      output.events.where((event) => event['name'] == 'sdk.lifecycle.flush'),
      hasLength(1),
    );
    final flushEvent = output.events.singleWhere(
      (event) => event['name'] == 'sdk.lifecycle.flush',
    );
    expect((flushEvent['payload'] as Map)['lifecycle.trigger_state'], 'hidden');
    expect((flushEvent['payload'] as Map)['lifecycle.context_state'], 'hidden');
    expect(
      output.events
          .where((event) => event['name'] == 'app.lifecycle')
          .every(
            (event) => !(event['payload'] as Map).containsKey(
              FieldPaths.payloadBreadcrumbs,
            ),
          ),
      isTrue,
    );
  });

  testWidgets('route observer sets route context before reporting page view', (
    tester,
  ) async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final routeObserver = MonitorRouteObserver(reporter);

    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: <NavigatorObserver>[routeObserver],
        initialRoute: '/',
        routes: <String, WidgetBuilder>{'/': (_) => const SizedBox.shrink()},
      ),
    );

    final pageView = output.events.firstWhere(
      (event) => event['name'] == 'page.view',
    );
    final context = pageView['context'] as Map;
    final route = context['route'] as Map;

    expect(route['name'], '/');
    expect(context['missing'], isFalse);
  });

  testWidgets(
    'route observer emits page load trace and page first frame span',
    (tester) async {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );
      final routeObserver = MonitorRouteObserver(reporter);

      await tester.pumpWidget(
        MaterialApp(
          navigatorObservers: <NavigatorObserver>[routeObserver],
          initialRoute: '/',
          routes: <String, WidgetBuilder>{'/': (_) => const SizedBox.shrink()},
        ),
      );
      routeObserver.onPageRendered('/');

      final pageLoadEvents = output.events
          .where((event) => event['name'] == 'page.load')
          .toList(growable: false);
      final routePushEvents = output.events
          .where((event) => event['name'] == 'route.push')
          .toList(growable: false);
      final pageFirstFrameEvents = output.events
          .where((event) => event['name'] == 'page.first_frame')
          .toList(growable: false);
      final pageView = output.events.firstWhere(
        (event) => event['name'] == 'page.view',
      );

      expect(pageLoadEvents, hasLength(2));
      expect(routePushEvents, hasLength(1));
      expect(pageFirstFrameEvents, hasLength(2));

      final pageTraceId = pageLoadEvents.first['traceId'];
      expect(pageView['traceId'], pageTraceId);
      expect(pageLoadEvents.last['status'], 'ok');
      expect(pageLoadEvents.last['durationMs'], isA<num>());
      expect(routePushEvents.single['status'], 'ok');
      expect(
        routePushEvents.every((event) => event['traceId'] == pageTraceId),
        isTrue,
      );
      expect(
        pageFirstFrameEvents.every((event) => event['traceId'] == pageTraceId),
        isTrue,
      );
      expect(
        (pageFirstFrameEvents.last['attributes']
            as Map)[FieldPaths.pageFirstFrameMs],
        isA<num>(),
      );
      expect(
        (pageFirstFrameEvents.last['payload'] as Map).containsKey(
          FieldPaths.payloadBreadcrumbs,
        ),
        isFalse,
      );
    },
  );

  testWidgets('popping a page clears stale page trace before later events', (
    tester,
  ) async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final routeObserver = MonitorRouteObserver(reporter);

    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: <NavigatorObserver>[routeObserver],
        initialRoute: '/',
        routes: <String, WidgetBuilder>{
          '/': (_) => Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).pushNamed('/detail'),
              child: const Text('detail'),
            ),
          ),
          '/detail': (_) => const SizedBox(key: Key('detail-page')),
        },
      ),
    );
    routeObserver.onPageRendered('/');
    final homeTraceId = output.events.firstWhere(
      (event) => event['name'] == 'page.load',
    )['traceId'];

    await tester.tap(find.text('detail'));
    await tester.pumpAndSettle();
    routeObserver.onPageRendered('/detail');
    final detailTraceId = output.events
        .where((event) => event['name'] == 'page.load')
        .last['traceId'];

    Navigator.of(tester.element(find.byKey(const Key('detail-page')))).pop();
    await tester.pumpAndSettle();
    reporter.recordHttpClient(
      url: 'https://example.com/after-pop',
      method: 'GET',
      statusCode: 200,
      durationMs: 12,
      success: true,
    );

    final httpSpan = output.events.lastWhere(
      (event) => event['name'] == 'http.client',
    );
    final pageStay = output.events.lastWhere(
      (event) => event['name'] == 'page.stay',
    );
    final stayContext = pageStay['context'] as Map;
    final stayRoute = stayContext['route'] as Map;
    final httpContext = httpSpan['context'] as Map;
    final httpRoute = httpContext['route'] as Map;

    expect(homeTraceId, isNot(detailTraceId));
    expect(pageStay['traceId'], detailTraceId);
    expect(stayRoute['name'], '/detail');
    expect(httpSpan['traceId'], homeTraceId);
    expect(httpSpan['traceId'], isNot(detailTraceId));
    expect(httpRoute['name'], '/');
  });

  test('http client span is attached to the active page trace', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    reporter.startPageLoad('/home', startTime: startedAt);
    final pageTrace = output.events.firstWhere(
      (event) => event['name'] == 'page.load',
    );
    reporter.recordHttpClient(
      url: 'https://example.com/api/items?page=1',
      method: 'GET',
      statusCode: 200,
      durationMs: 32,
      success: true,
      startTime: startedAt.add(const Duration(milliseconds: 10)),
      endTime: startedAt.add(const Duration(milliseconds: 42)),
    );

    final httpSpan = output.events.singleWhere(
      (event) => event['name'] == 'http.client',
    );
    final attributes = httpSpan['attributes'] as Map;

    expect(httpSpan['signalType'], 'span');
    expect(httpSpan['traceId'], pageTrace['traceId']);
    expect(httpSpan['durationMs'], 32);
    expect(attributes[FieldPaths.httpMethod], 'GET');
    expect(attributes[FieldPaths.httpUrlNormalized], '/api/items');
    expect(attributes[FieldPaths.httpSuccess], isTrue);
    expect(
      (httpSpan['payload'] as Map).containsKey(FieldPaths.payloadBreadcrumbs),
      isFalse,
    );
  });

  test('failed http span includes breadcrumbs and error type', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addBreadcrumb('ui.tap.load');
    reporter.recordHttpClient(
      url: 'https://example.com/missing',
      method: 'GET',
      statusCode: 404,
      durationMs: 18,
      success: false,
      errorType: 'http_status',
    );

    final httpSpan = output.events.last;
    final attributes = httpSpan['attributes'] as Map;
    final payload = httpSpan['payload'] as Map;

    expect(httpSpan['status'], 'error');
    expect(attributes[FieldPaths.httpSuccess], isFalse);
    expect(attributes[FieldPaths.httpErrorType], 'http_status');
    expect(payload[FieldPaths.payloadBreadcrumbs], isA<List>());
  });

  test('monitored http client treats 4xx responses as failed spans', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final client = MonitoredHttpClient(
      reporter,
      _FakeHttpClient(
        http.StreamedResponse(
          const Stream<List<int>>.empty(),
          404,
          request: http.Request('GET', Uri.parse('https://example.com/404')),
        ),
      ),
    );

    await client.get(Uri.parse('https://example.com/404'));

    final httpSpan = output.events.singleWhere(
      (event) => event['name'] == 'http.client',
    );
    final attributes = httpSpan['attributes'] as Map;

    expect(httpSpan['status'], 'error');
    expect(attributes[FieldPaths.httpSuccess], isFalse);
    expect(attributes[FieldPaths.httpErrorType], 'http_status');
  });

  testWidgets('cold start trace starts before initial route page view', (
    tester,
  ) async {
    final output = RecordingOutput();
    final appStartTime = DateTime.now().subtract(
      const Duration(milliseconds: 8),
    );

    await FlutterMonitorSDK.init(
      config: MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(
          enableLifecycleTracking: false,
          flushOnBackground: false,
        ),
        enableErrorMonitor: false,
        enableBehaviorMonitor: false,
        enableJankMonitor: false,
        outputs: <MonitorOutput>[output],
      ),
      appStartTime: appStartTime,
    );

    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: <NavigatorObserver>[
          FlutterMonitorSDK.routeObserver,
        ],
        initialRoute: '/',
        routes: <String, WidgetBuilder>{'/': (_) => const SizedBox.shrink()},
      ),
    );
    await tester.pump();
    await FlutterMonitorSDK.dispose();

    final names = output.events
        .map((event) => event['name'] as String)
        .toList(growable: false);
    final coldStartEvents = output.events
        .where((event) => event['name'] == 'app.cold_start')
        .toList(growable: false);
    final firstFrameSpans = output.events
        .where((event) => event['name'] == 'app.first_frame')
        .toList(growable: false);

    expect(names.first, 'app.cold_start');
    expect(
      names.indexOf('app.cold_start'),
      lessThan(names.indexOf('page.view')),
    );
    expect(coldStartEvents, hasLength(2));
    expect(firstFrameSpans, hasLength(2));
    expect(coldStartEvents.first['signalType'], 'trace');
    expect(coldStartEvents.first['status'], 'unknown');
    expect(
      (coldStartEvents.first['attributes'] as Map)[FieldPaths.eventPhase],
      'start',
    );
    expect(coldStartEvents.last['status'], 'ok');
    expect(coldStartEvents.last['durationMs'], isA<num>());
    expect(
      (coldStartEvents.last['attributes'] as Map)[FieldPaths.eventPhase],
      'end',
    );
    expect(
      (coldStartEvents.last['attributes'] as Map)[FieldPaths.appStartType],
      'cold',
    );
    expect(
      (coldStartEvents.last['attributes'] as Map)[FieldPaths.appFirstFrameMs],
      isA<num>(),
    );
    expect(
      (firstFrameSpans.first['attributes'] as Map)[FieldPaths.eventPhase],
      'start',
    );
    expect(
      (firstFrameSpans.last['attributes'] as Map)[FieldPaths.eventPhase],
      'end',
    );
  });

  test('resume within timeout keeps session and emits hot start', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(
          backgroundSessionTimeout: Duration(minutes: 30),
          flushOnBackground: false,
        ),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addEvent('behavior', {'type': 'pv'});
    final originalSessionId = output.events.single['sessionId'];
    await reporter.handleLifecycleState(
      'paused',
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );
    await reporter.handleLifecycleState(
      'resumed',
      timestamp: DateTime.parse('2026-05-25T12:05:00.000+08:00'),
    );

    final hotStartEnd = output.events.lastWhere(
      (event) => event['name'] == 'app.hot_start' && event['status'] == 'ok',
    );

    expect(hotStartEnd['sessionId'], originalSessionId);
    expect(hotStartEnd['durationMs'], 300000);
    expect((hotStartEnd['attributes'] as Map)[FieldPaths.appStartType], 'hot');
    expect((hotStartEnd['payload'] as Map)['session.started_new'], isFalse);
  });

  test('resume after timeout starts a new session', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(
          backgroundSessionTimeout: Duration(minutes: 30),
          flushOnBackground: false,
        ),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addEvent('behavior', {'type': 'pv'});
    final originalSessionId = output.events.single['sessionId'];
    await reporter.handleLifecycleState(
      'hidden',
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );
    await reporter.handleLifecycleState(
      'resumed',
      timestamp: DateTime.parse('2026-05-25T12:45:00.000+08:00'),
    );

    final hotStartEnd = output.events.lastWhere(
      (event) => event['name'] == 'app.hot_start' && event['status'] == 'ok',
    );

    expect(hotStartEnd['sessionId'], isNot(originalSessionId));
    expect((hotStartEnd['payload'] as Map)['session.started_new'], isTrue);
  });

  test('unknown trace and span endings emit sdk self-monitoring events', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.endTrace('missing_trace');
    reporter.endSpan('missing_span');

    expect(
      output.events.map((event) => event['name']),
      containsAll(<String>['sdk.trace.end_unknown', 'sdk.span.end_unknown']),
    );
    expect(
      output.events.every((event) => event['signalType'] == 'sdk'),
      isTrue,
    );
  });

  test('dispose failures emit sdk self-monitoring events', () async {
    final output = ThrowingDisposeOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    await reporter.dispose();

    expect(
      output.events.any(
        (event) => event['name'] == 'sdk.output.dispose_failed',
      ),
      isTrue,
    );
  });
}
