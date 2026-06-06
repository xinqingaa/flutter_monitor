import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

/// 将 [RawSignal]、context 快照和 trace 快照合成为 `EventEnvelope`。
///
/// Builder 只负责纯粹的数据组装：生成 event id、推导 event phase、合并 context
/// override、筛选已注册 attributes，并把未注册 attributes 降级放入 payload。
/// schema 校验、隐私过滤和 output 分发由 [EventPipeline] 负责。
class EnvelopeBuilder {
  EnvelopeBuilder({FieldRegistry? registry, IdGenerator? idGenerator})
    : _registry = registry ?? FieldRegistry.defaults(),
      _idGenerator = idGenerator ?? IdGenerator();

  final FieldRegistry _registry;
  final IdGenerator _idGenerator;

  /// 构建单个 envelope。
  ///
  /// [signal] 是采集器提供的事实，[contextSnapshot] 是事件发生时的上下文，
  /// [traceSnapshot] 提供 session/trace/span 和 breadcrumbs。
  EventEnvelope build({
    required RawSignal signal,
    required ContextSnapshot contextSnapshot,
    required TraceSnapshot traceSnapshot,
  }) {
    final attributes = <String, Object?>{
      FieldPaths.eventPhase: signal.eventPhase ?? _defaultEventPhase(signal),
      ...signal.attributes,
    };
    final unregisteredAttributes = _unregisteredAttributes(attributes);
    final breadcrumbLimit = defaultBreadcrumbLimit(signal);
    final payload = <String, Object?>{
      ...signal.payload,
      if (unregisteredAttributes.isNotEmpty)
        PayloadKeys.unregisteredAttributes: unregisteredAttributes,
      if (breadcrumbLimit != null &&
          breadcrumbLimit > 0 &&
          traceSnapshot.breadcrumbs.isNotEmpty)
        FieldPaths.payloadBreadcrumbs: traceSnapshot.breadcrumbs
            .map((breadcrumb) => breadcrumb.toJson())
            .toList(growable: false),
    };

    return EventEnvelope(
      eventId: _idGenerator.next('evt'),
      timestamp: signal.timestamp,
      startTime: signal.startTime,
      endTime: signal.endTime,
      durationMs: signal.durationMs,
      signalType: signal.signalType,
      name: signal.name,
      level: signal.level,
      status: signal.status,
      priority: signal.priority,
      sessionId: traceSnapshot.sessionId,
      traceId: traceSnapshot.traceId,
      spanId: traceSnapshot.spanId,
      parentSpanId: traceSnapshot.parentSpanId,
      resource: contextSnapshot.resource,
      context: _mergeContext(contextSnapshot.context, signal),
      attributes: _registeredAttributes(attributes),
      payload: payload,
    );
  }

  /// 合并 pipeline 捕获到的全局 context 与信号级 context override。
  ///
  /// 大多数 Flutter 信号直接使用全局 context；native 或异步信号可通过
  /// [RawSignal] 覆盖 route、native runtime 或 context missing 信息。
  MonitorContext _mergeContext(MonitorContext context, RawSignal signal) {
    if (signal.nativeContext == null &&
        signal.contextRouteName == null &&
        signal.contextRouteFullName == null &&
        signal.contextMissing == null &&
        signal.contextMissingReason == null) {
      return context;
    }
    final nativeSnapshot = signal.nativeContext;
    final routeOverride =
        signal.contextRouteName != null || signal.contextRouteFullName != null;
    final routeName = signal.contextRouteName ?? context.route?.name;
    final routeFullName =
        signal.contextRouteFullName ??
        (signal.contextRouteName == null ? context.route?.fullName : routeName);
    return MonitorContext(
      user: context.user,
      route: !routeOverride
          ? context.route
          : RouteContext(
              name: routeName,
              fullName: routeFullName,
              stack: routeFullName == null
                  ? context.route?.stack
                  : <String>[routeFullName],
              source: context.route?.source,
            ),
      module: context.module,
      network: context.network,
      release: context.release,
      lifecycle: context.lifecycle,
      native: nativeSnapshot == null
          ? context.native
          : NativeRuntimeContext(
              available: nativeSnapshot.available,
              platform: nativeSnapshot.platform ?? context.native?.platform,
              processId: nativeSnapshot.processId,
              bridgeVersion: nativeSnapshot.bridgeVersion,
              signalSource:
                  nativeSnapshot.signalSource ??
                  context.native?.signalSource ??
                  PlatformSignalSources.native,
            ),
      missing: signal.contextMissing ?? context.missing,
      missingReason: signal.contextMissingReason ?? context.missingReason,
    );
  }

  /// 根据 signal 类型推导默认 event phase。
  ///
  /// trace/span 没有 endTime 时视为 start，带 endTime 时视为 end；
  /// 其他信号默认为 instant。
  String _defaultEventPhase(RawSignal signal) {
    return switch (signal.signalType) {
      SignalType.trace || SignalType.span =>
        signal.endTime == null ? EventPhases.start : EventPhases.end,
      _ => EventPhases.instant,
    };
  }

  /// 计算该信号默认应携带多少条 breadcrumbs。
  ///
  /// 错误、卡顿、失败 HTTP、异常 metric 会自动带近期 breadcrumbs；
  /// 普通成功事件默认不携带，避免 payload 过大。
  int? defaultBreadcrumbLimit(RawSignal signal) {
    if (signal.includeBreadcrumbs == false) return null;
    if (signal.breadcrumbLimit != null) return signal.breadcrumbLimit;
    final defaultLimit = switch (signal.signalType) {
      SignalType.error => 8,
      SignalType.metric when signal.name == EventNames.uiJankSequence => 5,
      SignalType.span
          when signal.name == EventNames.httpClient &&
              signal.status == EventStatus.error =>
        3,
      SignalType.metric when signal.status == EventStatus.error => 3,
      _ => null,
    };
    if (defaultLimit != null) return defaultLimit;
    if (signal.includeBreadcrumbs == true) return 8;
    return null;
  }

  Map<String, Object?> _registeredAttributes(Map<String, Object?> attributes) {
    final result = <String, Object?>{};
    for (final entry in attributes.entries) {
      if (_registry.contains(entry.key)) {
        result[entry.key] = entry.value;
      }
    }
    return result;
  }

  Map<String, Object?> _unregisteredAttributes(
    Map<String, Object?> attributes,
  ) {
    final result = <String, Object?>{};
    for (final entry in attributes.entries) {
      if (!_registry.contains(entry.key)) {
        result[entry.key] = entry.value;
      }
    }
    return result;
  }
}
