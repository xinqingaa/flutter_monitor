# Platform / Workbench 文档

本目录描述当前 Monitor Service 与 Workbench。项目级事件模型、SDK 采集和写入协议仍以根目录 `docs/` 为准。

![Flutter Monitor V2 Workbench 排查流程](../../docs/image/04-v2-workbench-troubleshooting.png)

## 文档导航

| 文档 | 事实范围 |
|---|---|
| [Workbench 产品](product.md) | 用户任务、信息架构、共享交互、Catalog、详情与 Session 工作区 |
| [Workbench 功能](FEATURES.md) | 当前功能清单、查询入口和明确限制 |
| [Workbench 设计](DESIGN.md) | 设计系统、组件组合、桌面工作台与交互原则 |
| [Platform 架构](architecture.md) | Service / Web / shared 职责、数据流、查询面与排查食谱 |
| [Monitor Service 数据边界](../services/monitor-service/docs/boundaries.md) | raw envelope、SQLite 索引、Catalog、Analytics 和 Session view model 边界 |
| [Example Demo](EXAMPLE_DEMO.md) | PulseFit example 与 `/api/example/v1` mock 契约 |

运行时 API：

- Swagger：`http://localhost:3700/docs`
- OpenAPI JSON：`http://localhost:3700/docs-json`
- Workbench：`http://localhost:4700`

## Workbench 入口

```text
概览       /
Session    /sessions
HTTP       /http
埋点       /business
异常       /errors
```

Session、HTTP、埋点和异常均支持独立详情或 Session 链路回查。Workbench 的摘要、图表、Catalog item 和 Session row 都是派生视图，raw `EventEnvelope` 才是事件事实源。

## 事实优先级

出现冲突时按以下顺序核对：

1. 根目录 `docs/event_model.md` 与 `flutter_monitor_core`：字段和事件语义；
2. 根目录 `docs/signal_collection.md` 与 SDK：采集时机和配置；
3. `services/monitor-service/docs/boundaries.md` 与 Swagger：查询和存储边界；
4. `product.md`、`FEATURES.md`、`DESIGN.md`：Workbench 产品与交互；
5. Workbench 代码中的临时 view model 不得覆盖上述事实。

Workbench 展示异常时先检查 Event Detail 的 Raw JSON。envelope 正确则修 Service/Web；envelope 错误则回到 core/SDK/native，不能在 UI 层补造字段。
