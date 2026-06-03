# TODO

## SDK 内存诊断扩展

- 当前 example 的内存按钮只负责制造真实分配、释放、卡顿和 lifecycle 场景，方便调试 SDK 自动采集；不应理解为业务侧公开伪造 `memory.growth` 或 `memory.leak.suspect` 的方式。
- 当前 SDK 默认启用基础 memory collector：初始化后采 `memory.sample`，`paused/hidden` 采样，`resumed` 和 jank sequence 后基于 `ProcessInfo.currentRss` 做增长判断；超过阈值生成 `memory.growth`，超过疑似阈值生成 `memory.leak.suspect`。
- 当前 `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、JVM heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据，没有参与 growth/leak 判断；后续可考虑在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 当前能力只能形成疑似线索，不是对象级泄漏检测器；不能自动指出具体 Dart 对象、Widget、页面实例、图片缓存、纹理或 native 资源根因。
- 后续如要增强业务定位能力，应优先评估页面级内存窗口、内存 delta 字段、样本来源说明和可选资源摘要，而不是在 Workbench 层推断泄漏类型。

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

### 目标

- 当前 SDK 只在连续慢帧达到阈值时生成 `ui.jank.sequence`，缺少正常情况下的 FPS、稳定性、分位数和页面维度帧表现。
- 新增低频聚合型帧窗口事件，描述页面和应用在正常运行时的帧表现。
- 帧窗口不逐帧上报，只在内存中聚合后输出摘要，避免高频事件和性能开销。
- 设备层只表达稳定能力，例如 `resource.device.refreshRate` 和 `resource.device.deviceTier`；帧表现主要落在页面和应用窗口。

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
- 长停留页面每 10s 或 30s flush 一个 interval 摘要，flush 后继续累计下一段窗口。
- App frame window 每 30s 或 lifecycle background 时 flush。
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
  - `pageWindowEnabled`
  - `appWindowEnabled`
  - `pageInterval`
  - `appInterval`
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
