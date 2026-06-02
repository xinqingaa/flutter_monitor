# TODO

## SDK 内存诊断扩展

- 当前 example 的内存按钮只负责制造真实分配、释放、卡顿和 lifecycle 场景，方便调试 SDK 自动采集；不应理解为业务侧公开伪造 `memory.growth` 或 `memory.leak.suspect` 的方式。
- 当前 SDK 默认启用基础 memory collector：初始化后采 `memory.sample`，`paused/hidden` 采样，`resumed` 和 jank sequence 后基于 `ProcessInfo.currentRss` 做增长判断；超过阈值生成 `memory.growth`，超过疑似阈值生成 `memory.leak.suspect`。
- 当前 `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、JVM heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据，没有参与 growth/leak 判断；后续可考虑在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 当前能力只能形成疑似线索，不是对象级泄漏检测器；不能自动指出具体 Dart 对象、Widget、页面实例、图片缓存、纹理或 native 资源根因。
- 后续如要增强业务定位能力，应优先评估页面级内存窗口、内存 delta 字段、样本来源说明和可选资源摘要，而不是在 Workbench 层推断泄漏类型。
