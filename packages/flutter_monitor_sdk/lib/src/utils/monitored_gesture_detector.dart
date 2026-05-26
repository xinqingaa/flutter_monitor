import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';

class MonitoredGestureDetector extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final String identifier; // 点击事件的唯一标识

  const MonitoredGestureDetector({
    super.key,
    required this.child,
    this.onTap,
    required this.identifier,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        // 通过 MonitorBinding 获取 BehaviorMonitor 并上报
        MonitorBinding.instance.behaviorMonitor.reportClick(identifier: identifier);
        // 执行原始的回调
        onTap?.call();
      },
      child: child,
    );
  }
}
