# flutter_monitor_native

可选 Flutter plugin。版本 `0.1.0`。

提供 Android/iOS 的 native resource、memory、memory pressure 和 lifecycle 原始事实。SDK 通过 `FlutterMonitorNative().createBridge()` 得到 `MonitorNativeBridge`，再进入同一 pipeline。本包不独立上报。

OOM、ANR、native crash 当前只有 schema 与 mapper 边界，没有可靠平台捕获。

```dart
await FlutterMonitorSDK.init(
  config: MonitorConfig(
    appInfo: appInfo,
    mode: MonitorMode.localLive(),
    signals: const MonitorSignalConfig(native: true),
    nativeBridge: FlutterMonitorNative().createBridge(),
  ),
  appStartTime: appStartTime,
);
```

未配置 bridge 或 `signals.native = false` 时走 no-op，默认 Flutter 主链路不受影响。
