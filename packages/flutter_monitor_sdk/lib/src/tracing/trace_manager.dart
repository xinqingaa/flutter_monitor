import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';

class TraceManager {
  String? _activeTraceId;
  String? _activeSpanId;
  String? _activeParentSpanId;

  void setActiveTrace({String? traceId, String? spanId, String? parentSpanId}) {
    _activeTraceId = traceId;
    _activeSpanId = spanId;
    _activeParentSpanId = parentSpanId;
  }

  TraceSnapshot capture({
    required String sessionId,
    required List breadcrumbs,
  }) {
    return TraceSnapshot(
      sessionId: sessionId,
      traceId: _activeTraceId,
      spanId: _activeSpanId,
      parentSpanId: _activeParentSpanId,
      breadcrumbs: breadcrumbs.cast(),
    );
  }
}
