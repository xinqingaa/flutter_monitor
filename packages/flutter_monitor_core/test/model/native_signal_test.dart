import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('round-trips native memory signal json', () {
    final timestamp = DateTime.parse('2026-05-28T12:00:00.000+08:00');
    final signal = NativeSignal(
      type: NativeSignalType.memory,
      name: EventNames.nativeMemoryPressure,
      timestamp: timestamp,
      level: EventLevel.warning,
      status: EventStatus.error,
      priority: EventPriority.high,
      resource: const NativeResourceSnapshot(
        platform: 'android',
        processId: 12345,
        bridgeVersion: '1.0.0',
        signalSource: 'android',
      ),
      memory: const NativeMemorySnapshot(
        rssMb: 420,
        nativeUsedMb: 128,
        pressureLevel: MemoryPressureLevel.critical,
      ),
      attributes: const <String, Object?>{'source': 'low_memory_warning'},
      payload: const <String, Object?>{'reason': 'trim_memory_complete'},
    );

    final json = signal.toJson();
    final parsed = NativeSignal.fromJson(json);

    expect(json['type'], 'memory');
    expect(json['name'], 'native.memory.pressure');
    expect(parsed.type, NativeSignalType.memory);
    expect(parsed.priority, EventPriority.high);
    expect(parsed.resource?.platform, 'android');
    expect(parsed.resource?.processId, 12345);
    expect(parsed.memory?.sampleSource, MemorySampleSource.native);
    expect(parsed.memory?.pressureLevel, MemoryPressureLevel.critical);
    expect(parsed.memory?.nativeUsedMb, 128);
    expect(parsed.payload['reason'], 'trim_memory_complete');
  });

  test('round-trips native exceptional signal json', () {
    final timestamp = DateTime.parse('2026-05-28T12:00:00.000+08:00');
    final signal = NativeSignal(
      type: NativeSignalType.anr,
      name: EventNames.nativeAnr,
      timestamp: timestamp,
      level: EventLevel.fatal,
      status: EventStatus.error,
      priority: EventPriority.critical,
      anrDurationMs: 6000,
      thread: 'main',
      threadId: '1',
      contextMissing: true,
      contextMissingReason: ContextMissingReasons.nativeBridgeUnavailable,
      payload: const <String, Object?>{
        FieldPaths.payloadNative: <String, Object?>{
          'source': 'fake_anr_detector',
        },
      },
    );

    final parsed = NativeSignal.fromJson(signal.toJson());

    expect(parsed.type, NativeSignalType.anr);
    expect(parsed.name, 'native.anr');
    expect(parsed.priority, EventPriority.critical);
    expect(parsed.anrDurationMs, 6000);
    expect(parsed.thread, 'main');
    expect(parsed.contextMissing, isTrue);
    expect(
      parsed.contextMissingReason,
      ContextMissingReasons.nativeBridgeUnavailable,
    );
  });
}
