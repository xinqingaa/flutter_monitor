import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/src/lifecycle/lifecycle_manager.dart';
import 'package:flutter_monitor_sdk/src/modules/memory_collector.dart';
import 'package:flutter_monitor_sdk/src/startup/startup_trace_controller.dart';
import '../modules/jank_monitor.dart';
import 'monitor_config.dart';
import 'reporter.dart';
import '../modules/behavior_monitor.dart';
import '../modules/error_monitor.dart';
import '../modules/performance_monitor.dart';

/// 一个单例绑定类，它将所有监控模块粘合在一起。
/// 这是 SDK 内部的核心枢纽。
class MonitorBinding {
  late final JankMonitor jankMonitor; // JankMonitor 实例
  LifecycleManager? _lifecycleManager;
  MemoryCollector? _memoryCollector;
  StartupTraceController? _startupTraceController;
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
      if (config.enablePerformanceMonitor) {
        _startupTraceController = StartupTraceController(
          reporter: reporter,
          appStartTime: appStartTime,
        )..startSdkInit();
      }
    } catch (e) {
      debugPrint("错误: Reporter 初始化失败: $e");
      rethrow;
    }

    // 2. 根据配置，决定是否初始化各个监控模块。
    if (config.enableErrorMonitor) {
      try {
        errorMonitor = ErrorMonitor(reporter);
        errorMonitor.init();
        debugPrint("✅ ErrorMonitor 初始化成功");
      } catch (e) {
        debugPrint("错误: ErrorMonitor 初始化失败: $e");
      }
    }

    //  3. Performance Monitor 先于 JankMonitor 初始化
    if (config.enablePerformanceMonitor) {
      try {
        performanceMonitor = PerformanceMonitor(
          reporter,
          startupTraceController: _startupTraceController,
        );
        // 将 App 启动时间传递给性能监控器，用于计算启动耗时。
        performanceMonitor.init(appStartTime);
        // 监听路由变化，更新当前页面
        performanceMonitor.routeObserver.onPageRoutePushed = (name) {
          if (name != null) {
            _currentPage = name;
          }
        };
        debugPrint("✅ PerformanceMonitor 初始化成功");
      } catch (e) {
        debugPrint("错误: PerformanceMonitor 初始化失败: $e");
      }
    }

    // 4. enableBehaviorMonitor 初始化
    if (config.enableBehaviorMonitor) {
      try {
        behaviorMonitor = BehaviorMonitor(reporter);
        // 行为监控器也可能有自己的初始化逻辑，例如监听App生命周期。
        behaviorMonitor.init();
        debugPrint("✅ BehaviorMonitor 初始化成功");
      } catch (e) {
        debugPrint("错误: BehaviorMonitor 初始化失败: $e");
      }
    }

    // 5. enableJankMonitor 初始化UI卡顿
    if (config.enableJankMonitor) {
      try {
        jankMonitor = JankMonitor(
          reporter,
          getCurrentPage: () => _currentPage ?? 'unknown',
          onJankSequenceReported: () {
            unawaited(
              _memoryCollector?.recordSample(trigger: 'jank.sequence') ??
                  Future<void>.value(),
            );
          },
          config: config.effectiveJankConfig,
        );
        jankMonitor.init();
        debugPrint("✅ JankMonitor 初始化成功");
      } catch (e) {
        debugPrint("错误: JankMonitor 初始化失败: $e");
      }
    }

    if (config.effectiveMemoryConfig.enabled) {
      try {
        _memoryCollector = MemoryCollector(
          reporter,
          config: config.effectiveMemoryConfig,
        );
        unawaited(_memoryCollector!.recordSample(trigger: 'session.start'));
        debugPrint("✅ MemoryCollector 初始化成功");
      } catch (e) {
        debugPrint("错误: MemoryCollector 初始化失败: $e");
      }
    }

    try {
      _lifecycleManager = LifecycleManager(
        config: config.effectiveSessionConfig,
        onStateChanged: reporter.handleLifecycleState,
      )..init();
      debugPrint("✅ LifecycleManager 初始化成功");
    } catch (e) {
      debugPrint("错误: LifecycleManager 初始化失败: $e");
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

  /// 这是创建和设置 MonitorBinding 的主要入口点。
  /// 它由公开的 FlutterMonitorSDK.init() 方法调用。
  static Future<void> init({
    required MonitorConfig config,
    required DateTime appStartTime,
  }) async {
    // 错误恢复：如果已经初始化，直接返回现有实例
    if (_instance != null) {
      debugPrint("注意: MonitorBinding 已经被初始化过了。返回现有实例。");
      return;
    }
    // 正确调用私有构造函数并赋值给私有实例
    _instance = MonitorBinding._(config, appStartTime: appStartTime);

    // 异步初始化Reporter，确保设备信息获取完成
    try {
      await _instance!.reporter.initAsync();
    } catch (e) {
      debugPrint("警告: Reporter 异步初始化失败: $e");
      // 即使初始化失败，也不影响其他功能，继续运行
    }
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

  /// 行为监控服务。
  late final BehaviorMonitor behaviorMonitor;

  /// 在 App 关闭时，用于释放资源的方法。
  Future<void> flush({bool isAppExiting = false}) {
    return reporter.flush(isAppExiting: isAppExiting);
  }

  Future<void> handleLifecycleState(String state, {DateTime? timestamp}) {
    return reporter.handleLifecycleState(state, timestamp: timestamp).then((_) {
      if (state == 'resumed' || state == 'paused' || state == 'hidden') {
        if (state == 'resumed') {
          unawaited(
            _memoryCollector?.recordGrowth(trigger: 'lifecycle.resumed') ??
                Future<void>.value(),
          );
        } else {
          unawaited(
            _memoryCollector?.recordSample(trigger: 'lifecycle.$state') ??
                Future<void>.value(),
          );
        }
      }
    });
  }

  Future<void> dispose() async {
    try {
      await reporter.dispose();
    } catch (e) {
      debugPrint("错误: Reporter dispose 失败: $e");
    }
    if (config.enableJankMonitor) {
      try {
        jankMonitor.dispose();
      } catch (e) {
        debugPrint("错误: JankMonitor dispose 失败: $e");
      }
    }
    try {
      _lifecycleManager?.dispose();
    } catch (e) {
      debugPrint("错误: LifecycleManager dispose 失败: $e");
    }
    if (identical(_instance, this)) {
      _instance = null;
    }
  }
}
