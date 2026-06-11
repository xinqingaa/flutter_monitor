import 'dart:math';

import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

/// 性能监控工具方法集合。
///
/// 这些方法用于从 frame timing 数据中计算 FPS、百分位、稳定性和设备性能等级，
/// 可用于示例、调试或未来自适应阈值逻辑。它们本身不发事件。
class PerformanceUtils {
  /// 根据一组 frame duration 计算平均 FPS。
  static double calculateFPS(List<Duration> frameDurations) {
    if (frameDurations.isEmpty) return 0.0;

    final totalDuration = frameDurations
        .map((d) => d.inMicroseconds)
        .reduce((a, b) => a + b);

    final averageFrameTime = totalDuration / frameDurations.length;
    return 1000000 / averageFrameTime; // 转换为FPS
  }

  /// 根据帧耗时均值、方差和样本数量估算设备性能等级。
  static DevicePerformanceLevel detectDevicePerformance({
    required double averageFrameTime,
    required double frameTimeVariance,
    required int recentFrameCount,
  }) {
    // 基于平均帧时间和方差判断设备性能
    if (averageFrameTime < 16.0 && frameTimeVariance < 5.0) {
      return DevicePerformanceLevel.high;
    } else if (averageFrameTime < 20.0 && frameTimeVariance < 10.0) {
      return DevicePerformanceLevel.medium;
    } else {
      return DevicePerformanceLevel.low;
    }
  }

  /// 根据设备性能等级推荐性能配置。
  static MonitorPerformanceConfig recommendPerformanceConfig(
    DevicePerformanceLevel level,
  ) {
    switch (level) {
      case DevicePerformanceLevel.high:
        return MonitorPerformanceConfig.strict();
      case DevicePerformanceLevel.medium:
        return MonitorPerformanceConfig.defaultConfig;
      case DevicePerformanceLevel.low:
        return MonitorPerformanceConfig.lenient();
    }
  }

  /// 计算帧时间百分位数。
  static Map<String, double> calculateFrameTimePercentiles(
    List<double> frameTimes,
  ) {
    if (frameTimes.isEmpty) {
      return {'p50': 0.0, 'p90': 0.0, 'p95': 0.0, 'p99': 0.0};
    }

    final sortedTimes = List<double>.from(frameTimes)..sort();
    final length = sortedTimes.length;

    return {
      'p50': _percentile(sortedTimes, 0.5, length),
      'p90': _percentile(sortedTimes, 0.9, length),
      'p95': _percentile(sortedTimes, 0.95, length),
      'p99': _percentile(sortedTimes, 0.99, length),
    };
  }

  static double _percentile(
    List<double> sortedData,
    double percentile,
    int length,
  ) {
    final index = (percentile * (length - 1)).round();
    return sortedData[index];
  }

  /// 检测异常帧。
  ///
  /// 当前实现将超过均值 3 倍标准差的帧视为异常帧。
  static List<double> detectAnomalousFrames(List<double> frameTimes) {
    if (frameTimes.length < 10) return [];

    final mean = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance =
        frameTimes.map((x) => pow(x - mean, 2)).reduce((a, b) => a + b) /
        frameTimes.length;
    final stdDev = sqrt(variance);
    final threshold = mean + 3 * stdDev;

    return frameTimes.where((time) => time > threshold).toList();
  }

  /// 计算帧时间稳定性指标。
  ///
  /// 返回值越接近 1 表示帧耗时越稳定。
  static double calculateFrameStability(List<double> frameTimes) {
    if (frameTimes.length < 2) return 1.0;

    final mean = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance =
        frameTimes.map((x) => pow(x - mean, 2)).reduce((a, b) => a + b) /
        frameTimes.length;
    final stdDev = sqrt(variance);

    // 稳定性 = 1 - (标准差 / 平均值)
    // 值越接近1表示越稳定
    return (1 - (stdDev / mean)).clamp(0.0, 1.0);
  }
}

/// 根据近期帧表现估算出的设备性能等级。
enum DevicePerformanceLevel {
  /// 高性能设备。
  high,

  /// 中等性能设备。
  medium,

  /// 低性能设备。
  low,
}

/// 从一组帧耗时样本计算出的性能指标快照。
class PerformanceMetrics {
  /// 平均帧耗时，单位毫秒。
  final double averageFrameTime;

  /// 帧耗时方差。
  final double frameTimeVariance;

  /// 平均 FPS。
  final double fps;

  /// 帧稳定性，越接近 1 越稳定。
  final double stability;

  /// 帧耗时百分位，例如 p50、p90、p95、p99。
  final Map<String, double> percentiles;

  /// 异常帧耗时列表。
  final List<double> anomalousFrames;

  /// 基于当前样本估算的设备性能等级。
  final DevicePerformanceLevel deviceLevel;

  /// 创建性能指标快照。
  const PerformanceMetrics({
    required this.averageFrameTime,
    required this.frameTimeVariance,
    required this.fps,
    required this.stability,
    required this.percentiles,
    required this.anomalousFrames,
    required this.deviceLevel,
  });

  /// 从帧时间列表创建性能指标。
  ///
  /// [frameTimes] 单位为毫秒；为空时返回一个接近 60 FPS 的默认健康快照。
  static PerformanceMetrics fromFrameTimes(List<double> frameTimes) {
    if (frameTimes.isEmpty) {
      return const PerformanceMetrics(
        averageFrameTime: 16.67,
        frameTimeVariance: 0.0,
        fps: 60.0,
        stability: 1.0,
        percentiles: {'p50': 16.67, 'p90': 16.67, 'p95': 16.67, 'p99': 16.67},
        anomalousFrames: [],
        deviceLevel: DevicePerformanceLevel.high,
      );
    }

    final averageFrameTime =
        frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance =
        frameTimes
            .map((x) => pow(x - averageFrameTime, 2))
            .reduce((a, b) => a + b) /
        frameTimes.length;
    final fps = 1000 / averageFrameTime;
    final stability = PerformanceUtils.calculateFrameStability(frameTimes);
    final percentiles = PerformanceUtils.calculateFrameTimePercentiles(
      frameTimes,
    );
    final anomalousFrames = PerformanceUtils.detectAnomalousFrames(frameTimes);
    final deviceLevel = PerformanceUtils.detectDevicePerformance(
      averageFrameTime: averageFrameTime,
      frameTimeVariance: variance,
      recentFrameCount: frameTimes.length,
    );

    return PerformanceMetrics(
      averageFrameTime: averageFrameTime,
      frameTimeVariance: variance,
      fps: fps,
      stability: stability,
      percentiles: percentiles,
      anomalousFrames: anomalousFrames,
      deviceLevel: deviceLevel,
    );
  }
}
