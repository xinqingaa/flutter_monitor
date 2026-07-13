# Platform Docs

本目录描述 **当前** Platform / Workbench：产品怎么用、架构怎么拆、数据边界在哪。项目级事件模型与采集仍在根目录 `docs/`。

## 文档

| 文档 | 内容 |
|---|---|
| [产品](product.md) | 信息架构、共享交互、HTTP 样板、大屏 / 埋点 / 异常 / Session、明确不做与当前局限 |
| [架构](architecture.md) | workspace 布局、Service / Web 职责、数据边界、排查食谱、Example 边界 |
| [Example Demo](EXAMPLE_DEMO.md) | 体育健康 example + `/api/example/v1` mock 契约 |

API endpoint 清单：`http://localhost:3700/docs`（Swagger）。查询与摘要口径补充：[`services/monitor-service/docs/boundaries.md`](../services/monitor-service/docs/boundaries.md)。

## 边界

- Platform 只消费统一 `EventEnvelope`，不定义第二套模型。
- 纯布局 / 交互问题改 `platform/web`；字段语义不对先查根目录文档与 core。
- 端口：Web `4700`，Service `3700`；已有本项目进程时默认复用。
