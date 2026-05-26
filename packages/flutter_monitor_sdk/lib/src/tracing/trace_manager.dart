import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

class TraceManager {
  TraceManager({IdGenerator? idGenerator})
    : _idGenerator = idGenerator ?? IdGenerator();

  final IdGenerator _idGenerator;
  final Map<String, TraceRecord> _traces = <String, TraceRecord>{};
  final Map<String, SpanRecord> _spans = <String, SpanRecord>{};
  final List<String> _spanStack = <String>[];
  String? _activeTraceId;

  String? get activeTraceId => _activeTraceId;
  String? get activeSpanId => _spanStack.isEmpty ? null : _spanStack.last;

  bool hasTrace(String traceId) => _traces.containsKey(traceId);

  TraceRecord startTrace({
    required String name,
    DateTime? startTime,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = TraceRecord(
      traceId: _idGenerator.next('trace'),
      name: name,
      startTime: startTime ?? DateTime.now(),
      attributes: attributes,
      payload: payload,
    );
    _traces[record.traceId] = record;
    _activeTraceId = record.traceId;
    return record;
  }

  TraceRecord? endTrace(
    String traceId, {
    DateTime? endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _traces.remove(traceId);
    if (record == null) return null;
    if (_activeTraceId == traceId) {
      _activeTraceId = _traces.isEmpty ? null : _traces.keys.last;
    }
    return record.finish(
      endTime: endTime ?? DateTime.now(),
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
  }

  SpanRecord startSpan({
    required String name,
    String? traceId,
    String? parentSpanId,
    DateTime? startTime,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final effectiveTraceId =
        traceId ?? _activeTraceId ?? _idGenerator.next('trace');
    _activeTraceId = effectiveTraceId;
    final inferredParentSpanId =
        parentSpanId ?? _activeSpanIdForTrace(effectiveTraceId);
    final record = SpanRecord(
      traceId: effectiveTraceId,
      spanId: _idGenerator.next('span'),
      parentSpanId: inferredParentSpanId,
      name: name,
      startTime: startTime ?? DateTime.now(),
      attributes: attributes,
      payload: payload,
    );
    _spans[record.spanId] = record;
    _spanStack.add(record.spanId);
    return record;
  }

  SpanRecord? endSpan(
    String spanId, {
    DateTime? endTime,
    EventStatus status = EventStatus.ok,
    EventLevel level = EventLevel.info,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    final record = _spans.remove(spanId);
    if (record == null) return null;
    _spanStack.remove(spanId);
    return record.finish(
      endTime: endTime ?? DateTime.now(),
      status: status,
      level: level,
      attributes: attributes,
      payload: payload,
    );
  }

  void setActiveTrace({String? traceId, String? spanId, String? parentSpanId}) {
    _activeTraceId = traceId;
    _spanStack
      ..clear()
      ..addAll([
        if (parentSpanId != null) parentSpanId,
        if (spanId != null) spanId,
      ]);
  }

  TraceSnapshot capture({
    required String sessionId,
    required List breadcrumbs,
  }) {
    return TraceSnapshot(
      sessionId: sessionId,
      traceId: _activeTraceId,
      spanId: activeSpanId,
      parentSpanId: _parentSpanId,
      breadcrumbs: breadcrumbs.cast(),
    );
  }

  String? get _parentSpanId {
    if (_spanStack.length < 2) return null;
    return _spanStack[_spanStack.length - 2];
  }

  String? _activeSpanIdForTrace(String traceId) {
    if (_spanStack.isEmpty) return null;
    final active = _spans[_spanStack.last];
    if (active?.traceId != traceId) return null;
    return active?.spanId;
  }
}

class TraceRecord {
  const TraceRecord({
    required this.traceId,
    required this.name,
    required this.startTime,
    this.endTime,
    this.durationMs,
    this.status,
    this.level,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final String traceId;
  final String name;
  final DateTime startTime;
  final DateTime? endTime;
  final num? durationMs;
  final EventStatus? status;
  final EventLevel? level;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  TraceRecord finish({
    required DateTime endTime,
    required EventStatus status,
    required EventLevel level,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return TraceRecord(
      traceId: traceId,
      name: name,
      startTime: startTime,
      endTime: endTime,
      durationMs: endTime.difference(startTime).inMilliseconds,
      status: status,
      level: level,
      attributes: <String, Object?>{...this.attributes, ...attributes},
      payload: <String, Object?>{...this.payload, ...payload},
    );
  }
}

class SpanRecord {
  const SpanRecord({
    required this.traceId,
    required this.spanId,
    required this.name,
    required this.startTime,
    this.parentSpanId,
    this.endTime,
    this.durationMs,
    this.status,
    this.level,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final String traceId;
  final String spanId;
  final String? parentSpanId;
  final String name;
  final DateTime startTime;
  final DateTime? endTime;
  final num? durationMs;
  final EventStatus? status;
  final EventLevel? level;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  SpanRecord finish({
    required DateTime endTime,
    required EventStatus status,
    required EventLevel level,
    Map<String, Object?> attributes = const <String, Object?>{},
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return SpanRecord(
      traceId: traceId,
      spanId: spanId,
      parentSpanId: parentSpanId,
      name: name,
      startTime: startTime,
      endTime: endTime,
      durationMs: endTime.difference(startTime).inMilliseconds,
      status: status,
      level: level,
      attributes: <String, Object?>{...this.attributes, ...attributes},
      payload: <String, Object?>{...this.payload, ...payload},
    );
  }
}
