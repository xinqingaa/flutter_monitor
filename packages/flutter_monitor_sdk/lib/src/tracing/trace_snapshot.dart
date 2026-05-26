import 'package:flutter_monitor_core/flutter_monitor_core.dart';

class TraceSnapshot {
  const TraceSnapshot({
    required this.sessionId,
    this.traceId,
    this.spanId,
    this.parentSpanId,
    this.breadcrumbs = const <Breadcrumb>[],
  });

  final String sessionId;
  final String? traceId;
  final String? spanId;
  final String? parentSpanId;
  final List<Breadcrumb> breadcrumbs;
}
