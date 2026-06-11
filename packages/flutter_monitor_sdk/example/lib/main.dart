import 'package:dio/dio.dart';
import 'package:example/router/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

// 开启 native bridge 测试时取消注释下面 import 和 MonitorConfig.nativeBridge。
// import 'package:flutter_monitor_native/flutter_monitor_native.dart';

const monitorServerUrl = String.fromEnvironment(
  'FM_SERVER_URL',
  defaultValue: 'http://127.0.0.1:3700/api/monitor/v1/events',
);

const productionMonitorUrl = String.fromEnvironment(
  'FM_SERVER_URL',
  defaultValue: 'http://127.0.0.1:3700/api/monitor/v1/events',
);

Future<String?> monitorAuthToken() async {
  return const String.fromEnvironment('FM_AUTH_TOKEN', defaultValue: '');
}

final dio = Dio(
  BaseOptions(
    connectTimeout: const Duration(seconds: 2),
    receiveTimeout: const Duration(seconds: 3),
  ),
);

MonitorMode buildMonitorMode() {
  // 每次只保留一个 final monitorMode。切换后重新运行 App 即可。

  // 1. 控制台模式：适合只看本地 compact log。
  // final monitorMode = MonitorMode.consoleOnly();

  // 2. Workbench live 模式：适合接入本地 workbench service。
  // final monitorMode = MonitorMode.localLive(
  //   endpoint: Uri.parse(monitorServerUrl),
  // );

  // 3. 生产默认策略：队列 5000/8MB、flush 15s、成功 HTTP 20%、memory sample 10%。
  // final monitorMode = MonitorMode.production(
  //   endpoint: Uri.parse(productionMonitorUrl),
  // );

  // 4. 生产灰度策略：队列更小、flush 更慢、采样更低，适合首轮灰度。
  // final monitorMode = MonitorMode.production(
  //   endpoint: Uri.parse(productionMonitorUrl),
  //   policy: MonitorProductionPolicy.conservative(),
  // );

  // 5. 生产鉴权策略：默认生产策略 + 发送前获取 token。
  // final monitorMode = MonitorMode.production(
  //   endpoint: Uri.parse(productionMonitorUrl),
  //   authToken: monitorAuthToken,
  // );

  // 6. 生产压测策略：全量成功 HTTP / memory / low priority，短 flush，高限流。
  final monitorMode = MonitorMode.production(
    endpoint: Uri.parse(productionMonitorUrl),
    policy: const MonitorProductionPolicy(
      maxQueueEvents: 12000,
      maxQueueBytes: 16 * 1024 * 1024,
      maxBatchEvents: 80,
      maxBatchBytes: 768 * 1024,
      flushInterval: Duration(seconds: 5),
      quickFlushDelay: Duration(milliseconds: 800),
      successfulHttpSampleRate: 1,
      lowPrioritySampleRate: 1,
      memorySampleRate: 1,
      maxTrackEventsPerMinute: 600,
    ),
  );

  return monitorMode;
}

Future<void> main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized();

  final appInfo = await AppInfo.fromPackageInfo(appKey: 'TEST_APP_KEY');
  final monitorConfig = MonitorConfig(
    appInfo: appInfo,
    mode: buildMonitorMode(),
    performance: MonitorPerformanceConfig.lenient(),
    // nativeBridge: FlutterMonitorNativeBridge(),
  );

  await FlutterMonitorSDK.init(
    config: monitorConfig,
    appStartTime: appStartTime,
    initialContext: const MonitorInitialContext(
      userType: 'qa',
      cohort: 'example_session',
      moduleName: 'launch',
      moduleScene: 'splash',
      releaseId: 'example-2026.06',
      featureFlags: ['example_real_app', 'sdk_reliability'],
      experiments: <String, Object?>{'home_feed': 'github'},
    ),
  );

  dio.interceptors.add(FlutterMonitorSDK.createDioInterceptor());
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Monitor Shop',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF146C5A)),
        useMaterial3: true,
      ),
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: AppRouter.routes(dio: dio),
      initialRoute: AppRoutes.splash,
    );
  }
}
