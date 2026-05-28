import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';
import 'package:flutter_monitor_sdk/src/tracing/trace_snapshot.dart';
import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

class EnvelopeBuilder {
  EnvelopeBuilder({FieldRegistry? registry, IdGenerator? idGenerator})
    : _registry = registry ?? FieldRegistry.defaults(),
      _idGenerator = idGenerator ?? IdGenerator();

  final FieldRegistry _registry;
  final IdGenerator _idGenerator;

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

  MonitorContext _mergeContext(MonitorContext context, RawSignal signal) {
    if (signal.nativeContext == null &&
        signal.contextMissing == null &&
        signal.contextMissingReason == null) {
      return context;
    }
    final nativeSnapshot = signal.nativeContext;
    return MonitorContext(
      user: context.user,
      route: context.route,
      module: context.module,
      network: context.network,
      release: context.release,
      lifecycle: context.lifecycle,
      native:
          nativeSnapshot == null
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

  String _defaultEventPhase(RawSignal signal) {
    return switch (signal.signalType) {
      SignalType.trace ||
      SignalType.span => signal.endTime == null ? 'start' : 'end',
      _ => 'instant',
    };
  }

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
