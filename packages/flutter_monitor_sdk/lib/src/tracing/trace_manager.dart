import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

/// trace/span 运行时状态管理器。
///
/// Reporter 通过该类维护当前 active trace、span 栈和未闭合记录。它不直接发事件，
/// 只返回 [TraceRecord] / [SpanRecord]，由 Reporter 转为 RawSignal 后进入 pipeline。
class TraceManager {
  /// 创建 trace manager。
  TraceManager({IdGenerator? idGenerator})
    : _idGenerator = idGenerator ?? IdGenerator();

  final IdGenerator _idGenerator;
  final Map<String, TraceRecord> _traces = <String, TraceRecord>{};
  final Map<String, SpanRecord> _spans = <String, SpanRecord>{};
  final List<String> _spanStack = <String>[];
  String? _activeTraceId;

  /// 当前 active trace id。
  String? get activeTraceId => _activeTraceId;

  /// 当前 active span id，即 span 栈顶。
  String? get activeSpanId => _spanStack.isEmpty ? null : _spanStack.last;

  /// 判断指定 trace 是否仍处于打开状态。
  bool hasTrace(String traceId) => _traces.containsKey(traceId);

  /// 读取指定 trace 的当前记录。
  TraceRecord? trace(String traceId) => _traces[traceId];

  /// 开启一个 trace，并将其设为 active trace。
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

  /// 结束一个 trace，并返回带结束时间、耗时、状态和等级的完成记录。
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

  /// 开启一个 span。
  ///
  /// 未显式指定 trace 时会挂到 active trace；未指定 parent span 时会使用同 trace 的
  /// 当前 span 栈顶作为父级。
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

  /// 结束一个 span，并从 span 栈中移除。
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

  /// 手动设置当前 active trace/span。
  ///
  /// 页面恢复、异步链路或测试需要重新建立当前上下文时使用。
  void setActiveTrace({String? traceId, String? spanId, String? parentSpanId}) {
    _activeTraceId = traceId;
    _spanStack
      ..clear()
      ..addAll([
        if (parentSpanId != null) parentSpanId,
        if (spanId != null) spanId,
      ]);
  }

  /// 捕获当前 trace/span 快照。
  ///
  /// pipeline 会把该快照写入 envelope 的 session/trace/span 字段。
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

/// 一个未闭合或已完成的 trace 记录。
///
/// trace 表示可追踪流程，例如冷启动、热启动、页面访问或业务流程。记录完成后，
/// Reporter 会把它转换为 `signalType = trace` 的 envelope。
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

  /// trace id。
  final String traceId;

  /// trace 名称，例如 `app.cold_start`、`page.visit`。
  final String name;

  /// trace 开始时间。
  final DateTime startTime;

  /// trace 结束时间；未结束时为空。
  final DateTime? endTime;

  /// trace 耗时，单位毫秒。
  final num? durationMs;

  /// 完成状态。
  final EventStatus? status;

  /// 事件等级。
  final EventLevel? level;

  /// trace attributes。
  final Map<String, Object?> attributes;

  /// trace payload。
  final Map<String, Object?> payload;

  /// 生成 trace 完成记录。
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

/// 一个未闭合或已完成的 span 记录。
///
/// span 表示 trace 中的阶段，例如 `sdk.init`、`page.load`、`http.client`。
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

  /// 所属 trace id。
  final String traceId;

  /// span id。
  final String spanId;

  /// 父 span id。
  final String? parentSpanId;

  /// span 名称。
  final String name;

  /// span 开始时间。
  final DateTime startTime;

  /// span 结束时间；未结束时为空。
  final DateTime? endTime;

  /// span 耗时，单位毫秒。
  final num? durationMs;

  /// 完成状态。
  final EventStatus? status;

  /// 事件等级。
  final EventLevel? level;

  /// span attributes。
  final Map<String, Object?> attributes;

  /// span payload。
  final Map<String, Object?> payload;

  /// 生成 span 完成记录。
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
