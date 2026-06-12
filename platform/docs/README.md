# Platform Docs

本目录维护 Platform JS/TS workspace 文档。Workbench 是 UI 产品名。项目级事件模型、字段注册、采集口径、DevTools 和生产服务端协议仍在根目录 `docs/` 中维护。

## Documents

- [Platform 架构与计划](workbench_plan.md)：Monitor Service、Datasource、存储、脚本编排、MVP 和验收标准。
- [Workbench 产品计划](product_plan.md)：Workbench Web 产品定位、信息架构、展示原则、页面职责和交互口径。
- [Workbench Service API（已废弃）](service_api.md)：历史 endpoint 说明；当前请以 `http://localhost:3700/docs`（Swagger）和 [`services/monitor-service/docs/boundaries.md`](../services/monitor-service/docs/boundaries.md) 为准。

## Boundary

Platform 只消费统一 `EventEnvelope`，不定义第二套事件模型。字段、状态、信号名、链路关系和隐私等级以根目录文档和 `packages/flutter_monitor_core` 为准。

当 Workbench 展示发现数据不对时，先判断问题归属：

- 纯布局、交互、查询和可视化问题：修改 `platform/web`。
- 字段缺失、语义不对、状态流转不对：先审查根目录 `docs/`，再看 `flutter_monitor_core`、`flutter_monitor_sdk` 或 `flutter_monitor_native`。
- 服务端查询摘要口径问题：先确认摘要能否从原始 envelope 推导，不能把摘要字段写回 envelope。

端口规则：`4700` 是 Workbench Web 开发入口，`3700` 是 Monitor Service API。调试时如果这两个端口已有本项目 platform 进程活跃，默认复用。
