import 'privacy_level.dart';

class PrivacyRule {
  const PrivacyRule({
    required this.path,
    required this.level,
    this.redactionReplacement = '[filtered]',
  });

  final String path;
  final PrivacyLevel level;
  final String redactionReplacement;
}

class PrivacyDecision {
  const PrivacyDecision({
    required this.path,
    required this.level,
    required this.allowed,
  });

  final String path;
  final PrivacyLevel level;
  final bool allowed;
}
