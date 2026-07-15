import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/pipeline/error_fingerprint.dart';
import 'package:flutter_monitor_sdk/src/pipeline/error_summary_aggregator.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ErrorFingerprint', () {
    test('normalizes message and builds stable fingerprint', () {
      const message =
          'BoxConstraints forces an infinite width.\nThese invalid constraints were provided to RenderPhysicalShape';
      final a = ErrorFingerprint.build(
        name: EventNames.errorFlutter,
        type: ErrorTypes.flutterError,
        message: message,
        stackHead: 'BoxConstraints.debugAssertIsValid > RenderObject.layout',
        route: '/membership',
      );
      final b = ErrorFingerprint.build(
        name: EventNames.errorFlutter,
        type: ErrorTypes.flutterError,
        message: message,
        stackHead: 'BoxConstraints.debugAssertIsValid > RenderObject.layout',
        route: '/membership',
      );
      final otherRoute = ErrorFingerprint.build(
        name: EventNames.errorFlutter,
        type: ErrorTypes.flutterError,
        message: message,
        stackHead: 'BoxConstraints.debugAssertIsValid > RenderObject.layout',
        route: '/home',
      );

      expect(a, b);
      expect(a, isNot(otherRoute));
      expect(a, startsWith('err_'));
      expect(
        ErrorFingerprint.normalizeMessage(message),
        'BoxConstraints forces an infinite width.',
      );
    });

    test('extracts stack head and app frame', () {
      final stack = StackTrace.fromString(
        '#0      BoxConstraints.debugAssertIsValid (package:flutter/src/rendering/box.dart:549:9)\n'
        '#1      RenderObject.layout (package:flutter/src/rendering/object.dart:2775:7)\n'
        '#2      _MembershipPageState.build (package:example/pages/membership_page.dart:148:31)\n',
      );
      expect(
        ErrorFingerprint.stackHead(stack),
        'BoxConstraints.debugAssertIsValid > RenderObject.layout > _MembershipPageState.build',
      );
      expect(ErrorFingerprint.appFrame(stack), '_MembershipPageState.build');
    });
  });

  group('ErrorSummaryAggregator', () {
    test('emits first error and aggregates duplicates into summary', () {
      final signals = <RawSignal>[];
      var now = DateTime.utc(2026, 7, 15, 8);
      final aggregator = ErrorSummaryAggregator(
        emit: signals.add,
        window: const Duration(seconds: 60),
        now: () => now,
      );

      final first = _errorEnvelope('evt_1', 'fp_a', now);
      expect(aggregator.observe(first), isTrue);

      now = now.add(const Duration(seconds: 1));
      expect(aggregator.observe(_errorEnvelope('evt_2', 'fp_a', now)), isFalse);
      expect(aggregator.observe(_errorEnvelope('evt_3', 'fp_a', now)), isFalse);

      aggregator.flush();
      expect(signals, hasLength(1));
      expect(signals.single.name, EventNames.errorGroupSummary);
      expect(signals.single.attributes[FieldPaths.errorFingerprint], 'fp_a');
      expect(signals.single.attributes[FieldPaths.summaryCount], 3);
    });
  });
}

EventEnvelope _errorEnvelope(String eventId, String fingerprint, DateTime at) {
  return EventEnvelope(
    eventId: eventId,
    timestamp: at,
    signalType: SignalType.error,
    name: EventNames.errorFlutter,
    level: EventLevel.error,
    status: EventStatus.error,
    priority: EventPriority.high,
    sessionId: 'ses_1',
    attributes: <String, Object?>{
      FieldPaths.errorType: ErrorTypes.flutterError,
      FieldPaths.errorMechanism: ErrorMechanisms.flutter,
      FieldPaths.errorFingerprint: fingerprint,
      FieldPaths.errorTitle: 'BoxConstraints forces an infinite width.',
    },
  );
}
