# Flutter Monitor Workflow Skill

本文件定义在本仓库内修改代码和文档时必须执行的工作流。目标是保证 `docs`、`flutter_monitor_core`、`flutter_monitor_sdk`、`flutter_monitor_native` 和 Workbench 长期一致。

## Core Principle

`docs` 是事实基础。任何字段、事件语义、状态流转、链路关系、采集职责、协议或 Workbench 展示口径变化，都不能只改代码或只改 UI。

职责边界：

- Flutter Monitor 是以 session/trace/span/breadcrumb/context 组织的 Flutter 端侧监控 workspace。
- `packages/flutter_monitor_core` 是唯一约定来源，定义所有字段、状态、协议常量、字段注册、summary 和隐私规则。
- `packages/flutter_monitor_sdk` 是 Flutter runtime 执行层，负责采集、链路管理、pipeline、outputs 和 example。
- `packages/flutter_monitor_native` 是可选增强层，提供 native lifecycle、native memory、memory pressure 等平台能力。
- `workbench` 是消费层，只做诊断展示、查询、SSE live 和 raw envelope 回查，不定义第二套事件模型。

## Triage Flow

处理任何问题前，先判断它属于哪一层：

1. 纯 Workbench 展示问题
   - 例：布局、侧栏、颜色、卡片、图表、文案、筛选交互。
   - 先看 `workbench/docs/README.md`、`workbench/docs/product_plan.md`、`workbench/docs/workbench_plan.md`。
   - 通常只改 `workbench/web` 或 `workbench/service` 查询摘要。

2. Workbench 数据展示不对
   - 先用 raw API 或 raw JSON 确认 envelope 本身是否正确。
   - 本地 raw API：`http://localhost:3700/api/monitor/v1/recent?limit=80`。
   - 如果 raw envelope 正确，修 Workbench service/web。
   - 如果 raw envelope 错误，进入 Flutter runtime / core 流程。

3. 字段、状态、事件名或链路语义不对
   - 先审查根目录 `docs/event_model.md`、`docs/signal_collection.md`、`docs/server_protocol.md`、`docs/plan.md`。
   - 再审查 `packages/flutter_monitor_core` 的 `FieldPaths`、协议常量、field registry、summary 和测试。
   - 再审查 `packages/flutter_monitor_sdk` 或 `packages/flutter_monitor_native` 的实际发出逻辑。
   - 最后回到 Workbench 更新展示和查询口径。

4. Flutter runtime 行为问题
   - 先查文档是否定义了触发时机、字段映射、状态流转和降级策略。
   - 若文档缺失，先补文档。
   - 若需要字段或状态变化，先改 core。
   - 再改 SDK/native。
   - 最后改 Workbench 和 example。

## Change Order

按影响范围执行：

1. Documentation
   - 项目级模型和采集：`docs/`。
   - Workbench 专属架构、产品和 API：`workbench/docs/`。
   - README 只做入口，不作为唯一事实源。

2. Core
   - `packages/flutter_monitor_core/lib/src/constants/field_paths.dart`
   - `packages/flutter_monitor_core/lib/src/constants/protocol_values.dart`
   - `packages/flutter_monitor_core/lib/src/schema/field_registry.dart`
   - `packages/flutter_monitor_core/lib/src/summary/event_summarizer.dart`
   - 对应 tests

3. SDK / Native
   - SDK 负责 Flutter runtime 采集、trace/span/breadcrumb/session、pipeline、outputs。
   - Native 负责 native lifecycle、native memory、memory pressure、OOM/ANR/crash 等增强。
   - SDK/native 不得发出 core 未注册或文档未解释的稳定字段。

4. Workbench
   - service 只能存储和查询 SDK envelope，不能补写 SDK 字段。
   - web 可以构建 UI view model，但 view model 不能成为协议。
   - query summary 必须能回查原始 envelope。

5. Example and docs refresh
   - 更新 `packages/flutter_monitor_sdk/example` 以展示当前推荐接入方式。
   - 更新 README 和文档索引。

## Workbench Debug Ports

Workbench 默认端口：

- Web: `http://localhost:4700`
- Service/API: `http://localhost:3700`

如果 `4700` 或 `3700` 已经活跃，默认认为用户正在调试：

- 先复用已有 Workbench 进程。
- 不主动关闭进程。
- 不随意另起临时端口。
- 如果端口不是本项目 Workbench 进程，再告知用户并让用户决定是换端口还是关闭占用进程。

`scripts/workbench.sh` 已实现同项目 Workbench 端口复用和非 Workbench 占用报错。调试时优先使用该脚本。

## Hot Start Semantics

当前热重启语义必须保持：

- `app.background_duration.durationMs` 是后台停留间隔。
- `app.hot_start.durationMs` 是从 resumed 后到恢复观测点的热重启耗时。
- 两者不能复用同一个 duration 值。
- `app.hot_start` 必须带 `app.start.type = hot`。
- `app.hot_start` 必须用 `app.start.end_reason` 标明闭合口径，例如 `first_frame`、`interactive`、`timeout`、`manual`。
- Workbench 可以单独展示后台间隔，但不能把后台间隔并入热重启耗时统计。

## Verification

按改动范围选择验证：

```sh
fvm dart test packages/flutter_monitor_core/test
fvm flutter test packages/flutter_monitor_sdk/test
fvm flutter test packages/flutter_monitor_native/test

pnpm --dir workbench typecheck
pnpm --dir workbench build
pnpm --dir workbench --filter @flutter-monitor/workbench-service run smoke
```

全量检查：

```sh
bash scripts/check.sh
```

文档迁移或链接调整后至少运行：

```sh
rg "(^|[^/])docs/workbench_(plan|product_plan|service_api)\\.md|workbench_service_api|workbench_product_plan" README.md AGENTS.md docs workbench/docs
rg "热恢复" docs workbench/docs workbench/README.md README.md AGENTS.md
```

## Stop Conditions

不要为了让 UI 看起来正确而在 Workbench 层伪造 SDK 字段。不要为了快速修 SDK 而跳过文档和 core。发现文档与代码不一致时，先指出不一致，再按本文件的顺序修正。
