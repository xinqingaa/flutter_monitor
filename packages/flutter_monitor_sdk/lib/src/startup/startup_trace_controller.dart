import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

class StartupTraceController {
  StartupTraceController({
    required Reporter reporter,
    required DateTime appStartTime,
  }) : _reporter = reporter,
       _appStartTime = appStartTime;

  final Reporter _reporter;
  final DateTime _appStartTime;
  String? _coldStartTraceId;
  String? _sdkInitSpanId;
  DateTime? _sdkInitSpanStartTime;
  var _isColdStartFinished = false;

  String? get coldStartTraceId => _coldStartTraceId;

  void startSdkInit() {
    _ensureColdStartTrace();
    _reporter.beginStartupPerformance(startTime: _appStartTime);
    final startedAt = DateTime.now();
    _sdkInitSpanStartTime = startedAt;
    _sdkInitSpanId = _reporter.startSpan(
      EventNames.sdkInit,
      traceId: _coldStartTraceId,
      startTime: startedAt,
      attributes: const <String, Object?>{
        FieldPaths.appStartType: StartTypes.cold,
      },
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.sdkInit,
      },
    );
  }

  void finishSdkInit({DateTime? endTime}) {
    final spanId = _sdkInitSpanId;
    if (spanId == null) return;
    final finishedAt = endTime ?? DateTime.now();
    final startedAt = _sdkInitSpanStartTime;
    _reporter.endSpan(
      spanId,
      endTime: finishedAt,
      status: EventStatus.ok,
      attributes: <String, Object?>{
        FieldPaths.appStartType: StartTypes.cold,
        if (startedAt != null)
          FieldPaths.sdkInitDurationMs: finishedAt
              .difference(startedAt)
              .inMilliseconds,
      },
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.sdkInit,
      },
    );
    _sdkInitSpanId = null;
    _sdkInitSpanStartTime = null;
  }

  void finishFirstFrame({required DateTime endTime}) {
    if (_isColdStartFinished) return;
    final traceId = _ensureColdStartTrace();
    final durationMs = endTime.difference(_appStartTime).inMilliseconds;

    final firstFrameSpanId = _reporter.startSpan(
      EventNames.appFirstFrame,
      traceId: traceId,
      startTime: _appStartTime,
      attributes: <String, Object?>{FieldPaths.appStartType: StartTypes.cold},
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.firstFrame,
      },
    );
    _reporter.endSpan(
      firstFrameSpanId,
      endTime: endTime,
      status: EventStatus.ok,
      attributes: <String, Object?>{
        FieldPaths.appStartType: StartTypes.cold,
        FieldPaths.appFirstFrameMs: durationMs,
      },
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.firstFrame,
      },
    );

    final performanceAttributes = _reporter.finishStartupPerformance(
      memoryEndRssMb: _reporter.captureRssMb(),
    );
    _reporter.endTrace(
      traceId,
      endTime: endTime,
      status: EventStatus.ok,
      attributes: <String, Object?>{
        FieldPaths.appStartType: StartTypes.cold,
        FieldPaths.appFirstFrameMs: durationMs,
        ...performanceAttributes,
      },
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.coldStart,
      },
    );
    _isColdStartFinished = true;
  }

  String _ensureColdStartTrace() {
    final existing = _coldStartTraceId;
    if (existing != null) return existing;
    _coldStartTraceId = _reporter.startTrace(
      EventNames.appColdStart,
      startTime: _appStartTime,
      attributes: const <String, Object?>{
        FieldPaths.appStartType: StartTypes.cold,
      },
      payload: const <String, Object?>{
        PayloadKeys.startupPhase: StartupPhases.coldStart,
      },
    );
    return _coldStartTraceId!;
  }
}
