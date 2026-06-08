import 'dart:async';
import 'dart:math';

import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

/// 业务交互性能观测完成后的快照。
///
/// Collector 只负责窗口与 frame timing 聚合；最终 envelope 由 Reporter 写入
/// 统一 pipeline。
class InteractionMeasureSnapshot {
  const InteractionMeasureSnapshot({
    required this.id,
    required this.action,
    required this.mode,
    required this.result,
    required this.endReason,
    required this.startedAt,
    required this.endedAt,
    required this.observedUntil,
    required this.observeFor,
    required this.timeout,
    required this.target,
    required this.properties,
    required this.finishProperties,
    required this.sampleCount,
    required this.slowCount,
    required this.droppedCount,
    required this.refreshRate,
    required this.frameMaxMs,
    required this.frameAvgMs,
    required this.frameBudgetMs,
    required this.frameFps,
    required this.frameStability,
    required this.frameP50Ms,
    required this.frameP90Ms,
    required this.frameP99Ms,
    required this.sampleStatus,
    this.cancelReason,
  });

  final String id;
  final String action;
  final MonitorMeasureMode mode;
  final MonitorMeasureResult result;
  final String endReason;
  final DateTime startedAt;
  final DateTime endedAt;
  final DateTime observedUntil;
  final Duration observeFor;
  final Duration timeout;
  final String? target;
  final Map<String, Object?> properties;
  final Map<String, Object?> finishProperties;
  final int sampleCount;
  final int slowCount;
  final int droppedCount;
  final num refreshRate;
  final num frameMaxMs;
  final num frameAvgMs;
  final num frameBudgetMs;
  final num? frameFps;
  final num? frameStability;
  final num? frameP50Ms;
  final num? frameP90Ms;
  final num? frameP99Ms;
  final String sampleStatus;
  final String? cancelReason;

  Duration get activeDuration => endedAt.difference(startedAt);
  Duration get observedDuration => observedUntil.difference(startedAt);
  Duration get settleDuration => observedUntil.difference(endedAt);

  Map<String, Object?> frameAttributes({required int minSampleCount}) {
    if (sampleCount < minSampleCount) return const <String, Object?>{};
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
    };
  }

  Map<String, Object?> frameSummary() {
    return <String, Object?>{
      PayloadKeys.sampleCount: sampleCount,
      PayloadKeys.sampleStatus: sampleStatus,
      if (sampleCount > 0) ...<String, Object?>{
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
      },
    };
  }
}

/// 业务交互性能观测 handle。
///
/// common 模式可忽略该 handle；stage 模式应在业务阶段完成时调用 [finish] 或
/// [cancel]。重复调用会被忽略。
class MonitorMeasureHandle {
  MonitorMeasureHandle._({
    required this.id,
    required this.action,
    required this.mode,
    InteractionMeasureCollector? collector,
  }) : _collector = collector;

  /// 创建一个无效 handle。
  ///
  /// SDK 未初始化或 interaction collector 未启用时返回，调用 finish/cancel 无副作用。
  MonitorMeasureHandle.disabled({
    required String action,
    required MonitorMeasureMode mode,
  }) : this._(id: '', action: action, mode: mode);

  /// 当前观测窗口 id。
  final String id;

  /// 稳定业务动作名。
  final String action;

  /// 观测模式。
  final MonitorMeasureMode mode;

  final InteractionMeasureCollector? _collector;

  /// 结束 stage 观测窗口。
  ///
  /// common 模式调用该方法没有效果。
  void finish({
    MonitorMeasureResult result = MonitorMeasureResult.success,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    _collector?.finish(id, result: result, properties: properties);
  }

  /// 取消 stage 观测窗口。
  ///
  /// common 模式调用该方法没有效果。
  void cancel({String? reason}) {
    _collector?.cancel(id, reason: reason);
  }
}

/// 业务交互性能观测窗口聚合器。
class InteractionMeasureCollector {
  InteractionMeasureCollector({
    required MonitorInteractionConfig config,
    required void Function(InteractionMeasureSnapshot snapshot) onFinished,
  }) : _config = config,
       _onFinished = onFinished;

  final MonitorInteractionConfig _config;
  final void Function(InteractionMeasureSnapshot snapshot) _onFinished;
  final Map<String, _InteractionWindow> _windows =
      <String, _InteractionWindow>{};
  var _nextId = 0;

  /// 当前是否启用业务交互性能观测。
  bool get enabled => _config.enabled;

  /// 当前视图刷新率。
  double get refreshRate {
    final views = SchedulerBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return 60;
    final value = views.first.display.refreshRate;
    return value > 0 ? value : 60;
  }

  /// 开启一次业务交互性能观测。
  MonitorMeasureHandle measure({
    required String action,
    MonitorMeasureMode mode = MonitorMeasureMode.common,
    String? target,
    Map<String, Object?> properties = const <String, Object?>{},
    Duration? observeFor,
    Duration? timeout,
  }) {
    if (!_config.enabled ||
        _config.maxConcurrent <= 0 ||
        action.trim().isEmpty) {
      return MonitorMeasureHandle._(
        id: '',
        action: action,
        mode: mode,
        collector: this,
      );
    }
    if (_windows.length >= _config.maxConcurrent) {
      _finishOldest(
        InteractionEndReasons.timeout,
        MonitorMeasureResult.timeout,
      );
    }
    final now = DateTime.now();
    final id = 'measure_${now.microsecondsSinceEpoch}_${_nextId++}';
    final effectiveObserveFor =
        observeFor ??
        (mode == MonitorMeasureMode.common
            ? _config.commonObserveFor
            : _config.stageSettleWindow);
    final effectiveTimeout = timeout ?? _config.stageTimeout;
    final window = _InteractionWindow(
      id: id,
      action: action,
      mode: mode,
      target: target,
      properties: properties,
      startedAt: now,
      refreshRate: refreshRate,
      observeFor: effectiveObserveFor,
      timeout: effectiveTimeout,
    );
    _windows[id] = window;
    if (mode == MonitorMeasureMode.common) {
      window.timer = Timer(effectiveObserveFor, () {
        _finish(
          id,
          endReason: InteractionEndReasons.autoWindow,
          result: MonitorMeasureResult.success,
        );
      });
    } else {
      window.timer = Timer(effectiveTimeout, () {
        _finish(
          id,
          endReason: InteractionEndReasons.timeout,
          result: MonitorMeasureResult.timeout,
        );
      });
    }
    return MonitorMeasureHandle._(
      id: id,
      action: action,
      mode: mode,
      collector: this,
    );
  }

  /// 记录一批 Flutter frame timings。
  void recordTimings(List<FrameTiming> timings) {
    if (_windows.isEmpty) return;
    for (final timing in timings) {
      final durationMs = timing.totalSpan.inMicroseconds / 1000.0;
      for (final window in _windows.values) {
        window.add(durationMs);
      }
    }
  }

  void finish(
    String id, {
    MonitorMeasureResult result = MonitorMeasureResult.success,
    Map<String, Object?> properties = const <String, Object?>{},
  }) {
    final window = _windows[id];
    if (window == null || window.mode != MonitorMeasureMode.stage) return;
    if (window.endedAt != null) return;
    window.endedAt = DateTime.now();
    window.finishProperties.addAll(properties);
    window.timer?.cancel();
    window.timer = Timer(window.observeFor, () {
      _finish(id, endReason: InteractionEndReasons.finish, result: result);
    });
  }

  void cancel(String id, {String? reason}) {
    final window = _windows[id];
    if (window == null || window.mode != MonitorMeasureMode.stage) return;
    if (window.endedAt != null) return;
    window.endedAt = DateTime.now();
    window.cancelReason = reason;
    _finish(
      id,
      endReason: InteractionEndReasons.cancel,
      result: MonitorMeasureResult.cancelled,
    );
  }

  /// dispose 时闭合仍未结束的窗口。
  void dispose() {
    final ids = _windows.keys.toList(growable: false);
    for (final id in ids) {
      _finish(
        id,
        endReason: InteractionEndReasons.dispose,
        result: MonitorMeasureResult.cancelled,
      );
    }
  }

  void _finishOldest(String endReason, MonitorMeasureResult result) {
    if (_windows.isEmpty) return;
    final oldest = _windows.values.reduce((a, b) {
      return a.startedAt.isBefore(b.startedAt) ? a : b;
    });
    _finish(oldest.id, endReason: endReason, result: result);
  }

  void _finish(
    String id, {
    required String endReason,
    required MonitorMeasureResult result,
  }) {
    final window = _windows.remove(id);
    if (window == null) return;
    window.timer?.cancel();
    final now = DateTime.now();
    final endedAt = window.endedAt ?? now;
    final observedUntil = now;
    _onFinished(
      window.snapshot(
        result: result,
        endReason: endReason,
        endedAt: endedAt,
        observedUntil: observedUntil,
        minSampleCount: _config.minSampleCount,
      ),
    );
  }
}

class _InteractionWindow {
  _InteractionWindow({
    required this.id,
    required this.action,
    required this.mode,
    required this.startedAt,
    required this.refreshRate,
    required this.observeFor,
    required this.timeout,
    this.target,
    Map<String, Object?> properties = const <String, Object?>{},
  }) : properties = Map<String, Object?>.from(properties);

  final String id;
  final String action;
  final MonitorMeasureMode mode;
  final DateTime startedAt;
  final double refreshRate;
  final Duration observeFor;
  final Duration timeout;
  final String? target;
  final Map<String, Object?> properties;
  final Map<String, Object?> finishProperties = <String, Object?>{};
  final List<double> _samples = <double>[];
  Timer? timer;
  DateTime? endedAt;
  String? cancelReason;
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

  InteractionMeasureSnapshot snapshot({
    required MonitorMeasureResult result,
    required String endReason,
    required DateTime endedAt,
    required DateTime observedUntil,
    required int minSampleCount,
  }) {
    this.endedAt ??= endedAt;
    final percentiles = _percentiles();
    final sampleStatus = sampleCount >= minSampleCount
        ? 'ok'
        : 'insufficient_samples';
    return InteractionMeasureSnapshot(
      id: id,
      action: action,
      mode: mode,
      result: result,
      endReason: endReason,
      startedAt: startedAt,
      endedAt: this.endedAt!,
      observedUntil: observedUntil,
      observeFor: observeFor,
      timeout: timeout,
      target: target,
      properties: properties,
      finishProperties: finishProperties,
      sampleCount: sampleCount,
      slowCount: slowCount,
      droppedCount: droppedCount,
      refreshRate: refreshRate,
      frameMaxMs: maxMs,
      frameAvgMs: avgMs,
      frameBudgetMs: frameBudgetMs,
      frameFps: sampleCount == 0 ? null : fps,
      frameStability: sampleCount == 0 ? null : stability,
      frameP50Ms: percentiles[50],
      frameP90Ms: percentiles[90],
      frameP99Ms: percentiles[99],
      sampleStatus: sampleStatus,
      cancelReason: cancelReason,
    );
  }

  Map<int, double> _percentiles() {
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
