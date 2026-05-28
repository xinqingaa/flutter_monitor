abstract final class PayloadKeys {
  static const unregisteredAttributes = 'unregistered.attributes';

  static const routeName = 'route.name';
  static const routePrevious = 'route.previous';

  static const legacyCategory = 'legacy.category';
  static const legacyData = 'legacy.data';

  static const httpSource = 'http.source';
  static const url = 'url';
  static const error = 'error';
  static const output = 'output';
  static const issues = 'issues';
  static const stack = 'stack';
  static const source = 'source';
  static const traceId = 'traceId';
  static const spanId = 'spanId';
  static const signalName = 'signal.name';
  static const isAppExiting = 'isAppExiting';

  static const type = 'type';
  static const page = 'page';
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
  static const startupPhase = 'startup.phase';
  static const sessionStartedNew = 'session.started_new';
  static const lifecyclePreviousState = 'lifecycle.previous_state';
  static const lifecycleTriggerState = 'lifecycle.trigger_state';
  static const lifecycleContextState = 'lifecycle.context_state';

  static const pageReplaced = 'page.replaced';

  static const jankCount = 'jank_count';
  static const maxDurationMs = 'max_duration_ms';
  static const averageDurationMs = 'average_duration_ms';
  static const frameBudgetMs = 'frame_budget_ms';
  static const devicePerformance = 'device_performance';
  static const percentiles = 'percentiles';
  static const fps = 'fps';
  static const stability = 'stability';
  static const p50 = 'p50';
  static const p90 = 'p90';
  static const p99 = 'p99';
}
