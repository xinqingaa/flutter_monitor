import '../constants/field_paths.dart';
import '../model/event_envelope.dart';
import '../model/event_level.dart';
import '../model/event_status.dart';
import '../model/signal_type.dart';
import 'event_summary.dart';

class EventSummarizer {
  const EventSummarizer();

  EventSummary summarize(EventEnvelope envelope) {
    final kind = _kindOf(envelope);
    return EventSummary(
      kind: kind,
      name: envelope.name,
      eventId: envelope.eventId,
      status: envelope.status?.toJson(),
      phase: _stringValue(envelope.attributes[FieldPaths.eventPhase]),
      sessionId: envelope.sessionId,
      traceId: envelope.traceId,
      spanId: envelope.spanId,
      route: envelope.context.route?.name,
      durationMs: envelope.durationMs,
      fields: _fieldsFor(kind, envelope),
      envelope: envelope,
    );
  }

  EventSummaryKind _kindOf(EventEnvelope envelope) {
    if (envelope.signalType == SignalType.error ||
        envelope.name.startsWith('error.')) {
      return EventSummaryKind.error;
    }
    if (envelope.signalType == SignalType.sdk ||
        envelope.name.startsWith('sdk.')) {
      return EventSummaryKind.sdk;
    }
    if (envelope.name == 'http.client' ||
        envelope.attributes.containsKey(FieldPaths.httpMethod) ||
        envelope.attributes.containsKey(FieldPaths.httpStatusCode)) {
      return EventSummaryKind.http;
    }
    if (envelope.name == 'ui.jank.sequence' ||
        envelope.name == 'jank.sequence' ||
        envelope.attributes.containsKey(FieldPaths.jankCount)) {
      return EventSummaryKind.jank;
    }
    if (envelope.name == 'app.cold_start' ||
        envelope.name == 'app.hot_start' ||
        envelope.attributes.containsKey(FieldPaths.appStartType)) {
      return EventSummaryKind.startup;
    }
    if (envelope.name.startsWith('page.') ||
        envelope.name.startsWith('route.')) {
      return EventSummaryKind.page;
    }
    if (envelope.context.lifecycle != null ||
        envelope.name.startsWith('lifecycle.') ||
        envelope.name.startsWith('app.lifecycle')) {
      return EventSummaryKind.lifecycle;
    }
    return EventSummaryKind.event;
  }

  Map<String, Object?> _fieldsFor(
    EventSummaryKind kind,
    EventEnvelope envelope,
  ) {
    return switch (kind) {
      EventSummaryKind.startup => _startupFields(envelope),
      EventSummaryKind.page => _pageFields(envelope),
      EventSummaryKind.http => _httpFields(envelope),
      EventSummaryKind.jank => _jankFields(envelope),
      EventSummaryKind.error => _errorFields(envelope),
      EventSummaryKind.lifecycle => _lifecycleFields(envelope),
      EventSummaryKind.sdk => _sdkFields(envelope),
      EventSummaryKind.event => _eventFields(envelope),
    };
  }

  Map<String, Object?> _startupFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'start_type': _stringValue(envelope.attributes[FieldPaths.appStartType]),
      'duration_ms': envelope.durationMs,
      'first_frame_ms': envelope.attributes[FieldPaths.appFirstFrameMs],
      'route': envelope.context.route?.name,
    });
  }

  Map<String, Object?> _pageFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'route': envelope.context.route?.name ?? envelope.payload['route.name'],
      'from': envelope.payload['route.previous'],
      'duration_ms': envelope.durationMs,
    });
  }

  Map<String, Object?> _httpFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'method': envelope.attributes[FieldPaths.httpMethod],
      'url':
          envelope.attributes[FieldPaths.httpUrlNormalized] ??
          envelope.payload['url'],
      'code': envelope.attributes[FieldPaths.httpStatusCode],
      'success': envelope.attributes[FieldPaths.httpSuccess],
      'duration_ms': envelope.durationMs,
      'route': envelope.context.route?.name,
      'breadcrumbs': _breadcrumbCount(envelope),
    });
  }

  Map<String, Object?> _jankFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'route': envelope.context.route?.name,
      'frames': envelope.attributes[FieldPaths.jankCount],
      'frame_max_ms': envelope.attributes[FieldPaths.frameMaxMs],
      'frame_avg_ms': envelope.attributes[FieldPaths.frameAvgMs],
      'fps': envelope.attributes[FieldPaths.frameFps],
    });
  }

  Map<String, Object?> _errorFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'mechanism':
          envelope.attributes[FieldPaths.errorMechanism] ??
          envelope.attributes[FieldPaths.errorType],
      'message': _errorMessage(envelope),
      'route': envelope.context.route?.name,
      'breadcrumbs': _breadcrumbCount(envelope),
    });
  }

  Map<String, Object?> _lifecycleFields(EventEnvelope envelope) {
    final lifecycle = envelope.context.lifecycle;
    return _withoutNulls(<String, Object?>{
      'state':
          lifecycle?.state ??
          envelope.attributes[FieldPaths.contextLifecycleState],
      'previous':
          lifecycle?.previousState ??
          envelope.attributes[FieldPaths.contextLifecyclePreviousState],
      'foreground':
          lifecycle?.isForeground ??
          envelope.attributes[FieldPaths.contextLifecycleIsForeground],
    });
  }

  Map<String, Object?> _sdkFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      if (envelope.context.route?.name != null)
        'route': envelope.context.route?.name,
    });
  }

  Map<String, Object?> _eventFields(EventEnvelope envelope) {
    return _withoutNulls(<String, Object?>{
      'route': envelope.context.route?.name,
      'duration_ms': envelope.durationMs,
    });
  }

  int? _breadcrumbCount(EventEnvelope envelope) {
    final breadcrumbs = envelope.payload[FieldPaths.payloadBreadcrumbs];
    if (breadcrumbs is Iterable) return breadcrumbs.length;
    return null;
  }

  Object? _errorMessage(EventEnvelope envelope) {
    final message = envelope.payload[FieldPaths.payloadErrorMessage];
    if (message != null) return message;

    final legacyData = envelope.payload['legacy.data'];
    if (legacyData is Map) {
      return legacyData['exception'] ?? legacyData['error'];
    }
    return null;
  }

  String? _stringValue(Object? value) => value == null ? null : '$value';

  Map<String, Object?> _withoutNulls(Map<String, Object?> fields) {
    return <String, Object?>{
      for (final entry in fields.entries)
        if (entry.value != null) entry.key: entry.value,
    };
  }
}

class CompactLogVisibilityPolicy {
  const CompactLogVisibilityPolicy({
    this.slowHttpThresholdMs = 1000,
    this.includePageViews = true,
  });

  final num slowHttpThresholdMs;
  final bool includePageViews;

  bool shouldDisplay(EventSummary summary) {
    final envelope = summary.envelope;
    final phase = summary.phase;

    return switch (summary.kind) {
      EventSummaryKind.error => true,
      EventSummaryKind.jank => true,
      EventSummaryKind.startup => phase != 'start',
      EventSummaryKind.http => _shouldDisplayHttp(summary),
      EventSummaryKind.page => _shouldDisplayPage(summary),
      EventSummaryKind.lifecycle => true,
      EventSummaryKind.sdk => _shouldDisplaySdk(envelope),
      EventSummaryKind.event => false,
    };
  }

  bool _shouldDisplayHttp(EventSummary summary) {
    final code = summary.fields['code'];
    final success = summary.fields['success'];
    final status = summary.status;
    if (status == EventStatus.error.toJson() ||
        success == false ||
        (code is num && code >= 400)) {
      return true;
    }
    final durationMs = summary.durationMs;
    return durationMs != null && durationMs >= slowHttpThresholdMs;
  }

  bool _shouldDisplayPage(EventSummary summary) {
    if (summary.name == 'route.push' || summary.name == 'route.pop') {
      return false;
    }
    if (summary.name == 'page.view') {
      return includePageViews;
    }
    if (summary.name == 'page.stay') {
      return true;
    }
    if (summary.name == 'page.load') {
      return summary.phase != 'start';
    }
    return false;
  }

  bool _shouldDisplaySdk(EventEnvelope envelope) {
    return envelope.status == EventStatus.error ||
        envelope.level == EventLevel.warning ||
        envelope.level == EventLevel.error ||
        envelope.level == EventLevel.fatal;
  }
}
