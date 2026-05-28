abstract final class EventNames {
  static const memorySample = 'memory.sample';
  static const memoryGrowth = 'memory.growth';
  static const memoryPressure = 'memory.pressure';
  static const memoryLeakSuspect = 'memory.leak.suspect';

  static const nativeMemorySample = 'native.memory.sample';
  static const nativeMemoryPressure = 'native.memory.pressure';
  static const nativeLifecycle = 'native.lifecycle';
  static const nativeWarning = 'native.warning';
  static const nativeCrash = 'native.crash';
  static const nativeOom = 'native.oom';
  static const nativeAnr = 'native.anr';

  static const appLifecycle = 'app.lifecycle';
  static const appForegroundDuration = 'app.foreground_duration';
  static const appBackgroundDuration = 'app.background_duration';
  static const appHotStart = 'app.hot_start';
  static const sdkLifecycleFlush = 'sdk.lifecycle.flush';
}
