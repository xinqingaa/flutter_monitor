import 'package:flutter_monitor_native/flutter_monitor_native.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('can be constructed without native platform registration', () {
    const native = FlutterMonitorNative();

    expect(native.corePackageName, 'flutter_monitor_core');
  });
}
