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
  static const android = 'android';
  static const ios = 'ios';
  static const native = 'native';
  static const unknown = 'unknown';
}

abstract final class SignalSources {
  static const sdkApi = 'sdk.api';
  static const sdkHttp = 'sdk.http';
  static const sdkDio = 'sdk.dio';
  static const sdkError = 'sdk.error';
  static const sdkJank = 'sdk.jank';
  static const sdkLifecycle = 'sdk.lifecycle';
  static const sdkMemory = 'sdk.memory';
  static const sdkNative = 'sdk.native';
  static const sdkPage = 'sdk.page';
  static const sdkRuntime = 'sdk.runtime';
  static const sdkTrack = 'sdk.track';
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

abstract final class StartupEndReasons {
  static const firstFrame = 'first_frame';
  static const interactive = 'interactive';
  static const timeout = 'timeout';
  static const manual = 'manual';
}

abstract final class PageEndReasons {
  static const routePop = 'route_pop';
  static const routeReplace = 'route_replace';
  static const lifecycleDetached = 'lifecycle.detached';
  static const appDispose = 'app.dispose';
}

abstract final class TriggerValues {
  static const manual = 'manual';
  static const jankSequence = 'jank.sequence';
  static const lifecyclePaused = 'lifecycle.paused';
  static const lifecycleHidden = 'lifecycle.hidden';
  static const lifecycleResumed = 'lifecycle.resumed';
  static const nativeBridge = 'native.bridge';
  static const sessionStart = 'session.start';

  static String lifecycleState(String state) {
    return switch (state) {
      LifecycleStates.paused => lifecyclePaused,
      LifecycleStates.hidden => lifecycleHidden,
      LifecycleStates.resumed => lifecycleResumed,
      _ => 'lifecycle.$state',
    };
  }
}
