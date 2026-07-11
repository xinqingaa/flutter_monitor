# Workbench Design

## Meta

- status: active
- last_updated: 2026-07-11
- 功能事实源：[`FEATURES.md`](FEATURES.md)
- 旧实现取舍：[`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md)
- 当前样板：HTTP 列表 Catalog + Split
- 实施门禁：允许开始 HTTP 样板页；样板验收前不得铺开埋点、异常和大屏页面
- 样板确认：2026-07-11，HTTP Catalog / Preview / Record 桌面与窄屏验收通过，作为全站实现基线

本文是 Workbench 前端重构的设计与交互事实源。它必须能独立指导实现，不依赖仓库外设计文档。功能冲突时以 `FEATURES.md` 为准；旧代码是否保留以 `KEEP_KILL_STEAL.md` 为准。

## 产品方向

- 主气质：排查工作台
- 辅助气质：运营管理台
- 目标用户：Flutter 开发者、QA、做端侧排查的技术负责人
- 使用频率：本地调试高频；QA 交接按需
- 信息密度：compact
- 导航模型：侧边栏；一级为大屏、HTTP、埋点、异常，详情与 Session 为二级
- 主任务：浏览集合、深读记录、组装 Session 链路
- 数据形态：表格/列表、JSON、Session 时间线
- 用户专业度：专家

### Visual Direction

- 视觉调性：technical
- 表面语言：border-first
- 品牌强度：utility
- 颜色主要表达状态、选中和操作，不作装饰
- 桌面优先高密度扫描；窄屏重组任务，不等比压缩桌面布局

### 明确避免

- 营销式大标题、低密度大卡片墙和装饰性图表
- 默认主路径展示内存、帧数、jank、native
- raw JSON 作为第一视觉入口
- 用图表替代可排查列表与链路
- 把现有 `platform/web` 页面视觉当规范
- 一级导航沿用旧 Overview/Sessions/Startup/Pages/Jank 拆分
- 用通用事件流假装海量 HTTP Catalog

## 信息架构与页面模式

| 页面 | Task | Layout | 变体 | 窄屏降级 |
| --- | --- | --- | --- | --- |
| 大屏 | Hub | Stack | 范围条 + 不超过 4 个可点指标 + 最近问题 | 单列 Stack |
| HTTP 列表 | Catalog | Split | 主表 + 右侧摘要预览；URL 默认无域名 | `<1024px` 收起常驻预览，点行进入 Sheet/详情 |
| HTTP 详情 | Record | Drawer | 摘要 → 请求/响应 → 上下文 → Raw | `<900px` 全高 Sheet 或 full page |
| 埋点列表 | Catalog | Split | 主表 + 右侧摘要预览 | 同 HTTP |
| 埋点详情 | Record | Drawer | 摘要 → properties → 关联 → 上下文 → Raw | 同 HTTP 详情 |
| 异常列表 | Catalog | Split | 主表 + 右侧摘要预览 | 同 HTTP |
| 异常详情 | Record | Drawer | 摘要 → stack/breadcrumbs → 关联 → 上下文 → Raw | 同 HTTP 详情 |
| Session 链路 | Workspace | Split | 简易 timeline + 右侧 Record | `<900px` Stack + Sheet |

Session 是跨模块链路组装层，不占一级导航。HTTP、埋点、异常的列表和详情必须能带 `eventId` 进入对应 Session。

## 视觉系统

### 密度与字体

- 默认表格/列表行高：36px；触控窄屏不得低于 44px
- panel padding：12px；页面主区块间距：16px 或 24px
- 正文：13px/20px；辅助信息：12px/18px；面板标题：15px/24px
- `font.sans`：系统栈 + PingFang SC / Microsoft YaHei
- `font.mono`：SF Mono / Consolas / Menlo
- ID、JSON、URL path 使用等宽字体；耗时、状态码使用 `tabular-nums`
- 首批不做全站暗色；Raw/JSON 阅读区允许局部深色，但仍消费统一 token

### Primitive

- accent：`#0d9488`；hover：`#0f766e`；active：`#115e59`
- success：`#059669`
- warning：`#d97706`
- danger：`#dc2626`
- info：`#2563eb`
- neutral：`#71717a`
- gray scale：zinc 50-950
- radius：4px（控件）、6px（面板）、8px（浮层）；除 badge/chip 外禁止过度圆角
- motion：hover/focus 120ms；Drawer/Sheet 180ms；遵守 reduced motion

### Semantic Token 最小集

| 类别 | Token | 映射/用途 |
| --- | --- | --- |
| background | `canvas` / `surface` / `subtle` / `selected` | zinc.100 / white / zinc.50 / teal.50 |
| border | `default` / `muted` / `focus` / `selected` | zinc.200 / zinc.100 / teal.600 / teal.600 |
| text | `primary` / `secondary` / `muted` / `link` / `code` / `inverse` | zinc.950 / zinc.600 / zinc.400 / teal.700 / zinc.800 / white |
| accent | `default` / `hover` / `active` / `subtle` | teal.600 / teal.700 / teal.800 / teal.50 |
| status | `success` / `warning` / `danger` / `info` / `neutral` | 使用上方 primitive；同时提供对应 subtle background |
| interactive | `focusRing` / `overlay` | teal focus ring / 半透明 zinc.950 遮罩 |

主题统一收敛到 `platform/web/src/styles.css` 的 `@theme` / CSS 变量。业务组件只消费 semantic/component token，不直接写 hex。表头 sticky 使用 `z-index: 10`；Drawer/Sheet 使用 100；toast 使用 300。普通面板使用 border，不使用浮动卡片阴影；popover 和 Drawer 才使用 elevation。

## 响应式布局

- 展开侧边栏宽 216px；折叠态宽 56px
- Catalog 主表最小宽 640px，并占据剩余空间
- 摘要预览默认宽 360px，最小 320px，最大 480px
- Split 可拖动；宽度只存本地，不进入 URL；必须提供恢复默认宽度能力
- Record Drawer 宽 `min(720px, 72vw)`
- `>=1024px`：Catalog 主表 + 常驻预览
- `<1024px`：取消常驻预览；点行打开 Sheet 或进入完整详情
- `<900px`：Record 使用全高 Sheet/full page；Session 改为 Stack + Sheet
- 小屏 HTTP 列表优先隐藏业务码、路由等低优先级列，保留时间、方法、URL、结果和耗时；不改造成装饰性卡片墙
- 表头保持 sticky；筛选条可 sticky；页面只保留一个主滚动容器，避免表格、页面和预览三重滚动
- URL、ID 和 message 必须截断但可查看完整值，不得撑破列宽

## 共享交互契约

### Catalog、Preview 与 Record

- 桌面点击行只改变选中项并更新右侧 Preview；双击或显式“打开详情”进入 Record
- Preview 只展示关键字段、问题状态、链路 ID 和跳转入口，不加载 body、stack 或 Raw
- Preview 无选中时显示“选择一行”；其 loading/empty/error 与主表独立
- Record 最多一层 Drawer/Sheet，不允许 Drawer 中再开 Modal/Drawer
- 关闭 Record 后回到原列表选中项并恢复键盘焦点和滚动位置
- 行内操作提供打开详情、查看 Session、复制必要 ID；次要操作使用菜单或图标按钮
- 类型使用稳定文字/图标编码；仅问题状态使用 status 色，正常行不整行上色

### URL 与导航状态

URL 是可分享、可刷新恢复的已提交状态事实源。输入框编辑中的临时字符可以留在组件内，提交后必须进入 URL。

```text
/http?...&eventId=<preview-event>&detail=<record-event>
/business?...&eventId=<preview-event>&detail=<record-event>
/errors?...&eventId=<preview-event>&detail=<record-event>
/sessions/<sessionId>?eventId=<selected-event>&traceId=<optional-trace>
```

- `eventId` 表示列表选中与 Preview；`detail` 表示当前打开的完整 Record
- 刷新恢复筛选、选中项和 Record；浏览器返回优先关闭 Record，再恢复上一个选择/筛选
- 关闭 Record 只清除 `detail`，保留 `eventId`
- 筛选、分页后选中项不再属于结果集时，同时清除 `eventId` 和 `detail`
- SSE 更新不得抢占选择、自动打开 Preview 或在用户离开列表顶部时强制重排；只提示有新数据或在合适时刷新
- Session 跳转必须带目标 `eventId`；Session 页面负责选中并滚动到对应节点
- Split 宽度、折叠状态等设备偏好不进入 URL

### 数据与控件状态

- 主数据区必须覆盖 loading、empty、error；Catalog 另含 noResults、partial；Record 另含 notFound、partial
- `empty` 表示当前数据源无数据；`noResults` 表示筛选无匹配，二者文案与下一步不同
- error 必须提供重试；partial 必须说明缺失范围，不能伪装完整
- `detail_dropped`、body 截断、无 body、业务码解析失败必须诚实说明原因
- 所有交互控件覆盖 default、hover、focus、disabled、loading；危险操作另有 danger
- focus 可见；图标按钮有 tooltip 和可访问名称；表格行可以用键盘选择和打开
- loading 不阻断已经可用的筛选输入；后台刷新尽量保留现有内容

## HTTP 样板页

### 用户任务

在海量 `http.client` 中按范围和 HTTP 维度定位请求，扫描关键列，查看摘要或完整请求/响应，并进入关联 Session。

### 页面结构

```text
页面标题 + Live/数据源状态
共享范围筛选
HTTP 常驻筛选 + 更多筛选 + 清除/结果数量
Catalog Split
  主区：HTTP 表格 + 分页
  右侧：选中请求摘要 Preview
Record Drawer/Sheet（按需）
```

共享范围筛选属于样板页，不得后置。首批范围项为时间、用户 ID、Session ID、版本、环境和关联路由。

### 筛选分层

| 层级 | 筛选项 | 交互 |
| --- | --- | --- |
| 共享范围 | `from`、`to`、`userId`、`sessionId`、`appVersion`、`environment`、`route` | 时间显式应用；选择项立即提交；文本 Enter 提交 |
| HTTP 常驻 | URL 模糊、method、结果 | URL Enter 或 300ms debounce；select/toggle 立即提交 |
| HTTP 更多 | request ID、HTTP 状态码、业务码、Host、慢请求 | Popover/Sheet；应用后以 filter chip 展示 |

- URL 参数使用上表 camelCase 名称；多选统一使用逗号分隔，解析时去重并稳定排序
- “重置 HTTP 筛选”保留共享范围；“清除全部”同时清除范围和 HTTP 筛选
- 慢请求阈值由 service 返回或统一配置提供，前端不得自行发明
- 完整 URL 开关只影响展示，不发起新查询；默认关闭并可作为本地偏好保存
- 筛选提交后回到第一页；无效 URL 参数应忽略并给出非阻断提示，不得导致白屏

### 表格

默认列顺序：时间、方法、URL path、HTTP 状态码、业务码、耗时、关联路由、操作。

- 默认按时间倒序
- 方法保持中性稳定编码；失败和慢请求才使用问题色
- URL 默认不显示 Host；允许切换完整 URL
- 状态码、业务码、耗时使用 `tabular-nums`
- 首批采用服务端分页，不在前端加载全量事件后伪分页
- 默认每页 50 条，可选 25/50/100；分页和 page size 写入 URL
- 行不内联 headers/body；复制操作至少覆盖 event ID、session ID、trace ID、request ID

### Preview

展示 method、URL、HTTP 状态、业务码、耗时、size、route、时间、问题状态，以及 event/session/trace/request ID。主操作为“打开详情”，次操作为“查看 Session”。详情被剥离时只说明，不在 Preview 请求 body。

### Record

- 顶部摘要：method、URL、HTTP 状态、业务码、耗时、size、route
- 内容 Tab：请求、响应、上下文、Raw
- 请求：url/query/headers/body；响应：status/headers/body
- 失败请求默认进入响应 Tab；否则默认进入请求 Tab
- body 区分 JSON 和文本，支持格式化/原文、折叠与复制
- Raw 永远置后，展示完整 `EventEnvelope`
- 上下文包含 user/device/app 和完整链路 ID

## 查询前置契约

正式实现 HTTP Catalog 前，Monitor Service 与 datasource 必须提供等价的专用查询契约；不得长期用通用 `recent` 或客户端过滤代替。

```text
HttpCatalogQuery
  scope filters
  http filters
  sort = timestamp.desc
  limit + offset

HttpCatalogResult
  items: HttpCatalogItem[]
  total
  limit
  offset

HttpCatalogItem
  Catalog/Preview 所需摘要
  eventId + sessionId + traceId + requestId
```

- 首批沿用 `limit + offset`，不额外引入 cursor；海量数据验证后再升级
- query 字段必须与 URL 筛选一一映射，避免前端维护第二套筛选语义
- `HttpCatalogItem` 是可回查 envelope 的只读摘要，不是新的事件模型
- 完整详情通过 `getEvent(eventId)` 获取原始 `EventEnvelope`
- Host、业务码可作为 service 派生索引和查询摘要，但不得写回或冒充 SDK/core 字段
- 业务码必须区分：有值、响应无该字段、详情不可用、解析失败
- API endpoint、DTO 和 Swagger 细节在 service 实现时同步维护到对应 API 文档

## 实现约束

- 框架：React 19 + Vite + TypeScript
- 组件：Radix + CVA + Tailwind v4 + lucide-react
- 路由：TanStack Router；筛选和阅读状态使用 search params
- 查询：TanStack Query；live 使用 `useLiveInvalidation`
- Overlay：基于 Radix Dialog 扩展 Drawer/Sheet
- 目录：`features/`、`routes/`、`components/`、`shared/`；kebab-case；文案中文
- 页面 greenfield；复用 datasource、查询、envelope accessor、字段词典、格式化和 URL 序列化思路
- JsonViewer 只克制复用行为能力，必须按本文件 token 包装或重做，不得成为全站视觉样板
- UI view model 只存在于 web 内，并且每个摘要都能回查原始 envelope

### 目标组件

| 组件 | 目标路径 | 最低能力 |
| --- | --- | --- |
| ScopeFilterBar | `features/scope/` | 范围筛进入 URL；可应用、分组清除；loading 不挡输入 |
| HttpFilterBar | `features/http/` | 常驻/更多筛选；chip；URL 同步；分组重置 |
| HttpCatalogTable | `features/http/` | 固定列、服务端分页、行选中、键盘操作、完整状态 |
| CatalogPreviewPane | `features/catalog/` | 摘要、链路 ID、详情/Session 入口、独立状态 |
| RecordShell | `features/inspector/` | 摘要、领域 Tab、上下文、Raw；一层浮层；焦点恢复 |
| HttpRecord | `features/inspector/` | 请求/响应；缺失说明；JSON/文本 body |
| SplitPane | `components/layout/` | 可调宽、min/max、恢复默认、窄屏降级 |
| CopyableId | `components/common/` | 短显、复制、反馈、可访问名称 |

## 样板验收

HTTP 样板完成后进行一次人工截图与交互验收。该门禁用于阻止视觉和交互分叉，不要求建立像素级截图基线。

### 最低验收矩阵

- viewport：宽桌面（1440px）、Split 临界附近（1024px）、窄屏（390px）
- 数据：正常列表、loading、empty、noResults、error、partial/detail dropped
- 边界内容：长 URL、空 route、缺失业务码、大 body、失败与慢请求并存
- 交互：筛选写入 URL、刷新恢复、浏览器返回关闭 Record、焦点恢复、分页清除失效选中项、Session 定位
- 视觉：密度、列对齐、sticky、Preview 宽度、Drawer、窄屏无重叠或文字溢出
- 可访问性：键盘选择/打开、可见 focus、图标按钮名称、基础对比度、reduced motion

验收通过后在本文 Meta 追加样板确认日期和结论，才允许按同一壳扩展埋点、异常和大屏。若未通过，只迭代样板页，不并行铺第二页。

## 硬约束

1. 决策优先级：`FEATURES.md` > `KEEP_KILL_STEAL.md` > `DESIGN.md` > 目标工程惯例 > 组件库惯例
2. 主数据区必须有 loading/empty/error，并按页面补 noResults/partial/notFound
3. 最多一层浮层；关闭后恢复原选中项、焦点和滚动位置
4. 颜色、间距、字号、圆角和层级走 token，禁止页内硬编码
5. 单一视觉系统与唯一主题入口：`styles.css` / `@theme`
6. Split/Workspace 必须有窄屏任务重组，不做桌面布局等比缩放
7. 筛选和阅读状态可分享、可刷新、可前进后退恢复
8. 样板页未验收通过前，禁止铺开第二个业务页面
9. 类型编码与问题着色分离；无问题不强行上色
10. Raw/JSON 置后；摘要优先；Preview 不替代完整 Record
11. JsonViewer 仅克制复用，不得反向约束 Catalog 和筛选布局
12. 不新增第二套事件模型；派生摘要必须能回查原始 envelope

## 演进规则

- 结构性 UI 变化，包括气质、信息架构、页面模式、主题入口、组件库和导航，必须先更新本文
- 功能增删先更新 `FEATURES.md`；旧实现取舍变化先更新 `KEEP_KILL_STEAL.md`
- 与代码冲突时以事实源文档为准，或在本文显式记录临时技术债和退出条件
- HTTP 样板验收后，在 Meta 记录确认日期，再扩展埋点、异常和大屏
