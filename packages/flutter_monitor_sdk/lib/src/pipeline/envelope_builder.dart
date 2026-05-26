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
    final unregisteredAttributes = _unregisteredAttributes(signal.attributes);
    final payload = <String, Object?>{
      ...signal.payload,
      if (unregisteredAttributes.isNotEmpty)
        'unregistered.attributes': unregisteredAttributes,
      if (contextSnapshot.customData?.isNotEmpty ?? false)
        'legacy.customData': contextSnapshot.customData,
      if (contextSnapshot.userProperties?.isNotEmpty ?? false)
        'legacy.userProperties': contextSnapshot.userProperties,
      if (traceSnapshot.breadcrumbs.isNotEmpty)
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
      attributes: _registeredAttributes(signal.attributes),
      payload: payload,
    );
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
