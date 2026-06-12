import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  const registry = RetentionRegistry.instance;

  group('RetentionRegistry hard evidence', () {
    test('all error signals are hard', () {
      for (final name in <String>[
        EventNames.errorFlutter,
        EventNames.errorDart,
        EventNames.errorManual,
        EventNames.nativeCrash,
        EventNames.nativeOom,
        EventNames.nativeAnr,
      ]) {
        expect(
          registry.resolve(name: name, signalType: SignalType.error),
          EventRetention.hard,
          reason: name,
        );
      }
    });

    test('http.client main event is hard', () {
      expect(
        registry.resolve(
          name: EventNames.httpClient,
          signalType: SignalType.span,
        ),
        EventRetention.hard,
      );
    });

    test('aggregated summary events are hard', () {
      expect(
        registry.resolve(
          name: EventNames.httpClientSummary,
          signalType: SignalType.metric,
        ),
        EventRetention.hard,
      );
      expect(
        registry.resolve(
          name: EventNames.businessActionSummary,
          signalType: SignalType.metric,
        ),
        EventRetention.hard,
      );
    });

    test('business track breadcrumb and interaction.measure are hard', () {
      expect(
        registry.resolve(
          name: 'checkout.submit',
          signalType: SignalType.breadcrumb,
          attributes: const <String, Object?>{
            FieldPaths.businessAction: 'checkout.submit',
          },
        ),
        EventRetention.hard,
      );
      expect(
        registry.resolve(
          name: EventNames.interactionMeasure,
          signalType: SignalType.span,
        ),
        EventRetention.hard,
      );
    });

    test('cold/hot start end is hard, start phase is not', () {
      for (final name in <String>[
        EventNames.appColdStart,
        EventNames.appHotStart,
      ]) {
        expect(
          registry.resolve(
            name: name,
            signalType: SignalType.trace,
            attributes: const <String, Object?>{
              FieldPaths.eventPhase: EventPhases.end,
            },
          ),
          EventRetention.hard,
          reason: '$name end',
        );
        expect(
          registry.resolve(
            name: name,
            signalType: SignalType.trace,
            attributes: const <String, Object?>{
              FieldPaths.eventPhase: EventPhases.start,
            },
          ),
          EventRetention.compressible,
          reason: '$name start',
        );
      }
    });

    test('jank sequence, memory pressure and leak suspect are hard', () {
      for (final name in <String>[
        EventNames.uiJankSequence,
        EventNames.memoryPressure,
        EventNames.nativeMemoryPressure,
        EventNames.memoryLeakSuspect,
      ]) {
        expect(
          registry.resolve(name: name, signalType: SignalType.metric),
          EventRetention.hard,
          reason: name,
        );
      }
    });

    test('only sdk.init and sdk.health.report are hard among sdk events', () {
      expect(
        registry.resolve(name: EventNames.sdkInit, signalType: SignalType.sdk),
        EventRetention.hard,
      );
      expect(
        registry.resolve(
          name: EventNames.sdkHealthReport,
          signalType: SignalType.sdk,
        ),
        EventRetention.hard,
      );
      for (final name in <String>[
        EventNames.sdkQueueState,
        EventNames.sdkRetrySchedule,
        EventNames.sdkOutputFlush,
        EventNames.sdkLifecycleFlush,
      ]) {
        expect(
          registry.resolve(name: name, signalType: SignalType.sdk),
          EventRetention.sampleable,
          reason: name,
        );
      }
    });
  });

  group('RetentionRegistry lower levels', () {
    test('memory samples are sampleable', () {
      expect(
        registry.resolve(
          name: EventNames.memorySample,
          signalType: SignalType.metric,
        ),
        EventRetention.sampleable,
      );
      expect(
        registry.resolve(
          name: EventNames.nativeMemorySample,
          signalType: SignalType.metric,
        ),
        EventRetention.sampleable,
      );
    });

    test('page, route and ui breadcrumbs default to compressible', () {
      for (final (name, signalType) in <(String, SignalType)>[
        (EventNames.pageVisit, SignalType.trace),
        (EventNames.pageView, SignalType.breadcrumb),
        (EventNames.routePush, SignalType.breadcrumb),
        (EventNames.uiClick, SignalType.breadcrumb),
        (EventNames.appLifecycle, SignalType.breadcrumb),
        (EventNames.memoryGrowth, SignalType.metric),
      ]) {
        expect(
          registry.resolve(name: name, signalType: signalType),
          EventRetention.compressible,
          reason: name,
        );
      }
    });
  });

  group('RetentionRegistry resolveEnvelope/resolveJson', () {
    test('resolveEnvelope matches resolve', () {
      final envelope = EventEnvelope(
        eventId: 'evt-1',
        timestamp: DateTime.utc(2026, 1, 1),
        signalType: SignalType.span,
        name: EventNames.httpClient,
      );
      expect(registry.resolveEnvelope(envelope), EventRetention.hard);
    });

    test('resolveJson reads wire shape', () {
      expect(
        registry.resolveJson(const <String, Object?>{
          'name': EventNames.httpClient,
          'signalType': 'span',
        }),
        EventRetention.hard,
      );
      expect(
        registry.resolveJson(const <String, Object?>{
          'name': 'checkout.submit',
          'signalType': 'breadcrumb',
          'attributes': <String, Object?>{
            FieldPaths.businessAction: 'checkout.submit',
          },
        }),
        EventRetention.hard,
      );
      expect(
        registry.resolveJson(const <String, Object?>{
          'name': EventNames.memorySample,
          'signalType': 'metric',
        }),
        EventRetention.sampleable,
      );
      expect(
        registry.resolveJson(const <String, Object?>{}),
        EventRetention.compressible,
      );
    });
  });

  group('EventRetention wire values', () {
    test('round trips and falls back to compressible', () {
      expect(EventRetention.hard.toJson(), 'hard');
      expect(EventRetention.fromJson('sampleable'), EventRetention.sampleable);
      expect(EventRetention.fromJson('unknown'), EventRetention.compressible);
      expect(EventRetention.fromJson(null), EventRetention.compressible);
    });
  });
}
