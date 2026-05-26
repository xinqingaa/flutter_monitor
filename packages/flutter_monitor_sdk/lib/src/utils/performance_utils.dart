import 'dart:math';
import '../modules/jank_monitor.dart';

/// 性能监控工具类
/// 提供各种性能优化和监控相关的工具方法
class PerformanceUtils {
  /// 计算帧率的滑动窗口
  static double calculateFPS(List<Duration> frameDurations) {
    if (frameDurations.isEmpty) return 0.0;
    
    final totalDuration = frameDurations
        .map((d) => d.inMicroseconds)
        .reduce((a, b) => a + b);
    
    final averageFrameTime = totalDuration / frameDurations.length;
    return 1000000 / averageFrameTime; // 转换为FPS
  }

  /// 检测设备性能等级
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

  /// 根据设备性能推荐卡顿配置
  static JankConfig recommendJankConfig(DevicePerformanceLevel level) {
    switch (level) {
      case DevicePerformanceLevel.high:
        return JankConfig.strict();
      case DevicePerformanceLevel.medium:
        return JankConfig.defaultConfig();
      case DevicePerformanceLevel.low:
        return JankConfig.lenient();
    }
  }

  /// 计算帧时间百分位数
  static Map<String, double> calculateFrameTimePercentiles(List<double> frameTimes) {
    if (frameTimes.isEmpty) {
      return {
        'p50': 0.0,
        'p90': 0.0,
        'p95': 0.0,
        'p99': 0.0,
      };
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

  static double _percentile(List<double> sortedData, double percentile, int length) {
    final index = (percentile * (length - 1)).round();
    return sortedData[index];
  }

  /// 检测异常帧（超过正常范围3倍标准差的帧）
  static List<double> detectAnomalousFrames(List<double> frameTimes) {
    if (frameTimes.length < 10) return [];

    final mean = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance = frameTimes
        .map((x) => pow(x - mean, 2))
        .reduce((a, b) => a + b) / frameTimes.length;
    final stdDev = sqrt(variance);
    final threshold = mean + 3 * stdDev;

    return frameTimes.where((time) => time > threshold).toList();
  }

  /// 计算帧时间稳定性指标
  static double calculateFrameStability(List<double> frameTimes) {
    if (frameTimes.length < 2) return 1.0;

    final mean = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance = frameTimes
        .map((x) => pow(x - mean, 2))
        .reduce((a, b) => a + b) / frameTimes.length;
    final stdDev = sqrt(variance);

    // 稳定性 = 1 - (标准差 / 平均值)
    // 值越接近1表示越稳定
    return (1 - (stdDev / mean)).clamp(0.0, 1.0);
  }
}

/// 设备性能等级
enum DevicePerformanceLevel {
  high,   // 高性能设备
  medium, // 中等性能设备
  low,    // 低性能设备
}

/// 性能指标
class PerformanceMetrics {
  final double averageFrameTime;
  final double frameTimeVariance;
  final double fps;
  final double stability;
  final Map<String, double> percentiles;
  final List<double> anomalousFrames;
  final DevicePerformanceLevel deviceLevel;

  const PerformanceMetrics({
    required this.averageFrameTime,
    required this.frameTimeVariance,
    required this.fps,
    required this.stability,
    required this.percentiles,
    required this.anomalousFrames,
    required this.deviceLevel,
  });

  /// 从帧时间列表创建性能指标
  static PerformanceMetrics fromFrameTimes(List<double> frameTimes) {
    if (frameTimes.isEmpty) {
      return const PerformanceMetrics(
        averageFrameTime: 16.67,
        frameTimeVariance: 0.0,
        fps: 60.0,
        stability: 1.0,
        percentiles: {
          'p50': 16.67,
          'p90': 16.67,
          'p95': 16.67,
          'p99': 16.67,
        },
        anomalousFrames: [],
        deviceLevel: DevicePerformanceLevel.high,
      );
    }

    final averageFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    final variance = frameTimes
        .map((x) => pow(x - averageFrameTime, 2))
        .reduce((a, b) => a + b) / frameTimes.length;
    final fps = 1000 / averageFrameTime;
    final stability = PerformanceUtils.calculateFrameStability(frameTimes);
    final percentiles = PerformanceUtils.calculateFrameTimePercentiles(frameTimes);
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
