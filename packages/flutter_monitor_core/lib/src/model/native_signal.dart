import 'event_level.dart';
import 'event_priority.dart';
import 'event_status.dart';
import 'json_utils.dart';
import 'memory_pressure_level.dart';
import 'memory_sample_source.dart';
import 'native_signal_type.dart';

class NativeResourceSnapshot {
  const NativeResourceSnapshot({
    this.available = true,
    this.platform,
    this.processId,
    this.bridgeVersion,
    this.signalSource,
  });

  final bool available;
  final String? platform;
  final num? processId;
  final String? bridgeVersion;
  final String? signalSource;

  factory NativeResourceSnapshot.fromJson(Map<String, Object?> json) {
    return NativeResourceSnapshot(
      available: json['available'] as bool? ?? true,
      platform: json['platform'] as String?,
      processId: json['processId'] as num?,
      bridgeVersion: json['bridgeVersion'] as String?,
      signalSource: json['signalSource'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'available': available,
    'platform': platform,
    'processId': processId,
    'bridgeVersion': bridgeVersion,
    'signalSource': signalSource,
  });
}

class NativeMemorySnapshot {
  const NativeMemorySnapshot({
    this.rssMb,
    this.heapUsedMb,
    this.heapCapacityMb,
    this.externalMb,
    this.nativeUsedMb,
    this.pressureLevel,
    this.sampleSource = MemorySampleSource.native,
  });

  final num? rssMb;
  final num? heapUsedMb;
  final num? heapCapacityMb;
  final num? externalMb;
  final num? nativeUsedMb;
  final MemoryPressureLevel? pressureLevel;
  final MemorySampleSource sampleSource;

  factory NativeMemorySnapshot.fromJson(Map<String, Object?> json) {
    return NativeMemorySnapshot(
      rssMb: json['rssMb'] as num?,
      heapUsedMb: json['heapUsedMb'] as num?,
      heapCapacityMb: json['heapCapacityMb'] as num?,
      externalMb: json['externalMb'] as num?,
      nativeUsedMb: json['nativeUsedMb'] as num?,
      pressureLevel: json.containsKey('pressureLevel')
          ? MemoryPressureLevel.fromJson(json['pressureLevel'])
          : null,
      sampleSource: MemorySampleSource.fromJson(json['sampleSource']),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'rssMb': rssMb,
    'heapUsedMb': heapUsedMb,
    'heapCapacityMb': heapCapacityMb,
    'externalMb': externalMb,
    'nativeUsedMb': nativeUsedMb,
    'pressureLevel': pressureLevel?.toJson(),
    'sampleSource': sampleSource.toJson(),
  });
}

class NativeSignal {
  const NativeSignal({
    required this.type,
    required this.name,
    required this.timestamp,
    this.level,
    this.status,
    this.priority = EventPriority.normal,
    this.resource,
    this.memory,
    this.thread,
    this.threadId,
    this.crashType,
    this.anrDurationMs,
    this.oomReason,
    this.contextMissing,
    this.contextMissingReason,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final NativeSignalType type;
  final String name;
  final DateTime timestamp;
  final EventLevel? level;
  final EventStatus? status;
  final EventPriority priority;
  final NativeResourceSnapshot? resource;
  final NativeMemorySnapshot? memory;
  final String? thread;
  final String? threadId;
  final String? crashType;
  final num? anrDurationMs;
  final String? oomReason;
  final bool? contextMissing;
  final String? contextMissingReason;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;

  factory NativeSignal.fromJson(Map<String, Object?> json) {
    return NativeSignal(
      type: NativeSignalType.fromJson(json['type']),
      name: json['name'] as String? ?? '',
      timestamp:
          dateTimeFromJson(json['timestamp']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      level: json.containsKey('level')
          ? EventLevel.fromJson(json['level'])
          : null,
      status: json.containsKey('status')
          ? EventStatus.fromJson(json['status'])
          : null,
      priority: EventPriority.fromJson(json['priority']),
      resource: json['resource'] is Map
          ? NativeResourceSnapshot.fromJson(objectMap(json['resource']))
          : null,
      memory: json['memory'] is Map
          ? NativeMemorySnapshot.fromJson(objectMap(json['memory']))
          : null,
      thread: json['thread'] as String?,
      threadId: json['threadId'] as String?,
      crashType: json['crashType'] as String?,
      anrDurationMs: json['anrDurationMs'] as num?,
      oomReason: json['oomReason'] as String?,
      contextMissing: json['contextMissing'] as bool?,
      contextMissingReason: json['contextMissingReason'] as String?,
      attributes: objectMap(json['attributes']),
      payload: objectMap(json['payload']),
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'type': type.toJson(),
    'name': name,
    'timestamp': timestamp.toIso8601String(),
    'level': level?.toJson(),
    'status': status?.toJson(),
    'priority': priority.toJson(),
    'resource': resource?.toJson(),
    'memory': memory?.toJson(),
    'thread': thread,
    'threadId': threadId,
    'crashType': crashType,
    'anrDurationMs': anrDurationMs,
    'oomReason': oomReason,
    'contextMissing': contextMissing,
    'contextMissingReason': contextMissingReason,
    'attributes': attributes,
    'payload': payload,
  });
}
