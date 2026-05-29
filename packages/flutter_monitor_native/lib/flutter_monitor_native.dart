library;

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class FlutterMonitorNative {
  FlutterMonitorNative({
    MethodChannel? methodChannel,
    EventChannel? eventChannel,
  }) : _methodChannel =
           methodChannel ??
           const MethodChannel('flutter_monitor_native/methods'),
       _eventChannel =
           eventChannel ?? const EventChannel('flutter_monitor_native/events');

  final MethodChannel _methodChannel;
  final EventChannel _eventChannel;

  String get corePackageName => flutterMonitorCorePackageName;

  MonitorNativeBridge createBridge() {
    return FlutterMonitorNativeBridge(
      methodChannel: _methodChannel,
      eventChannel: _eventChannel,
    );
  }
}

class FlutterMonitorNativeBridge implements MonitorNativeBridge {
  FlutterMonitorNativeBridge({
    MethodChannel? methodChannel,
    EventChannel? eventChannel,
  }) : _methodChannel =
           methodChannel ??
           const MethodChannel('flutter_monitor_native/methods'),
       _eventChannel =
           eventChannel ?? const EventChannel('flutter_monitor_native/events');

  final MethodChannel _methodChannel;
  final EventChannel _eventChannel;
  Stream<NativeSignal>? _signals;

  @override
  Stream<NativeSignal> get signals {
    return _signals ??= _eventChannel
        .receiveBroadcastStream()
        .where((event) => event is Map)
        .map((event) => NativeSignal.fromJson(_normalizeNativeEvent(event)));
  }

  @override
  Future<NativeResourceSnapshot> getResourceSnapshot() async {
    final result = await _methodChannel.invokeMapMethod<String, Object?>(
      'getResourceSnapshot',
    );
    if (result == null) {
      return const NativeResourceSnapshot(
        available: false,
        signalSource: PlatformSignalSources.unknown,
      );
    }
    return NativeResourceSnapshot.fromJson(result);
  }

  @override
  Future<NativeMemorySnapshot?> getMemorySnapshot() async {
    final result = await _methodChannel.invokeMapMethod<String, Object?>(
      'getMemorySnapshot',
    );
    if (result == null) return null;
    return NativeMemorySnapshot.fromJson(result);
  }

  @override
  Future<void> dispose() async {}
}

Map<String, Object?> _objectMap(Object? value) {
  if (value is! Map) return <String, Object?>{};
  return Map<String, Object?>.fromEntries(
    value.entries.map((entry) => MapEntry(entry.key.toString(), entry.value)),
  );
}

Map<String, Object?> _normalizeNativeEvent(Object? event) {
  final json = _objectMap(event);
  final standardLifecycleState = json.remove('standardLifecycleState');
  if (standardLifecycleState == null) return json;

  final attributes = _objectMap(json['attributes']);
  attributes[FieldPaths.contextLifecycleState] = standardLifecycleState;
  json['attributes'] = attributes;
  return json;
}
