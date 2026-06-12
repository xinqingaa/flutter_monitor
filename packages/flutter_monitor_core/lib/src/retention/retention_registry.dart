import '../constants/event_names.dart';
import '../constants/field_paths.dart';
import '../constants/protocol_values.dart';
import '../model/event_envelope.dart';
import '../model/signal_type.dart';
import 'event_retention.dart';

/// Single source of truth that maps events to their [EventRetention] level.
///
/// The mapping is derived from `docs/event_model.md` (证据保留等级). Hard
/// admission rule: only events whose rate is structurally bounded (or rate
/// limited with aggregation, like business track breadcrumbs) may be hard.
class RetentionRegistry {
  const RetentionRegistry();

  static const RetentionRegistry instance = RetentionRegistry();

  EventRetention resolveEnvelope(EventEnvelope envelope) {
    return resolve(
      name: envelope.name,
      signalType: envelope.signalType,
      attributes: envelope.attributes,
    );
  }

  /// Resolves retention from a raw envelope JSON map (wire shape), e.g. when
  /// classifying events on the output/queue side without rehydrating a full
  /// [EventEnvelope].
  EventRetention resolveJson(Map<String, Object?> envelope) {
    final attributes = envelope['attributes'];
    return resolve(
      name: envelope['name'] as String? ?? '',
      signalType: SignalType.fromJson(envelope['signalType']),
      attributes: attributes is Map
          ? attributes.cast<String, Object?>()
          : const <String, Object?>{},
    );
  }

  EventRetention resolve({
    required String name,
    required SignalType signalType,
    Map<String, Object?> attributes = const <String, Object?>{},
  }) {
    if (signalType == SignalType.error) return EventRetention.hard;

    if (signalType == SignalType.sdk) {
      if (name == EventNames.sdkInit || name == EventNames.sdkHealthReport) {
        return EventRetention.hard;
      }
      return EventRetention.sampleable;
    }

    if (name == EventNames.httpClient) return EventRetention.hard;
    // 聚合摘要是降级阶梯的最终产物，本身已压缩，速率结构性有界。
    if (name == EventNames.httpClientSummary ||
        name == EventNames.businessActionSummary) {
      return EventRetention.hard;
    }
    if (name == EventNames.interactionMeasure) return EventRetention.hard;
    if (name == EventNames.uiJankSequence) return EventRetention.hard;
    if (name == EventNames.memoryPressure ||
        name == EventNames.nativeMemoryPressure ||
        name == EventNames.memoryLeakSuspect) {
      return EventRetention.hard;
    }
    if (name == EventNames.appColdStart || name == EventNames.appHotStart) {
      return attributes[FieldPaths.eventPhase] == EventPhases.end
          ? EventRetention.hard
          : EventRetention.compressible;
    }
    if (signalType == SignalType.breadcrumb &&
        attributes.containsKey(FieldPaths.businessAction)) {
      return EventRetention.hard;
    }

    if (name == EventNames.memorySample ||
        name == EventNames.nativeMemorySample) {
      return EventRetention.sampleable;
    }

    return EventRetention.compressible;
  }
}
