import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';

// 用于页面路由监听  可以适当修改泛型 <Route<dynamic>>
class MonitorRouteObserver extends RouteObserver<PageRoute<dynamic>> {
  final Reporter _reporter;
  final Map<String, DateTime> _pagePushTimes = {};
  void Function(String?)? onPageRoutePushed; // 用于通知外部页面已切换

  MonitorRouteObserver(this._reporter);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    if (route is PageRoute && route.settings.name != null) {
      final pageName = route.settings.name!;
      if (pageName.isNotEmpty) {
        _pagePushTimes[pageName] = DateTime.now();
        _reporter.setCurrentRoute(pageName);
        onPageRoutePushed?.call(pageName); // 触发回调
        // 上报PV
        _reporter.addEvent('behavior', {'type': 'pv', 'page': pageName});
      }
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (route is PageRoute && route.settings.name != null) {
      final pageName = route.settings.name!;
      if (pageName.isNotEmpty) {
        final pushTime = _pagePushTimes.remove(pageName);
        if (pushTime != null) {
          final duration = DateTime.now().difference(pushTime);
          _reporter.addEvent('behavior', {
            'type': 'page_stay',
            'page': pageName,
            'duration_ms': duration.inMilliseconds,
          });
        }
        final previousPageName = previousRoute?.settings.name;
        if (previousPageName != null && previousPageName.isNotEmpty) {
          _reporter.setCurrentRoute(previousPageName);
          onPageRoutePushed?.call(previousPageName);
        }
      }
    }
  }

  void onPageRendered(String? pageName) {
    if (pageName == null || pageName.isEmpty) {
      debugPrint("警告: onPageRendered 收到空页面名称，跳过上报");
      return;
    }
    final pushTime = _pagePushTimes[pageName];
    if (pushTime != null) {
      final duration = DateTime.now().difference(pushTime);
      final data = {
        'type': 'page_load',
        'page': pageName,
        'duration_ms': duration.inMilliseconds,
      };
      _reporter.addEvent('performance', data);
    } else {
      debugPrint("警告: 未找到页面 $pageName 的推送时间");
    }
  }
}

// Dio拦截器，用于API性能监控
class MonitorDioInterceptor extends Interceptor {
  final Reporter _reporter;

  MonitorDioInterceptor(this._reporter);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra['startTime'] = DateTime.now();
    super.onRequest(options, handler);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final startTime = response.requestOptions.extra['startTime'] as DateTime;
    final duration = DateTime.now().difference(startTime);

    final data = {
      'type': 'api',
      'url': response.requestOptions.uri.toString(),
      'method': response.requestOptions.method,
      'status': response.statusCode,
      'duration_ms': duration.inMilliseconds,
      'success': true,
    };
    _reporter.addEvent('performance', data);
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final startTime = err.requestOptions.extra['startTime'] as DateTime;
    final duration = DateTime.now().difference(startTime);

    final data = {
      'type': 'api',
      'url': err.requestOptions.uri.toString(),
      'method': err.requestOptions.method,
      'status': err.response?.statusCode,
      'duration_ms': duration.inMilliseconds,
      'success': false,
      'error': err.message,
    };
    _reporter.addEvent('performance', data);
    super.onError(err, handler);
  }
}

// 性能监控主类
class PerformanceMonitor {
  final Reporter _reporter;
  final StartupTraceController? _startupTraceController;
  late final MonitorRouteObserver routeObserver;

  PerformanceMonitor(
    this._reporter, {
    StartupTraceController? startupTraceController,
  }) : _startupTraceController = startupTraceController {
    routeObserver = MonitorRouteObserver(_reporter);
  }

  void init(DateTime appStartTime) {
    // 监听第一帧渲染完成
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final now = DateTime.now();
      _startupTraceController?.finishFirstFrame(endTime: now);
    });
  }
}
