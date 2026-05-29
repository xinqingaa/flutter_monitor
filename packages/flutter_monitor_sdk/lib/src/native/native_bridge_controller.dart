import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';

class NativeBridgeController {
  NativeBridgeController({
    required MonitorNativeBridge bridge,
    required Reporter reporter,
    Duration minSampleInterval = const Duration(seconds: 30),
  }) : _bridge = bridge,
       _reporter = reporter,
       _minSampleInterval = minSampleInterval;

  final MonitorNativeBridge _bridge;
  final Reporter _reporter;
  final Duration _minSampleInterval;
  StreamSubscription<NativeSignal>? _subscription;
  DateTime? _lastSampleAt;

  Future<void> init() async {
    _subscription = _bridge.signals.listen(
      _reporter.recordNativeSignal,
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('Error while reading native monitor signal: $error');
      },
    );
    await recordMemorySample(trigger: TriggerValues.sessionStart);
  }

  Future<void> recordMemorySample({
    required String trigger,
    bool force = false,
  }) async {
    final now = DateTime.now();
    if (!force &&
        _lastSampleAt != null &&
        now.difference(_lastSampleAt!) < _minSampleInterval) {
      return;
    }
    NativeMemorySnapshot? memory;
    try {
      memory = await _bridge.getMemorySnapshot();
    } catch (error) {
      debugPrint('Native memory snapshot unavailable: $error');
      return;
    }
    if (memory == null) return;
    _lastSampleAt = now;
    _reporter.recordNativeSignal(
      NativeSignal(
        type: NativeSignalType.memory,
        name: EventNames.nativeMemorySample,
        timestamp: now,
        resource: await _safeResourceSnapshot(),
        memory: memory,
        priority: EventPriority.normal,
        payload: <String, Object?>{
          PayloadKeys.trigger: trigger,
          ...memory.toJson(),
        },
      ),
    );
  }

  Future<void> dispose() async {
    await Future.wait(<Future<void>>[
      _subscription?.cancel() ?? Future<void>.value(),
      _bridge.dispose(),
    ]);
  }

  Future<NativeResourceSnapshot?> _safeResourceSnapshot() async {
    try {
      return _bridge.getResourceSnapshot();
    } catch (error) {
      debugPrint('Native resource snapshot unavailable: $error');
      return null;
    }
  }
}
