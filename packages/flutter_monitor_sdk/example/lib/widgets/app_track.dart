import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

String? _lastSnackAction;
DateTime? _lastSnackAt;

void appTrack(
  BuildContext context, {
  required String action,
  MonitorTrackResult result = MonitorTrackResult.success,
  MonitorEventLevel? level,
  String? target,
  String? error,
  Map<String, Object?> properties = const <String, Object?>{},
  String? message,
}) {
  FlutterMonitorSDK.track(
    action: action,
    result: result,
    level: level,
    target: target,
    error: error,
    properties: properties,
  );

  final now = DateTime.now();
  if (_lastSnackAction == action &&
      _lastSnackAt != null &&
      now.difference(_lastSnackAt!) < const Duration(seconds: 2)) {
    return;
  }
  _lastSnackAction = action;
  _lastSnackAt = now;

  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message ?? '已上报 $action'),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ),
  );
}
