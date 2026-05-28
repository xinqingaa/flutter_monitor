import 'package:flutter/services.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_native/flutter_monitor_native.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const methodChannel = MethodChannel('test/flutter_monitor_native/methods');
  const eventChannel = EventChannel('test/flutter_monitor_native/events');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(methodChannel, (call) async {
          return switch (call.method) {
            'getResourceSnapshot' => <String, Object?>{
              'available': true,
              'platform': 'android',
              'processId': 123,
              'bridgeVersion': '0.1.0',
              'signalSource': 'android',
            },
            'getMemorySnapshot' => <String, Object?>{
              'nativeUsedMb': 42,
              'pressureLevel': 'moderate',
              'sampleSource': 'native',
            },
            _ => null,
          };
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(methodChannel, null);
  });

  test('creates SDK native bridge from package entrypoint', () {
    final native = FlutterMonitorNative(
      methodChannel: methodChannel,
      eventChannel: eventChannel,
    );

    expect(native.corePackageName, 'flutter_monitor_core');
    expect(native.createBridge(), isA<MonitorNativeBridge>());
  });

  test(
    'reads native resource and memory snapshots from method channel',
    () async {
      final bridge = FlutterMonitorNativeBridge(
        methodChannel: methodChannel,
        eventChannel: eventChannel,
      );

      final resource = await bridge.getResourceSnapshot();
      final memory = await bridge.getMemorySnapshot();

      expect(resource.available, isTrue);
      expect(resource.platform, 'android');
      expect(resource.processId, 123);
      expect(resource.bridgeVersion, '0.1.0');
      expect(resource.signalSource, PlatformSignalSources.android);
      expect(memory?.nativeUsedMb, 42);
      expect(memory?.pressureLevel, MemoryPressureLevel.moderate);
      expect(memory?.sampleSource, MemorySampleSource.native);
    },
  );
}
