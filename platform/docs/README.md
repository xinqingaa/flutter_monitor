# Workbench Docs

本目录只维护 Workbench 专属文档。项目级事件模型、字段注册、采集口径、DevTools 和生产服务端协议仍在根目录 `docs/` 中维护。

## Documents

- [Workbench 架构与计划](workbench_plan.md)：Workbench 定位、Service、Datasource、存储、脚本编排、MVP 和验收标准。
- [Workbench 产品计划](product_plan.md)：前端产品定位、信息架构、展示原则、页面职责和交互口径。
- [Workbench Service API](service_api.md)：本地 `workbench/service` HTTP API、端口、raw envelope 查询和 query summary 字段。

## Boundary

Workbench 只消费统一 `EventEnvelope`，不定义第二套事件模型。字段、状态、信号名、链路关系和隐私等级以根目录文档和 `packages/flutter_monitor_core` 为准。

当 Workbench 展示发现数据不对时，先判断问题归属：

- 纯布局、交互、查询和可视化问题：修改 `workbench`。
- 字段缺失、语义不对、状态流转不对：先审查根目录 `docs/`，再看 `flutter_monitor_core`、`flutter_monitor_sdk` 或 `flutter_monitor_native`。
- 服务端查询摘要口径问题：先确认摘要能否从原始 envelope 推导，不能把摘要字段写回 envelope。

端口规则：`4700` 是前端开发入口，`3700` 是 service/API。调试时如果这两个端口已有本项目 Workbench 进程活跃，默认复用。
