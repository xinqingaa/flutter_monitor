import 'package:flutter_monitor_core/flutter_monitor_core.dart';

class ContextSnapshot {
  const ContextSnapshot({
    required this.resource,
    required this.context,
    this.customData,
    this.userProperties,
  });

  final MonitorResource resource;
  final MonitorContext context;
  final Map<String, Object?>? customData;
  final Map<String, Object?>? userProperties;
}
