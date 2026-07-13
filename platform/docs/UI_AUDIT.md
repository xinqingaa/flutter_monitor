# Workbench UI 审计（相对 shadcn 官方 + DESIGN）

- status: active
- last_updated: 2026-07-13
- 对照：[`DESIGN.md`](DESIGN.md) A–C、`.agents/skills/shadcn` Critical Rules、官方 Calendar / Combobox / Select 示例
- 目标：官方交互为基线；业务只外挂 URL / i18n / 数据；不得为灰白削皮改坏控件

## 判定标签

| 标签 | 含义 |
| --- | --- |
| 对齐 | 交互与观感接近官方，仅布局/文案差异 |
| 可修 | 结构可用，去掉削皮或补中间态即可 |
| 需重做 | 组合方式偏离官方，建议按 registry/示例重装或重写 |
| 业务例外 | 为 URL/维度查询等业务必须存在的扩展，须文档化且不破坏核心交互 |

## P0 — 筛选控件（本轮优先）

| 组件 | 路径 | 判定 | 问题 | 修复方向 |
| --- | --- | --- | --- | --- |
| DateRangePicker | `components/ui/date-range-picker.tsx` | 可修 → 本轮修 | 必须 `from+to` 才 `onChange`；立刻关 Popover；`shadow-none` / `border-border-default` / `bg-surface` 削皮 | 本地 draft 中间态；完整范围可确认；清除；打开期间不丢半选；`className` 只做布局 |
| IdCombobox | `components/ui/id-combobox.tsx` | 可修 → 本轮修 | Trigger 削皮；loading/error 用手搓 `div` 而非 Empty/文案区惯例 | 恢复 outline 默认观感；空态用 `CommandEmpty`；loading 文案保留为业务例外 |
| Select | `components/ui/select.tsx` | 需重做 → 本轮可修 | 硬编码 zinc/teal；无 `SelectGroup`；「全部」哨兵值为业务必需 | 语义 token + Group；保留 `__all__` 哨兵为业务例外 |
| ScopeFilterBar | `features/scope/scope-filter-bar.tsx` | 可修 | 筛选按钮 `shadow-none`；Sheet 内 `grid gap` 未用 Field | 去掉削皮；Field 布局可放 P1 |
| HttpFilterBar | `features/http/http-filter-bar.tsx` | 可修 | 大量自研边框条；checkbox 非官方 Field | P1：控件换官方，条布局可保留 |

## P1 — Shell 与 Catalog

| 组件 | 路径 | 判定 | 问题 | 修复方向 |
| --- | --- | --- | --- | --- |
| Sidebar / Header | `app/workbench-v2-shell.tsx` | 可修 | `border-border-default` / `bg-surface` 覆盖 Sidebar 默认表面 | 跟随官方 Sidebar token；业务 logo/文案保留 |
| Breadcrumb | `components/ui/breadcrumb.tsx` + shell | 对齐 | — | 保持 |
| Table / 分页 | catalog tables + 自研 Pager | 可修 | 未统一用 `Pagination`；行选中样式自研 | Catalog 克制选中可保留；分页对齐官方 |
| Empty / Skeleton | `empty.tsx` / `skeleton.tsx` | 可修 | 列表/图表多处仍用纯文字占位 | Catalog/大屏 loading·empty 统一 |

## P2 — 浮层与基础件

| 组件 | 路径 | 判定 | 问题 | 修复方向 |
| --- | --- | --- | --- | --- |
| Sheet / Dialog / Drawer | `sheet.tsx` 等 | 可修 | 需确认 Title 齐全 | a11y Title；业务文案外挂 |
| Tabs / Popover / Command | ui/* | 对齐偏可修 | Command 组合正确；注意 Item→Group | 跟 skill composition |
| Button / Input / Badge | ui/* | 可修 | Badge 可能有业务 tone；Button 有 `danger` 扩展 | 扩展可留；勿再 shadow-none 全站 |
| Toast | `toast.tsx` vs sonner | 需重做（后续） | skill 要求 sonner；现自研 toast | 单独一轮迁 sonner |

## P3 — 大屏与遗留

| 项 | 判定 | 问题 | 修复方向 |
| --- | --- | --- | --- |
| Dashboard Tremor | 业务例外 | 图表色强于 Catalog；符合 DESIGN 分层 | 不削成灰白；保持可点 drilldown |
| `datetime-local` / 遗留表单 | 可修 | 若仍有入口应迁 DateRange / Field | 搜残留并替换 |
| Session Console | 业务例外 / 暂缓 | 大量自研 teal 选中 | 不在本审计修复范围（FEATURES 二级） |

## 本轮已落地（P0）

1. DateRangePicker：draft + 确认/清除，半选不丢弃、不强制立刻关。
2. IdCombobox / Select：去掉过度削皮，Select 改语义色与 Group。
3. Scope 筛选触发按钮去掉 `shadow-none`。

## 验收对照

- [ ] Date Range：可只选起点再选终点；未确认前关浮层不写坏 URL 半状态策略符合实现注释
- [ ] Date Range：确认后才更新 URL；可清除为「全部时间」
- [ ] Select：「全部…」可选且显示 placeholder 语义
- [ ] Combobox：模糊查 + 选中写 URL；观感接近官方 Combobox
- [ ] `pnpm typecheck`（web）通过
