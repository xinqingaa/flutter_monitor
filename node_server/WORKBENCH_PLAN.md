# Flutter Monitor Workbench Plan

`node_server` 当前定位是本地调试与完整 JSON 回查服务。它接收 SDK pipeline 输出的完整 `EventEnvelope`，并提供按 `eventId`、`sessionId`、`traceId` 查询的最小能力。

未来可以在此基础上演进一个 React 工作台，但必须遵守以下边界：

- 工作台只消费统一 `EventEnvelope`，不定义第二套事件模型。
- 控制台、工作台预览、CLI/MCP 预览应复用 `flutter_monitor_core` 中的 `EventSummary` / compact 规则。
- 服务端负责保存完整 envelope、索引和查询；前端负责展示、筛选、跳转和对比。
- 如果 Node 侧需要生成摘要，应通过共享规则生成，不靠 UI 猜字段。

## 当前能力

- 启动脚本：
  - `bash scripts/node_server.sh install`
  - `bash scripts/node_server.sh start`
  - `bash scripts/node_server.sh dev`
- `POST /api/monitor/v1/events`：接收单条或批量完整 envelope。
- `GET /api/monitor/v1/events/:eventId`：查询单个完整事件。
- `GET /api/monitor/v1/sessions/:sessionId`：查询 session timeline。
- `GET /api/monitor/v1/traces/:traceId`：查询 trace 组。
- `GET /api/monitor/v1/recent?limit=50`：查询最近事件。
- `GET /api/monitor/v1/groups?by=session|trace|route|name`：查看简单分组。
- `/`：本地 HTML inspector，用于快速查看最近事件和完整 JSON。

## React 工作台建议模块

1. Session Timeline
   - 按 session 展示页面、HTTP、jank、error、lifecycle。
   - 支持点击摘要查看完整 envelope。

2. Trace Detail
   - 展示一次 page load、startup、HTTP 或业务 trace 的 span 结构。
   - 关联 breadcrumbs、错误、卡顿和相关请求。

3. Event Inspector
   - 展示完整 JSON。
   - 高亮 resource/context/attributes/payload 分层。
   - 支持复制 `eventId`、`sessionId`、`traceId`。

4. Query And Filters
   - route、name、status、signalType、duration、time range。
   - 慢页面、慢请求、错误、jank 快捷筛选。

5. Import / Export
   - 支持 NDJSON session 导入。
   - 支持导出当前 session，供 QA 交接。

## 后续服务端方向

- 将内存 store 替换为文件 NDJSON 或 SQLite。
- 增加 summary endpoint，但 summary 规则必须来自 core。
- 增加 remote config、采样、限流和鉴权模拟。
- 增加聚合接口：页面耗时分位数、HTTP 错误率、卡顿率、错误聚类。
- 将本地 inspector 替换为 React app，并保持 `/api/monitor/v1/*` 兼容。
