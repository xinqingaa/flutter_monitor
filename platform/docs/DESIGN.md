# Workbench Design

## Meta

- status: active
- last_updated: 2026-07-13
- 功能事实源：[`FEATURES.md`](FEATURES.md)
- 旧实现取舍：[`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md)
- Phase 5 计划：[`PHASE5_UX_PLAN.md`](PHASE5_UX_PLAN.md)
- 当前样板：HTTP 列表 Catalog + Split
- 样板确认：2026-07-11，HTTP Catalog / Preview / Record 桌面与窄屏验收通过，作为交互基线
- 组件策略：shadcn 官方 Primitive / 官方示例组合件为默认基线；本轮不迁 MUI
- 图表：Tremor 为唯一图表引擎

本文是 Workbench 的**信息架构与交互事实源**，附带精简视觉指引。  
它必须能独立指导实现；功能冲突时以 `FEATURES.md` 为准；旧代码是否保留以 `KEEP_KILL_STEAL.md` 为准。

**本文不再充当像素级视觉宪法。** 过死的灰白 / 禁阴影 / 「颜色不作装饰」规则已被收窄：Catalog 保持克制，大屏允许更强的状态色与图表色板；官方控件交互不得为了服从旧视觉细则而改坏。

## 文档职责分层

| 层级 | 本文是否硬约束 | 内容 |
| --- | --- | --- |
| A. 产品与信息架构 | 是 | 四入口、Session 二级、Catalog / Preview / Record、URL 状态 |
| B. 交互契约 | 是 | 一层浮层、状态机、筛选提交、回查 envelope、官方控件核心交互 |
| C. 组件来源 | 是 | Primitive / 官方示例组合默认对齐 shadcn；业务只外挂 |
| D. 视觉与密度 | 部分 | token 入口、Catalog 与大屏分层；细节以官方组件默认为准 |
| E. 实现栈 | 是 | React / Router / Query / Tremor 等工程约定 |

Agent 与实现者优先守住 A–C；D 不得反向破坏 B–C。

## 产品方向

- 主气质：排查工作台
- 辅助气质：运营管理台（大屏可略偏仪表盘，但仍服务于 drilldown）
- 目标用户：Flutter 开发者、QA、做端侧排查的技术负责人
- 使用频率：本地调试高频；QA 交接按需
- 信息密度：compact
- 导航模型：侧边栏；一级为大屏、HTTP、埋点、异常；详情与 Session 为二级
- 主任务：浏览集合、深读记录、组装 Session 链路
- 数据形态：表格/列表、JSON、Session 时间线、可下钻图表
- 用户专业度：专家

### Visual Direction（分层，不再一刀切灰白）

| 表面 | 目标 | 允许 |
| --- | --- | --- |
| Catalog / Record / 筛选条 | 高密度扫描、克制 | 中性底、清晰边框、问题态着色；控件跟 shadcn 默认观感 |
| 大屏 Hub | 一眼看出是否变差 | 状态色块、图表系列色、轻 elevation；仍禁止营销大标题与不可点装饰图 |
| Shell（Sidebar / Header） | 清晰导航 | 可用官方 Sidebar 默认表面语言，不必强行削成纯线框 |

- 视觉调性：technical，但**不是**「全站只许黑白」
- 颜色用途：状态、选中、操作、**图表可读性**；大屏允许用色区分系列与严重度
- Catalog 正常行仍不整行上色；问题态才用 status 色
- 桌面优先高密度；窄屏重组任务，不等比压缩桌面布局

### 明确避免

- 营销式大标题、低密度大卡片墙、不可点击的装饰图
- 默认主路径展示内存、帧数、jank、native
- raw JSON 作为第一视觉入口
- 用图表替代可排查列表与链路
- 把「曾经手搓的灰白工具条」当全站规范
- 一级导航沿用旧 Overview/Sessions/Startup/Pages/Jank 拆分
- 用通用事件流假装海量 HTTP Catalog
- **为了服从灰白规范而砍掉官方控件的核心交互**（例如 Date Range 必须选满才生效、选一半丢弃、立刻关闭导致无法改范围）

## 官方组件基线（强制）

shadcn 是复制进仓库的源码，不是运行时黑盒。本项目约定：

### 1. Primitive 与官方示例组合

以下默认以 **shadcn 官方 registry 源码 + 官方文档示例的交互与观感** 为基线：

- Button、Input、Select、Combobox/Command、Popover、Dropdown Menu
- Calendar / Date Range Picker、Sidebar、Breadcrumb、Table、Pagination
- Tabs、Sheet/Drawer、Tooltip、Skeleton、Empty、Separator、Resizable、ScrollArea

验收时对照官方示例，而不是对照旧手搓 UI。

### 2. 业务只外挂，不改核心交互

允许在官方组合外包一层业务适配：

- 中文文案、URL `from`/`to` 同步、debounce、service 候选数据
- 产品级 Toolbar 布局、范围 Badge、清除条件

**不允许**为了业务或旧 DESIGN 细则改掉官方示例的核心交互，例如：

| 控件 | 必须保留的官方行为 | 禁止 |
| --- | --- | --- |
| Date Range Picker | 可先选 from 再选 to；Popover 保持打开直到用户确认或明确关闭；双月历（桌面）可选范围高亮正常 | 未选满 to 就丢弃；一选完立刻关导致无法调整；拆成两个 `datetime-local` 冒充完成 |
| Combobox | 输入过滤、键盘选择、清空、空态 | 退化成「回车才提交的裸 Input」且无候选 |
| Select | 未选中显示稳定 placeholder（如「全部环境」） | trigger 空白 |
| Sidebar | 官方折叠 / 移动 Sheet 语义 | 业务页再手写第二套侧栏 |

业务提交到 URL 的推荐模式：**控件内部保持官方受控中间态 → 显式「应用」或确认后再写入 search params**；不要把「每次 click 都立刻改 URL」写成必须破坏中间态的理由。

### 3. Token 映射最小化

- 主题入口仍是 `platform/web/src/styles.css` 的 `@theme` / CSS 变量
- 允许把 shadcn 的 `background` / `primary` / `muted-foreground` 等映射到项目 token
- **禁止**在业务页用自定义 class 把官方控件削成另一套皮肤，导致与文档示例「大相径庭」
- Catalog 工具条可以更紧凑，但不得删除官方控件的选中态、focus ring、Popover 结构

### 4. 换库不能替代本规则

即使用 MUI / Material Web，同样适用：「官方默认交互是基线，业务只外挂」。换库解决不了「被改坏的组合件」问题。

## 信息架构与页面模式

| 页面 | Task | Layout | 变体 | 窄屏降级 |
| --- | --- | --- | --- | --- |
| 大屏 | Hub | Dashboard Grid | 范围工具栏 + ≤4 可点指标 + 可点 Tremor 图 + 最近问题 | 单列 Stack |
| HTTP 列表 | Catalog | Split | 主表 + 右侧摘要预览；URL 默认无域名 | `<1024px` 收起常驻预览 |
| HTTP 详情 | Record | Drawer | 摘要 → 请求/响应 → 上下文 → Raw | `<900px` Sheet / full page |
| 埋点列表 | Catalog | Split | 同 HTTP | 同 HTTP |
| 埋点详情 | Record | Drawer | 摘要 → properties → 关联 → 上下文 → Raw | 同 HTTP 详情 |
| 异常列表 | Catalog | Split | 同 HTTP | 同 HTTP |
| 异常详情 | Record | Drawer | 摘要 → stack/breadcrumbs → 关联 → 上下文 → Raw | 同 HTTP 详情 |
| Session 链路 | Workspace | Resizable master-detail | 摘要 + 事件流 + 右侧 Record | `<900px` Stack + Sheet |

Session 是跨模块链路组装层，不占一级导航。HTTP、埋点、异常必须能带 `eventId` 进入对应 Session。

图表数量与口径以 [`FEATURES.md`](FEATURES.md) / [`PHASE5_UX_PLAN.md`](PHASE5_UX_PLAN.md) 为准；本文只约束「可 drilldown、诚实空态、人话标题」。

## 视觉系统（精简）

### 密度与字体

- 表格/列表默认行高约 36px；触控窄屏不低于 44px
- 正文约 13px；辅助约 12px；面板标题约 15px——**以官方组件默认为主**，不必为对齐旧手搓值反复覆盖
- `font.sans`：系统栈 + PingFang SC / Microsoft YaHei
- `font.mono`：SF Mono / Consolas / Menlo；ID、JSON、URL path 用等宽；耗时、状态码用 `tabular-nums`
- 首批不做全站暗色；Raw/JSON 区允许局部深色

### Token

保留语义 token 入口（实现落在 `styles.css`）：

| 类别 | 用途 |
| --- | --- |
| background / surface / canvas | 页面与面板底 |
| border / ring | 分割与 focus |
| text / muted / link | 阅读层级 |
| primary / accent | 主操作与选中 |
| status.* | success / warning / danger / info |
| chart.*（建议） | 大屏与 Tremor 系列色，可与 status 对齐但独立于 Catalog 行色 |

业务代码消费 semantic token，不写散落 hex。  
**大屏**可使用 chart 色与轻阴影；**Catalog 主表**仍以 border 分区为主，避免卡片墙。

z-index：表头 sticky 10；Drawer/Sheet 100；toast 300。

## 响应式布局

- Sidebar：桌面折叠；窄屏用官方移动 Sheet，不把 56px 图标栏硬塞进手机主栏
- 页面 Header 统一承载 Sidebar trigger、Breadcrumb、live 与页面操作；业务页不重复第二套 Header 壳
- Catalog：`>=1024` 主表 + 预览；`<1024` 收起常驻预览
- Record：`min(720px, 72vw)`；`<900` 全高 Sheet
- Split 宽度本地持久化，不进 URL；提供恢复默认
- 单一主滚动容器；长 URL / ID / message 截断可查看完整值

## 共享交互契约

### Catalog、Preview 与 Record

- 单击行：选中 + Preview；双击或「打开详情」：Record
- Preview 不加载 body / stack / Raw
- Record 最多一层浮层；关闭后恢复选中、焦点与滚动
- 类型稳定编码；问题态才上色

### URL 与导航状态

URL 是已提交状态的事实源；控件编辑中的临时值可留在组件内。

```text
/http?...&eventId=<preview-event>&detail=<record-event>
/business?...&eventId=<preview-event>&detail=<record-event>
/errors?...&eventId=<preview-event>&detail=<record-event>
/sessions/<sessionId>?eventId=<selected-event>&traceId=<optional-trace>
```

- 刷新恢复筛选与阅读状态；返回优先关 Record
- SSE 不抢选择、不强迫重排
- Session 深链必须带目标 `eventId`

### 数据与筛选控件

- 主数据区：loading / empty / error；Catalog 另含 noResults / partial；Record 另含 notFound / partial
- 时间展示：`YYYY-MM-DD HH:mm:ss`（本地时区）；毫秒可 tooltip
- 文本筛：约 300ms debounce；清空即重置该条件
- ID 类：真实候选 Combobox（模糊 substring）
- **日期范围**：官方 Date Range 交互基线 + 确认后写入 `from`/`to`；不要用双 `datetime-local` 冒充完成

### 大屏

- 指标与图表必须可 drilldown；禁止装饰性不可点图
- 覆盖 loading / empty / error；无数据不得伪装成健康零值
- 主标题用人话；p50/p95 仅 tooltip / 口径
- 仅 Tremor；不保留 echarts
- 视觉上允许比 Catalog 更强的色彩与层次，仍服务于排查而非营销

### 范围工具栏

- 单行 Toolbar；官方 Date Range、Combobox、Select
- 选中条件用可清除 Badge 表达
- Empty / Skeleton / Pagination 用官方能力

## HTTP 样板页

### 用户任务

在海量 `http.client` 中按范围与 HTTP 维度定位请求，扫描关键列，查看摘要或完整请求/响应，并进入 Session。

### 页面结构

```text
Header（标题 / Live）
共享范围工具栏
HTTP 常驻筛选 + 更多筛选 + 结果数量
Catalog Split：主表 + Preview
Record Drawer/Sheet（按需）
```

### 筛选分层

| 层级 | 筛选项 | 交互 |
| --- | --- | --- |
| 共享范围 | `from`、`to`、`userId`、`sessionId`、`appVersion`、`environment`、`route` | 日期按官方 Range 确认后提交；Select/Combobox 选中即提交或确认后提交（保持官方中间态） |
| HTTP 常驻 | URL、method、结果 | URL debounce；select 立即提交 |
| HTTP 更多 | request ID、状态码、业务码、Host、慢请求 | Popover；应用后以 chip 展示 |

其余列、Preview、Record、查询契约要求与既有 HTTP 样板一致：服务端分页、摘要可回查 envelope、业务码四种语义、Host/业务码不写回 SDK。

## 实现约束

- 框架：React 19 + Vite + TypeScript
- UI：shadcn（Radix + CVA + Tailwind v4 + lucide）源码在 `components/ui/`；业务组合在 `features/` / `app/` / `routes/`
- 图表：仅 Tremor
- 路由：TanStack Router + search params
- 查询：TanStack Query；live 用既有 invalidation
- 文案中文；kebab-case 目录
- 不引入第二套事件模型；摘要必须能回查 `EventEnvelope`

### 目标业务组件（可包官方，不可取代官方）

| 组件 | 路径 | 说明 |
| --- | --- | --- |
| ScopeFilterBar | `features/scope/` | 组装官方 Date/Combobox/Select；写入 URL |
| HttpFilterBar | `features/http/` | 领域筛 + chip |
| HttpCatalogTable | `features/http/` | 基于官方 Table 的领域列与选择 |
| CatalogPreviewPane | `features/catalog/` | 摘要与跳转 |
| RecordShell / HttpRecord | `features/inspector/` | 一层浮层 + 领域 Tab |
| CopyableId | `components/common/` | 短显与复制 |

## 验收门禁

### 官方控件对照（新增，优先于「看起来像旧工具条」）

对 Date Range、Combobox、Select、Sidebar，人工对照 shadcn 文档示例：

1. 核心交互是否一致（含中间态）
2. 是否仍可完成业务（写入 URL、中文、候选数据）
3. 是否被项目 class 削到「完全不像官方」

未通过则先修包装层，不继续铺新页面皮肤。

### Catalog / 响应式（保留）

- viewport：1440 / 1024 / 390
- 状态：loading / empty / noResults / error / partial
- URL 分享、返回关 Record、Session 定位
- 可访问性：可见 focus、键盘操作、图标按钮名称

## 硬约束

1. 决策优先级：`FEATURES.md` > `KEEP_KILL_STEAL.md` > 本文 **A–C 层** > shadcn 官方示例（Primitive）> 本文 D 层视觉偏好 > 工程惯例  
2. 主数据区必须有 loading / empty / error，并按页面补 noResults / partial / notFound  
3. 最多一层浮层；关闭后恢复选中、焦点与滚动  
4. 单一主题入口：`styles.css`；业务不散落 hex  
5. 筛选与阅读状态可分享、可刷新、可前进后退  
6. 类型编码与问题着色分离；Catalog 无问题不强行整行上色  
7. Raw/JSON 置后；Preview 不替代 Record  
8. 不新增第二套事件模型；派生摘要必须能回查 envelope  
9. **官方 Primitive / 官方示例组合的核心交互不可为灰白规范或 URL 便利而破坏**  
10. 图表必须可 drilldown；禁止装饰性不可点图与 echarts 双引擎  

## 演进规则

- 改信息架构、页面模式、组件库策略或导航：先更新本文  
- 功能增删：先更新 `FEATURES.md`  
- 旧实现取舍：先更新 `KEEP_KILL_STEAL.md`  
- 与代码冲突时以事实源为准，或在本文记录临时债与退出条件  
- 视觉微调（间距、阴影、图表色）可跟官方组件迭代，不必每次升格为「全站宪法」修改；但破坏 A–C 层必须先改文档  
