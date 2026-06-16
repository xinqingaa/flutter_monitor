import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/monitor_initial_context.dart';
import 'package:flutter_monitor_sdk/src/lifecycle/lifecycle_manager.dart';
import 'package:flutter_monitor_sdk/src/modules/frame_timing_dispatcher.dart';
import 'package:flutter_monitor_sdk/src/modules/frame_window_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/interaction_measure_collector.dart';
import 'package:flutter_monitor_sdk/src/modules/memory_collector.dart';
import 'package:flutter_monitor_sdk/src/native/native_bridge_controller.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';
import '../modules/jank_monitor.dart';
import 'monitor_config.dart';
import 'reporter.dart';
import '../modules/error_monitor.dart';
import '../modules/performance_monitor.dart';

/// SDK 内部的模块装配中心。
///
/// `MonitorBinding` 负责把配置、Reporter、错误采集、性能采集、卡顿采集、
/// 内存采样、生命周期和 native bridge 串到同一条运行时链路中。
///
/// 业务侧不应直接依赖该类；public API 通过 `FlutterMonitorSDK` 转发到这里。
class MonitorBinding {
  JankMonitor? _jankMonitor;
  LifecycleManager? _lifecycleManager;
  MemoryCollector? _memoryCollector;
  NativeBridgeController? _nativeBridgeController;
  StartupTraceController? _startupTraceController;
  FrameWindowCollector? _frameWindowCollector;
  InteractionMeasureCollector? _interactionMeasureCollector;
  FrameTimingDispatcher? _frameTimingDispatcher;
  String? _currentPage; // 用于给 JankMonitor 提供当前页面信息

  // --- 单例模式设置 ---

  /// 私有构造函数，确保该类只能在内部被实例化。
  ///
  /// [config] 是SDK的配置对象。
  /// [appStartTime] 是应用启动的精确时间，用于计算启动性能。
  MonitorBinding._(this.config, {required DateTime appStartTime}) {
    // 1. 首先初始化上报器（Reporter），因为其他模块都依赖它。
    try {
      reporter = Reporter(config);
    } catch (e) {
      debugPrint("错误: Reporter 初始化失败: $e");
      rethrow;
    }
  }

  /// 启动各个采集模块。
  ///
  /// 调用前必须已经创建 [reporter]，并且已经应用初始化期上下文与 bootstrap
  /// resource。该方法会发出冷启动、SDK init、memory sample 等首批事件，
  /// 因此初始化顺序对 envelope 上下文完整性非常关键。
  Future<void> _start({required DateTime appStartTime}) async {
    _startupTraceController = StartupTraceController(
      reporter: reporter,
      appStartTime: appStartTime,
    )..startSdkInit();

    reporter.onPageActivity = _handlePageActivity;

    try {
      errorMonitor = ErrorMonitor(reporter);
      errorMonitor.init();
      debugPrint("✅ ErrorMonitor 初始化成功");
    } catch (e) {
      debugPrint("错误: ErrorMonitor 初始化失败: $e");
    }

    try {
      performanceMonitor = PerformanceMonitor(
        reporter,
        startupTraceController: _startupTraceController,
      );
      performanceMonitor.init(appStartTime);
      performanceMonitor.routeObserver.onPageRoutePushed = (name) {
        if (name != null) {
          _currentPage = name;
        }
      };
      debugPrint("✅ PerformanceMonitor 初始化成功");
    } catch (e) {
      debugPrint("错误: PerformanceMonitor 初始化失败: $e");
    }

    _frameTimingDispatcher = FrameTimingDispatcher();

    if (config.effectivePerformanceConfig.collectPageFrameStats) {
      try {
        _frameWindowCollector = FrameWindowCollector(
          onPageWindowFinished: reporter.addPageFrameStats,
        );
        _frameTimingDispatcher?.addListener(
          _frameWindowCollector!.recordTimings,
        );
      } catch (e) {
        debugPrint("错误: FrameWindowCollector 初始化失败: $e");
      }
    }

    try {
      _interactionMeasureCollector = InteractionMeasureCollector(
        config: config.effectivePerformanceConfig,
        onFinished: reporter.recordInteractionMeasure,
      );
      _frameTimingDispatcher?.addListener(
        _interactionMeasureCollector!.recordTimings,
      );
    } catch (e) {
      debugPrint("错误: InteractionMeasureCollector 初始化失败: $e");
    }

    try {
      _jankMonitor = JankMonitor(
        reporter,
        getCurrentPage: () => _currentPage ?? 'unknown',
        onJankSequenceReported: () {
          unawaited(
            _memoryCollector?.recordGrowth(
                  trigger: TriggerValues.jankSequence,
                  emitSample: true,
                ) ??
                Future<void>.value(),
          );
          unawaited(
            _nativeBridgeController?.recordMemorySample(
                  trigger: TriggerValues.jankSequence,
                ) ??
                Future<void>.value(),
          );
        },
        config: config.effectivePerformanceConfig,
      );
      _jankMonitor!.init();
      _frameTimingDispatcher?.addListener(_jankMonitor!.recordTimings);
      debugPrint("✅ JankMonitor 初始化成功");
    } catch (e) {
      debugPrint("错误: JankMonitor 初始化失败: $e");
    }

    _frameTimingDispatcher?.init();

    try {
      _memoryCollector = MemoryCollector(
        reporter,
        config: config.effectiveMemoryConfig,
      );
      unawaited(
        _memoryCollector!.recordSample(trigger: TriggerValues.sessionStart),
      );
      debugPrint("✅ MemoryCollector 初始化成功");
    } catch (e) {
      debugPrint("错误: MemoryCollector 初始化失败: $e");
    }

    try {
      _lifecycleManager = LifecycleManager(onStateChanged: handleLifecycleState)
        ..init();
      debugPrint("✅ LifecycleManager 初始化成功");
    } catch (e) {
      debugPrint("错误: LifecycleManager 初始化失败: $e");
    }

    final nativeBridge = config.nativeBridge;
    if (nativeBridge != null) {
      try {
        _nativeBridgeController = NativeBridgeController(
          bridge: nativeBridge,
          reporter: reporter,
        );
        await _nativeBridgeController!.init();
        debugPrint("✅ NativeBridgeController 初始化成功");
      } catch (e) {
        debugPrint("错误: NativeBridgeController 初始化失败: $e");
      }
    }

    _startupTraceController?.finishSdkInit();
  }

  /// 静态的、私有的单例实例。
  static MonitorBinding? _instance;

  /// 公开的、用于获取单例实例的静态 getter。
  /// 如果在初始化之前就尝试访问，会触发断言错误。
  static MonitorBinding get instance {
    assert(
      _instance != null,
      'MonitorBinding 尚未初始化，请先调用 FlutterMonitorSDK.init()。',
    );
    return _instance!;
  }

  // --- 初始化方法 ---

  /// 创建并启动 SDK 内部单例。
  ///
  /// 初始化顺序固定为：
  /// 1. 创建 [Reporter] 和 pipeline；
  /// 2. 应用 [initialContext]，确保首批事件带上业务已知上下文；
  /// 3. 解析设备/native bootstrap resource；
  /// 4. 启动各采集模块并发出启动相关 trace/span。
  static Future<void> init({
    required MonitorConfig config,
    required DateTime appStartTime,
    MonitorInitialContext? initialContext,
  }) async {
    // 错误恢复：如果已经初始化，直接返回现有实例
    if (_instance != null) {
      debugPrint("注意: MonitorBinding 已经被初始化过了。返回现有实例。");
      return;
    }
    // 正确调用私有构造函数并赋值给私有实例
    _instance = MonitorBinding._(config, appStartTime: appStartTime);
    _instance!._applyInitialContext(initialContext);

    // Resolve bootstrap resources before modules emit the first envelope.
    try {
      await _instance!.reporter.resolveBootstrapResources();
    } catch (e) {
      debugPrint("警告: Reporter bootstrap resource 初始化失败: $e");
      // 即使初始化失败，也不影响其他功能，继续运行
    }
    await _instance!._start(appStartTime: appStartTime);
  }

  /// 在首批事件发出前应用初始化期上下文。
  ///
  /// 这里复用 [Reporter.setContext]，保证 `init(initialContext: ...)` 和运行时
  /// `FlutterMonitorSDK.setContext(...)` 走同一套字段映射。
  void _applyInitialContext(MonitorInitialContext? context) {
    if (context == null || context.isEmpty) return;
    reporter.setContext(
      userId: context.userId,
      userType: context.userType,
      userTags: context.userTags,
      cohort: context.cohort,
      moduleName: context.moduleName,
      moduleScene: context.moduleScene,
      releaseId: context.releaseId,
      featureFlags: context.featureFlags,
      experiments: context.experiments,
      networkType: context.networkType,
      isWeakNetwork: context.isWeakNetwork,
    );
  }

  // --- 可供内部访问的服务 ---

  /// SDK 的配置对象。
  final MonitorConfig config;

  /// 用于发送数据的上报服务。
  late final Reporter reporter;

  /// 错误监控服务。
  late final ErrorMonitor errorMonitor;

  /// 性能监控服务。
  late final PerformanceMonitor performanceMonitor;

  /// flush 当前所有 output 队列。
  ///
  /// 由 public `FlutterMonitorSDK.flush` 和生命周期后台/退出链路调用。
  Future<void> flush({bool isAppExiting = false}) {
    return reporter.flush(isAppExiting: isAppExiting);
  }

  /// 开启一次业务交互性能观测。
  MonitorMeasureHandle measure({
    required String action,
    MonitorMeasureMode mode = MonitorMeasureMode.common,
    String? target,
    Map<String, Object?> properties = const <String, Object?>{},
    String? routeName,
    String? routeFullName,
    Duration? observeFor,
    Duration? timeout,
  }) {
    final collector = _interactionMeasureCollector;
    if (collector == null) {
      return MonitorMeasureHandle.disabled(action: action, mode: mode);
    }
    final pageBinding = routeName == null
        ? reporter.currentInteractionPageBinding()
        : reporter.interactionPageBindingForRoute(
            routeName,
            routeFullName: routeFullName,
          );
    return collector.measure(
      action: action,
      mode: mode,
      target: target,
      properties: properties,
      pageBinding: pageBinding,
      observeFor: observeFor,
      timeout: timeout,
    );
  }

  /// 处理 lifecycle state，并触发关联的 session、热启动、内存和 flush 逻辑。
  ///
  /// 该方法接收 core 协议中的 lifecycle 字符串，public API 会先把
  /// `AppLifecycleState` 映射为这些字符串。
  Future<void> handleLifecycleState(String state, {DateTime? timestamp}) {
    return reporter.handleLifecycleState(state, timestamp: timestamp).then((_) {
      if (state == LifecycleStates.resumed ||
          state == LifecycleStates.paused ||
          state == LifecycleStates.hidden) {
        if (state == LifecycleStates.resumed) {
          reporter.beginStartupPerformance(
            startTime: timestamp ?? DateTime.now(),
          );
          WidgetsBinding.instance.addPostFrameCallback((_) {
            final now = DateTime.now();
            reporter.finishHotStartTrace(
              endTime: now,
              endReason: StartupEndReasons.firstFrame,
            );
          });
          unawaited(
            _memoryCollector?.recordGrowth(
                  trigger: TriggerValues.lifecycleResumed,
                ) ??
                Future<void>.value(),
          );
          unawaited(
            _nativeBridgeController?.recordMemorySample(
                  trigger: TriggerValues.lifecycleResumed,
                ) ??
                Future<void>.value(),
          );
        } else {
          _frameWindowCollector?.finishPageWindow(
            PageActivePhases.lifecycleBackground,
            timestamp: timestamp,
          );
          unawaited(
            _memoryCollector?.recordSample(
                  trigger: TriggerValues.lifecycleState(state),
                ) ??
                Future<void>.value(),
          );
          unawaited(
            _nativeBridgeController?.recordMemorySample(
                  trigger: TriggerValues.lifecycleState(state),
                ) ??
                Future<void>.value(),
          );
        }
      }
    });
  }

  Future<void> dispose() async {
    try {
      errorMonitor.dispose();
    } catch (e) {
      debugPrint("错误: ErrorMonitor dispose 失败: $e");
    }
    try {
      _interactionMeasureCollector?.dispose();
    } catch (e) {
      debugPrint("错误: InteractionMeasureCollector dispose 失败: $e");
    }
    _frameWindowCollector?.dispose();
    try {
      await reporter.dispose();
    } catch (e) {
      debugPrint("错误: Reporter dispose 失败: $e");
    }
    try {
      _jankMonitor?.dispose();
    } catch (e) {
      debugPrint("错误: JankMonitor dispose 失败: $e");
    }
    try {
      _frameTimingDispatcher?.dispose();
    } catch (e) {
      debugPrint("错误: FrameTimingDispatcher dispose 失败: $e");
    }
    try {
      _lifecycleManager?.dispose();
    } catch (e) {
      debugPrint("错误: LifecycleManager dispose 失败: $e");
    }
    try {
      await _nativeBridgeController?.dispose();
    } catch (e) {
      debugPrint("错误: NativeBridgeController dispose 失败: $e");
    }
    if (identical(_instance, this)) {
      _instance = null;
    }
  }

  void _handlePageActivity(PageActivitySnapshot activity) {
    _currentPage = activity.routeName;
    if (activity.activePhase == PageActivePhases.enter ||
        activity.activePhase == PageActivePhases.resume) {
      _frameWindowCollector?.startPageWindow(activity);
    } else {
      _frameWindowCollector?.finishPageWindow(
        activity.activePhase,
        timestamp: activity.timestamp,
      );
    }
    unawaited(
      Future<void>.microtask(() => reporter.recordPageActivityMemory(activity)),
    );
  }
}
