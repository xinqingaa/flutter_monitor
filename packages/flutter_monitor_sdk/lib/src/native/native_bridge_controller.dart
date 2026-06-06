import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/native/monitor_native_bridge.dart';

/// native bridge 生命周期控制器。
///
/// 负责订阅 [MonitorNativeBridge.signals]、转发 native signal 给 Reporter，并按需拉取
/// native memory snapshot。它是 SDK 与可选 native plugin 之间的运行时适配层。
class NativeBridgeController {
  /// 创建 native bridge controller。
  NativeBridgeController({
    required MonitorNativeBridge bridge,
    required Reporter reporter,
    Duration minSampleInterval = const Duration(seconds: 30),
  }) : _bridge = bridge,
       _reporter = reporter,
       _minSampleInterval = minSampleInterval;

  final MonitorNativeBridge _bridge;
  final Reporter _reporter;
  final Duration _minSampleInterval;
  StreamSubscription<NativeSignal>? _subscription;
  DateTime? _lastSampleAt;

  /// 初始化 native bridge 订阅，并在 session start 时尝试采集一次 native memory。
  Future<void> init() async {
    _subscription = _bridge.signals.listen(
      _reporter.recordNativeSignal,
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('Error while reading native monitor signal: $error');
      },
    );
    await recordMemorySample(trigger: TriggerValues.sessionStart);
  }

  /// 主动采集 native memory snapshot。
  ///
  /// 默认按最小间隔限流；[force] 为 true 时跳过限流，适合关键生命周期节点。
  Future<void> recordMemorySample({
    required String trigger,
    bool force = false,
  }) async {
    final now = DateTime.now();
    if (!force &&
        _lastSampleAt != null &&
        now.difference(_lastSampleAt!) < _minSampleInterval) {
      return;
    }
    NativeMemorySnapshot? memory;
    try {
      memory = await _bridge.getMemorySnapshot();
    } catch (error) {
      debugPrint('Native memory snapshot unavailable: $error');
      return;
    }
    if (memory == null) return;
    _lastSampleAt = now;
    _reporter.recordNativeSignal(
      NativeSignal(
        type: NativeSignalType.memory,
        name: EventNames.nativeMemorySample,
        timestamp: now,
        resource: await _safeResourceSnapshot(),
        memory: memory,
        priority: EventPriority.normal,
        payload: <String, Object?>{
          PayloadKeys.trigger: trigger,
          ...memory.toJson(),
        },
      ),
    );
  }

  /// 取消 native signal 订阅并释放 bridge。
  Future<void> dispose() async {
    await Future.wait(<Future<void>>[
      _subscription?.cancel() ?? Future<void>.value(),
      _bridge.dispose(),
    ]);
  }

  Future<NativeResourceSnapshot?> _safeResourceSnapshot() async {
    try {
      return _bridge.getResourceSnapshot();
    } catch (error) {
      debugPrint('Native resource snapshot unavailable: $error');
      return null;
    }
  }
}
