import 'event_summary.dart';
import 'event_summarizer.dart';

class CompactLogFormatter {
  const CompactLogFormatter({
    this.prefix = '[FM]',
    this.summarizer = const EventSummarizer(),
  });

  final String prefix;
  final EventSummarizer summarizer;

  String format(EventSummary summary) {
    final parts = <String>[prefix];
    for (final entry in summary.toKeyValueMap().entries) {
      final value = entry.value;
      if (value == null) continue;
      parts.add('${entry.key}=${_formatValue(value)}');
    }
    return parts.join(' ');
  }

  String _formatValue(Object value) {
    if (value is num) return _formatNum(value);
    if (value is bool) return value.toString();

    final text = value.toString();
    if (text.isEmpty) return '""';
    if (_needsQuoting(text)) {
      return '"${text.replaceAll(r'\', r'\\').replaceAll('"', r'\"')}"';
    }
    return text;
  }

  String _formatNum(num value) {
    if (value is int) return value.toString();
    final rounded = value.toStringAsFixed(1);
    return rounded.endsWith('.0')
        ? rounded.substring(0, rounded.length - 2)
        : rounded;
  }

  bool _needsQuoting(String text) {
    return text.contains(RegExp(r'\s')) ||
        text.contains('"') ||
        text.contains('=');
  }
}
