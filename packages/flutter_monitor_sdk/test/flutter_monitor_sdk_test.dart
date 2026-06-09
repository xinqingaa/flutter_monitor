import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/native/native_bridge_controller.dart';
import 'package:flutter_monitor_sdk/src/modules/frame_window_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/performance_monitor.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';
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

class _RecordingHttpClient extends http.BaseClient {
  _RecordingHttpClient(this.handler);

  final Future<http.Response> Function(http.BaseRequest request) handler;
  final requests = <http.BaseRequest>[];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final response = await handler(request);
    return http.StreamedResponse(
      Stream<List<int>>.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      reasonPhrase: response.reasonPhrase,
      request: request,
    );
  }
}

class _FakeNativeBridge implements MonitorNativeBridge {
  _FakeNativeBridge({
    required NativeResourceSnapshot resource,
    NativeMemorySnapshot? memory,
  }) : _resource = resource,
       _memory = memory;

  final NativeResourceSnapshot _resource;
  final NativeMemorySnapshot? _memory;
  final _controller = StreamController<NativeSignal>();
  var disposed = false;

  @override
  Stream<NativeSignal> get signals => _controller.stream;

  @override
  Future<NativeResourceSnapshot> getResourceSnapshot() async => _resource;

  @override
  Future<NativeMemorySnapshot?> getMemorySnapshot() async => _memory;

  void emit(NativeSignal signal) {
    _controller.add(signal);
  }

  @override
  Future<void> dispose() async {
    disposed = true;
    await _controller.close();
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
          FieldPaths.eventPhase: EventPhases.instant,
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

  test('log output prints every event in compact mode', () {
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
          FieldPaths.eventPhase: EventPhases.instant,
          FieldPaths.httpStatusCode: 200,
          FieldPaths.httpSuccess: true,
        },
      ).toJson().cast<String, dynamic>(),
    );

    expect(messages, hasLength(2));
    expect(messages[0], contains('name=route.push'));
    expect(messages[1], contains('name=http.client'));
    expect(messages[1], contains('code=200'));
  });

  test('log output hides noisy successful events in quiet mode', () {
    final messages = <String>[];
    final previousDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      if (message != null) messages.add(message);
    };
    addTearDown(() {
      debugPrint = previousDebugPrint;
    });

    final output = LogMonitorOutput(mode: LogMonitorOutputMode.quiet);
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
          FieldPaths.eventPhase: EventPhases.instant,
          FieldPaths.httpStatusCode: 200,
          FieldPaths.httpSuccess: true,
        },
      ).toJson().cast<String, dynamic>(),
    );

    expect(messages, isEmpty);
  });

  test(
    'http output cools down after failures to avoid repeated flushes',
    () async {
      final messages = <String>[];
      final previousDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) messages.add(message);
      };
      addTearDown(() {
        debugPrint = previousDebugPrint;
      });

      final client = _RecordingHttpClient((request) async {
        return http.Response('down', 500);
      });
      final output = HttpOutput(
        serverUrl: 'http://localhost:3700/api/monitor/v1/events',
        client: client,
        batchReportSize: 1,
        failureCooldown: const Duration(minutes: 1),
      );

      output.add(<String, dynamic>{'eventId': 'evt_1'});
      await output.flush();
      output.add(<String, dynamic>{'eventId': 'evt_2'});
      await output.flush();

      expect(client.requests, hasLength(1));
      expect(
        messages.where((message) => message.startsWith('Failed to report')),
        hasLength(1),
      );
    },
  );

  test('http output allows one active flush at a time', () async {
    final completer = Completer<http.Response>();
    final client = _RecordingHttpClient((request) => completer.future);
    final output = HttpOutput(
      serverUrl: 'http://localhost:3700/api/monitor/v1/events',
      client: client,
      batchReportSize: 10,
    );

    output.add(<String, dynamic>{'eventId': 'evt_1'});
    final firstFlush = output.flush();
    final secondFlush = output.flush();

    expect(client.requests, hasLength(1));

    completer.complete(http.Response('ok', 202));
    await firstFlush;
    await secondFlush;

    expect(client.requests, hasLength(1));
  });

  testWidgets('http output does not listen to app lifecycle directly', (
    tester,
  ) async {
    final client = _RecordingHttpClient((request) async {
      return http.Response('ok', 202);
    });
    final output = HttpOutput(
      serverUrl: 'http://localhost:3700/api/monitor/v1/events',
      client: client,
      batchReportSize: 10,
    );

    output.init();
    addTearDown(output.dispose);

    output.add(<String, dynamic>{'eventId': 'evt_lifecycle'});
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();

    expect(client.requests, isEmpty);

    await output.flush(isAppExiting: true);
    expect(client.requests, hasLength(1));
  });

  test('context is captured when the event is reported', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.setContext(userId: 'user_a');
    reporter.track(action: 'profile.view', result: MonitorTrackResult.started);
    reporter.setContext(userId: 'user_b');
    reporter.track(
      action: 'profile.refresh',
      result: MonitorTrackResult.started,
    );

    final firstContext = output.events[0]['context'] as Map;
    final secondContext = output.events[1]['context'] as Map;

    expect((firstContext['user'] as Map)['userId'], 'user_a');
    expect((secondContext['user'] as Map)['userId'], 'user_b');

    reporter.setContext(userId: 'user_c');
    reporter.track(action: 'profile.save', result: MonitorTrackResult.success);

    final eventContext = output.events.last['context'] as Map;
    expect((eventContext['user'] as Map)['userId'], 'user_c');
  });

  test(
    'breadcrumb payload carries only action details and canonical context',
    () {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );

      reporter.setContext(userId: 'user_a');
      reporter.addBreadcrumb('ui.tap.profile');

      final event = output.events.single;
      final payload = event['payload'] as Map;
      final context = event['context'] as Map;
      final user = context['user'] as Map;

      expect(event['signalType'], 'breadcrumb');
      expect(event['name'], 'ui.tap.profile');
      expect(user['userId'], 'user_a');
      expect(payload, isEmpty);
    },
  );

  test(
    'setContext captures canonical user module release and network context',
    () {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );

      reporter.setContext(
        userId: 'user_001',
        userType: 'qa',
        userTags: const <String>['vip', 'beta'],
        cohort: 'internal',
        moduleName: 'checkout',
        moduleScene: 'submit',
        releaseId: '2026.06.06',
        featureFlags: const <String>['new_cart'],
        experiments: const <String, Object?>{'checkout_flow': 'b'},
        networkType: 'wifi',
        isWeakNetwork: false,
      );
      reporter.track(action: 'checkout.submit');

      final context = output.events.single['context'] as Map;
      final user = context['user'] as Map;
      final module = context['module'] as Map;
      final release = context['release'] as Map;
      final network = context['network'] as Map;

      expect(user['userId'], 'user_001');
      expect(user['userType'], 'qa');
      expect(user['userTags'], <String>['vip', 'beta']);
      expect(user['cohort'], 'internal');
      expect(module['name'], 'checkout');
      expect(module['scene'], 'submit');
      expect(release['releaseId'], '2026.06.06');
      expect(release['featureFlags'], <String>['new_cart']);
      expect((release['experiments'] as Map)['checkout_flow'], 'b');
      expect(network['type'], 'wifi');
      expect(network['isWeakNetwork'], isFalse);
      expect(context['missing'], isFalse);
    },
  );

  test('clearContext removes selected runtime context scopes', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.setContext(
      userId: 'runtime_user',
      moduleName: 'profile',
      moduleScene: 'edit',
      releaseId: 'release_a',
      networkType: 'cellular',
      isWeakNetwork: true,
    );
    reporter.clearContext(<MonitorContextScope>{
      MonitorContextScope.user,
      MonitorContextScope.network,
    });
    reporter.track(action: 'profile.save');

    final context = output.events.single['context'] as Map;
    expect(context['user'], isNull);
    expect(context['network'], isNull);
    expect(context['module'], isA<Map>());
    expect(context['release'], isA<Map>());
    expect((context['module'] as Map)['name'], 'profile');
    expect((context['release'] as Map)['releaseId'], 'release_a');
  });

  test(
    'manual error records standard error envelope with context and breadcrumbs',
    () {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );

      reporter.setContext(userId: 'user_001', moduleName: 'profile');
      reporter.track(
        action: 'profile.save',
        result: MonitorTrackResult.failed,
        target: 'save_button',
      );
      reporter.recordManualError(
        StateError('validation failed'),
        type: 'validation_failed',
        handled: true,
        properties: const <String, Object?>{'field': 'phone'},
      );

      final event = output.events.last;
      final attributes = event['attributes'] as Map;
      final payload = event['payload'] as Map;
      final context = event['context'] as Map;
      final breadcrumbs = payload[FieldPaths.payloadBreadcrumbs] as List;

      expect(event['name'], EventNames.errorManual);
      expect(event['signalType'], SignalType.error.toJson());
      expect(event['status'], EventStatus.error.toJson());
      expect(attributes[FieldPaths.errorType], 'validation_failed');
      expect(attributes[FieldPaths.errorMechanism], ErrorMechanisms.manual);
      expect(attributes[FieldPaths.errorHandled], isTrue);
      expect(
        payload[FieldPaths.payloadErrorMessage],
        contains('validation failed'),
      );
      expect((payload[FieldPaths.payloadProperties] as Map)['field'], 'phone');
      expect(((context['user'] as Map)['userId']), 'user_001');
      expect(((context['module'] as Map)['name']), 'profile');
      expect(
        breadcrumbs.any((breadcrumb) {
          final item = breadcrumb as Map;
          return item['name'] == 'profile.save';
        }),
        isTrue,
      );
    },
  );

  test('privacy filter removes forbidden fields before output', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.track(
      action: 'profile.save',
      properties: const <String, Object?>{
        FieldPaths.authToken: 'secret',
        'nested': {FieldPaths.httpRequestHeadersCookie: 'a=b', 'keep': 'value'},
      },
    );

    final payload = output.events.single['payload'] as Map;
    final properties = payload[FieldPaths.payloadProperties] as Map;

    expect(properties.containsKey(FieldPaths.authToken), isFalse);
    expect(
      (properties['nested'] as Map).containsKey(
        FieldPaths.httpRequestHeadersCookie,
      ),
      isFalse,
    );
    expect((properties['nested'] as Map)['keep'], 'value');
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

  test(
    'envelope builder keeps route name and full name aligned on override',
    () {
      final envelope = EnvelopeBuilder().build(
        signal: RawSignal(
          source: 'test',
          name: EventNames.memorySample,
          signalType: SignalType.metric,
          timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
          contextRouteName: '/home',
        ),
        contextSnapshot: const ContextSnapshot(
          resource: MonitorResource.empty(),
          context: MonitorContext(
            route: RouteContext(
              name: '/detail',
              fullName: '/detail?id=1',
              stack: ['/detail?id=1'],
            ),
          ),
        ),
        traceSnapshot: const TraceSnapshot(sessionId: 'ses_test'),
      );

      expect(envelope.context.route?.name, '/home');
      expect(envelope.context.route?.fullName, '/home');
      expect(envelope.context.route?.stack, ['/home']);
    },
  );

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

  test('track API maps simple business parameters to canonical envelope', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.startPageLoad('/profile');
    reporter.track(
      action: 'profile.save',
      result: MonitorTrackResult.failed,
      target: 'save_button',
      error: 'validation_failed',
      properties: const <String, Object?>{'field': 'phone'},
    );

    final event = output.events.last;
    final attributes = event['attributes'] as Map;
    final payload = event['payload'] as Map;

    expect(event['name'], 'profile.save');
    expect(event['signalType'], 'breadcrumb');
    expect(event['status'], 'error');
    expect(event['level'], 'warning');
    expect(attributes[FieldPaths.businessAction], 'profile.save');
    expect(attributes[FieldPaths.businessResult], 'failed');
    expect(attributes[FieldPaths.uiTarget], 'save_button');
    expect(payload[FieldPaths.payloadErrorMessage], 'validation_failed');
    expect(
      payload[FieldPaths.payloadProperties],
      containsPair('field', 'phone'),
    );
    expect(event['traceId'], isNotEmpty);
    expect(
      SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
      isTrue,
    );
  });

  test('measure snapshots map to interaction span on current page trace', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final t0 = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final pageInstanceId = reporter.startPageLoad('/chart', startTime: t0);

    reporter.recordInteractionMeasure(
      InteractionMeasureSnapshot(
        id: 'measure_1',
        action: 'chart.zoom',
        mode: MonitorMeasureMode.common,
        result: MonitorMeasureResult.success,
        endReason: InteractionEndReasons.autoWindow,
        startedAt: t0.add(const Duration(milliseconds: 10)),
        endedAt: t0.add(const Duration(milliseconds: 1210)),
        observedUntil: t0.add(const Duration(milliseconds: 1210)),
        observeFor: const Duration(milliseconds: 1200),
        timeout: const Duration(seconds: 5),
        target: 'revenue_chart',
        properties: const <String, Object?>{'chart.type': 'line'},
        finishProperties: const <String, Object?>{},
        sampleCount: 4,
        slowCount: 1,
        droppedCount: 2,
        refreshRate: 60,
        frameMaxMs: 42,
        frameAvgMs: 12,
        frameBudgetMs: 16.67,
        frameFps: 60,
        frameStability: 0.75,
        frameP50Ms: 8,
        frameP90Ms: 24,
        frameP99Ms: 42,
        sampleStatus: 'ok',
      ),
    );

    final event = output.events.last;
    final attributes = event['attributes'] as Map;
    final payload = event['payload'] as Map;
    final interaction = payload[PayloadKeys.interaction] as Map;

    expect(event['name'], EventNames.interactionMeasure);
    expect(event['signalType'], 'span');
    expect(event['status'], 'ok');
    expect(event['traceId'], output.events.first['traceId']);
    expect(attributes[FieldPaths.businessAction], 'chart.zoom');
    expect(attributes[FieldPaths.businessResult], 'success');
    expect(attributes[FieldPaths.interactionMode], 'common');
    expect(
      attributes[FieldPaths.interactionEndReason],
      InteractionEndReasons.autoWindow,
    );
    expect(attributes[FieldPaths.uiTarget], 'revenue_chart');
    expect(attributes[FieldPaths.pageInstanceId], pageInstanceId);
    expect(attributes[FieldPaths.frameSampleCount], 4);
    expect(
      payload[FieldPaths.payloadProperties],
      containsPair('chart.type', 'line'),
    );
    expect(interaction[PayloadKeys.identifier], 'measure_1');
    expect(
      (interaction[PayloadKeys.observedFrameSummary]
          as Map)[PayloadKeys.sampleStatus],
      'ok',
    );
    expect(
      SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
      isTrue,
    );
  });

  test('measure events become breadcrumbs for later errors', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final t0 = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    reporter.startPageLoad('/filters', startTime: t0);
    reporter.recordInteractionMeasure(
      InteractionMeasureSnapshot(
        id: 'measure_2',
        action: 'filter.apply',
        mode: MonitorMeasureMode.stage,
        result: MonitorMeasureResult.success,
        endReason: InteractionEndReasons.finish,
        startedAt: t0,
        endedAt: t0.add(const Duration(milliseconds: 300)),
        observedUntil: t0.add(const Duration(milliseconds: 550)),
        observeFor: const Duration(milliseconds: 250),
        timeout: const Duration(seconds: 5),
        target: null,
        properties: const <String, Object?>{},
        finishProperties: const <String, Object?>{},
        sampleCount: 0,
        slowCount: 0,
        droppedCount: 0,
        refreshRate: 60,
        frameMaxMs: 0,
        frameAvgMs: 0,
        frameBudgetMs: 16.67,
        frameFps: null,
        frameStability: null,
        frameP50Ms: null,
        frameP90Ms: null,
        frameP99Ms: null,
        sampleStatus: 'insufficient_samples',
      ),
    );
    reporter.recordManualError(StateError('boom'), type: 'filter_failed');

    final payload = output.events.last['payload'] as Map;
    final breadcrumbs = payload[FieldPaths.payloadBreadcrumbs] as List;
    final interactionBreadcrumb = breadcrumbs.cast<Map>().firstWhere(
      (breadcrumb) => breadcrumb['name'] == EventNames.interactionMeasure,
    );

    expect(
      (interactionBreadcrumb['attributes'] as Map)[FieldPaths.businessAction],
      'filter.apply',
    );
  });

  test(
    'interaction collector supports common auto window and stage finish',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final snapshots = <InteractionMeasureSnapshot>[];
      final collector = InteractionMeasureCollector(
        config: const MonitorInteractionConfig(
          commonObserveFor: Duration(milliseconds: 1),
          stageSettleWindow: Duration(milliseconds: 1),
          stageTimeout: Duration(seconds: 1),
        ),
        onFinished: snapshots.add,
      );

      collector.measure(action: 'tab.switch');
      await Future<void>.delayed(const Duration(milliseconds: 5));

      expect(snapshots, hasLength(1));
      expect(snapshots.single.action, 'tab.switch');
      expect(snapshots.single.mode, MonitorMeasureMode.common);
      expect(snapshots.single.endReason, InteractionEndReasons.autoWindow);

      final handle = collector.measure(
        action: 'sheet.open',
        mode: MonitorMeasureMode.stage,
      );
      handle.finish(properties: const <String, Object?>{'source': 'test'});
      await Future<void>.delayed(const Duration(milliseconds: 5));

      expect(snapshots, hasLength(2));
      expect(snapshots.last.action, 'sheet.open');
      expect(snapshots.last.mode, MonitorMeasureMode.stage);
      expect(snapshots.last.endReason, InteractionEndReasons.finish);
      expect(snapshots.last.finishProperties, containsPair('source', 'test'));
    },
  );

  test(
    'interaction collector treats non-positive concurrency as disabled',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final snapshots = <InteractionMeasureSnapshot>[];
      final collector = InteractionMeasureCollector(
        config: const MonitorInteractionConfig(
          commonObserveFor: Duration(milliseconds: 1),
          maxConcurrent: 0,
        ),
        onFinished: snapshots.add,
      );

      final handle = collector.measure(action: 'tab.switch');
      await Future<void>.delayed(const Duration(milliseconds: 5));

      expect(handle.id, isEmpty);
      expect(snapshots, isEmpty);
    },
  );

  test('manual breadcrumbs are attached to later error payload', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.addBreadcrumb('ui.tap.checkout');
    reporter.recordDartError(StateError('boom'), StackTrace.current);

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
    reporter.recordDartError(StateError('first boom'), StackTrace.current);
    reporter.recordDartError(StateError('second boom'), StackTrace.current);

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
    await tester.pump();

    final pageView = output.events.firstWhere(
      (event) => event['name'] == 'page.view',
    );
    final context = pageView['context'] as Map;
    final route = context['route'] as Map;

    expect(route['name'], '/');
    expect(context['missing'], isFalse);
  });

  testWidgets(
    'route observer emits page load trace with first frame evidence',
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
      await tester.pump();

      final pageVisitEvents = output.events
          .where((event) => event['name'] == 'page.visit')
          .toList(growable: false);
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

      expect(pageVisitEvents, hasLength(1));
      expect(pageLoadEvents, hasLength(2));
      expect(routePushEvents, hasLength(1));
      expect(pageFirstFrameEvents, isEmpty);

      final pageTraceId = pageVisitEvents.first['traceId'];
      final pageInstanceId =
          (pageVisitEvents.first['attributes']
              as Map)[FieldPaths.pageInstanceId];
      expect(pageView['traceId'], pageTraceId);
      expect(
        (pageView['attributes'] as Map)[FieldPaths.pageInstanceId],
        pageInstanceId,
      );
      expect(
        (pageView['attributes'] as Map)[FieldPaths.pageActivePhase],
        PageActivePhases.enter,
      );
      expect(
        (pageView['attributes'] as Map)[FieldPaths.pageActiveTrigger],
        PageActiveTriggers.routePush,
      );
      expect(pageLoadEvents.first['signalType'], 'span');
      expect(pageLoadEvents.last['status'], 'ok');
      expect(pageLoadEvents.last['durationMs'], isA<num>());
      expect(
        (pageLoadEvents.last['attributes'] as Map)[FieldPaths.pageLoadMs],
        isA<num>(),
      );
      expect(routePushEvents.single['status'], 'ok');
      expect(
        routePushEvents.every((event) => event['traceId'] == pageTraceId),
        isTrue,
      );
      expect(
        (pageLoadEvents.first['attributes'] as Map).containsKey(
          FieldPaths.pageFirstFrameMs,
        ),
        isFalse,
      );
      expect(
        (pageLoadEvents.last['attributes'] as Map)[FieldPaths.pageFirstFrameMs],
        isA<num>(),
      );
      expect(
        (pageLoadEvents.last['payload'] as Map).containsKey(
          FieldPaths.payloadBreadcrumbs,
        ),
        isFalse,
      );
    },
  );

  test('paused and hidden keep active page trace open', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(flushOnBackground: false),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    reporter.startPageLoad('/home', startTime: startedAt);
    reporter.finishPageFirstFrame(
      '/home',
      endTime: startedAt.add(const Duration(milliseconds: 32)),
    );
    await reporter.handleLifecycleState(
      LifecycleStates.hidden,
      timestamp: startedAt.add(const Duration(seconds: 10)),
    );
    await reporter.handleLifecycleState(
      LifecycleStates.paused,
      timestamp: startedAt.add(const Duration(seconds: 11)),
    );

    expect(
      output.events.where(
        (event) =>
            event['name'] == EventNames.pageVisit &&
            (event['attributes'] as Map)[FieldPaths.eventPhase] == 'end',
      ),
      isEmpty,
    );
    expect(
      output.events.where((event) => event['name'] == EventNames.pageStay),
      isEmpty,
    );
  });

  test('same route page instances do not overwrite each other', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final t0 = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final firstId = reporter.startPageLoad('/detail', startTime: t0);
    reporter.finishPageFirstFrame(
      '/detail',
      pageInstanceId: firstId,
      endTime: t0.add(const Duration(milliseconds: 16)),
    );
    final secondId = reporter.startPageLoad(
      '/detail',
      previousRouteName: '/detail',
      startTime: t0.add(const Duration(seconds: 1)),
    );
    reporter.finishPageFirstFrame(
      '/detail',
      pageInstanceId: secondId,
      endTime: t0.add(const Duration(seconds: 1, milliseconds: 16)),
    );

    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: secondId,
      nextRouteName: '/detail',
      endTime: t0.add(const Duration(seconds: 2)),
    );
    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: firstId,
      endTime: t0.add(const Duration(seconds: 3)),
    );

    final pageStayEvents = output.events
        .where((event) => event['name'] == EventNames.pageStay)
        .toList(growable: false);
    expect(pageStayEvents, hasLength(2));
    expect(
      pageStayEvents
          .map(
            (event) => (event['attributes'] as Map)[FieldPaths.pageInstanceId],
          )
          .toSet(),
      {firstId, secondId},
    );
    expect(pageStayEvents.first['durationMs'], 1000);
    expect(pageStayEvents.last['durationMs'], 3000);
    expect(
      (pageStayEvents.first['attributes'] as Map)[FieldPaths.pageTo],
      '/detail',
    );
  });

  test('page traces keep route name and full route name dimensions', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final t0 = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    final homeId = reporter.startPageLoad(
      '/',
      routeFullName: '/',
      startTime: t0,
    );
    reporter.finishPageFirstFrame(
      '/',
      pageInstanceId: homeId,
      endTime: t0.add(const Duration(milliseconds: 16)),
    );
    final detailId = reporter.startPageLoad(
      '/detail',
      routeFullName: '/detail?id=1',
      previousRouteName: '/',
      previousRouteFullName: '/',
      startTime: t0.add(const Duration(seconds: 1)),
    );
    reporter.finishPageFirstFrame(
      '/detail',
      pageInstanceId: detailId,
      endTime: t0.add(const Duration(seconds: 1, milliseconds: 32)),
    );
    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: detailId,
      nextRouteName: '/',
      nextRouteFullName: '/',
      endTime: t0.add(const Duration(seconds: 2)),
    );

    final detailLoadEnd = output.events.singleWhere(
      (event) =>
          event['name'] == EventNames.pageLoad &&
          (event['attributes'] as Map)[FieldPaths.eventPhase] ==
              EventPhases.end &&
          ((event['context'] as Map)['route'] as Map)['name'] == '/detail',
    );
    final detailVisitEnd = output.events.singleWhere(
      (event) =>
          event['name'] == EventNames.pageVisit &&
          (event['attributes'] as Map)[FieldPaths.eventPhase] ==
              EventPhases.end &&
          ((event['context'] as Map)['route'] as Map)['name'] == '/detail',
    );
    final loadAttributes = detailLoadEnd['attributes'] as Map;
    final visitAttributes = detailVisitEnd['attributes'] as Map;
    final route = (detailVisitEnd['context'] as Map)['route'] as Map;

    expect(route['name'], '/detail');
    expect(route['fullName'], '/detail?id=1');
    expect(loadAttributes[FieldPaths.pageFrom], '/');
    expect(loadAttributes[FieldPaths.pageFromFullName], '/');
    expect(visitAttributes[FieldPaths.pageTo], '/');
    expect(visitAttributes[FieldPaths.pageToFullName], '/');
    expect(visitAttributes[FieldPaths.pageInstanceId], detailId);
  });

  testWidgets('route observer builds full route names from arguments', (
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
              onPressed: () => Navigator.of(context).pushNamed(
                '/detail',
                arguments: const <String, Object?>{'tab': 'info', 'id': 1},
              ),
              child: const Text('detail'),
            ),
          ),
          '/detail': (_) => const SizedBox(key: Key('detail-page')),
        },
      ),
    );
    await tester.pump();

    await tester.tap(find.text('detail'));
    await tester.pumpAndSettle();

    final detailVisitStart = output.events.singleWhere(
      (event) =>
          event['name'] == EventNames.pageVisit &&
          (event['attributes'] as Map)[FieldPaths.eventPhase] ==
              EventPhases.start &&
          ((event['context'] as Map)['route'] as Map)['name'] == '/detail',
    );
    final route = (detailVisitStart['context'] as Map)['route'] as Map;
    final attributes = detailVisitStart['attributes'] as Map;

    expect(route['name'], '/detail');
    expect(route['fullName'], '/detail?id=1&tab=info');
    expect(attributes[FieldPaths.pageFrom], '/');
    expect(attributes[FieldPaths.pageFromFullName], '/');
  });

  test(
    'detached lifecycle closes active page trace before exit flush',
    () async {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );
      final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');
      final detachedAt = startedAt.add(const Duration(seconds: 5));

      reporter.startPageLoad('/home', startTime: startedAt);
      reporter.finishPageFirstFrame(
        '/home',
        endTime: startedAt.add(const Duration(milliseconds: 32)),
      );
      await reporter.handleLifecycleState(
        LifecycleStates.detached,
        timestamp: detachedAt,
      );

      final pageVisitEnd = output.events.firstWhere(
        (event) =>
            event['name'] == EventNames.pageVisit &&
            (event['attributes'] as Map)[FieldPaths.eventPhase] == 'end',
      );
      final pageStay = output.events.singleWhere(
        (event) => event['name'] == EventNames.pageStay,
      );
      final flushEvent = output.events.singleWhere(
        (event) => event['name'] == EventNames.sdkLifecycleFlush,
      );
      final pageVisitIndex = output.events.indexOf(pageVisitEnd);
      final flushIndex = output.events.indexOf(flushEvent);

      expect(pageVisitEnd['durationMs'], 5000);
      expect(
        (pageVisitEnd['payload'] as Map)[PayloadKeys.pageEndReason],
        PageEndReasons.lifecycleDetached,
      );
      expect(
        (pageStay['payload'] as Map)[PayloadKeys.pageEndReason],
        PageEndReasons.lifecycleDetached,
      );
      expect(
        (pageVisitEnd['attributes'] as Map).containsKey(FieldPaths.pageTo),
        isFalse,
      );
      expect(pageStay['durationMs'], 5000);
      expect(
        (flushEvent['payload'] as Map)[PayloadKeys.lifecycleTriggerState],
        LifecycleStates.detached,
      );
      expect(output.lastFlushIsAppExiting, isTrue);
      expect(pageVisitIndex, lessThan(flushIndex));
    },
  );

  testWidgets('route observer closes page load on first rendered frame', (
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
              onPressed: () => Navigator.of(context).pushNamed('/complex_list'),
              child: const Text('complex'),
            ),
          ),
          '/complex_list': (_) => const SizedBox(key: Key('complex-page')),
        },
      ),
    );
    await tester.pump();

    await tester.tap(find.text('complex'));
    await tester.pumpAndSettle();

    final complexLoadEvents = output.events
        .where(
          (event) =>
              event['name'] == 'page.load' &&
              ((event['context'] as Map)['route'] as Map)['name'] ==
                  '/complex_list',
        )
        .toList(growable: false);
    final complexFirstFrameEvents = output.events
        .where(
          (event) =>
              event['name'] == 'page.first_frame' &&
              ((event['context'] as Map)['route'] as Map)['name'] ==
                  '/complex_list',
        )
        .toList(growable: false);

    expect(complexLoadEvents, hasLength(2));
    expect(complexFirstFrameEvents, isEmpty);
    expect(complexLoadEvents.last['status'], 'ok');
    expect(
      (complexLoadEvents.last['attributes'] as Map)[FieldPaths.pageLoadMs],
      isA<num>(),
    );

    Navigator.of(tester.element(find.byKey(const Key('complex-page')))).pop();
    await tester.pumpAndSettle();

    final laterComplexLoadEnds = output.events
        .where(
          (event) =>
              event['name'] == 'page.load' &&
              (event['attributes'] as Map)[FieldPaths.eventPhase] == 'end' &&
              ((event['context'] as Map)['route'] as Map)['name'] ==
                  '/complex_list',
        )
        .toList(growable: false);
    expect(laterComplexLoadEnds, hasLength(1));
  });

  testWidgets('route pop emits pop span and resumed page view boundary', (
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
          '/detail': (_) => Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).pushNamed('/complex_list'),
              child: const Text('complex'),
            ),
          ),
          '/complex_list': (_) => const SizedBox(key: Key('complex-page')),
        },
      ),
    );
    await tester.pump();

    await tester.tap(find.text('detail'));
    await tester.pumpAndSettle();
    final detailVisit = output.events
        .where(
          (event) =>
              event['name'] == EventNames.pageVisit &&
              (event['attributes'] as Map)[FieldPaths.eventPhase] ==
                  EventPhases.start &&
              ((event['context'] as Map)['route'] as Map)['name'] == '/detail',
        )
        .single;
    final detailTraceId = detailVisit['traceId'];
    final detailPageInstanceId =
        (detailVisit['attributes'] as Map)[FieldPaths.pageInstanceId];

    await tester.tap(find.text('complex'));
    await tester.pumpAndSettle();
    final complexVisit = output.events
        .where(
          (event) =>
              event['name'] == EventNames.pageVisit &&
              (event['attributes'] as Map)[FieldPaths.eventPhase] ==
                  EventPhases.start &&
              ((event['context'] as Map)['route'] as Map)['name'] ==
                  '/complex_list',
        )
        .single;
    final complexTraceId = complexVisit['traceId'];
    final complexPageInstanceId =
        (complexVisit['attributes'] as Map)[FieldPaths.pageInstanceId];

    Navigator.of(tester.element(find.byKey(const Key('complex-page')))).pop();
    await tester.pumpAndSettle();

    final routePop = output.events.singleWhere(
      (event) => event['name'] == EventNames.routePop,
    );
    final routePopAttributes = routePop['attributes'] as Map;
    expect(routePop['traceId'], complexTraceId);
    expect(
      routePopAttributes[FieldPaths.pageInstanceId],
      complexPageInstanceId,
    );
    expect(routePopAttributes[FieldPaths.pageTo], '/detail');

    final resumedPageView = output.events.lastWhere(
      (event) =>
          event['name'] == EventNames.pageView &&
          (event['attributes'] as Map)[FieldPaths.pageActivePhase] ==
              PageActivePhases.resume,
    );
    final resumedAttributes = resumedPageView['attributes'] as Map;
    final resumedRoute = (resumedPageView['context'] as Map)['route'] as Map;
    expect(resumedPageView['traceId'], detailTraceId);
    expect(resumedAttributes[FieldPaths.pageInstanceId], detailPageInstanceId);
    expect(
      resumedAttributes[FieldPaths.pageActiveTrigger],
      PageActiveTriggers.routePop,
    );
    expect(resumedRoute['name'], '/detail');
  });

  test('lifecycle resumed page view uses lifecycle trigger', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(flushOnBackground: false),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final resumedAt = startedAt.add(const Duration(seconds: 8));

    final pageInstanceId = reporter.startPageLoad(
      '/home',
      startTime: startedAt,
    );
    reporter.recordPageView(
      '/home',
      pageInstanceId: pageInstanceId,
      activePhase: PageActivePhases.enter,
      activeTrigger: PageActiveTriggers.routePush,
      timestamp: startedAt,
    );
    await reporter.handleLifecycleState(
      LifecycleStates.paused,
      timestamp: startedAt.add(const Duration(seconds: 3)),
    );
    await reporter.handleLifecycleState(
      LifecycleStates.resumed,
      timestamp: resumedAt,
    );

    final resumedPageView = output.events.lastWhere(
      (event) =>
          event['name'] == EventNames.pageView &&
          (event['attributes'] as Map)[FieldPaths.pageActivePhase] ==
              PageActivePhases.resume,
    );
    final attributes = resumedPageView['attributes'] as Map;
    expect(attributes[FieldPaths.pageInstanceId], pageInstanceId);
    expect(
      attributes[FieldPaths.pageActiveTrigger],
      PageActiveTriggers.lifecycleResumed,
    );
    expect(
      ((resumedPageView['context'] as Map)['route'] as Map)['name'],
      '/home',
    );
  });

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
    await tester.pump();
    final homeTraceId = output.events.firstWhere(
      (event) => event['name'] == 'page.visit',
    )['traceId'];

    await tester.tap(find.text('detail'));
    await tester.pumpAndSettle();
    final detailTraceId = output.events
        .where((event) => event['name'] == 'page.visit')
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
      (event) => event['name'] == 'page.visit',
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
    expect(httpSpan['startTime'], isNotNull);
    expect(httpSpan['endTime'], isNotNull);
    expect(attributes[FieldPaths.eventPhase], EventPhases.instant);
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
    reporter.addBreadcrumb('ui.filter.status');
    reporter.addBreadcrumb('ui.filter.owner');
    reporter.addBreadcrumb('ui.filter.sort');
    reporter.recordHttpClient(
      url: 'https://example.com/missing',
      method: 'GET',
      statusCode: 404,
      durationMs: 18,
      success: false,
      errorType: HttpErrorTypes.httpStatus,
      error: 'very long dio error text',
      responseSizeBytes: 128,
    );

    final httpSpan = output.events.last;
    final attributes = httpSpan['attributes'] as Map;
    final payload = httpSpan['payload'] as Map;

    expect(httpSpan['status'], 'error');
    expect(attributes[FieldPaths.eventPhase], EventPhases.instant);
    expect(attributes[FieldPaths.httpSuccess], isFalse);
    expect(attributes[FieldPaths.httpErrorType], HttpErrorTypes.httpStatus);
    expect(attributes[FieldPaths.responseSizeBytes], 128);
    expect(payload[FieldPaths.payloadBreadcrumbs], isA<List>());
    expect(payload[FieldPaths.payloadBreadcrumbs], hasLength(3));
  });

  test('failed http raw payload normalizes error type and error summary', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final longError = List<String>.filled(
      40,
      'The request connection took longer than expected and timed out.',
    ).join(' ');

    reporter.recordHttpClient(
      url: 'https://example.com/timeout',
      method: 'GET',
      durationMs: 2000,
      success: false,
      errorType: 'connectionTimeout',
      error: longError,
    );
    reporter.recordHttpClient(
      url: 'https://10.255.255.1/flutter-monitor-timeout',
      method: 'GET',
      durationMs: 37,
      success: false,
      errorType: HttpErrorTypes.networkError,
      error:
          'ClientException with SocketException: Connection refused '
          '(OS Error: Connection refused, errno = 111), '
          'address = 10.255.255.1, port = 60176, '
          'uri=https://10.255.255.1/flutter-monitor-timeout',
    );

    final timeoutSpan = output.events.firstWhere(
      (event) =>
          event['name'] == EventNames.httpClient &&
          ((event['payload'] as Map)[PayloadKeys.error] as String) == 'timeout',
    );
    final timeoutAttributes = timeoutSpan['attributes'] as Map;
    final timeoutPayload = timeoutSpan['payload'] as Map;

    expect(timeoutAttributes[FieldPaths.httpErrorType], HttpErrorTypes.timeout);
    expect(timeoutPayload[PayloadKeys.error], 'timeout');
    expect(timeoutPayload[PayloadKeys.errorTruncated], isTrue);
    expect(timeoutPayload[PayloadKeys.errorOriginalLength], longError.length);

    final refusedSpan = output.events.lastWhere(
      (event) => event['name'] == EventNames.httpClient,
    );
    final refusedAttributes = refusedSpan['attributes'] as Map;
    final refusedPayload = refusedSpan['payload'] as Map;

    expect(
      refusedAttributes[FieldPaths.httpErrorType],
      HttpErrorTypes.connectionError,
    );
    expect(refusedPayload[PayloadKeys.error], 'connection_refused');
    expect(
      (refusedPayload[PayloadKeys.error] as String).contains('60176'),
      isFalse,
    );
    expect(refusedPayload.containsKey(PayloadKeys.errorTruncated), isFalse);
  });

  test('critical event breadcrumbs are relevant, limited and compact', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    reporter.startPageLoad('/old', startTime: startedAt);
    reporter.recordPageView('/old');
    reporter.finishPageFirstFrame(
      '/old',
      endTime: startedAt.add(const Duration(milliseconds: 16)),
    );
    reporter.finishPageLoad(
      '/old',
      endTime: startedAt.add(const Duration(seconds: 1)),
    );
    reporter.startPageLoad(
      '/home',
      startTime: startedAt.add(const Duration(seconds: 2)),
    );
    reporter.recordPageView('/home');
    reporter.finishPageFirstFrame(
      '/home',
      endTime: startedAt.add(const Duration(seconds: 2, milliseconds: 32)),
    );

    for (var index = 0; index < 6; index++) {
      reporter.addBreadcrumb(
        'ui.tap.$index',
        payload: <String, Object?>{'index': index},
      );
    }
    reporter.recordJankSequence(
      frameCount: 5,
      frameMaxMs: 72,
      frameAvgMs: 55,
      frameBudgetMs: 16.67,
    );

    final jankEvent = output.events.last;
    final jankBreadcrumbs =
        (jankEvent['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;

    expect(jankEvent['name'], 'ui.jank.sequence');
    expect(jankBreadcrumbs, hasLength(5));
    expect((jankBreadcrumbs.first as Map)['route'], '/home');
    expect(
      jankBreadcrumbs.map((item) => (item as Map)['route']).toSet(),
      contains('/home'),
    );

    reporter.recordDartError(StateError('boom'), StackTrace.current);

    final errorEvent = output.events.last;
    final errorBreadcrumbs =
        (errorEvent['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;
    expect(errorBreadcrumbs.length, lessThanOrEqualTo(8));
    expect(
      errorBreadcrumbs.map((item) => (item as Map)['name']),
      contains('ui.jank.sequence'),
    );
    for (final breadcrumb in errorBreadcrumbs.cast<Map>()) {
      final payload =
          breadcrumb['payload'] as Map? ?? const <Object?, Object?>{};
      expect(payload.containsKey(FieldPaths.payloadBreadcrumbs), isFalse);
      expect(payload.containsKey(FieldPaths.payloadErrorStacktrace), isFalse);
      if (breadcrumb['name'] == 'http.client') {
        expect(payload.containsKey('error'), isFalse);
      }
    }
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
          contentLength: 256,
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
    expect(attributes[FieldPaths.eventPhase], EventPhases.instant);
    expect(attributes[FieldPaths.httpSuccess], isFalse);
    expect(attributes[FieldPaths.httpErrorType], HttpErrorTypes.httpStatus);
    expect(attributes[FieldPaths.responseSizeBytes], 256);
  });

  test('startup memory evidence is merged into cold start trace', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final appStartTime = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final startup = StartupTraceController(
      reporter: reporter,
      appStartTime: appStartTime,
    );

    startup.startSdkInit();
    startup.finishFirstFrame(
      endTime: appStartTime.add(const Duration(milliseconds: 88)),
    );

    final coldStartEnd = output.events.lastWhere(
      (event) => event['name'] == EventNames.appColdStart,
    );
    final attributes = coldStartEnd['attributes'] as Map;

    expect(coldStartEnd['signalType'], SignalType.trace.toJson());
    expect(coldStartEnd['status'], EventStatus.ok.toJson());
    expect(attributes[FieldPaths.appStartType], StartTypes.cold);
    expect(attributes[FieldPaths.appFirstFrameMs], 88);
    expect(attributes.containsKey(FieldPaths.frameSampleCount), isFalse);
    expect(attributes.containsKey(FieldPaths.frameFps), isFalse);
    expect(attributes.containsKey(FieldPaths.frameStability), isFalse);
    expect(attributes[FieldPaths.memoryStartRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryEndRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryDeltaRssMb], isA<num>());
    expect(
      output.events.where((event) => event['name'] == 'ui.frame.window'),
      isEmpty,
    );
    expect(
      output.events.where((event) => event['name'] == EventNames.memorySample),
      isEmpty,
    );
    expect(
      SchemaValidator()
          .validateJson(coldStartEnd.cast<String, Object?>())
          .isValid,
      isTrue,
    );
  });

  test('startup memory evidence is merged into hot start trace', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(flushOnBackground: false),
        outputs: <MonitorOutput>[output],
      ),
    );
    final pausedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final resumedAt = DateTime.parse('2026-05-25T12:05:00.000+08:00');

    await reporter.handleLifecycleState('paused', timestamp: pausedAt);
    await reporter.handleLifecycleState('resumed', timestamp: resumedAt);
    reporter.beginStartupPerformance(startTime: resumedAt);
    reporter.finishHotStartTrace(
      endTime: resumedAt.add(const Duration(milliseconds: 96)),
    );

    final hotStartEnd = output.events.lastWhere(
      (event) =>
          event['name'] == EventNames.appHotStart &&
          event['status'] == EventStatus.ok.toJson(),
    );
    final attributes = hotStartEnd['attributes'] as Map;

    expect(hotStartEnd['durationMs'], 96);
    expect(attributes[FieldPaths.appStartType], StartTypes.hot);
    expect(
      attributes[FieldPaths.appStartEndReason],
      StartupEndReasons.firstFrame,
    );
    expect(attributes[FieldPaths.appFirstFrameMs], 96);
    expect(attributes.containsKey(FieldPaths.frameSampleCount), isFalse);
    expect(attributes.containsKey(FieldPaths.frameFps), isFalse);
    expect(attributes.containsKey(FieldPaths.frameStability), isFalse);
    expect(attributes[FieldPaths.memoryStartRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryEndRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryDeltaRssMb], isA<num>());
    expect(
      output.events.where((event) => event['name'] == 'ui.frame.window'),
      isEmpty,
    );
  });

  test('page performance evidence is merged into page visit trace', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    final pageInstanceId = reporter.startPageLoad(
      '/detail',
      previousRouteName: '/home',
      startTime: startedAt,
    )!;
    reporter.finishPageFirstFrame(
      '/detail',
      pageInstanceId: pageInstanceId,
      endTime: startedAt.add(const Duration(milliseconds: 32)),
    );
    reporter.addPageFrameStats(
      FrameStatsSnapshot(
        windowType: pageFrameWindowType,
        windowPhase: PageActivePhases.exit,
        sampleCount: 5,
        slowCount: 2,
        droppedCount: 3,
        refreshRate: 60,
        frameMaxMs: 50,
        frameAvgMs: 22,
        frameBudgetMs: 16.67,
        frameFps: 45.45,
        frameStability: 0.6,
        frameP50Ms: 18,
        frameP90Ms: 50,
        frameP99Ms: 50,
        routeName: '/detail',
        pageInstanceId: pageInstanceId,
        startTime: startedAt,
        endTime: startedAt.add(const Duration(seconds: 1)),
      ),
    );
    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: pageInstanceId,
      nextRouteName: '/home',
      endTime: startedAt.add(const Duration(seconds: 1)),
    );

    final pageVisitEnd = output.events.lastWhere(
      (event) =>
          event['name'] == EventNames.pageVisit &&
          (event['attributes'] as Map)[FieldPaths.eventPhase] ==
              EventPhases.end,
    );
    final attributes = pageVisitEnd['attributes'] as Map;

    expect(pageVisitEnd['signalType'], SignalType.trace.toJson());
    expect(attributes[FieldPaths.pageInstanceId], pageInstanceId);
    expect(attributes[FieldPaths.pageFrom], '/home');
    expect(attributes[FieldPaths.pageTo], '/home');
    expect(attributes[FieldPaths.frameSampleCount], 5);
    expect(attributes[FieldPaths.frameSlowCount], 2);
    expect(attributes[FieldPaths.frameDroppedCount], 3);
    expect(attributes[FieldPaths.frameMaxMs], 50);
    expect(attributes[FieldPaths.frameAvgMs], 22);
    expect(attributes[FieldPaths.frameP90Ms], 50);
    expect(attributes[FieldPaths.memoryEnterRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryExitRssMb], isA<num>());
    expect(attributes[FieldPaths.memoryDeltaRssMb], isA<num>());
    expect(
      output.events.where((event) => event['name'] == 'ui.frame.window'),
      isEmpty,
    );
    expect(
      output.events.where((event) => event['name'] == EventNames.memorySample),
      isEmpty,
    );
    expect(
      SchemaValidator()
          .validateJson(pageVisitEnd.cast<String, Object?>())
          .isValid,
      isTrue,
    );
  });

  test('same route page instances keep separate performance evidence', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    final firstPageId = reporter.startPageLoad(
      '/detail',
      startTime: startedAt,
    )!;
    final secondPageId = reporter.startPageLoad(
      '/detail',
      previousRouteName: '/detail',
      startTime: startedAt.add(const Duration(milliseconds: 1)),
    )!;
    reporter.addPageFrameStats(
      FrameStatsSnapshot(
        windowType: pageFrameWindowType,
        windowPhase: PageActivePhases.covered,
        sampleCount: 2,
        slowCount: 0,
        droppedCount: 0,
        refreshRate: 60,
        frameMaxMs: 12,
        frameAvgMs: 10,
        frameBudgetMs: 16.67,
        pageInstanceId: firstPageId,
      ),
    );
    reporter.addPageFrameStats(
      FrameStatsSnapshot(
        windowType: pageFrameWindowType,
        windowPhase: PageActivePhases.exit,
        sampleCount: 7,
        slowCount: 3,
        droppedCount: 4,
        refreshRate: 60,
        frameMaxMs: 60,
        frameAvgMs: 30,
        frameBudgetMs: 16.67,
        pageInstanceId: secondPageId,
      ),
    );
    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: secondPageId,
      endTime: startedAt.add(const Duration(seconds: 1)),
      resumePrevious: false,
    );
    reporter.finishPageLoad(
      '/detail',
      pageInstanceId: firstPageId,
      endTime: startedAt.add(const Duration(seconds: 2)),
      resumePrevious: false,
    );

    final pageVisitEnds = output.events
        .where(
          (event) =>
              event['name'] == EventNames.pageVisit &&
              (event['attributes'] as Map)[FieldPaths.eventPhase] ==
                  EventPhases.end,
        )
        .toList(growable: false);
    final firstEnd = pageVisitEnds.singleWhere(
      (event) =>
          (event['attributes'] as Map)[FieldPaths.pageInstanceId] ==
          firstPageId,
    );
    final secondEnd = pageVisitEnds.singleWhere(
      (event) =>
          (event['attributes'] as Map)[FieldPaths.pageInstanceId] ==
          secondPageId,
    );
    final firstAttributes = firstEnd['attributes'] as Map;
    final secondAttributes = secondEnd['attributes'] as Map;

    expect(firstPageId, isNot(secondPageId));
    expect(firstAttributes[FieldPaths.frameSampleCount], 2);
    expect(firstAttributes[FieldPaths.frameMaxMs], 12);
    expect(secondAttributes[FieldPaths.frameSampleCount], 7);
    expect(secondAttributes[FieldPaths.frameMaxMs], 60);
    expect(
      output.events.where((event) => event['name'] == 'ui.frame.window'),
      isEmpty,
    );
  });

  test(
    'session timeline json links page http jank error and lifecycle',
    () async {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          sessionConfig: const MonitorSessionConfig(flushOnBackground: false),
          outputs: <MonitorOutput>[output],
        ),
      );
      final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

      reporter.startPageLoad('/home', startTime: startedAt);
      reporter.recordPageView('/home');
      reporter.finishPageFirstFrame(
        '/home',
        endTime: startedAt.add(const Duration(milliseconds: 40)),
      );
      reporter.addBreadcrumb('ui.tap.load_users');
      reporter.recordHttpClient(
        url: 'https://example.com/users/flutter?id=1',
        method: 'GET',
        statusCode: 403,
        durationMs: 321,
        success: false,
        startTime: startedAt.add(const Duration(milliseconds: 50)),
        endTime: startedAt.add(const Duration(milliseconds: 371)),
      );
      reporter.recordJankSequence(
        frameCount: 13,
        frameMaxMs: 71.4,
        frameAvgMs: 51.0,
        frameBudgetMs: 16.67,
        frameFps: 40.7,
      );
      reporter.recordDartError(
        NoSuchMethodError.withInvocation(null, Invocation.method(#missing, [])),
        StackTrace.current,
      );
      await reporter.handleLifecycleState(
        'paused',
        timestamp: startedAt.add(const Duration(seconds: 2)),
      );

      for (final event in output.events) {
        expect(
          SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
          isTrue,
        );
      }

      final pageVisit = output.events.firstWhere(
        (event) => event['name'] == 'page.visit',
      );
      final pageTraceId = pageVisit['traceId'];
      final httpSpan = output.events.singleWhere(
        (event) => event['name'] == 'http.client',
      );
      final jankEvent = output.events.singleWhere(
        (event) => event['name'] == 'ui.jank.sequence',
      );
      final errorEvent = output.events.lastWhere(
        (event) => event['signalType'] == 'error',
      );

      expect(httpSpan['traceId'], pageTraceId);
      expect(jankEvent['traceId'], pageTraceId);
      expect(errorEvent['traceId'], pageTraceId);
      expect((httpSpan['attributes'] as Map)[FieldPaths.httpStatusCode], 403);
      expect((jankEvent['attributes'] as Map)[FieldPaths.jankCount], 13);
      expect(
        (jankEvent['context'] as Map)['route'],
        containsPair('name', '/home'),
      );

      final errorBreadcrumbs =
          (errorEvent['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;
      final breadcrumbNames = errorBreadcrumbs
          .map((item) => (item as Map)['name'])
          .toList(growable: false);
      expect(breadcrumbNames, contains('ui.tap.load_users'));
      expect(breadcrumbNames, contains('http.client'));
      expect(breadcrumbNames, contains('ui.jank.sequence'));
    },
  );

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
    expect(firstFrameSpans, isEmpty);
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
  });

  testWidgets('initial context is attached to bootstrap envelopes', (
    tester,
  ) async {
    final output = RecordingOutput();

    await FlutterMonitorSDK.init(
      config: MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(
          enableLifecycleTracking: false,
          flushOnBackground: false,
        ),
        enableErrorMonitor: false,
        enableJankMonitor: false,
        outputs: <MonitorOutput>[output],
      ),
      appStartTime: DateTime.now().subtract(const Duration(milliseconds: 8)),
      initialContext: const MonitorInitialContext(
        userId: 'bootstrap_user',
        userType: 'qa',
        userTags: <String>['smoke'],
        cohort: 'internal',
        moduleName: 'example',
        moduleScene: 'bootstrap',
        releaseId: '2026.06.06',
        featureFlags: <String>['new_cart'],
        experiments: <String, Object?>{'checkout': 'b'},
        networkType: 'wifi',
        isWeakNetwork: false,
      ),
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

    final bootstrapEvents = output.events
        .where(
          (event) =>
              event['name'] == EventNames.appColdStart ||
              event['name'] == EventNames.sdkInit,
        )
        .toList(growable: false);

    expect(bootstrapEvents, isNotEmpty);
    for (final event in bootstrapEvents) {
      final context = event['context'] as Map;
      final user = context['user'] as Map;
      final module = context['module'] as Map;
      final release = context['release'] as Map;
      final network = context['network'] as Map;

      expect(user['userId'], 'bootstrap_user');
      expect(user['userType'], 'qa');
      expect(user['userTags'], <String>['smoke']);
      expect(user['cohort'], 'internal');
      expect(module['name'], 'example');
      expect(module['scene'], 'bootstrap');
      expect(release['releaseId'], '2026.06.06');
      expect(release['featureFlags'], <String>['new_cart']);
      expect((release['experiments'] as Map)['checkout'], 'b');
      expect(network['type'], 'wifi');
      expect(network['isWeakNetwork'], isFalse);
    }
  });

  test('native resource is available for bootstrap events', () async {
    final output = RecordingOutput();
    final bridge = _FakeNativeBridge(
      resource: const NativeResourceSnapshot(
        available: true,
        platform: 'android',
        processId: 23456,
        bridgeVersion: '0.2.0',
        signalSource: PlatformSignalSources.android,
      ),
    );
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        nativeBridge: bridge,
        outputs: <MonitorOutput>[output],
      ),
    );
    await reporter.resolveBootstrapResources();

    final startup = StartupTraceController(
      reporter: reporter,
      appStartTime: DateTime.now().subtract(const Duration(milliseconds: 8)),
    );
    startup.startSdkInit();
    startup.finishSdkInit();

    final bootstrapEvents = output.events
        .where(
          (event) =>
              event['name'] == EventNames.appColdStart ||
              event['name'] == EventNames.sdkInit,
        )
        .toList(growable: false);

    expect(bootstrapEvents, isNotEmpty);
    for (final event in bootstrapEvents) {
      final resource = event['resource'] as Map;
      final sdk = resource['sdk'] as Map;
      final context = event['context'] as Map;
      final native = context['native'] as Map;

      expect(sdk['nativeVersion'], '0.2.0');
      expect(native['available'], isTrue);
      expect(native['platform'], 'android');
      expect(native['processId'], 23456);
      expect(native['signalSource'], PlatformSignalSources.android);
    }
  });

  test(
    'bootstrap resources keep flutter-only context without bridge',
    () async {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );
      await reporter.resolveBootstrapResources();

      final startup = StartupTraceController(
        reporter: reporter,
        appStartTime: DateTime.now().subtract(const Duration(milliseconds: 8)),
      );
      startup.startSdkInit();

      final event = output.events.singleWhere(
        (item) => item['name'] == EventNames.appColdStart,
      );
      final resource = event['resource'] as Map;
      final sdk = resource['sdk'] as Map;
      final context = event['context'] as Map;
      final native = context['native'] as Map;

      expect(sdk['nativeVersion'], isNull);
      expect(native['available'], isFalse);
      expect(native['signalSource'], PlatformSignalSources.flutter);
    },
  );

  test(
    'resume within timeout keeps session and emits hot resume trace',
    () async {
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

      reporter.track(
        action: 'session.anchor',
        result: MonitorTrackResult.started,
      );
      final originalSessionId = output.events.single['sessionId'];
      await reporter.handleLifecycleState(
        'paused',
        timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
      );
      await reporter.handleLifecycleState(
        'resumed',
        timestamp: DateTime.parse('2026-05-25T12:05:00.000+08:00'),
      );
      reporter.finishHotStartTrace(
        endTime: DateTime.parse('2026-05-25T12:05:00.096+08:00'),
      );

      final hotStartEnd = output.events.lastWhere(
        (event) => event['name'] == 'app.hot_start' && event['status'] == 'ok',
      );
      final backgroundDuration = output.events.singleWhere(
        (event) => event['name'] == EventNames.appBackgroundDuration,
      );

      expect(hotStartEnd['sessionId'], originalSessionId);
      expect(hotStartEnd['durationMs'], 96);
      expect(
        (hotStartEnd['attributes'] as Map)[FieldPaths.appStartType],
        'hot',
      );
      expect(
        (hotStartEnd['attributes'] as Map)[FieldPaths.appStartEndReason],
        StartupEndReasons.firstFrame,
      );
      expect(
        (hotStartEnd['attributes'] as Map)[FieldPaths.appFirstFrameMs],
        96,
      );
      expect((hotStartEnd['payload'] as Map)['session.started_new'], isFalse);
      expect(
        (hotStartEnd['payload'] as Map).containsKey('background_duration_ms'),
        isFalse,
      );
      expect(backgroundDuration['durationMs'], 300000);
    },
  );

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

    reporter.track(
      action: 'session.anchor',
      result: MonitorTrackResult.started,
    );
    final originalSessionId = output.events.single['sessionId'];
    await reporter.handleLifecycleState(
      'hidden',
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );
    await reporter.handleLifecycleState(
      'resumed',
      timestamp: DateTime.parse('2026-05-25T12:45:00.000+08:00'),
    );
    reporter.finishHotStartTrace(
      endTime: DateTime.parse('2026-05-25T12:45:00.128+08:00'),
    );

    final hotStartEnd = output.events.lastWhere(
      (event) => event['name'] == 'app.hot_start' && event['status'] == 'ok',
    );

    expect(hotStartEnd['sessionId'], isNot(originalSessionId));
    expect(hotStartEnd['durationMs'], 128);
    expect((hotStartEnd['payload'] as Map)['session.started_new'], isTrue);
  });

  testWidgets('binding lifecycle resumes close hot start on the next frame', (
    tester,
  ) async {
    final output = RecordingOutput();
    await FlutterMonitorSDK.init(
      config: MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        sessionConfig: const MonitorSessionConfig(
          backgroundSessionTimeout: Duration(minutes: 30),
          flushOnBackground: false,
        ),
        enableErrorMonitor: false,
        enableJankMonitor: false,
        enablePerformanceMonitor: false,
        outputs: <MonitorOutput>[output],
      ),
      appStartTime: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
    );
    await tester.pumpWidget(const SizedBox.shrink());
    final resumedAt = DateTime.now();
    final pausedAt = resumedAt.subtract(const Duration(seconds: 5));

    await MonitorBinding.instance.handleLifecycleState(
      'paused',
      timestamp: pausedAt,
    );
    await MonitorBinding.instance.handleLifecycleState(
      'resumed',
      timestamp: resumedAt,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 16));
    await tester.pump(const Duration(milliseconds: 300));

    final hotStartEnd = output.events.lastWhere(
      (event) => event['name'] == 'app.hot_start' && event['status'] == 'ok',
    );
    final backgroundDuration = output.events.singleWhere(
      (event) => event['name'] == EventNames.appBackgroundDuration,
    );

    expect(backgroundDuration['durationMs'], 5000);
    expect(
      (hotStartEnd['attributes'] as Map)[FieldPaths.appStartEndReason],
      StartupEndReasons.firstFrame,
    );
    expect(hotStartEnd['durationMs'], lessThan(1000));
    expect(hotStartEnd['durationMs'], isNot(backgroundDuration['durationMs']));
    await FlutterMonitorSDK.dispose();
  });

  test('records memory sample growth pressure and suspect leak envelopes', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.recordMemorySample(
      rssMb: 128,
      source: MemorySampleSource.system,
      trigger: 'test.sample',
      samplePhase: PageActivePhases.enter,
      routeName: '/detail',
      traceId: 'trace_detail',
      pageInstanceId: '/detail_100',
    );
    reporter.recordMemoryGrowth(
      growthMb: 32,
      growthDuration: const Duration(minutes: 2),
      source: MemorySampleSource.system,
      trigger: 'test.growth',
      evidence: const <String, Object?>{'sample_count': 2},
    );
    reporter.recordMemoryPressure(
      level: MemoryPressureLevel.critical,
      source: MemorySampleSource.native,
      trigger: 'test.pressure',
    );
    reporter.recordMemoryLeakSuspect(
      growthMb: 96,
      growthDuration: const Duration(minutes: 5),
      source: MemorySampleSource.system,
      trigger: 'test.suspect',
    );

    final sample = output.events.singleWhere(
      (event) => event['name'] == EventNames.memorySample,
    );
    final sampleAttributes = sample['attributes'] as Map;
    expect(sample['signalType'], 'metric');
    expect(sampleAttributes[FieldPaths.memoryRssMb], 128);
    expect(
      sampleAttributes[FieldPaths.memorySampleSource],
      MemorySampleSource.system.toJson(),
    );
    expect(
      sampleAttributes[FieldPaths.memorySamplePhase],
      PageActivePhases.enter,
    );
    expect(sampleAttributes[FieldPaths.pageInstanceId], '/detail_100');
    expect(sample['traceId'], 'trace_detail');
    expect(((sample['context'] as Map)['route'] as Map)['name'], '/detail');

    final growth = output.events.singleWhere(
      (event) => event['name'] == EventNames.memoryGrowth,
    );
    final growthAttributes = growth['attributes'] as Map;
    expect(growth['durationMs'], 120000);
    expect(growthAttributes[FieldPaths.memoryGrowthMb], 32);
    expect(growthAttributes[FieldPaths.memoryGrowthDurationMs], 120000);

    final pressure = output.events.singleWhere(
      (event) => event['name'] == EventNames.memoryPressure,
    );
    final pressureAttributes = pressure['attributes'] as Map;
    expect(pressure['priority'], EventPriority.high.toJson());
    expect(pressure['status'], EventStatus.error.toJson());
    expect(
      pressureAttributes[FieldPaths.memoryPressureLevel],
      MemoryPressureLevel.critical.toJson(),
    );
    expect(
      pressureAttributes[FieldPaths.memorySampleSource],
      MemorySampleSource.native.toJson(),
    );

    final suspect = output.events.singleWhere(
      (event) => event['name'] == EventNames.memoryLeakSuspect,
    );
    expect(suspect['status'], EventStatus.unknown.toJson());
    expect((suspect['payload'] as Map)['assertion'], 'suspect_only');

    for (final event in output.events) {
      expect(
        SchemaValidator().validateJson(event.cast<String, Object?>()).isValid,
        isTrue,
      );
    }
  });

  test('memory pressure is available as breadcrumb context', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.recordMemoryPressure(
      level: MemoryPressureLevel.moderate,
      trigger: 'test.pressure',
    );
    reporter.recordDartError(StateError('StateError'), StackTrace.current);

    final error = output.events.lastWhere(
      (event) => event['signalType'] == 'error',
    );
    final breadcrumbs =
        (error['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;

    expect(
      breadcrumbs.any((breadcrumb) {
        final item = breadcrumb as Map;
        return item['name'] == EventNames.memoryPressure;
      }),
      isTrue,
    );
  });

  test('native memory pressure enters unified envelope and breadcrumbs', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final timestamp = DateTime.parse('2026-05-28T14:00:00.000+08:00');

    reporter.recordNativeSignal(
      NativeSignal(
        type: NativeSignalType.memory,
        name: EventNames.nativeMemoryPressure,
        timestamp: timestamp,
        resource: const NativeResourceSnapshot(
          available: true,
          platform: 'android',
          processId: 12345,
          bridgeVersion: '0.1.0',
          signalSource: PlatformSignalSources.android,
        ),
        memory: const NativeMemorySnapshot(
          nativeUsedMb: 256,
          pressureLevel: MemoryPressureLevel.critical,
        ),
        payload: const <String, Object?>{'warning': 'trim_memory_running_low'},
      ),
    );
    reporter.recordDartError(StateError('StateError'), StackTrace.current);

    final pressure = output.events.singleWhere(
      (event) => event['name'] == EventNames.nativeMemoryPressure,
    );
    final attributes = pressure['attributes'] as Map;
    final payload = pressure['payload'] as Map;
    final context = pressure['context'] as Map;
    final native = context['native'] as Map;

    expect(pressure['signalType'], SignalType.metric.toJson());
    expect(pressure['timestamp'], '2026-05-28T14:00:00.000');
    expect(pressure['status'], EventStatus.error.toJson());
    expect(pressure['priority'], EventPriority.high.toJson());
    expect(
      attributes[FieldPaths.nativeSignal],
      NativeSignalType.memory.toJson(),
    );
    expect(attributes[FieldPaths.memoryNativeUsedMb], 256);
    expect(
      attributes[FieldPaths.memoryPressureLevel],
      MemoryPressureLevel.critical.toJson(),
    );
    expect(
      attributes[FieldPaths.memorySampleSource],
      MemorySampleSource.native.toJson(),
    );
    expect(native['available'], isTrue);
    expect(native['platform'], 'android');
    expect(native['processId'], 12345);
    expect(native['bridgeVersion'], '0.1.0');
    expect(native['signalSource'], PlatformSignalSources.android);
    expect(payload[FieldPaths.payloadNative], isA<Map>());
    expect(
      (payload[FieldPaths.payloadNative] as Map)['warning'],
      'trim_memory_running_low',
    );

    final error = output.events.lastWhere(
      (event) => event['signalType'] == SignalType.error.toJson(),
    );
    final breadcrumbs =
        (error['payload'] as Map)[FieldPaths.payloadBreadcrumbs] as List;

    expect(
      breadcrumbs.any((breadcrumb) {
        final item = breadcrumb as Map;
        return item['name'] == EventNames.nativeMemoryPressure;
      }),
      isTrue,
    );
  });

  test(
    'native lifecycle signal enters timeline without replacing flutter lifecycle',
    () {
      final output = RecordingOutput();
      final reporter = Reporter(
        MonitorConfig(
          appInfo: const AppInfo(appKey: 'app_key'),
          outputs: <MonitorOutput>[output],
        ),
      );

      reporter.recordNativeSignal(
        NativeSignal(
          type: NativeSignalType.lifecycle,
          name: EventNames.nativeLifecycle,
          timestamp: DateTime.parse('2026-05-28T14:05:00.000+08:00'),
          resource: const NativeResourceSnapshot(
            available: true,
            platform: 'ios',
            bridgeVersion: '0.1.0',
            signalSource: PlatformSignalSources.ios,
          ),
          attributes: const <String, Object?>{
            FieldPaths.contextLifecycleState: LifecycleStates.inactive,
          },
        ),
      );

      final event = output.events.singleWhere(
        (item) => item['name'] == EventNames.nativeLifecycle,
      );
      final attributes = event['attributes'] as Map;
      final context = event['context'] as Map;

      expect(event['signalType'], SignalType.breadcrumb.toJson());
      expect(
        attributes[FieldPaths.nativeSignal],
        NativeSignalType.lifecycle.toJson(),
      );
      expect(
        attributes[FieldPaths.contextLifecycleState],
        LifecycleStates.inactive,
      );
      expect(
        (context['native'] as Map)['signalSource'],
        PlatformSignalSources.ios,
      );
    },
  );

  test('native missing context reason is preserved for exceptional signal', () {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );

    reporter.recordNativeSignal(
      NativeSignal(
        type: NativeSignalType.anr,
        name: EventNames.nativeAnr,
        timestamp: DateTime.parse('2026-05-28T14:10:00.000+08:00'),
        anrDurationMs: 5000,
        contextMissing: true,
        contextMissingReason: ContextMissingReasons.nativeBridgeUnavailable,
      ),
    );

    final event = output.events.singleWhere(
      (item) => item['name'] == EventNames.nativeAnr,
    );
    final attributes = event['attributes'] as Map;
    final context = event['context'] as Map;

    expect(event['signalType'], SignalType.error.toJson());
    expect(event['level'], EventLevel.fatal.toJson());
    expect(attributes[FieldPaths.nativeSignal], NativeSignalType.anr.toJson());
    expect(attributes[FieldPaths.nativeAnrDurationMs], 5000);
    expect(attributes[FieldPaths.errorMechanism], 'native');
    expect(context['missing'], isTrue);
    expect(
      context['missingReason'],
      ContextMissingReasons.nativeBridgeUnavailable,
    );
  });

  test('native bridge resource snapshot updates SDK context', () async {
    final output = RecordingOutput();
    final bridge = _FakeNativeBridge(
      resource: const NativeResourceSnapshot(
        available: true,
        platform: 'android',
        processId: 23456,
        bridgeVersion: '0.2.0',
        signalSource: PlatformSignalSources.android,
      ),
      memory: const NativeMemorySnapshot(
        rssMb: 128,
        heapUsedMb: 21,
        heapCapacityMb: 64,
        nativeUsedMb: 42,
      ),
    );
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
        nativeBridge: bridge,
      ),
    );

    await reporter.resolveBootstrapResources();
    final controller = NativeBridgeController(
      bridge: bridge,
      reporter: reporter,
      minSampleInterval: Duration.zero,
    );
    addTearDown(controller.dispose);
    await controller.init();
    reporter.recordMemorySample(rssMb: 64, trigger: 'test.sample');

    final event = output.events.singleWhere(
      (item) => item['name'] == EventNames.memorySample,
    );
    final resource = event['resource'] as Map;
    final sdk = resource['sdk'] as Map;
    final context = event['context'] as Map;
    final native = context['native'] as Map;

    expect(sdk['nativeVersion'], '0.2.0');
    expect(native['available'], isTrue);
    expect(native['platform'], 'android');
    expect(native['processId'], 23456);
    expect(native['signalSource'], PlatformSignalSources.android);

    final nativeSample = output.events.singleWhere(
      (item) => item['name'] == EventNames.nativeMemorySample,
    );
    final nativeSampleAttributes = nativeSample['attributes'] as Map;
    expect(nativeSample['signalType'], SignalType.metric.toJson());
    expect(
      nativeSampleAttributes[FieldPaths.nativeSignal],
      NativeSignalType.memory.toJson(),
    );
    expect(nativeSampleAttributes[FieldPaths.memoryRssMb], 128);
    expect(nativeSampleAttributes[FieldPaths.memoryHeapUsedMb], 21);
    expect(nativeSampleAttributes[FieldPaths.memoryHeapCapacityMb], 64);
    expect(nativeSampleAttributes[FieldPaths.memoryNativeUsedMb], 42);
    expect(
      nativeSampleAttributes[FieldPaths.memorySampleSource],
      MemorySampleSource.native.toJson(),
    );
    final nativeSamplePayload = nativeSample['payload'] as Map;
    expect(
      nativeSamplePayload[PayloadKeys.trigger],
      TriggerValues.sessionStart,
    );
    final payloadNative = nativeSamplePayload[FieldPaths.payloadNative] as Map;
    expect(payloadNative[PayloadKeys.trigger], isNull);
    expect(payloadNative['rssMb'], 128);
    expect(payloadNative['heapUsedMb'], 21);
    expect(payloadNative['heapCapacityMb'], 64);
    expect(payloadNative['nativeUsedMb'], 42);
    expect(payloadNative['sampleSource'], MemorySampleSource.native.toJson());
  });

  test(
    'lifecycle records foreground and background duration metrics',
    () async {
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

      await reporter.handleLifecycleState(
        'resumed',
        timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
      );
      await reporter.handleLifecycleState(
        'paused',
        timestamp: DateTime.parse('2026-05-25T12:02:00.000+08:00'),
      );
      await reporter.handleLifecycleState(
        'resumed',
        timestamp: DateTime.parse('2026-05-25T12:05:00.000+08:00'),
      );

      final foreground = output.events.singleWhere(
        (event) => event['name'] == EventNames.appForegroundDuration,
      );
      final background = output.events.singleWhere(
        (event) => event['name'] == EventNames.appBackgroundDuration,
      );

      expect(foreground['durationMs'], 120000);
      expect(background['durationMs'], 180000);
      expect(
        (background['attributes'] as Map)[FieldPaths.contextLifecycleState],
        'resumed',
      );
    },
  );

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

  test('dispose closes active page trace before final flush', () async {
    final output = RecordingOutput();
    final reporter = Reporter(
      MonitorConfig(
        appInfo: const AppInfo(appKey: 'app_key'),
        outputs: <MonitorOutput>[output],
      ),
    );
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');

    reporter.startPageLoad('/home', startTime: startedAt);
    reporter.finishPageFirstFrame(
      '/home',
      endTime: startedAt.add(const Duration(milliseconds: 32)),
    );
    await reporter.dispose();

    final pageVisitEnd = output.events.firstWhere(
      (event) =>
          event['name'] == EventNames.pageVisit &&
          (event['attributes'] as Map)[FieldPaths.eventPhase] == 'end',
    );
    final pageStay = output.events.singleWhere(
      (event) => event['name'] == EventNames.pageStay,
    );

    expect(
      (pageVisitEnd['payload'] as Map)[PayloadKeys.pageEndReason],
      PageEndReasons.appDispose,
    );
    expect(
      (pageStay['payload'] as Map)[PayloadKeys.pageEndReason],
      PageEndReasons.appDispose,
    );
    expect(
      (pageVisitEnd['attributes'] as Map).containsKey(FieldPaths.pageTo),
      isFalse,
    );
    expect(pageStay['durationMs'], isA<num>());
    expect(output.lastFlushIsAppExiting, isTrue);
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
        (event) => event['name'] == EventNames.sdkOutputDisposeFailed,
      ),
      isTrue,
    );
  });
}
