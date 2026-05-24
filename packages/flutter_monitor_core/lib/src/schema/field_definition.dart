import '../model/json_utils.dart';
import '../privacy/privacy_level.dart';
import 'field_requirement.dart';
import 'field_value_type.dart';

class FieldDefinition {
  const FieldDefinition({
    required this.path,
    required this.valueType,
    this.requirement = FieldRequirement.optional,
    this.privacyLevel = PrivacyLevel.safe,
    this.indexed = false,
    this.description,
  });

  final String path;
  final FieldValueType valueType;
  final FieldRequirement requirement;
  final PrivacyLevel privacyLevel;
  final bool indexed;
  final String? description;

  factory FieldDefinition.fromJson(Map<String, Object?> json) {
    return FieldDefinition(
      path: json['path'] as String? ?? '',
      valueType: FieldValueType.fromJson(json['valueType']),
      requirement: FieldRequirement.fromJson(json['requirement']),
      privacyLevel: PrivacyLevel.fromJson(json['privacyLevel']),
      indexed: json['indexed'] as bool? ?? false,
      description: json['description'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'path': path,
    'valueType': valueType.toJson(),
    'requirement': requirement.toJson(),
    'privacyLevel': privacyLevel.toJson(),
    'indexed': indexed,
    'description': description,
  });
}
