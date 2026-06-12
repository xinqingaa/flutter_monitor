import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/delivery/reliable_http_output.dart';
import 'package:flutter_monitor_sdk/src/delivery/sdk_health_monitor.dart';
import 'package:flutter_monitor_sdk/src/delivery/sqlite_offline_event_queue.dart';

import 'log_monitor_output.dart';
import 'monitor_output.dart';

List<MonitorOutput> resolveMonitorOutputs(
  MonitorConfig config, {
  SdkHealthMonitor? healthMonitor,
}) {
  final mode = config.mode;
  if (mode.name == SdkOutputModes.consoleOnly) {
    return <MonitorOutput>[LogMonitorOutput(mode: mode.logMode)];
  }

  final endpoint = mode.endpoint;
  if (endpoint != null &&
      (mode.name == SdkOutputModes.localLive ||
          mode.name == SdkOutputModes.production)) {
    return <MonitorOutput>[
      ReliableHttpOutput(
        endpoint: endpoint,
        mode: mode.name,
        policy: mode.productionPolicy,
        authTokenProvider: mode.authTokenProvider,
        queue: SqliteOfflineEventQueue(policy: mode.productionPolicy),
        healthMonitor: healthMonitor,
      ),
    ];
  }

  return const <MonitorOutput>[];
}
