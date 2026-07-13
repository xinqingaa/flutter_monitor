import 'package:dio/dio.dart';
import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

const monitorServerUrl = String.fromEnvironment(
  'FM_SERVER_URL',
  defaultValue: 'http://127.0.0.1:3700/api/monitor/v1/events',
);

final monitoredDio = Dio(
  BaseOptions(
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 8),
  ),
);

final apiClient = ApiClient(monitoredDio);
final demoApi = DemoApi(apiClient);

MonitorMode buildMonitorMode() {
  // 1. consoleOnly / 2. localLive / 3. production — 每次只保留一个。
  final monitorMode = MonitorMode.localLive(
    endpoint: Uri.parse(monitorServerUrl),
  );
  return monitorMode;
}

Future<void> main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized();

  final appInfo = await AppInfo.fromPackageInfo(appKey: 'PULSEFIT_DEMO');
  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: appInfo,
      mode: buildMonitorMode(),
      performance: MonitorPerformanceConfig.lenient(),
    ),
    appStartTime: appStartTime,
    initialContext: const MonitorInitialContext(
      userType: 'demo',
      cohort: 'pulsefit',
      moduleName: 'launch',
      moduleScene: 'splash',
      releaseId: 'pulsefit-2026.07',
      featureFlags: ['workouts', 'courses', 'membership'],
    ),
  );

  monitoredDio.interceptors.add(FlutterMonitorSDK.createDioInterceptor());
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PulseFit',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: AppRouter.routes(api: demoApi),
      initialRoute: AppRoutes.splash,
    );
  }
}
