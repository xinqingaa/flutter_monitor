import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

class MemoryCollector {
  MemoryCollector(this._reporter, {required MonitorMemoryConfig config})
    : _config = config;

  final Reporter _reporter;
  final MonitorMemoryConfig _config;
  final Map<String, DateTime> _lastSampleAt = <String, DateTime>{};
  _MemorySample? _baseline;
  _MemorySample? _lastSample;

  bool get enabled => _config.enabled;

  Future<void> recordSample({
    required String trigger,
    DateTime? timestamp,
    bool force = false,
  }) async {
    if (!_config.enabled) return;
    final occurredAt = timestamp ?? DateTime.now();
    if (!force && !_shouldSample(trigger, occurredAt)) return;
    final sample = await _captureSample(occurredAt);
    if (sample == null) {
      _reporter.reportSdkEvent(
        EventNames.sdkMemorySampleUnavailable,
        level: EventLevel.debug,
        status: EventStatus.unknown,
        payload: <String, Object?>{PayloadKeys.trigger: trigger},
      );
      return;
    }
    _lastSampleAt[trigger] = occurredAt;
    _baseline ??= sample;
    _lastSample = sample;
    _reporter.recordMemorySample(
      rssMb: sample.rssMb,
      source: sample.source,
      trigger: trigger,
      timestamp: occurredAt,
    );
  }

  Future<void> recordGrowth({
    required String trigger,
    DateTime? timestamp,
    bool force = false,
    bool emitSample = false,
  }) async {
    if (!_config.enabled) return;
    final occurredAt = timestamp ?? DateTime.now();
    final sample = await _captureSample(occurredAt);
    if (sample == null) return;
    final previous = _lastSample ?? _baseline;
    _baseline ??= sample;
    _lastSample = sample;
    if (emitSample) {
      _reporter.recordMemorySample(
        rssMb: sample.rssMb,
        source: sample.source,
        trigger: trigger,
        timestamp: occurredAt,
      );
    }
    if (previous == null) return;

    final growthMb = sample.usedMb - previous.usedMb;
    if (!force && growthMb < _config.growthThresholdMb) return;
    final duration = sample.timestamp.difference(previous.timestamp);
    _reporter.recordMemoryGrowth(
      growthMb: growthMb,
      growthDuration: duration,
      source: sample.source,
      trigger: trigger,
      sampleCount: 2,
      evidence: <String, Object?>{
        'baseline.used_mb': previous.usedMb,
        'current.used_mb': sample.usedMb,
      },
    );

    if (growthMb >= _config.suspectLeakThresholdMb) {
      _reporter.recordMemoryLeakSuspect(
        growthMb: growthMb,
        growthDuration: duration,
        source: sample.source,
        trigger: trigger,
        evidence: <String, Object?>{
          'baseline.used_mb': previous.usedMb,
          'current.used_mb': sample.usedMb,
          'threshold_mb': _config.suspectLeakThresholdMb,
          'reason': 'growth_threshold_exceeded',
        },
      );
    }
  }

  void recordPressure({
    MemoryPressureLevel level = MemoryPressureLevel.unknown,
    String trigger = TriggerValues.manual,
    DateTime? timestamp,
  }) {
    if (!_config.enabled) return;
    _reporter.recordMemoryPressure(
      level: level,
      source: MemorySampleSource.dart,
      trigger: trigger,
      timestamp: timestamp,
    );
  }

  bool _shouldSample(String trigger, DateTime timestamp) {
    final lastAt = _lastSampleAt[trigger];
    if (lastAt == null) return true;
    return timestamp.difference(lastAt) >= _config.minSampleInterval;
  }

  Future<_MemorySample?> _captureSample(DateTime timestamp) async {
    try {
      if (kIsWeb) return null;
      return _MemorySample(
        timestamp: timestamp,
        rssMb: ProcessInfo.currentRss / 1024 / 1024,
        source: MemorySampleSource.system,
      );
    } catch (_) {
      return null;
    }
  }
}

class _MemorySample {
  const _MemorySample({
    required this.timestamp,
    required this.rssMb,
    required this.source,
  });

  final DateTime timestamp;
  final num rssMb;
  final MemorySampleSource source;

  num get usedMb => rssMb;
}
