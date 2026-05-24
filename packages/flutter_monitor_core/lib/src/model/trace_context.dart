import 'json_utils.dart';

class TraceContext {
  const TraceContext({
    this.sessionId,
    this.traceId,
    this.spanId,
    this.parentSpanId,
  });

  final String? sessionId;
  final String? traceId;
  final String? spanId;
  final String? parentSpanId;

  factory TraceContext.fromJson(Map<String, Object?> json) {
    return TraceContext(
      sessionId: json['sessionId'] as String?,
      traceId: json['traceId'] as String?,
      spanId: json['spanId'] as String?,
      parentSpanId: json['parentSpanId'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'sessionId': sessionId,
    'traceId': traceId,
    'spanId': spanId,
    'parentSpanId': parentSpanId,
  });
}
