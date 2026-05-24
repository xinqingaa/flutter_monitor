# Flutter Monitor SDK

[中文](README_zh.md)

Flutter Monitor SDK is a Flutter client-side monitoring and trace-observability SDK.
It collects errors, performance, network, page, behavior, jank, memory, lifecycle, and custom business signals, then organizes them into diagnosable user session timelines through a unified session/trace/span/breadcrumb/context model.

The project is not replacing monitoring with tracing. Existing signal collectors remain valuable; the target is to connect those signals so teams can reconstruct what happened in a real user or QA session.

## Documentation

- [Background and direction](docs/background.md)
- [Event model](docs/event_model.md)
- [Target architecture](docs/architecture.md)
- [DevTools integration](docs/devtools_integration.md)
- [Server protocol](docs/server_protocol.md)
- [Implementation plan](docs/implementation_plan.md)

`README.md` is only the project entry point. The event model and protocol are defined in `docs/event_model.md` and `docs/server_protocol.md`.

## Current Integration

Initialize the SDK as early as possible:

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

Attach the route observer so page, PV, and page-performance signals can be linked to route context:

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

Attach network instrumentation:

```dart
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;

final dio = Dio()..interceptors.add(FlutterMonitorSDK.dioInterceptor);
final http.Client client = FlutterMonitorSDK.httpClient;
```

Wrap important user actions so they can become breadcrumbs or business trace entry points:

```dart
MonitoredGestureDetector(
  identifier: 'buy_now_button',
  onTap: () {
    // Business logic.
  },
  child: const Text('Buy Now'),
)
```

## Target Event Shape

All signals should be normalized into a unified event envelope:

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt_001",
  "timestamp": "2026-05-24T12:00:00.000+08:00",
  "signalType": "span",
  "name": "http.client",
  "level": "info",
  "status": "ok",
  "durationMs": 523,
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

The old loose `category + data` shape is historical compatibility only and is not the target protocol.

## Core Signals

- Errors: Flutter framework errors, Dart errors, and manually reported business errors.
- Launch and performance: cold start, hot start, page first frame, page interactive, custom trace/span.
- Page and route: route enter/leave, PV, page dwell, route stack, module, scene.
- Network: Dio and `http` request spans with normalized URL, status, duration, retry, cache, and size metadata.
- Behavior: taps, key actions, business operations, and breadcrumbs.
- Jank and memory: frame timing sequences, FPS/stability, device tier, memory samples, and growth signals.
- Lifecycle: foreground/background, resume, shutdown flush, and SDK self-monitoring.

## Development

```bash
flutter pub get
flutter analyze
flutter test

cd example
flutter pub get
flutter run
```

## Roadmap

See [Implementation plan](docs/implementation_plan.md).

## License

This SDK is licensed under the [MIT](https://opensource.org/licenses/MIT) License.
