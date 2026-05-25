import '../constants/context_missing_reasons.dart';
import '../model/event_envelope.dart';
import '../model/event_level.dart';
import '../model/event_priority.dart';
import '../model/event_status.dart';
import '../model/json_utils.dart';
import '../model/signal_type.dart';
import '../privacy/privacy_level.dart';
import '../schema/field_registry.dart';
import '../schema/field_value_type.dart';
import 'schema_validation_issue.dart';
import 'schema_validation_result.dart';

class SchemaValidator {
  SchemaValidator({FieldRegistry? registry})
    : registry = registry ?? FieldRegistry.defaults();

  final FieldRegistry registry;

  SchemaValidationResult validateJson(Map<String, Object?> json) {
    final errors = <SchemaValidationIssue>[];
    final warnings = <SchemaValidationIssue>[];

    _requireJsonNonEmpty(errors, json, 'schemaVersion');
    _requireJsonNonEmpty(errors, json, 'eventId');
    _requireJsonNonEmpty(errors, json, 'timestamp');
    _requireJsonNonEmpty(errors, json, 'signalType');
    _requireJsonNonEmpty(errors, json, 'name');
    _requireJsonObject(errors, json, 'resource');
    _requireJsonObject(errors, json, 'context');

    _validateWireValue(errors, json, 'signalType', _signalTypeValues);
    _validateWireValue(errors, json, 'level', _levelValues, optional: true);
    _validateWireValue(errors, json, 'status', _statusValues, optional: true);
    _validateWireValue(
      errors,
      json,
      'priority',
      _priorityValues,
      optional: true,
    );

    if (json['context'] is Map) {
      errors.addAll(
        _collectDeprecatedContextIssues(objectMap(json['context']), 'context'),
      );
    }

    if (errors.isNotEmpty) {
      return SchemaValidationResult(errors: errors, warnings: warnings);
    }

    try {
      return validate(EventEnvelope.fromJson(json));
    } on FormatException catch (error) {
      errors.add(
        SchemaValidationIssue(
          path: 'schemaVersion',
          code: 'invalid_schema_version',
          message: error.message,
        ),
      );
    }

    return SchemaValidationResult(errors: errors, warnings: warnings);
  }

  SchemaValidationResult validate(EventEnvelope event) {
    final errors = <SchemaValidationIssue>[];
    final warnings = <SchemaValidationIssue>[];

    _requireNonEmpty(errors, 'schemaVersion', event.schemaVersion.toString());
    _requireNonEmpty(errors, 'eventId', event.eventId);
    _requireNonEmpty(errors, 'timestamp', event.timestamp.toIso8601String());
    _requireNonEmpty(errors, 'signalType', event.signalType.toJson());
    _requireNonEmpty(errors, 'name', event.name);

    if (event.signalType == SignalType.trace && _isBlank(event.traceId)) {
      errors.add(
        const SchemaValidationIssue(
          path: 'traceId',
          code: 'trace_id_required',
          message: 'trace events must provide traceId',
        ),
      );
    }

    if (event.signalType == SignalType.span) {
      if (_isBlank(event.traceId)) {
        errors.add(
          const SchemaValidationIssue(
            path: 'traceId',
            code: 'trace_id_required',
            message: 'span events must provide traceId',
          ),
        );
      }
      if (_isBlank(event.spanId)) {
        errors.add(
          const SchemaValidationIssue(
            path: 'spanId',
            code: 'span_id_required',
            message: 'span events must provide spanId',
          ),
        );
      }
    }

    if (event.startTime != null &&
        event.endTime != null &&
        event.endTime!.isBefore(event.startTime!)) {
      errors.add(
        const SchemaValidationIssue(
          path: 'endTime',
          code: 'end_time_before_start_time',
          message: 'endTime must not be before startTime',
        ),
      );
    }

    final duration = event.durationMs;
    if (duration != null && duration < 0) {
      errors.add(
        const SchemaValidationIssue(
          path: 'durationMs',
          code: 'duration_negative',
          message: 'durationMs must not be negative',
        ),
      );
    }

    final missingReason = event.context.missingReason;
    if (!_isBlank(missingReason) &&
        !ContextMissingReasons.contains(missingReason!)) {
      errors.add(
        SchemaValidationIssue(
          path: 'context.missingReason',
          code: 'invalid_missing_reason',
          message: '$missingReason is not a registered missing reason',
        ),
      );
    }

    errors.addAll(
      event.attributes.keys
          .where(_deprecatedFieldPaths.contains)
          .map(
            (path) => SchemaValidationIssue(
              path: 'attributes.$path',
              code: 'deprecated_field',
              message:
                  '$path is no longer part of the canonical field contract',
            ),
          ),
    );

    errors.addAll(_validateAttributes(event.attributes));

    if (_isBlank(event.sessionId) && event.signalType != SignalType.sdk) {
      warnings.add(
        const SchemaValidationIssue(
          path: 'sessionId',
          code: 'session_id_missing',
          message: 'business events should provide sessionId when available',
        ),
      );
    }

    return SchemaValidationResult(errors: errors, warnings: warnings);
  }

  static void _requireNonEmpty(
    List<SchemaValidationIssue> errors,
    String path,
    String value,
  ) {
    if (_isBlank(value)) {
      errors.add(
        SchemaValidationIssue(
          path: path,
          code: 'required',
          message: '$path is required',
        ),
      );
    }
  }

  static void _requireJsonNonEmpty(
    List<SchemaValidationIssue> errors,
    Map<String, Object?> json,
    String path,
  ) {
    final value = json[path];
    if (value is! String || _isBlank(value)) {
      errors.add(
        SchemaValidationIssue(
          path: path,
          code: 'required',
          message: '$path is required',
        ),
      );
    }
  }

  static void _requireJsonObject(
    List<SchemaValidationIssue> errors,
    Map<String, Object?> json,
    String path,
  ) {
    if (json[path] is! Map) {
      errors.add(
        SchemaValidationIssue(
          path: path,
          code: 'required_object',
          message: '$path must be an object',
        ),
      );
    }
  }

  static void _validateWireValue(
    List<SchemaValidationIssue> errors,
    Map<String, Object?> json,
    String path,
    Set<String> allowed, {
    bool optional = false,
  }) {
    final value = json[path];
    if (value == null && optional) return;
    if (value is! String || !allowed.contains(value)) {
      errors.add(
        SchemaValidationIssue(
          path: path,
          code: 'invalid_enum',
          message: '$path must be one of ${allowed.join(', ')}',
        ),
      );
    }
  }

  Iterable<SchemaValidationIssue> _validateAttributes(
    Map<String, Object?> attributes,
  ) sync* {
    for (final entry in attributes.entries) {
      if (_deprecatedFieldPaths.contains(entry.key)) {
        continue;
      }

      final definition = registry.lookup(entry.key);
      if (definition == null) {
        yield SchemaValidationIssue(
          path: 'attributes.${entry.key}',
          code: 'unknown_attribute',
          message: '${entry.key} is not registered in FieldRegistry',
        );
        continue;
      }

      if (definition.privacyLevel == PrivacyLevel.forbidden) {
        yield SchemaValidationIssue(
          path: 'attributes.${entry.key}',
          code: 'forbidden_field',
          message: '${entry.key} is forbidden by the privacy contract',
        );
        continue;
      }

      if (!_matchesType(entry.value, definition.valueType)) {
        yield SchemaValidationIssue(
          path: 'attributes.${entry.key}',
          code: 'invalid_attribute_type',
          message:
              '${entry.key} must be ${definition.valueType.toJson()}, got ${entry.value.runtimeType}',
        );
      }
    }
  }

  static bool _matchesType(Object? value, FieldValueType type) {
    if (value == null) return true;
    return switch (type) {
      FieldValueType.string => value is String,
      FieldValueType.number || FieldValueType.durationMs => value is num,
      FieldValueType.boolean => value is bool,
      FieldValueType.object => value is Map,
      FieldValueType.array => value is Iterable && value is! String,
      FieldValueType.timestamp => value is String || value is DateTime,
    };
  }

  static bool _isBlank(String? value) => value == null || value.trim().isEmpty;
}

final _signalTypeValues = SignalType.values
    .map((value) => value.wireValue)
    .toSet();
final _levelValues = EventLevel.values.map((value) => value.wireValue).toSet();
final _statusValues = EventStatus.values
    .map((value) => value.wireValue)
    .toSet();
final _priorityValues = EventPriority.values
    .map((value) => value.wireValue)
    .toSet();

const _deprecatedFieldPaths = <String>{
  'page.route',
  'page.route.source',
  'page.module',
  'page.scene',
  'page.stay_ms',
  'device.tier',
  'app.lifecycle.state',
  'app.lifecycle.previous_state',
  'native.platform',
  'native.memory.used_mb',
  'native.memory.pressure_level',
  'error.message',
  'error.stacktrace',
};

List<SchemaValidationIssue> _collectDeprecatedContextIssues(
  Map<String, Object?> json,
  String pathPrefix,
) {
  final issues = <SchemaValidationIssue>[];
  for (final entry in json.entries) {
    final path = '$pathPrefix.${entry.key}';
    if (entry.key == 'appLifecycleState' ||
        entry.key == 'appLifecyclePreviousState') {
      issues.add(
        SchemaValidationIssue(
          path: path,
          code: 'deprecated_field',
          message:
              '${entry.key} is no longer part of the canonical field contract',
        ),
      );
      continue;
    }
    if (entry.value is Map) {
      issues.addAll(
        _collectDeprecatedContextIssues(objectMap(entry.value), path),
      );
    }
  }
  return issues;
}
