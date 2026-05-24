# Flutter Monitor

Flutter Monitor 是一个面向 Flutter 应用的端侧监控与链路观测 workspace。
它采集错误、性能、网络、页面、行为、卡顿、内存、生命周期和自定义业务信号，并通过统一的 session/trace/span/breadcrumb/context 模型，把这些信号组织成可回放、可聚合、可定位的用户会话链路。

本项目不是要用链路替代监控。现有信号采集器仍然有价值；目标是把这些信号连接起来，让团队能还原真实用户或 QA 会话里发生了什么。

目标仓库架构使用 Dart pub workspaces：

- `flutter_monitor_core`：共享事件模型、schema、隐私规则和 session export 格式。
- `flutter_monitor_sdk`：Flutter runtime 主 SDK 和业务接入包。
- `flutter_monitor_native`：可选 native plugin，提供 native memory、OOM、ANR、crash 等增强信号。

## 文档

- [背景与方向](docs/background.md)
- [事件模型](docs/event_model.md)
- [信号采集设计](docs/signal_collection.md)
- [目标架构](docs/architecture.md)
- [DevTools 集成](docs/devtools_integration.md)
- [服务端协议](docs/server_protocol.md)
- [实施计划](docs/implementation_plan.md)

`README.md` 只作为项目入口。事件模型和服务端协议以 `docs/event_model.md` 与 `docs/server_protocol.md` 为准。

## 当前接入方式

尽可能早地初始化 SDK：

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() async {
  final appStartTime = DateTime.now();
  WidgetsFlutterBinding.ensureInitialized();

  final appInfo = await AppInfo.fromPackageInfo(
    appKey: 'YOUR_APP_KEY',
    channel: 'official',
    environment: kReleaseMode ? 'production' : 'development',
  );

  await FlutterMonitorSDK.init(
    config: MonitorConfig(
      appInfo: appInfo,
      outputs: [
        if (kDebugMode) LogMonitorOutput(),
        if (kReleaseMode)
          HttpOutput(serverUrl: 'https://your-backend.example.com/api/monitor/events'),
      ],
    ),
    appStartTime: appStartTime,
  );

  runApp(const MyApp());
}
```

注入 route observer，让页面、PV 和页面性能信号能关联 route context：

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [FlutterMonitorSDK.routeObserver],
      home: const HomePage(),
    );
  }
}
```

接入网络采集：

```dart
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;

final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);
final http.Client client = FlutterMonitorSDK.httpClient;
```

包裹关键用户行为，让它们成为 breadcrumb 或业务 trace 的入口：

```dart
MonitoredGestureDetector(
  identifier: 'buy_now_button',
  onTap: () {
    // 业务逻辑。
  },
  child: const Text('立即购买'),
)
```

## 事件模型简例

所有信号都应被归一化为统一 event envelope。完整 schema 以 [事件模型](docs/event_model.md) 为准，下面仅展示一个 `http.client` span 的简化示例：

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt_001",
  "timestamp": "2026-05-24T12:00:00.000+08:00",
  "startTime": "2026-05-24T12:00:00.000+08:00",
  "endTime": "2026-05-24T12:00:00.523+08:00",
  "durationMs": 523,
  "signalType": "span",
  "name": "http.client",
  "level": "info",
  "status": "ok",
  "sessionId": "ses_001",
  "traceId": "trace_page_product_detail",
  "spanId": "span_http_product",
  "parentSpanId": "span_page_product_detail",
  "resource": {},
  "context": {},
  "attributes": {
    "http.method": "GET",
    "http.url.normalized": "/api/product/{id}",
    "http.status_code": 200
  },
  "payload": {}
}
```

## 核心信号

- 错误：Flutter framework error、Dart error、业务主动上报错误。
- 启动与性能：冷启动、热启动、首帧、可交互时间、自定义 trace/span。
- 页面与路由：route enter/leave、PV、页面停留、route stack、module、scene。
- 网络：Dio 和 `http` 请求 span，包含 normalized URL、状态码、耗时、重试、缓存和大小信息。
- 行为：点击、关键操作、业务动作和 breadcrumbs。
- 卡顿与内存：frame timing、FPS/stability、设备等级、内存采样和增长线索。
- 生命周期：前后台切换、启动恢复、退出前 flush 和 SDK 自监控。
- Native 可选增强：native memory、memory pressure、OOM、ANR、native crash 和 native lifecycle。


## 路线图

见 [实施计划](docs/implementation_plan.md)。

## 许可证

本 SDK 采用 [MIT](https://opensource.org/licenses/MIT) 许可证。
