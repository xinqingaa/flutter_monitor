/// 初始化期上下文。
///
/// 这些字段会在 SDK 发出 `app.cold_start`、`sdk.init`、首个 memory sample 等
/// bootstrap 事件之前写入 context snapshot，适合放 App 启动时已经知道的
/// 用户、模块、发布和网络上下文。
///
/// 不要把业务动作详情、订单号、请求体、token、cookie 等放在这里。业务动作详情
/// 应使用 `FlutterMonitorSDK.track(properties: ...)`，敏感数据仍会经过隐私规则。
class MonitorInitialContext {
  /// 创建初始化期上下文。
  ///
  /// 只填写启动时已经确定的稳定上下文；后续登录、模块切换、灰度变化或网络变化
  /// 应继续调用 `FlutterMonitorSDK.setContext` 更新。
  const MonitorInitialContext({
    this.userId,
    this.userType,
    this.userTags,
    this.cohort,
    this.moduleName,
    this.moduleScene,
    this.releaseId,
    this.featureFlags,
    this.experiments,
    this.networkType,
    this.isWeakNetwork,
  });

  /// 用户 ID，映射到 `context.user.userId`。
  ///
  /// 用于 QA 或用户维度检索 session。不要传手机号、邮箱等未脱敏标识。
  final String? userId;

  /// 用户类型，映射到 `context.user.userType`，例如 `qa`、`guest`、`premium`。
  final String? userType;

  /// 用户标签，映射到 `context.user.userTags`。
  ///
  /// 标签应保持低基数和可聚合，不要包含动态 ID。
  final List<String>? userTags;

  /// 用户分群，映射到 `context.user.cohort`。
  final String? cohort;

  /// 当前业务模块名，映射到 `context.module.name`。
  final String? moduleName;

  /// 当前业务场景，映射到 `context.module.scene`。
  final String? moduleScene;

  /// 发布批次或 release 标识，映射到 `context.release.releaseId`。
  final String? releaseId;

  /// 启动时已知的 feature flags，映射到 `context.release.featureFlags`。
  final List<String>? featureFlags;

  /// 启动时已知的实验分组，映射到 `context.release.experiments`。
  final Map<String, Object?>? experiments;

  /// 当前网络类型，映射到 `context.network.type`，例如 `wifi`、`cellular`。
  final String? networkType;

  /// 当前是否弱网，映射到 `context.network.isWeakNetwork`。
  final bool? isWeakNetwork;

  /// 当前对象是否没有任何有效上下文字段。
  ///
  /// 内部初始化链路用它跳过空上下文，避免制造空 context scope。
  bool get isEmpty =>
      userId == null &&
      userType == null &&
      userTags == null &&
      cohort == null &&
      moduleName == null &&
      moduleScene == null &&
      releaseId == null &&
      featureFlags == null &&
      experiments == null &&
      networkType == null &&
      isWeakNetwork == null;
}
