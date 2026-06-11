import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/delivery/memory_offline_event_queue.dart';
import 'package:flutter_monitor_sdk/src/delivery/reliable_http_output.dart';
import 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart'
    show PageActivitySnapshot;
import 'package:flutter_monitor_sdk/src/modules/frame_window_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/native/native_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('envelope builder keeps registered attributes and payload overflow', () {
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
      envelope.payload[PayloadKeys.unregisteredAttributes],
      containsPair('custom.detail', 'kept in payload'),
    );
    expect(SchemaValidator().validate(envelope).isValid, isTrue);
  });

  test(
    'envelope builder applies route override as a consistent route scope',
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
              stack: <String>['/detail?id=1'],
            ),
          ),
        ),
        traceSnapshot: const TraceSnapshot(sessionId: 'ses_test'),
      );

      expect(envelope.context.route?.name, '/home');
      expect(envelope.context.route?.fullName, '/home');
      expect(envelope.context.route?.stack, <String>['/home']);
    },
  );

  test('envelope builder attaches breadcrumbs only for diagnostic events', () {
    final traceSnapshot = TraceSnapshot(
      sessionId: 'ses_test',
      breadcrumbs: <Breadcrumb>[
        Breadcrumb(
          timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
          name: 'ui.tap.checkout',
        ),
      ],
    );
    final contextSnapshot = const ContextSnapshot(
      resource: MonitorResource.empty(),
      context: MonitorContext.empty(),
    );
    final builder = EnvelopeBuilder();

    final failedHttp = builder.build(
      signal: RawSignal(
        source: 'test',
        name: EventNames.httpClient,
        signalType: SignalType.span,
        timestamp: DateTime.parse('2026-05-25T12:00:01.000+08:00'),
        status: EventStatus.error,
        attributes: const <String, Object?>{
          FieldPaths.httpStatusCode: 500,
          FieldPaths.httpSuccess: false,
        },
      ),
      contextSnapshot: contextSnapshot,
      traceSnapshot: traceSnapshot,
    );
    final successfulHttp = builder.build(
      signal: RawSignal(
        source: 'test',
        name: EventNames.httpClient,
        signalType: SignalType.span,
        timestamp: DateTime.parse('2026-05-25T12:00:02.000+08:00'),
        status: EventStatus.ok,
        attributes: const <String, Object?>{
          FieldPaths.httpStatusCode: 200,
          FieldPaths.httpSuccess: true,
        },
      ),
      contextSnapshot: contextSnapshot,
      traceSnapshot: traceSnapshot,
    );

    expect(failedHttp.payload[FieldPaths.payloadBreadcrumbs], isA<List>());
    expect(
      successfulHttp.payload.containsKey(FieldPaths.payloadBreadcrumbs),
      isFalse,
    );
  });

  test(
    'interaction collector supports common auto window and stage finish',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final snapshots = <InteractionMeasureSnapshot>[];
      final collector = InteractionMeasureCollector(
        config: const MonitorPerformanceConfig(
          commonObserveFor: Duration(milliseconds: 1),
          stageSettleWindow: Duration(milliseconds: 1),
          interactionTimeout: Duration(seconds: 1),
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
        config: const MonitorPerformanceConfig(
          commonObserveFor: Duration(milliseconds: 1),
          maxConcurrentInteractions: 0,
        ),
        onFinished: snapshots.add,
      );

      final handle = collector.measure(action: 'tab.switch');
      await Future<void>.delayed(const Duration(milliseconds: 5));

      expect(handle.id, isEmpty);
      expect(snapshots, isEmpty);
    },
  );

  test(
    'reliable output coalesces queue drops without recursive drop storm',
    () async {
      final output = ReliableHttpOutput(
        endpoint: Uri.parse('https://monitor.example.com/events'),
        mode: SdkOutputModes.production,
        policy: const MonitorProductionPolicy(
          maxQueueEvents: 1,
          maxQueueBytes: 1024 * 1024,
          quickFlushDelay: Duration(milliseconds: 1),
        ),
        queue: MemoryOfflineEventQueue(
          policy: const MonitorProductionPolicy(
            maxQueueEvents: 1,
            maxQueueBytes: 1024 * 1024,
          ),
        ),
      );
      final healthEvents = <OutputHealthEvent>[];
      output.onHealthEvent = healthEvents.add;
      output.init();

      output.add(_testEnvelope('evt_1', 'business.one'));
      output.add(_testEnvelope('evt_2', 'business.two'));
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(
        healthEvents.where((event) => event.name == EventNames.sdkQueueDrop),
        hasLength(1),
      );
      expect(
        healthEvents.single.attributes[FieldPaths.sdkDropReason],
        SdkDropReasons.queueFull,
      );
      expect(healthEvents.single.attributes[FieldPaths.sdkDropCount], 1);
      expect(
        healthEvents.single.payload[PayloadKeys.droppedSummary],
        contains(
          allOf(
            containsPair('name', 'business.one'),
            containsPair('signalType', SignalType.breadcrumb.toJson()),
            containsPair('priority', EventPriority.normal.toJson()),
            containsPair('source', 'test'),
            containsPair('route', '/test'),
            containsPair('module', 'test_module'),
            containsPair('scene', 'test_scene'),
          ),
        ),
      );
      expect(
        healthEvents.single.payload[PayloadKeys.droppedSummary],
        contains(containsPair('count', 1)),
      );

      output.add(_testEnvelope('evt_drop', EventNames.sdkQueueDrop));
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(
        healthEvents.where((event) => event.name == EventNames.sdkQueueDrop),
        hasLength(1),
      );
      output.dispose();
    },
  );

  test('reliable output drops batch after max retry attempts', () async {
    final output = ReliableHttpOutput(
      endpoint: Uri.parse('https://monitor.example.com/events'),
      mode: SdkOutputModes.production,
      policy: const MonitorProductionPolicy(
        maxRetryAttempts: 0,
        quickFlushDelay: Duration(milliseconds: 1),
      ),
      queue: MemoryOfflineEventQueue(
        policy: const MonitorProductionPolicy(maxRetryAttempts: 0),
      ),
      client: MockClient((_) async => http.Response('server error', 500)),
    );
    final healthEvents = <OutputHealthEvent>[];
    output.onHealthEvent = healthEvents.add;
    output.init();

    output.add(_testEnvelope('evt_retry', 'business.retry'));
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await output.flush();
    await Future<void>.delayed(const Duration(milliseconds: 5));

    final drop = healthEvents.singleWhere(
      (event) => event.name == EventNames.sdkQueueDrop,
    );
    expect(
      drop.attributes[FieldPaths.sdkDropReason],
      SdkDropReasons.nonRetryableRejected,
    );
    expect(drop.attributes[FieldPaths.sdkDropCount], 1);
    expect(
      drop.payload[PayloadKeys.droppedSummary],
      contains(containsPair('name', 'business.retry')),
    );

    output.dispose();
  });

  test('reliable output records expired queue drops', () async {
    final output = ReliableHttpOutput(
      endpoint: Uri.parse('https://monitor.example.com/events'),
      mode: SdkOutputModes.production,
      policy: const MonitorProductionPolicy(
        maxEventAge: Duration.zero,
        quickFlushDelay: Duration(milliseconds: 1),
      ),
      queue: MemoryOfflineEventQueue(
        policy: const MonitorProductionPolicy(maxEventAge: Duration.zero),
      ),
    );
    final healthEvents = <OutputHealthEvent>[];
    output.onHealthEvent = healthEvents.add;
    output.init();

    output.add(_testEnvelope('evt_expired', 'business.expired'));
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await output.flush();
    await Future<void>.delayed(const Duration(milliseconds: 5));

    final drop = healthEvents.singleWhere(
      (event) => event.name == EventNames.sdkQueueDrop,
    );
    expect(drop.attributes[FieldPaths.sdkDropReason], SdkDropReasons.expired);
    expect(drop.attributes[FieldPaths.sdkDropCount], 1);
    expect(
      drop.payload[PayloadKeys.droppedSummary],
      contains(containsPair('name', 'business.expired')),
    );

    output.dispose();
  });

  test('frame window collector emits page frame evidence', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    final snapshots = <FrameStatsSnapshot>[];
    final collector = FrameWindowCollector(onPageWindowFinished: snapshots.add);
    final startedAt = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final endedAt = startedAt.add(const Duration(milliseconds: 48));

    collector.startPageWindow(
      PageActivitySnapshot(
        routeName: '/feed',
        routeFullName: '/feed?tab=hot',
        traceId: 'trace_feed',
        pageInstanceId: 'page_1',
        activePhase: PageActivePhases.enter,
        timestamp: startedAt,
      ),
    );
    collector.recordTimings(<FrameTiming>[
      FrameTiming(
        vsyncStart: 0,
        buildStart: 0,
        buildFinish: 8000,
        rasterStart: 8000,
        rasterFinish: 24000,
        rasterFinishWallTime: 24000,
      ),
      FrameTiming(
        vsyncStart: 0,
        buildStart: 0,
        buildFinish: 12000,
        rasterStart: 12000,
        rasterFinish: 56000,
        rasterFinishWallTime: 56000,
      ),
    ]);
    collector.finishPageWindow(PageActivePhases.covered, timestamp: endedAt);

    expect(snapshots, hasLength(1));
    expect(snapshots.single.routeName, '/feed');
    expect(snapshots.single.traceId, 'trace_feed');
    expect(snapshots.single.pageInstanceId, 'page_1');
    expect(snapshots.single.sampleCount, 2);
    expect(snapshots.single.slowCount, greaterThanOrEqualTo(1));
    expect(snapshots.single.windowPhase, PageActivePhases.covered);
  });

  test(
    'native signal mapper maps native crash into fatal error raw signal',
    () {
      final signal = NativeSignal(
        type: NativeSignalType.crash,
        name: EventNames.nativeCrash,
        timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
        resource: const NativeResourceSnapshot(
          platform: 'ios',
          processId: 42,
          bridgeVersion: '1.0.0',
        ),
        thread: 'main',
        threadId: '1',
        crashType: 'SIGABRT',
        payload: const <String, Object?>{'reason': 'abort'},
      );

      final raw = const NativeSignalMapper().map(signal);

      expect(raw.signalType, SignalType.error);
      expect(raw.level, EventLevel.fatal);
      expect(raw.status, EventStatus.error);
      expect(raw.priority, EventPriority.critical);
      expect(raw.nativeContext?.platform, 'ios');
      expect(
        raw.attributes[FieldPaths.nativeSignal],
        NativeSignalType.crash.toJson(),
      );
      expect(raw.attributes[FieldPaths.errorMechanism], 'native');
      expect(raw.attributes[FieldPaths.errorFatal], isTrue);
      expect(
        (raw.payload[FieldPaths.payloadNative] as Map),
        containsPair('reason', 'abort'),
      );
    },
  );

  test('native signal mapper maps memory pressure as high priority metric', () {
    final signal = NativeSignal(
      type: NativeSignalType.memory,
      name: EventNames.nativeMemoryPressure,
      timestamp: DateTime.parse('2026-05-25T12:00:00.000+08:00'),
      memory: const NativeMemorySnapshot(
        rssMb: 320,
        nativeUsedMb: 128,
        pressureLevel: MemoryPressureLevel.critical,
      ),
    );

    final raw = const NativeSignalMapper().map(signal);

    expect(raw.signalType, SignalType.metric);
    expect(raw.level, EventLevel.error);
    expect(raw.status, EventStatus.error);
    expect(raw.priority, EventPriority.high);
    expect(raw.attributes[FieldPaths.memoryRssMb], 320);
    expect(raw.attributes[FieldPaths.memoryNativeUsedMb], 128);
    expect(
      raw.attributes[FieldPaths.memoryPressureLevel],
      MemoryPressureLevel.critical.toJson(),
    );
  });
}

Map<String, dynamic> _testEnvelope(String eventId, String name) {
  return <String, dynamic>{
    'schemaVersion': '1.0',
    'eventId': eventId,
    'timestamp': DateTime.now().toIso8601String(),
    'signalType': name == EventNames.sdkQueueDrop ? 'sdk' : 'breadcrumb',
    'name': name,
    'level': 'info',
    'status': 'ok',
    'priority': 'normal',
    'sessionId': 'ses_test',
    'resource': const <String, Object?>{},
    'context': const <String, Object?>{
      'route': <String, Object?>{'name': '/test'},
      'module': <String, Object?>{'name': 'test_module', 'scene': 'test_scene'},
    },
    'attributes': const <String, Object?>{},
    'payload': const <String, Object?>{PayloadKeys.source: 'test'},
  };
}
