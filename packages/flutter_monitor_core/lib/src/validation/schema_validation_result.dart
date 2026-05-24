import 'schema_validation_issue.dart';

class SchemaValidationResult {
  const SchemaValidationResult({
    this.errors = const <SchemaValidationIssue>[],
    this.warnings = const <SchemaValidationIssue>[],
  });

  final List<SchemaValidationIssue> errors;
  final List<SchemaValidationIssue> warnings;

  bool get isValid => errors.isEmpty;
}
