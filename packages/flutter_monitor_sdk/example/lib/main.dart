import 'package:dio/dio.dart';
import 'package:example/home_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'complex_list_page.dart';
import 'detail_page.dart';
import 'performance_test_page.dart';

// 开启 native bridge 测试时取消注释下面 import 和 MonitorConfig.nativeBridge。
// import 'package:flutter_monitor_native/flutter_monitor_native.dart';

// 模拟用户自己的日志系统
// final myAppLogger = Logger(
//   printer: PrettyPrinter(
//     methodCount: 0,
//     errorMethodCount: 5,
//     lineLength: 80,
//     colors: true,
//     printEmojis: true,
//     printTime: true,
//   ),
// );
// // 这是用户为了适配 SDK 而创建的处理函数
// void handleMonitorEvent(Map<String, dynamic> event) {
//   final category = event['category'];
//   final data = event['data'];
//   // 用户可以根据事件类型，调用自己日志库的不同方法
//   if (category == 'error') {
//     myAppLogger.e(
//       "Flutter Monitor SDK Error Captured",
//       error: data['error'],
//       stackTrace: StackTrace.fromString(data['stackTrace'] ?? ''),
//     );
//   } else {
//     myAppLogger.i("Flutter Monitor SDK Event: $category", error: data);
//   }
// }

final dio = Dio(
  BaseOptions(
    connectTimeout: const Duration(seconds: 2),
    receiveTimeout: const Duration(seconds: 3),
  ),
);

void main() async {
  // 记录启动时间
  final appStartTime = DateTime.now();
  const monitorServerUrl = String.fromEnvironment('FM_SERVER_URL');

  // 确保Flutter绑定
  WidgetsFlutterBinding.ensureInitialized();

  // 输出模式：
  // - 不传 FM_SERVER_URL 时使用 consoleOnly，适合本地 compact log。
  // - 传入 FM_SERVER_URL 时使用 localLive，后续由 Phase 5 reliable delivery
  //   统一负责 batch、flush、retry 和离线队列。
  final monitorMode = monitorServerUrl.isEmpty
      ? MonitorMode.consoleOnly()
      : MonitorMode.localLive(endpoint: Uri.parse(monitorServerUrl));

  // 自动获取应用信息
  final appInfo = await AppInfo.fromPackageInfo(appKey: 'TEST_APP_KEY');

  // 使用新的简化配置方式
  final monitorConfig = MonitorConfig(
    // 自定义配置
    // appInfo: const AppInfo(
    //   appKey: 'TEST_APP_KEY',
    // ),
    // 自动获取配置
    appInfo: appInfo,
    mode: monitorMode,
    jankConfig: JankConfig.lenient(),
  );

  // 或者使用完整配置（可选）
  // final monitorConfig = MonitorConfig(
  //   // 自定义配置
  //   appInfo: const AppInfo(
  //     appKey: 'TEST_APP_KEY',
  //     appVersion: '1.0.0',
  //     buildNumber: '1',
  //     packageName: 'com.example.monitor_demo',
  //     appName: 'Monitor Demo',
  //     channel: 'debug',
  //     environment: 'development',
  //   ),
  //   // 自动获取配置
  //   // appInfo: appInfo,
  //   // 启动期上下文可通过 FlutterMonitorSDK.init(initialContext: ...) 设置；
  //   // 运行时变化再通过 FlutterMonitorSDK.setContext(...) 调整。
  //   enableJankMonitor: true,
  //   jankConfig: JankConfig.lenient(),
  //   mode: MonitorMode.production(
  //     endpoint: Uri.parse('https://monitor.example.com/api/monitor/v1/events'),
  //     policy: MonitorProductionPolicy.conservative(),
  //   ),
  // );

  // 初始化监控SDK
  await FlutterMonitorSDK.init(
    config: monitorConfig,
    appStartTime: appStartTime,
    initialContext: const MonitorInitialContext(
      userType: 'qa',
      cohort: 'example_session',
      moduleName: 'example',
      moduleScene: 'bootstrap',
    ),
  );
  dio.interceptors.add(FlutterMonitorSDK.createDioInterceptor());

  // 运行App
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Monitor Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      // 注入路由观察者
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: {
        '/': (context) => HomePage(dio: dio),
        '/detail': (context) => const DetailPage(),
        '/complex_list': (context) => const ComplexListPage(),
        '/performance_test': (context) => const PerformanceTestPage(),
      },
      initialRoute: '/',
    );
  }
}
