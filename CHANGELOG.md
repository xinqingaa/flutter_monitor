# Changelog

## 1.0.0

当前 workspace 能力（以代码为准）：

- 统一 `EventEnvelope`：`flutter_monitor_core` 0.1.0 作为唯一模型、字段注册、隐私和 summary 来源。
- SDK 1.0.0 默认采集错误、冷/热启动、页面/路由、Dio/`http`、业务 `track` 和 lifecycle。
- `MonitorSignalConfig` 中 frame、jank、memory、interaction measure、native 默认关闭。
- 三种输出：`consoleOnly`（compact/quiet/json/silent）、`localLive`（本机 Monitor Service）、`production`（SQLite 离线队列、batch、retry）。
- HTTP query/headers/body 默认写入 sensitive payload，可配置 `MonitorHttpConfig.redactor` 或关闭采集项。
- 可选 `flutter_monitor_native` 0.1.0：resource、memory、pressure、lifecycle；OOM/ANR/crash 仅 schema 边界。
- Workbench + Monitor Service 消费 raw envelope；无 DevTools extension、无 session 文件导入/导出工作流。

## 0.1.0

- 初始 workspace 与核心模型。
