import 'dart:async';

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
              'bridgeVersion': '2.0.0',
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
      expect(resource.bridgeVersion, '2.0.0');
      expect(resource.signalSource, PlatformSignalSources.android);
      expect(memory?.nativeUsedMb, 42);
      expect(memory?.pressureLevel, MemoryPressureLevel.moderate);
      expect(memory?.sampleSource, MemorySampleSource.native);
    },
  );

  test('maps native event channel payloads into NativeSignal', () async {
    final binaryMessenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    final events = StreamController<Object?>();
    binaryMessenger.setMockStreamHandler(
      eventChannel,
      MockStreamHandler.inline(
        onListen: (arguments, sink) {
          events.stream.listen(sink.success);
        },
      ),
    );
    addTearDown(() async {
      binaryMessenger.setMockStreamHandler(eventChannel, null);
      await events.close();
    });

    final bridge = FlutterMonitorNativeBridge(
      methodChannel: methodChannel,
      eventChannel: eventChannel,
    );
    final firstSignal = bridge.signals.first;

    events.add(<String, Object?>{
      'type': 'lifecycle',
      'name': EventNames.nativeLifecycle,
      'timestamp': '2026-05-28T19:30:00.000',
      'standardLifecycleState': LifecycleStates.resumed,
      'payload': <String, Object?>{
        'platform': 'ios',
        'notification': 'UIApplication.didBecomeActiveNotification',
        'applicationState': 'active',
        'rawState': 'active',
      },
    });

    final signal = await firstSignal;

    expect(signal.type, NativeSignalType.lifecycle);
    expect(signal.name, EventNames.nativeLifecycle);
    expect(
      signal.attributes[FieldPaths.contextLifecycleState],
      LifecycleStates.resumed,
    );
    expect(
      signal.payload['notification'],
      'UIApplication.didBecomeActiveNotification',
    );
    expect(signal.payload['rawState'], 'active');
  });
}
