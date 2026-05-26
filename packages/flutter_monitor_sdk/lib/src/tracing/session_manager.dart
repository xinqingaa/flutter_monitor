import 'package:flutter_monitor_sdk/src/utils/id_generator.dart';

class SessionManager {
  SessionManager({IdGenerator? idGenerator})
      : _idGenerator = idGenerator ?? IdGenerator() {
    _currentSessionId = _idGenerator.next('ses');
  }

  final IdGenerator _idGenerator;
  late String _currentSessionId;

  String get currentSessionId => _currentSessionId;

  String startNewSession() {
    _currentSessionId = _idGenerator.next('ses');
    return _currentSessionId;
  }
}
