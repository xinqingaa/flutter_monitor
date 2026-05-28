import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/signal_sources.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';

class LegacySignalMapper {
  RawSignal map({
    required String category,
    required Map<String, dynamic> data,
    required DateTime timestamp,
  }) {
    final type = data[PayloadKeys.type]?.toString();
    final normalized = _normalizeData(data);

    return switch (category) {
      LegacyCategories.error => _errorSignal(type, normalized, timestamp),
      LegacyCategories.performance => _performanceSignal(
        type,
        normalized,
        timestamp,
      ),
      LegacyCategories.behavior => _behaviorSignal(type, normalized, timestamp),
      _ => _manualSignal(category, type, normalized, timestamp),
    };
  }

  RawSignal _errorSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    final mechanism = switch (type) {
      LegacyTypes.flutterError => ErrorMechanisms.flutter,
      LegacyTypes.dartError => ErrorMechanisms.dart,
      _ => ErrorMechanisms.manual,
    };
    final message =
        data[PayloadKeys.exception] ??
        data[PayloadKeys.error] ??
        data[PayloadKeys.message];
    final isManual = mechanism == ErrorMechanisms.manual;

    final legacyData = Map<String, Object?>.from(data);
    legacyData.remove(PayloadKeys.stack);

    return RawSignal(
      source: SignalSources.legacyReporter,
      name: switch (mechanism) {
        ErrorMechanisms.flutter => EventNames.errorFlutter,
        ErrorMechanisms.dart => EventNames.errorDart,
        _ => EventNames.errorManual,
      },
      signalType: SignalType.error,
      timestamp: timestamp,
      level: EventLevel.error,
      status: EventStatus.error,
      priority: EventPriority.high,
      attributes: <String, Object?>{
        FieldPaths.errorType: type ?? ErrorMechanisms.manual,
        FieldPaths.errorMechanism: mechanism,
        FieldPaths.errorHandled: data['handled'] is bool
            ? data['handled']
            : isManual,
        FieldPaths.errorFatal: data['fatal'] is bool ? data['fatal'] : false,
      },
      payload: <String, Object?>{
        if (message != null) FieldPaths.payloadErrorMessage: message.toString(),
        if (data[PayloadKeys.stack] != null)
          FieldPaths.payloadErrorStacktrace: data[PayloadKeys.stack].toString(),
        if (data[PayloadKeys.library] != null)
          FieldPaths.payloadErrorLibrary: data[PayloadKeys.library].toString(),
        PayloadKeys.legacyCategory: LegacyCategories.error,
        PayloadKeys.legacyData: legacyData,
      },
    );
  }

  RawSignal _performanceSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    final durationMs = _numValue(data[PayloadKeys.durationMs]);
    final attributes = <String, Object?>{};
    var name = 'performance.${type ?? LegacyTypes.event}';

    if (type == LegacyTypes.api) {
      name = EventNames.httpClient;
      attributes.addAll({
        if (data[PayloadKeys.method] != null)
          FieldPaths.httpMethod: data[PayloadKeys.method],
        if (data[PayloadKeys.url] != null)
          FieldPaths.httpUrlNormalized: _normalizedUrl(
            data[PayloadKeys.url].toString(),
          ),
        if (_numValue(data[PayloadKeys.status]) != null)
          FieldPaths.httpStatusCode: _numValue(data[PayloadKeys.status]),
        if (data[PayloadKeys.success] is bool)
          FieldPaths.httpSuccess: data[PayloadKeys.success],
        if (data[PayloadKeys.error] != null)
          FieldPaths.httpErrorType: HttpErrorTypes.networkError,
      });
    } else if (type == LegacyTypes.pageLoad) {
      name = EventNames.pageLoad;
      if (durationMs != null) {
        attributes[FieldPaths.pageFirstFrameMs] = durationMs;
      }
    } else if (type == LegacyTypes.jankSequence) {
      name = EventNames.uiJankSequence;
      attributes.addAll({
        if (_numValue(data[PayloadKeys.jankCount]) != null)
          FieldPaths.jankCount: _numValue(data[PayloadKeys.jankCount]),
        if (_numValue(data[PayloadKeys.maxDurationMs]) != null)
          FieldPaths.frameMaxMs: _numValue(data[PayloadKeys.maxDurationMs]),
        if (_numValue(data[PayloadKeys.averageDurationMs]) != null)
          FieldPaths.frameAvgMs: _numValue(data[PayloadKeys.averageDurationMs]),
        if (_numValue(data[PayloadKeys.frameBudgetMs]) != null)
          FieldPaths.frameBudgetMs: _numValue(data[PayloadKeys.frameBudgetMs]),
        ..._devicePerformanceAttributes(data[PayloadKeys.devicePerformance]),
      });
    }

    final success = data[PayloadKeys.success];
    return RawSignal(
      source: SignalSources.legacyReporter,
      name: name,
      signalType: SignalType.metric,
      timestamp: timestamp,
      durationMs: durationMs,
      level: EventLevel.info,
      status: success is bool
          ? (success ? EventStatus.ok : EventStatus.error)
          : EventStatus.ok,
      attributes: attributes,
      payload: <String, Object?>{
        PayloadKeys.legacyCategory: LegacyCategories.performance,
        PayloadKeys.legacyData: data,
      },
    );
  }

  RawSignal _behaviorSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    if (type == LegacyTypes.click) {
      return RawSignal(
        source: SignalSources.legacyReporter,
        name: EventNames.uiClick,
        signalType: SignalType.breadcrumb,
        timestamp: timestamp,
        level: EventLevel.info,
        status: EventStatus.ok,
        attributes: <String, Object?>{
          FieldPaths.uiAction: LegacyTypes.click,
          if (data[PayloadKeys.identifier] != null)
            FieldPaths.uiTarget: data[PayloadKeys.identifier],
        },
        payload: <String, Object?>{
          PayloadKeys.legacyCategory: LegacyCategories.behavior,
          PayloadKeys.legacyData: data,
        },
      );
    }

    if (type == LegacyTypes.pageStay) {
      return RawSignal(
        source: SignalSources.legacyReporter,
        name: EventNames.pageStay,
        signalType: SignalType.metric,
        timestamp: timestamp,
        durationMs: _numValue(data[PayloadKeys.durationMs]),
        level: EventLevel.info,
        status: EventStatus.ok,
        payload: <String, Object?>{
          PayloadKeys.legacyCategory: LegacyCategories.behavior,
          PayloadKeys.legacyData: data,
        },
      );
    }

    return RawSignal(
      source: SignalSources.legacyReporter,
      name: type == LegacyTypes.pv
          ? EventNames.pageView
          : '${LegacyCategories.behavior}.${type ?? LegacyTypes.event}',
      signalType: SignalType.breadcrumb,
      timestamp: timestamp,
      level: EventLevel.info,
      status: EventStatus.ok,
      payload: <String, Object?>{
        PayloadKeys.legacyCategory: LegacyCategories.behavior,
        PayloadKeys.legacyData: data,
      },
    );
  }

  RawSignal _manualSignal(
    String category,
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    return RawSignal(
      source: SignalSources.legacyReporter,
      name: 'legacy.$category${type == null ? '' : '.$type'}',
      signalType: SignalType.log,
      timestamp: timestamp,
      level: EventLevel.info,
      status: EventStatus.ok,
      payload: <String, Object?>{
        PayloadKeys.legacyCategory: category,
        PayloadKeys.legacyData: data,
      },
    );
  }

  Map<String, Object?> _normalizeData(Map<String, dynamic> data) {
    return data.map((key, value) => MapEntry(key, _normalizeValue(value)));
  }

  Object? _normalizeValue(Object? value) {
    if (value is Map) {
      return value.map(
        (key, value) => MapEntry('$key', _normalizeValue(value)),
      );
    }
    if (value is Iterable && value is! String) {
      return value.map(_normalizeValue).toList(growable: false);
    }
    return value;
  }

  Map<String, Object?> _devicePerformanceAttributes(Object? value) {
    if (value is! Map) return const <String, Object?>{};
    final data = value.map((key, value) => MapEntry('$key', value));
    final percentiles = data[PayloadKeys.percentiles] is Map
        ? (data[PayloadKeys.percentiles] as Map).map(
            (key, value) => MapEntry('$key', value),
          )
        : const <String, Object?>{};
    return <String, Object?>{
      if (_numValue(data[PayloadKeys.fps]) != null)
        FieldPaths.frameFps: _numValue(data[PayloadKeys.fps]),
      if (_numValue(data[PayloadKeys.stability]) != null)
        FieldPaths.frameStability: _numValue(data[PayloadKeys.stability]),
      if (_numValue(percentiles[PayloadKeys.p50]) != null)
        FieldPaths.frameP50Ms: _numValue(percentiles[PayloadKeys.p50]),
      if (_numValue(percentiles[PayloadKeys.p90]) != null)
        FieldPaths.frameP90Ms: _numValue(percentiles[PayloadKeys.p90]),
      if (_numValue(percentiles[PayloadKeys.p99]) != null)
        FieldPaths.frameP99Ms: _numValue(percentiles[PayloadKeys.p99]),
    };
  }

  num? _numValue(Object? value) {
    if (value is num) return value;
    if (value is String) return num.tryParse(value);
    return null;
  }

  String _normalizedUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return rawUrl.split('?').first;
    if (uri.hasScheme) {
      return uri.path.isEmpty ? '/' : uri.path;
    }
    return rawUrl.split('?').first;
  }
}
