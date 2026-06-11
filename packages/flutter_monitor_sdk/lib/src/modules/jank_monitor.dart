import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import '../utils/performance_utils.dart';

// CPU 密集型卡顿 (覆盖得很好 ✅)
// 这是指 UI 线程被大量的计算任务占满，导致 build, layout, paint 的时间过长。
// SDK 可以捕获的场景包括：
// 复杂的 Widget 构建: 在 build 方法中进行了大量的同步计算、复杂的对象创建、数据转换等。
// 低效的列表项: 在一个长列表中（如 ListView），每个列表项（item）的 build 方法都非常耗时。当你快速滑动这个列表时，Flutter 需要在短时间内构建大量新的 item，如果每个 item 都很慢，就会产生连续的慢帧，从而被你的 SDK 捕获。
// 复杂的自定义绘制: 使用 CustomPaint 绘制非常复杂的图形，导致 paint 阶段耗时过长。
// 复杂的布局计算: 嵌套层级非常深，或者使用了大量 IntrinsicWidth/IntrinsicHeight 等需要多次布局计算的 Widget，导致 layout 阶段耗时过长。
// 简单来说：只要是 Dart 代码本身写得不够高效，导致 UI 线程忙于计算而无法在 16.7ms 内完成一帧的渲染，并且这种情况连续发生，你的 SDK 就能抓到。

// UI 线程阻塞型卡顿 (覆盖不到 ❌)
// 这是指 UI 线程被一个长时间的同步操作完全冻结，导致它在一段时间内无法响应任何事情，包括渲染新帧。
// SDK 目前无法捕获的场景包括：
// 同步 I/O 操作: 在 UI 线程上执行了文件读写、数据库查询等耗时 I/O。（这是绝对要避免的坏实践，但确实会发生）。
// 长时间的 while 循环: 正如我们之前调试时发现的，一个长的同步循环会冻结线程，而不是让帧变慢。
// 插件的同步方法调用: 调用了一个 Native 插件的同步方法，而这个 Native 方法执行了很长时间才返回。
// 为什么捕获不到？ 因为在线程被冻结期间，SchedulerBinding.instance.addTimingsCallback 根本不会被触发。当阻塞结束后，只会产生一个超长的帧，而我们的逻辑是寻找"连续的"慢帧，所以单个的"巨型帧"会被忽略。

/// 优化的UI卡顿监控器
///
/// 主要改进：
/// 1. 自适应阈值：根据设备性能动态调整卡顿标准
/// 2. 抖动容忍：允许设备正常抖动，只检测真正的连续卡顿
/// 3. 性能优化：减少监控对应用性能的影响
/// 4. 智能采样：在高频场景下进行采样，避免数据过载
class JankMonitor {
  final Reporter _reporter;
  final String Function()? _getCurrentPage;
  final VoidCallback? _onJankSequenceReported;
  final MonitorPerformanceConfig _config;

  /// 创建卡顿监控器。
  ///
  /// [getCurrentPage] 用于把卡顿事件关联到当前页面；[onJankSequenceReported]
  /// 用于内部联动，例如触发 memory growth 采样；[config] 控制慢帧阈值和防抖。
  JankMonitor(
    this._reporter, {
    String Function()? getCurrentPage,
    VoidCallback? onJankSequenceReported,
    MonitorPerformanceConfig? config,
  }) : _getCurrentPage = getCurrentPage,
       _onJankSequenceReported = onJankSequenceReported,
       _config = config ?? MonitorPerformanceConfig.defaultConfig;

  // --- 自适应阈值相关 ---
  double _frameBudgetMs = 16.67; // 默认60fps
  double _jankThresholdMs = 33.34; // 默认2倍帧预算
  int _consecutiveJankThreshold = 3; // 默认连续3帧

  // --- 性能统计 ---
  final List<double> _recentFrameTimes = []; // 最近帧时间记录
  static const int _frameHistorySize = 30; // 保留最近30帧的数据
  double _averageFrameTime = 16.67; // 平均帧时间
  double _frameTimeVariance = 0.0; // 帧时间方差

  // --- 卡顿检测状态 ---
  int _consecutiveJankFrames = 0;
  double _maxJankDurationInSequence = 0;
  double _totalJankDurationInSequence = 0;
  DateTime? _lastJankTime; // 上次卡顿时间，用于防抖
  bool _jankSequenceReported = false;

  // --- 采样控制 ---
  int _frameCounter = 0;
  static const int _samplingRate = 3; // 每3帧采样一次

  /// 初始化卡顿检测阈值。
  ///
  /// 阈值会基于当前刷新率和 [MonitorPerformanceConfig] 计算，后续由 [recordTimings] 消费帧数据。
  void init() {
    _initializeAdaptiveThresholds();
    debugPrint("✅ JankMonitor 初始化成功");
  }

  /// 初始化自适应阈值
  void _initializeAdaptiveThresholds() {
    const double defaultRefreshRate = 60.0;
    // 使用 PlatformDispatcher 替代已弃用的 window
    final double refreshRate = SchedulerBinding
        .instance
        .platformDispatcher
        .views
        .first
        .display
        .refreshRate;
    _frameBudgetMs =
        1000 / (refreshRate > 0 ? refreshRate : defaultRefreshRate);

    // 根据配置和帧预算计算阈值
    _jankThresholdMs = _frameBudgetMs * _config.jankFrameTimeMultiplier;
    _consecutiveJankThreshold = _config.consecutiveJankThreshold;

    debugPrint("JankMonitor initialized with adaptive thresholds:");
    debugPrint("- Frame budget: ${_frameBudgetMs.toStringAsFixed(2)}ms");
    debugPrint("- Jank threshold: ${_jankThresholdMs.toStringAsFixed(2)}ms");
    debugPrint("- Consecutive threshold: $_consecutiveJankThreshold frames");
    debugPrint("- Jitter tolerance: ${_config.jitterToleranceMs}ms");
  }

  /// 记录一批 frame timings 并检测连续卡顿。
  ///
  /// 为降低监控自身开销，当前按固定采样率处理帧数据；达到连续慢帧阈值后生成
  /// `ui.jank.sequence`。
  void recordTimings(List<FrameTiming> timings) {
    // 采样控制：不是每帧都处理，减少性能影响
    _frameCounter++;
    if (_frameCounter % _samplingRate != 0) return;

    for (final timing in timings) {
      final totalDuration = timing.totalSpan.inMicroseconds / 1000.0;

      // 更新性能统计
      _updatePerformanceStats(totalDuration);

      // 使用自适应阈值判断卡顿
      if (_isJankFrame(totalDuration)) {
        _handleJankFrame(totalDuration);
      } else {
        _handleSmoothFrame();
      }
    }
  }

  /// 更新性能统计信息
  void _updatePerformanceStats(double frameTime) {
    _recentFrameTimes.add(frameTime);
    if (_recentFrameTimes.length > _frameHistorySize) {
      _recentFrameTimes.removeAt(0);
    }

    // 计算平均帧时间和方差
    if (_recentFrameTimes.isNotEmpty) {
      _averageFrameTime =
          _recentFrameTimes.reduce((a, b) => a + b) / _recentFrameTimes.length;
      _frameTimeVariance = _calculateVariance(
        _recentFrameTimes,
        _averageFrameTime,
      );
    }
  }

  /// 计算方差
  double _calculateVariance(List<double> values, double mean) {
    if (values.isEmpty) return 0.0;
    final sum = values.map((x) => pow(x - mean, 2)).reduce((a, b) => a + b);
    return sum / values.length;
  }

  /// 判断是否为卡顿帧（使用自适应阈值）
  bool _isJankFrame(double frameTime) {
    // 基础阈值判断
    if (frameTime <= _jankThresholdMs) return false;

    // 抖动容忍：如果帧时间在抖动容忍范围内，不算卡顿
    if (frameTime <= _jankThresholdMs + _config.jitterToleranceMs) {
      // 检查是否在正常抖动范围内
      final jitterThreshold = _averageFrameTime + 2 * sqrt(_frameTimeVariance);
      return frameTime > jitterThreshold;
    }

    return true;
  }

  /// 处理卡顿帧
  void _handleJankFrame(double frameTime) {
    _consecutiveJankFrames++;
    _maxJankDurationInSequence = max(_maxJankDurationInSequence, frameTime);
    _totalJankDurationInSequence += frameTime;
  }

  /// 处理流畅帧
  void _handleSmoothFrame() {
    // 如果之前有卡顿序列，检查是否需要上报
    if (_consecutiveJankFrames > 0) {
      _checkAndReportJankSequence();
    }
  }

  /// 检查并上报卡顿序列（带防抖）
  void _checkAndReportJankSequence() {
    final now = DateTime.now();

    // 防抖：如果距离上次卡顿时间太近，不重复上报
    if (_lastJankTime != null &&
        now.difference(_lastJankTime!) < _config.jankDebounce) {
      _resetJankState();
      return;
    }

    // 如果连续卡顿的帧数达到了阈值
    if (_consecutiveJankFrames >= _consecutiveJankThreshold &&
        !_jankSequenceReported) {
      _reportJankSequence();
    }

    _resetJankState();
  }

  /// 上报卡顿序列
  void _reportJankSequence() {
    // 计算详细的性能指标
    final metrics = PerformanceMetrics.fromFrameTimes(_recentFrameTimes);

    /// 核心卡顿数据
    /// type: 事件类型
    /// page: 当前页面
    /// jank_count: 连续卡顿帧数
    /// max_duration_ms: 最严重一帧耗时
    /// average_duration_ms: 平均每帧耗时
    /// frame_budget_ms: 帧预算时间
    /// jank_threshold_ms: 卡顿阈值
    /// device_performance: 设备性能指标
    ///
    /// 设备性能分析
    /// average_frame_time_ms: 平均帧时间
    /// frame_time_variance: 帧时间方差
    /// fps: 实际帧率
    /// stability: 稳定性指标
    /// percentiles: 帧时间百分位数
    /// anomalous_frame_count: 异常帧数
    /// device_level: 设备性能等级
    /// recent_frame_count: 最近帧数
    ///

    final data = <String, Object?>{
      PayloadKeys.type: EventNames.uiJankSequence,
      PayloadKeys.page: _getCurrentPage?.call() ?? 'unknown',
      PayloadKeys.jankCount: _consecutiveJankFrames,
      PayloadKeys.maxDurationMs: _maxJankDurationInSequence,
      PayloadKeys.averageDurationMs:
          _totalJankDurationInSequence / _consecutiveJankFrames,
      PayloadKeys.frameBudgetMs: _frameBudgetMs,
      PayloadKeys.jankThresholdMs: _jankThresholdMs,
      PayloadKeys.devicePerformance: {
        PayloadKeys.averageFrameTimeMs: metrics.averageFrameTime,
        PayloadKeys.frameTimeVariance: metrics.frameTimeVariance,
        PayloadKeys.fps: metrics.fps,
        PayloadKeys.stability: metrics.stability,
        PayloadKeys.percentiles: metrics.percentiles,
        PayloadKeys.anomalousFrameCount: metrics.anomalousFrames.length,
        PayloadKeys.deviceLevel: metrics.deviceLevel.name,
        PayloadKeys.recentFrameCount: _recentFrameTimes.length,
      },
    };

    final percentiles = metrics.percentiles;
    _reporter.recordJankSequence(
      frameCount: _consecutiveJankFrames,
      frameMaxMs: _maxJankDurationInSequence,
      frameAvgMs: _totalJankDurationInSequence / _consecutiveJankFrames,
      frameBudgetMs: _frameBudgetMs,
      frameFps: metrics.fps,
      frameStability: metrics.stability,
      frameP50Ms: percentiles['p50'],
      frameP90Ms: percentiles['p90'],
      frameP99Ms: percentiles['p99'],
      payload: data,
    );
    _onJankSequenceReported?.call();
    _lastJankTime = DateTime.now();
    _jankSequenceReported = true;
  }

  /// 重置卡顿状态
  void _resetJankState() {
    _consecutiveJankFrames = 0;
    _maxJankDurationInSequence = 0;
    _totalJankDurationInSequence = 0;
    _jankSequenceReported = false;
  }

  /// 清理内部采样窗口和卡顿状态。
  void dispose() {
    // 清理数据，防止内存泄漏
    _recentFrameTimes.clear();
    _resetJankState();
  }
}
