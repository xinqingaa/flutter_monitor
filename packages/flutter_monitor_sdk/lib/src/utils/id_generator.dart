class IdGenerator {
  IdGenerator({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;
  int _counter = 0;

  String next(String prefix) {
    final micros = _now().microsecondsSinceEpoch;
    final sequence = _counter++;
    return '${prefix}_${micros}_$sequence';
  }
}
