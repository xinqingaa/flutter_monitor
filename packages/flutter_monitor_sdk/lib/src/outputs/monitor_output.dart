import 'dart:async';
/// 监控事件输出器的抽象基类。
/// 负责将格式化后的监控事件发送到某个目的地（如服务器、控制台等）。
abstract class MonitorOutput {
  /// 初始化输出器，例如启动定时器。
  void init() {}

  /// 添加一个事件。输出器可以决定是立即发送还是缓存。
  void add(Map<String, dynamic> event);

  /// 强制将所有缓存的事件发送出去。
  Future<void> flush({bool isAppExiting = false});

  /// 销毁并清理资源，例如取消定时器。
  void dispose() {}
}
