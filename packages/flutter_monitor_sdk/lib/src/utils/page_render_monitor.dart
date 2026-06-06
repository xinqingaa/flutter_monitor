import 'package:flutter/material.dart';

import '../../flutter_monitor_sdk.dart';

/// 用 Widget 形式标记页面首帧或关键内容渲染完成。
///
/// 将业务页面包在 [PageRenderMonitor] 中后，它会在下一帧回调
/// `FlutterMonitorSDK.markPageRendered(pageName)`，用于闭合页面 load span。
///
/// 页面进入、离开和 route context 仍然由 `FlutterMonitorSDK.routeObserver`
/// 负责；本组件只负责补充“页面已渲染”的时机。
class PageRenderMonitor extends StatefulWidget {
  /// 被监控的页面内容。
  final Widget child;

  /// 页面 route name，应与 route observer 看到的 route name 一致。
  final String pageName;

  /// 创建页面渲染完成标记组件。
  ///
  /// [child] 是实际页面内容；[pageName] 用于找到 Reporter 中对应的页面 trace。
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
        FlutterMonitorSDK.markPageRendered(widget.pageName);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
