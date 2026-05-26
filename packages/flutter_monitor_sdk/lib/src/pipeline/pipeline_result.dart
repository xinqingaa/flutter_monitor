import 'package:flutter_monitor_core/flutter_monitor_core.dart';

class PipelineResult {
  const PipelineResult._({
    required this.accepted,
    this.envelope,
    this.issues = const <SchemaValidationIssue>[],
  });

  final bool accepted;
  final EventEnvelope? envelope;
  final List<SchemaValidationIssue> issues;

  factory PipelineResult.accepted(EventEnvelope envelope) {
    return PipelineResult._(accepted: true, envelope: envelope);
  }

  factory PipelineResult.rejected(List<SchemaValidationIssue> issues) {
    return PipelineResult._(accepted: false, issues: issues);
  }
}
