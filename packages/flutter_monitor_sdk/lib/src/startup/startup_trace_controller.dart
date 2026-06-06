import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

/// 冷启动 trace 控制器。
///
/// SDK 初始化期间由 MonitorBinding 创建，用于把 app.cold_start trace、sdk.init
/// span 和首帧完成时机串起来。它只负责启动链路时序，事件仍通过 Reporter 进入
/// pipeline。
class StartupTraceController {
  /// 创建冷启动控制器。
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

  /// 当前冷启动 trace id。
  ///
  /// 在 SDK init span 开始时创建，首帧完成后闭合。
  String? get coldStartTraceId => _coldStartTraceId;

  /// 开启 `app.cold_start` trace 和 `sdk.init` span。
  ///
  /// 必须在首批 bootstrap 事件前调用，确保启动期事件可关联到冷启动 trace。
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

  /// 闭合 `sdk.init` span。
  ///
  /// 该 span 只覆盖 SDK 初始化阶段，不代表整个冷启动完成。
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

  /// 首帧完成时闭合冷启动 trace。
  ///
  /// 该方法记录 `app.first_frame_ms` 和启动期间的 memory performance evidence。
  void finishFirstFrame({required DateTime endTime}) {
    if (_isColdStartFinished) return;
    final traceId = _ensureColdStartTrace();
    final durationMs = endTime.difference(_appStartTime).inMilliseconds;

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
