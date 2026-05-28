import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('exposes the core package identity', () {
    expect(flutterMonitorCorePackageName, 'flutter_monitor_core');
  });

  test('exports core event model types', () {
    expect(SignalType.trace.toJson(), 'trace');
    expect(MonitorEventLevel.warning.toJson(), 'warning');
    expect(MonitorTrackResult.success.toJson(), 'success');
    expect(MemorySampleSource.native.toJson(), 'native');
    expect(MemoryPressureLevel.critical.toJson(), 'critical');
    expect(NativeSignalType.anr.toJson(), 'anr');
    expect(EventNames.nativeOom, 'native.oom');
    expect(SchemaVersion.current.toString(), '1.0');
  });
}
