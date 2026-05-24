import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('exposes the core package identity', () {
    expect(flutterMonitorCorePackageName, 'flutter_monitor_core');
  });

  test('exports core event model types', () {
    expect(SignalType.trace.toJson(), 'trace');
    expect(SchemaVersion.current.toString(), '1.0');
  });
}
