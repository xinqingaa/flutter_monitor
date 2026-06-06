import 'package:flutter/widgets.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

/// lifecycle 状态变化回调。
///
/// 参数使用 core 协议中的 lifecycle 字符串，而不是 Flutter enum，便于 Reporter
/// 直接生成统一 lifecycle envelope。
typedef LifecycleStateHandler =
    Future<void> Function(String state, {DateTime? timestamp});

/// Flutter App 生命周期监听管理器。
///
/// 该类只负责把 `AppLifecycleListener` 的 resume/inactive/hide/pause/detach
/// 转换为 core 协议状态并交给 [LifecycleStateHandler]。session 切分、热启动 trace、
/// 后台 duration 和 flush 语义都在 MonitorBinding / Reporter 中处理。
class LifecycleManager {
  /// 创建 lifecycle manager。
  LifecycleManager({
    required MonitorSessionConfig config,
    required LifecycleStateHandler onStateChanged,
  }) : _config = config,
       _onStateChanged = onStateChanged;

  final MonitorSessionConfig _config;
  final LifecycleStateHandler _onStateChanged;
  AppLifecycleListener? _listener;

  /// 根据配置注册 lifecycle 监听。
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

  /// 移除 lifecycle 监听。
  void dispose() {
    _listener?.dispose();
    _listener = null;
  }
}
