import 'package:flutter/material.dart';

import '../../flutter_monitor_sdk.dart';

/// 页面级监控封装。
///
/// [routeName] 是必填项，应与路由表中的 route name 保持一致。页面进入时组件会
/// 自动标记页面首帧完成；如果传入 [moduleName] 或 [moduleScene]，也会更新后续
/// 事件携带的模块上下文。
///
/// 该组件会订阅 SDK route observer，在页面首次入栈和从下一级页面返回时重新应用
/// module context，避免恢复页面后仍沿用上一页的业务模块。
class MonitorPageScope extends StatefulWidget {
  const MonitorPageScope({
    super.key,
    required this.routeName,
    this.moduleName,
    this.moduleScene,
    required this.child,
  });

  final String routeName;
  final String? moduleName;
  final String? moduleScene;
  final Widget child;

  @override
  State<MonitorPageScope> createState() => _MonitorPageScopeState();
}

class _MonitorPageScopeState extends State<MonitorPageScope> with RouteAware {
  ModalRoute<dynamic>? _subscribedRoute;

  @override
  void initState() {
    super.initState();
    _applyContext();
    _markRenderedAfterFrame();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is! PageRoute<dynamic> || route == _subscribedRoute) return;
    _unsubscribeRoute();
    _subscribedRoute = route;
    FlutterMonitorSDK.routeObserver.subscribe(this, route);
  }

  @override
  void didUpdateWidget(covariant MonitorPageScope oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.moduleName != widget.moduleName ||
        oldWidget.moduleScene != widget.moduleScene) {
      _applyContext();
    }
    if (oldWidget.routeName != widget.routeName) {
      _markRenderedAfterFrame();
    }
  }

  @override
  void didPush() {
    _applyContext();
  }

  @override
  void didPopNext() {
    _applyContext();
  }

  @override
  void dispose() {
    _unsubscribeRoute();
    super.dispose();
  }

  void _applyContext() {
    if (widget.moduleName == null && widget.moduleScene == null) return;
    FlutterMonitorSDK.setContext(
      moduleName: widget.moduleName,
      moduleScene: widget.moduleScene,
    );
  }

  void _markRenderedAfterFrame() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      FlutterMonitorSDK.markPageRendered(widget.routeName);
    });
  }

  void _unsubscribeRoute() {
    final route = _subscribedRoute;
    if (route == null) return;
    FlutterMonitorSDK.routeObserver.unsubscribe(this);
    _subscribedRoute = null;
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
