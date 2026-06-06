import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// 单次事件构建时使用的 context/resource 快照。
///
/// Pipeline 捕获事件时会先从 `ContextManager` 得到该对象，再交给
/// `EnvelopeBuilder` 写入 `EventEnvelope`。它表示“事件发生当下”的上下文，
/// 后续运行时 context 再变化也不会反向修改已经发出的 envelope。
class ContextSnapshot {
  const ContextSnapshot({
    required this.resource,
    required this.context,
    this.customData,
    this.userProperties,
  });

  /// 稳定资源信息，例如 SDK、App、设备和运行时。
  final MonitorResource resource;

  /// 动态上下文信息，例如用户、路由、模块、网络、发布、生命周期和 native。
  final MonitorContext context;

  /// 内部 legacy 自定义数据快照。
  ///
  /// 当前不会作为 public API 推荐，也不会默认提升为 attributes。
  final Map<String, Object?>? customData;

  /// 内部 legacy 用户属性快照。
  final Map<String, Object?>? userProperties;
}
