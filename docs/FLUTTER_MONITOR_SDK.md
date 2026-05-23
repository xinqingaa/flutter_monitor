# Flutter Monitor SDK

一个为 Flutter 应用设计的、轻量级且功能全面的前端监控 SDK。它可以帮助开发者轻松地收集和上报应用中的**错误**、**性能指标**、**用户行为**和**UI卡顿**数据，从而快速定位问题、优化体验。

## ✨ 设计理念

本 SDK 的设计遵循以下核心原则：

*   **非侵入式 (Non-intrusive)**: 只需在应用入口处进行一次初始化，其余监控逻辑对业务代码的侵入极小。例如，错误监控是全自动的，API 监控只需添加一个拦截器。
*   **高性能 (High-Performance)**: 所有监控数据的收集和上报都在异步环境中进行，不会阻塞 UI 线程。采用智能采样和批量上报策略，有效减少网络请求数量，降低客户端和服务器的压力。
*   **高可扩展 (Extensible)**: SDK 采用模块化设计，将错误、性能、行为、卡顿监控分离。支持自定义输出器和监控配置，未来可以轻松添加新的监控模块。
*   **易于使用 (Easy to Use)**: 提供清晰、简洁的 API。支持极简配置（只需appKey）和完整配置，并为关键功能（如点击监控）提供了便捷的 Widget。
*   **智能监控 (Intelligent)**: 采用自适应阈值算法，根据设备性能动态调整卡顿检测标准，减少误报，提供准确的性能分析。

## 核心功能

*   **错误监控**: 自动捕获 Flutter 框架层和 Dart 层的未处理异常，包含详细的堆栈信息和错误上下文。
*   **性能监控**:
    *   App 启动耗时
    *   页面加载（渲染）耗时
    *   网络 API 请求性能（成功率、耗时、状态码，支持 Dio 和原生 http 包）
    *   **智能UI卡顿监控** (基于连续慢帧序列的自适应检测)
*   **用户行为监控**:
    *   页面浏览（PV）
    *   页面停留时长
    *   关键元素点击（UV，通过 MonitoredGestureDetector 手动埋点）
*   **动态用户管理**: 支持运行时更新用户信息、自定义数据，适应登录、切换账号等场景。
*   **灵活的上报策略**: 支持定时、定量批量上报，并在 App退出时进行数据抢救，确保数据不丢失。
*   **丰富的通用信息**: 每条上报数据都会自动附加设备信息、用户信息、平台、App Key 等通用字段。
*   **详细性能分析**: 提供FPS、稳定性、百分位数、设备性能等级等多维度性能指标。
*   **智能设备信息获取**: 异步获取设备信息，确保所有监控数据都包含完整的设备信息。

## 🎯 核心优势

### 智能卡顿检测
- **自适应阈值**: 根据设备刷新率动态调整检测标准
- **抖动容忍**: 允许设备正常抖动，减少误报
- **连续检测**: 只检测真正的连续卡顿，避免单帧异常
- **性能优化**: 智能采样，最小化对应用性能的影响

### 企业级特性
- **动态用户管理**: 支持登录、切换账号、登出等完整用户生命周期
- **丰富数据维度**: 应用信息、用户信息、设备信息、自定义数据
- **灵活配置**: 从极简配置到完整配置，满足不同需求
- **多输出支持**: 日志输出、HTTP上报、自定义输出器

### 开发体验
- **零侵入**: 只需初始化一次，自动监控错误和性能
- **简单API**: 清晰的API设计，快速上手
- **类型安全**: 强类型配置，编译时检查
- **向后兼容**: 支持渐进式升级
- **智能初始化**: 异步获取设备信息，确保数据完整性

## 监控原理详解

### 错误监控 (Error Monitoring)

SDK 通过监听两个 Flutter 核心的错误回调来捕获全局异常：

1.  **`FlutterError.onError`**: 用于捕获 Flutter 框架在构建（build）、布局（layout）、绘制（paint）等阶段抛出的错误。最常见的例子是布局溢出（Overflow Error）。
2.  **`PlatformDispatcher.instance.onError`**: 用于捕获更底层的 Dart Isolate 错误。这包括同步代码中的异常和异步代码（如 `Future`、`async/await`）中未被 `try-catch` 的异常。

当捕获到错误时，SDK 会收集错误的类型、信息、堆栈、发生的库等信息，并将其格式化后移交上报。

### 性能监控 (Performance Monitoring)

*   **App 启动耗时**: 在 `main()` 函数开始时记录一个时间戳 `appStartTime`。SDK 初始化后，通过 `WidgetsBinding.instance.addPostFrameCallback` 监听第一帧渲染完成的事件，两个时间点相减即为 App 的启动耗时。

* **智能UI卡顿监控**: SDK 采用先进的自适应阈值算法，能够智能检测真正的UI卡顿：
    1. **自适应阈值**: 根据设备刷新率动态计算帧预算时间，支持60fps、90fps、120fps等不同刷新率。
    2. **连续慢帧检测**: 当连续多帧（可配置，默认4帧）的耗时都超过阈值时，才认为发生卡顿。
    3. **抖动容忍机制**: 允许设备正常抖动，只检测真正的连续卡顿，大幅减少误报。
    4. **智能采样**: 每3帧采样一次，减少对应用性能的影响。
    5. **详细性能分析**: 提供FPS、稳定性、百分位数、设备性能等级等多维度指标。
    6. **防抖机制**: 避免短时间内重复上报，提升数据质量。

*   **页面加载/渲染耗时**:
    1.  通过注入一个自定义的 `RouteObserver`，在 `didPush` 方法被调用时记录页面 `push` 的时间。
    2.  在目标页面的 `initState` 中，通过 `WidgetsBinding.instance.addPostFrameCallback` 监听该页面第一帧渲染完成。
    3.  在回调中，用当前时间减去 `push` 时记录的时间，得到页面的加载耗时。

*   **API 请求监控**:
    *   `Dio` 库 提供一个 `MonitorDioInterceptor`
    *   `http`: 提供一个 `MonitoredHttpClient` 装饰器类
    *   在 `onRequest` 中记录请求开始时间。
    *   在 `onResponse`（成功）或 `onError`（失败）中，计算总耗时，并收集 URL、方法、状态码、响应数据等信息进行上报。

### 用户行为监控 (User Behavior Monitoring)

*   **页面浏览 (PV)**: `RouteObserver` 的 `didPush` 方法每次被调用，都意味着一次页面浏览。SDK 在此时会上报一个 `pv` 事件。

*   **页面停留时长**: `RouteObserver` 在 `didPush` 时记录页面和进入时间，在 `didPop` 时找到对应的记录，计算时间差，从而得到页面的停留时长。

*   **控件点击 (Click Events)**: SDK 提供了一个 `MonitoredGestureDetector` Widget。你只需用它包裹需要监控点击的普通 Widget，并提供一个唯一的 `identifier` 即可。它的 `onTap` 回调会自动触发一次点击事件上报。

## 上报策略 (Reporting Strategy)

为了避免频繁的网络请求，SDK 采用了**队列 + 批量上报**的策略。

1.  **数据入队**: 所有监控器捕获的事件，在经过数据丰富（附加通用字段）后，都会被添加到一个内部的事件队列 `_eventQueue` 中。
2.  **触发上报**: 以下三种情况会触发上报（`flush`）操作，将队列中的所有事件一次性发送给服务器：
    *   **定时上报**: SDK 内部有一个定时器，周期性地检查并上报队列（默认20秒，可配置）。
    *   **定量上报**: 当队列中的事件数量达到设定的阈值时，立即上报（默认10条，可配置）。
    *   **App 退出时上报**: 监听 App 的生命周期，当 App 进入后台或即将被关闭时，立即上报队列中所有剩余的数据，防止丢失。

## 如何使用

### 1. 安装

将本 SDK 上传到你的私有 Git 仓库（如 Gitee 或 GitHub）。然后在你的 Flutter 项目的 `pubspec.yaml` 文件中添加依赖：

```yaml
dependencies:
  flutter_monitor_sdk:
    git:
      url: https://gitee.com/your_username/flutter_monitor_sdk.git # 替换为你的仓库地址
      ref: v0.0.1 # 使用 tag 来锁定版本
  # 本 SDK 需要以下对等依赖。请确保它们也存在于你的 dependencies 中
  dependencies:
  http: ^1.2.1
  dio: ^5.4.3+1
  device_info_plus: ^11.2.0
```

然后运行 `flutter pub get`。

### 2. 初始化

在你的 `main.dart` 文件的 `main` 函数中进行初始化。SDK 支持极简配置和完整配置两种方式。

#### 极简配置（推荐）

```dart
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() async {
  // 1. 记录启动时间
  final appStartTime = DateTime.now();

  // 2. 确保Flutter绑定
  WidgetsFlutterBinding.ensureInitialized();

  // 3. 初始化监控SDK（极简配置）
  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: AppInfo(appKey: 'your_app_key_123'),
      // 其他配置使用默认值
    ),
    appStartTime: appStartTime,
  );

  // 4. 运行App
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // 5. 注入路由观察者以实现PV和页面性能监控
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      home: MyHomePage(),
    );
  }
}
```

#### 自动获取应用信息（推荐）

```dart
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() async {
  // 1. 记录启动时间
  final appStartTime = DateTime.now();

  // 2. 确保Flutter绑定
  WidgetsFlutterBinding.ensureInitialized();

  // 3. 自动获取应用信息
  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'your_app_key_123',
    channel: 'production', // 可选
    environment: 'prod', // 可选
  );

  // 4. 初始化监控SDK
  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: appInfo, // 使用自动获取的应用信息
      // 其他配置使用默认值
    ),
    appStartTime: appStartTime,
  );

  // 5. 运行App
  runApp(MyApp());
}
```

#### 完整配置

```dart
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:dio/dio.dart';

void main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized();

  // 完整配置
  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: AppInfo(
        appKey: 'your_app_key_123',
        appVersion: '1.0.0',
        buildNumber: '1',
        packageName: 'com.example.app',
        appName: 'My App',
        channel: 'production',
        environment: 'prod',
      ),
      userInfo: UserInfo(
        userId: 'user_123',
        userType: 'premium',
        userTags: ['vip', 'beta'],
        userProperties: {
          'age': 25,
          'city': 'Beijing',
        },
      ),
      enableErrorMonitor: true,
      enablePerformanceMonitor: true,
      enableBehaviorMonitor: true,
      enableJankMonitor: true,
      outputs: [
        LogMonitorOutput(), // 开发环境使用日志输出
        HttpOutput(serverUrl: 'http://your-server.com/report'), // 生产环境上报
      ],
      jankConfig: JankConfig.strict(), // 严格卡顿检测
      customData: {
        'appVersion': '1.0.0',
        'buildType': 'release',
      },
    ),
    appStartTime: appStartTime,
  );

  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      home: MyHomePage(),
    );
  }
}
```

### 3. API 使用

#### 监控点击事件
```dart
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

MonitoredGestureDetector(
  identifier: 'confirm-payment-button', // 为此点击事件设置一个唯一标识
  onTap: () {
    // 你的业务逻辑
  },
  child: Text('确认支付'),
)
```

#### 网络请求监控

**Dio 拦截器**:
```dart
import 'package:dio/dio.dart';

final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);

// 使用 dio 发起请求，自动监控
final response = await dio.get('https://api.example.com/data');
```

**HTTP 客户端**:
```dart
import 'package:http/http.dart' as http;

final client = FlutterMonitorSDK.httpClient;

// 使用监控的 http 客户端发起请求
final response = await client.get(Uri.parse('https://api.example.com/data'));
```

#### 动态用户管理

**设置用户信息**:
```dart
// 简单设置用户ID
FlutterMonitorSDK.instance.setUserId("user_abc_123");

// 设置完整用户信息
FlutterMonitorSDK.instance.setUserInfo(
  UserInfo(
    userId: "user_abc_123",
    userType: "premium",
    userTags: ["vip", "beta"],
    userProperties: {
      "age": 25,
      "city": "Beijing",
    },
  ),
);

// 设置自定义数据
FlutterMonitorSDK.instance.setCustomData({
  'sessionId': 'session_${DateTime.now().millisecondsSinceEpoch}',
  'featureFlags': ['new_ui', 'beta_features'],
});

// 用户登出时清除信息
FlutterMonitorSDK.instance.clearUserInfo();
FlutterMonitorSDK.instance.clearCustomData();
```

#### 手动上报自定义事件
```dart
FlutterMonitorSDK.instance.reportEvent(
  'custom_event', // 事件分类
  { // 自定义事件数据
    'action': 'share',
    'platform': 'wechat',
  }
);
```

#### 卡顿监控配置

**预设配置**:
```dart
// 宽松配置（适合低端设备）
jankConfig: JankConfig.lenient()

// 默认配置（平衡）
jankConfig: JankConfig.defaultConfig()

// 严格配置（适合高端设备）
jankConfig: JankConfig.strict()
```

**自定义配置**:
```dart
jankConfig: JankConfig(
  jankFrameTimeMultiplier: 2.5,    // 单帧卡顿阈值乘数
  consecutiveJankThreshold: 4,     // 连续卡顿帧数阈值
  jitterToleranceMs: 8.0,          // 抖动容忍时间
  debounceMs: 1000,                // 防抖时间
)
```

## 数据结构示例

所有数据最终都会被打包成一个 JSON 对象发送到服务器，结构如下：

### 错误监控数据
```json
{
  "category": "error",
  "data": {
    "type": "dart_error",
    "error": "NoSuchMethodError: The method 'hello' was called on null.",
    "stack": "...",
    "timestamp": "2025-01-15T12:30:00.123Z"
  },
  "timestamp": "2025-01-15 20:30:00",
  "appInfo": {
    "appKey": "your_app_key_123",
    "appVersion": "1.0.0",
    "buildNumber": "1",
    "packageName": "com.example.app",
    "appName": "My App",
    "channel": "production",
    "environment": "prod"
  },
  "userInfo": {
    "userId": "user_abc_123",
    "userType": "premium",
    "userTags": ["vip", "beta"],
    "userProperties": {
      "age": 25,
      "city": "Beijing"
    }
  },
  "customData": {
    "sessionId": "session_1705123456789",
    "featureFlags": ["new_ui", "beta_features"]
  },
  "platform": "android",
  "deviceInfo": {
    "device": "sdk_gphone64_x86_64",
    "model": "sdk_gphone64_x86_64",
    "version": "12",
    "isPhysicalDevice": false
  }
}
```

### 卡顿监控数据
```json
{
  "category": "performance",
  "data": {
    "type": "jank_sequence",
    "page": "home_page",
    "jank_count": 4,
    "max_duration_ms": 45.2,
    "average_duration_ms": 38.7,
    "frame_budget_ms": 16.67,
    "jank_threshold_ms": 33.34,
    "device_performance": {
      "average_frame_time_ms": 16.8,
      "frame_time_variance": 2.3,
      "fps": 59.5,
      "stability": 0.92,
      "percentiles": {
        "p50": 16.2,
        "p90": 18.5,
        "p95": 22.1,
        "p99": 28.3
      },
      "anomalous_frame_count": 2,
      "device_level": "medium",
      "recent_frame_count": 30
    }
  },
  "timestamp": "2025-01-15 20:30:00",
  "appInfo": { /* ... */ },
  "userInfo": { /* ... */ },
  "customData": { /* ... */ },
  "platform": "android",
  "deviceInfo": { /* ... */ }
}
```

### 网络请求监控数据
```json
{
  "category": "performance",
  "data": {
    "type": "api",
    "sub_type": "dio",
    "url": "https://api.example.com/users",
    "method": "GET",
    "status": 200,
    "duration_ms": 150,
    "success": true
  },
  "timestamp": "2025-01-15 20:30:00",
  "appInfo": { /* ... */ },
  "userInfo": { /* ... */ },
  "customData": { /* ... */ },
  "platform": "android",
  "deviceInfo": { /* ... */ }
}
```

## 配套后端服务（示例）

本 SDK 需要一个后端服务来接收上报的数据。你可以使用以下简单的 Node.js + Express 服务器进行测试和验证。

1.  **`package.json`**:
    ```json
    {
      "name": "mock_server",
      "version": "1.0.0",
      "main": "server.js",
      "scripts": { "start": "node server.js" },
      "dependencies": {
        "body-parser": "^1.20.2",
        "cors": "^2.8.5",
        "express": "^4.19.2"
      }
    }
    ```

2.  **`server.js`**:
    ```javascript
    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors');

    const app = express();
    const port = 3000;

    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));

    app.post('/report', (req, res) => {
      console.log('--- ✅ 收到上报数据 ---');
      console.log('上报时间:', new Date().toISOString());
      console.log('上报内容:', JSON.stringify(req.body, null, 2));
      console.log('-----------------------\n');
      
      res.status(200).send({ message: 'Report received' });
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`模拟服务器已启动，监听在 http://localhost:${port}`);
    });
    ```
    运行 `npm install && npm start` 即可启动。

## 路线图 (Roadmap)

### 已完成功能 ✅
*   [x] **智能UI卡顿监控**: 基于自适应阈值算法的连续慢帧检测
*   [x] **网络请求监控**: 支持 Dio 和原生 `http` 包的监控
*   [x] **动态用户管理**: 运行时更新用户信息和自定义数据
*   [x] **详细性能分析**: FPS、稳定性、百分位数、设备性能等级
*   [x] **灵活配置系统**: 支持极简配置和完整配置

### 计划中的功能 🚀
*   [ ] **内存泄露监控**: 辅助开发者发现潜在的内存泄露问题
*   [ ] **离线缓存**: 在无网络环境下，将数据缓存到本地存储，待网络恢复后重新上报
*   [ ] **机器学习优化**: 基于历史数据训练模型，自动调整卡顿检测阈值
*   [ ] **实时监控面板**: 开发实时性能监控界面，支持性能数据的可视化展示
*   [ ] **A/B测试支持**: 支持不同配置的A/B测试
*   [ ] **智能告警**: 性能阈值告警和异常情况自动通知
*   [ ] **数据可视化面板**: 开发一个简单的前端页面，用于展示和筛选上报的数据

## 🚀 快速开始

### 1. 添加依赖
```yaml
dependencies:
  flutter_monitor_sdk:
    git:
      url: https://gitee.com/your_username/flutter_monitor_sdk.git
      ref: v0.0.1
  http: ^1.2.1
  dio: ^5.4.3+1
  device_info_plus: ^11.2.0
```

### 2. 初始化SDK
```dart
void main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized();
  
  // 自动获取应用信息（推荐）
  final appInfo = await AppInfo.fromPackageInfo(appKey: 'your_app_key');
  
  await FlutterMonitorSDK.init(
    config: MonitorConfig(appInfo: appInfo),
    appStartTime: appStartTime,
  );
  
  runApp(MyApp());
}
```

### 3. 注入路由观察者
```dart
MaterialApp(
  navigatorObservers: [FlutterMonitorSDK.routeObserver],
  home: MyHomePage(),
)
```

### 4. 监控网络请求
```dart
// Dio 方式
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);

// HTTP 方式
final client = FlutterMonitorSDK.httpClient;
```

### 5. 监控用户点击
```dart
MonitoredGestureDetector(
  identifier: 'button_click',
  onTap: () => print('Button clicked'),
  child: Text('Click me'),
)
```

就这么简单！SDK 会自动监控错误、性能、卡顿等指标，并提供详细的分析数据。

## 许可证 (License)

本 SDK 采用 [MIT](https://opensource.org/licenses/MIT) 许可证。
