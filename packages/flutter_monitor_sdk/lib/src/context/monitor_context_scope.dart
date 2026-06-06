/// 可清理的运行时上下文范围。
///
/// `FlutterMonitorSDK.clearContext` 通过 scope 精准清理后续事件携带的
/// `context.*` 字段，避免用户登出、模块切换或网络状态失效后继续污染链路。
enum MonitorContextScope {
  /// 用户上下文，对应 `context.user.*`。
  user,

  /// 模块上下文，对应 `context.module.*`。
  module,

  /// 发布和灰度上下文，对应 `context.release.*`。
  release,

  /// 网络上下文，对应 `context.network.*`。
  network,
}
