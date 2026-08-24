import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/monitor_initial_context.dart';
import 'package:flutter_monitor_sdk/src/context/monitor_context_scope.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_binding.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/performance_monitor.dart';
import 'package:flutter_monitor_sdk/src/utils/monitored_http_client.dart';

export 'package:flutter_monitor_sdk/src/context/monitor_context_scope.dart';
export 'package:flutter_monitor_sdk/src/context/monitor_initial_context.dart';
export 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
export 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart'
    show MonitorMeasureHandle;
export 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';
export 'package:flutter_monitor_sdk/src/utils/page_render_monitor.dart';
export 'package:flutter_monitor_sdk/src/utils/monitor_page_scope.dart';
export 'package:flutter_monitor_sdk/src/utils/performance_utils.dart';
export 'package:flutter_monitor_sdk/src/outputs/log_monitor_output.dart'
    show LogMonitorOutputMode;
export 'package:flutter_monitor_core/flutter_monitor_core.dart'
    show
        EventLevel,
        EventStatus,
        MonitorEventLevel,
        MonitorMeasureMode,
        MonitorMeasureResult,
        MonitorTrackResult;

/// Flutter Monitor SDK 的业务接入主入口。
///
/// 这个类只暴露真实 App 常用的稳定 API：初始化、上下文、业务埋点、
/// 手动错误、路由观察、HTTP/Dio 包装、flush 和释放。
///
/// SDK 内部的 trace/span/breadcrumb/pipeline 等实现细节不从这里暴露，
/// 业务侧不需要也不应该直接拼装 `RawSignal`、`FieldPaths` 或
/// `EventEnvelope`。
class FlutterMonitorSDK {
  FlutterMonitorSDK._();

  static bool _isInitialized = false;

  /// SDK 是否已经完成初始化。
  ///
  /// 适用于业务代码在可选接入场景下做保护判断。大多数场景不需要主动读取，
  /// 直接在应用启动阶段调用一次 [init] 即可。
  static bool get isInitialized => _isInitialized;

  /// 页面路由监听器。
  ///
  /// 传入 `MaterialApp.navigatorObservers` 后，SDK 会自动采集页面进入、
  /// 页面停留、页面加载、route stack 相关上下文，并把后续 HTTP、卡顿、
  /// 错误等事件关联到当前页面 trace。
  ///
  /// 用法：
  /// ```dart
  /// MaterialApp(
  ///   navigatorObservers: [FlutterMonitorSDK.routeObserver],
  /// )
  /// ```
  ///
  /// 必须在 [init] 成功后获取，否则会抛出 [SDKNotInitializedException]。
  static RouteObserver<PageRoute<dynamic>> get routeObserver {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再使用 routeObserver。',
      );
    }
    return MonitorBinding.instance.performanceMonitor.routeObserver;
  }

  /// 创建 Dio interceptor，用于自动采集 Dio 请求。
  ///
  /// 每次调用都会返回新的 interceptor 实例。建议在 [init] 完成后调用，
  /// 再添加到业务自己的 Dio 实例中：
  ///
  /// ```dart
  /// dio.interceptors.add(FlutterMonitorSDK.createDioInterceptor());
  /// ```
  ///
  /// 采集结果会以 `http.client` span 进入统一 envelope，并自动关联当前
  /// session、trace、route、context 和 breadcrumbs。
  ///
  /// 参数：无。Dio 实例仍由业务方持有和配置。
  static Interceptor createDioInterceptor() {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再创建 Dio interceptor。',
      );
    }
    return MonitorDioInterceptor(MonitorBinding.instance.reporter);
  }

  /// 创建受监控的 `package:http` client。
  ///
  /// 如果传入 [inner]，SDK 会包装该 client；否则内部创建默认 `http.Client`。
  /// 调用方仍然负责在不再使用时关闭返回的 client。
  ///
  /// 采集结果会以 `http.client` span 进入统一 envelope，并自动关联当前链路。
  static http.Client createHttpClient({http.Client? inner}) {
    if (!_isInitialized) {
      throw SDKNotInitializedException(
        '请先调用 FlutterMonitorSDK.init() 再创建 http client。',
      );
    }
    return MonitoredHttpClient(
      MonitorBinding.instance.reporter,
      inner ?? http.Client(),
    );
  }

  /// 标记指定 route 的页面首帧已渲染完成。
  ///
  /// RouteObserver 默认会在下一帧自动兜底完成页面首帧统计。业务方只有在需要
  /// 更明确地标记页面关键内容完成时才调用该方法。
  ///
  /// 参数：
  /// - [routeName]：页面 route 名，应与 `RouteSettings.name` 保持一致。
  static void markPageRendered(String routeName) {
    if (!_isInitialized) return;
    MonitorBinding.instance.performanceMonitor.routeObserver.onPageRendered(
      routeName,
    );
  }

  /// 设置后续事件都会携带的通用排查上下文。
  ///
  /// 该方法用于运行时更新 canonical `context.*` 字段，例如用户登录后设置
  /// `context.user.*`，模块切换时设置 `context.module.*`，灰度配置变化时设置
  /// `context.release.*`。
  ///
  /// 这里不接受任意 custom map。业务动作详情请放到 [track] 的 `properties`；
  /// App、设备、runtime、route 等上下文优先由 SDK 自动采集。
  ///
  /// 只传入某个 scope 的字段时，只会更新该 scope；未传入的 scope 保持不变。
  ///
  /// 参数分组：
  /// - 用户：[userId]、[userType]、[userTags]、[cohort]。
  /// - 模块：[moduleName]、[moduleScene]。
  /// - 发布：[releaseId]、[featureFlags]、[experiments]。
  /// - 网络：[networkType]、[isWeakNetwork]。
  static void setContext({
    String? userId,
    String? userType,
    List<String>? userTags,
    String? cohort,
    String? moduleName,
    String? moduleScene,
    String? releaseId,
    List<String>? featureFlags,
    Map<String, Object?>? experiments,
    String? networkType,
    bool? isWeakNetwork,
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.setContext(
      userId: userId,
      userType: userType,
      userTags: userTags,
      cohort: cohort,
      moduleName: moduleName,
      moduleScene: moduleScene,
      releaseId: releaseId,
      featureFlags: featureFlags,
      experiments: experiments,
      networkType: networkType,
      isWeakNetwork: isWeakNetwork,
    );
  }

  /// 清理指定 scope 的运行时上下文。
  ///
  /// 常见场景是用户登出后清理 `MonitorContextScope.user`，或网络状态不可用时
  /// 清理 `MonitorContextScope.network`。清理后，后续事件不再携带该 scope。
  static void clearContext({required Set<MonitorContextScope> scopes}) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.clearContext(scopes);
  }

  /// 记录一次业务动作。
  ///
  /// `track` 会生成 `signalType = breadcrumb` 的事件进入 session timeline，
  /// 并进入 recent breadcrumb store。后续错误、卡顿、失败 HTTP 等关键事件
  /// 可以携带这些 breadcrumbs，帮助还原用户操作路径。
  ///
  /// [action] 必须是稳定低基数字符串，例如 `checkout.submit`，不要包含订单号、
  /// 用户 ID 等动态值。[properties] 只作为本次动作详情进入 `payload.properties`，
  /// 默认不作为聚合索引。
  ///
  /// 参数：
  /// - [action]：稳定动作名，例如 `checkout.submit`。
  /// - [result]：动作结果，默认 unknown。
  /// - [target]：可选 UI 目标，例如按钮或列表项名称。
  /// - [level] / [error]：动作异常时补充级别和错误摘要。
  /// - [properties]：本次动作详情，会经过隐私过滤。
  static void track({
    required String action,
    MonitorTrackResult result = MonitorTrackResult.unknown,
    String? target,
    MonitorEventLevel? level,
    String? error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.track(
      action: action,
      result: result,
      target: target,
      level: level,
      error: error,
      properties: properties,
    );
  }

  /// 观测一次关键业务交互的性能窗口。
  ///
  /// [action] 与 [track] 的 `action` 语义一致，是稳定低基数业务动作名，例如
  /// `tab.switch`、`chart.zoom`、`sheet.open`，不能包含订单号、用户输入或 URL
  /// query 等动态值。
  ///
  /// 该 API 不接收回调函数，也不执行正式业务逻辑。common 模式只需调用一次，
  /// SDK 会围绕调用点自动观察短窗口；stage 模式返回 handle，业务在明确完成或
  /// 取消时调用 [MonitorMeasureHandle.finish] / [MonitorMeasureHandle.cancel]。
  ///
  /// 参数：
  /// - [action]：稳定交互名。
  /// - [mode]：common 自动闭合，stage 由业务显式 finish/cancel。
  /// - [target]：可选 UI 目标。
  /// - [properties]：交互详情。
  /// - [routeName] / [routeFullName]：可选，显式覆盖归属路由。默认 SDK 自动取
  ///   调用时刻的栈顶页面路由；当自动路由不准时（例如导航前预取、目标页尚未
  ///   入栈就开始观测）显式传入。取值必须是稳定低基数路由，不能含动态业务 ID。
  /// - [observeFor] / [timeout]：覆盖默认观测窗口和超时。
  static MonitorMeasureHandle measure({
    required String action,
    MonitorMeasureMode mode = MonitorMeasureMode.common,
    String? target,
    Map<String, Object?> properties = const <String, Object?>{},
    String? routeName,
    String? routeFullName,
    Duration? observeFor,
    Duration? timeout,
  }) {
    if (!_isInitialized) {
      return MonitorMeasureHandle.disabled(action: action, mode: mode);
    }
    return MonitorBinding.instance.measure(
      action: action,
      mode: mode,
      target: target,
      properties: properties,
      routeName: routeName,
      routeFullName: routeFullName,
      observeFor: observeFor,
      timeout: timeout,
    );
  }

  /// 手动记录业务侧已捕获错误。
  ///
  /// 自动错误采集覆盖 Flutter framework error 和 Dart uncaught error；业务已经
  /// catch 住但仍希望进入 session timeline 的错误，应通过该方法上报。
  ///
  /// 该方法会生成标准 `signalType = error` envelope，携带当前 context、trace
  /// 和 recent breadcrumbs。[type] 应是稳定错误类型；[properties] 放本次错误
  /// 的诊断详情，仍会经过隐私过滤。
  ///
  /// 参数：
  /// - [error] / [stackTrace]：业务捕获的异常和堆栈。
  /// - [type]：稳定错误类型，例如 `PaymentException`。
  /// - [handled]：是否已被业务捕获处理。
  /// - [level]：错误级别，默认 error。
  /// - [properties]：本次错误的诊断详情。
  static void recordError(
    Object error, {
    StackTrace? stackTrace,
    String? type,
    bool handled = true,
    MonitorEventLevel level = MonitorEventLevel.error,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    if (!_isInitialized) return;
    MonitorBinding.instance.reporter.recordManualError(
      error,
      stackTrace: stackTrace,
      type: type,
      handled: handled,
      level: level,
      properties: properties,
    );
  }

  /// 立即 flush 所有 output 中缓存的事件。
  ///
  /// [isAppExiting] 为 `true` 时表示应用正在退出或进入不可恢复状态，output 可以
  /// 使用更积极的尽力发送策略。
  static Future<void> flush({bool isAppExiting = false}) {
    if (!_isInitialized) return Future<void>.value();
    return MonitorBinding.instance.flush(isAppExiting: isAppExiting);
  }

  /// 释放 SDK 内部资源。
  ///
  /// 会先闭合仍活跃的页面 trace，再 flush 输出队列，最后释放 lifecycle、
  /// frame timing、native bridge 等监听器。通常只在测试或应用明确退出时调用。
  static Future<void> dispose() async {
    if (!_isInitialized) return;
    await MonitorBinding.instance.dispose();
    _isInitialized = false;
  }

  /// 初始化 Flutter Monitor SDK。
  ///
  /// 应在 `main()` 中、`runApp` 前调用。SDK 会创建 reporter/pipeline，应用
  /// 初始上下文，解析设备和 native bootstrap resource，然后启动默认主链路
  /// 采集：错误、启动、页面/路由、HTTP 包装器和 lifecycle。
  /// frame、jank、memory、measure 和 native 由 [MonitorSignalConfig] 显式开启。
  ///
  /// 用法：
  /// ```dart
  /// final appStartTime = DateTime.now();
  /// WidgetsFlutterBinding.ensureInitialized();
  ///
  /// await FlutterMonitorSDK.init(
  ///   config: MonitorConfig(
  ///     appInfo: AppInfo(appKey: 'my_app'),
  ///     mode: MonitorMode.localLive(endpoint: Uri.parse(serverUrl)),
  ///   ),
  ///   appStartTime: appStartTime,
  /// );
  /// ```
  ///
  /// 参数：
  /// - [config]：SDK 初始化主配置，包含 App 信息、输出模式、采集策略和 native bridge。
  /// - [appStartTime]：App 启动起点，用于冷启动 trace 和 SDK init span。
  /// - [initialContext]：首批 bootstrap 事件前写入的已知上下文，例如 QA 用户、
  ///   发布批次、feature flags、初始模块或网络状态。
  ///
  /// 同一进程内重复调用会直接返回，不会重新初始化内部绑定。
  static Future<void> init({
    required MonitorConfig config,
    required DateTime appStartTime,
    MonitorInitialContext? initialContext,
  }) async {
    if (_isInitialized) {
      debugPrint("FlutterMonitorSDK has already been initialized.");
      return;
    }

    await MonitorBinding.init(
      config: config,
      appStartTime: appStartTime,
      initialContext: initialContext,
    );
    _isInitialized = true;
    debugPrint("FlutterMonitorSDK initialized successfully.");
  }
}

/// SDK 尚未初始化时访问必须依赖初始化状态的 API 所抛出的异常。
class SDKNotInitializedException implements Exception {
  /// 说明具体哪个 API 在初始化前被访问。
  final String message;

  SDKNotInitializedException(this.message);

  @override
  String toString() => 'SDKNotInitializedException: $message';
}
