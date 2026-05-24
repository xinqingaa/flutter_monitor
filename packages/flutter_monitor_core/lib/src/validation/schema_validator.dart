import '../model/event_envelope.dart';
import '../model/signal_type.dart';
import 'schema_validation_issue.dart';
import 'schema_validation_result.dart';

class SchemaValidator {
  const SchemaValidator();

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

  static bool _isBlank(String? value) => value == null || value.trim().isEmpty;
}
