# TODO

## 1. 扩展：长停留页面性能切片

目标：页面不切路由时，也能观察长列表、图表、TabBar 容器页、仪表盘等长停留场景的中间性能表现。

设计方向：

- 优先复用 `page.visit` 主链路，在页面 trace 的 payload 或 summary 中追加有界切片摘要。
- 切片只保存聚合结果，不逐帧上报。
- 默认不开启全局定时切片；需要时通过明确配置开启，并设置较低频率和样本数门槛。
- 同一页面实例下的多个切片使用 `page.instance_id` 和切片序号关联，避免重新引入独立 frame window 协议。
- Workbench 可在页面详情内展示切片曲线，但 raw envelope 主链路仍以 `page.visit` 为入口。

待设计：

- `MonitorFrameConfig` 中的页面切片开关、间隔、最小样本数和最大切片数。
- `page.visit` payload 中切片结构的字段、大小上限和裁剪策略。
- 长停留切片与 `ui.jank.sequence` 的关系：切片描述普通性能画像，卡顿序列仍是问题事件。

## 2. 扩展：业务交互性能窗口

目标：让业务主动标记 TabBar 切换、图表缩放、图表渲染、复杂滚动、筛选刷新等不切路由的关键交互，并把交互期间的帧表现回连到当前 session、route 和 `page.instance_id`。

建议 API 草案：

```dart
final handle = FlutterMonitorSDK.startPerformanceWindow(
  name: 'chart.zoom',
  attributes: {'chart.type': 'line'},
);

await doZoom();

handle.finish();
```

便捷 API 草案：

```dart
await FlutterMonitorSDK.trackPerformanceWindow(
  name: 'tab.switch',
  action: () async {
    setState(() => currentTab = index);
    await nextFrameOrDelay();
  },
);
```

设计原则：

- 交互名称必须低基数、可聚合，不允许包含用户输入、URL query、订单号等动态值。
- 交互窗口可以和页面窗口同时存在，同一批 `FrameTiming` 可进入多个内存聚合器。
- 必须限制并发数量，并提供 timeout，避免业务忘记 finish 后长期持有状态。
- 输出形态优先回写当前业务 trace、breadcrumb 或 `page.visit` 详情，不新增一套默认主时间线事件。
- Workbench 在页面详情或业务动作详情内展示交互窗口，不把它和 `ui.jank.sequence` 混成同一类问题。

待设计：

- 交互窗口字段 namespace、隐私等级、字段注册和服务端聚合边界。
- timeout、cancel、异常结束的状态语义。
- 同时存在多个交互窗口时的样本归属和上限策略。

## 3.扩展 TODO

- 当前 example 的内存按钮只负责制造真实分配、释放和卡顿场景；生命周期链路通过真实 App 前后台切换调试 SDK 自动采集。
- 当前 SDK 默认启用基础 memory collector：初始化后采 `memory.sample`，`paused/hidden` 采样，`resumed` 和 jank sequence 后基于 `ProcessInfo.currentRss` 做增长判断。
- `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据；后续可在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 当前能力只能形成疑似线索，不是对象级泄漏检测器；不能自动指出具体 Dart 对象、Widget、页面实例、图片缓存、纹理或 native 资源根因。


## 4. 待验证：Lifecycle、热重启与 session 边界

背景：一次本地 Workbench raw 数据中，用户操作路径预期为启动 App 后停留在 `/`，随后进入后台、恢复前台，再次进入后台。Workbench 中第二个 session 的首段显示为页面活动或会话活动，节点包含生命周期 `hidden -> paused`、退出前 flush、后台停留、前台恢复、热重启、前台停留等，并出现多轮热重启观感。

本轮证据还不够充分，以下内容只作为待验证线索，不作为最终结论。后续需要多次复现，保留 raw envelope、控制台 compact log、Workbench SQLite 数据和操作时间点，再决定定位和修复方案。

本轮观察到的 raw 现象：

- Workbench 中可见两个 session，第二个 session 的第一条已入库事件不是 `app.cold_start` 或 `sdk.init`，而是 `app.lifecycle` 的 `hidden/paused` 相关事件。
- 第二个 session 的首条可见事件 event id 计数已经不是 `_0`，说明该 SDK 实例在此之前可能生成过更早事件，但 Workbench 当前数据中没有看到这些早期事件。
- 第二个 session 内可见多次 `app.hot_start`，但本轮 raw 中这些 `app.hot_start` 的 `payload.session.started_new` 均为 `false`；因此不能仅凭当前数据断定“第一次热重启开启了新 session”。
- `app.foreground_duration` 当前语义应理解为上一段前台 activity window 的持续时间，即从上一次 `resumed` 到后续 `hidden/paused/detached` 的间隔。

需要继续采证的问题：

- 第二个 session 的早期 `app.cold_start`、`sdk.init`、`memory.sample(session.start)`、初始 `page.visit` 是否真实生成但没有入库，还是 SDK 在该场景下没有生成。
- session 边界是由 App 进程重启、Flutter isolate/SDK 重新初始化、`backgroundSessionTimeout`、还是 lifecycle 恢复逻辑触发。
- 多次短间隔 `paused -> resumed` 是否来自 Android lifecycle 抖动、系统权限/任务切换行为、热重载/调试器影响，还是 SDK lifecycle listener 重复触发。
- `HttpOutput` 自身 lifecycle flush 与 Reporter lifecycle flush 曾存在重复职责；当前已收口为 Reporter / pipeline 统一触发，`HttpOutput` 只保留被动 `flush`。仍需后续观察弱网/后台失败时 batch 保留策略。
- Workbench timeline 在缺失 session 早期启动事件时，是否应明确提示“该 session 起始事件缺失”，避免把缺失数据误读为真实链路起点。

后续复现建议：

- 每轮复现前清空或标记 Workbench 数据，记录绝对操作时间：启动、首次进入后台、首次恢复、第二次进入后台、第二次恢复。
- 同时保留 Workbench raw 查询结果和控制台 compact log，重点对比 `eventId` 计数是否连续、`sessionId` 生成时间、`app.hot_start.payload.session.started_new`、`app.background_duration.durationMs`、`app.foreground_duration.durationMs`。
- 复现时分别测试：仅 `LogMonitorOutput`、仅 `HttpOutput`、同时启用二者；`MonitorSessionConfig.flushOnBackground` 开关；较大的 `batchReportSize` 与较短 periodic flush。
- 用明确的 `backgroundSessionTimeout` 做对照：短阈值验证 session 切分，长阈值验证普通热恢复是否保持同一 session。

候选修复方向，待证据确认后再实施：

- 已收口 flush 责任：`HttpOutput` 不再注册自己的 lifecycle listener，由 Reporter lifecycle flush 统一触发 output `flush`。
- 提升 `HttpOutput` 可靠性：后台或退出 flush 失败时保留可重试队列，或至少输出可回查的丢弃/失败自监控事件。
- 为 `app.hot_start` 增加最小后台间隔或 debounce，避免几十毫秒级 lifecycle 抖动被展示为完整热重启。
- 如果 resume 后确实切分新 session，确认 `app.background_duration`、`app.hot_start`、恢复后的 lifecycle breadcrumb 都绑定到一致且正确的 session。
- Workbench 对 session 首事件缺失、event id 不连续或缺少 cold start 的 session 增加诊断提示，不在 UI 层伪造启动事件。
