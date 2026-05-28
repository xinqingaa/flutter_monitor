import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_manager.dart';
import 'package:flutter_monitor_sdk/src/outputs/monitor_output.dart';
import 'package:flutter_monitor_sdk/src/pipeline/envelope_builder.dart';
import 'package:flutter_monitor_sdk/src/pipeline/pipeline_result.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/breadcrumb_store.dart';
import 'package:flutter_monitor_sdk/src/tracing/session_manager.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_manager.dart';

class EventPipeline {
  EventPipeline({
    required ContextManager contextManager,
    required SessionManager sessionManager,
    required TraceManager traceManager,
    required BreadcrumbStore breadcrumbStore,
    required List<MonitorOutput> outputs,
    EnvelopeBuilder? envelopeBuilder,
    SchemaValidator? schemaValidator,
    PrivacyFilter? privacyFilter,
  }) : _contextManager = contextManager,
       _sessionManager = sessionManager,
       _traceManager = traceManager,
       _breadcrumbStore = breadcrumbStore,
       _outputs = outputs,
       _envelopeBuilder = envelopeBuilder ?? EnvelopeBuilder(),
       _schemaValidator = schemaValidator ?? SchemaValidator(),
       _privacyFilter = privacyFilter ?? PrivacyFilter();

  final ContextManager _contextManager;
  final SessionManager _sessionManager;
  final TraceManager _traceManager;
  final BreadcrumbStore _breadcrumbStore;
  final List<MonitorOutput> _outputs;
  final EnvelopeBuilder _envelopeBuilder;
  final SchemaValidator _schemaValidator;
  final PrivacyFilter _privacyFilter;

  PipelineResult capture(RawSignal signal) {
    return _capture(
      signal: signal,
      sessionId: _sessionManager.currentSessionId,
    );
  }

  PipelineResult captureForSession({
    required RawSignal signal,
    required String sessionId,
  }) {
    return _capture(signal: signal, sessionId: sessionId);
  }

  PipelineResult _capture({
    required RawSignal signal,
    required String sessionId,
  }) {
    try {
      final breadcrumbLimit = _envelopeBuilder.defaultBreadcrumbLimit(signal);
      final contextSnapshot = _contextManager.capture();
      final activeTraceSnapshot = _traceManager.capture(
        sessionId: sessionId,
        breadcrumbs: const <Breadcrumb>[],
      );
      final effectiveTraceId = signal.traceId ?? activeTraceSnapshot.traceId;
      final traceSnapshot = activeTraceSnapshot
          .copyWith(
            breadcrumbs: _breadcrumbStore.relevantSnapshot(
              limit: breadcrumbLimit,
              traceId: effectiveTraceId,
              route: contextSnapshot.context.route?.name,
            ),
          )
          .overrideWith(
            traceId: signal.traceId,
            spanId: signal.spanId,
            parentSpanId: signal.parentSpanId,
          );

      final built = _envelopeBuilder.build(
        signal: signal,
        contextSnapshot: contextSnapshot,
        traceSnapshot: traceSnapshot,
      );
      final validation = _schemaValidator.validate(built);
      if (!validation.isValid) {
        _emitSelfMonitoring(
          name: EventNames.sdkPipelineValidationFailed,
          payload: <String, Object?>{
            PayloadKeys.source: signal.source,
            PayloadKeys.signalName: signal.name,
            PayloadKeys.issues: validation.errors
                .map((issue) => issue.toJson())
                .toList(growable: false),
          },
        );
        return PipelineResult.rejected(validation.errors);
      }

      final filtered = _privacyFilter.filterEnvelope(built);
      _recordBreadcrumb(filtered);
      _dispatch(filtered);
      return PipelineResult.accepted(filtered);
    } catch (error, stackTrace) {
      _emitSelfMonitoring(
        name: EventNames.sdkPipelineEnvelopeBuildFailed,
        payload: <String, Object?>{
          PayloadKeys.source: signal.source,
          PayloadKeys.signalName: signal.name,
          PayloadKeys.error: error.toString(),
          PayloadKeys.stack: stackTrace.toString(),
        },
      );
      return PipelineResult.rejected([
        SchemaValidationIssue(
          path: 'pipeline',
          code: 'envelope_build_failed',
          message: error.toString(),
        ),
      ]);
    }
  }

  void _dispatch(EventEnvelope envelope) {
    final json = envelope.toJson();
    for (final output in _outputs) {
      try {
        output.add(json);
      } catch (error) {
        debugPrint(
          'Error while dispatching event to ${output.runtimeType}: $error',
        );
        _emitSelfMonitoring(
          name: EventNames.sdkOutputDispatchFailed,
          payload: <String, Object?>{
            PayloadKeys.output: output.runtimeType.toString(),
            PayloadKeys.error: error.toString(),
          },
          dispatch: false,
        );
      }
    }
  }

  Future<void> flush({bool isAppExiting = false}) async {
    for (final output in _outputs) {
      try {
        await output.flush(isAppExiting: isAppExiting);
      } catch (error) {
        debugPrint('Error while flushing ${output.runtimeType}: $error');
        _emitSelfMonitoring(
          name: EventNames.sdkOutputFlushFailed,
          payload: <String, Object?>{
            PayloadKeys.output: output.runtimeType.toString(),
            PayloadKeys.error: error.toString(),
            PayloadKeys.isAppExiting: isAppExiting,
          },
        );
      }
    }
  }

  void _recordBreadcrumb(EventEnvelope envelope) {
    if (!_shouldRecordBreadcrumb(envelope)) return;
    {
      _breadcrumbStore.add(
        Breadcrumb(
          timestamp: envelope.timestamp,
          name: envelope.name,
          level: envelope.level ?? EventLevel.info,
          eventId: envelope.eventId,
          sessionId: envelope.sessionId,
          traceId: envelope.traceId,
          spanId: envelope.spanId,
          route: envelope.context.route?.name,
          attributes: envelope.attributes,
          payload: _breadcrumbPayload(envelope),
        ),
      );
    }
  }

  bool _shouldRecordBreadcrumb(EventEnvelope envelope) {
    if (envelope.signalType == SignalType.sdk) return false;
    if (envelope.signalType == SignalType.breadcrumb) return true;
    if (envelope.signalType == SignalType.error) return true;
    if (envelope.name == EventNames.uiJankSequence) return true;
    if (envelope.name == EventNames.memoryPressure) return true;
    if (envelope.name == EventNames.nativeMemoryPressure) return true;
    if (envelope.name == EventNames.memoryLeakSuspect) return true;
    if (envelope.name == EventNames.nativeWarning) return true;
    if (envelope.name == EventNames.httpClient &&
        envelope.status == EventStatus.error) {
      return true;
    }
    return false;
  }

  Map<String, Object?> _breadcrumbPayload(EventEnvelope envelope) {
    final payload = Map<String, Object?>.from(envelope.payload);
    payload.remove(FieldPaths.payloadBreadcrumbs);
    payload.remove(FieldPaths.payloadErrorStacktrace);

    if (envelope.name == EventNames.httpClient) {
      return _compactHttpPayload(envelope, payload);
    }
    if (envelope.name == EventNames.uiJankSequence) {
      return _compactJankPayload(envelope, payload);
    }
    if (envelope.signalType != SignalType.error) {
      return payload;
    }

    return <String, Object?>{
      if (payload[FieldPaths.payloadErrorMessage] != null)
        FieldPaths.payloadErrorMessage: payload[FieldPaths.payloadErrorMessage],
      if (payload[FieldPaths.payloadErrorLibrary] != null)
        FieldPaths.payloadErrorLibrary: payload[FieldPaths.payloadErrorLibrary],
      if (payload[PayloadKeys.context] != null)
        PayloadKeys.context: payload[PayloadKeys.context],
    };
  }

  Map<String, Object?> _compactHttpPayload(
    EventEnvelope envelope,
    Map<String, Object?> payload,
  ) {
    return <String, Object?>{
      if (payload[PayloadKeys.httpSource] != null)
        PayloadKeys.httpSource: payload[PayloadKeys.httpSource],
      if (payload[PayloadKeys.url] != null)
        PayloadKeys.url: payload[PayloadKeys.url],
      if (envelope.durationMs != null)
        PayloadKeys.durationMs: envelope.durationMs,
    };
  }

  Map<String, Object?> _compactJankPayload(
    EventEnvelope envelope,
    Map<String, Object?> payload,
  ) {
    final route = payload[PayloadKeys.page];
    return <String, Object?>{
      if (route != null) PayloadKeys.routeName: route,
      if (envelope.durationMs != null)
        PayloadKeys.durationMs: envelope.durationMs,
    };
  }

  void _emitSelfMonitoring({
    required String name,
    Map<String, Object?> payload = const <String, Object?>{},
    bool dispatch = true,
  }) {
    final event = EventEnvelope(
      eventId: 'evt_sdk_${DateTime.now().microsecondsSinceEpoch}',
      timestamp: DateTime.now(),
      signalType: SignalType.sdk,
      name: name,
      level: EventLevel.warning,
      status: EventStatus.error,
      priority: EventPriority.high,
      sessionId: _sessionManager.currentSessionId,
      resource: _contextManager.capture().resource,
      context: const MonitorContext(
        missing: true,
        missingReason: ContextMissingReasons.sdkBootstrapIncomplete,
      ),
      payload: payload,
    );
    final filtered = _privacyFilter.filterEnvelope(event);
    if (dispatch) {
      _dispatch(filtered);
    }
  }
}
