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
  workbench/                    本地调试和 QA 复现工作台
    docs/                       Workbench 架构、产品和 service API 文档
    service/                    本地写入、SQLite 存储、查询和 SSE
    web/                        React/Vite 诊断界面
    shared/                     TypeScript wire mirror 和共享 helper
  scripts/                      检查、Workbench 和 example 启动脚本
  SKILL.md                      本仓库变更工作流
  AGENTS.md                     项目方向和硬约束
```

## Package Roles

- `packages/flutter_monitor_core` 是唯一模型来源，定义 `FieldPaths`、协议常量、字段注册、事件摘要、隐私等级和共享配置。它不依赖 Flutter，也不做采集、网络或 UI effect。
- `packages/flutter_monitor_sdk` 是 Flutter 应用接入的主 SDK，负责错误、启动、页面、网络、行为、卡顿、内存、生命周期、自定义 trace、pipeline 和 output。
- `packages/flutter_monitor_native` 是可选 Flutter plugin，提供 native lifecycle、native memory、memory pressure 等增强信号，并通过统一模型回到 SDK pipeline。
- `workbench` 是诊断工作台，负责本地调试、QA 复现、session timeline、trace/event detail、性能分析和 raw envelope 回查。它不定义事件模型，不改写 SDK envelope。

## Change Workflow

任何字段、事件语义、状态流转、链路关系、服务端协议或 Flutter runtime 行为变更，都按以下顺序推进：

1. 审查并更新 `docs/` 或 `workbench/docs/`。
2. 如涉及字段、状态或 summary，更新 `packages/flutter_monitor_core`。
3. 如涉及 Flutter runtime 采集或 output，更新 `packages/flutter_monitor_sdk`。
4. 如涉及 native 生命周期、内存或平台信号，更新 `packages/flutter_monitor_native`。
5. 最后更新 Workbench service/web 展示、查询和说明。

纯 Workbench UI 问题可以只改 `workbench`，但如果发现数据语义不对，必须先回到文档和 core/sdk/native 判断根因，不能在 Workbench 层补出第二套事实。

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
bash scripts/workbench.sh dev
```

默认端口：

- Workbench Web: `http://localhost:4700`
- Workbench Service/API: `http://localhost:3700`
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

pnpm --dir workbench typecheck
pnpm --dir workbench build
pnpm --dir workbench --filter @flutter-monitor/workbench-service run smoke
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

Workbench 文档：

- [Workbench README](workbench/README.md)
- [Workbench 文档索引](workbench/docs/README.md)
- [Workbench 架构与计划](workbench/docs/workbench_plan.md)
- [Workbench 产品计划](workbench/docs/product_plan.md)
- [Workbench Service API](workbench/docs/service_api.md)

`README.md` 只作为项目入口。事件模型以 `docs/event_model.md` 为准；采集口径以 `docs/signal_collection.md` 为准；Workbench 边界以 `workbench/docs/` 为准。

## License

MIT. See [LICENSE](LICENSE).
