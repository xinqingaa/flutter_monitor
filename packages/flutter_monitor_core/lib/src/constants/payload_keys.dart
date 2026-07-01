abstract final class PayloadKeys {
  static const unregisteredAttributes = 'unregistered.attributes';

  static const routeName = 'route.name';
  static const routePrevious = 'route.previous';

  static const httpSource = 'http.source';
  static const url = 'url';

  // HTTP 详情层（payload.http.detail）结构键。
  static const httpQuery = 'http.query';
  static const httpDetail = 'http.detail';
  static const httpDetailDropped = 'http.detail_dropped';
  static const request = 'request';
  static const response = 'response';
  static const headers = 'headers';
  static const body = 'body';
  static const bodyFormat = 'body_format';
  static const bodyContentType = 'body_content_type';
  static const bodyTruncated = 'body_truncated';
  static const bodyOriginalLength = 'body_original_length';
  static const bodySha256 = 'body_sha256';

  // 聚合 summary 事件 payload 键。
  static const exemplarEventIds = 'exemplar.event_ids';
  static const summaryDurationsMs = 'summary.durations_ms';
  static const error = 'error';
  static const errorTruncated = 'error.truncated';
  static const errorOriginalLength = 'error.original_length';
  static const output = 'output';
  static const issues = 'issues';
  static const stack = 'stack';
  static const source = 'source';
  static const traceId = 'traceId';
  static const spanId = 'spanId';
  static const signalName = 'signal.name';
  static const droppedSummary = 'dropped.summary';
  static const dropsByReason = 'drops.by_reason';
  static const reason = 'reason';
  static const isAppExiting = 'isAppExiting';

  static const type = 'type';
  static const page = 'page';
  static const category = 'category';
  static const method = 'method';
  static const status = 'status';
  static const success = 'success';
  static const exception = 'exception';
  static const message = 'message';
  static const library = 'library';
  static const context = 'context';
  static const timestamp = 'timestamp';
  static const identifier = 'identifier';

  static const trigger = 'trigger';
  static const evidence = 'evidence';
  static const assertion = 'assertion';
  static const sampleCount = 'sample_count';

  static const durationMs = 'duration_ms';
  static const backgroundDurationMs = 'background_duration_ms';
  static const startupPhase = 'startup.phase';
  static const sessionStartedNew = 'session.started_new';
  static const lifecyclePreviousState = 'lifecycle.previous_state';
  static const lifecycleTriggerState = 'lifecycle.trigger_state';
  static const lifecycleContextState = 'lifecycle.context_state';

  static const pageReplaced = 'page.replaced';
  static const pageEndReason = 'page.end_reason';

  static const jankCount = 'jank_count';
  static const maxDurationMs = 'max_duration_ms';
  static const averageDurationMs = 'average_duration_ms';
  static const frameBudgetMs = 'frame_budget_ms';
  static const devicePerformance = 'device_performance';
  static const jankThresholdMs = 'jank_threshold_ms';
  static const averageFrameTimeMs = 'average_frame_time_ms';
  static const frameTimeVariance = 'frame_time_variance';
  static const anomalousFrameCount = 'anomalous_frame_count';
  static const deviceLevel = 'device_level';
  static const recentFrameCount = 'recent_frame_count';
  static const percentiles = 'percentiles';
  static const fps = 'fps';
  static const stability = 'stability';
  static const p50 = 'p50';
  static const p90 = 'p90';
  static const p99 = 'p99';

  static const interaction = 'interaction';
  static const sampleStatus = 'sample_status';
  static const beforeFrameSummary = 'before_frame_summary';
  static const observedFrameSummary = 'observed_frame_summary';
  static const settleFrameSummary = 'settle_frame_summary';
  static const cancelReason = 'cancel_reason';
}
