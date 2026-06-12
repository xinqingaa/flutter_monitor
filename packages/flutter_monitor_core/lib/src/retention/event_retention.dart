import '../model/wire_enum.dart';

/// Local degradation semantics for an event under resource pressure.
///
/// Retention is resolved by `RetentionRegistry` from event name, signal type
/// and key attributes. It is never written to the wire protocol; it only
/// drives sampling exemption, queue eviction order and compression actions
/// inside the SDK.
enum EventRetention implements WireEnum {
  /// Hard evidence. Never sampled out; details may be stripped, but the
  /// event itself is only dropped at physical limits with an audit count.
  hard('hard'),

  /// Valuable but compressible. Details may be stripped or events may be
  /// aggregated into summary events before being dropped.
  compressible('compressible'),

  /// High-frequency, samplable data. Evicted first under queue pressure.
  sampleable('sampleable');

  const EventRetention(this.wireValue);

  @override
  final String wireValue;

  String toJson() => wireValue;

  static EventRetention fromJson(Object? value) {
    return enumFromWireValue(values, value, EventRetention.compressible);
  }
}
