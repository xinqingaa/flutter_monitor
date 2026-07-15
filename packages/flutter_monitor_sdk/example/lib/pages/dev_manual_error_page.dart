import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

/// 主动调用 SDK recordError / track failed，不靠抛异常。
class DevManualErrorPage extends StatelessWidget {
  const DevManualErrorPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devManualError,
      moduleName: 'debug',
      moduleScene: 'dev_manual_error',
      child: Scaffold(
        appBar: AppBar(title: const Text('手动 recordError')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text(
                '不抛异常，直接走业务上报入口，验证 handled error 与业务失败埋点。',
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  FlutterMonitorSDK.recordError(
                    StateError('dev manual handled error'),
                    stackTrace: StackTrace.current,
                    type: 'dev_manual_error',
                    handled: true,
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已调用 recordError(handled)')),
                  );
                },
                child: const Text('recordError(handled=true)'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  FlutterMonitorSDK.recordError(
                    Exception('dev manual fatal-ish error'),
                    stackTrace: StackTrace.current,
                    type: 'dev_manual_fatal',
                    handled: false,
                    level: MonitorEventLevel.error,
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已调用 recordError(handled=false)')),
                  );
                },
                child: const Text('recordError(handled=false)'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  appTrack(
                    context,
                    action: 'dev.force_failure',
                    result: MonitorTrackResult.failed,
                    level: MonitorEventLevel.warning,
                    error: 'dev forced business failure',
                    message: '开发者选项强制业务失败',
                    properties: const {
                      'result': 'failed',
                      'biz_code': 'DEV_FORCE',
                    },
                  );
                },
                child: const Text('track 业务失败'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
