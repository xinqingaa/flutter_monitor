# Workbench 功能清单

本文是 Workbench 可控重构（设计工作流 A）的功能边界清单：按用户任务列能力，不规定视觉与布局（交给后续 `DESIGN.md`）。

与 `product_plan.md` 的关系：`product_plan.md` 可作历史参考；**本文件是当前期望的功能事实源**。二者冲突时以本文件为准，再回写产品文档。

现有实现取舍见 [`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md)（页面默认推倒；数据层可留；JsonViewer 克制复用）。
视觉、交互与页面模式见 [`DESIGN.md`](DESIGN.md)（active；HTTP 样板页实施门禁已开放）。

状态：`active`（允许开始 HTTP 样板页；其它业务页面仍受 DESIGN 样板验收门禁约束）

---

## 信息架构

```text
一级
  1. 大屏
  2. HTTP
  3. 埋点
  4. 异常（error + 业务失败）

二级
  HTTP / 埋点 / 异常 详情
  Session 链路组装（sessionId / traceId / eventId；不占一级导航）
```

---

## 共享能力

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| S.1 | 时间范围筛选 | `from` / `to` | 服务端已有 |
| S.2 | 用户 ID 筛选 | `context.user.userId` | 服务端已有 |
| S.3 | Session ID 筛选 | `sessionId` | 服务端已有 |
| S.4 | 版本筛选 | `resource.app.appVersion` | 服务端已有 |
| S.5 | 环境筛选 | `resource.app.environment` | 服务端已有 |
| S.6 | 关联路由筛选 | `context.route.*` | 服务端已有 |
| S.7 | 链路跳转 | 列表行 / 详情 → Session（选中对应 `eventId`）；复制 `eventId` / `sessionId` / `traceId` | 前端为主；Session 页已有基础 |
| S.8 | 列表必备状态 | loading / empty / error / noResults；分页或虚拟滚动 | 前端 |

**暂缓**

| 功能 | 说明 |
| --- | --- |
| 设备 ID 筛选 | SDK/core 尚无清晰标准字段，本阶段不做 |

---

## 1. 大屏

用户要完成的事：在当前筛选范围内，一眼看到启动 / HTTP / 埋点 / 异常是否异常，并钻进对应列表或 Session。

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 1.1 | 范围条 | 复用共享筛选，限定当前数据范围 | 复用 S.* |
| 1.2 | 启动指标 | 冷/热启动：平均、慢端、最慢、慢次数；可钻明细或 Session | 服务端 `performanceOverview.startup` 已有，口径需收口 |
| 1.3 | HTTP 指标 | 请求量、失败、慢请求、影响面；点击进入 HTTP 列表（可带预筛） | 服务端已有 HTTP 聚合 |
| 1.4 | 埋点指标 | 动作量、失败动作；点击进入埋点列表 | 服务端需补埋点聚合（小改） |
| 1.5 | 异常指标 | error + 业务失败数量与影响面；点击进入异常列表 | 服务端部分已有；业务失败计数已有 |
| 1.6 | 最近问题入口 | 最近失败 HTTP / error / 业务失败 → 详情或 Session | 服务端 list + 前端 |
| 1.7 | 趋势（可选） | 启动 / HTTP 失败 / 异常随时间；点位回列表或 Session | 服务端可后补 |

**明确不做**

- 默认不展示内存、帧数、jank、native
- 不做不可点击的装饰性指标卡
- 主标签不直接使用 `p50` / `p95` 等术语（口径可放说明）

---

## 2. HTTP

### 2.1 列表

用户要完成的事：在海量请求中多维筛选并扫关键列，再进详情或 Session。

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 2.1.1 | 海量请求列表 | 以 `name=http.client` 为主的分页 / 虚拟列表 | 服务端需专用 HTTP list（或强过滤 event list） |
| 2.1.2 | 筛：请求 ID | `attributes.http.request_id` | 服务端需支持筛选（字段已有） |
| 2.1.3 | 筛：方法 | `attributes.http.method` | 服务端需支持筛选（字段已有） |
| 2.1.4 | 筛：HTTP 状态码 | `attributes.http.status_code` | 服务端需支持筛选（字段已有） |
| 2.1.5 | 筛：业务码 | 响应 JSON 中与 `data` 同级的 `code` | 服务端 ingest 时从 `payload.http.detail.response.body` 解析并建索引；**不改 SDK**。详情被剥离或 body 截断时可能为空 |
| 2.1.6 | 筛：Host | 域名 | 服务端可从 `payload.url` 派生索引（优先不改 SDK） |
| 2.1.7 | 筛：URL 模糊 | path 模糊匹配 | 服务端需支持（`http.url.normalized` / `payload.url` 已有） |
| 2.1.8 | 筛：成败 / 慢请求 | 失败、慢阈值 | 服务端需支持（`http.success` / `durationMs`） |
| 2.1.9 | 列：时间 | | 已有 |
| 2.1.10 | 列：方法 | | 已有 |
| 2.1.11 | 列：URL | **默认不展示域名**（path）；可开关显示完整 URL | 前端；数据来自 `http.url.normalized` / `payload.url` |
| 2.1.12 | 列：HTTP 状态码 | | 已有 |
| 2.1.13 | 列：业务码 | 同 2.1.5 | 同 2.1.5（服务端派生） |
| 2.1.14 | 列：耗时 | `durationMs` | 已有 |
| 2.1.15 | 列：关联路由 | `context.route.*` | 已有 |
| 2.1.16 | 行操作 | 打开详情；进入 Session；复制 ID / `request_id` | 前端 |

### 2.2 详情

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 2.2.1 | 摘要 | method、URL、HTTP 状态、业务码、耗时、size、route | 业务码依赖服务端派生；其余已有 |
| 2.2.2 | 请求 Tab | url / query / headers / body | 已有 payload 详情层 |
| 2.2.3 | 响应 Tab | status / headers / body | 已有 |
| 2.2.4 | 上下文 + 链路条 | user / device / app / sessionId / traceId / eventId / request_id | 前端 |
| 2.2.5 | Raw | 完整 EventEnvelope，置后 | 已有 |
| 2.2.6 | 详情缺失说明 | `detail_dropped` / 无 body 等 | 已有字段 |

**明确不做**

- 不做 in-flight 请求（SDK 仅 completed `http.client`）
- 列表行不内联 headers / body

---

## 3. 埋点

### 3.1 列表

用户要完成的事：按 action / 结果 / 用户 / 时间找到业务动作，再进详情或 Session。

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 3.1.1 | 埋点列表 | `track` / 带 `business.action` 的事件 | 服务端需专用 list 或强过滤 |
| 3.1.2 | 筛：action | `attributes.business.action` | 服务端需支持筛选（字段已有） |
| 3.1.3 | 筛：result | success / failed / cancelled | 服务端需支持筛选（字段已有） |
| 3.1.4 | 列：时间 / action / result / 路由 / 用户 / session / 版本 | | 字段已有 |
| 3.1.5 | 区分单次与 summary | 限流聚合 `business.action.summary` | 前端识别；服务端可标类型 |
| 3.1.6 | 行操作 | 打开详情；进入 Session；复制 ID | 前端 |

### 3.2 详情

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 3.2.1 | 摘要 | action、result、路由、时间 | 已有 |
| 3.2.2 | 业务 properties | `payload.properties` 等 | 已有 |
| 3.2.3 | 关联链路 | 同 session / trace 下相关 HTTP、错误 | 前端 + 已有 `getSession` / `getTrace` |
| 3.2.4 | 上下文 + Raw | 与 HTTP 详情共用壳 | 前端 |

**明确不做**

- 默认关闭的 `measure` / 交互性能不进入埋点主路径

---

## 4. 异常（error + 业务失败）

范围仅两类：稳定性 error，以及 `business.result=failed`。不做独立告警规则引擎。

### 4.1 列表

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 4.1.1 | 异常列表 | `signalType=error`（及等价错误事件）+ `business.result=failed` | 服务端需 list + 类型过滤 |
| 4.1.2 | 筛：错误类型 / mechanism | `error.type` / `error.mechanism` | 服务端需支持（字段已有） |
| 4.1.3 | 筛：fatal / handled | | 服务端需支持（字段已有） |
| 4.1.4 | 筛：仅业务失败 | 业务失败子集 | 服务端需支持 |
| 4.1.5 | 列：时间 / 类型 / message 摘要 / fatal / 路由 / 用户 / session / 版本 | | 字段已有 |
| 4.1.6 | 行操作 | 打开详情；进入 Session；复制 ID | 前端 |

### 4.2 详情

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 4.2.1 | 摘要 | type、message、fatal/handled、所在页 | 已有 |
| 4.2.2 | Stack / breadcrumbs | | 已有 payload |
| 4.2.3 | 附近失败 HTTP / 相关埋点 | 同 session 上下文 | 前端组装 |
| 4.2.4 | 上下文 + Raw | | 前端 |

**明确不做**

- jank / memory / native 不进入本模块首批
- 不做告警规则引擎、订阅推送

---

## 5. 链路组装（二级，跨模块）

| # | 功能 | 说明 | 依赖备注 |
| --- | --- | --- | --- |
| 5.1 | 从列表 / 详情进入 Session | 打开会话并选中对应 `eventId` | 前端路由已有基础 |
| 5.2 | Session 时间线 | 启动 / 页面 / HTTP / 埋点 / 错误；默认不强调 memory / jank | 已有 console；展示口径收口 |
| 5.3 | 按 `traceId` 查看同流程 | 详情或 Session 内高亮 / 过滤 | 服务端 `getTrace` 已有 |
| 5.4 | ID 复制 | `eventId` / `sessionId` / `traceId` / `http.request_id` | 前端 |

---

## 整站明确不做

- 一级导航不沿用旧的独立 Pages / Problems / Startup 拆分（相关能力并入大屏或列表）
- 默认主路径不展示内存 / 帧数 / jank / native
- 列表行不内联 headers / body
- raw JSON 不作为第一视觉入口
- 不做多租户、线上长期告警治理（超出当前本地 / 调试 Workbench 边界）
- **不改 SDK** 仅为业务码或设备 ID 服务本阶段；业务码由服务端派生，设备 ID 暂缓

---

## 依赖汇总

### 服务端需支持（字段多已有：加筛选 / 索引 / 专用 list，小改）

- HTTP / 埋点 / 异常专用列表（或等价强过滤 + 分页）
- 筛选：`http.request_id`、`http.method`、`http.status_code`、URL 模糊、Host、成败/慢、`business.action`、`business.result`、`error.type` / `error.mechanism`、fatal/handled
- 业务码：ingest 时从响应 body 解析与 `data` 同级的 `code` 并索引
- 大屏：埋点聚合；异常口径收口为 error + 业务失败

### 前端

- 四大模块页面与详情壳
- 共享筛选条、URL 默认不展示域名、链路跳转与 ID 复制
- 列表 / 详情必备状态

### 暂缓 / 不改 SDK

- 设备 ID：暂缓
- 业务码：服务端派生，**不改 SDK**
- Host：优先服务端从 `payload.url` 派生

---

## 建议实现顺序（仅排期参考，非设计）

1. 共享筛选 + HTTP 列表 + HTTP 详情（含业务码服务端派生）
2. 异常列表 + 详情
3. 埋点列表 + 详情
4. 大屏（核心四卡 + 钻列表）
5. Session 链路组装收口（从详情「查看会话」进入）
