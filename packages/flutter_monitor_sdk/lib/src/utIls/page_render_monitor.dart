import 'package:flutter/material.dart';

import '../../flutter_monitor_sdk.dart';

/// 提供一个专用的 Widget 来标记页面渲染完成 接收一个pageName
class PageRenderMonitor extends StatefulWidget {
  final Widget child;
  final String pageName;

  const PageRenderMonitor({
    super.key,
    required this.child,
    required this.pageName,
  });

  @override
  State<PageRenderMonitor> createState() => _PageRenderMonitorState();
}

class _PageRenderMonitorState extends State<PageRenderMonitor> {
  @override
  void initState() {
    super.initState();
    // 在下一帧绘制完成后执行回调
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // 检查 widget 是否还在树上
      if (mounted) {
        MonitorBinding.instance.performanceMonitor.routeObserver.onPageRendered(widget.pageName);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
