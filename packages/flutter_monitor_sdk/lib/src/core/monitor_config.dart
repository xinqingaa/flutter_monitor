import '../outputs/log_monitor_output.dart';
import '../native/monitor_native_bridge.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// SDK 输出模式。
///
/// 用来决定事件输出到哪里，以及是否启用可靠投递策略。普通接入方通常只需要
/// 在 [consoleOnly]、[localLive] 和 [production] 中选一个，不需要手动组合
/// output、队列、batch、retry 或采样策略。
class MonitorMode {
  const MonitorMode._({
    required this.name,
    this.endpoint,
    this.authTokenProvider,
    this.productionPolicy = MonitorProductionPolicy.defaultPolicy,
    this.logMode = LogMonitorOutputMode.compact,
  });

  /// wire value，进入 `sdk.output.mode`。
  final String name;

  /// local live 或 production 的 batch 上报地址。
  final Uri? endpoint;

  /// 可选鉴权 token provider，production delivery 发送前调用。
  final Future<String?> Function()? authTokenProvider;

  /// production/local live 的可靠性策略。普通接入方通常不需要覆盖。
  final MonitorProductionPolicy productionPolicy;

  /// consoleOnly 下的日志输出模式。
  final LogMonitorOutputMode logMode;

  /// 本地开发模式。
  ///
  /// 只输出 console log，不启用本地 Workbench 或生产离线队列。
  ///
  /// 参数：
  /// - [logMode]：控制 console 输出格式，默认使用 compact log。
  factory MonitorMode.consoleOnly({
    LogMonitorOutputMode logMode = LogMonitorOutputMode.compact,
  }) {
    return MonitorMode._(name: SdkOutputModes.consoleOnly, logMode: logMode);
  }

  /// QA 或本地 Workbench live 模式。
  ///
  /// 将完整 `EventEnvelope` 小 batch 写入本地 Workbench service，便于实时查看
  /// session timeline、raw JSON 和页面/API/卡顿等链路。
  ///
  /// 参数：
  /// - [endpoint]：Workbench service events API，默认是本机 `3700` 端口。
  /// - [policy]：live 调试用的 flush、batch 和采样策略，通常不需要覆盖。
  factory MonitorMode.localLive({
    Uri? endpoint,
    MonitorProductionPolicy policy = MonitorProductionPolicy.localLive,
  }) {
    return MonitorMode._(
      name: SdkOutputModes.localLive,
      endpoint:
          endpoint ?? Uri.parse('http://localhost:3700/api/monitor/v1/events'),
      productionPolicy: policy,
    );
  }

  /// 真实 App 灰度或线上模式。
  ///
  /// 使用 SDK 内置可靠上报策略，包括离线队列、batch、重试、采样、限流和
  /// output self-monitoring。
  ///
  /// 参数：
  /// - [endpoint]：生产监控服务端 events API。
  /// - [authToken]：发送前获取鉴权 token 的回调，可为空。
  /// - [policy]：生产投递策略，默认适合多数 App；灰度期可使用
  ///   [MonitorProductionPolicy.conservative]。
  factory MonitorMode.production({
    required Uri endpoint,
    Future<String?> Function()? authToken,
    MonitorProductionPolicy policy = MonitorProductionPolicy.defaultPolicy,
  }) {
    return MonitorMode._(
      name: SdkOutputModes.production,
      endpoint: endpoint,
      authTokenProvider: authToken,
      productionPolicy: policy,
    );
  }
}

/// 输出可靠性策略。
///
/// 用于 [MonitorMode.localLive] 和 [MonitorMode.production]，只控制事件如何
/// 被缓存、批量发送、重试、采样和限流，不控制端上采集阈值。普通业务一般使用
/// SDK 默认值；需要控制网络、磁盘或灰度成本时再覆盖。
class MonitorProductionPolicy {
  /// 离线队列最多保留的事件数，超过后按优先级和时间淘汰。
  final int maxQueueEvents;

  /// 离线队列最多占用的字节数，避免监控数据无限增长。
  final int maxQueueBytes;

  /// 单个 envelope 的最大字节数，超限事件会被丢弃并产生 SDK 自监控事件。
  final int maxEventBytes;

  /// 单次 flush 最多发送的事件数。
  final int maxBatchEvents;

  /// 单次 flush 最多发送的字节数。
  final int maxBatchBytes;

  /// 常规后台 flush 间隔。
  final Duration flushInterval;

  /// 新事件入队后的快速 flush 延迟，用于兼顾实时性和批量效率。
  final Duration quickFlushDelay;

  /// 单次上报请求超时时间。
  final Duration requestTimeout;

  /// 同一批事件最多重试次数，超过后丢弃该 batch 并记录 `sdk.queue.drop`。
  final int maxRetryAttempts;

  /// 重试退避的基础延迟。
  final Duration retryBaseDelay;

  /// 重试退避的最大延迟。
  final Duration retryMaxDelay;

  /// 事件在离线队列中的最长保留时间。
  final Duration maxEventAge;

  /// 默认采样率，作用于未被更具体规则覆盖的普通事件。
  final double defaultSampleRate;

  /// 低优先级事件采样率，用于控制噪声和网络成本。
  final double lowPrioritySampleRate;

  /// 成功 HTTP 事件采样率，失败 HTTP 不受该字段影响。
  final double successfulHttpSampleRate;

  /// memory sample 采样率，growth、pressure 等关键内存事件不按普通 sample 处理。
  final double memorySampleRate;

  /// 单分钟最多接收的业务 track 事件数，超过后丢弃并记录 SDK 自监控。
  final int maxTrackEventsPerMinute;

  /// App 进入后台或退出时是否触发 flush。
  final bool flushOnBackground;

  /// 创建输出可靠性策略。
  ///
  /// 参数分组：
  /// - 队列容量：[maxQueueEvents]、[maxQueueBytes]、[maxEventBytes]。
  /// - 批量发送：[maxBatchEvents]、[maxBatchBytes]、[flushInterval]、
  ///   [quickFlushDelay]、[flushOnBackground]。
  /// - 请求与重试：[requestTimeout]、[maxRetryAttempts]、
  ///   [retryBaseDelay]、[retryMaxDelay]、[maxEventAge]。
  /// - 成本控制：[defaultSampleRate]、[lowPrioritySampleRate]、
  ///   [successfulHttpSampleRate]、[memorySampleRate]、
  ///   [maxTrackEventsPerMinute]。
  const MonitorProductionPolicy({
    this.maxQueueEvents = 5000,
    this.maxQueueBytes = 8 * 1024 * 1024,
    this.maxEventBytes = 128 * 1024,
    this.maxBatchEvents = 50,
    this.maxBatchBytes = 512 * 1024,
    this.flushInterval = const Duration(seconds: 15),
    this.quickFlushDelay = const Duration(seconds: 2),
    this.requestTimeout = const Duration(seconds: 8),
    this.maxRetryAttempts = 8,
    this.retryBaseDelay = const Duration(seconds: 2),
    this.retryMaxDelay = const Duration(minutes: 5),
    this.maxEventAge = const Duration(days: 3),
    this.defaultSampleRate = 1.0,
    this.lowPrioritySampleRate = 0.2,
    this.successfulHttpSampleRate = 0.2,
    this.memorySampleRate = 0.1,
    this.maxTrackEventsPerMinute = 120,
    this.flushOnBackground = true,
  });

  /// 真实 App 默认策略：尽量保留关键事件，同时限制磁盘、网络和重试开销。
  static const defaultPolicy = MonitorProductionPolicy();

  /// QA/Workbench 策略：更短 flush 间隔，更小 batch，便于近实时查看。
  static const localLive = MonitorProductionPolicy(
    maxQueueEvents: 1000,
    maxQueueBytes: 2 * 1024 * 1024,
    maxBatchEvents: 20,
    maxBatchBytes: 256 * 1024,
    flushInterval: Duration(seconds: 3),
    quickFlushDelay: Duration(milliseconds: 500),
    requestTimeout: Duration(seconds: 5),
    maxEventAge: Duration(hours: 12),
    lowPrioritySampleRate: 1.0,
    successfulHttpSampleRate: 1.0,
    memorySampleRate: 1.0,
  );

  /// 更保守策略：适合首轮灰度或弱网风险较高的 App。
  factory MonitorProductionPolicy.conservative() {
    return const MonitorProductionPolicy(
      maxQueueEvents: 2000,
      maxQueueBytes: 4 * 1024 * 1024,
      maxBatchEvents: 30,
      maxBatchBytes: 256 * 1024,
      flushInterval: Duration(seconds: 30),
      quickFlushDelay: Duration(seconds: 3),
      lowPrioritySampleRate: 0.1,
      successfulHttpSampleRate: 0.1,
      memorySampleRate: 0.05,
      maxTrackEventsPerMinute: 60,
    );
  }
}

/// Session 配置。
///
/// 用于控制用户会话边界。Flutter lifecycle 监听和 hot start trace 是 SDK 核心
/// 链路能力，默认启用，不作为普通业务开关暴露。
class MonitorSessionConfig {
  /// 后台超过该时间后恢复前台会切分新 session。
  final Duration backgroundSessionTimeout;

  /// 创建 Session 配置。
  ///
  /// 参数：
  /// - [backgroundSessionTimeout]：App 进入后台超过该时长后再回前台，会开启
  ///   新 session；短时间切后台恢复仍归属同一 session。
  const MonitorSessionConfig({
    this.backgroundSessionTimeout = const Duration(minutes: 30),
  });

  /// 默认 session 配置。
  static const MonitorSessionConfig defaultConfig = MonitorSessionConfig();
}

/// Memory 采样配置。
///
/// 控制 Flutter/Dart 层 memory sample、growth 和 suspect leak 线索的采集频率
/// 与阈值。SDK 只上报可获得的事实，不把增长直接断言为确定泄漏。
class MonitorMemoryConfig {
  /// 同类采样最小间隔，避免页面/lifecycle 高频变化导致过量事件。
  final Duration sampleInterval;

  /// 生成 `memory.growth` 所需的最小增长量，单位 MB。
  final num growthThresholdMb;

  /// 生成 `memory.leak.suspect` 所需的最小增长量，单位 MB。
  final num suspectLeakThresholdMb;

  /// 创建 Memory 采样配置。
  ///
  /// 参数：
  /// - [sampleInterval]：同类 memory sample 的最小间隔。
  /// - [growthThresholdMb]：相邻样本增长超过该值时生成 `memory.growth`。
  /// - [suspectLeakThresholdMb]：增长超过该值时额外生成
  ///   `memory.leak.suspect` 线索。
  const MonitorMemoryConfig({
    this.sampleInterval = const Duration(seconds: 30),
    this.growthThresholdMb = 16,
    this.suspectLeakThresholdMb = 64,
  });

  /// 默认 memory 采样配置。
  static const MonitorMemoryConfig defaultConfig = MonitorMemoryConfig();
}

/// 性能采集配置。
///
/// 聚合三类性能能力：页面 frame window 摘要、UI 卡顿识别和
/// `FlutterMonitorSDK.measure(...)` 业务交互性能观测。默认配置适合多数 App，
/// 需要更敏感或更宽松时优先使用 [strict] / [lenient]。
class MonitorPerformanceConfig {
  /// 单帧卡顿阈值乘数，实际阈值为当前刷新率 frame budget 乘以该值。
  final double jankFrameTimeMultiplier;

  /// 连续卡顿帧数阈值，达到该数量后生成一次 jank sequence。
  final int consecutiveJankThreshold;

  /// 抖动容忍时间，单位毫秒，用于过滤设备正常调度波动。
  final double jitterToleranceMs;

  /// 卡顿事件防抖窗口，避免短时间内重复上报同类卡顿。
  final Duration jankDebounce;

  /// 是否启用基于刷新率的自适应卡顿阈值。
  final bool adaptiveJankThresholds;

  /// 是否采集页面级 frame window 摘要。
  final bool collectPageFrameStats;

  /// common 模式调用后自动观察的交互窗口。
  final Duration commonObserveFor;

  /// stage 模式 finish 后追加观察的交互 settle 窗口。
  final Duration stageSettleWindow;

  /// stage 模式未显式结束时的交互自动闭合超时。
  final Duration interactionTimeout;

  /// 同时存在的最大交互观测窗口数。
  final int maxConcurrentInteractions;

  /// 交互事件输出 frame 摘要所需的最小样本数。
  final int interactionMinSampleCount;

  /// 创建性能采集配置。
  ///
  /// 参数分组：
  /// - 卡顿识别：[jankFrameTimeMultiplier]、[consecutiveJankThreshold]、
  ///   [jitterToleranceMs]、[jankDebounce]、[adaptiveJankThresholds]。
  /// - 页面帧摘要：[collectPageFrameStats]。
  /// - 交互性能：[commonObserveFor]、[stageSettleWindow]、
  ///   [interactionTimeout]、[maxConcurrentInteractions]、
  ///   [interactionMinSampleCount]。
  const MonitorPerformanceConfig({
    this.jankFrameTimeMultiplier = 2.5,
    this.consecutiveJankThreshold = 4,
    this.jitterToleranceMs = 8.0,
    this.jankDebounce = const Duration(milliseconds: 1000),
    this.adaptiveJankThresholds = true,
    this.collectPageFrameStats = true,
    this.commonObserveFor = const Duration(milliseconds: 1200),
    this.stageSettleWindow = const Duration(milliseconds: 250),
    this.interactionTimeout = const Duration(seconds: 5),
    this.maxConcurrentInteractions = 4,
    this.interactionMinSampleCount = 3,
  });

  /// 默认配置，适合多数设备和业务场景。
  static const MonitorPerformanceConfig defaultConfig =
      MonitorPerformanceConfig();

  /// 严格配置，适合高端设备或更敏感的性能告警。
  factory MonitorPerformanceConfig.strict() {
    return const MonitorPerformanceConfig(
      jankFrameTimeMultiplier: 2.0,
      consecutiveJankThreshold: 3,
      jitterToleranceMs: 5.0,
      jankDebounce: Duration(milliseconds: 500),
    );
  }

  /// 宽松配置，适合低端设备或噪声较大的测试环境。
  factory MonitorPerformanceConfig.lenient() {
    return const MonitorPerformanceConfig(
      jankFrameTimeMultiplier: 3.0,
      consecutiveJankThreshold: 5,
      jitterToleranceMs: 12.0,
      jankDebounce: Duration(milliseconds: 2000),
    );
  }
}

/// 应用信息配置。
///
/// 这些字段会进入 `resource.app.*`，属于相对稳定的资源维度，适合用于版本、
/// 环境、渠道和包名维度的检索与聚合。
class AppInfo {
  /// 应用标识。
  ///
  /// 会进入 `resource.app.appKey`，应在同一业务 App 内保持稳定。
  final String appKey;

  /// 应用版本号，进入 `resource.app.appVersion`。
  final String? appVersion;

  /// 应用构建号，进入 `resource.app.buildNumber`。
  final String? buildNumber;

  /// 应用包名，进入 `resource.app.packageName`。
  final String? packageName;

  /// 应用名称，进入 `resource.app.appName`。
  final String? appName;

  /// 应用渠道，进入 `resource.app.channel`。
  final String? channel;

  /// 应用环境，进入 `resource.app.environment`。
  ///
  /// 推荐使用 `dev`、`test`、`staging`、`production` 等稳定值。
  final String? environment;

  /// 创建应用信息配置。
  const AppInfo({
    required this.appKey,
    this.appVersion,
    this.buildNumber,
    this.packageName,
    this.appName,
    this.channel,
    this.environment,
  });

  /// 从 package_info_plus 自动获取应用信息。
  ///
  /// [appKey] 仍需业务显式传入；[channel] 和 [environment] 可用于补充渠道与环境。
  static Future<AppInfo> fromPackageInfo({
    required String appKey,
    String? channel,
    String? environment,
  }) async {
    final packageInfo = await PackageInfo.fromPlatform();
    try {
      // 这里可以集成 package_info_plus 来自动获取应用信息
      return AppInfo(
        appKey: appKey,
        appVersion: packageInfo.version,
        buildNumber: packageInfo.buildNumber,
        packageName: packageInfo.packageName,
        appName: packageInfo.appName,
        channel: channel,
        environment: environment,
      );
    } catch (e) {
      // 如果获取失败，返回基础信息
      return AppInfo(appKey: appKey);
    }
  }
}

/// SDK 初始化配置。
///
/// 传给 `FlutterMonitorSDK.init(...)` 的主配置，只描述 App 信息、输出模式、
/// 采集策略和 native bridge。用户、模块、发布、网络等运行时上下文请使用
/// `initialContext` 或 `FlutterMonitorSDK.setContext(...)`。
class MonitorConfig {
  static const int defaultBreadcrumbCapacity = 50;

  /// 应用信息。
  ///
  /// 这些字段进入 `resource.app.*`，用于版本、环境、渠道等稳定维度聚合。
  final AppInfo appInfo;

  /// 输出模式。
  ///
  /// 普通接入方只需要选择 `consoleOnly`、`localLive` 或 `production`。
  /// SDK 会根据模式选择日志、本地 Workbench 或生产可靠上报策略。
  final MonitorMode mode;

  /// Session 与生命周期配置。
  final MonitorSessionConfig? session;

  /// Memory 采样配置。
  final MonitorMemoryConfig? memory;

  /// 性能采集配置。
  final MonitorPerformanceConfig? performance;

  /// 可选 native bridge。未提供时 SDK 只保留 Flutter/Dart 层能力。
  final MonitorNativeBridge? nativeBridge;

  /// 创建 SDK 初始化配置。
  ///
  /// 常用写法：
  /// ```dart
  /// MonitorConfig(
  ///   appInfo: AppInfo(appKey: 'my_app'),
  ///   mode: MonitorMode.production(endpoint: Uri.parse(serverUrl)),
  /// )
  /// ```
  ///
  /// 参数：
  /// - [appInfo]：App 稳定资源信息，会进入 `resource.app.*`。
  /// - [mode]：输出模式，决定 console、Workbench live 或生产上报。
  /// - [session]：session 边界配置；不传时后台 30 分钟切新 session。
  /// - [performance]：卡顿、页面 frame stats 和交互性能配置。
  /// - [memory]：memory sample、growth 和 suspect leak 线索配置。
  /// - [nativeBridge]：可选 native 增强信号入口；不传时保留 Flutter-only 能力。
  const MonitorConfig({
    required this.appInfo,
    this.mode = const MonitorMode._(name: SdkOutputModes.consoleOnly),
    this.session,
    this.memory,
    this.performance,
    this.nativeBridge,
  });

  /// 获取实际使用的 session 配置。
  MonitorSessionConfig get effectiveSessionConfig {
    return session ?? MonitorSessionConfig.defaultConfig;
  }

  /// 获取实际使用的 memory 配置。
  MonitorMemoryConfig get effectiveMemoryConfig {
    return memory ?? MonitorMemoryConfig.defaultConfig;
  }

  /// 获取实际使用的性能采集配置。
  MonitorPerformanceConfig get effectivePerformanceConfig {
    return performance ?? MonitorPerformanceConfig.defaultConfig;
  }
}
