# Workbench Frontend Refactor Plan

## Meta

- status: active
- last_updated: 2026-07-11
- scope: Workbench Web、必要的 Monitor Service 查询能力与 datasource 适配
- delivery: 4 个阶段，每阶段 2 步；每阶段完成后由用户验收，再进入下一阶段
- design baseline: [`FEATURES.md`](FEATURES.md)、[`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md)、[`DESIGN.md`](DESIGN.md)

本文只负责实施顺序、交付边界和验收门禁，不重新定义功能或视觉。功能冲突以 `FEATURES.md` 为准，旧实现取舍以 `KEEP_KILL_STEAL.md` 为准，页面与交互以 `DESIGN.md` 为准。

## 总体目标

将现有 Workbench 重构为以大屏、HTTP、埋点、异常为一级入口，以详情与 Session 为二级排查层的高密度工作台。重构过程中保持 `EventEnvelope` 为唯一事件模型，保留可用的数据层和字段读取能力，页面与视觉按新设计重建。

最终交付应满足：

- HTTP、埋点、异常均有可筛选 Catalog、摘要 Preview、完整 Record 和 Session 跳转
- 大屏指标和最近问题均可 drilldown，不存在装饰性指标
- Session 能接住各模块的 `eventId` 并完成链路定位
- 筛选和阅读状态可通过 URL 分享、刷新和前进后退恢复
- 桌面与窄屏均符合 `DESIGN.md` 的任务重组规则
- 所有摘要均可回查原始 envelope，不创建第二套事件模型

## 执行原则

1. 每次只执行当前阶段的两步，不提前铺下一阶段页面。
2. 第二阶段 HTTP 样板验收通过前，禁止实现埋点、异常和大屏新页面。
3. service 只提供查询、索引和派生摘要，不补写 SDK/core 字段。
4. Web 页面 greenfield；datasource、accessor、字段词典、格式化、复制与 live 能力按 `KEEP_KILL_STEAL.md` 复用或薄封装。
5. 每一步结束都运行与风险匹配的测试；每阶段结束运行 platform typecheck、build 和 smoke。
6. 视觉阶段必须启动或复用 `3700`/`4700`，用真实页面截图验收，不能只凭代码判断。
7. 用户验收未通过时只修当前阶段，不并行进入下一阶段。

## 阶段总览

| 阶段 | 步骤 | 核心结果 | 阶段门禁 |
| --- | --- | --- | --- |
| 一、查询与设计地基 | 1-2 | HTTP 专用查询可用；统一主题、壳和基础交互可承载样板 | API/基础组件验收 |
| 二、HTTP 样板 | 3-4 | HTTP Catalog、Preview、Record 和响应式链路完整 | HTTP 样板截图与交互验收 |
| 三、埋点与异常 | 5-6 | 两个 Catalog/Record 复用同一设计系统且字段语义正确 | 跨模块一致性验收 |
| 四、大屏与 Session 收口 | 7-8 | 四入口闭环，所有问题可 drilldown 到 Record/Session | 全站最终验收 |

## 阶段一：查询与设计地基

目标：解决 HTTP 样板的真实数据依赖，并建立唯一视觉与交互基础。此阶段不实现完整业务页面。

### 步骤 1：HTTP Catalog 查询契约

范围：

- 为 Monitor Service 增加 HTTP 专用列表查询，支持 `DESIGN.md` 和 `FEATURES.md` 规定的范围筛选与 HTTP 领域筛选
- 使用服务端 `limit + offset` 分页和时间倒序；返回 `items + total + limit + offset`
- 在 ingest/store/query 层增加必要的 Host、业务码派生索引；不得写回原始 envelope
- 明确业务码有值、不存在、详情不可用、解析失败四种语义
- 扩展 datasource 类型、adapter、query key 和 hook；完整详情继续使用 `getEvent(eventId)`
- 更新 Swagger、service boundaries 和相关测试

主要产物：

- `HttpCatalogQuery`、`HttpCatalogItem`、`HttpCatalogResult`
- HTTP Catalog service endpoint 与 datasource adapter
- 查询、分页、派生字段和 raw envelope 回查测试

不做：

- 不实现 HTTP 页面视觉
- 不修改 SDK/core 字段
- 不用客户端全量过滤代替专用查询

验收：

- Swagger 可执行全部 HTTP 筛选
- 分页总数和排序稳定
- 任意摘要可通过 `eventId` 回查相同原始 envelope
- 业务码解析失败不会被展示成真实业务码

### 步骤 2：主题、应用壳与交互原语

范围：

- 按 `DESIGN.md` 收敛 `styles.css` 的 primitive/semantic token
- 建立新 Workbench Shell：216px 侧边栏、56px 折叠态，以及一级/二级路由能力；正式四入口在阶段四统一切换
- 建立或补齐 Button、Input、Select、Popover、Tabs、Badge、Tooltip、Toast、Drawer/Sheet 等基础原语
- 实现 SplitPane 的 min/max、拖动、本地持久化、恢复默认和窄屏降级
- 建立 RecordShell、CopyableId 的结构与状态接口，但暂不填充完整 HTTP 业务内容
- 保留 TanStack Router、TanStack Query、SSE live 基础设施

主要产物：

- 唯一主题入口和可复用 component variants
- 新 Workbench Shell 与导航
- SplitPane、Drawer/Sheet、RecordShell 骨架
- 基础控件状态和可访问性约束

不做：

- 不迁移旧页面 JSX 到新壳中冒充完成
- 不开始埋点、异常或大屏页面
- 不提前暴露尚未实现的空导航入口；HTTP 样板使用独立可验收路由，旧路由在最终切换前保持可回退
- 不把 JsonViewer 视觉作为主题来源

验收：

- 主题无页面级散落色值
- 基础控件覆盖 hover/focus/disabled/loading
- Drawer 关闭可恢复触发点焦点
- Shell 在 1440px、1024px、390px 无重叠或文字溢出

### 阶段一验证

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
```

阶段一通过后才开始 HTTP 页面组装。

## 阶段二：HTTP 样板

目标：完成第一个可真实使用、可截图验收的页面，锁定全站的密度、筛选、表格、Preview、Record 和响应式模式。

### 步骤 3：HTTP 筛选与 Catalog

范围：

- 实现 ScopeFilterBar：时间、用户 ID、Session ID、版本、环境、关联路由
- 实现 HttpFilterBar：URL、method、结果，以及 request ID、状态码、业务码、Host、慢请求更多筛选
- 所有已提交筛选、分页、page size 写入 URL；支持分组重置和刷新恢复
- 实现 HttpCatalogTable 固定列、服务端分页、行选中、键盘操作和完整状态
- URL 默认不显示 Host，并提供完整 URL 本地偏好开关
- live 新数据不抢占当前选择或阅读位置

主要产物：

- 可真实查询的 HTTP Catalog 主区
- 范围筛与领域筛 URL 契约
- loading、empty、noResults、error、partial 页面状态

验收：

- `FEATURES.md` 2.1 的筛选、列和行操作全部有明确入口
- 分享 URL 后能恢复相同查询结果和页码
- 长 URL、空 route、缺失业务码不破坏表格布局
- 页面没有 headers/body 行内展开

### 步骤 4：HTTP Preview、Record 与样板验收

范围：

- 实现 CatalogPreviewPane：摘要、问题状态、链路 ID、详情和 Session 入口
- 完成 HttpRecord：摘要、请求、响应、上下文、Raw
- body 支持 JSON/文本、格式化/原文、折叠和复制；诚实表达 dropped/truncated/missing/parse failed
- 实现 `eventId` Preview 与 `detail` Record URL 状态，支持刷新、返回、关闭和焦点恢复
- 完成 1024px 以下 Preview 收起、900px 以下 Record Sheet/full page 降级
- 复用或包装 JsonViewer 行为，不继承旧视觉

主要产物：

- 完整 HTTP Catalog + Split + Record 样板
- HTTP → Session 并选中 `eventId` 的链路
- HTTP 样板截图和验收记录

验收：

- 按 `DESIGN.md` 最低验收矩阵检查 1440px、1024px、390px
- 检查正常、loading、empty、noResults、error、partial/detail dropped
- 浏览器返回优先关闭 Record，列表选择和滚动位置可恢复
- Preview 不包含完整 body/Raw，Record 的 Raw 始终置后

### 阶段二验证

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
bash scripts/platform.sh dev
```

阶段二必须由用户验收 HTTP 样板。通过后在 `DESIGN.md` Meta 记录样板确认日期，才可进入阶段三。

## 阶段三：埋点与异常

目标：证明 HTTP 样板形成的是可复用设计系统，而不是只能服务单页的特例。

### 步骤 5：埋点 Catalog 与 Record

范围：

- 增加埋点专用 service/datasource 查询，支持 action、result 和共享范围筛选
- 实现埋点 Catalog：时间、action、result、路由、用户、session、版本
- 区分单次事件与 `business.action.summary`
- 实现埋点 Preview 与 Record：摘要、properties、关联 HTTP/error、上下文、Raw
- 保持相同 URL、Split、Record、状态与窄屏契约

验收：

- success/failed/cancelled 语义和问题着色正确
- `measure` 不进入埋点主路径
- 埋点可进入对应 Session，并定位目标事件
- 组件外观和交互与 HTTP 属于同一系统

### 步骤 6：异常 Catalog 与 Record

范围：

- 增加异常专用 service/datasource 查询，范围严格为 error + `business.result=failed`
- 支持 error type/mechanism、fatal/handled、仅业务失败和共享范围筛选
- 实现异常 Catalog：时间、类型、message、fatal/handled、路由、用户、session、版本
- 实现异常 Preview 与 Record：摘要、stack、breadcrumbs、附近失败 HTTP/埋点、上下文、Raw
- 保持与 HTTP/埋点一致的 URL、状态和响应式模式

验收：

- jank、memory、native 不进入异常首批主路径
- error 与业务失败并集无重复、无漏算
- stack、breadcrumbs 缺失时有诚实说明
- 相关 HTTP/埋点均能回查原始 envelope

### 阶段三验证

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
```

阶段三由用户重点验收三类 Catalog/Record 的一致性，以及字段语义是否因复用组件而被抹平。

## 阶段四：大屏与 Session 收口

目标：完成四个一级入口和二级链路闭环，移除旧页面叙事残留并完成全站验收。

### 步骤 7：大屏

范围：

- 收口启动、HTTP、埋点、异常聚合查询口径
- 实现共享范围条和不超过四个核心指标区
- 实现最近失败 HTTP、error、业务失败入口
- 所有指标和问题项可 drilldown 到带预筛的 Catalog、Record 或 Session
- 趋势仅在数据和 drilldown 完整时实现；否则保持后置

验收：

- 第一屏能回答当前范围内四类信号是否异常
- 主标签使用人话，不直接以 p50/p95 作为标题
- 不出现 memory/jank/native 默认指标
- 不存在不可点击的装饰卡片或图表

### 步骤 8：Session、清理与最终验收

范围：

- 将 Session 收口为二级链路组装：启动、页面、HTTP、埋点、错误简易时间线
- 支持 `sessionId + eventId + traceId` 定位、高亮、过滤和滚动
- 保留外链居中、列表内 nearest、live 仅贴底跟随等必要行为，移除旧 console 过重展示
- 一次性切换大屏、HTTP、埋点、异常四个正式一级入口，移除旧一级导航和废弃页面入口
- 清理不再使用的页面组件与样式；切换前保留旧路由回退能力，切换后不再维持双重信息架构
- 更新文档状态、路由说明和最终验收记录

验收：

- 从三类 Catalog/Record 和大屏进入 Session 均能定位正确事件
- Session 不重新成为一级主入口
- 旧 Overview/Sessions/Startup/Pages/Jank 导航不再可达
- 无第二套事件模型、无不可回查摘要、无页面级视觉分叉

### 阶段四验证

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
bash scripts/check.sh
```

最终通过桌面与窄屏全站截图、核心 drilldown 路径和 raw envelope 回查验收后，重构才算完成。

## 每阶段交付格式

每次完成两步后，交付说明必须包含：

- 本阶段完成的用户可感知结果
- 修改的 service、datasource、web 和文档范围
- 与三份设计事实源的逐项对应
- 已运行的验证及结果
- 供用户验收的 URL、页面路径和操作步骤
- 未完成项、已知限制及下一阶段明确边界

## 状态跟踪

| 阶段 | 步骤 1 | 步骤 2 | 用户验收 | 状态 |
| --- | --- | --- | --- | --- |
| 一、查询与设计地基 | 已完成 | 已完成 | 待验收 | review |
| 二、HTTP 样板 | 待开始 | 待开始 | 未验收 | pending |
| 三、埋点与异常 | 待开始 | 待开始 | 未验收 | pending |
| 四、大屏与 Session 收口 | 待开始 | 待开始 | 未验收 | pending |

开始或完成某一步时同步更新本表。不得一次性把未实际完成的阶段标为完成。
