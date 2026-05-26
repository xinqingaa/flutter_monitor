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
    final includeBreadcrumbs =
        signal.includeBreadcrumbs ?? _defaultIncludeBreadcrumbs(signal);
    final payload = <String, Object?>{
      ...signal.payload,
      if (unregisteredAttributes.isNotEmpty)
        'unregistered.attributes': unregisteredAttributes,
      if (contextSnapshot.customData?.isNotEmpty ?? false)
        'legacy.customData': contextSnapshot.customData,
      if (contextSnapshot.userProperties?.isNotEmpty ?? false)
        'legacy.userProperties': contextSnapshot.userProperties,
      if (includeBreadcrumbs && traceSnapshot.breadcrumbs.isNotEmpty)
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
      context: contextSnapshot.context,
      attributes: _registeredAttributes(attributes),
      payload: payload,
    );
  }

  String _defaultEventPhase(RawSignal signal) {
    return switch (signal.signalType) {
      SignalType.trace ||
      SignalType.span => signal.endTime == null ? 'start' : 'end',
      _ => 'instant',
    };
  }

  bool _defaultIncludeBreadcrumbs(RawSignal signal) {
    return switch (signal.signalType) {
      SignalType.error => true,
      SignalType.trace || SignalType.span => signal.endTime != null,
      SignalType.metric => signal.status == EventStatus.error,
      _ => false,
    };
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
