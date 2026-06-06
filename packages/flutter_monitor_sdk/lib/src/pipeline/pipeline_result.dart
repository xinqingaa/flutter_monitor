import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// pipeline 捕获事件后的结果。
///
/// 被接受时包含已经完成构建、校验和隐私过滤的 [EventEnvelope]；被拒绝时包含
/// schema 校验或构建错误。采集器可以用它做测试断言或内部降级处理。
class PipelineResult {
  const PipelineResult._({
    required this.accepted,
    this.envelope,
    this.issues = const <SchemaValidationIssue>[],
  });

  /// 事件是否被 pipeline 接受并分发给 outputs。
  final bool accepted;

  /// 成功构建的 envelope；仅 [accepted] 为 true 时存在。
  final EventEnvelope? envelope;

  /// 拒绝原因列表；通常来自 schema validator。
  final List<SchemaValidationIssue> issues;

  factory PipelineResult.accepted(EventEnvelope envelope) {
    return PipelineResult._(accepted: true, envelope: envelope);
  }

  factory PipelineResult.rejected(List<SchemaValidationIssue> issues) {
    return PipelineResult._(accepted: false, issues: issues);
  }
}
