# TODO

## SDK 内存诊断扩展

- 当前 `memory.growth` 和 `memory.leak.suspect` 主要基于进程 RSS 增长判断，能定位到 session、route、module、scene 和 breadcrumbs，但不能区分 Dart heap、native heap、JVM heap、图片缓存、纹理或 mmap 等具体来源。
- `native.memory.sample` 当前是旁路证据，没有参与 growth/leak 判断；后续可考虑在 native 样本充足时补充 native delta 或独立 native growth 线索。
- 后续如要增强业务定位能力，应优先评估页面级内存窗口、内存 delta 字段、样本来源说明和可选资源摘要，而不是在 Workbench 层推断泄漏类型。
