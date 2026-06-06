import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// SDK 内部采集层传给 pipeline 的原始信号。
///
/// `RawSignal` 不是对外协议，也不会直接上报。采集器只描述“发生了什么”
/// 以及必要的时间、等级、trace/span、attributes/payload 覆盖信息；
/// [EventPipeline] 会再补齐 session、context、resource、breadcrumbs、
/// event id、schema 校验和隐私过滤，最终生成 `EventEnvelope`。
class RawSignal {
  const RawSignal({
    required this.source,
    required this.name,
    required this.signalType,
    required this.timestamp,
    this.startTime,
    this.endTime,
    this.durationMs,
    this.level,
    this.status,
    this.priority = EventPriority.normal,
    this.traceId,
    this.spanId,
    this.parentSpanId,
    this.includeBreadcrumbs,
    this.breadcrumbLimit,
    this.eventPhase,
    this.contextRouteName,
    this.contextRouteFullName,
    this.nativeContext,
    this.contextMissing,
    this.contextMissingReason,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  /// 信号来源，用于 SDK 自监控排查，例如 `sdk.http`、`sdk.track`。
  final String source;

  /// 事件名，例如 `http.client`、`page.visit`、业务 action。
  final String name;

  /// 信号类型，决定 envelope 的语义层级，例如 trace/span/error/breadcrumb。
  final SignalType signalType;

  /// 事件发生时间。
  final DateTime timestamp;

  /// 区间开始时间，trace/span 或 duration metric 使用。
  final DateTime? startTime;

  /// 区间结束时间，trace/span end 或 duration metric 使用。
  final DateTime? endTime;

  /// 区间耗时，单位毫秒。
  final num? durationMs;

  /// 事件等级。
  final EventLevel? level;

  /// 事件状态。
  final EventStatus? status;

  /// 事件优先级，用于队列、上报和服务端处理策略。
  final EventPriority priority;

  /// 指定 trace id；为空时 pipeline 使用当前 active trace。
  final String? traceId;

  /// 指定 span id。
  final String? spanId;

  /// 指定父 span id。
  final String? parentSpanId;

  /// 是否强制携带 breadcrumbs。
  final bool? includeBreadcrumbs;

  /// 覆盖默认 breadcrumb 数量。
  final int? breadcrumbLimit;

  /// 覆盖默认 event phase。
  final String? eventPhase;

  /// 覆盖当前 route name，适用于异步或 native 信号补上下文。
  final String? contextRouteName;

  /// 覆盖当前 route fullName。
  final String? contextRouteFullName;

  /// native 信号携带的 native runtime context 覆盖。
  final NativeResourceSnapshot? nativeContext;

  /// 覆盖 context.missing。
  final bool? contextMissing;

  /// 覆盖 context.missingReason，必须使用 core 中注册的固定值。
  final String? contextMissingReason;

  /// 可检索、可聚合的结构化字段。
  final Map<String, Object?> attributes;

  /// 事件详情字段，不作为默认主要索引。
  final Map<String, Object?> payload;
}
