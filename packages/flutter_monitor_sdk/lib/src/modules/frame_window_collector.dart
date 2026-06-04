import 'dart:async';
import 'dart:math';

import 'package:flutter/scheduler.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart'
    show PageActivitySnapshot;

const appFrameWindowType = 'app';
const pageFrameWindowType = 'page';

class FrameWindowCollector {
  FrameWindowCollector({
    this.onAppWindowFinished,
    this.onPageWindowFinished,
    this.startupFrameTimingTimeout = const Duration(milliseconds: 250),
  });

  final void Function(FrameStatsSnapshot snapshot)? onAppWindowFinished;
  final void Function(FrameStatsSnapshot snapshot)? onPageWindowFinished;
  final Duration startupFrameTimingTimeout;
  final Map<String, _FrameWindow> _windows = <String, _FrameWindow>{};
  _PendingAppWindowFinish? _pendingAppWindowFinish;

  double get refreshRate {
    final views = SchedulerBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return 60;
    final value = views.first.display.refreshRate;
    return value > 0 ? value : 60;
  }

  double get frameBudgetMs => 1000 / refreshRate;

  void startAppWindow({DateTime? timestamp}) {
    if (_windows.containsKey(appFrameWindowType)) return;
    _windows[appFrameWindowType] = _FrameWindow(
      type: appFrameWindowType,
      startedAt: timestamp ?? DateTime.now(),
      refreshRate: refreshRate,
    );
  }

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

  void recordTimings(List<FrameTiming> timings) {
    if (_windows.isEmpty) return;
    for (final timing in timings) {
      final durationMs = timing.totalSpan.inMicroseconds / 1000.0;
      for (final window in _windows.values) {
        window.add(durationMs);
      }
    }
    _finishPendingAppWindow();
  }

  void finishPageWindow(String phase, {DateTime? timestamp}) {
    final window = _windows.remove(pageFrameWindowType);
    if (window == null) return;
    final snapshot = _snapshot(window, phase: phase, timestamp: timestamp);
    if (snapshot != null) onPageWindowFinished?.call(snapshot);
  }

  void finishAppWindow(String phase, {DateTime? timestamp}) {
    _pendingAppWindowFinish?.complete();
    _pendingAppWindowFinish = null;
    final window = _windows.remove(appFrameWindowType);
    if (window == null) return;
    final snapshot = _snapshot(window, phase: phase, timestamp: timestamp);
    if (snapshot != null) onAppWindowFinished?.call(snapshot);
  }

  Future<void> finishAppWindowAfterNextTiming(
    String phase, {
    DateTime? timestamp,
  }) {
    final window = _windows[appFrameWindowType];
    if (window == null) return Future<void>.value();
    if (window.sampleCount > 0) {
      finishAppWindow(phase, timestamp: timestamp);
      return Future<void>.value();
    }
    final existing = _pendingAppWindowFinish;
    if (existing != null) return existing.done;

    final pending = _PendingAppWindowFinish(phase: phase, timestamp: timestamp);
    _pendingAppWindowFinish = pending;
    pending.timer = Timer(startupFrameTimingTimeout, _finishPendingAppWindow);
    return pending.done;
  }

  void dispose({DateTime? timestamp}) {
    finishPageWindow(PageActivePhases.appDispose, timestamp: timestamp);
    finishAppWindow(PageActivePhases.appDispose, timestamp: timestamp);
  }

  void _finishPendingAppWindow() {
    final pending = _pendingAppWindowFinish;
    if (pending == null) return;
    _pendingAppWindowFinish = null;
    pending.complete();
    finishAppWindow(pending.phase, timestamp: pending.timestamp);
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

class _PendingAppWindowFinish {
  _PendingAppWindowFinish({required this.phase, this.timestamp});

  final String phase;
  final DateTime? timestamp;
  final Completer<void> _completer = Completer<void>();
  Timer? timer;

  Future<void> get done => _completer.future;

  void complete() {
    timer?.cancel();
    timer = null;
    if (!_completer.isCompleted) {
      _completer.complete();
    }
  }
}

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

  final String windowType;
  final String windowPhase;
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
  final String? routeName;
  final String? traceId;
  final String? pageInstanceId;
  final DateTime? startTime;
  final DateTime? endTime;

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
