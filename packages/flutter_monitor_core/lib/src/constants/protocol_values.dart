abstract final class ErrorMechanisms {
  static const dart = 'dart';
  static const flutter = 'flutter';
  static const manual = 'manual';
}

abstract final class HttpErrorTypes {
  static const httpStatus = 'http_status';
  static const networkError = 'network_error';
}

abstract final class HttpPayloadSources {
  static const dio = 'dio';
  static const packageHttp = 'package:http';
}

abstract final class LegacyCategories {
  static const behavior = 'behavior';
  static const error = 'error';
  static const performance = 'performance';
}

abstract final class LegacyTypes {
  static const api = 'api';
  static const click = 'click';
  static const dartError = 'dart_error';
  static const event = 'event';
  static const flutterError = 'flutter_error';
  static const jankSequence = 'jank_sequence';
  static const pageLoad = 'page_load';
  static const pageStay = 'page_stay';
  static const pv = 'pv';
}

abstract final class LifecycleStates {
  static const detached = 'detached';
  static const hidden = 'hidden';
  static const inactive = 'inactive';
  static const paused = 'paused';
  static const resumed = 'resumed';
}

abstract final class PayloadAssertions {
  static const suspectOnly = 'suspect_only';
}

abstract final class PlatformSignalSources {
  static const flutter = 'flutter';
}

abstract final class StartTypes {
  static const cold = 'cold';
  static const hot = 'hot';
}

abstract final class StartupPhases {
  static const coldStart = 'cold_start';
  static const firstFrame = 'first_frame';
  static const sdkInit = 'sdk_init';
}

abstract final class TriggerValues {
  static const manual = 'manual';
}
