import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

class ContextManager {
  ContextManager(this._config);

  final MonitorConfig _config;

  Map<String, Object?>? _deviceInfo;
  UserInfo? _runtimeUserInfo;
  Map<String, Object?>? _runtimeCustomData;
  String? _currentRouteName;
  String? _currentModuleName;
  String? _currentScene;
  String? _lifecycleState;
  String? _previousLifecycleState;

  set deviceInfo(Map<String, Object?>? value) {
    _deviceInfo = value;
  }

  Map<String, Object?>? get customData =>
      _runtimeCustomData ?? _config.customData?.cast<String, Object?>();

  ContextSnapshot capture() {
    final userInfo = _runtimeUserInfo ?? _config.userInfo;
    final effectiveCustomData = customData;
    final hasContext = userInfo != null ||
        effectiveCustomData != null ||
        _currentRouteName != null ||
        _currentModuleName != null ||
        _currentScene != null ||
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
              ),
        route: _currentRouteName == null
            ? null
            : RouteContext(
                name: _currentRouteName,
                stack: <String>[_currentRouteName!],
                source: 'flutter',
              ),
        module: _currentModuleName == null && _currentScene == null
            ? null
            : ModuleContext(name: _currentModuleName, scene: _currentScene),
        lifecycle: _lifecycleState == null
            ? null
            : LifecycleContext(
                state: _lifecycleState,
                previousState: _previousLifecycleState,
                isForeground: _lifecycleState == 'resumed',
              ),
        native: NativeRuntimeContext(
          available: false,
          platform: _platform,
          signalSource: 'flutter',
        ),
        missing: !hasContext,
        missingReason:
            hasContext ? null : ContextMissingReasons.sdkBootstrapIncomplete,
      ),
      customData: effectiveCustomData,
      userProperties: userInfo?.userProperties?.cast<String, Object?>(),
    );
  }

  void setUserInfo(UserInfo userInfo) {
    _runtimeUserInfo = userInfo;
  }

  void setUserId(String userId) {
    _runtimeUserInfo = UserInfo(userId: userId);
  }

  void clearUserInfo() {
    _runtimeUserInfo = null;
  }

  void setCustomData(Map<String, dynamic> data) {
    _runtimeCustomData = data.cast<String, Object?>();
  }

  void clearCustomData() {
    _runtimeCustomData = null;
  }

  void setRouteName(String? routeName) {
    if (routeName == null || routeName.isEmpty) return;
    _currentRouteName = routeName;
  }

  void setModule({String? name, String? scene}) {
    _currentModuleName = name;
    _currentScene = scene;
  }

  void setLifecycleState(String state) {
    _previousLifecycleState = _lifecycleState;
    _lifecycleState = state;
  }

  MonitorResource _buildResource() {
    return MonitorResource(
      sdk: const SdkResource(
        name: 'flutter_monitor_sdk',
        coreVersion: '0.1.0',
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
        osVersion:
            _stringDeviceValue('version') ?? _stringDeviceValue('systemVersion'),
        isPhysicalDevice: _deviceInfo?['isPhysicalDevice'] as bool?,
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

  String get _platform => kIsWeb ? 'web' : Platform.operatingSystem;
}
