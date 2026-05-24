import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// Optional native bridge entry point.
///
/// Phase 0 only reserves the package boundary. Native memory, lifecycle, OOM,
/// ANR, and crash signals will be mapped through the shared core model in later
/// phases.
class FlutterMonitorNative {
  const FlutterMonitorNative();

  String get corePackageName => flutterMonitorCorePackageName;
}
