# Workbench 产品

Workbench 是 Flutter Monitor 的排查工作台：面向开发者与 QA，用统一 `EventEnvelope` 还原 HTTP、埋点、异常与会话链路。它不是 SDK，不定义第二套事件模型。

视觉与交互以 shadcn（new-york）+ Tailwind v4 为基线：专业、克制，优先扫描、筛选、定位和 raw 回查。Raw JSON 放在详情深读区，不抢第一视觉。主验收视口为桌面 1440 / 1280。

---

## 信息架构

```text
一级导航
  大屏        /
  HTTP        /http
  埋点        /business
  异常        /errors

二级
  Catalog 详情（Sheet Record）
  Session 工作区  /sessions/$sessionId?eventId=

侧栏附属
  最近 Session（Top 5，角标为错误 + 失败 HTTP + 业务失败）
```

Session 不占一级导航。`/sessions` 列表入口重定向到大屏。旧 Overview / Startup / Pages / Network / Jank 等路径只做兼容重定向。

壳层：侧栏、面包屑、Live 开关、刷新。Live 开启时通过 SSE 失效查询缓存，不抢走当前选中行。

---

## 共享能力

### 范围筛选（Scope）

大屏、HTTP、埋点、异常顶部共用 Scope：

- 时间 `from` / `to`
- `userId`、`sessionId`（真实候选 Combobox）
- `appVersion`、`environment`、`route` 等资源 / 上下文维度

筛选同步到 URL，并在本地持久化；一级导航跳转时携带 Scope（`pickScopeSearch`）。文本类筛大约 300ms debounce，清空立即重置。

### Catalog 模式

HTTP / 埋点 / 异常共用同一套工作流：

1. **列表**：分页、排序、loading / empty / error / noResults
2. **Preview**（宽屏）：选中行摘要与操作
3. **Record**：右侧 Sheet，按领域拆 Tab，末尾 Raw
4. **查看 Session**：跳转 `/sessions/$sessionId?eventId=…`，在会话内选中对应事件

时间统一展示为 `YYYY-MM-DD HH:mm:ss`。可复制 `eventId` / `sessionId` / `traceId`（HTTP 另含 `requestId`）。

---

## HTTP（样板）

路径：`/http`。数据：`GET /api/monitor/v1/catalog/http` 摘要列表 + 按需 `events/:eventId` 拉完整 envelope。

### 筛选

- Scope + 领域筛：URL（模糊）、method、成败、`requestId`、HTTP 状态码、业务码、Host、仅慢请求（阈值）
- 列表默认展示 path（可开关完整 URL）
- 业务码由 service 在 ingest 时从响应 body 顶层 `code` 派生索引，不改 SDK；详情缺失时有 `businessCodeState` 区分

### 列表与选中

- 按时间或耗时排序；分页 25 / 50 / 100
- 点击行：宽屏只选中 Preview；窄屏同时打开 Record（`eventId` / `detail` 写入 URL）
- 行菜单：打开详情、查看 Session、复制 ID

### Preview 与 Record

- Preview：状态、关键事实、打开详情、查看 Session
- Record Tab：请求 / 响应 / 上下文 / Raw；支持当前页上一条 / 下一条；可复制 cURL
- 详情被剥离或截断时如实展示（如 `detailDropped`），不伪造 body

### 明确不做

- 不做 in-flight 请求（SDK 只上报 completed `http.client`）
- 列表行不内联 headers / body

---

## 大屏

路径：`/`。在当前 Scope 内看启动 / HTTP / 埋点 / 异常是否异常，并钻进列表或 Session。

能力包括：四类 KPI 卡、质量趋势、HTTP 健康、埋点结果趋势、业务动作排行、启动趋势、最近问题列表。图表点位可带时间桶或类型预筛进入对应 Catalog；启动相关可落到带 `eventId` 的 Session。

默认不展示内存、帧数、jank、native。主标签避免直接使用 p50 / p95 等术语。

**当前局限：** 视觉与布局仍偏糙；部分跳转未统一走路由 Link；不是 Session 中枢，与会话列表的关联弱。

---

## 埋点

路径：`/business`。集合：带 `business.action` 的单次埋点与 `business.action.summary`；`measure` 不进主集合。

- 筛：action、result（success / failed / cancelled）
- 列：时间、action、result、路由、用户、session、版本
- Record：属性 / 关联 / 上下文 / Raw；关联区展示同 session 近期 HTTP / 埋点 / error 摘要卡

**当前局限：** 深度与交互弱于 HTTP（无 cURL 级请求检视）；关联区偏展示，导航回 Catalog / Session 的闭环不如 HTTP Preview。

---

## 异常

路径：`/errors`。集合：稳定性 `error` 与 `business.result=failed` 的无重复并集；排除 completed HTTP、jank、memory、native。

- 筛：errorType、mechanism、fatal / handled、仅业务失败
- 列：类型徽标、message、handled、路由、session、版本等
- Record：错误信息 / stack / breadcrumbs，以及上下文与 Raw

不做告警规则引擎或订阅推送。

**当前局限：** 与埋点同属 Domain Catalog 壳，精修程度低于 HTTP；与大屏「最近问题」、Session 的联动仍浅。

---

## Session（二级工作区）

路径：`/sessions/$sessionId`，常用 query：`eventId`（可选 `traceId`）。

### 如何进入

- 各 Catalog 的 Preview / 行菜单「查看 Session」
- 侧栏「最近 Session」
- 大屏启动类下钻（携带可回查 `eventId`）

### 当前界面

- 顶栏：Session ID Combobox 切换会话（切换后清空 eventId）、时间跨度、用户、版本、问题计数
- 左：事件列表，Tab 为全部 / 启动 / 页面 / HTTP / 埋点 / 问题
- 右：选中事件的摘要 / 上下文 / Raw（JsonViewer）
- 窄屏用 Sheet 看详情

### 当前局限

- 无独立 Session 列表页（`/sessions` → 大屏）
- 不挂载 Scope 筛选条，与一级页 Scope 未打通
- 相对旧版 Console / 分段 Timeline / EventInspector，能力已简化
- 从 Session 回到来源 Catalog 的路径弱；Record「关联」多为展示

---

## 明确不做

- 一级导航不恢复旧 Overview / Sessions / Startup / Pages / Problems 拆分
- 默认主路径不展示内存 / 帧数 / jank / native
- 列表行不内联 headers / body；Raw 不作首页装饰
- 不为业务码或设备 ID 改 SDK（业务码 service 派生；设备 ID 暂不做）
- 不做多租户、线上长期告警治理（超出当前本地 / 调试 Workbench 边界）
