import 'package:dio/dio.dart';
import 'package:example/home_page.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'complex_list_page.dart';
import 'detail_page.dart';
import 'performance_test_page.dart';

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

// 创建一个全局的Dio实例，并添加我们的拦截器
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);

void main() async {
  // 记录启动时间
  final appStartTime = DateTime.now();

  // 确保Flutter绑定
  WidgetsFlutterBinding.ensureInitialized();

  final List<MonitorOutput> monitorOutputs = [];

  // 自测阶段使用，发布正式包后使用后端日志查看
  // 默认日志输出
  if (kDebugMode) {
    monitorOutputs.add(LogMonitorOutput());
  }

  // 自定义日志系统输出 可选与默认日志选一个
  // if (kDebugMode) {
  //   monitorOutputs.add(
  //     CustomLogOutput(onLog: handleMonitorEvent),
  //   );
  // }

  // 配置服务端上报
  // monitorOutputs.add(
  //   HttpOutput(
  //     serverUrl: 'http://192.168.100.85:3000/report',
  //     enablePeriodicReporting: false, // 是否开启定时上报
  //     periodicReportDuration: const Duration(seconds: 15), // 设置为15秒
  //     batchReportSize: 5,
  //   ),
  // );

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
    jankConfig: JankConfig.lenient(),
    outputs: monitorOutputs,
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
  //   // 默认用户信息
  //   // userInfo: const UserInfo(
  //   //   userId: 'user_123',
  //   //   userType: 'tester',
  //   // ),
  //   enableJankMonitor: true,
  //   jankConfig: JankConfig.lenient(),
  //   outputs: monitorOutputs, // 可选，不传则使用默认输出
  // );


  // 初始化监控SDK
  await FlutterMonitorSDK.init(
    config:monitorConfig,
    appStartTime: appStartTime,
  );

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
      navigatorObservers: [
        FlutterMonitorSDK.routeObserver
      ],
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
