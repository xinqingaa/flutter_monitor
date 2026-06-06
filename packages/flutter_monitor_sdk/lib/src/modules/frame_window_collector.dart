import 'dart:math';

import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart'
    show PageActivitySnapshot;

/// 页面帧窗口类型。
///
/// 当前 SDK 只聚合页面活动窗口，后续可扩展 app/window/interaction 等窗口类型。
const pageFrameWindowType = 'page';

/// 页面活动期间的 frame timing 聚合器。
///
/// 页面进入或恢复时打开窗口，页面被覆盖、退出、后台或 dispose 时关闭窗口，
/// 并输出 [FrameStatsSnapshot]。Reporter 会把快照合并到页面 trace 的
/// `frame.*` attributes 中，作为页面性能排查证据。
class FrameWindowCollector {
  /// 创建 frame window collector。
  ///
  /// [onPageWindowFinished] 在窗口闭合且至少有一个 frame 样本时触发。
  FrameWindowCollector({this.onPageWindowFinished});

  /// 页面窗口完成后的回调。
  final void Function(FrameStatsSnapshot snapshot)? onPageWindowFinished;
  final Map<String, _FrameWindow> _windows = <String, _FrameWindow>{};

  /// 当前视图刷新率。
  ///
  /// 读取不到有效值时使用 60Hz，保证 frame budget 计算有稳定兜底。
  double get refreshRate {
    final views = SchedulerBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return 60;
    final value = views.first.display.refreshRate;
    return value > 0 ? value : 60;
  }

  /// 当前刷新率对应的单帧预算，单位毫秒。
  double get frameBudgetMs => 1000 / refreshRate;

  /// 为页面活动打开一个 frame 聚合窗口。
  void startPageWindow(PageActivitySnapshot activity) {
    if (_windows.containsKey(pageFrameWindowType)) return;
    _windows[pageFrameWindowType] = _FrameWindow(
      type: pageFrameWindowType,
      startedAt: activity.timestamp,
      refreshRate: refreshRate,
      routeName: activity.routeName,
      traceId: activity.traceId,
      pageInstanceId: activity.pageInstanceId,
    );
  }

  /// 记录一批 Flutter frame timings。
  ///
  /// 所有已打开窗口都会收到样本，当前主要用于页面窗口。
  void recordTimings(List<FrameTiming> timings) {
    if (_windows.isEmpty) return;
    for (final timing in timings) {
      final durationMs = timing.totalSpan.inMicroseconds / 1000.0;
      for (final window in _windows.values) {
        window.add(durationMs);
      }
    }
  }

  /// 闭合页面窗口并输出快照。
  ///
  /// [phase] 用于说明窗口为什么结束，例如页面退出、被覆盖、进入后台或 SDK dispose。
  void finishPageWindow(String phase, {DateTime? timestamp}) {
    final window = _windows.remove(pageFrameWindowType);
    if (window == null) return;
    final snapshot = _snapshot(window, phase: phase, timestamp: timestamp);
    if (snapshot != null) onPageWindowFinished?.call(snapshot);
  }

  /// SDK dispose 时闭合仍未结束的页面 frame 窗口。
  void dispose({DateTime? timestamp}) {
    finishPageWindow(PageActivePhases.appDispose, timestamp: timestamp);
  }

  FrameStatsSnapshot? _snapshot(
    _FrameWindow window, {
    required String phase,
    DateTime? timestamp,
  }) {
    if (window.sampleCount == 0) return null;
    final endedAt = timestamp ?? DateTime.now();
    final percentiles = window.percentiles();
    return FrameStatsSnapshot(
      windowType: window.type,
      windowPhase: phase,
      sampleCount: window.sampleCount,
      slowCount: window.slowCount,
      droppedCount: window.droppedCount,
      refreshRate: window.refreshRate,
      frameMaxMs: window.maxMs,
      frameAvgMs: window.avgMs,
      frameBudgetMs: window.frameBudgetMs,
      frameFps: window.fps,
      frameStability: window.stability,
      frameP50Ms: percentiles[50],
      frameP90Ms: percentiles[90],
      frameP99Ms: percentiles[99],
      routeName: window.routeName,
      traceId: window.traceId,
      pageInstanceId: window.pageInstanceId,
      startTime: window.startedAt,
      endTime: endedAt,
    );
  }
}

/// 一段页面 frame window 的统计快照。
///
/// 该对象仍是 SDK 内部中间态；最终会通过 [toAttributes] 转为 core 注册的
/// `frame.*` / `page.*` attributes，合并到页面 trace 或相关事件。
class FrameStatsSnapshot {
  const FrameStatsSnapshot({
    required this.windowType,
    required this.windowPhase,
    required this.sampleCount,
    required this.slowCount,
    required this.droppedCount,
    required this.refreshRate,
    required this.frameMaxMs,
    required this.frameAvgMs,
    required this.frameBudgetMs,
    this.frameFps,
    this.frameStability,
    this.frameP50Ms,
    this.frameP90Ms,
    this.frameP99Ms,
    this.routeName,
    this.traceId,
    this.pageInstanceId,
    this.startTime,
    this.endTime,
  });

  /// 窗口类型，例如 `page`。
  final String windowType;

  /// 窗口结束阶段，例如 `exit`、`covered`、`lifecycle.background`。
  final String windowPhase;

  /// 收集到的 frame 样本数。
  final int sampleCount;

  /// 超过 frame budget 的慢帧数。
  final int slowCount;

  /// 按 frame budget 估算出的掉帧数。
  final int droppedCount;

  /// 当前刷新率。
  final num refreshRate;

  /// 最大帧耗时，单位毫秒。
  final num frameMaxMs;

  /// 平均帧耗时，单位毫秒。
  final num frameAvgMs;

  /// 当前刷新率对应的单帧预算，单位毫秒。
  final num frameBudgetMs;

  /// 估算 FPS。
  final num? frameFps;

  /// 帧稳定性，越接近 1 越稳定。
  final num? frameStability;

  /// P50 帧耗时。
  final num? frameP50Ms;

  /// P90 帧耗时。
  final num? frameP90Ms;

  /// P99 帧耗时。
  final num? frameP99Ms;

  /// 快照对应的 route name。
  final String? routeName;

  /// 快照对应的页面 trace id。
  final String? traceId;

  /// 页面实例 id，用于区分同名 route 的多次打开。
  final String? pageInstanceId;

  /// 窗口开始时间。
  final DateTime? startTime;

  /// 窗口结束时间。
  final DateTime? endTime;

  /// 转换为 core 注册过的 attributes。
  Map<String, Object?> toAttributes() {
    return <String, Object?>{
      FieldPaths.frameSampleCount: sampleCount,
      FieldPaths.frameSlowCount: slowCount,
      FieldPaths.frameDroppedCount: droppedCount,
      FieldPaths.frameRefreshRate: refreshRate,
      FieldPaths.frameMaxMs: frameMaxMs,
      FieldPaths.frameAvgMs: frameAvgMs,
      FieldPaths.frameBudgetMs: frameBudgetMs,
      if (frameFps != null) FieldPaths.frameFps: frameFps,
      if (frameStability != null) FieldPaths.frameStability: frameStability,
      if (frameP50Ms != null) FieldPaths.frameP50Ms: frameP50Ms,
      if (frameP90Ms != null) FieldPaths.frameP90Ms: frameP90Ms,
      if (frameP99Ms != null) FieldPaths.frameP99Ms: frameP99Ms,
      if (pageInstanceId != null) FieldPaths.pageInstanceId: pageInstanceId,
    };
  }
}

class _FrameWindow {
  _FrameWindow({
    required this.type,
    required this.startedAt,
    required this.refreshRate,
    this.routeName,
    this.traceId,
    this.pageInstanceId,
  });

  final String type;
  final DateTime startedAt;
  final double refreshRate;
  final String? routeName;
  final String? traceId;
  final String? pageInstanceId;
  final List<double> _samples = <double>[];
  var sampleCount = 0;
  var slowCount = 0;
  var droppedCount = 0;
  var totalMs = 0.0;
  var maxMs = 0.0;

  double get frameBudgetMs => 1000 / refreshRate;
  double get avgMs => sampleCount == 0 ? 0 : totalMs / sampleCount;
  double get fps => avgMs <= 0 ? refreshRate : min(refreshRate, 1000 / avgMs);
  double get stability => sampleCount == 0 ? 1 : 1 - slowCount / sampleCount;

  void add(double durationMs) {
    sampleCount++;
    totalMs += durationMs;
    maxMs = max(maxMs, durationMs);
    if (durationMs > frameBudgetMs) slowCount++;
    droppedCount += max(0, durationMs ~/ frameBudgetMs - 1);
    _samples.add(durationMs);
  }

  Map<int, double> percentiles() {
    if (_samples.isEmpty) return const <int, double>{};
    final sorted = List<double>.of(_samples)..sort();
    return <int, double>{
      50: _percentile(sorted, 0.50),
      90: _percentile(sorted, 0.90),
      99: _percentile(sorted, 0.99),
    };
  }

  double _percentile(List<double> sorted, double percentile) {
    if (sorted.length == 1) return sorted.first;
    final index = ((sorted.length - 1) * percentile).round();
    return sorted[index.clamp(0, sorted.length - 1)];
  }
}
