import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';

/// 页面路由监听器。
///
/// 该类接入 `MaterialApp.navigatorObservers` 后，会把 Flutter route 的 push、
/// pop、replace 转换为页面 trace、页面 load span、page view breadcrumb 和
/// route context。后续 HTTP、错误、卡顿、内存等事件会通过 Reporter 自动关联到
/// 当前页面链路。
class MonitorRouteObserver extends RouteObserver<PageRoute<dynamic>> {
  final Reporter _reporter;
  final Map<Route<dynamic>, String> _routePageInstances =
      <Route<dynamic>, String>{};
  final Map<Route<dynamic>, _RouteDescriptor> _routeDescriptors =
      <Route<dynamic>, _RouteDescriptor>{};

  /// 页面切换回调。
  ///
  /// 主要用于 jank 监控器同步当前页面名，不参与 public API。
  void Function(String?)? onPageRoutePushed;

  /// 创建页面路由监听器。
  ///
  /// [Reporter] 负责真正发出页面 trace/span/breadcrumb，本类只负责把 route
  /// 生命周期翻译为 Reporter 调用。
  MonitorRouteObserver(this._reporter);

  /// 页面入栈时开启页面访问 trace 和页面加载 span。
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
        _reporter.recordPageView(
          page.name,
          routeFullName: page.fullName,
          pageInstanceId: pageInstanceId,
          activePhase: PageActivePhases.enter,
          activeTrigger: PageActiveTriggers.routePush,
          timestamp: now,
        );
        _schedulePageFirstFrameFallback(
          page.name,
          pageInstanceId: pageInstanceId,
        );
      }
    }
  }

  /// 页面出栈时闭合页面 trace，并恢复前一个页面作为当前上下文。
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

  /// 页面替换时闭合旧页面链路，并为新页面开启新的页面链路。
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
      _reporter.recordPageView(
        newPage.name,
        routeFullName: newPage.fullName,
        pageInstanceId: pageInstanceId,
        activePhase: PageActivePhases.enter,
        activeTrigger: PageActiveTriggers.routePush,
        timestamp: now,
      );
      _schedulePageFirstFrameFallback(
        newPage.name,
        pageInstanceId: pageInstanceId,
      );
    }
  }

  /// 标记页面首帧或关键内容已经渲染完成。
  ///
  /// public facade 的 `FlutterMonitorSDK.markPageRendered` 最终会调用这里。
  /// 若 route observer 已经通过下一帧兜底完成统计，重复调用会被 Reporter 忽略。
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

/// Dio 网络请求监控拦截器。
///
/// 每个实例只服务一个业务 Dio。它记录请求开始时间，在响应或错误回调中计算耗时、
/// 状态码、错误类型、请求/响应大小，并交给 Reporter 生成 `http.client` span。
class MonitorDioInterceptor extends Interceptor {
  final Reporter _reporter;
  static const _startTimeKey = '__flutter_monitor_sdk_start_time';

  /// 创建 Dio 请求监控拦截器。
  MonitorDioInterceptor(this._reporter);

  /// 记录请求开始时间，并继续交给业务 Dio 链路处理。
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra[_startTimeKey] = DateTime.now();
    super.onRequest(options, handler);
  }

  /// 请求成功或收到 HTTP 响应时，上报一次 `http.client` span。
  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final endTime = DateTime.now();
    final startTime = _requestStartTime(response.requestOptions) ?? endTime;
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
      requestHeaders: _stringHeaders(response.requestOptions.headers),
      requestBody: response.requestOptions.data,
      responseHeaders: _dioResponseHeaders(response.headers),
      responseBody: response.data,
      source: SignalSources.sdkDio,
      startTime: startTime,
      endTime: endTime,
      payload: <String, Object?>{
        PayloadKeys.httpSource: HttpPayloadSources.dio,
      },
    );
    super.onResponse(response, handler);
  }

  /// 请求异常时，上报失败的 `http.client` span，并保留异常继续向业务层传递。
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final endTime = DateTime.now();
    final startTime = _requestStartTime(err.requestOptions) ?? endTime;
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
      requestHeaders: _stringHeaders(err.requestOptions.headers),
      requestBody: err.requestOptions.data,
      responseHeaders: err.response == null
          ? null
          : _dioResponseHeaders(err.response!.headers),
      responseBody: err.response?.data,
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

  DateTime? _requestStartTime(RequestOptions options) {
    final value = options.extra[_startTimeKey];
    return value is DateTime ? value : null;
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

  Map<String, String>? _stringHeaders(Map<String, dynamic> headers) {
    if (headers.isEmpty) return null;
    return headers.map((key, value) => MapEntry(key, '$value'));
  }

  Map<String, String>? _dioResponseHeaders(Headers headers) {
    if (headers.map.isEmpty) return null;
    return headers.map.map((key, values) => MapEntry(key, values.join(', ')));
  }
}

/// SDK 性能采集模块装配类。
///
/// 当前负责页面路由监听器和冷启动首帧闭合。它不直接构建 envelope，而是把页面
/// 和启动时机交给 Reporter / StartupTraceController，保持性能信号进入统一
/// pipeline。
class PerformanceMonitor {
  final Reporter _reporter;
  final StartupTraceController? _startupTraceController;
  late final MonitorRouteObserver routeObserver;

  /// 创建性能监控模块。
  PerformanceMonitor(
    this._reporter, {
    StartupTraceController? startupTraceController,
  }) : _startupTraceController = startupTraceController,
       super() {
    routeObserver = MonitorRouteObserver(_reporter);
  }

  /// 初始化性能监听。
  ///
  /// SDK init 后注册首帧回调，用于闭合冷启动 trace 的 first-frame 口径。
  void init(DateTime appStartTime) {
    // 监听第一帧渲染完成
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final now = DateTime.now();
      _startupTraceController?.finishFirstFrame(endTime: now);
    });
  }
}
