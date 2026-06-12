import 'dart:math';

import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

class PipelineControl {
  PipelineControl({
    required MonitorMode mode,
    Random? random,
    DateTime Function()? now,
    RetentionRegistry retentionRegistry = RetentionRegistry.instance,
  }) : _mode = mode,
       _random = random ?? Random(),
       _now = now ?? DateTime.now,
       _retention = retentionRegistry;

  final MonitorMode _mode;
  final Random _random;
  final DateTime Function() _now;
  final RetentionRegistry _retention;
  final Map<String, List<DateTime>> _rateWindows = <String, List<DateTime>>{};

  PipelineDecision evaluate(EventEnvelope envelope) {
    if (envelope.signalType == SignalType.sdk) {
      return const PipelineDecision.keep();
    }
    if (_mode.name != SdkOutputModes.production) {
      return const PipelineDecision.keep();
    }

    // track 是 hard 证据，但速率不是结构性有界的，所以限流先于 hard 豁免，
    // 保证业务循环不会把队列冲爆。
    final rateLimited = _rateLimitDecision(envelope);
    if (rateLimited != null) return rateLimited;

    if (_mustKeep(envelope)) {
      return const PipelineDecision.keep();
    }

    final sampleRate = _sampleRate(envelope);
    if (sampleRate >= 1.0) return const PipelineDecision.keep();
    if (sampleRate <= 0) {
      return PipelineDecision.drop(
        reason: SdkDropReasons.sampledOut,
        sampleRate: sampleRate,
      );
    }
    if (_random.nextDouble() > sampleRate) {
      return PipelineDecision.drop(
        reason: SdkDropReasons.sampledOut,
        sampleRate: sampleRate,
      );
    }
    return const PipelineDecision.keep();
  }

  bool _mustKeep(EventEnvelope envelope) {
    if (envelope.priority == EventPriority.critical ||
        envelope.priority == EventPriority.high) {
      return true;
    }
    // hard 证据永不采样，名单由 core RetentionRegistry 统一定义。
    return _retention.resolveEnvelope(envelope) == EventRetention.hard;
  }

  PipelineDecision? _rateLimitDecision(EventEnvelope envelope) {
    if (envelope.signalType != SignalType.breadcrumb) return null;
    if (!envelope.attributes.containsKey(FieldPaths.businessAction)) {
      return null;
    }
    final limit = _mode.productionPolicy.maxTrackEventsPerMinute;
    if (limit <= 0) {
      return const PipelineDecision.drop(reason: SdkDropReasons.rateLimited);
    }
    final key =
        '${envelope.signalType.toJson()}:${envelope.attributes[FieldPaths.businessAction]}';
    final now = _now();
    final windowStart = now.subtract(const Duration(minutes: 1));
    final timestamps = _rateWindows.putIfAbsent(key, () => <DateTime>[]);
    timestamps.removeWhere((timestamp) => timestamp.isBefore(windowStart));
    if (timestamps.length >= limit) {
      // track 是 hard 证据：超限部分聚合进 business.action.summary，不静默丢弃。
      return const PipelineDecision.aggregate(
        reason: SdkDropReasons.rateLimited,
      );
    }
    timestamps.add(now);
    return null;
  }

  double _sampleRate(EventEnvelope envelope) {
    final policy = _mode.productionPolicy;
    if (envelope.name == EventNames.memorySample) {
      return policy.memorySampleRate;
    }
    // http.client 是 hard 证据，在 _mustKeep 阶段已被豁免，
    // successfulHttpSampleRate 仅保留为 Phase 6 remote config 的降级开关。
    if (envelope.priority == EventPriority.low) {
      return policy.lowPrioritySampleRate;
    }
    return policy.defaultSampleRate;
  }
}

class PipelineDecision {
  const PipelineDecision.keep()
    : keep = true,
      aggregate = false,
      reason = null,
      sampleRate = null;

  const PipelineDecision.drop({required this.reason, this.sampleRate})
    : keep = false,
      aggregate = false;

  /// 事件不单独保留，但必须聚合进 summary 事件而不是丢弃。
  const PipelineDecision.aggregate({required this.reason})
    : keep = false,
      aggregate = true,
      sampleRate = null;

  final bool keep;
  final bool aggregate;
  final String? reason;
  final double? sampleRate;
}
