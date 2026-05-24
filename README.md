# Flutter Monitor SDK

[中文](README_zh.md)

A lightweight yet comprehensive monitoring SDK designed for Flutter applications.
It helps developers effortlessly collect and report **errors**, **performance metrics**, **user behavior**, and **UI jank** data to quickly identify issues and optimize user experience.

## ✨ Why Choose Flutter Monitor SDK?

| Intelligent Jank Detection                                   | Enterprise-Grade Features                                    | Superior Developer Experience (DX)                           |
| :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| ✅ **Adaptive Thresholds**: Dynamically adjusts standards based on device refresh rate. | ✅ **Dynamic User Management**: Supports the full user lifecycle, including login/logout. | ✅ **Zero-Intrusion Design**: Initialize once, and multiple monitors start automatically. |
| ✅ **Jitter Tolerance**: Filters out occasional fluctuations, reducing false positives. | ✅ **Rich Data Context**: Automatically enriches events with App, Device, and User info. | ✅ **Clean & Simple API**: A clear API design with an extremely low learning curve. |
| ✅ **Consecutive Frame Detection**: Only reports true, consecutive jank sequences. | ✅ **Flexible Reporting Strategy**: Supports batch, periodic, and on-exit reporting. | ✅ **Type-Safe Configuration**: Enjoy compile-time checks with strongly-typed configs. |
| ✅ **Intelligent Sampling**: Minimizes the monitoring's impact on app performance. | ✅ **Multi-Output Support**: Combine Log, HTTP, and Custom outputs as needed. | ✅ **Smart Initialization**: Asynchronously fetches device info to ensure data integrity. |

## 📚 Documentation

- [背景与方向](docs/background.md)
- [事件模型](docs/event_model.md)
- [目标架构](docs/architecture.md)
- [DevTools 集成](docs/devtools_integration.md)
- [服务端协议](docs/server_protocol.md)
- [实施计划](docs/implementation_plan.md)

## 🚀 Quick Start

Get your app's "sky eye" up and running in just 5 simple steps!

### 1. Add Dependencies

Add the following to your `pubspec.yaml` file:



```yaml
dependencies:
  flutter_monitor_sdk: ^1.0.0 # Replace with the latest version
  
  # This SDK depends on the following packages. Please ensure they are in your project.
  http: ^1.2.1
  dio: ^5.4.3+1
  device_info_plus: ^11.2.0
  package_info_plus: ^8.2.0
```

Then, run `flutter pub get`.

### 2. Initialize the SDK

Initialize the SDK as early as possible in your `main.dart`'s `main` function.



```dart
// main.dart
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized(); // Ensure Flutter binding is initialized

  // Recommended: Automatically fetch app info
  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'YOUR_UNIQUE_APP_KEY', // Replace with your App Key
  );

  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: appInfo,
      outputs: [
        if (kDebugMode) LogMonitorOutput(), // In Debug mode, print to console
        if (kReleaseMode) HttpOutput(serverUrl: 'https://your-backend.com/report'),
      ],
    ),
    appStartTime: appStartTime,
  );

  runApp(const MyApp());
}
```

### 3. Inject the Route Observer

To enable PV and page performance monitoring, add the `routeObserver` to your `MaterialApp`.



```dart
// app.dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // The crucial step!
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      home: MyHomePage(),
    );
  }
}
```

### 4. Monitor Network Requests

The SDK provides seamless support for both `dio` and `http`.



```dart
// Dio (Recommended)
import 'package:dio/dio.dart';
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);
dio.get('https://api.example.com/data');

// http package
import 'package:http/http.dart' as http;
final client = FlutterMonitorSDK.httpClient;
client.get(Uri.parse('https://api.example.com/data'));
```

### 5. Monitor User Clicks

Wrap your widget with `MonitoredGestureDetector` to automatically report tap events.



```dart
import 'packagepackage:flutter_monitor_sdk/flutter_monitor_sdk.dart';

MonitoredGestureDetector(
  identifier: 'buy_now_button', // Set a unique and meaningful identifier for the tap event
  onTap: () {
    // Your business logic
  },
  child: ElevatedButton(child: Text('Buy Now'), onPressed: () {}),
)
```

**Congratulations!** Your app is now equipped with comprehensive monitoring capabilities. Errors, performance, jank, and behavior data will be collected and reported automatically.

## 🌟 Core Features

- **Error Monitoring**: Automatically captures unhandled exceptions from both the Flutter framework and the Dart layer.

- Performance Monitoring

  :

  - App Startup Time
  - Page Load (Render) Time
  - Network API Request Performance (supports Dio and http)
  - **Intelligent UI Jank Monitoring** (adaptive detection based on consecutive slow frame sequences)

- User Behavior Monitoring

  :

  - Page Views (PV)
  - Page Dwell Time
  - Key Element Clicks (via `MonitoredGestureDetector`)

- **Dynamic Context Management**: Supports updating/clearing user information and custom data at runtime.

- **Detailed Performance Analysis**: Provides multi-dimensional metrics like FPS, stability, percentiles, and device performance level.

## 🔧 API & Configuration

### Full Configuration

`MonitorConfig` offers a rich set of options to give you full control over the SDK's behavior.



```dart
final config = MonitorConfig(
  appInfo: AppInfo(appKey: 'YOUR_APP_KEY', appVersion: '1.2.3'),
  userInfo: UserInfo(userId: 'guest_123'),
  customData: {'region': 'us-east-1'},
  
  // Toggle modules as needed
  enableErrorMonitor: true,
  enablePerformanceMonitor: true,
  enableBehaviorMonitor: true,
  enableJankMonitor: true,
  
  // Configure jank monitoring strategy
  jankConfig: JankConfig.strict(), // or JankConfig.lenient(), JankConfig.defaultConfig()
  
  // Configure output targets
  outputs: [
    LogMonitorOutput(),
    HttpOutput(
      serverUrl: 'https://your-backend.com/report', // Reporting server URL
      flushOnAppExit: false, // Listen to app lifecycle, enabled by default.
      batchReportSize: 20, // Triggers a report when queue size reaches this value (default: 10).
      enablePeriodicReporting: false, // Whether to enable periodic reporting. Choose one with batch size.
      // periodicReportDuration: Duration(seconds: 30), // Interval for periodic reporting if enabled.
    ),
    CustomLogOutput(onLog: (event) => myLogger.info(event)),
  ],
);
```

### Dynamic User Management

Update the context when a user logs in, logs out, or their information changes.



```dart
// After user logs in
FlutterMonitorSDK.instance.setUserInfo(UserInfo(userId: "user_abc_123"));
FlutterMonitorSDK.instance.setCustomData({'membership': 'gold'});

// When user logs out
FlutterMonitorSDK.instance.clearUserInfo();
FlutterMonitorSDK.instance.clearCustomData();
```

### Manual Event Reporting

You can also use the SDK to report any custom business events.



```dart
FlutterMonitorSDK.instance.reportEvent(
  'business', // Event category
  { 'action': 'add_to_cart', 'item_id': 'product_9527' }
);
```

## 🔬 How It Works

**Error Monitoring**: Captures global exceptions by listening to `FlutterError.onError` and `PlatformDispatcher.instance.onError`.

**App Startup Time**: Calculates the time difference between the start of the `main()` function and the first callback of `WidgetsBinding.instance.addPostFrameCallback`.

**Page Load Time**: Combines `RouteObserver`'s `didPush` with a `addPostFrameCallback` inside the `PageRenderMonitor` widget to precisely measure the time from route navigation to page render completion.

**Intelligent UI Jank Monitoring**: Obtains per-frame timings via `SchedulerBinding.instance.addTimingsCallback`. It dynamically calculates the frame budget and jank threshold based on the device's refresh rate. A slow frame counter is maintained, and a jank event is only triggered when a **configurable number of consecutive frames** exceed the threshold. It also incorporates **jitter tolerance** and **debouncing** to filter out random fluctuations and duplicate reports.

**API Request Monitoring**: Injects logic before and after requests by using `Dio`'s `Interceptor` or decorating an `http.Client` to calculate duration and collect data.

**Reporting Strategy**: All events are first placed in a memory queue. Batch reporting is triggered by **time** (`Timer.periodic`), **quantity** (queue length), or **app lifecycle events** (`AppLifecycleListener`) to improve efficiency and data reliability.

## 📊 Data Structure Example

- **Error Event** (with common parameters)



```json
{
  "category": "error", // Passed in by the caller (e.g., 'error', 'performance', 'behavior')
  "data": {
    "type": "dart_error", // Type of error
    "error": "NoSuchMethodError: The method 'hello' was called on null.", // Error message
    "stack": "..." // Stack trace
  },
  "timestamp": "2025-01-15 20:30:00", // Timestamp of the event
  "appInfo": { "appKey": "your_app_key", "appVersion": "1.0.0" }, // App info from package_info_plus or manual config
  "userInfo": { "userId": "user_abc_123" }, // User info (runtime info takes precedence over config)
  "deviceInfo": { "model": "Pixel 7", "isPhysicalDevice": true }, // Device info from device_info_plus
  "platform": "android" // Platform info
}
```

- **Jank Event** (with detailed parameters)



```json
// Core Jank Data
// type: Event type
// page: Current page
// jank_count: Number of consecutive jank frames
// max_duration_ms: Duration of the slowest frame in the sequence
// average_duration_ms: Average duration of frames in the sequence
// frame_budget_ms: The expected time for one frame (e.g., 16.67ms for 60Hz)
// jank_threshold_ms: The threshold to consider a frame as jank
// device_performance: Device performance metrics
// 
// Device Performance Analysis
// average_frame_time_ms: Average frame time over a recent period
// frame_time_variance: Variance in frame times
// fps: Actual frames per second
// stability: A metric for frame time stability
// percentiles: Frame time percentiles (p50, p90, etc.)
// anomalous_frame_count: Number of anomalous frames
// device_level: Assessed performance level of the device
// recent_frame_count: Number of frames in the recent sample
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
  // ...common fields
}
```

## Example: Full Configuration



```dart
// example/main.dart (Optimized)
import 'package:dio/dio.dart';
import 'package:example/home_page.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

// 1. Create a global Dio instance and add the interceptor
final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);

void main() async {
  // Record start time to calculate app launch duration
  final appStartTime = DateTime.now();

  // Ensure the Flutter engine is initialized
  WidgetsFlutterBinding.ensureInitialized();

  // 2. Recommended: Automatically fetch app info from package_info_plus
  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'YOUR_UNIQUE_APP_KEY', // Replace with your App Key
    channel: 'official',
    environment: kReleaseMode ? 'production' : 'development',
  );

  // 3. Configure the monitoring SDK
  final monitorConfig = MonitorConfig(
    appInfo: appInfo,
    enableJankMonitor: true, // Enable jank monitoring
    jankConfig: JankConfig.defaultConfig(), // Use default jank configuration
    outputs: [
      // Use different outputs for different environments
      if (kDebugMode)
        LogMonitorOutput(), // In Debug mode, print logs to the console

      if (kReleaseMode)
        HttpOutput(
          serverUrl: 'https://your-backend.com/report', // Replace with your reporting URL
          batchReportSize: 20, // Report after accumulating 20 events
        ),
      
      // If you need to integrate with your own logging system, use CustomLogOutput
      // CustomLogOutput(onLog: (event) => myCustomLogger.log(event)),
    ],
  );

  // 4. Initialize the SDK
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
      // 5. Inject the route observer for PV and page performance monitoring
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      routes: {
        '/': (context) => HomePage(dio: dio),
        '/detail': (context) => const DetailPage(),
        // ... other routes
      },
      initialRoute: '/',
    );
  }
}
```

## 🗺️ Roadmap

See [实施计划](docs/implementation_plan.md).

## 🤝 Contributing

Contributions of all kinds are welcome, including but not limited to:

- Submitting issues or suggestions
- Sending Pull Requests
- Improving documentation

## 📄 License

This SDK is licensed under the [MIT](https://opensource.org/licenses/MIT) License.
