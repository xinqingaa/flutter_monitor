import 'dart:async';

import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// 监控事件输出器的抽象基类。
///
/// output 是 `EventEnvelope` 离开 SDK 的唯一出口。pipeline 会先完成 schema
/// 校验和隐私过滤，再把 envelope 的 JSON map 交给 output。
///
/// 实现方可以把事件发送到服务端、写入文件、打印日志或交给本地 Workbench。
abstract class MonitorOutput {
  /// SDK 内部自监控回调。
  ///
  /// output 发生 flush、retry、drop、store 降级等可靠性事件时通过该回调回灌
  /// 到 pipeline，最终仍以统一 `sdk.*` envelope 输出。
  void Function(OutputHealthEvent event)? onHealthEvent;

  /// 初始化输出器。
  ///
  /// 可在这里启动定时 flush、打开文件句柄或初始化网络资源。
  void init() {}

  /// 添加一个已完成隐私过滤的事件。
  ///
  /// output 可以选择立即发送，也可以先缓存，等待 [flush] 批量处理。
  void add(Map<String, dynamic> event);

  /// 强制处理所有缓存事件。
  ///
  /// [isAppExiting] 为 true 时表示 App 正在退出，output 应采用尽力发送策略，
  /// 但仍不能阻塞或影响业务主流程。
  Future<void> flush({bool isAppExiting = false});

  /// 销毁并清理资源，例如取消定时器、关闭 client 或文件句柄。
  void dispose() {}
}

class OutputHealthEvent {
  const OutputHealthEvent({
    required this.name,
    this.level = EventLevel.info,
    this.status = EventStatus.ok,
    this.priority = EventPriority.normal,
    this.attributes = const <String, Object?>{},
    this.payload = const <String, Object?>{},
  });

  final String name;
  final EventLevel level;
  final EventStatus status;
  final EventPriority priority;
  final Map<String, Object?> attributes;
  final Map<String, Object?> payload;
}
