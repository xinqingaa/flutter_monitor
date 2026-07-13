# Workbench Design

## Meta

- status: active
- last_updated: 2026-07-13
- 功能事实源：[`FEATURES.md`](FEATURES.md)
- 旧实现取舍：[`KEEP_KILL_STEAL.md`](KEEP_KILL_STEAL.md)
- 实施计划：[`PHASE5_UX_PLAN.md`](PHASE5_UX_PLAN.md)
- 当前状态：阶段 0–2 已完成；HTTP Catalog 是下一个官方基线样板

本文只定义 Workbench 的产品气质、信息架构和实现原则。它不定义一套独立于 shadcn 的视觉系统，也不规定组件的像素尺寸、颜色、圆角、阴影、z-index 或具体页面排版。

## 决策顺序

发生冲突时按以下顺序处理：

1. `FEATURES.md` 定义的功能范围
2. shadcn 官方组件、官方 blocks 和官方示例的结构、视觉与交互
3. 本文的产品气质和信息架构
4. 业务字段、路由、查询和数据状态适配

官方 shadcn 基线高于本项目的历史视觉偏好。业务需求不得通过覆盖官方组件样式来解决，除非该偏离已经在本文或对应功能文档中明确记录。

## 产品气质

Workbench 是面向 Flutter 开发者、QA 和技术负责人的排查工作台：

- 专业、清晰、克制，优先支持扫描、比较、定位和回查。
- 允许使用官方设计系统提供的颜色、层次、阴影和状态表达。
- 不做营销型 Hero、装饰性大卡片墙或与数据无关的视觉内容。
- 大屏可以有仪表盘感，但每个指标和图表都应服务于真实数据和后续定位。
- Raw JSON、详细 payload 和技术字段属于深读内容，不抢占第一视觉。

这些是方向性要求，不是新的组件皮肤规范。具体观感以当前 shadcn 官方示例为准。

## 信息架构

一级入口固定为：

1. 大屏
2. HTTP
3. 埋点
4. 异常

Session 是二级链路工作区，可从大屏、列表和详情进入。详情、筛选、分页、选中事件和 Session 定位应使用现有路由与 URL 状态能力，并继续回查统一 `EventEnvelope`。

## 官方 shadcn 基线

项目当前基线：

- Vite + React + TypeScript
- shadcn `new-york`
- Radix primitives
- Tailwind CSS v4
- lucide icons
- `@/components/ui` 存放官方 primitive 源码
- `features/`、`app/`、`routes/` 存放业务接线

引入或更新组件时优先使用 shadcn CLI、官方 registry、官方文档和官方 examples。实现者应先查找已有组件或官方 block，再开始编码：

```bash
pnpm dlx shadcn@latest info
pnpm dlx shadcn@latest search @shadcn -q "<component>"
pnpm dlx shadcn@latest docs <component>
pnpm dlx shadcn@latest add <component> --dry-run
```

任何新增或更新的官方组件都必须检查生成源码、导入路径和当前项目配置。不得凭记忆重写官方组件。

## 组合原则

- 优先复用官方 primitives 和官方 blocks。
- 业务组件只负责数据、路由、字段映射、查询状态和文案适配。
- 不在业务层重新发明 Sidebar、Table、Card、Menu、Popover、Select、Date Picker、Sheet、Drawer、Dialog、Tabs、Empty 或 Loading 组件。
- 不为一个页面另造一套 spacing、颜色、圆角、阴影或 overlay 规则。
- 需要领域组合时，采用官方组件的直接组合，并尽量保持官方示例的 DOM 层次和交互行为。
- `components/ui` 不放业务字段和领域判断；业务组合不复制官方 primitive 的实现。
- `components/ui` 保持官方导出粒度和 API。`options`、URL sentinel、查询状态、领域文案等适配必须放在 `features` 或 `components/common`，不得改写官方 primitive API。

推荐的官方能力映射：

| 场景 | 优先使用 |
| --- | --- |
| 应用壳与导航 | Sidebar、Breadcrumb、Separator、Tooltip |
| 数据集合 | Table、Pagination、ScrollArea、Resizable |
| 有限选项 | Select、ToggleGroup |
| 模糊候选 | Command + Popover |
| 时间范围 | Calendar + Popover，按官方 Date Range 示例 |
| 低频操作 | DropdownMenu、ContextMenu |
| 详情与筛选 | Sheet、Drawer、Dialog、Tabs |
| 加载与无数据 | Skeleton、Empty、Alert |
| 反馈 | sonner / Toast |
| 图表 | 优先使用 shadcn Chart；若保留 Tremor，只作为绘图实现，不另建视觉系统 |

## 主题与颜色

主题以 shadcn 官方 CSS variables 和当前配置为基准。第一轮不建立 `--fm-*` 设计系统，不要求业务页面消费自定义颜色 token。旧页面所需 alias 只能作为迁移兼容层，并在阶段 7 删除。

业务代码优先使用官方语义类名和组件 variants，例如 `bg-background`、`text-muted-foreground`、`border-border`、`variant="outline"` 和 `variant="secondary"`。状态色只用于表达真实状态，不能把普通数据行装饰成彩色列表。

需要产品专属颜色或图表系列时，先确认 shadcn 官方 token 无法满足，再以最小扩展方式记录用途；不得在页面内散落 hex 值。

## PC-first

本轮优先完成桌面 Workbench，不以移动端适配阻塞 PC 交付。首轮主要验收视口为 1440px 和 1280px，1024px 用于检查明显溢出。

移动端只要求不破坏数据访问；Sidebar、Sheet、Drawer 和列表压缩策略可以在 PC 基线通过后单独实施。不得为了提前适配移动端而改变桌面官方示例的结构。

## 数据与交互边界

- 不新增第二套事件模型、导出格式或字段协议。
- 派生摘要、图表和列表 view model 必须能回查原始 `EventEnvelope`。
- 页面必须诚实表达 loading、empty、error、no results 和 not found 等状态。
- 筛选、分页、选中记录和 Session 定位沿用现有 URL/query 约定。
- SSE 或后台刷新不得抢走用户当前选中项，也不得无提示地改变阅读位置。
- 详情按需加载深层 payload；Raw JSON 作为详情内容，而不是首页装饰。

## 官方基线验收

每个新页面先与对应 shadcn 官方示例或官方 block 做结构和交互对照，再进行业务验收：

- 是否使用了对应的官方组件或官方 block。
- hover、focus、disabled、keyboard、Popover、Menu 和 overlay 行为是否保持官方语义。
- 是否没有通过业务 class 把官方组件改成另一套皮肤。
- 是否没有出现自造的 Card、Toolbar、Menu、Table、Empty 或空间系统。
- 页面是否能完成 `FEATURES.md` 规定的查询、详情、Session 回查和错误状态。

截图验收优先覆盖 PC 的 Shell、HTTP Catalog、详情和大屏。构建通过不等于视觉验收通过。

## 文档演进

- 功能增删先改 `FEATURES.md`。
- 现有资产取舍先改 `KEEP_KILL_STEAL.md`。
- 官方组件来源、页面基线或信息架构发生变化时再改本文。
- 纯粹跟随 shadcn 官方版本的视觉变化，不应被记录为新的项目设计规则。
