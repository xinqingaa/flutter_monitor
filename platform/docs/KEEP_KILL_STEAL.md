# Workbench Keep / Kill / Steal

本文是工作流 A 的「现有 UI 取舍」文档：对照 [`FEATURES.md`](FEATURES.md) 决定推倒重来时**带走什么、扔掉什么、只借鉴什么**。

原则：

- **默认推倒页面与视觉**；不以现有 `platform/web` 布局为约束。
- **优先保留数据层与交互通性**，不优先保留组件皮肤。
- **克制复用**：即使相对可用的组件，也不整包锁定；能抽逻辑就抽逻辑，UI 仍可按 DESIGN 重做。

状态：`active`（与 `FEATURES.md`、`DESIGN.md` 共同约束 HTTP 样板页实施）

---

## 总判

| 类别 | 结论 |
| --- | --- |
| 一级信息架构与页面视觉 | **Kill**（与 FEATURES 四块不一致，且整体不满意） |
| 数据契约 / Query / envelope 读法 | **Keep（代码）** |
| 排查交互通性（筛选进 URL、摘要回查、详情分层等） | **Steal（思路）** |
| JsonViewer | **克制复用**：能力可参考，不视为已定视觉标准 |

---

## Keep（建议保留的代码资产）

这些不是「好看的 UI」，而是重建时的地基。页面可以 greenfield，这些库继续用或薄封装后用。

| 资产 | 路径（示意） | 保留理由 | 使用边界 |
| --- | --- | --- | --- |
| Datasource + Query | `shared/datasource/*`、`queries.ts` | 与 Monitor Service 契约对齐；SSE / invalidate 已通 | 缺专用 HTTP/埋点/异常 list 时在 **service + datasource** 扩展，不另起第二套模型 |
| Envelope 读法 | `shared/event-model/accessors.ts` 等 | `eventKind`、`issueLabels`、route/user/http 读取是列表与失败判定的通性 | 可随 FEATURES 收口（弱化 jank/memory 默认标签），逻辑保留 |
| 字段词典 | `shared/field-dictionary/fields.ts` | 字段释义与空值 hint，避免详情瞎编 | 展示组件可重做，词典内容保留 |
| 范围筛选 → URL | `features/scope/scope-filters.ts` | 筛选可分享、刷新不丢，是四大模块共享范围条的正确形态 | **UI（ScopeBar）可重做**；URL 序列化思路保留并扩展到领域筛选项 |
| Live 刷新 | `useLiveInvalidation` + subscribe | 本地自调试需要近实时 | 与视觉无关，保留 |
| 格式化 / 复制工具 | `shared/formatting/*` | 复制 JSON/文本、短 ID 等 | `CopyableId` 组件可重做，行为保留 |
| Service 聚合 / console API | Monitor Service | 大屏口径与 Session 二级组装仍可消费 | 按 FEATURES 裁剪展示，不把旧 overview 整页搬回来 |

### JsonViewer：克制复用

路径：`features/inspector/json-viewer.tsx`。

相对其它组件，它是**目前最接近可用**的一块（格式化/原文、折叠层级、复制、限高），但：

- 控件条与排版仍不理想；
- 主题/边框/密度未纳入统一 DESIGN；
- 不应因为「能用」就冻结为全站 JSON 展示规范。

**允许：**

- 重建初期继续调用，避免详情 Raw/body 从零重写；
- 抽离「格式化 ↔ 原文、复制当前视图、默认 collapsed 层级」等行为，作为新组件的验收标准。

**不允许：**

- 把现有 JsonViewer 的视觉当作 DESIGN 样板；
- 在未过样板页验收前，以其样式约束其它面板；
- 假设筛选、Inspector 壳、列表排版可以跟着它「一起留」。

结论：**逻辑与交互能力可借，皮肤与布局不锁死；有 DESIGN 后优先按规范重做或包一层。**

---

## Kill（整页 / 整套作废）

推倒时不要恋战；业务逻辑若需要，从数据层重接，不从旧 JSX 抠。

| 对象 | 原因 |
| --- | --- |
| 现有一级导航 | Overview + Sessions + Startup/Pages/Network/Jank/Errors 与 FEATURES「大屏 / HTTP / 埋点 / 异常」不一致 |
| 现有页面视觉与布局 | 卡片堆叠、密度与筛选体验整体不满意 |
| Session 作为唯一主入口的产品叙事 | 新主路径是信号类型列表；Session 降为二级链路组装 |
| 默认主路径上的 jank / memory / native | FEATURES 明确不做；旧 chip/卡会干扰核心证据 |
| 用通用事件流冒充 HTTP Catalog | `/events` + `recent` 无法满足海量请求列表 |
| 过重的 Session Console 展示规则 | 分段标题语义、复杂折叠等可后置；首批不必背旧复杂度 |
| 把 UI view model 当产品约束 | 旧 timeline/segment 规则不反向约束 FEATURES 与 DESIGN |

**旧 UI 定位：** 仅作业务逻辑与字段映射的考古参考，不以截图或组件树为验收标准。

---

## Steal（思路保留，组件重做）

下列通性写入后续 `DESIGN.md` / 实现验收；**不**要求复用现有组件实现。

### 1. 详情壳：摘要优先，Raw 置后

```text
摘要 → 领域专用 Tab → 上下文 → 原始数据
```

HTTP 已验证该结构（请求/响应分 Tab）。埋点、异常共用同一壳，只换领域 Tab。

可借鉴细节（重做时实现）：

- Tab 指示失败 / 截断 / `detail_dropped`
- 失败时智能默认落到响应或摘要
- body：JSON 与文本分治；格式化/原文切换（可与克制复用的 JsonViewer 能力对齐）

### 2. 筛选进 URL

范围筛 + 领域筛（method、status、action、error type…）都应可分享。  
大屏指标卡 drilldown = 跳转列表并带预筛 query。

现有筛选**表单 UI 不保留**；只保留「状态进 URL」这一通性。

### 3. 摘要都能回查

任意行 / 卡 → 详情（`eventId`）或 Session（`sessionId` + 选中节点）。  
短显 ID + 一键复制 + 失败 toast。

### 4. 类型与问题双编码

- **类型**（http / business / error / startup…）：稳定列或图标  
- **问题**（请求失败 / 业务失败 / 错误…）：仅在有问题时上色  

避免整行五颜六色。

### 5. 详情缺失要诚实

`detail_dropped`、无 body、截断、业务码解析失败 → 空态写清原因，不留白、不假装有值。

### 6. 指标可 drilldown

大屏卡必须可点进对应列表（带预筛），不是装饰数字。

### 7. Session 是组装层

从 HTTP/埋点/异常进入「查看会话」；保留：

- 问题过滤（失败 HTTP / 错误 / 业务失败）
- URL `eventId` 选中与滚动
- 外链居中滚、列表内 nearest、live 贴底才跟随  

首批时间线从简，不搬完整旧 console。

### 8. 人话指标 vs 原始口径

主标签用人话（如慢端耗时）；`p50`/`p95` 等放说明或 tooltip。

---

## 对照 FEATURES 四块

| 模块 | Keep / Steal | Kill（不要继承） |
| --- | --- | --- |
| 大屏 | 可点指标、范围→URL、live、启动/HTTP/error 聚合口径 | jank/memory/sdk 抢第一屏；旧 overview 整页 |
| HTTP | 详情分层思路、字段读法、失败判定；JsonViewer **克制**用于 body/raw | 「性能→网络」聚合页冒充海量列表；旧筛选表单 UI |
| 埋点 | `business.action/result`、业务失败标签、回 session/trace | 与 `measure`/交互性能混主路径 |
| 异常 | error 读法、与业务失败并集、回 Session | Problems 大杂烩（jank/memory） |
| 链路（二级） | `eventId` 深链、`getTrace`、选中滚动策略 | 旧三栏视觉与过重折叠 |

---

## 重建执行约定

1. **数据层当 library，页面当 greenfield。**  
2. HTTP/埋点/异常详情：优先复用 **解析与摘要函数**（若可抽离），JSX 按 DESIGN 重写。  
3. JsonViewer：**克制复用**——过渡期可用，DESIGN 锁定后按规范替换或包一层，不以其视觉定全站。  
4. Session 首批只做打开 + 选中 event + 简单时间线。  
5. 功能边界变更先改 `FEATURES.md`，结构性 UI 变更先改 `DESIGN.md`，再改代码；禁止「先美化旧页」。

---

## 与其它文档的关系

| 文档 | 职责 |
| --- | --- |
| [`FEATURES.md`](FEATURES.md) | 要有什么能力（功能边界） |
| **本文** | 旧实现怎么取舍（Keep / Kill / Steal） |
| [`DESIGN.md`](DESIGN.md) | 气质、Token、交互契约、页面 Task/Layout、样板页与验收门禁 |
| `product_plan.md` | 历史参考；与 FEATURES 冲突时以 FEATURES 为准 |
