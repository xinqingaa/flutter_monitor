import 'package:flutter/widgets.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

typedef LifecycleStateHandler =
    Future<void> Function(String state, {DateTime? timestamp});

class LifecycleManager {
  LifecycleManager({
    required MonitorSessionConfig config,
    required LifecycleStateHandler onStateChanged,
  }) : _config = config,
       _onStateChanged = onStateChanged;

  final MonitorSessionConfig _config;
  final LifecycleStateHandler _onStateChanged;
  AppLifecycleListener? _listener;

  void init() {
    if (!_config.enableLifecycleTracking) return;
    _listener = AppLifecycleListener(
      onResume: () => _onStateChanged(LifecycleStates.resumed),
      onInactive: () => _onStateChanged(LifecycleStates.inactive),
      onHide: () => _onStateChanged(LifecycleStates.hidden),
      onPause: () => _onStateChanged(LifecycleStates.paused),
      onDetach: () => _onStateChanged(LifecycleStates.detached),
    );
  }

  void dispose() {
    _listener?.dispose();
    _listener = null;
  }
}
