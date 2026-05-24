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
}
