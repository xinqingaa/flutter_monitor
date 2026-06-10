import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _enterApp();
    });
  }

  Future<void> _enterApp() async {
    FlutterMonitorSDK.track(
      action: 'launch.bootstrap.start',
      result: MonitorTrackResult.started,
      target: 'splash',
    );
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    FlutterMonitorSDK.track(
      action: 'launch.bootstrap.finish',
      result: MonitorTrackResult.success,
      target: 'splash',
      properties: const <String, Object?>{'next_route': AppRoutes.app},
    );
    AppNavigation.replaceToApp(context);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AppPage(
      routeName: AppRoutes.splash,
      moduleName: 'launch',
      moduleScene: 'splash',
      child: Scaffold(
        backgroundColor: colorScheme.surface,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.monitor_heart,
                      size: 64,
                      color: colorScheme.primary,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Flutter Monitor Shop',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '正在恢复会话和业务上下文',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 28),
                    const LinearProgressIndicator(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
