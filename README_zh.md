# Flutter Monitor SDK

[英文](README.md)

一个为 Flutter 应用设计的、轻量级且功能全面的前端监控 SDK。
它可以帮助开发者轻松地收集和上报应用中的**错误**、**性能指标**、**用户行为**和**UI卡顿**数据，从而快速定位问题、优化体验。

## ✨ 为什么选择 Flutter Monitor SDK?

| 智能卡顿检测                                 | 企业级特性                                         | 卓越开发体验                                     |
| :------------------------------------------- | :------------------------------------------------- | :----------------------------------------------- |
| ✅ **自适应阈值**：根据设备刷新率动态调整标准 | ✅ **动态用户管理**：支持登录/登出等完整生命周期    | ✅ **零侵入设计**：一次初始化，多项监控自动开启   |
| ✅ **抖动容忍**：过滤偶然抖动，减少性能误报   | ✅ **丰富数据维度**：自动附加App、设备、用户信息    | ✅ **简洁 API**：清晰的 API 设计，上手成本极低    |
| ✅ **连续性检测**：只上报真正的连续卡顿序列   | ✅ **灵活上报策略**：支持批量、定时、退出时上报     | ✅ **类型安全**：强类型配置，享受编译时检查       |
| ✅ **智能采样**：最小化监控对应用性能的影响   | ✅ **多输出支持**：日志、HTTP、自定义输出器任意组合 | ✅ **智能初始化**：异步获取设备信息，确保数据完整 |

## 📚 文档 (Documentation)

- [背景与方向](docs/background.md)
- [事件模型](docs/event_model.md)
- [目标架构](docs/architecture.md)
- [DevTools 集成](docs/devtools_integration.md)
- [服务端协议](docs/server_protocol.md)
- [实施计划](docs/implementation_plan.md)

## 🚀 快速上手 (Quick Start)

只需 5 个简单步骤，即可为你的 App 装上“天眼”！

### 1. 添加依赖

在你的 `pubspec.yaml` 文件中添加依赖：

```yaml
dependencies:
  flutter_monitor_sdk: ^1.0.0 # 替换为最新版本
  
  # 本 SDK 依赖以下包，请确保它们也存在于你的项目中
  http: ^1.2.1
  dio: ^5.4.3+1
  device_info_plus: ^11.2.0
  package_info_plus: ^8.2.0
```

然后运行 `flutter pub get`。

### 2. 初始化 SDK

在你的 `main.dart` 文件的 `main` 函数中，尽可能早地进行初始化。

```dart
// main.dart
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized(); // 确保flutter挂载

  // 推荐：自动获取应用信息
  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'YOUR_UNIQUE_APP_KEY', // 替换为你的 App Key
  );

  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: appInfo,
      outputs: [
        if (kDebugMode) LogMonitorOutput(), // Debug 模式打印到控制台
        if (kReleaseMode) HttpOutput(serverUrl: 'https://your-backend.com/report'),
      ],
    ),
    appStartTime: appStartTime,
  );

  runApp(const MyApp());
}
```

### 3. 注入路由观察者

为了实现 PV 和页面性能监控，将 `routeObserver` 添加到 `MaterialApp`。

```dart
// app.dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // 关键一步！
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      home: MyHomePage(),
    );
  }
}
```

### 4. 监控网络请求

SDK 提供了对 `dio` 和 `http` 的无缝支持。

```dart
// Dio 方式 (推荐)
import 'package:dio/dio.dart';
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);
dio.get('https://api.example.com/data');

// http 包方式
import 'package:http/http.dart' as http;
final client = FlutterMonitorSDK.httpClient;
client.get(Uri.parse('https://api.example.com/data'));
```

### 5. 监控用户点击

使用 `MonitoredGestureDetector` 包裹你的 Widget，即可自动上报点击事件。

```dart
import 'packagepackage:flutter_monitor_sdk/flutter_monitor_sdk.dart';

MonitoredGestureDetector(
  identifier: 'buy_now_button', // 为点击事件设置一个唯一的、有意义的标识
  onTap: () {
    // 你的业务逻辑
  },
  child: ElevatedButton(child: Text('立即购买'), onPressed: () {}),
)
```

**恭喜！** 你的 App 现在已经具备了全面的监控能力。错误、性能、卡顿和行为数据将会被自动收集和上报。

## 🌟 核心功能

- **错误监控**: 自动捕获 Flutter 框架层和 Dart 层的未处理异常。
- 性能监控：
  - App 启动耗时
  - 页面加载（渲染）耗时
  - 网络 API 请求性能（支持 Dio 和 http）
  - **智能 UI 卡顿监控** (基于连续慢帧序列的自适应检测)
- 用户行为监控：
  - 页面浏览（PV）
  - 页面停留时长
  - 关键元素点击（通过 `MonitoredGestureDetector`）
- **动态上下文管理**: 支持在运行时更新/清除用户信息和自定义数据。
- **详细性能分析**: 提供 FPS、稳定性、百分位数、设备性能等级等多维度指标。

## 🔧 API 使用与配置

### 完整配置

`MonitorConfig` 提供了丰富的配置项，让你完全掌控 SDK 的行为。

```dart
final config = MonitorConfig(
  appInfo: AppInfo(appKey: 'YOUR_APP_KEY', appVersion: '1.2.3'),
  userInfo: UserInfo(userId: 'guest_123'),
  customData: {'region': 'us-east-1'},
  
  // 按需开关各模块
  enableErrorMonitor: true, // 错误监听
  enablePerformanceMonitor: true, // 性能监听
  enableBehaviorMonitor: true, // 行为控件监听
  enableJankMonitor: true, // UI卡顿监听
  
  // 配置卡顿监控策略
  jankConfig: JankConfig.strict(), // 或 JankConfig.lenient(), JankConfig.defaultConfig()
  
  // 配置输出目标
  outputs: [
    LogMonitorOutput(),
    HttpOutput(
      serverUrl: 'https://your-backend.com/report', // 上报服务器地址
      flushOnAppExit:false , // 是否监听应用生命周期，默认开启。
      batchReportSize: 20, //  当队列中的事件数量达到此值时，会立即触发一次上报。默认10
      enablePeriodicReporting: false, // 是否开启定时上报功能。 与按量上报选一个
      // periodicReportDuration: Duration(seconds: 30), // 若开启定时上报的间隔时间
    ),
    CustomLogOutput(onLog: (event) => myLogger.info(event)),
  ],
);
```

### 动态用户管理

在用户登录、登出或信息变更时，动态更新上下文。

```dart
// 用户登录后
FlutterMonitorSDK.instance.setUserInfo(UserInfo(userId: "user_abc_123"));
FlutterMonitorSDK.instance.setCustomData({'membership': 'gold'});

// 用户登出时
FlutterMonitorSDK.instance.clearUserInfo();
FlutterMonitorSDK.instance.clearCustomData();
```

### 手动上报事件

你也可以使用 SDK 上报任何自定义的业务事件。

```dart
FlutterMonitorSDK.instance.reportEvent(
  'business', // 事件分类
  { 'action': 'add_to_cart', 'item_id': 'product_9527' }
);
```

## 🔬 工作原理

**错误监控**: 通过监听 `FlutterError.onError` 和 `PlatformDispatcher.instance.onError` 捕获全局异常。

**App 启动耗时**: 计算 `main()` 函数开始到 `WidgetsBinding.instance.addPostFrameCallback` 首次回调的时间差。

**页面加载耗时**: 结合 `RouteObserver` 的 `didPush` 和 `PageRenderMonitor` Widget 内的 `addPostFrameCallback` 来精确计算从路由跳转到页面渲染完成的时间。

**智能 UI 卡顿监控**:通过 `SchedulerBinding.instance.addTimingsCallback` 获取每帧的耗时。根据设备刷新率动态计算帧预算和卡顿阈值。维护一个慢帧计数器，只有当**连续多帧**（可配置）的耗时都超过阈值时，才判定为一次卡顿事件。引入**抖动容忍**和**防抖**机制，过滤 случайные флуктуации и дублирующиеся отчеты。

**API 请求监控**: 通过 `Dio` 的 `Interceptor` 或装饰 `http.Client`，在请求前后注入逻辑来计算耗时和收集数据。

**上报策略**: 所有事件先进入内存队列。通过**定时**（`Timer.periodic`）、**定量**（队列长度）或**App 生命周期**（`AppLifecycleListener`）触发批量上报，以提升效率和数据可靠性。

## 📊 数据结构示例

- 错误事件（通用参数）
```json
{
  "category": "error", // 由调用者（各个Monitor）传入  (e.g., 'error', 'performance', 'behavior')
  "data": {
    "type": "dart_error", // 错误类型
    "error": "NoSuchMethodError: The method 'hello' was called on null.", // 报错信息
    "stack": "..." // 触发堆栈
  },
  "timestamp": "2025-01-15 20:30:00", // 触发时间
  "appInfo": { "appKey": "your_app_key", "appVersion": "1.0.0" }, // App信息 来源package_info_plus 或自行配置
  "userInfo": { "userId": "user_abc_123" }, // 用户信息（优先使用运行时用户信息，否则使用配置中的用户信息）
  "deviceInfo": { "model": "Pixel 7", "isPhysicalDevice": true }, // 设备信息 来源device_info_plus
  "platform": "android" // 运行平台信息
}
```
- 卡顿事件（详细介绍参数）
```json
/// 核心卡顿数据
/// type: 事件类型
/// page: 当前页面
/// jank_count: 连续卡顿帧数
/// max_duration_ms: 最严重一帧耗时
/// average_duration_ms: 平均每帧耗时
/// frame_budget_ms: 帧预算时间
/// jank_threshold_ms: 卡顿阈值
/// device_performance: 设备性能指标
/// 
/// 设备性能分析
/// average_frame_time_ms: 平均帧时间
/// frame_time_variance: 帧时间方差
/// fps: 实际帧率
/// stability: 稳定性指标
/// percentiles: 帧时间百分位数
/// anomalous_frame_count: 异常帧数
/// device_level: 设备性能等级
/// recent_frame_count: 最近帧数 
{
  "category": "performance",
  "data": {
    "type": "jank_sequence",
    "page": "home_page",
    "jank_count": 4,
    "max_duration_ms": 45.2,
    "device_performance": {
      "average_frame_time_ms": 16.8,
      "fps": 59.5,
      "stability": 0.92,
      "device_level": "medium"
    }
  },
  // ...通用字段
}
```

## 快速配置

```dart

// example/main.dart (优化后)
import 'package:dio/dio.dart';
import 'package:example/home_page.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'complex_list_page.dart';
import 'detail_page.dart';
import 'performance_test_page.dart';

// 1. 全局创建 Dio 实例并添加拦截器
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);

void main() async {
  // 记录启动时间，用于计算 App 启动耗时
  final appStartTime = DateTime.now();

  // 确保 Flutter 引擎已初始化
  WidgetsFlutterBinding.ensureInitialized();

  // 2. 推荐：自动从 package_info_plus 获取应用信息
  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'YOUR_UNIQUE_APP_KEY', // 替换为你的 App Key
    channel: 'official',
    environment: kReleaseMode ? 'production' : 'development',
  );

  // 3. 配置监控 SDK
  final monitorConfig = MonitorConfig(
    appInfo: appInfo,
    enableJankMonitor: true, // 开启卡顿监控
    jankConfig: JankConfig.defaultConfig(), // 使用默认卡顿配置
    outputs: [
      // 根据环境选择不同的输出方式
      if (kDebugMode)
        LogMonitorOutput(), // Debug 模式下，打印日志到控制台

      if (kReleaseMode)
        HttpOutput(
          serverUrl: 'https://your-backend.com/report', // 替换为你的上报地址
          batchReportSize: 20, // 积攒20条数据后上报
        ),
      
      // 如果需要对接到自己的日志系统，可以使用 CustomLogOutput
      // CustomLogOutput(onLog: (event) => myCustomLogger.log(event)),
    ],
  );

  // 4. 初始化 SDK
  await FlutterMonitorSDK.init(
    config: monitorConfig,
    appStartTime: appStartTime,
  );

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
      // 5. 注入路由观察者，以实现 PV 和页面性能监控
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: {
        '/': (context) => HomePage(dio: dio),
        '/detail': (context) => const DetailPage(),
        ...
      },
      initialRoute: '/',
    );
  }
}

```

## 🗺️ 路线图 (Roadmap)

见 [实施计划](docs/implementation_plan.md)。

## 🤝 贡献 (Contributing)

欢迎各种形式的贡献，包括但不限于：

- 提交问题或建议 (Issues)
- 发送合并请求 (Pull Requests)
- 改进文档

## 📄 许可证 (License)

本 SDK 采用 [MIT](https://opensource.org/licenses/MIT) 许可证。
