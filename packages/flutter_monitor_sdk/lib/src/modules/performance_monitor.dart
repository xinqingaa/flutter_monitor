import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';

// 用于页面路由监听  可以适当修改泛型 <Route<dynamic>>
class MonitorRouteObserver extends RouteObserver<PageRoute<dynamic>> {
  final Reporter _reporter;
  final Map<Route<dynamic>, String> _routePageInstances =
      <Route<dynamic>, String>{};
  final Map<Route<dynamic>, _RouteDescriptor> _routeDescriptors =
      <Route<dynamic>, _RouteDescriptor>{};
  void Function(String?)? onPageRoutePushed; // 用于通知外部页面已切换

  MonitorRouteObserver(this._reporter);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    if (route is PageRoute && route.settings.name != null) {
      final page = _describeRoute(route);
      if (page != null) {
        final now = DateTime.now();
        final previousPage = _describeRoute(previousRoute);
        final pageInstanceId = _reporter.startPageLoad(
          page.name,
          routeFullName: page.fullName,
          previousRouteName: previousPage?.name,
          previousRouteFullName: previousPage?.fullName,
          startTime: now,
        );
        if (pageInstanceId != null) {
          _routePageInstances[route] = pageInstanceId;
          _routeDescriptors[route] = page;
        }
        onPageRoutePushed?.call(page.name); // 触发回调
        _reporter.recordPageView(page.name, routeFullName: page.fullName);
        _schedulePageFirstFrameFallback(
          page.name,
          pageInstanceId: pageInstanceId,
        );
      }
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (route is PageRoute && route.settings.name != null) {
      final page = _routeDescriptors[route] ?? _describeRoute(route);
      if (page != null) {
        final previousPage = _describeRoute(previousRoute);
        final pageInstanceId = _routePageInstances.remove(route);
        _routeDescriptors.remove(route);
        _reporter.finishPageLoad(
          page.name,
          nextRouteName: previousPage?.name,
          nextRouteFullName: previousPage?.fullName,
          pageInstanceId: pageInstanceId,
        );
        if (previousPage != null) {
          _reporter.setCurrentRoute(
            previousPage.name,
            fullName: previousPage.fullName,
          );
          _reporter.activatePageTrace(previousPage.name);
          onPageRoutePushed?.call(previousPage.name);
        }
      }
    }
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    final oldPage = _describeRoute(oldRoute);
    final newPage = _describeRoute(newRoute);
    if (oldPage != null) {
      final oldPageInstanceId = oldRoute == null
          ? null
          : _routePageInstances.remove(oldRoute);
      if (oldRoute != null) _routeDescriptors.remove(oldRoute);
      _reporter.finishPageLoad(
        oldPage.name,
        nextRouteName: newPage?.name,
        nextRouteFullName: newPage?.fullName,
        pageInstanceId: oldPageInstanceId,
        endReason: PageEndReasons.routeReplace,
        resumePrevious: false,
      );
    }
    if (newRoute is PageRoute && newPage != null) {
      final now = DateTime.now();
      final pageInstanceId = _reporter.startPageLoad(
        newPage.name,
        routeFullName: newPage.fullName,
        previousRouteName: oldPage?.name,
        previousRouteFullName: oldPage?.fullName,
        startTime: now,
      );
      if (pageInstanceId != null) {
        _routePageInstances[newRoute] = pageInstanceId;
        _routeDescriptors[newRoute] = newPage;
      }
      onPageRoutePushed?.call(newPage.name);
      _reporter.recordPageView(newPage.name, routeFullName: newPage.fullName);
      _schedulePageFirstFrameFallback(
        newPage.name,
        pageInstanceId: pageInstanceId,
      );
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

  void _schedulePageFirstFrameFallback(
    String pageName, {
    String? pageInstanceId,
  }) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _reporter.finishPageFirstFrame(pageName, pageInstanceId: pageInstanceId);
    });
  }

  _RouteDescriptor? _describeRoute(Route<dynamic>? route) {
    if (route == null) return null;
    final cached = _routeDescriptors[route];
    if (cached != null) return cached;
    final routeName = route.settings.name;
    if (routeName == null || routeName.isEmpty) return null;
    return _RouteDescriptor(
      name: routeName,
      fullName: _fullRouteName(routeName, route.settings.arguments),
    );
  }

  String _fullRouteName(String routeName, Object? arguments) {
    if (arguments == null) return routeName;
    final values = _argumentQueryValues(arguments);
    if (values.isEmpty) return routeName;
    final uri = Uri(
      path: routeName,
      queryParameters: <String, String>{
        for (final entry in values.entries) entry.key: entry.value,
      },
    );
    return uri.toString();
  }

  Map<String, String> _argumentQueryValues(Object arguments) {
    if (arguments is Map) {
      final entries =
          arguments.entries
              .where((entry) => entry.key != null && entry.value != null)
              .map(
                (entry) => MapEntry('${entry.key}', _queryValue(entry.value)),
              )
              .where((entry) => entry.value.isNotEmpty)
              .toList(growable: false)
            ..sort((a, b) => a.key.compareTo(b.key));
      return <String, String>{
        for (final entry in entries) entry.key: entry.value,
      };
    }
    return <String, String>{'argument': _queryValue(arguments)};
  }

  String _queryValue(Object? value) {
    if (value == null) return '';
    if (value is DateTime) return value.toIso8601String();
    if (value is Iterable && value is! String) {
      return value.map(_queryValue).where((item) => item.isNotEmpty).join(',');
    }
    return '$value';
  }
}

class _RouteDescriptor {
  const _RouteDescriptor({required this.name, required this.fullName});

  final String name;
  final String fullName;
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
          : HttpErrorTypes.httpStatus,
      requestSizeBytes: _dioRequestSize(response.requestOptions),
      responseSizeBytes: _dioResponseSize(response),
      source: SignalSources.sdkDio,
      startTime: startTime,
      endTime: endTime,
      payload: <String, Object?>{
        PayloadKeys.httpSource: HttpPayloadSources.dio,
      },
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
      source: SignalSources.sdkDio,
      startTime: startTime,
      endTime: endTime,
      payload: <String, Object?>{
        PayloadKeys.httpSource: HttpPayloadSources.dio,
      },
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
  }) : _startupTraceController = startupTraceController,
       super() {
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
