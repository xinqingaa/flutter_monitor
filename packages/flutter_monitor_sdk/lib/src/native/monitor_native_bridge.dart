import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// SDK 与可选 native plugin 之间的桥接接口。
///
/// native 层只负责提供平台事实，例如 native memory、memory pressure、
/// native lifecycle、OOM/ANR/crash 线索。它不得直接上报，也不得创建第二套
/// session、trace 或 event model。所有 native 信号最终都由 SDK 映射进统一
/// `EventEnvelope`。
abstract interface class MonitorNativeBridge {
  /// native 运行时持续产生的信号流。
  Stream<NativeSignal> get signals;

  /// 启动期 native resource 快照。
  ///
  /// SDK 会在首批 envelope 前短超时读取一次，用于填充 `context.native.*`
  /// 和 `resource.sdk.nativeVersion`。
  Future<NativeResourceSnapshot> getResourceSnapshot();

  /// 当前 native memory 快照。
  ///
  /// jank、lifecycle 或 memory collector 可按需触发采样。
  Future<NativeMemorySnapshot?> getMemorySnapshot();

  /// 释放 native bridge 资源。
  Future<void> dispose();
}

/// 空 native bridge 实现。
///
/// 用于测试或 Flutter-only 降级路径。它表示 native 能力不可用，但不会影响
/// Flutter/Dart 层监控链路。
class NoopMonitorNativeBridge implements MonitorNativeBridge {
  /// 创建空 native bridge。
  const NoopMonitorNativeBridge();

  @override
  Stream<NativeSignal> get signals => const Stream<NativeSignal>.empty();

  @override
  Future<NativeResourceSnapshot> getResourceSnapshot() async {
    return const NativeResourceSnapshot(
      available: false,
      signalSource: PlatformSignalSources.flutter,
    );
  }

  @override
  Future<NativeMemorySnapshot?> getMemorySnapshot() async => null;

  @override
  Future<void> dispose() async {}
}
