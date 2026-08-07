# Workbench 当前功能

本文按用户任务记录 Workbench 当前可用能力和明确限制。具体布局与交互见 [产品文档](product.md)，设计原则见 [设计文档](DESIGN.md)。

## 信息架构

一级导航：

| 模块 | 路由 | 主要任务 |
|---|---|---|
| 概览 | `/` | 查看当前范围的启动、页面、Session、HTTP、埋点和异常情况 |
| Session | `/sessions` | 检索会话并进入链路工作区 |
| HTTP | `/http` | 筛选请求、检查详情并回查 Session |
| 埋点 | `/business` | 查看业务动作与结果 |
| 异常 | `/errors` | 查看稳定性错误和业务失败 |

二级入口：

- `/sessions/$sessionId`：Session 工作区，可带 `tab`、`open`、`expand`、`eventId`（可选 `traceId`）；
- `/http/$eventId`：HTTP 独立详情；
- `/business/$eventId`：埋点独立详情；
- `/errors/$eventId`：异常独立详情；
- `/traces/$traceId`：Trace raw 详情入口。

旧的 Startup、Pages、Network、Jank、Events 和各领域 Analytics 路由只保留兼容重定向，不属于一级信息架构。

## 共享 Scope

概览与四个 Catalog 共用 URL scope：

- 时间 `from` / `to`；
- `appKey`、`packageName`、`appVersion`、`environment`；
- `devicePlatform`；
- `userId`；
- URL 中已有的 `sessionId`、`route` 继续参与查询。

Scope 在一级导航、面包屑和详情返回时保留。ID 候选来自 Service `dimensions` 查询，不使用前端伪造选项。

## Catalog 通用能力

Session、HTTP、埋点、异常使用一致的 Catalog 工作流：

- 服务端分页与 URL 查询状态；
- loading、empty、no results、error 状态；
- 单击行直接进入独立详情页；
- 仅行内右侧按钮（或行菜单）展开 Sheet，便于不离开列表快速检视；
- 操作列右侧 sticky，表头与数据列可横向滚动；
- 复制 event/session/trace 等 ID；
- 事件域可直接进入对应 Session；
- Live 模式通过 SSE 失效查询缓存，不抢走当前 Sheet 打开项。

通用上下文展示使用结构化环境画像。Raw JSON 放在详情深读区，不作为列表或首页第一视觉。

## 概览

概览使用 `/api/monitor/v1/analytics/overview` 与相关 performance 查询，在统一 Scope 内展示：

- 冷启动、热启动和启动耗时；
- 页面加载与页面进入；
- 活跃 Session 和问题 Session；
- HTTP 数量、失败、状态与耗时；
- 业务动作结果与排行；
- 稳定性错误和业务失败；
- 时间趋势、版本/环境比较和最近关注项。

图表和关注项应能下钻到 Catalog、独立详情或带选中事件的 Session 工作区。概览不把不同集合简单相加成“总事件数”，因为业务失败会同时属于埋点失败和异常集合。

默认概览不展示 memory、frame、jank 或 native 诊断信号。

## Session

Session 列表支持：

- user、session、route、时间和资源维度筛选；
- 状态与问题类型筛选；
- 事件数、错误数、失败 HTTP、业务失败等摘要；
- Sheet 和工作区入口。

Session 工作区支持：

- 按 sessionId 切换会话；列表进入不预选事件，默认全部段收起；
- 全宽时间链（启动/页面分段、短路由段头、两行上下文、Trace 色轨）；
- 全部 / 启动 / 页面 / HTTP / 埋点 / 异常分类（失败 HTTP 不进异常）；
- 单击行展开/收起；HTTP / 埋点 / 异常最右侧「打开」进入对应独立详情；
- `tab` / `open` / `expand` / `eventId` 写入 URL，返回可还原；
- 从域 Catalog 带 `eventId` 进入时自动展开所属段并定位高亮；
- 大段 HTTP 默认摘要折叠后再展开请求列表；
- 右侧 scrubber：全部按段、域 Tab 按过滤事件；
- eventId / traceId 仅在行菜单复制，不占第一视觉。

当前 Session 列表使用 `hasMore` 分页，没有服务端 total。

## HTTP

HTTP Catalog 使用 `/api/monitor/v1/catalog/http`，当前支持：

- URL 模糊匹配；
- method、成败、状态码、业务码、Host；
- requestId、sessionId、route；
- 慢请求阈值；
- 时间或耗时排序；
- 25 / 50 / 100 分页；
- path/完整 URL 展示；
- 独立详情、Sheet、Session 回查和 cURL 复制。

Host 与业务码由 Service 从 envelope 详情派生到 SQLite 索引，不写回 raw envelope。详情被截断、剥离或无法解析时，界面必须展示对应缺失状态。

SDK 当前只产生 completed single-span `http.client`，Workbench 不展示 in-flight 请求。

## 埋点

埋点 Catalog 使用 `/api/monitor/v1/catalog/business`，集合包括：

- 带 `business.action` 的单次 `track`；
- production 限流产生的 `business.action.summary`。

支持 action、result、session、route 和共享 Scope 筛选，以及 Sheet、独立详情和 Session 回查。默认关闭的 interaction measure 不进入埋点主集合。

## 异常

异常 Catalog 使用 `/api/monitor/v1/catalog/errors`，集合是：

- 稳定性 error；
- `error.group.summary`；
- `business.result=failed`。

集合排除 completed HTTP、jank、memory 和 native 诊断事件。支持 error type、mechanism、fatal、handled、仅业务失败、session、route 和共享 Scope 筛选。

详情展示错误摘要、stack、breadcrumbs、环境画像、Raw 和 Session 入口。当前不提供告警规则或订阅推送。

## 数据与状态边界

- `EventEnvelope` 是唯一事件事实源。
- Catalog、Analytics、Performance、Session summary 和 console row 都是查询 view model。
- 每个可下钻摘要应尽量携带 `eventId`、`sessionId`、`traceId`。
- Service 可以派生索引，但不能改写 `envelope_json`。
- UI 不得根据展示需要伪造缺失的 SDK 字段。
- loading、empty、error、not found 和 detail unavailable 必须如实展示。

## 当前不承诺

- 多租户、权限、审计和生产告警；
- 长期冷热存储与企业质量治理；
- 设备 ID；
- 默认主路径中的 memory、frame、jank、native；
- 自动根因分析；
- Flutter DevTools extension 或 session 文件导入/导出 UI。
