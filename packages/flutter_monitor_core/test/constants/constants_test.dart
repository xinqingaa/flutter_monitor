import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('exposes core constants', () {
    expect(flutterMonitorCorePackageName, 'flutter_monitor_core');
    expect(flutterMonitorSchemaVersion, '1.0');
    expect(defaultBreadcrumbLimit, 50);
  });

  test('exposes canonical field paths', () {
    expect(FieldPaths.contextRouteName, 'context.route.name');
    expect(FieldPaths.resourceDeviceDeviceTier, 'resource.device.deviceTier');
    expect(FieldPaths.memoryRssMb, 'memory.rss_mb');
    expect(FieldPaths.memoryPressureLevel, 'memory.pressure_level');
    expect(FieldPaths.nativeSignal, 'native.signal');
    expect(FieldPaths.authToken, 'auth.token');
  });

  test('exposes canonical event names for memory lifecycle and native', () {
    expect(EventNames.memorySample, 'memory.sample');
    expect(EventNames.memoryLeakSuspect, 'memory.leak.suspect');
    expect(EventNames.nativeMemorySample, 'native.memory.sample');
    expect(EventNames.nativeCrash, 'native.crash');
    expect(EventNames.appForegroundDuration, 'app.foreground_duration');
    expect(EventNames.sdkLifecycleFlush, 'sdk.lifecycle.flush');
  });

  test('exposes stable wire values for memory and native protocol enums', () {
    expect(MemorySampleSource.dart.toJson(), 'dart');
    expect(MemorySampleSource.native.toJson(), 'native');
    expect(MemorySampleSource.fromJson('system'), MemorySampleSource.system);
    expect(MemorySampleSource.fromJson('bad'), MemorySampleSource.unknown);

    expect(MemoryPressureLevel.none.toJson(), 'none');
    expect(MemoryPressureLevel.critical.toJson(), 'critical');
    expect(
      MemoryPressureLevel.fromJson('moderate'),
      MemoryPressureLevel.moderate,
    );
    expect(MemoryPressureLevel.fromJson('bad'), MemoryPressureLevel.unknown);

    expect(NativeSignalType.memory.toJson(), 'memory');
    expect(NativeSignalType.lifecycle.toJson(), 'lifecycle');
    expect(NativeSignalType.fromJson('oom'), NativeSignalType.oom);
    expect(NativeSignalType.fromJson('bad'), NativeSignalType.memory);
  });
}
