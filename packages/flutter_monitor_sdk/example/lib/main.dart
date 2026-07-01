import 'package:dio/dio.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/theme/app_theme.dart';
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

Dio createExampleDio() {
  return Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    ),
  );
}

final monitoredDio = createExampleDio();
final workbenchDio = createExampleDio();

MonitorMode buildMonitorMode() {
  // 每次只保留一个 final monitorMode。切换后重新运行 App 即可。

  // 1. 控制台模式：适合只看本地 compact log。
  // final monitorMode = MonitorMode.consoleOnly();

  // 2. Workbench live 模式：适合接入本地 workbench service。
  final monitorMode = MonitorMode.localLive(
    endpoint: Uri.parse(monitorServerUrl),
  );

  // 3. 生产默认策略：队列 20000/64MB、batch 1MB、flush 15s、
  //    HTTP 全量保留（hard 证据）、memory sample 10%。
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
  // final monitorMode = MonitorMode.production(
  //   endpoint: Uri.parse(productionMonitorUrl),
  //   policy: const MonitorProductionPolicy(
  //     maxQueueEvents: 30000,
  //     maxQueueBytes: 96 * 1024 * 1024,
  //     maxEventBytes: 512 * 1024,
  //     maxBatchEvents: 80,
  //     maxBatchBytes: 1024 * 1024,
  //     flushInterval: Duration(seconds: 5),
  //     quickFlushDelay: Duration(milliseconds: 800),
  //     successfulHttpSampleRate: 1,
  //     lowPrioritySampleRate: 1,
  //     memorySampleRate: 1,
  //     maxTrackEventsPerMinute: 600,
  //   ),
  // );

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
    // 默认只采集启动/生命周期、路由、HTTP、错误和 track。
    // 如需采集 frame/jank/memory/measure 等诊断信号，在初始化时显式开启：
    // signals: MonitorSignalConfig(
    //   frameStats: true,
    //   jank: true,
    //   memory: true,
    //   interactionMeasure: true,
    // ),
    // Native 信号需要同时接入 nativeBridge，并开启 signals.native：
    // signals: MonitorSignalConfig(native: true),
    // nativeBridge: FlutterMonitorNativeBridge(),
    // HTTP 详情采集默认全开（query/headers/body 保真采集，body 截断
    // localLive 64KB / production 16KB）。需要脱敏或关闭时显式配置：
    // http: MonitorHttpConfig(
    //   captureResponseBody: false,            // 关闭响应体采集
    //   maxBodyBytes: 8 * 1024,                // 覆盖截断上限
    //   redactor: (detail) {
    //     // 自定义脱敏：返回修改后的详情层，返回 null 丢弃整个详情层。
    //     return detail;
    //   },
    // ),
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
      experiments: <String, Object?>{'home_feed': 'mock_business'},
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
      title: 'Flutter Monitor Shop',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: AppRouter.routes(
        monitoredDio: monitoredDio,
        workbenchDio: workbenchDio,
      ),
      initialRoute: AppRoutes.splash,
    );
  }
}
