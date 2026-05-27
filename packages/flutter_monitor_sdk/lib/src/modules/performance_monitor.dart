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
        final now = DateTime.now();
        final previousPageName = previousRoute?.settings.name;
        _pagePushTimes[pageName] = now;
        _reporter.startPageLoad(
          pageName,
          previousRouteName: previousPageName,
          startTime: now,
        );
        onPageRoutePushed?.call(pageName); // 触发回调
        _reporter.recordPageView(pageName);
        _schedulePageFirstFrameFallback(pageName);
      }
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (route is PageRoute && route.settings.name != null) {
      final pageName = route.settings.name!;
      if (pageName.isNotEmpty) {
        final previousPageName = previousRoute?.settings.name;
        _pagePushTimes.remove(pageName);
        _reporter.finishPageLoad(pageName, nextRouteName: previousPageName);
        if (previousPageName != null && previousPageName.isNotEmpty) {
          _reporter.setCurrentRoute(previousPageName);
          _reporter.activatePageTrace(previousPageName);
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
    if (_reporter.hasActivePageTrace(pageName)) {
      _reporter.finishPageFirstFrame(pageName);
    } else {
      debugPrint("警告: 未找到页面 $pageName 的推送时间");
    }
  }

  void _schedulePageFirstFrameFallback(String pageName) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _reporter.finishPageFirstFrame(pageName);
    });
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
    final endTime = DateTime.now();
    final duration = endTime.difference(startTime);

    _reporter.recordHttpClient(
      url: response.requestOptions.uri.toString(),
      method: response.requestOptions.method,
      statusCode: response.statusCode,
      durationMs: duration.inMilliseconds,
      success: _isSuccessfulStatusCode(response.statusCode),
      errorType: _isSuccessfulStatusCode(response.statusCode)
          ? null
          : 'http_status',
      requestSizeBytes: _dioRequestSize(response.requestOptions),
      responseSizeBytes: _dioResponseSize(response),
      source: 'sdk.dio',
      startTime: startTime,
      endTime: endTime,
      payload: <String, Object?>{'http.source': 'dio'},
    );
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final startTime = err.requestOptions.extra['startTime'] as DateTime;
    final endTime = DateTime.now();
    final duration = endTime.difference(startTime);

    _reporter.recordHttpClient(
      url: err.requestOptions.uri.toString(),
      method: err.requestOptions.method,
      statusCode: err.response?.statusCode,
      durationMs: duration.inMilliseconds,
      success: false,
      error: err.message,
      errorType: err.type.name,
      requestSizeBytes: _dioRequestSize(err.requestOptions),
      responseSizeBytes: err.response == null
          ? null
          : _dioResponseSize(err.response!),
      source: 'sdk.dio',
      startTime: startTime,
      endTime: endTime,
      payload: <String, Object?>{'http.source': 'dio'},
    );
    super.onError(err, handler);
  }

  bool _isSuccessfulStatusCode(int? statusCode) {
    if (statusCode == null) return false;
    return statusCode >= 200 && statusCode < 400;
  }

  num? _dioRequestSize(RequestOptions options) {
    final contentLength = options.headers[Headers.contentLengthHeader];
    final parsedLength = _numHeaderValue(contentLength);
    if (parsedLength != null) return parsedLength;
    return _estimatedBodySize(options.data);
  }

  num? _dioResponseSize(Response response) {
    final headerLength = response.headers.value(Headers.contentLengthHeader);
    final parsedLength = _numHeaderValue(headerLength);
    if (parsedLength != null) return parsedLength;
    return _estimatedBodySize(response.data);
  }

  num? _numHeaderValue(Object? value) {
    if (value is num) return value;
    if (value is String) return num.tryParse(value);
    return null;
  }

  num? _estimatedBodySize(Object? data) {
    if (data == null) return null;
    if (data is String) return data.length;
    if (data is List<int>) return data.length;
    if (data is Map || data is Iterable) return data.toString().length;
    return null;
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
