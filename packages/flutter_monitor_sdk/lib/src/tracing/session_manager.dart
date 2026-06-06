import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

/// session 生命周期管理器。
///
/// session 表示一次用户使用过程或一段可分析的 App 活动窗口。该类负责生成 session id、
/// 记录进入后台时间，并在恢复前台时根据超时配置决定是否切分新 session。
class SessionManager {
  /// 创建 session manager，并立即生成首个 session id。
  SessionManager({IdGenerator? idGenerator})
    : _idGenerator = idGenerator ?? IdGenerator() {
    _currentSessionId = _idGenerator.next('ses');
  }

  final IdGenerator _idGenerator;
  late String _currentSessionId;
  DateTime? _backgroundAt;

  /// 当前 session id。
  String get currentSessionId => _currentSessionId;

  /// 最近一次进入后台的时间。
  DateTime? get backgroundAt => _backgroundAt;

  /// 主动切分并开启新 session。
  String startNewSession() {
    _currentSessionId = _idGenerator.next('ses');
    return _currentSessionId;
  }

  /// 标记 App 进入后台的时间。
  void markBackgrounded(DateTime timestamp) {
    _backgroundAt = timestamp;
  }

  /// 处理 App 从后台恢复。
  ///
  /// 返回值包含后台停留时长、是否切分新 session，以及恢复后应使用的 session id。
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

/// App 从后台恢复时的 session 计算结果。
class SessionResumeResult {
  const SessionResumeResult({
    required this.sessionId,
    required this.startedNewSession,
    this.previousBackgroundAt,
    this.backgroundDuration,
  });

  /// 恢复后应使用的 session id。
  final String sessionId;

  /// 本次恢复对应的进入后台时间。
  final DateTime? previousBackgroundAt;

  /// 后台停留时长。
  final Duration? backgroundDuration;

  /// 是否因为后台超时切分了新 session。
  final bool startedNewSession;
}
