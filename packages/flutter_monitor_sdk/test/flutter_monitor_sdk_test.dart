import 'dart:async';
import 'dart:convert';

import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/delivery/memory_offline_event_queue.dart';
import 'package:flutter_monitor_sdk/src/delivery/reliable_http_output.dart';
import 'package:flutter_monitor_sdk/src/delivery/sdk_health_monitor.dart';
import 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart'
    show PageActivitySnapshot, Reporter;
import 'package:flutter_monitor_sdk/src/modules/frame_window_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/native/native_signal_mapper.dart';
import 'package:flutter_monitor_sdk/src/delivery/queued_monitor_event.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_control.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/pipeline/track_summary_aggregator.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/http_detail_builder.dart';
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
    'measure route override freezes explicit route and reuses page trace',
    () {
      TestWidgetsFlutterBinding.ensureInitialized();
      final reporter = Reporter(
        const MonitorConfig(appInfo: AppInfo(appKey: 'test')),
      );

      // 目标页尚未入栈：仅冻结显式路由，trace 与页面实例缺省，走兜底链路。
      final pending = reporter.interactionPageBindingForRoute('/stock-detail');
      expect(pending, isNotNull);
      expect(pending!.routeName, '/stock-detail');
      expect(pending.routeFullName, '/stock-detail');
      expect(pending.traceId, isNull);
      expect(pending.pageInstanceId, isNull);

      // 目标页已入栈：复用其 trace 与页面实例。
      final pageInstanceId = reporter.startPageLoad(
        '/stock-detail',
        routeFullName: '/stock-detail?symbol=NVDA.US',
      );
      final bound = reporter.interactionPageBindingForRoute('/stock-detail');
      expect(bound!.routeName, '/stock-detail');
      expect(bound.routeFullName, '/stock-detail?symbol=NVDA.US');
      expect(bound.traceId, isNotNull);
      expect(bound.pageInstanceId, pageInstanceId);
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

  test('reliable output aggregates queue drops into health report with one '
      'saturation edge event', () async {
    final healthEvents = <OutputHealthEvent>[];
    final health = SdkHealthMonitor(mode: SdkOutputModes.production);
    health.onEvent = healthEvents.add;
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
      healthMonitor: health,
    );
    output.init();

    output.add(_testEnvelope('evt_1', 'business.one'));
    output.add(_testEnvelope('evt_2', 'business.two'));
    output.add(_testEnvelope('evt_3', 'business.three'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    // 不再逐条产生 sdk.queue.drop；队列首次饱和只产生一条边沿事件。
    expect(
      healthEvents.where((event) => event.name == EventNames.sdkQueueDrop),
      isEmpty,
    );
    final queueStates = healthEvents
        .where((event) => event.name == EventNames.sdkQueueState)
        .toList();
    expect(queueStates, hasLength(1));
    expect(
      queueStates.single.payload[PayloadKeys.reason],
      SdkQueueStateReasons.queueSaturated,
    );

    health.report(trigger: SdkFlushReasons.manual);
    final report = healthEvents.singleWhere(
      (event) => event.name == EventNames.sdkHealthReport,
    );
    expect(report.attributes[FieldPaths.sdkHealthEnqueuedCount], 3);
    expect(report.attributes[FieldPaths.sdkHealthDroppedCount], 2);
    final drops = report.payload[PayloadKeys.dropsByReason] as Map;
    final queueFull = drops[SdkDropReasons.queueFull] as Map;
    expect(queueFull['count'], 2);
    expect(
      queueFull['events'],
      contains(
        allOf(<Matcher>[
          containsPair('name', 'business.one'),
          containsPair('signalType', SignalType.breadcrumb.toJson()),
          containsPair('priority', EventPriority.normal.toJson()),
          containsPair('source', 'test'),
          containsPair('route', '/test'),
          containsPair('module', 'test_module'),
          containsPair('scene', 'test_scene'),
          containsPair('count', 1),
        ]),
      ),
    );

    // 窗口上报后计数复位，无活动时不再产生新摘要。
    health.report(trigger: SdkFlushReasons.manual);
    expect(
      healthEvents.where((event) => event.name == EventNames.sdkHealthReport),
      hasLength(1),
    );
    await output.dispose();
    health.dispose();
  });

  test('reliable output does not count health report delivery as next health '
      'activity', () async {
    final healthEvents = <OutputHealthEvent>[];
    final postedNames = <String>[];
    final health = SdkHealthMonitor(mode: SdkOutputModes.production);
    health.onEvent = healthEvents.add;
    final output = ReliableHttpOutput(
      endpoint: Uri.parse('https://monitor.example.com/events'),
      mode: SdkOutputModes.production,
      policy: const MonitorProductionPolicy(
        flushInterval: Duration(minutes: 5),
      ),
      queue: MemoryOfflineEventQueue(policy: const MonitorProductionPolicy()),
      client: MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final events = body['events'] as List<dynamic>;
        postedNames.addAll(
          events.whereType<Map<String, dynamic>>().map(
            (event) => event['name'] as String,
          ),
        );
        return http.Response('{}', 200);
      }),
      healthMonitor: health,
    );
    output.init();

    final healthEnvelope = _testEnvelope(
      'evt_health',
      EventNames.sdkHealthReport,
    )..['signalType'] = 'sdk';
    output.add(healthEnvelope);
    await output.flush();

    expect(postedNames, <String>[EventNames.sdkHealthReport]);
    health.report(trigger: SdkFlushReasons.manual);
    expect(
      healthEvents.where((event) => event.name == EventNames.sdkHealthReport),
      isEmpty,
    );

    output.add(_testEnvelope('evt_business', 'business.real'));
    await output.flush();
    health.report(trigger: SdkFlushReasons.manual);

    final report = healthEvents.singleWhere(
      (event) => event.name == EventNames.sdkHealthReport,
    );
    expect(report.attributes[FieldPaths.sdkHealthEnqueuedCount], 1);
    expect(report.attributes[FieldPaths.sdkHealthSentCount], 1);
    expect(report.attributes[FieldPaths.sdkHealthFlushSuccessCount], 1);
    expect(postedNames, <String>[EventNames.sdkHealthReport, 'business.real']);

    await output.dispose();
    health.dispose();
  });

  test(
    'reliable output does not emit flush edge for health-only exit failure',
    () async {
      final healthEvents = <OutputHealthEvent>[];
      final outputHealthEvents = <OutputHealthEvent>[];
      final health = SdkHealthMonitor(mode: SdkOutputModes.production);
      health.onEvent = healthEvents.add;
      final output = ReliableHttpOutput(
        endpoint: Uri.parse('https://monitor.example.com/events'),
        mode: SdkOutputModes.production,
        policy: const MonitorProductionPolicy(
          flushInterval: Duration(minutes: 5),
        ),
        queue: MemoryOfflineEventQueue(policy: const MonitorProductionPolicy()),
        client: MockClient((_) async => throw StateError('offline')),
        healthMonitor: health,
      )..onHealthEvent = outputHealthEvents.add;
      output.init();

      final healthEnvelope = _testEnvelope(
        'evt_health_exit',
        EventNames.sdkHealthReport,
      )..['signalType'] = 'sdk';
      output.add(healthEnvelope);
      await output.flush(isAppExiting: true, reason: SdkFlushReasons.appExit);
      health.report(trigger: SdkFlushReasons.manual);

      expect(
        outputHealthEvents.where(
          (event) => event.name == EventNames.sdkOutputFlush,
        ),
        isEmpty,
      );
      expect(
        healthEvents.where((event) => event.name == EventNames.sdkHealthReport),
        isEmpty,
      );

      await output.dispose();
      health.dispose();
    },
  );

  test('reliable output emits one retry edge then drops exhausted events as '
      'retry_exhausted', () async {
    final healthEvents = <OutputHealthEvent>[];
    final health = SdkHealthMonitor(mode: SdkOutputModes.production);
    health.onEvent = healthEvents.add;
    final output = ReliableHttpOutput(
      endpoint: Uri.parse('https://monitor.example.com/events'),
      mode: SdkOutputModes.production,
      policy: const MonitorProductionPolicy(
        maxRetryAttempts: 2,
        retryBaseDelay: Duration.zero,
        retryMaxDelay: Duration.zero,
        quickFlushDelay: Duration(milliseconds: 1),
      ),
      queue: MemoryOfflineEventQueue(
        policy: const MonitorProductionPolicy(maxRetryAttempts: 2),
      ),
      client: MockClient((_) async => http.Response('server error', 500)),
      healthMonitor: health,
    );
    output.init();

    output.add(_testEnvelope('evt_retry', 'business.retry'));
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await output.flush();
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await output.flush();
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await output.flush();
    await Future<void>.delayed(const Duration(milliseconds: 5));

    // 重试只在进入重试状态的边沿产生一条事件。
    expect(
      healthEvents.where((event) => event.name == EventNames.sdkRetrySchedule),
      hasLength(1),
    );
    expect(
      healthEvents.where((event) => event.name == EventNames.sdkQueueDrop),
      isEmpty,
    );

    health.report(trigger: SdkFlushReasons.manual);
    final report = healthEvents.singleWhere(
      (event) => event.name == EventNames.sdkHealthReport,
    );
    expect(report.attributes[FieldPaths.sdkHealthRetryCount], 2);
    expect(report.attributes[FieldPaths.sdkHealthFlushFailureCount], 3);
    final drops = report.payload[PayloadKeys.dropsByReason] as Map;
    final exhausted = drops[SdkDropReasons.retryExhausted] as Map;
    expect(exhausted['count'], 1);
    expect(
      exhausted['events'],
      contains(containsPair('name', 'business.retry')),
    );

    await output.dispose();
    health.dispose();
  });

  test(
    'reliable output records expired queue drops in health report',
    () async {
      final healthEvents = <OutputHealthEvent>[];
      final health = SdkHealthMonitor(mode: SdkOutputModes.production);
      health.onEvent = healthEvents.add;
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
        healthMonitor: health,
      );
      output.init();

      output.add(_testEnvelope('evt_expired', 'business.expired'));
      await Future<void>.delayed(const Duration(milliseconds: 5));
      await output.flush();
      await Future<void>.delayed(const Duration(milliseconds: 5));

      expect(
        healthEvents.where((event) => event.name == EventNames.sdkQueueDrop),
        isEmpty,
      );
      health.report(trigger: SdkFlushReasons.manual);
      final report = healthEvents.singleWhere(
        (event) => event.name == EventNames.sdkHealthReport,
      );
      expect(report.attributes[FieldPaths.sdkHealthDroppedCount], 1);
      final drops = report.payload[PayloadKeys.dropsByReason] as Map;
      final expired = drops[SdkDropReasons.expired] as Map;
      expect(
        expired['events'],
        contains(containsPair('name', 'business.expired')),
      );

      await output.dispose();
      health.dispose();
    },
  );

  test(
    'reliable output dispose flushes events enqueued during active flush',
    () async {
      final firstPost = Completer<http.Response>();
      final postedBatches = <List<String>>[];
      final client = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final events = body['events'] as List<dynamic>;
        postedBatches.add(
          events
              .whereType<Map<String, dynamic>>()
              .map((event) => event['eventId'] as String)
              .toList(growable: false),
        );
        if (postedBatches.length == 1) {
          return firstPost.future;
        }
        return http.Response('{}', 200);
      });
      final output = ReliableHttpOutput(
        endpoint: Uri.parse('https://monitor.example.com/events'),
        mode: SdkOutputModes.production,
        policy: const MonitorProductionPolicy(
          flushInterval: Duration(minutes: 5),
        ),
        queue: MemoryOfflineEventQueue(policy: const MonitorProductionPolicy()),
        client: client,
      );
      output.init();

      output.add(_testEnvelope('evt_during_flush_1', 'business.flush.one'));
      final flushFuture = output.flush();
      await _waitFor(() => postedBatches.length == 1);

      output.add(_testEnvelope('evt_during_flush_2', 'business.flush.two'));
      final disposeFuture = output.dispose();
      firstPost.complete(http.Response('{}', 200));

      await flushFuture;
      await disposeFuture;
      expect(postedBatches, <List<String>>[
        <String>['evt_during_flush_1'],
        <String>['evt_during_flush_2'],
      ]);
    },
  );

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

  test('pipeline control exempts hard evidence and samples sampleable', () {
    final control = PipelineControl(
      mode: MonitorMode.production(
        endpoint: Uri.parse('https://monitor.example.com/events'),
        policy: const MonitorProductionPolicy(
          successfulHttpSampleRate: 0,
          memorySampleRate: 0,
          maxTrackEventsPerMinute: 1,
        ),
      ),
    );

    final httpOk = EventEnvelope(
      eventId: 'evt_http',
      timestamp: DateTime.now(),
      signalType: SignalType.span,
      name: EventNames.httpClient,
      status: EventStatus.ok,
    );
    expect(control.evaluate(httpOk).keep, isTrue);

    final memorySample = EventEnvelope(
      eventId: 'evt_mem',
      timestamp: DateTime.now(),
      signalType: SignalType.metric,
      name: EventNames.memorySample,
      priority: EventPriority.low,
    );
    final sampled = control.evaluate(memorySample);
    expect(sampled.keep, isFalse);
    expect(sampled.reason, SdkDropReasons.sampledOut);

    EventEnvelope track(String id) => EventEnvelope(
      eventId: id,
      timestamp: DateTime.now(),
      signalType: SignalType.breadcrumb,
      name: 'checkout.submit',
      attributes: const <String, Object?>{
        FieldPaths.businessAction: 'checkout.submit',
      },
    );
    expect(control.evaluate(track('evt_track_1')).keep, isTrue);
    final limited = control.evaluate(track('evt_track_2'));
    expect(limited.keep, isFalse, reason: 'track 限流先于 hard 豁免');
    expect(limited.aggregate, isTrue, reason: '超限 track 聚合而不是丢弃');
    expect(limited.reason, SdkDropReasons.rateLimited);
  });

  test('production policy defaults favor evidence retention', () {
    expect(MonitorProductionPolicy.defaultPolicy.maxQueueEvents, 20000);
    expect(
      MonitorProductionPolicy.defaultPolicy.maxQueueBytes,
      64 * 1024 * 1024,
    );
    expect(MonitorProductionPolicy.defaultPolicy.maxEventBytes, 256 * 1024);
    expect(MonitorProductionPolicy.defaultPolicy.maxBatchBytes, 1024 * 1024);

    expect(MonitorProductionPolicy.localLive.maxQueueEvents, 10000);
    expect(MonitorProductionPolicy.localLive.maxQueueBytes, 64 * 1024 * 1024);
    expect(MonitorProductionPolicy.localLive.maxEventBytes, 512 * 1024);
    expect(MonitorProductionPolicy.localLive.maxBatchBytes, 1024 * 1024);

    final conservative = MonitorProductionPolicy.conservative();
    expect(conservative.maxQueueEvents, 10000);
    expect(conservative.maxQueueBytes, 32 * 1024 * 1024);
    expect(conservative.maxEventBytes, 256 * 1024);
    expect(conservative.maxBatchBytes, 512 * 1024);
  });

  test('http detail builder captures query, headers and hashed body', () {
    final builder = HttpDetailBuilder(
      config: const MonitorHttpConfig(maxBodyBytes: 8),
      mode: SdkOutputModes.production,
    );

    final section = builder.build(
      uri: Uri.parse('https://api.example.com/product?id=1&tab=hot'),
      requestHeaders: const <String, String>{
        'content-type': 'application/json',
      },
      requestBody: '{"id":1}',
      responseHeaders: const <String, String>{'x-request-id': 'req-1'},
      responseBody: 'a long response body over limit',
    );

    expect(section[PayloadKeys.httpQuery], {'id': '1', 'tab': 'hot'});
    final detail = section[PayloadKeys.httpDetail] as Map<String, Object?>;
    final request = detail[PayloadKeys.request] as Map<String, Object?>;
    expect(request[PayloadKeys.headers], {'content-type': 'application/json'});
    expect(request[PayloadKeys.body], '{"id":1}');
    expect(request[PayloadKeys.bodyTruncated], isFalse);
    expect(request[PayloadKeys.bodyOriginalLength], 8);
    expect(request[PayloadKeys.bodySha256], isA<String>());

    final response = detail[PayloadKeys.response] as Map<String, Object?>;
    expect(response[PayloadKeys.body], 'a long r');
    expect(response[PayloadKeys.bodyTruncated], isTrue);
    expect(
      response[PayloadKeys.bodyOriginalLength],
      'a long response body over limit'.length,
    );

    expect(
      urlWithoutQuery('https://api.example.com/product?id=1#frag'),
      'https://api.example.com/product',
    );
  });

  test('http detail builder applies redactor and capture switches', () {
    final redacting = HttpDetailBuilder(
      config: MonitorHttpConfig(
        redactor: (detail) {
          final query = detail[PayloadKeys.httpQuery];
          if (query is Map<String, Object?> && query.containsKey('token')) {
            query['token'] = '[redacted]';
          }
          return detail;
        },
      ),
      mode: SdkOutputModes.localLive,
    );
    final redacted = redacting.build(
      uri: Uri.parse('https://api.example.com/a?token=secret'),
    );
    expect(redacted[PayloadKeys.httpQuery], {'token': '[redacted]'});

    final disabled = HttpDetailBuilder(
      config: const MonitorHttpConfig(
        captureQuery: false,
        captureHeaders: false,
        captureRequestBody: false,
        captureResponseBody: false,
      ),
      mode: SdkOutputModes.production,
    );
    final empty = disabled.build(
      uri: Uri.parse('https://api.example.com/a?id=1'),
      requestHeaders: const <String, String>{'a': 'b'},
      requestBody: 'body',
      responseBody: 'body',
    );
    expect(empty, isEmpty);
  });

  test('memory queue evicts by retention level before age', () async {
    final queue = MemoryOfflineEventQueue(
      policy: const MonitorProductionPolicy(maxQueueEvents: 1),
    );
    await queue.init();

    QueuedMonitorEvent event(
      String id,
      String name,
      String signalType,
      DateTime createdAt,
    ) {
      final envelope = _testEnvelope(id, name);
      envelope['signalType'] = signalType;
      return QueuedMonitorEvent.fromEnvelope(envelope, now: createdAt);
    }

    final base = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    // sampleable 比 hard 更早入队，仍应先被驱逐。
    await queue.enqueue(
      event('evt_sample', EventNames.memorySample, 'metric', base),
    );
    final firstDrop = await queue.enqueue(
      event(
        'evt_http',
        EventNames.httpClient,
        'span',
        base.add(const Duration(seconds: 1)),
      ),
    );
    expect(firstDrop.dropped.single.eventId, 'evt_sample');

    // compressible 同样让位于 hard。
    final secondDrop = await queue.enqueue(
      event(
        'evt_page',
        EventNames.pageView,
        'breadcrumb',
        base.add(const Duration(seconds: 2)),
      ),
    );
    expect(secondDrop.dropped.single.eventId, 'evt_page');

    final stats = await queue.stats();
    expect(stats.length, 1);
    await queue.dispose();
  });

  test(
    'queue strips http detail before dropping events on byte pressure',
    () async {
      final bigBody = 'x' * 4000;
      QueuedMonitorEvent httpEvent(String id) {
        final envelope = _testEnvelope(id, EventNames.httpClient);
        envelope['signalType'] = 'span';
        envelope['payload'] = <String, Object?>{
          PayloadKeys.source: 'test',
          PayloadKeys.url: 'https://api.example.com/big',
          PayloadKeys.httpQuery: <String, Object?>{'id': '1'},
          PayloadKeys.httpDetail: <String, Object?>{
            PayloadKeys.response: <String, Object?>{
              PayloadKeys.body: bigBody,
              PayloadKeys.bodySha256: 'hash-$id',
              PayloadKeys.bodyOriginalLength: bigBody.length,
            },
          },
        };
        return QueuedMonitorEvent.fromEnvelope(envelope);
      }

      final queue = MemoryOfflineEventQueue(
        policy: const MonitorProductionPolicy(
          maxQueueEvents: 10,
          maxQueueBytes: 6000,
          maxEventBytes: 64 * 1024,
        ),
      );
      await queue.init();
      await queue.enqueue(httpEvent('evt_http_1'));
      final result = await queue.enqueue(httpEvent('evt_http_2'));

      // 字节超限通过剥离详情解决，事件本身不丢。
      expect(result.dropped, isEmpty);
      final stats = await queue.stats();
      expect(stats.length, 2);
      expect(stats.bytes, lessThanOrEqualTo(6000));

      final batch = await queue.nextBatch(
        maxEvents: 10,
        maxBytes: 64 * 1024,
        now: DateTime.now(),
      );
      final stripped = batch.firstWhere(
        (event) => event.eventId == 'evt_http_1',
      );
      final payload = stripped.envelope['payload'] as Map;
      expect(payload[PayloadKeys.httpDetailDropped], isTrue);
      expect(payload.containsKey(PayloadKeys.httpQuery), isFalse);
      final detail = payload[PayloadKeys.httpDetail] as Map;
      final response = detail[PayloadKeys.response] as Map;
      expect(response[PayloadKeys.bodySha256], 'hash-evt_http_1');
      expect(response.containsKey(PayloadKeys.body), isFalse);
      await queue.dispose();
    },
  );

  test('queue strips oversized single http event before rejecting', () async {
    final envelope = _testEnvelope('evt_http_big', EventNames.httpClient);
    envelope['signalType'] = 'span';
    envelope['payload'] = <String, Object?>{
      PayloadKeys.source: 'test',
      PayloadKeys.url: 'https://api.example.com/big',
      PayloadKeys.httpQuery: <String, Object?>{'id': '1'},
      PayloadKeys.httpDetail: <String, Object?>{
        PayloadKeys.response: <String, Object?>{
          PayloadKeys.body: 'x' * 5000,
          PayloadKeys.bodySha256: 'hash-big',
          PayloadKeys.bodyOriginalLength: 5000,
        },
      },
    };
    final queue = MemoryOfflineEventQueue(
      policy: const MonitorProductionPolicy(
        maxQueueEvents: 10,
        maxQueueBytes: 64 * 1024,
        maxEventBytes: 4096,
      ),
    );
    await queue.init();

    final result = await queue.enqueue(
      QueuedMonitorEvent.fromEnvelope(envelope),
    );

    expect(result.accepted, isTrue);
    expect(result.dropped, isEmpty);
    final batch = await queue.nextBatch(
      maxEvents: 10,
      maxBytes: 64 * 1024,
      now: DateTime.now(),
    );
    final stored = batch.single;
    expect(stored.bytes, lessThanOrEqualTo(4096));
    final payload = stored.envelope['payload'] as Map;
    expect(payload[PayloadKeys.httpDetailDropped], isTrue);
    expect(payload.containsKey(PayloadKeys.httpQuery), isFalse);
    final detail = payload[PayloadKeys.httpDetail] as Map;
    final response = detail[PayloadKeys.response] as Map;
    expect(response[PayloadKeys.bodySha256], 'hash-big');
    expect(response.containsKey(PayloadKeys.body), isFalse);
    await queue.dispose();
  });

  test(
    'queue folds hard http events into summary instead of dropping',
    () async {
      QueuedMonitorEvent httpEvent(String id, DateTime createdAt) {
        final envelope = _testEnvelope(id, EventNames.httpClient);
        envelope['signalType'] = 'span';
        envelope['durationMs'] = 120;
        envelope['attributes'] = <String, Object?>{
          FieldPaths.httpUrlNormalized: '/api/product/{id}',
          FieldPaths.httpSuccess: true,
        };
        return QueuedMonitorEvent.fromEnvelope(envelope, now: createdAt);
      }

      final queue = MemoryOfflineEventQueue(
        policy: const MonitorProductionPolicy(maxQueueEvents: 2),
      );
      await queue.init();
      final base = DateTime.parse('2026-05-25T12:00:00.000+08:00');
      await queue.enqueue(httpEvent('evt_h1', base));
      await queue.enqueue(
        httpEvent('evt_h2', base.add(const Duration(seconds: 1))),
      );
      final result = await queue.enqueue(
        httpEvent('evt_h3', base.add(const Duration(seconds: 2))),
      );

      expect(result.dropped, isEmpty, reason: 'hard 证据被聚合而不是丢弃');
      final batch = await queue.nextBatch(
        maxEvents: 10,
        maxBytes: 64 * 1024,
        now: DateTime.now(),
      );
      final summary = batch.singleWhere(
        (event) => event.name == EventNames.httpClientSummary,
      );
      final attrs = summary.envelope['attributes'] as Map;
      expect(attrs[FieldPaths.summaryCount], 2);
      expect(attrs[FieldPaths.httpUrlNormalized], '/api/product/{id}');
      expect(attrs[FieldPaths.summaryDurationMaxMs], 120);
      final payload = summary.envelope['payload'] as Map;
      expect(payload[PayloadKeys.exemplarEventIds], ['evt_h1', 'evt_h2']);
      expect(summary.retention, EventRetention.hard);
      // 最新的 http 事件仍单独保留。
      expect(batch.any((event) => event.eventId == 'evt_h3'), isTrue);
      await queue.dispose();
    },
  );

  test('track summary aggregator folds over-limit tracks into summary', () {
    final emitted = <RawSignal>[];
    var current = DateTime.parse('2026-05-25T12:00:00.000+08:00');
    final aggregator = TrackSummaryAggregator(
      emit: emitted.add,
      window: const Duration(seconds: 60),
      now: () => current,
    );

    EventEnvelope track(String id, num durationMs) => EventEnvelope(
      eventId: id,
      timestamp: current,
      signalType: SignalType.breadcrumb,
      name: 'checkout.submit',
      durationMs: durationMs,
      attributes: const <String, Object?>{
        FieldPaths.businessAction: 'checkout.submit',
      },
    );

    aggregator.fold(track('evt_t1', 100));
    aggregator.fold(track('evt_t2', 300));
    expect(emitted, isEmpty, reason: '窗口未结束不发出');

    current = current.add(const Duration(seconds: 61));
    aggregator.fold(track('evt_t3', 200));
    expect(emitted, hasLength(1));
    final signal = emitted.single;
    expect(signal.name, EventNames.businessActionSummary);
    expect(signal.signalType, SignalType.metric);
    expect(signal.attributes[FieldPaths.businessAction], 'checkout.submit');
    expect(signal.attributes[FieldPaths.summaryCount], 3);
    expect(signal.attributes[FieldPaths.summaryDurationMaxMs], 300);
    expect(signal.payload[PayloadKeys.exemplarEventIds], [
      'evt_t1',
      'evt_t2',
      'evt_t3',
    ]);

    aggregator.flush();
    expect(emitted, hasLength(1), reason: 'flush 后无残留 bucket');
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

Future<void> _waitFor(bool Function() condition) async {
  final deadline = DateTime.now().add(const Duration(seconds: 1));
  while (!condition()) {
    if (DateTime.now().isAfter(deadline)) {
      throw StateError('Timed out waiting for test condition.');
    }
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}
