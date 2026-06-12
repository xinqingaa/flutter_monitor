# Flutter Monitor

Flutter Monitor 是一个以链路为组织方式的 Flutter 端侧监控 workspace。它把错误、启动、页面、网络、行为、卡顿、内存、生命周期、native 和自定义业务信号归一到统一 `EventEnvelope`，再通过 `session`、`trace`、`span`、`breadcrumb`、`context` 和 `resource` 还原一次真实用户或 QA 会话。

项目的核心原则是：文档先行，`flutter_monitor_core` 统一约定字段和状态，`flutter_monitor_sdk` 执行 Flutter runtime 采集，`flutter_monitor_native` 提供 native 增强，Workbench 只消费统一 envelope 做诊断展示。不要为 SDK、native、Workbench、DevTools、CLI、MCP 或服务端创建第二套模型。

## Workspace

```text
flutter_monitor/
  docs/                         项目级模型、架构、采集、协议和计划
  packages/
    flutter_monitor_core/       字段、schema、状态、summary、隐私规则
    flutter_monitor_sdk/        Flutter runtime SDK、采集器、pipeline、outputs
      example/                  SDK 接入示例 App
    flutter_monitor_native/     可选 native 生命周期和内存增强
  platform/                     JS/TS workspace：Monitor Service、Workbench Web、shared
    docs/                       Platform 架构、Workbench 产品与 API 文档
    services/monitor-service/ NestJS：ingest、SQLite、查询、SSE、Swagger
    web/                        Workbench UI（React/Vite）
    shared/                     TypeScript wire mirror 和共享 helper
  scripts/                      检查、platform 和 example 启动脚本
  SKILL.md                      本仓库变更工作流
  AGENTS.md                     项目方向和硬约束
```

## Package Roles

- `packages/flutter_monitor_core` 是唯一模型来源，定义 `FieldPaths`、协议常量、字段注册、事件摘要、隐私等级和共享配置。它不依赖 Flutter，也不做采集、网络或 UI effect。
- `packages/flutter_monitor_sdk` 是 Flutter 应用接入的主 SDK，负责错误、启动、页面、网络、行为、卡顿、内存、生命周期、自定义 trace、pipeline 和 output。
- `packages/flutter_monitor_native` 是可选 Flutter plugin，提供 native lifecycle、native memory、memory pressure 等增强信号，并通过统一模型回到 SDK pipeline。
- `platform` 是 JS/TS workspace，承载 Monitor Service、Workbench Web 和 TypeScript 共享层。Workbench 是 UI 产品名；诊断规则与 Evidence API 也归属 platform，但不定义事件模型，不改写 SDK envelope。

## Change Workflow

任何字段、事件语义、状态流转、链路关系、服务端协议或 Flutter runtime 行为变更，都按以下顺序推进：

1. 审查并更新 `docs/` 或 `platform/docs/`。
2. 如涉及字段、状态或 summary，更新 `packages/flutter_monitor_core`。
3. 如涉及 Flutter runtime 采集或 output，更新 `packages/flutter_monitor_sdk`。
4. 如涉及 native 生命周期、内存或平台信号，更新 `packages/flutter_monitor_native`。
5. 最后更新 Monitor Service / Workbench web 展示、查询和说明。

纯 Workbench UI 问题可以只改 `platform/web`，但如果发现数据语义不对，必须先回到文档和 core/sdk/native 判断根因，不能在 UI 层补出第二套事实。

详细执行规则见 [SKILL.md](SKILL.md)。

## Quick Start

安装 Dart/Flutter workspace 依赖：

```sh
fvm flutter pub get
```

运行核心检查：

```sh
bash scripts/check.sh
```

启动 Workbench：

```sh
bash scripts/platform.sh dev
```

默认端口：

- Workbench Web: `http://localhost:4700`
- Monitor Service/API: `http://localhost:3700`
- Swagger API 文档: `http://localhost:3700/docs`
- API 前缀：`http://localhost:3700/api/monitor/v1/*`

如果 `4700` 或 `3700` 已经有本项目 Workbench 进程活跃，默认复用它，不主动关闭或另起临时端口。若端口被非 Workbench 进程占用，先确认归属再决定是否换端口。

启动 example 并接入本地 Workbench：

```sh
bash scripts/run_example.sh
```

只运行 Flutter example 或接入外部服务：

```sh
bash scripts/run_example.sh --no-workbench
bash scripts/run_example.sh --server-url http://host:3700/api/monitor/v1/events
```

## Common Commands

```sh
fvm dart test packages/flutter_monitor_core/test
fvm flutter test packages/flutter_monitor_sdk/test
fvm flutter test packages/flutter_monitor_native/test

pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
```

## Documentation

项目级文档：

- [背景与方向](docs/background.md)
- [目标架构](docs/architecture.md)
- [事件模型](docs/event_model.md)
- [信号采集设计](docs/signal_collection.md)
- [服务端协议](docs/server_protocol.md)
- [DevTools 集成](docs/devtools_integration.md)
- [实施计划](docs/plan.md)

Platform / Workbench 文档：

- [Platform README](platform/README.md)
- [Platform 文档索引](platform/docs/README.md)
- [Platform 架构与计划](platform/docs/workbench_plan.md)
- [Workbench 产品计划](platform/docs/product_plan.md)
- [Monitor Service 数据边界](platform/services/monitor-service/docs/boundaries.md)
- [Workbench Service API（已废弃，见 Swagger）](platform/docs/service_api.md)

`README.md` 只作为项目入口。事件模型以 `docs/event_model.md` 为准；采集口径以 `docs/signal_collection.md` 为准；Platform 边界以 `platform/docs/` 为准。

## License

MIT. See [LICENSE](LICENSE).
