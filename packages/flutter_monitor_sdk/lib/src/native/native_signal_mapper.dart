import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';

class NativeSignalMapper {
  const NativeSignalMapper();

  RawSignal map(NativeSignal signal) {
    return RawSignal(
      source: SignalSources.sdkNative,
      name: signal.name,
      signalType: _signalType(signal),
      timestamp: signal.timestamp,
      level: signal.level ?? _level(signal),
      status: signal.status ?? _status(signal),
      priority: _priority(signal),
      breadcrumbLimit: _breadcrumbLimit(signal),
      nativeContext: signal.resource,
      contextMissing: signal.contextMissing,
      contextMissingReason: signal.contextMissingReason,
      attributes: <String, Object?>{
        FieldPaths.nativeSignal: signal.type.toJson(),
        if (signal.thread != null) FieldPaths.nativeThread: signal.thread,
        if (signal.threadId != null) FieldPaths.nativeThreadId: signal.threadId,
        if (signal.crashType != null)
          FieldPaths.nativeCrashType: signal.crashType,
        if (signal.anrDurationMs != null)
          FieldPaths.nativeAnrDurationMs: signal.anrDurationMs,
        if (signal.oomReason != null)
          FieldPaths.nativeOomReason: signal.oomReason,
        if (_isNativeError(signal)) FieldPaths.errorMechanism: 'native',
        if (_isNativeError(signal)) FieldPaths.errorHandled: false,
        if (_isNativeError(signal)) FieldPaths.errorFatal: true,
        ..._memoryAttributes(signal.memory),
        ...signal.attributes,
      },
      payload: <String, Object?>{
        PayloadKeys.trigger: TriggerValues.nativeBridge,
        if (signal.payload.isNotEmpty) FieldPaths.payloadNative: signal.payload,
      },
    );
  }

  SignalType _signalType(NativeSignal signal) {
    if (_isNativeError(signal)) return SignalType.error;
    if (signal.type == NativeSignalType.lifecycle ||
        signal.name == EventNames.nativeWarning) {
      return SignalType.breadcrumb;
    }
    return SignalType.metric;
  }

  EventLevel _level(NativeSignal signal) {
    if (_isNativeError(signal)) return EventLevel.fatal;
    if (signal.name == EventNames.nativeWarning) return EventLevel.warning;
    if (signal.name == EventNames.nativeMemoryPressure &&
        signal.memory?.pressureLevel == MemoryPressureLevel.critical) {
      return EventLevel.error;
    }
    if (signal.name == EventNames.nativeMemoryPressure) {
      return EventLevel.warning;
    }
    return EventLevel.info;
  }

  EventStatus _status(NativeSignal signal) {
    if (_isNativeError(signal)) return EventStatus.error;
    if (signal.name == EventNames.nativeMemoryPressure &&
        signal.memory?.pressureLevel != MemoryPressureLevel.none) {
      return EventStatus.error;
    }
    return EventStatus.ok;
  }

  EventPriority _priority(NativeSignal signal) {
    if (_isNativeError(signal)) return EventPriority.critical;
    if (signal.name == EventNames.nativeMemoryPressure ||
        signal.name == EventNames.nativeWarning) {
      return EventPriority.high;
    }
    return signal.priority;
  }

  int? _breadcrumbLimit(NativeSignal signal) {
    if (_isNativeError(signal)) return 8;
    if (signal.name == EventNames.nativeMemoryPressure ||
        signal.name == EventNames.nativeWarning) {
      return 5;
    }
    return null;
  }

  bool _isNativeError(NativeSignal signal) {
    return signal.type == NativeSignalType.crash ||
        signal.type == NativeSignalType.oom ||
        signal.type == NativeSignalType.anr;
  }

  Map<String, Object?> _memoryAttributes(NativeMemorySnapshot? memory) {
    if (memory == null) return const <String, Object?>{};
    return <String, Object?>{
      FieldPaths.memorySampleSource: memory.sampleSource.toJson(),
      if (memory.rssMb != null) FieldPaths.memoryRssMb: memory.rssMb,
      if (memory.heapUsedMb != null)
        FieldPaths.memoryHeapUsedMb: memory.heapUsedMb,
      if (memory.heapCapacityMb != null)
        FieldPaths.memoryHeapCapacityMb: memory.heapCapacityMb,
      if (memory.externalMb != null)
        FieldPaths.memoryExternalMb: memory.externalMb,
      if (memory.nativeUsedMb != null)
        FieldPaths.memoryNativeUsedMb: memory.nativeUsedMb,
      if (memory.pressureLevel != null)
        FieldPaths.memoryPressureLevel: memory.pressureLevel!.toJson(),
    };
  }
}
