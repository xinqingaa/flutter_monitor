import '../outputs/monitor_output.dart';
import '../modules/jank_monitor.dart';
import '../native/monitor_native_bridge.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// 监控队列配置。
///
/// 控制 SDK 内部 breadcrumb store 和部分 output 队列的容量上限，避免端侧
/// 因监控数据过多造成内存压力。
class MonitorQueueConfig {
  /// 最大队列大小。
  ///
  /// 当前用于 breadcrumb store 和部分 output 缓存的默认上限，避免端侧监控数据无限增长。
  final int maxQueueSize;

  /// 创建监控队列配置。
  const MonitorQueueConfig({this.maxQueueSize = 50});

  /// 默认队列配置。
  static const MonitorQueueConfig defaultConfig = MonitorQueueConfig();
}

/// Session 与生命周期配置。
///
/// 用于控制前后台切换时是否切分 session、是否生成热启动 trace，以及进入后台
/// 或退出前是否主动 flush。
class MonitorSessionConfig {
  /// 后台超过该时间后恢复前台会切分新 session。
  final Duration backgroundSessionTimeout;

  /// 是否监听 Flutter lifecycle。
  final bool enableLifecycleTracking;

  /// 是否在后台恢复时生成 app.hot_start trace。
  final bool enableHotStartTrace;

  /// 进入后台或退出时是否触发 flush。
  final bool flushOnBackground;

  /// 创建 session 与生命周期配置。
  const MonitorSessionConfig({
    this.backgroundSessionTimeout = const Duration(minutes: 30),
    this.enableLifecycleTracking = true,
    this.enableHotStartTrace = true,
    this.flushOnBackground = true,
  });

  /// 默认 session 配置。
  static const MonitorSessionConfig defaultConfig = MonitorSessionConfig();
}

/// Memory 采样配置。
///
/// 控制 Flutter/Dart 层 memory sample、growth 和 suspect leak 线索的采集频率
/// 与阈值。SDK 只上报可获得的事实，不把增长直接断言为确定泄漏。
class MonitorMemoryConfig {
  /// 是否启用 Flutter/Dart 层 memory 线索采集。
  final bool enabled;

  /// 同类采样最小间隔，避免页面/lifecycle 高频变化导致过量事件。
  final Duration minSampleInterval;

  /// 生成 `memory.growth` 所需的最小增长量，单位 MB。
  final num growthThresholdMb;

  /// 生成 `memory.leak.suspect` 所需的最小增长量，单位 MB。
  final num suspectLeakThresholdMb;

  /// 创建 memory 采样配置。
  const MonitorMemoryConfig({
    this.enabled = true,
    this.minSampleInterval = const Duration(seconds: 30),
    this.growthThresholdMb = 16,
    this.suspectLeakThresholdMb = 64,
  });

  /// 默认 memory 采样配置。
  static const MonitorMemoryConfig defaultConfig = MonitorMemoryConfig();
}

/// 帧窗口聚合配置。
///
/// 开启后 SDK 会按页面活动窗口聚合 frame stats，并在页面 trace 结束时合并
/// 页面帧表现证据。
class MonitorFrameConfig {
  /// 是否生成 App/page 帧窗口摘要指标。
  final bool enabled;

  /// 创建帧窗口聚合配置。
  const MonitorFrameConfig({this.enabled = true});

  /// 默认帧窗口聚合配置。
  static const MonitorFrameConfig defaultConfig = MonitorFrameConfig();
}

/// 业务交互性能观测配置。
///
/// 控制 `FlutterMonitorSDK.measure(...)` 的 common/stage 观测窗口、并发上限和
/// 样本门槛。该能力只旁路观察业务交互，不接管业务逻辑。
class MonitorInteractionConfig {
  /// 是否启用业务交互性能观测。
  final bool enabled;

  /// common 模式调用后自动观察的窗口。
  final Duration commonObserveFor;

  /// stage 模式 finish 后追加观察的 settle 窗口。
  final Duration stageSettleWindow;

  /// stage 模式未显式结束时的自动闭合超时。
  final Duration stageTimeout;

  /// 同时存在的最大交互窗口数。
  final int maxConcurrent;

  /// 输出 frame 摘要所需的最小样本数。
  final int minSampleCount;

  /// 创建业务交互性能观测配置。
  const MonitorInteractionConfig({
    this.enabled = true,
    this.commonObserveFor = const Duration(milliseconds: 1200),
    this.stageSettleWindow = const Duration(milliseconds: 250),
    this.stageTimeout = const Duration(seconds: 5),
    this.maxConcurrent = 4,
    this.minSampleCount = 3,
  });

  /// 默认业务交互性能观测配置。
  static const MonitorInteractionConfig defaultConfig =
      MonitorInteractionConfig();
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
/// `MonitorConfig` 只描述采集能力、输出、队列、native bridge 等 SDK 行为。
/// 用户、模块、发布、网络等运行时上下文请使用 `initialContext` 或
/// `FlutterMonitorSDK.setContext(...)`，不要塞进任意 custom map。
class MonitorConfig {
  /// 应用信息。
  ///
  /// 这些字段进入 `resource.app.*`，用于版本、环境、渠道等稳定维度聚合。
  final AppInfo appInfo;

  /// 是否启用 Flutter/Dart 错误自动采集。
  final bool enableErrorMonitor;

  /// 是否启用启动、页面和 route 性能采集。
  final bool enablePerformanceMonitor;

  /// 是否启用 UI 卡顿采集。
  final bool enableJankMonitor;

  /// 输出配置。
  ///
  /// 每个 output 都会收到经过 schema 校验和隐私过滤后的 envelope JSON。
  final List<MonitorOutput>? outputs;

  /// 卡顿监控配置，仅在 [enableJankMonitor] 为 true 时生效。
  final JankConfig? jankConfig;

  /// 队列配置。
  final MonitorQueueConfig? queueConfig;

  /// Session 与生命周期配置。
  final MonitorSessionConfig? sessionConfig;

  /// Memory 采样配置。
  final MonitorMemoryConfig? memoryConfig;

  /// Frame window 聚合配置。
  final MonitorFrameConfig? frameConfig;

  /// 业务交互性能观测配置。
  final MonitorInteractionConfig? interactionConfig;

  /// 可选 native bridge。未提供时 SDK 只保留 Flutter/Dart 层能力。
  final MonitorNativeBridge? nativeBridge;

  /// 创建 SDK 初始化配置。
  const MonitorConfig({
    required this.appInfo,
    this.enableErrorMonitor = true,
    this.enablePerformanceMonitor = true,
    this.enableJankMonitor = true,
    this.outputs,
    this.jankConfig,
    this.queueConfig,
    this.sessionConfig,
    this.memoryConfig,
    this.frameConfig,
    this.interactionConfig,
    this.nativeBridge,
  });

  /// 获取实际使用的输出列表。
  ///
  /// output 是 envelope 离开 SDK 的唯一出口，例如日志、HTTP 或自定义调试输出。
  List<MonitorOutput> get effectiveOutputs {
    if (outputs != null && outputs!.isNotEmpty) {
      return outputs!;
    }

    // 默认输出配置
    final defaultOutputs = <MonitorOutput>[];

    // 开发环境默认使用日志输出
    if (kDebugMode) {
      // 这里需要导入 LogMonitorOutput，暂时注释掉
      // defaultOutputs.add(LogMonitorOutput());
    }

    return defaultOutputs;
  }

  /// 获取实际使用的卡顿配置。
  JankConfig get effectiveJankConfig {
    if (!enableJankMonitor) {
      return JankConfig.defaultConfig();
    }
    return jankConfig ?? JankConfig.defaultConfig();
  }

  /// 获取实际使用的队列配置。
  MonitorQueueConfig get effectiveQueueConfig {
    return queueConfig ?? MonitorQueueConfig.defaultConfig;
  }

  /// 获取实际使用的 session 配置。
  MonitorSessionConfig get effectiveSessionConfig {
    return sessionConfig ?? MonitorSessionConfig.defaultConfig;
  }

  /// 获取实际使用的 memory 配置。
  MonitorMemoryConfig get effectiveMemoryConfig {
    return memoryConfig ?? MonitorMemoryConfig.defaultConfig;
  }

  /// 获取实际使用的帧窗口聚合配置。
  MonitorFrameConfig get effectiveFrameConfig {
    return frameConfig ?? MonitorFrameConfig.defaultConfig;
  }

  /// 获取实际使用的业务交互性能观测配置。
  MonitorInteractionConfig get effectiveInteractionConfig {
    return interactionConfig ?? MonitorInteractionConfig.defaultConfig;
  }
}
