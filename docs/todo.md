# TODO

## SDK 页面级内存窗口计划

### 目标

- 先聚焦 Flutter SDK 层，不把 native 作为页面内存诊断的前置依赖。
- 页面入栈、首帧、出栈和出栈后一段时间都应产生可展示的 `memory.sample`，Workbench 能看到原始内存变化曲线。
- `memory.growth` 和 `memory.leak.suspect` 只作为 SDK 基于样本生成的诊断结论，不能替代原始样本展示。
- 所有页面内存采样必须异步执行。`didPush`、`didPop`、首帧回调和页面 trace 结束路径只能投递采样任务，不能等待采样完成，不能影响页面切换性能。
- SDK 不主动触发 GC，不承担内存回收职责。
- 泄漏只能表达为 `suspect_only` 线索，不宣称确定泄漏。

### 事件与字段草案

复用现有事件名：

- `memory.sample`：页面窗口的原始采样点。
- `memory.growth`：页面使用期内存明显增长。
- `memory.leak.suspect`：页面出栈后仍保留明显增量。

建议新增或注册字段：

- `memory.window_id`：一次页面内存窗口 ID。
- `memory.window_type`：当前固定为 `page`，未来可扩展为 `app`、`trace` 或 `action`。
- `memory.sample_phase`：`page.enter`、`page.first_frame`、`page.exit`、`page.after_pop`。
- `memory.sample_delay_ms`：相对采样触发点的延迟，`page.after_pop` 默认约 1000ms。
- `memory.delta_mb`：当前样本相对窗口 baseline 的增长。
- `memory.retained_mb`：页面出栈后一段时间仍保留的增量。
- `memory.confidence`：`low`、`medium`、`high`，只用于疑似线索置信度。

现有字段继续复用：

- `memory.rss_mb`
- `memory.growth_mb`
- `memory.growth_duration_ms`
- `memory.sample_source = system`
- `page.instance_id`
- `context.route.name`
- `context.module.*`
- `traceId`
- `payload.trigger`
- `payload.evidence`
- `payload.assertion = suspect_only`

### 默认采样时机

- `didPush`
  - 创建 `MemoryWindow(routeName, pageInstanceId, traceId)`。
  - 立即异步投递 `memory.sample`，`memory.sample_phase = page.enter`。
  - 同步路径不得等待 `ProcessInfo.currentRss` 或任何 IO。
- `page.first_frame`
  - 页面首帧完成后异步投递 `memory.sample`，`memory.sample_phase = page.first_frame`。
  - 用于区分页面构建、图片解码、列表构建等首帧附近峰值。
- `didPop`
  - 页面出栈时异步投递 `memory.sample`，`memory.sample_phase = page.exit`。
  - 页面 trace 结束后安排一次延迟采样，默认 `afterPopDelay = 1s`，生成 `memory.sample_phase = page.after_pop`。
  - 默认生产模式只采一次 `page.after_pop`。多点 after-pop 采样仅作为 diagnostic 模式预留，不进入默认策略。
- `dispose` / `lifecycle.detached`
  - 对仍活跃的页面窗口尽力生成 `page.exit` 样本和窗口结束诊断，但不阻塞退出 flush。

### 默认判断规则

- 页面使用期增长：
  - `page.exit.rss_mb - page.enter.rss_mb >= pageGrowthThresholdMb`
  - 生成 `memory.growth`。
  - payload evidence 必须包含 enter、first_frame、exit 样本和 route/pageInstanceId。
- 页面出栈后保留：
  - `page.after_pop.rss_mb - page.enter.rss_mb >= pageRetainedThresholdMb`
  - 生成 `memory.leak.suspect`。
  - payload evidence 必须包含 `retained_mb`、`after_pop_delay_ms`、`reason` 和 `assertion = suspect_only`。
- 首帧峰值但出栈后回落：
  - 如果 `page.first_frame` 或 `page.exit` 明显增长，但 `page.after_pop` 回落到阈值内，只展示样本和可选 `memory.growth`，不生成 `memory.leak.suspect`。
- 同 route 连续趋势：
  - 维护最近 3 到 5 次同 route 的 `retained_mb`。
  - 多次为正且上升时，将疑似线索 `memory.confidence` 从 `low` 提升到 `medium` 或 `high`。
  - 该置信度仍不能表示确定泄漏。

建议默认阈值：

- `pageGrowthThresholdMb = 24`
- `pageRetainedThresholdMb = 16`
- `suspectLeakThresholdMb = 32`
- `afterPopDelay = 1s`
- `minPageSampleInterval = 300ms`
- `routeTrendWindowSize = 5`

阈值必须放入 `MonitorMemoryConfig`，允许业务按页面类型、设备等级和调试场景调整。默认策略应保守，避免大图、视频、地图、WebView 或系统缓存回收延迟导致大量误报。

### SDK 实现任务

- 在 core 中补充页面内存窗口字段、字段注册、隐私等级和测试。
- 在 `MonitorMemoryConfig` 增加页面窗口开关、阈值、after-pop delay 和趋势窗口配置。
- 将 `MemoryCollector` 从全局 `_baseline/_lastSample` 扩展为：
  - 全局样本：保留 session/lifecycle/jank 的现有能力。
  - 页面窗口样本：按 `page.instance_id` 或 `memory.window_id` 独立维护 enter、first_frame、exit、after_pop。
- 在 `Reporter.startPageLoad` 或路由 observer 进入路径创建页面内存窗口。
- 在 `Reporter.finishPageFirstFrame` 后异步记录 `page.first_frame` 样本。
- 在 `Reporter.finishPageLoad` / `_finishPageTrace` 前后异步记录 `page.exit` 和延迟 `page.after_pop`。
- 页面窗口结束后由 MemoryCollector 统一生成 `memory.growth` 和 `memory.leak.suspect`，Reporter 只负责提供 route、trace、pageInstanceId 和采样触发点。
- 对匿名 route、重复 route、多实例 route 使用 `page.instance_id` 区分，不得只用 routeName 作为窗口主键。
- 所有采样异常只生成 SDK self-monitoring 事件或静默降级，不影响页面 trace、路由切换和 flush。

### Workbench 展示任务

- Session timeline 中展示页面内存样本点：进入、首帧、离开、离开后。
- 页面详情中展示同一 `memory.window_id` 的内存曲线和 delta。
- Problems 中只把 `memory.growth` 和 `memory.leak.suspect` 作为问题入口，不能把普通 `memory.sample` 标成问题。
- `memory.leak.suspect` 展示为“疑似泄漏线索”，必须展示依据和 `suspect_only`，不得展示为“确定泄漏”。
- 支持从内存样本和诊断事件回查原始 envelope。

### 验收

- push/pop 页面不会因为采样引入可感知卡顿；路由回调路径没有 await。
- raw JSON 中能看到同一页面实例的 `page.enter`、`page.first_frame`、`page.exit`、`page.after_pop` 样本。
- 明显分配且不释放的页面能生成 `memory.leak.suspect`，payload 中有完整样本依据。
- 明显分配后释放的页面只展示峰值和回落，不生成 leak suspect。
- 同 route 多次进入退出时，页面实例不会串线。
- 未启用页面内存窗口时，现有 session/lifecycle/jank 内存采样行为保持兼容。

## SDK 页面与应用帧窗口计划

> 状态：基础页面/App 帧窗口已经进入 SDK 方案；长停留 interval 切片和业务交互 frame window API 暂不开发，作为未来扩展评估。

### 目标

- 当前 SDK 只在连续慢帧达到阈值时生成 `ui.jank.sequence`，缺少正常情况下的 FPS、稳定性、分位数和页面维度帧表现。
- 新增低频聚合型帧窗口事件，描述页面和应用在正常运行时的帧表现。
- 帧窗口不逐帧上报，只在内存中聚合后输出摘要，避免高频事件和性能开销。
- 设备层只表达稳定能力，例如 `resource.device.refreshRate` 和 `resource.device.deviceTier`；帧表现主要落在页面和应用窗口。
- 当前默认采集维度以路由和 lifecycle 边界为主：App 启动后开启 App window，页面 enter/resume 后开启 Page window，页面 covered/exit/background/dispose 时输出摘要。
- 长时间停留但不切路由的图表、TabBar、复杂滚动页面，后续通过 interval 切片和业务交互窗口补充，不在当前基础能力中强制定时采集。

### 事件与字段草案

新增事件名：

- `ui.frame.window`：聚合帧窗口，`signalType = metric`。

建议新增或注册字段：

- `frame.window_id`
- `frame.window_type`：`page` 或 `app`。
- `frame.window_phase`：`page.interval`、`page.exit`、`app.interval`、`lifecycle.background`、`app.dispose`。
- `frame.sample_count`
- `frame.slow_count`
- `frame.dropped_count`
- `frame.refresh_rate`

复用现有字段：

- `frame.fps`
- `frame.stability`
- `frame.avg_ms`
- `frame.max_ms`
- `frame.budget_ms`
- `frame.p50_ms`
- `frame.p90_ms`
- `frame.p99_ms`
- `resource.device.refreshRate`
- `resource.device.deviceTier`
- `page.instance_id`
- `context.route.name`
- `traceId`

### 采集策略

- 继续基于 `SchedulerBinding.instance.addTimingsCallback`。
- 每批 `FrameTiming` 到达后，只更新当前窗口聚合状态，不立即上报每一帧。
- 同时维护两个窗口：
  - App frame window：反映应用整体前台帧表现。
  - Page frame window：绑定当前 active page trace 和 `page.instance_id`。
- 页面入栈时开启 Page frame window。
- 页面出栈、route replace、lifecycle background、SDK dispose 时 flush 当前 Page frame window。
- 未来可选：长停留页面每 30s 或更低频率 flush 一个 `page.interval` 摘要，flush 后继续累计下一段窗口。
- 未来可选：App frame window 每 60s 或更低频率生成 `app.interval` 摘要；默认仍以 lifecycle background/dispose 作为强边界。
- `ui.jank.sequence` 保持现有职责，作为问题事件；`ui.frame.window` 是正常性能画像。

### 指标计算

- `frame.budget_ms` 根据刷新率计算，默认 60Hz 时约 16.67ms。
- 慢帧：总帧耗时超过 `frame.budget_ms`。
- dropped frame 估算：`floor(frameDuration / frameBudget) - 1`，最小为 0。
- `frame.fps` 使用窗口内帧数和窗口时长估算。
- `frame.stability` 可先定义为 `1 - slowFrameCount / sampleCount`，范围 0 到 1。
- 分位数只对窗口内 frame duration 样本计算；样本过少时可省略 p90/p99。
- `frame.max_ms`、`frame.avg_ms`、`frame.p50_ms`、`frame.p90_ms`、`frame.p99_ms` 应以同一口径计算，避免 build/raster/total 混用。

### SDK 实现任务

- 在 core 中补充 `ui.frame.window`、frame window 字段、字段注册和测试。
- 新增 `FrameMetricsCollector`，或从 `JankMonitor` 中拆出共享 `FrameTiming` 聚合器，避免两个 callback 重复消费造成混乱。
- 保留 `JankMonitor` 的连续慢帧判断，但让它复用同一批 FrameTiming 数据。
- 在 page trace 生命周期中开启和关闭 Page frame window。
- 在 lifecycle paused/hidden/detached 中 flush app/page frame window。
- 添加 `MonitorFrameConfig`：
  - `enabled`
  - 未来扩展：`pageIntervalEnabled`
  - 未来扩展：`appIntervalEnabled`
  - 未来扩展：`pageInterval`
  - 未来扩展：`appInterval`
  - `minSampleCount`
  - `slowFrameThresholdMultiplier`
- 默认启用低频聚合，不输出 debug 级逐帧日志。

### Workbench 展示任务

- Overview 展示应用整体最近 FPS、稳定性和慢帧窗口数量。
- Pages 展示每个 route 的平均 FPS、稳定性、慢帧数、最大帧耗时和 p90/p99。
- Session timeline 中把 `ui.frame.window` 作为页面区段的性能摘要，不和 `ui.jank.sequence` 混成同一个问题类型。
- Problems 只在 FPS 过低、稳定性过低或慢帧数量超过阈值时展示为问题；普通 `ui.frame.window` 只作为详情和趋势。
- 点击页面帧指标能回到 Session Detail 并选中对应 frame window envelope。

### 验收

- 没有卡顿事件的正常页面也能看到 FPS 和稳定性摘要。
- 长停留页面能周期性生成 `ui.frame.window`，不是必须 pop 后才有数据。
- 页面 pop、app background 和 SDK dispose 都能尽力 flush 当前窗口。
- `ui.jank.sequence` 的现有行为不回退。
- 帧窗口事件量受控，不会按帧上报。
- Workbench 能同时区分“正常帧表现摘要”和“卡顿问题事件”。

### 未来扩展一：长停留页面 interval 切片（暂不开发）

目标：页面不切路由时，也能周期性产出当前页面的帧窗口摘要，覆盖复杂图表、长列表、TabBar 容器页和仪表盘等长停留场景。

适用场景：

- 用户在同一个页面停留较久，期间发生图表刷新、局部 rebuild、长列表滚动或 TabBar 内部切换。
- 页面没有 covered/exit/background，因此当前 Page frame window 长时间不会落 raw JSON。
- 需要观察页面运行中间段的帧表现，但不需要逐帧日志。

设计原则：

- interval 只输出聚合摘要，不逐帧上报。
- 默认不建议 10s 高频采集；优先考虑 30s 或更长间隔，并允许业务关闭。
- `sample_count` 太低时只作为 raw evidence，不生成强诊断结论。
- timing callback 里只做计数和内存聚合，不做 IO、不构建 envelope。

建议配置：

- `MonitorFrameConfig.pageIntervalEnabled`：默认 `false`，复杂页面或诊断模式可开启。
- `MonitorFrameConfig.pageInterval`：默认 `30s`。
- `MonitorFrameConfig.appIntervalEnabled`：默认 `false`。
- `MonitorFrameConfig.appInterval`：默认 `60s`。
- `MonitorFrameConfig.minSampleCountToEmit`：默认 `3` 或 `5`。
- `MonitorFrameConfig.minSampleCountForDiagnosis`：默认 `10` 或更高，低于该值只展示样本，不判定问题。

SDK 实施计划：

- `FrameWindowCollector` 在 Page window 开始时，根据配置启动 page interval timer。
- interval 到点后，如果当前窗口有足够样本，输出 `ui.frame.window`，`frame.window_phase = page.interval`。
- 输出后开启下一段 page frame chunk，继续使用同一个 `page.instance_id` 做页面实例归因，使用新的 `frame.window_id` 区分每个 interval chunk。
- 页面 covered/exit/background/dispose 时，结束当前未完成 chunk，phase 使用真实边界：`page.covered`、`page.exit`、`lifecycle.background` 或 `app.dispose`。
- App interval 同理，但默认关闭；App window 的强边界仍是 background/dispose。
- 如果 interval timer 到点但窗口没有样本，默认不 emit，避免空窗口污染数据。

core 字段计划：

- 复用 `ui.frame.window` 和现有 `frame.*` 字段。
- 确认协议常量包含 `page.interval`、`app.interval`。
- 可选增加 `frame.window_sequence`，用于同一页面实例下的 interval 排序；不是第一阶段必需字段。

测试计划：

- 模拟 page enter 后注入多批 `FrameTiming`，触发 interval，确认生成 `frame.window_phase = page.interval`。
- 同一 `page.instance_id` 下多个 interval chunk 不覆盖，`frame.window_id` 不重复。
- interval 后继续注入 timing，再 page exit，确认 exit window 独立生成。
- 样本数低于阈值时不 emit 或标记为 evidence-only。
- 关闭 interval 配置时行为回到当前路由/lifecycle 边界采集。

验收口径：

- 长停留页面不切路由也能看到中间段 `ui.frame.window`。
- 默认事件量受控，不按帧上报。
- interval 数据不会干扰 `ui.jank.sequence` 的问题判断。
- Workbench 可按 `page.instance_id` 串起同一页面实例下的多个 frame window。

### 未来扩展二：业务交互 frame window API（暂不开发）

目标：让业务主动标记 TabBar 切换、图表缩放、图表渲染、复杂滚动、筛选刷新等关键交互窗口，精准采集这些不切路由场景的帧表现。

适用场景：

- 页面不发生路由切换，但用户执行了明确的性能敏感交互。
- 自动 interval 能发现“某段时间慢”，但无法说明是哪个业务动作导致。
- 业务希望对某些局部交互建立稳定指标，例如 `chart.zoom`、`tab.switch`、`list.scroll`、`filter.apply`。

建议 API 草案：

```dart
final handle = FlutterMonitorSDK.startFrameWindow(
  name: 'chart.zoom',
  attributes: {'chart.type': 'line'},
);

await doZoom();

handle.finish();
```

便捷 API 草案：

```dart
await FlutterMonitorSDK.trackFrameWindow(
  name: 'tab.switch',
  action: () async {
    setState(() => currentTab = index);
    await nextFrameOrDelay();
  },
);
```

设计原则：

- 业务交互窗口复用 `ui.frame.window`，不是新增第二套事件模型。
- interaction window 可以和 page window 同时存在，同一批 `FrameTiming` 可同时进入两个聚合器。
- 限制并发 interaction window 数量，避免业务误用造成内存增长。
- 必须有 timeout，业务忘记 finish 时自动关闭并输出 `interaction.timeout` 或静默丢弃，具体策略后续评估。
- 交互名称必须有界、可聚合，不允许携带用户输入、URL query 或高基数字段。

core 字段计划：

- `frame.window_type` 增加 `interaction`。
- `frame.window_phase` 增加 `interaction.finish`、`interaction.cancel`、`interaction.timeout`。
- 可选新增：
  - `interaction.name`
  - `interaction.id`
  - `interaction.type`
- 自定义属性仍走 attributes/payload 的既有隐私和字段治理规则。

SDK 实施计划：

- `FrameWindowCollector` 支持维护多个 interaction window，并设置最大并发数，例如 4 个。
- start 时记录当前 route、当前 `page.instance_id`、traceId、interaction name 和开始时间。
- 每批 `FrameTiming` 到达时，同时聚合到 App window、Page window 和活跃 interaction windows。
- finish/cancel/timeout 时输出 `ui.frame.window`：
  - `frame.window_type = interaction`
  - `frame.window_phase = interaction.finish` / `interaction.cancel` / `interaction.timeout`
  - 附带当前 route 和可用的 `page.instance_id`
  - 附带 interaction name/id
- timeout 默认可先设为 10s 或 15s，后续根据真实业务调优。
- Reporter 只负责发标准 envelope，不直接管理 frame timing 细节。
- 继续由 `FrameTimingDispatcher` 统一接收 Flutter timings，避免多个 callback。

测试计划：

- start -> 注入 timing -> finish，确认生成 interaction frame window。
- interaction window 与 page window 同时存在时，两者都能收到同一批 timing，并分别聚合输出。
- 多个 interaction window 并发时互不覆盖。
- 超过最大并发数时拒绝新窗口或生成 SDK self-monitoring 事件。
- 忘记 finish 时 timeout 能关闭窗口，不长期持有状态。
- interaction name 和 attributes 经过隐私和字段规则约束。

验收口径：

- TabBar 切换、图表缩放、复杂滚动等不切路由操作能被单独归因。
- 交互窗口能回连到 session、route、page instance 和 trace。
- API 不影响现有页面/App frame window 和 jank sequence。
- 业务未接入该 API 时，默认 SDK 行为不变。

### 推荐推进顺序

- 第一优先级：保持当前基础路由/lifecycle 帧窗口稳定，继续用 raw JSON 验证字段和开销。
- 第二优先级：评估并实现长停留页面 `page.interval`，作为零业务接入成本的补充能力。
- 第三优先级：设计业务交互 frame window API，面向图表、TabBar、滚动和局部刷新等高价值场景。
- 不建议默认开启 10s 全局定时采集；应以低频、可配置、样本数门槛和关键交互主动标记为主。


## SDK 内存诊断扩展（待定）

- 当前 example 的内存按钮只负责制造真实分配、释放、卡顿和 lifecycle 场景，方便调试 SDK 自动采集；不应理解为业务侧公开伪造 `memory.growth` 或 `memory.leak.suspect` 的方式。
- 当前 SDK 默认启用基础 memory collector：初始化后采 `memory.sample`，`paused/hidden` 采样，`resumed` 和 jank sequence 后基于 `ProcessInfo.currentRss` 做增长判断；超过阈值生成 `memory.growth`，超过疑似阈值生成 `memory.leak.suspect`。
- 当前 `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、JVM heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据，没有参与 growth/leak 判断；后续可考虑在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 当前能力只能形成疑似线索，不是对象级泄漏检测器；不能自动指出具体 Dart 对象、Widget、页面实例、图片缓存、纹理或 native 资源根因。
- 后续如要增强业务定位能力，应优先评估页面级内存窗口、内存 delta 字段、样本来源说明和可选资源摘要，而不是在 Workbench 层推断泄漏类型。
