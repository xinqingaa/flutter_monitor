# DESIGN.md

## Meta
- status: draft
- last_updated: 2026-07-10
- playbook: design-playbook（01–04）
- 关联：`FEATURES.md`（功能边界）、`KEEP_KILL_STEAL.md`（旧 UI 取舍）
- cases 参考：`design-playbook/cases/flutter-monitor*.md`（仅气质/token/通性；页面表以 FEATURES 为准）

## 产品与气质
- 主气质：排查工作台
- 辅助气质：运营管理台（三大 Catalog 列表检索、筛选表、可扫表格；与「开发者工具」辅气质差别不大——主气质仍定密度与链路；辅气质只微调列表/表单权重。本项目以 Catalog 为主路径，故选运营管理台而非开发者工具。）
- 目标用户：Flutter 开发者、QA、做端侧排查的技术负责人
- 使用频率：本地调试高频；QA 交接按需

### 决策维度
- 信息密度：compact
- 导航模型：侧边栏（一级：大屏 / HTTP / 埋点 / 异常）+ 详情与 Session 为二级
- 主任务类型：浏览集合（Catalog）+ 深读（Record）+ 并行排查（Session Workspace）
- 数据形态：表格/列表 + JSON + 时间线（Session 二级）
- 用户专业度：专家

### Visual Direction
- 视觉调性：technical
- 表面语言：border-first
- 品牌强度：utility

### 典型 Layout 偏好
- 桌面：Hub 用 Stack；三大列表用 **Catalog + Split（主表 + 右侧预览）**；详情用 Record(Drawer→Sheet) 作深读；Session 用 Workspace(Split)
- 移动/窄屏：Catalog(Stack) → 预览改为 Sheet 或进详情；Session 降为 Stack + Sheet，禁止硬搬三栏

### 参考产品
- Sentry（Issues / 请求类列表与详情分层）
- Kibana / Grafana Explore（高密度筛选 + 表格扫描）
- Jaeger（链路回跳，作 Session 二级参考）
- cases 中的 token 与「类型/问题双编码」思路（非旧页面布局）

### 明确避免
- 营销式大标题、低密度大卡片墙
- 默认主路径展示内存 / 帧数 / jank / native
- raw JSON 作为第一视觉入口
- 用图表替代可排查列表与链路
- 把现有 `platform/web` 页面视觉当规范；JsonViewer 不锁全站皮肤
- 一级导航沿用旧 Overview/Sessions/Startup/Pages/Jank 拆分

## Design Tokens
- 默认密度：compact（表格/列表行高约 36px；panel padding `spacing.12`；正文 `font.compact` 13/20）
- palette preset：technical-light

### Primitive 覆盖（最少填写）
- color.accent.500：`#0d9488`（teal.600）；hover `#0f766e`（已确认接受）
- status.success：`#059669`（emerald.600）
- status.warning：`#f59e0b`（amber.500）
- status.danger：`#dc2626`（red.600）
- status.info：`#2563eb`（blue.600）
- status.neutral：`#71717a`（zinc.500）
- 灰阶：zinc 50–950（canvas/surface/border/text）

### Semantic 映射（最小集）
- background.canvas → zinc.100 `#f4f4f5`
- background.surface → `#ffffff`
- background.subtle → zinc.50 `#fafafa`
- border.default → zinc.200
- text.primary → zinc.950
- text.secondary → zinc.500
- text.muted → zinc.400
- accent.default → teal.600
- status.* → 上表 primitive

### 字体
- font.sans：系统栈 + PingFang SC / Microsoft YaHei（不强制 Inter 品牌感）
- font.mono：SF Mono / Consolas / Menlo（ID、JSON、URL path；`tabular-nums` 用于耗时/状态码）

### 暗色模式
- 是否支持：首批可不做全站暗色；Raw/JSON 阅读区允许局部暗底（与 JsonViewer 能力对齐，皮肤仍按本文件重做）

## 页面模式

| 页面 | Task | Layout | 变体 | 窄屏降级 |
| --- | --- | --- | --- | --- |
| 大屏 | Hub | Stack | 范围条 + ≤4 可点指标 + 最近问题 | 单列 Stack |
| HTTP 列表 | Catalog | **Split** | 左/主：高密度表；右：选中行预览（摘要级，非完整深读）；URL 默认无域名 | `<1024px` 收预览为 Sheet 或仅表，点行进详情 |
| HTTP 详情 | Record | Drawer→Sheet | 摘要→请求→响应→上下文→Raw | `<900px` Sheet / fullPage |
| 埋点列表 | Catalog | **Split** | 同 HTTP：主表 + 右预览 | 同 HTTP |
| 埋点详情 | Record | Drawer→Sheet | 摘要→properties→关联→上下文→Raw | 同 HTTP 详情 |
| 异常列表 | Catalog | **Split** | 同 HTTP：主表 + 右预览 | 同 HTTP |
| 异常详情 | Record | Drawer→Sheet | 摘要→stack/breadcrumbs→关联→上下文→Raw | 同 HTTP 详情 |
| Session 链路 | Workspace | Split | 主区简易 timeline + 右 Record | `<900px` Stack + Sheet |

### Catalog Split 预览约定
- 右侧预览展示**摘要级**信息（关键字段、状态、链路 ID、跳转入口），不替代完整 Record（请求/响应 body、stack 等仍进详情 Drawer）。
- 行选中与预览联动；无选中时预览区 empty 提示「选择一行」。
- 预览内提供「打开详情」「查看 Session」主操作。
- 埋点 / 异常列表复用同一 Split 壳，仅列与预览字段不同。

### 通性（Steal，非旧组件）
- 筛选状态进 URL（范围筛 + 领域筛可分享）
- 类型稳定编码 / 问题才上色（双编码）
- 详情缺失诚实说明（`detail_dropped`、业务码解析失败等）
- 指标与行均可 drilldown；链路条：`eventId` / `sessionId` / `traceId` 短显可复制
- 人话指标主标签；`p50`/`p95` 仅说明层

## 首批页面
> 样板未过，禁止开第二页。样板锁定页 = HTTP 列表（Catalog + Split 预览，最能代表密度与筛选气质）。

| 页面 | 主任务说明 | 必备状态 | 禁止 |
| --- | --- | --- | --- |
| HTTP 列表 | 多维筛选海量 `http.client`；主表扫描；右侧摘要预览；进详情或 Session | 主表与预览各自 loading / empty / error；列表另含 noResults / partial(分页) | 行内展开 body；默认显示域名；预览塞完整 Raw/body；堆不可点卡片 |
| HTTP 详情 | 读懂单次请求：摘要优先，请求/响应分 Tab，Raw 置后 | loading / error / notFound / partial(详情剥离) | Raw 当首页；多层浮层 |
| （样板通过后）共享范围条 | 时间/用户/版本/环境/路由等写入 URL，四大模块复用 | — | 筛选只活在组件 state |

首批明确不做：大屏整页、埋点/异常整页、完整 Session Console、全站暗色、设备 ID。

## 实现

### Target Conventions（有则填，优先级最高）
- 主题 / 取色入口：目标收敛到 `platform/web/src/styles.css` 的 `@theme` / CSS 变量；禁止页内散落色值
- Overlay 封装：Radix Dialog 扩展 Drawer/Sheet；最多一层浮层
- 导航方案：TanStack Router；筛选进 search params
- 状态管理：TanStack Query；SSE `useLiveInvalidation`
- 命名与目录：`features/`、`routes/`、`components/`、`shared/`；kebab-case；文案中文
- 旧 UI：以 `KEEP_KILL_STEAL.md` 为准——页面 greenfield；数据层可留

### 技术栈
- 平台：Web（Workbench，端口 4700；Service 3700）
- 框架：React 19 + Vite + TypeScript
- 组件库：Radix + CVA + Tailwind v4 + lucide-react（可换皮，不换栈除非改本文件）

### 主题入口
- 配置文件路径：`platform/web/src/styles.css`
- semantic → 库变量映射：`@theme` 声明 `--color-*`，组件只消费语义 class / token

### Breakpoint
- Split 二栏最小宽度：1024px（Catalog 主表 + 右预览；低于此收预览）
- Split 三栏最小宽度：1280px（仅 Session Workspace）
- Workspace 降级宽度：`<900px` → Stack + Sheet
- Record Drawer→Sheet：`<900px`

### 组件映射

| Playbook 角色 | 项目组件 | 处置 |
| --- | --- | --- |
| DataTable / List | 新建 HTTP/埋点/异常 Catalog 主表 | 重建 |
| filterBar | 新建共享范围条 + 领域筛 | 重建（保留 URL 序列化思路） |
| SplitPane | Catalog 主表 + 右预览；Session Workspace | 新建/重建，须可调宽与窄屏降级 |
| Sheet / Drawer | `components/ui/` 扩展 | 重建/补齐 |
| Inspector / 预览 | 右栏摘要预览 + 完整 RecordShell | 重建（预览 ≠ 详情） |
| JsonViewer | `features/inspector/json-viewer.tsx` | **克制复用**：过渡可用；不锁视觉；DESIGN active 后按 token 包一层或重做 |
| Chart | echarts 封装 | 大屏可选；非首批样板 |
| Timeline | Session 二级简易时间线 | 后置；不搬旧 console 复杂度 |
| Badge | 问题/状态 tone | 重建，服从双编码 |

### 自研组件

| 组件 | 路径（目标） | 满足的最低能力 |
| --- | --- | --- |
| ScopeFilterBar | `features/scope/` | 范围筛进 URL；loading 不挡输入；可 clear |
| HttpCatalogTable | `features/http/` | 列：时间/方法/URL(默认可无域)/状态/业务码/耗时/路由；虚拟滚或分页；行选中 |
| CatalogPreviewPane | `features/catalog/` | 摘要字段、链路 ID、打开详情/Session；empty/loading/error |
| RecordShell | `features/inspector/` | 摘要→领域 Tab→上下文→Raw；链路条；一层浮层 |
| HttpRecord | `features/inspector/` | 请求/响应 Tab；缺失说明；body 格式化/原文 |
| CopyableId | `components/common/` | 短显 + 复制 + toast（行为 Steal，UI 重做） |

### 明确不做
- 见 `FEATURES.md` 整站明确不做
- 不把 cases 旧「Session 三栏主路径」当本 DESIGN 页面表
- 不把 JsonViewer 现样式当样板验收标准
- 右侧预览不承载完整 body/stack/Raw（那是详情的事）

## 硬约束
> ≤12 条

1. 决策优先级：target convention > DESIGN.md > 库惯例 > Playbook
2. 主数据区必须有 loading / empty / error（列表另含 noResults；详情含 notFound/partial；Split 预览区独立状态）
3. 最多一层浮层；关闭后回到原选中项
4. 颜色/间距/字号走 token，禁止页内硬编码
5. 单一视觉系统与唯一主题入口（`styles.css` / `@theme`）
6. Split / Workspace 必须有窄屏降级（非等比缩放）
7. 功能边界以 `FEATURES.md` 为准；旧 UI 取舍以 `KEEP_KILL_STEAL.md` 为准
8. 样板页（HTTP 列表 Split）未截图验收通过前，禁止铺第二页
9. 类型编码与问题着色分离；无问题不强行上色
10. Raw / JSON 置后；摘要永远优先；预览 ≠ 完整 Record
11. JsonViewer 仅克制复用，不得反向约束筛选与 Catalog 布局
12. 不新增第二套事件模型；UI view model 不写回 core/SDK

## 演进规则
- 结构性 UI 变更（气质、Task/Layout、主题入口、组件库、一级导航）须先改本文件再改代码
- 与代码冲突时以本文件为准，或显式标记技术债
- status 从 draft → active 表示已人工确认，可开始首批页面实现
- 样板页锁定后，在本文件注明「样板：HTTP 列表 Split，日期」再扩埋点/异常/大屏
