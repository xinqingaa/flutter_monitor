import 'package:flutter_monitor_core/flutter_monitor_core.dart';

abstract interface class MonitorNativeBridge {
  Stream<NativeSignal> get signals;

  Future<NativeResourceSnapshot> getResourceSnapshot();

  Future<NativeMemorySnapshot?> getMemorySnapshot();

  Future<void> dispose();
}

class NoopMonitorNativeBridge implements MonitorNativeBridge {
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
