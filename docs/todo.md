# TODO

本文件只记录尚未开始的 Workbench 适配和后续扩展。SDK 当前已经采用主链路方案：启动性能证据写入 `app.cold_start` / `app.hot_start` trace end，页面性能证据写入 `page.visit` trace end。

## 当前 SDK 主链路方案

### 启动性能证据

- 冷启动和热启动分别由 `app.cold_start`、`app.hot_start` 表达，二者是互斥关系。
- 启动首帧或恢复首帧闭合 trace 时，同时写入帧摘要字段：`frame.sample_count`、`frame.slow_count`、`frame.dropped_count`、`frame.refresh_rate`、`frame.max_ms`、`frame.avg_ms`、`frame.budget_ms`、`frame.fps`、`frame.stability`、`frame.p50_ms`、`frame.p90_ms`、`frame.p99_ms`。
- 启动 trace end 同时写入 RSS 证据：`memory.start_rss_mb`、`memory.end_rss_mb`、`memory.delta_rss_mb`。
- SDK 只在内存中聚合启动帧窗口，启动性能证据统一落在启动 trace end。

### 页面性能证据

- 页面实例由 `page.instance_id` 区分，同一个 `routeName` 连续多次 push 时必须生成不同实例。
- 页面 trace 由 `page.visit` 表达，页面首帧由 `page.first_frame` / `page.load` 表达。
- 页面关闭或被最终结束时，`page.visit` trace end 写入同一页面实例累计到的帧摘要字段。
- 页面进入和退出时读取 RSS，`page.visit` trace end 写入 `memory.enter_rss_mb`、`memory.exit_rss_mb`、`memory.delta_rss_mb`。
- 页面切换性能证据统一落在页面 trace end。
- `page.view` breadcrumb、`route.push` / `route.pop` span 继续作为路径还原和路由阶段证据；Workbench 展示时应以 `page.visit` 作为页面主链路。

### 性能开销约束

- Flutter frame timing callback 中只做有界聚合：计数、总耗时、最大值、慢帧数、掉帧估算和少量分位数样本。
- 路由回调路径只记录时间点、页面实例和 RSS 快照，不等待 IO，不主动触发 GC。
- 内存采样使用系统可得的当前进程 RSS；缺失时省略字段，不伪造数值。
- SDK 不依赖 native plugin；未注入 `FlutterMonitorNative` 时，Flutter-only 链路仍应完整工作。

## Workbench 适配 TODO

- Session timeline 以 `app.cold_start` / `app.hot_start`、`page.visit`、`http.client`、`ui.jank.sequence`、error、lifecycle 为主轴展示。
- 启动详情直接读取启动 trace end 的 `frame.*` 和 `memory.start/end/delta_rss_mb`。
- 页面详情直接读取 `page.visit` trace end 的 `frame.*` 和 `memory.enter/exit/delta_rss_mb`。
- 同 route 多实例展示必须使用 `page.instance_id`，不能只按 routeName 合并。
- Raw JSON 回查应能证明页面切换性能证据已经写入对应 `page.visit` trace end。
- Problems 只把 `ui.jank.sequence`、error、memory pressure/growth/suspect 等问题事件作为问题入口；普通启动/页面性能摘要作为 trace 详情展示。

## 未来扩展一：长停留页面性能切片

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

## 未来扩展二：业务交互性能窗口

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

## 内存诊断扩展 TODO

- 当前 example 的内存按钮只负责制造真实分配、释放、卡顿和 lifecycle 场景，方便调试 SDK 自动采集。
- 当前 SDK 默认启用基础 memory collector：初始化后采 `memory.sample`，`paused/hidden` 采样，`resumed` 和 jank sequence 后基于 `ProcessInfo.currentRss` 做增长判断。
- `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据；后续可在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 当前能力只能形成疑似线索，不是对象级泄漏检测器；不能自动指出具体 Dart 对象、Widget、页面实例、图片缓存、纹理或 native 资源根因。
