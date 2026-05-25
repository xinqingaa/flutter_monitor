abstract final class ContextMissingReasons {
  static const preSession = 'pre_session';
  static const sdkBootstrapIncomplete = 'sdk_bootstrap_incomplete';
  static const appStartTimeMissing = 'app_start_time_missing';
  static const routeNameMissing = 'route_name_missing';
  static const routeStackUnavailable = 'route_stack_unavailable';
  static const nativeBridgeUnavailable = 'native_bridge_unavailable';
  static const platformLimited = 'platform_limited';
  static const privacyFiltered = 'privacy_filtered';

  static const values = <String>{
    preSession,
    sdkBootstrapIncomplete,
    appStartTimeMissing,
    routeNameMissing,
    routeStackUnavailable,
    nativeBridgeUnavailable,
    platformLimited,
    privacyFiltered,
  };

  static bool contains(String value) => values.contains(value);
}
