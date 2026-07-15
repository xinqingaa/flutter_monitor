/// Builds a stable error fingerprint and related stack summaries.
///
/// Fingerprints group repeated throws (especially layout errors that fire every
/// frame) without collapsing unrelated Flutter errors into one bucket.
abstract final class ErrorFingerprint {
  static const int maxTitleLength = 160;
  static const int maxDiagnosticsLength = 2048;
  static const int maxStackHeadFrames = 3;

  /// Stable grouping key for dedupe / Workbench aggregation.
  static String build({
    required String name,
    required String type,
    required String message,
    String? stackHead,
    String? route,
  }) {
    final material = [
      name,
      type,
      normalizeMessage(message),
      stackHead ?? '',
      route ?? '',
    ].join('\n');
    return 'err_${_fnv1a64(material)}';
  }

  /// First-line title used for list display and fingerprint input.
  static String normalizeMessage(String message) {
    var line = message.split('\n').first.trim();
    line = line.replaceAll(RegExp(r'0x[0-9a-fA-F]+'), '0x…');
    line = line.replaceAll(RegExp(r'\s+'), ' ');
    if (line.length > maxTitleLength) {
      line = '${line.substring(0, maxTitleLength)}…';
    }
    return line;
  }

  /// Compact head of a stacktrace: symbol names only, no package paths/lines.
  static String? stackHead(StackTrace? stackTrace, {int maxFrames = maxStackHeadFrames}) {
    if (stackTrace == null) return null;
    final symbols = <String>[];
    for (final raw in stackTrace.toString().split('\n')) {
      final symbol = _frameSymbol(raw);
      if (symbol == null) continue;
      symbols.add(symbol);
      if (symbols.length >= maxFrames) break;
    }
    if (symbols.isEmpty) return null;
    return symbols.join(' > ');
  }

  /// First non-Flutter/Dart SDK frame, if any.
  static String? appFrame(StackTrace? stackTrace) {
    if (stackTrace == null) return null;
    for (final raw in stackTrace.toString().split('\n')) {
      final symbol = _frameSymbol(raw);
      if (symbol == null) continue;
      if (_isSdkFrame(raw.toLowerCase())) continue;
      if (raw.toLowerCase().contains('package:')) return symbol;
    }
    return null;
  }

  static bool _isSdkFrame(String lower) {
    return lower.contains('package:flutter/') ||
        lower.contains('package:flutter_test/') ||
        RegExp(r'(^|\s|\()dart:').hasMatch(lower);
  }

  static String? truncateDiagnostics(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.length <= maxDiagnosticsLength) return trimmed;
    return '${trimmed.substring(0, maxDiagnosticsLength)}…';
  }

  static String? _frameSymbol(String frame) {
    final trimmed = frame.trim();
    if (trimmed.isEmpty) return null;
    final match = RegExp(r'^#\d+\s+(.+?)(?:\s+\(|$)').firstMatch(trimmed);
    final symbol = (match?.group(1) ?? trimmed).trim();
    if (symbol.isEmpty) return null;
    return symbol;
  }

  static String _fnv1a64(String input) {
    var hash = 0xcbf29ce484222325;
    for (final unit in input.codeUnits) {
      hash ^= unit;
      hash = (hash * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF;
    }
    return hash.toRadixString(16).padLeft(16, '0');
  }
}
