import 'package:flutter/widgets.dart';
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
      onResume: () => _onStateChanged('resumed'),
      onInactive: () => _onStateChanged('inactive'),
      onHide: () => _onStateChanged('hidden'),
      onPause: () => _onStateChanged('paused'),
      onDetach: () => _onStateChanged('detached'),
    );
  }

  void dispose() {
    _listener?.dispose();
    _listener = null;
  }
}
