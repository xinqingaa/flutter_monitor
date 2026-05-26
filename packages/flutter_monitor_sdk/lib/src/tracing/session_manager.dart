import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

class SessionManager {
  SessionManager({IdGenerator? idGenerator})
    : _idGenerator = idGenerator ?? IdGenerator() {
    _currentSessionId = _idGenerator.next('ses');
  }

  final IdGenerator _idGenerator;
  late String _currentSessionId;
  DateTime? _backgroundAt;

  String get currentSessionId => _currentSessionId;
  DateTime? get backgroundAt => _backgroundAt;

  String startNewSession() {
    _currentSessionId = _idGenerator.next('ses');
    return _currentSessionId;
  }

  void markBackgrounded(DateTime timestamp) {
    _backgroundAt = timestamp;
  }

  SessionResumeResult handleResumed({
    required DateTime timestamp,
    required Duration backgroundSessionTimeout,
  }) {
    final previousBackgroundAt = _backgroundAt;
    _backgroundAt = null;
    if (previousBackgroundAt == null) {
      return SessionResumeResult(
        sessionId: currentSessionId,
        previousBackgroundAt: null,
        backgroundDuration: null,
        startedNewSession: false,
      );
    }

    final backgroundDuration = timestamp.difference(previousBackgroundAt);
    final shouldStartNewSession =
        backgroundDuration >= backgroundSessionTimeout;
    if (shouldStartNewSession) {
      startNewSession();
    }

    return SessionResumeResult(
      sessionId: currentSessionId,
      previousBackgroundAt: previousBackgroundAt,
      backgroundDuration: backgroundDuration,
      startedNewSession: shouldStartNewSession,
    );
  }
}

class SessionResumeResult {
  const SessionResumeResult({
    required this.sessionId,
    required this.startedNewSession,
    this.previousBackgroundAt,
    this.backgroundDuration,
  });

  final String sessionId;
  final DateTime? previousBackgroundAt;
  final Duration? backgroundDuration;
  final bool startedNewSession;
}
