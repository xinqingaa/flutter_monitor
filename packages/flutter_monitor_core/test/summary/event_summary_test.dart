import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  group('EventSummarizer', () {
    const summarizer = EventSummarizer();
    const formatter = CompactLogFormatter();

    test('formats http errors with stable key order', () {
      final envelope = EventEnvelope(
        eventId: 'evt_http',
        timestamp: DateTime.parse('2026-05-26T15:46:09.206020'),
        startTime: DateTime.parse('2026-05-26T15:46:08.593167'),
        endTime: DateTime.parse('2026-05-26T15:46:09.206020'),
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
        payload: const <String, Object?>{
          FieldPaths.payloadBreadcrumbs: [
            <String, Object?>{'name': 'page.view'},
          ],
        },
      );

      final summary = summarizer.summarize(envelope);

      expect(summary.kind, EventSummaryKind.http);
      expect(summary.toKeyValueMap().keys, [
        'kind',
        'name',
        'status',
        'phase',
        'method',
        'url',
        'code',
        'success',
        'duration_ms',
        'route',
        'breadcrumbs',
        'session',
        'trace',
        'span',
        'event',
      ]);
      expect(
        formatter.format(summary),
        '[FM] kind=http name=http.client status=error phase=instant '
        'method=GET url=/users/flutter code=403 success=false '
        'duration_ms=612 route=/ breadcrumbs=1 session=ses_1 '
        'trace=trace_1 span=span_1 event=evt_http',
      );
    });

    test('formats jank metrics with critical frame data', () {
      final envelope = EventEnvelope(
        eventId: 'evt_jank',
        timestamp: DateTime.parse('2026-05-26T15:46:00.522551'),
        signalType: SignalType.metric,
        name: 'ui.jank.sequence',
        level: EventLevel.info,
        status: EventStatus.ok,
        sessionId: 'ses_1',
        traceId: 'trace_1',
        context: const MonitorContext(route: RouteContext(name: '/')),
        attributes: const <String, Object?>{
          FieldPaths.eventPhase: 'instant',
          FieldPaths.jankCount: 13,
          FieldPaths.frameMaxMs: 71.396,
          FieldPaths.frameAvgMs: 50.97038461538461,
          FieldPaths.frameFps: 40.68375836559782,
        },
      );

      final line = formatter.format(summarizer.summarize(envelope));

      expect(
        line,
        '[FM] kind=jank name=ui.jank.sequence status=ok phase=instant '
        'route=/ frames=13 frame_max_ms=71.4 frame_avg_ms=51 '
        'fps=40.7 session=ses_1 trace=trace_1 event=evt_jank',
      );
    });

    test('quotes error messages and keeps lookup ids', () {
      final envelope = EventEnvelope(
        eventId: 'evt_error',
        timestamp: DateTime.parse('2026-05-26T15:46:00.522551'),
        signalType: SignalType.error,
        name: 'error.flutter',
        level: EventLevel.error,
        status: EventStatus.error,
        sessionId: 'ses_1',
        traceId: 'trace_1',
        context: const MonitorContext(
          route: RouteContext(name: '/detail', fullName: '/detail?id=1'),
        ),
        attributes: const <String, Object?>{
          FieldPaths.eventPhase: 'instant',
          FieldPaths.errorMechanism: 'flutter',
        },
        payload: const <String, Object?>{
          FieldPaths.payloadErrorMessage:
              "NoSuchMethodError: The method 'hello' was called on null.",
          FieldPaths.payloadBreadcrumbs: [
            <String, Object?>{'name': 'page.view'},
            <String, Object?>{'name': 'page.view'},
            <String, Object?>{'name': 'tap'},
          ],
        },
      );

      final line = formatter.format(summarizer.summarize(envelope));

      expect(
        line,
        '[FM] kind=error name=error.flutter status=error phase=instant '
        'mechanism=flutter '
        'message="NoSuchMethodError: The method \'hello\' was called on null." '
        'route="/detail?id=1" breadcrumbs=3 session=ses_1 trace=trace_1 '
        'event=evt_error',
      );
    });

    test('visibility policy hides noisy intermediate events', () {
      const policy = CompactLogVisibilityPolicy();

      final routePush = summarizer.summarize(
        EventEnvelope(
          eventId: 'evt_route',
          timestamp: DateTime.parse('2026-05-26T15:46:00.522551'),
          signalType: SignalType.span,
          name: 'route.push',
          status: EventStatus.ok,
          attributes: const <String, Object?>{FieldPaths.eventPhase: 'end'},
        ),
      );
      final okHttp = summarizer.summarize(
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
        ),
      );
      final httpError = summarizer.summarize(
        okHttp.envelope.copyWith(
          eventId: 'evt_http_error',
          status: EventStatus.error,
          attributes: const <String, Object?>{
            FieldPaths.eventPhase: EventPhases.instant,
            FieldPaths.httpStatusCode: 500,
            FieldPaths.httpSuccess: false,
          },
        ),
      );

      expect(policy.shouldDisplay(routePush), isFalse);
      expect(policy.shouldDisplay(okHttp), isFalse);
      expect(policy.shouldDisplay(httpError), isTrue);
    });
  });
}
