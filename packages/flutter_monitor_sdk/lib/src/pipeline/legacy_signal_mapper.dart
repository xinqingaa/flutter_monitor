import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/pipeline/raw_signal.dart';

class LegacySignalMapper {
  RawSignal map({
    required String category,
    required Map<String, dynamic> data,
    required DateTime timestamp,
  }) {
    final type = data['type']?.toString();
    final normalized = _normalizeData(data);

    return switch (category) {
      'error' => _errorSignal(type, normalized, timestamp),
      'performance' => _performanceSignal(type, normalized, timestamp),
      'behavior' => _behaviorSignal(type, normalized, timestamp),
      _ => _manualSignal(category, type, normalized, timestamp),
    };
  }

  RawSignal _errorSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    final mechanism = switch (type) {
      'flutter_error' => 'flutter',
      'dart_error' => 'dart',
      _ => 'manual',
    };
    final message = data['exception'] ?? data['error'] ?? data['message'];

    return RawSignal(
      source: 'legacy.reporter',
      name: switch (mechanism) {
        'flutter' => 'error.flutter',
        'dart' => 'error.dart',
        _ => 'error.manual',
      },
      signalType: SignalType.error,
      timestamp: timestamp,
      level: EventLevel.error,
      status: EventStatus.error,
      priority: EventPriority.high,
      attributes: <String, Object?>{
        FieldPaths.errorType: type ?? 'manual',
        FieldPaths.errorMechanism: mechanism,
        FieldPaths.errorHandled: false,
        FieldPaths.errorFatal: false,
      },
      payload: <String, Object?>{
        if (message != null) FieldPaths.payloadErrorMessage: message.toString(),
        if (data['stack'] != null)
          FieldPaths.payloadErrorStacktrace: data['stack'].toString(),
        if (data['library'] != null)
          FieldPaths.payloadErrorLibrary: data['library'].toString(),
        'legacy.category': 'error',
        'legacy.data': data,
      },
    );
  }

  RawSignal _performanceSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    final durationMs = _numValue(data['duration_ms']);
    final attributes = <String, Object?>{};
    var name = 'performance.${type ?? 'event'}';

    if (type == 'api') {
      name = 'http.client';
      attributes.addAll({
        if (data['method'] != null) FieldPaths.httpMethod: data['method'],
        if (data['url'] != null)
          FieldPaths.httpUrlNormalized: _normalizedUrl(data['url'].toString()),
        if (_numValue(data['status']) != null)
          FieldPaths.httpStatusCode: _numValue(data['status']),
        if (data['success'] is bool) FieldPaths.httpSuccess: data['success'],
        if (data['error'] != null) FieldPaths.httpErrorType: 'network_error',
      });
    } else if (type == 'page_load') {
      name = 'page.load';
      if (durationMs != null) {
        attributes[FieldPaths.pageFirstFrameMs] = durationMs;
      }
    } else if (type == 'jank_sequence') {
      name = 'jank.sequence';
      attributes.addAll({
        if (_numValue(data['jank_count']) != null)
          FieldPaths.jankCount: _numValue(data['jank_count']),
        if (_numValue(data['max_duration_ms']) != null)
          FieldPaths.frameMaxMs: _numValue(data['max_duration_ms']),
        if (_numValue(data['average_duration_ms']) != null)
          FieldPaths.frameAvgMs: _numValue(data['average_duration_ms']),
        if (_numValue(data['frame_budget_ms']) != null)
          FieldPaths.frameBudgetMs: _numValue(data['frame_budget_ms']),
        ..._devicePerformanceAttributes(data['device_performance']),
      });
    }

    final success = data['success'];
    return RawSignal(
      source: 'legacy.reporter',
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
        'legacy.category': 'performance',
        'legacy.data': data,
      },
    );
  }

  RawSignal _behaviorSignal(
    String? type,
    Map<String, Object?> data,
    DateTime timestamp,
  ) {
    if (type == 'click') {
      return RawSignal(
        source: 'legacy.reporter',
        name: 'ui.click',
        signalType: SignalType.breadcrumb,
        timestamp: timestamp,
        level: EventLevel.info,
        status: EventStatus.ok,
        attributes: <String, Object?>{
          FieldPaths.uiAction: 'click',
          if (data['identifier'] != null)
            FieldPaths.uiTarget: data['identifier'],
        },
        payload: <String, Object?>{
          'legacy.category': 'behavior',
          'legacy.data': data,
        },
      );
    }

    if (type == 'page_stay') {
      return RawSignal(
        source: 'legacy.reporter',
        name: 'page.stay',
        signalType: SignalType.metric,
        timestamp: timestamp,
        durationMs: _numValue(data['duration_ms']),
        level: EventLevel.info,
        status: EventStatus.ok,
        payload: <String, Object?>{
          'legacy.category': 'behavior',
          'legacy.data': data,
        },
      );
    }

    return RawSignal(
      source: 'legacy.reporter',
      name: type == 'pv' ? 'page.view' : 'behavior.${type ?? 'event'}',
      signalType: SignalType.breadcrumb,
      timestamp: timestamp,
      level: EventLevel.info,
      status: EventStatus.ok,
      payload: <String, Object?>{
        'legacy.category': 'behavior',
        'legacy.data': data,
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
      source: 'legacy.reporter',
      name: 'legacy.$category${type == null ? '' : '.$type'}',
      signalType: SignalType.log,
      timestamp: timestamp,
      level: EventLevel.info,
      status: EventStatus.ok,
      payload: <String, Object?>{
        'legacy.category': category,
        'legacy.data': data,
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
    final percentiles = data['percentiles'] is Map
        ? (data['percentiles'] as Map).map(
            (key, value) => MapEntry('$key', value),
          )
        : const <String, Object?>{};
    return <String, Object?>{
      if (_numValue(data['fps']) != null)
        FieldPaths.frameFps: _numValue(data['fps']),
      if (_numValue(data['stability']) != null)
        FieldPaths.frameStability: _numValue(data['stability']),
      if (_numValue(percentiles['p50']) != null)
        FieldPaths.frameP50Ms: _numValue(percentiles['p50']),
      if (_numValue(percentiles['p90']) != null)
        FieldPaths.frameP90Ms: _numValue(percentiles['p90']),
      if (_numValue(percentiles['p99']) != null)
        FieldPaths.frameP99Ms: _numValue(percentiles['p99']),
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
