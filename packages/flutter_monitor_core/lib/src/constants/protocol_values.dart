abstract final class ErrorMechanisms {
  static const dart = 'dart';
  static const flutter = 'flutter';
  static const manual = 'manual';
}

abstract final class ErrorTypes {
  static const dartError = 'dart_error';
  static const flutterError = 'flutter_error';
}

abstract final class EventPhases {
  static const start = 'start';
  static const end = 'end';
  static const instant = 'instant';
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

abstract final class SdkConfigSources {
  static const defaultConfig = 'default';
  static const local = 'local';
  static const remote = 'remote';
  static const cachedRemote = 'cached_remote';
}

abstract final class SdkDropReasons {
  static const sampledOut = 'sampled_out';
  static const rateLimited = 'rate_limited';
  static const queueFull = 'queue_full';
  static const payloadTooLarge = 'payload_too_large';
  static const nonRetryableRejected = 'non_retryable_rejected';
  static const storeCorrupted = 'store_corrupted';
  static const expired = 'expired';
  static const killSwitch = 'kill_switch';
}

abstract final class SdkFlushReasons {
  static const batchSize = 'batch_size';
  static const interval = 'interval';
  static const background = 'background';
  static const appExit = 'app_exit';
  static const criticalEvent = 'critical_event';
  static const manual = 'manual';
}

abstract final class SdkOutputModes {
  static const consoleOnly = 'consoleOnly';
  static const localLive = 'localLive';
  static const production = 'production';
}

abstract final class SdkRetryReasons {
  static const timeout = 'timeout';
  static const offline = 'offline';
  static const rateLimited = 'rate_limited';
  static const serverError = 'server_error';
  static const partialRetryable = 'partial_retryable';
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
  static const sdkMeasure = 'sdk.measure';
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

abstract final class PageActivePhases {
  static const enter = 'page.enter';
  static const covered = 'page.covered';
  static const exit = 'page.exit';
  static const resume = 'page.resume';
  static const lifecycleBackground = 'lifecycle.background';
  static const appDispose = 'app.dispose';
}

abstract final class PageActiveTriggers {
  static const routePush = 'route_push';
  static const routePop = 'route_pop';
  static const lifecycleResumed = 'lifecycle_resumed';
  static const lifecycleBackground = 'lifecycle_background';
  static const routeReplace = 'route_replace';
  static const appDispose = 'app_dispose';
}

abstract final class InteractionEndReasons {
  static const autoWindow = 'auto_window';
  static const finish = 'finish';
  static const cancel = 'cancel';
  static const timeout = 'timeout';
  static const dispose = 'dispose';
}

abstract final class TriggerValues {
  static const manual = 'manual';
  static const jankSequence = 'jank.sequence';
  static const lifecyclePaused = 'lifecycle.paused';
  static const lifecycleHidden = 'lifecycle.hidden';
  static const lifecycleResumed = 'lifecycle.resumed';
  static const nativeBridge = 'native.bridge';
  static const sessionStart = 'session.start';
  static const pageEnter = PageActivePhases.enter;
  static const pageCovered = PageActivePhases.covered;
  static const pageExit = PageActivePhases.exit;
  static const pageResume = PageActivePhases.resume;
  static const lifecycleBackground = PageActivePhases.lifecycleBackground;
  static const appDispose = PageActivePhases.appDispose;

  static String lifecycleState(String state) {
    return switch (state) {
      LifecycleStates.paused => lifecyclePaused,
      LifecycleStates.hidden => lifecycleHidden,
      LifecycleStates.resumed => lifecycleResumed,
      _ => 'lifecycle.$state',
    };
  }
}
