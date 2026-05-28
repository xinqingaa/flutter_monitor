import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';

class NativeBridgeController {
  NativeBridgeController({
    required MonitorNativeBridge bridge,
    required Reporter reporter,
  }) : _bridge = bridge,
       _reporter = reporter;

  final MonitorNativeBridge _bridge;
  final Reporter _reporter;
  StreamSubscription<NativeSignal>? _subscription;

  Future<void> init() async {
    await _reporter.updateNativeResource(_bridge);
    _subscription = _bridge.signals.listen(
      _reporter.recordNativeSignal,
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('Error while reading native monitor signal: $error');
      },
    );
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    await _bridge.dispose();
  }
}
