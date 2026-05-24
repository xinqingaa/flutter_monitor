import '../model/json_utils.dart';

class SchemaValidationIssue {
  const SchemaValidationIssue({
    required this.path,
    required this.message,
    this.code,
  });

  final String path;
  final String message;
  final String? code;

  Map<String, Object?> toJson() =>
      jsonMap({'path': path, 'message': message, 'code': code});
}
