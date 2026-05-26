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
    final startedAt = DateTime.now();
    _sdkInitSpanStartTime = startedAt;
    _sdkInitSpanId = _reporter.startSpan(
      'sdk.init',
      traceId: _coldStartTraceId,
      startTime: startedAt,
      attributes: const <String, Object?>{FieldPaths.appStartType: 'cold'},
      payload: const <String, Object?>{'startup.phase': 'sdk_init'},
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
        FieldPaths.appStartType: 'cold',
        if (startedAt != null)
          FieldPaths.sdkInitDurationMs: finishedAt
              .difference(startedAt)
              .inMilliseconds,
      },
      payload: const <String, Object?>{'startup.phase': 'sdk_init'},
    );
    _sdkInitSpanId = null;
    _sdkInitSpanStartTime = null;
  }

  void finishFirstFrame({required DateTime endTime}) {
    if (_isColdStartFinished) return;
    final traceId = _ensureColdStartTrace();
    final durationMs = endTime.difference(_appStartTime).inMilliseconds;

    final firstFrameSpanId = _reporter.startSpan(
      'app.first_frame',
      traceId: traceId,
      startTime: _appStartTime,
      attributes: <String, Object?>{FieldPaths.appStartType: 'cold'},
      payload: const <String, Object?>{'startup.phase': 'first_frame'},
    );
    _reporter.endSpan(
      firstFrameSpanId,
      endTime: endTime,
      status: EventStatus.ok,
      attributes: <String, Object?>{
        FieldPaths.appStartType: 'cold',
        FieldPaths.appFirstFrameMs: durationMs,
      },
      payload: const <String, Object?>{'startup.phase': 'first_frame'},
    );

    _reporter.endTrace(
      traceId,
      endTime: endTime,
      status: EventStatus.ok,
      attributes: <String, Object?>{
        FieldPaths.appStartType: 'cold',
        FieldPaths.appFirstFrameMs: durationMs,
      },
      payload: const <String, Object?>{'startup.phase': 'cold_start'},
    );
    _isColdStartFinished = true;
  }

  String _ensureColdStartTrace() {
    final existing = _coldStartTraceId;
    if (existing != null) return existing;
    _coldStartTraceId = _reporter.startTrace(
      'app.cold_start',
      startTime: _appStartTime,
      attributes: const <String, Object?>{FieldPaths.appStartType: 'cold'},
      payload: const <String, Object?>{'startup.phase': 'cold_start'},
    );
    return _coldStartTraceId!;
  }
}
