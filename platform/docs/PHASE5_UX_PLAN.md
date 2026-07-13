# Workbench PC-first 重构计划

## Meta

- status: in_progress
- last_updated: 2026-07-13
- decision order: [`FEATURES.md`](FEATURES.md) -> [`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md) -> [`DESIGN.md`](DESIGN.md) -> 本计划
- implementation order: docs -> 必要 service/datasource -> web -> 自动验证 -> PC 人工验收
- current target: 阶段 3、4、5

本计划只跟踪前端工作台重构。构建通过不等于视觉完成；阶段必须同时满足代码、官方来源对照和指定视口验收，才能标记 `complete`。

## 锁定基线

项目配置：

- style: `new-york`
- base: `radix`
- Tailwind CSS: v4
- icons: lucide
- framework: Vite + React + TypeScript
- package runner: pnpm

第一轮直接使用 shadcn 官方默认变量、primitive 和 blocks，不建立 Flutter Monitor 自有视觉系统。旧 token alias 只用于尚未迁移页面的兼容，不是新页面可使用的设计 API。

## 官方参考清单

| 区域 | 官方来源 |
| --- | --- |
| App Shell | `@shadcn/dashboard-01`、Sidebar |
| 导航 | Sidebar、Breadcrumb、Separator、Tooltip |
| 大屏 | dashboard-01 Section Cards、Card、Chart |
| Catalog | Data Table 示例、Table、Pagination |
| 筛选 | Date Picker、Select、Command + Popover、Dropdown Menu |
| 详情 | Sheet、Tabs、ScrollArea |
| 状态 | Skeleton、Empty、Alert |
| Session | Resizable、ScrollArea、Tabs、Sheet/Drawer |

实现前必须通过 shadcn CLI 的 `info`、`search`、`docs`、`view`、`add --dry-run` 或 `add --diff` 获取当前官方实现，不凭记忆重写。

## 阶段 0：审计与基线

目标：让文档、当前代码和验收状态只有一套口径。

- 审计未提交改动，不覆盖数据层、URL 状态、EventEnvelope accessors 和用户无关改动。
- `FEATURES.md` 只定义功能事实，不指定组件、布局或图表库。
- `KEEP_KILL_STEAL.md` 明确 Kill 旧 token、当前未验收 Dashboard/HTTP 组合和业务化 primitive API。
- `DESIGN.md` 保持轻量，只定义官方基线、产品气质、信息架构和边界。
- 本文件采用阶段 0–8 跟踪，不沿用旧的五轮 Phase 5 计划。

验收：四份文档无职责冲突；状态表与 Git 工作树一致。

## 阶段 1：主题与基础组件

目标：先还原官方 shadcn，再做业务组合。

- 用 CLI 确认项目配置和已安装组件。
- `styles.css` 使用官方 new-york CSS variables；新页面只使用 semantic tokens。
- `components/ui` 保持官方源码边界和导出 API。
- 业务筛选适配器放到 `components/common` 或 `features`。
- 第一轮不增加产品专属颜色、圆角、阴影或尺寸系统。

验收：官方组件 diff 可解释；Button、Select、Popover、Calendar、Sheet、Sidebar 的 hover、focus、disabled、keyboard 和 overlay 行为保留。

已验证兼容差异：当前 CLI 的 Sidebar registry 使用 `w-[--sidebar-width]` shorthand，但在本项目 Tailwind 4.3 构建中未生成桌面占位宽度，导致主内容被固定 Sidebar 遮挡。仓库保留等价的 `w-[var(--sidebar-width)]` 写法，并通过 computed layout 和三个 PC 视口验证。

## 阶段 2：App Shell

目标：建立所有页面共用的官方 PC Shell。

- 以 `@shadcn/dashboard-01` 的 SidebarProvider、AppSidebar、SidebarInset、SiteHeader 结构为参考。
- 一级入口固定为大屏、HTTP、埋点、异常；最近 Session 只作为二级分组。
- Header 统一承载 SidebarTrigger、Breadcrumb、Live 状态和刷新操作。
- 保留桌面折叠、键盘快捷键和官方移动 Sheet 行为。
- PC 主内容不得出现页面级横向滚动或不稳定尺寸。

验收：1440px、1280px、1024px 的 Shell 截图；折叠/展开、导航、Breadcrumb、刷新和移动 Sheet 行为正常。

## 阶段 3：HTTP Catalog

- 以官方 Data Table 示例为结构基线。
- 接入共享范围筛、HTTP 筛选、分页、行操作和 URL 状态。
- loading、empty、noResults、error、partial 均保持稳定尺寸。
- 行操作使用 Dropdown Menu，详情从 Sheet 打开。

验收：HTTP 是后续 Catalog 的唯一 UI 样板，用户确认后再推进其它页面。

## 阶段 4：详情与浮层

- 用 Sheet + Tabs 重建 HTTP Record。
- 摘要优先，请求/响应/上下文/Raw 分层；详情缺失必须说明原因。
- 窄屏按需要使用 Drawer，不复制一套详情组件。

## 阶段 5：大屏

- 优先采用 dashboard-01 的 Section Cards 和 Card 组合。
- 先验证 shadcn Chart；只有数据映射成本有明确证据时才保留其它单一绘图库。
- 图表具备 loading、empty、error、tooltip 和 drilldown，不展示装饰性零值。
- 禁止自建 MetricCard、ChartPanel 等视觉 primitive。

## 阶段 6：埋点 / 异常 / Session

- 埋点和异常复用已验收的 Catalog/Record 结构。
- Session 使用 Resizable + ScrollArea + Tabs，并保留 eventId/traceId 深链。
- 默认路径不恢复 memory、jank、native。

## 阶段 7：清理旧代码

- 删除旧 Shell、旧页面组合、旧 Empty/Dialog/Toast/MultiSelect 等替代实现。
- 删除旧视觉 token alias、直接 zinc/teal 皮肤和无路由消费者代码。
- 删除未采用的图表依赖和双引擎残留。

## 阶段 8：验证与验收

每阶段至少运行：

```sh
pnpm --dir platform typecheck
pnpm --dir platform build
pnpm --dir platform run smoke
git diff --check
```

最终补充 `bash scripts/check.sh`，并人工检查 1440px、1280px、1024px 的正常、loading、empty、noResults、error 和后台刷新状态。

## 验收红线

- 页面只换了 shadcn 文件名或 className，结构仍是自造组件。
- `components/ui` 出现业务 options、URL sentinel、查询状态或领域字段。
- 业务层覆盖官方颜色、字号、圆角、阴影和 overlay z-index。
- 重新产生自定义 Card、Menu、Popover、Table、Empty 或 Loading primitive。
- Select 空值无文案，文本筛选污染浏览器历史，ID 候选来自假数据。
- Catalog 空态导致布局压缩、文字逐字换行或页面横向滚动。
- 摘要、图表或 Session 节点无法通过 eventId 回查 EventEnvelope。

## 状态跟踪

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 0. 审计与基线 | complete | 文档职责与八阶段状态已统一 |
| 1. 主题与基础组件 | complete | 官方配置、主题和 primitive 边界已验证 |
| 2. App Shell | complete | 1440/1280/1024、折叠导航和移动 Sheet 已验证 |
| 3. HTTP Catalog | in_progress | 本轮执行 |
| 4. 详情与浮层 | pending | 待验收 |
| 5. 大屏 | pending | 待验收 |
| 6. 埋点 / 异常 / Session | pending | 待验收 |
| 7. 清理旧代码 | pending | 待验收 |
| 8. 验证与验收 | pending | 待验收 |
