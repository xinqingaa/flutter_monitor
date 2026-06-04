import '../outputs/monitor_output.dart';
import '../modules/jank_monitor.dart';
import '../native/monitor_native_bridge.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// 监控队列配置
class MonitorQueueConfig {
  /// 最大队列大小（默认 50）
  final int maxQueueSize;

  const MonitorQueueConfig({this.maxQueueSize = 50});

  /// 默认配置
  static const MonitorQueueConfig defaultConfig = MonitorQueueConfig();
}

/// Session 与生命周期配置
class MonitorSessionConfig {
  /// 后台超过该时间后恢复前台会切分新 session。
  final Duration backgroundSessionTimeout;

  /// 是否监听 Flutter lifecycle。
  final bool enableLifecycleTracking;

  /// 是否在后台恢复时生成 app.hot_start trace。
  final bool enableHotStartTrace;

  /// 进入后台或退出时是否触发 flush。
  final bool flushOnBackground;

  const MonitorSessionConfig({
    this.backgroundSessionTimeout = const Duration(minutes: 30),
    this.enableLifecycleTracking = true,
    this.enableHotStartTrace = true,
    this.flushOnBackground = true,
  });

  static const MonitorSessionConfig defaultConfig = MonitorSessionConfig();
}

/// Memory 采样配置。
class MonitorMemoryConfig {
  /// 是否启用 Flutter/Dart 层 memory 线索采集。
  final bool enabled;

  /// 同类采样最小间隔，避免页面/lifecycle 高频变化导致过量事件。
  final Duration minSampleInterval;

  /// 生成 memory.growth 所需的最小增长量。
  final num growthThresholdMb;

  /// 生成 memory.leak.suspect 所需的最小增长量。
  final num suspectLeakThresholdMb;

  const MonitorMemoryConfig({
    this.enabled = true,
    this.minSampleInterval = const Duration(seconds: 30),
    this.growthThresholdMb = 16,
    this.suspectLeakThresholdMb = 64,
  });

  static const MonitorMemoryConfig defaultConfig = MonitorMemoryConfig();
}

/// Frame window aggregation config.
class MonitorFrameConfig {
  /// Whether SDK emits app/page frame window summary metrics.
  final bool enabled;

  const MonitorFrameConfig({this.enabled = true});

  static const MonitorFrameConfig defaultConfig = MonitorFrameConfig();
}

/// 应用信息配置
class AppInfo {
  /// 应用标识（必填）
  final String appKey;

  /// 应用版本号
  final String? appVersion;

  /// 应用构建号
  final String? buildNumber;

  /// 应用包名
  final String? packageName;

  /// 应用名称
  final String? appName;

  /// 应用渠道
  final String? channel;

  /// 应用环境（dev/test/staging/production）
  final String? environment;

  const AppInfo({
    required this.appKey,
    this.appVersion,
    this.buildNumber,
    this.packageName,
    this.appName,
    this.channel,
    this.environment,
  });

  /// 从 package_info_plus 自动获取应用信息
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

/// 用户信息配置
class UserInfo {
  /// 用户ID
  final String? userId;

  /// 用户类型
  final String? userType;

  /// 用户标签
  final List<String>? userTags;

  /// 用户属性
  final Map<String, dynamic>? userProperties;

  const UserInfo({
    this.userId,
    this.userType,
    this.userTags,
    this.userProperties,
  });
}

/// 监控配置类 - 简化开发者使用
class MonitorConfig {
  /// 应用信息（必填）
  final AppInfo appInfo;

  /// 用户信息（可选）
  final UserInfo? userInfo;

  /// 监控开关配置
  final bool enableErrorMonitor;
  final bool enablePerformanceMonitor;
  final bool enableJankMonitor;

  /// 输出配置（可选，默认使用 LogMonitorOutput）
  final List<MonitorOutput>? outputs;

  /// 卡顿监控配置（仅在 enableJankMonitor 为 true 时生效）
  final JankConfig? jankConfig;

  /// 队列配置（可选）
  final MonitorQueueConfig? queueConfig;

  /// Session 与生命周期配置（可选）
  final MonitorSessionConfig? sessionConfig;

  /// Memory 采样配置（可选）
  final MonitorMemoryConfig? memoryConfig;

  /// Frame window 聚合配置（可选）
  final MonitorFrameConfig? frameConfig;

  /// 可选 native bridge。未提供时 SDK 只保留 Flutter/Dart 层能力。
  final MonitorNativeBridge? nativeBridge;

  /// 自定义全局附加数据
  final Map<String, dynamic>? customData;

  const MonitorConfig({
    required this.appInfo,
    this.userInfo,
    this.enableErrorMonitor = true,
    this.enablePerformanceMonitor = true,
    this.enableJankMonitor = true,
    this.outputs,
    this.jankConfig,
    this.queueConfig,
    this.sessionConfig,
    this.memoryConfig,
    this.frameConfig,
    this.nativeBridge,
    this.customData,
  });

  /// 获取实际使用的输出列表
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

  /// 获取实际使用的卡顿配置
  JankConfig get effectiveJankConfig {
    if (!enableJankMonitor) {
      return JankConfig.defaultConfig();
    }
    return jankConfig ?? JankConfig.defaultConfig();
  }

  /// 获取实际使用的队列配置
  MonitorQueueConfig get effectiveQueueConfig {
    return queueConfig ?? MonitorQueueConfig.defaultConfig;
  }

  /// 获取实际使用的 session 配置
  MonitorSessionConfig get effectiveSessionConfig {
    return sessionConfig ?? MonitorSessionConfig.defaultConfig;
  }

  /// 获取实际使用的 memory 配置
  MonitorMemoryConfig get effectiveMemoryConfig {
    return memoryConfig ?? MonitorMemoryConfig.defaultConfig;
  }

  MonitorFrameConfig get effectiveFrameConfig {
    return frameConfig ?? MonitorFrameConfig.defaultConfig;
  }
}
