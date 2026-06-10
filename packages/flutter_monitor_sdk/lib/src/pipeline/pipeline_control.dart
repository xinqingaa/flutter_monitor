import 'dart:math';

import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

class PipelineControl {
  PipelineControl({
    required MonitorMode mode,
    Random? random,
    DateTime Function()? now,
  }) : _mode = mode,
       _random = random ?? Random(),
       _now = now ?? DateTime.now;

  final MonitorMode _mode;
  final Random _random;
  final DateTime Function() _now;
  final Map<String, List<DateTime>> _rateWindows = <String, List<DateTime>>{};

  PipelineDecision evaluate(EventEnvelope envelope) {
    if (envelope.signalType == SignalType.sdk) {
      return const PipelineDecision.keep();
    }
    if (_mode.name != SdkOutputModes.production) {
      return const PipelineDecision.keep();
    }
    if (_mustKeep(envelope)) {
      return const PipelineDecision.keep();
    }

    final rateLimited = _rateLimitDecision(envelope);
    if (rateLimited != null) return rateLimited;

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
    if (envelope.signalType == SignalType.error) return true;
    if (envelope.name == EventNames.httpClient &&
        envelope.status == EventStatus.error) {
      return true;
    }
    if (envelope.name == EventNames.uiJankSequence) return true;
    if (envelope.name == EventNames.memoryPressure ||
        envelope.name == EventNames.nativeMemoryPressure) {
      return true;
    }
    if (envelope.name == EventNames.appColdStart ||
        envelope.name == EventNames.appHotStart) {
      return envelope.attributes[FieldPaths.eventPhase] == EventPhases.end;
    }
    return false;
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
      return const PipelineDecision.drop(reason: SdkDropReasons.rateLimited);
    }
    timestamps.add(now);
    return null;
  }

  double _sampleRate(EventEnvelope envelope) {
    final policy = _mode.productionPolicy;
    if (envelope.name == EventNames.memorySample) {
      return policy.memorySampleRate;
    }
    if (envelope.name == EventNames.httpClient &&
        envelope.status == EventStatus.ok) {
      return policy.successfulHttpSampleRate;
    }
    if (envelope.priority == EventPriority.low) {
      return policy.lowPrioritySampleRate;
    }
    return policy.defaultSampleRate;
  }
}

class PipelineDecision {
  const PipelineDecision.keep() : keep = true, reason = null, sampleRate = null;

  const PipelineDecision.drop({required this.reason, this.sampleRate})
    : keep = false;

  final bool keep;
  final String? reason;
  final double? sampleRate;
}
