# Flutter Monitor Workbench

Workbench 是 Flutter Monitor 的本地调试、QA 复现和链路诊断工作台。它消费 SDK 上报的统一 `EventEnvelope`，提供 session timeline、trace/event detail、性能分析、查询、SSE live 和 raw JSON 回查。

Workbench 不是 SDK runtime，不是生产服务端，也不是事件模型来源。它不能定义第二套 schema，不能把 query summary 写回 envelope，不能用 UI 字段替代 `flutter_monitor_core` 的字段约定。

## Structure

```text
workbench/
  docs/
    README.md
    workbench_plan.md      架构、Service、Datasource、脚本和验收标准
    product_plan.md        前端产品定位、信息架构和展示原则
    service_api.md         本地 service HTTP API 和查询摘要口径
  service/                 Express + TypeScript local service
  web/                     React + Vite + TypeScript UI
  shared/                  TypeScript wire mirror 和共享 helper
```

## Ports

| 地址 | 用途 |
|---|---|
| `http://localhost:4700/` | Workbench Web 开发入口 |
| `http://localhost:3700/` | service 静态入口，通常只用于 build 后预览 |
| `http://localhost:3700/api/monitor/v1/*` | SDK 写入、Workbench 查询和 SSE API |

调试时优先使用 `4700` 访问前端、`3700` 访问 API。如果 `4700` 或 `3700` 已经有 Flutter Monitor Workbench 进程活跃，默认复用它，不主动关闭、不另起临时端口。若端口被其他进程占用，先确认归属再决定是否换端口。

## Commands

从仓库根目录运行：

```sh
bash scripts/workbench.sh install
bash scripts/workbench.sh dev
bash scripts/workbench.sh service
bash scripts/workbench.sh web
bash scripts/workbench.sh build
bash scripts/workbench.sh typecheck
bash scripts/workbench.sh status
bash scripts/workbench.sh stop
```

也可以直接在 JS workspace 中运行：

```sh
pnpm --dir workbench install
pnpm --dir workbench dev
pnpm --dir workbench typecheck
pnpm --dir workbench build
pnpm --dir workbench --filter @flutter-monitor/workbench-service run smoke
```

## Data Contract

- service 写入接口接收单条 `EventEnvelope` 或 `{ "events": [...] }` batch。
- 原始查询接口返回入库 envelope 本身。
- session/performance/group 接口可以返回 Workbench query summary，但摘要不是 SDK schema。
- 所有 UI 摘要必须能回查 `eventId`、`sessionId`、`traceId` 或 `spanId`。
- 字段、状态、信号名和热重启语义以根目录 `docs/` 和 `packages/flutter_monitor_core` 为准。

## Documentation

- [Workbench 文档索引](docs/README.md)
- [架构与计划](docs/workbench_plan.md)
- [产品计划](docs/product_plan.md)
- [Service API](docs/service_api.md)

项目级模型、采集和协议文档在根目录 [../docs](../docs)。
