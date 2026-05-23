# Flutter Monitor SDK 文档

本目录正在围绕 SDK 的新方向重建：面向 Flutter 应用的链路化端侧监控。

## 优先阅读

- [背景与方向](background.md) - 项目背景、当前阶段，以及从孤立指标采集迁移到 session/trace 诊断模型的方向。

## 计划中的核心文档

这些文档应在大规模代码调整前逐步补齐：

- `event_model.md` - session、trace、span、breadcrumb、metric、error、log、resource、context、attributes 和 payload 模型。
- `server_protocol.md` - 服务端上报协议、schema version、鉴权、错误处理、兼容策略和重试预期。
- `devtools_integration.md` - Flutter Timeline 集成、DevTools extension 方案和本地 session 导出/导入工作流。
- `architecture.md` - 目标 SDK 架构，以及从当前实现迁移过去的路径。
- `roadmap.md` - 分阶段实施计划。

## 历史文档

以下文件来自 SDK 的早期阶段。它们仍可能包含有价值的实现笔记，尤其是卡顿检测和设备性能相关内容，但在新方向下重写前，应将它们视为历史参考：

- [优化指南](OPTIMIZATION_GUIDE.md)
- [设备性能等级说明](DEVICE_LEVEL_EXPLANATION.md)
- [性能测试指南](PERFORMANCE_TEST_GUIDE.md)
- [用户管理指南](USER_MANAGEMENT_GUIDE.md)
- [Flutter Monitor SDK](FLUTTER_MONITOR_SDK.md)
- [Flutter Monitor SDK 深度解析](Flutter监控SDK深度解析.md)
