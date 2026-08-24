# flutter_monitor_sdk

Flutter runtime 监控 SDK。版本 `1.0.0`。

采集错误、冷/热启动、页面/路由、HTTP、业务 `track` 和 lifecycle，写入统一 `EventEnvelope`。frame、jank、memory、`measure` 和 native 默认关闭，需 `MonitorSignalConfig` 显式开启。

## 接入

```dart
final appStartTime = DateTime.now();
WidgetsFlutterBinding.ensureInitialized();

final appInfo = await AppInfo.fromPackageInfo(
  appKey: 'my_app',
  environment: 'dev', // 自由字符串；推荐 dev/test/staging/production
);

await FlutterMonitorSDK.init(
  config: MonitorConfig(
    appInfo: appInfo,
    mode: MonitorMode.localLive(),
  ),
  appStartTime: appStartTime,
);

dio.interceptors.add(FlutterMonitorSDK.createDioInterceptor());

MaterialApp(
  navigatorObservers: [FlutterMonitorSDK.routeObserver],
);
```

公开 API：`init`、`isInitialized`、`routeObserver`、`markPageRendered`、`createDioInterceptor`、`createHttpClient`、`setContext`、`clearContext`、`track`、`recordError`、显式开启后的 `measure`、`flush`、`dispose`。

输出模式：`MonitorMode.consoleOnly()` / `localLive()` / `production(...)`。日志模式为 `compact` / `quiet` / `json` / `silent`，没有 `pretty`。

## 文档

- 仓库入口：[`README.md`](../../README.md)
- 事件模型：[`docs/event_model.md`](../../docs/event_model.md)
- 采集设计：[`docs/signal_collection.md`](../../docs/signal_collection.md)
- 示例：[`example/README.md`](example/README.md)
