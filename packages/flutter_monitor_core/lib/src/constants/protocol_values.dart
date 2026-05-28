abstract final class ErrorMechanisms {
  static const dart = 'dart';
  static const flutter = 'flutter';
  static const manual = 'manual';
}

abstract final class ErrorTypes {
  static const dartError = 'dart_error';
  static const flutterError = 'flutter_error';
}

abstract final class HttpErrorTypes {
  static const badCertificate = 'bad_certificate';
  static const cancelled = 'cancelled';
  static const connectionError = 'connection_error';
  static const httpStatus = 'http_status';
  static const networkError = 'network_error';
  static const timeout = 'timeout';
  static const unknownNetwork = 'unknown_network';
}

abstract final class HttpPayloadSources {
  static const dio = 'dio';
  static const packageHttp = 'package:http';
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
