# Changelog

## 2.0.0

- `flutter_monitor_core`、`flutter_monitor_sdk`、`flutter_monitor_native` 与 example 统一版本 `2.0.0`。
- envelope 写入 `resource.sdk.version` / `resource.sdk.coreVersion`；native `bridgeVersion` 与包版本对齐。
- 默认主链路仍是错误、冷/热启动、页面/路由、Dio/`http`、业务 `track` 和 lifecycle。
- frame、jank、memory、measure、native 仍由 `MonitorSignalConfig` 显式开启。
- 三种输出：`consoleOnly`、`localLive`、`production`。HTTP query/headers/body 默认写入 sensitive payload。
- Native crash / OOM / ANR、DevTools extension、session 文件导入/导出仍不是当前能力。

## 1.0.0

- workspace 落地统一 `EventEnvelope` 与本地 Workbench 排查链路。当时 core/native 为 `0.1.0`，SDK 为 `1.0.0`。

## 0.1.0

- 初始 workspace 与核心模型。
