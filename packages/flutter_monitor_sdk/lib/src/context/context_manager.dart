import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

class ContextManager {
  ContextManager(this._config);

  final MonitorConfig _config;

  Map<String, Object?>? _deviceInfo;
  NativeResourceSnapshot? _nativeSnapshot;
  UserInfo? _runtimeUserInfo;
  String? _runtimeUserCohort;
  bool _userContextCleared = false;
  Map<String, Object?>? _runtimeCustomData;
  ReleaseContext? _runtimeRelease;
  NetworkContext? _runtimeNetwork;
  String? _currentRouteName;
  String? _currentRouteFullName;
  String? _currentModuleName;
  String? _currentScene;
  String? _lifecycleState;
  String? _previousLifecycleState;

  String? get lifecycleState => _lifecycleState;
  String? get previousLifecycleState => _previousLifecycleState;

  set deviceInfo(Map<String, Object?>? value) {
    _deviceInfo = value;
  }

  void setNativeSnapshot(NativeResourceSnapshot? snapshot) {
    _nativeSnapshot = snapshot;
  }

  Map<String, Object?>? get customData =>
      _runtimeCustomData ?? _config.customData?.cast<String, Object?>();

  ContextSnapshot capture() {
    final userInfo = _userContextCleared
        ? null
        : _runtimeUserInfo ?? _config.userInfo;
    final userCohort = _runtimeUserInfo == null ? null : _runtimeUserCohort;
    final effectiveCustomData = customData;
    final hasContext =
        userInfo != null ||
        effectiveCustomData != null ||
        _currentRouteName != null ||
        _currentModuleName != null ||
        _currentScene != null ||
        _runtimeNetwork != null ||
        _runtimeRelease != null ||
        _lifecycleState != null;

    return ContextSnapshot(
      resource: _buildResource(),
      context: MonitorContext(
        user: userInfo == null
            ? null
            : UserContext(
                userId: userInfo.userId,
                userType: userInfo.userType,
                userTags: userInfo.userTags,
                cohort: userCohort,
              ),
        route: _currentRouteName == null
            ? null
            : RouteContext(
                name: _currentRouteName,
                fullName: _currentRouteFullName,
                stack: <String>[_currentRouteFullName ?? _currentRouteName!],
                source: PlatformSignalSources.flutter,
              ),
        module: _currentModuleName == null && _currentScene == null
            ? null
            : ModuleContext(name: _currentModuleName, scene: _currentScene),
        network: _runtimeNetwork,
        release: _runtimeRelease,
        lifecycle: _lifecycleState == null
            ? null
            : LifecycleContext(
                state: _lifecycleState,
                previousState: _previousLifecycleState,
                isForeground: _lifecycleState == LifecycleStates.resumed,
              ),
        native: _buildNativeContext(),
        missing: !hasContext,
        missingReason: hasContext
            ? null
            : ContextMissingReasons.sdkBootstrapIncomplete,
      ),
      customData: effectiveCustomData,
      userProperties: userInfo?.userProperties?.cast<String, Object?>(),
    );
  }

  void setUserInfo(UserInfo userInfo) {
    _runtimeUserInfo = userInfo;
    _runtimeUserCohort = null;
    _userContextCleared = false;
  }

  void setUserId(String userId) {
    _runtimeUserInfo = UserInfo(userId: userId);
    _runtimeUserCohort = null;
    _userContextCleared = false;
  }

  void clearUserInfo() {
    _runtimeUserInfo = null;
    _runtimeUserCohort = null;
    _userContextCleared = true;
  }

  void setCustomData(Map<String, dynamic> data) {
    _runtimeCustomData = data.cast<String, Object?>();
  }

  void clearCustomData() {
    _runtimeCustomData = null;
  }

  void setUserContext({
    String? userId,
    String? userType,
    List<String>? userTags,
    String? cohort,
  }) {
    _runtimeUserInfo = UserInfo(
      userId: userId,
      userType: userType,
      userTags: userTags,
    );
    _runtimeUserCohort = cohort;
    _userContextCleared = false;
  }

  void clearUserContext() {
    _runtimeUserInfo = null;
    _runtimeUserCohort = null;
    _userContextCleared = true;
  }

  void setRouteName(String? routeName, {String? fullName}) {
    if (routeName == null || routeName.isEmpty) return;
    _currentRouteName = routeName;
    _currentRouteFullName = fullName == null || fullName.isEmpty
        ? routeName
        : fullName;
  }

  void setModule({String? name, String? scene}) {
    _currentModuleName = name;
    _currentScene = scene;
  }

  void clearModule() {
    _currentModuleName = null;
    _currentScene = null;
  }

  void setRelease({
    String? releaseId,
    List<String>? featureFlags,
    Map<String, Object?>? experiments,
  }) {
    _runtimeRelease = ReleaseContext(
      releaseId: releaseId,
      featureFlags: featureFlags,
      experiments: experiments,
    );
  }

  void clearRelease() {
    _runtimeRelease = null;
  }

  void setNetwork({String? type, bool? isWeakNetwork}) {
    _runtimeNetwork = NetworkContext(type: type, isWeakNetwork: isWeakNetwork);
  }

  void clearNetwork() {
    _runtimeNetwork = null;
  }

  void setLifecycleState(String state) {
    _previousLifecycleState = _lifecycleState;
    _lifecycleState = state;
  }

  MonitorResource _buildResource() {
    return MonitorResource(
      sdk: SdkResource(
        name: 'flutter_monitor_sdk',
        coreVersion: '0.1.0',
        nativeVersion: _nativeSnapshot?.bridgeVersion,
      ),
      app: AppResource(
        appKey: _config.appInfo.appKey,
        appName: _config.appInfo.appName,
        appVersion: _config.appInfo.appVersion,
        buildNumber: _config.appInfo.buildNumber,
        packageName: _config.appInfo.packageName,
        environment: _config.appInfo.environment,
        channel: _config.appInfo.channel,
      ),
      device: DeviceResource(
        platform: _platform,
        model: _stringDeviceValue('model') ?? _stringDeviceValue('device'),
        manufacturer: _stringDeviceValue('manufacturer'),
        osVersion:
            _stringDeviceValue('version') ??
            _stringDeviceValue('systemVersion'),
        isPhysicalDevice: _deviceInfo?['isPhysicalDevice'] as bool?,
        refreshRate: _refreshRate,
        deviceTier: _deviceTier,
      ),
      runtime: RuntimeResource(
        dartVersion: Platform.version.split(' ').first,
        isDebug: kDebugMode,
      ),
    );
  }

  String? _stringDeviceValue(String key) {
    final value = _deviceInfo?[key];
    return value?.toString();
  }

  double? get _refreshRate {
    if (kIsWeb) return null;
    final views = PlatformDispatcher.instance.views;
    if (views.isEmpty) return null;
    final refreshRate = views.first.display.refreshRate;
    if (refreshRate <= 0) return null;
    return refreshRate;
  }

  String get _deviceTier {
    final refreshRate = _refreshRate;
    if (refreshRate == null) return 'unknown';
    if (refreshRate >= 120) return 'high';
    if (refreshRate >= 90) return 'mid';
    return 'unknown';
  }

  String get _platform => kIsWeb ? 'web' : Platform.operatingSystem;

  NativeRuntimeContext _buildNativeContext() {
    final snapshot = _nativeSnapshot;
    if (snapshot == null) {
      return NativeRuntimeContext(
        available: false,
        platform: _platform,
        signalSource: PlatformSignalSources.flutter,
      );
    }
    return NativeRuntimeContext(
      available: snapshot.available,
      platform: snapshot.platform ?? _platform,
      processId: snapshot.processId,
      bridgeVersion: snapshot.bridgeVersion,
      signalSource: snapshot.signalSource ?? PlatformSignalSources.native,
    );
  }
}
