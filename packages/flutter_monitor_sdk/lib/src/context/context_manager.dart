import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/context/context_snapshot.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

/// 运行时 context/resource 快照管理器。
///
/// `ContextManager` 保存 SDK 当前已知的用户、路由、模块、发布、网络、
/// lifecycle、native 和设备信息。每次 [EventPipeline] 捕获事件时都会调用
/// [capture]，把这些动态状态固定成该事件自己的 `resource` 和 `context`。
///
/// 这里不负责发事件，只负责提供 envelope 构建所需的上下文快照。
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

  /// 捕获当前 resource/context 快照。
  ///
  /// 返回值会被 [EnvelopeBuilder] 直接写入 `EventEnvelope`。因此任何影响后续
  /// 事件上下文的运行时状态，都应该先写入本类，再由 pipeline 捕获。
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

  /// 设置运行时用户上下文。
  ///
  /// 这是统一 `setContext` 的用户 scope 落点，会覆盖初始化配置中的 userInfo。
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

  /// 清理运行时用户上下文，并阻止回退到初始化配置中的 userInfo。
  void clearUserContext() {
    _runtimeUserInfo = null;
    _runtimeUserCohort = null;
    _userContextCleared = true;
  }

  /// 设置当前 route context。
  ///
  /// route observer 在页面进入/恢复时调用，后续 HTTP、错误、卡顿等事件会使用
  /// 这里的 route 作为当前页面上下文。
  void setRouteName(String? routeName, {String? fullName}) {
    if (routeName == null || routeName.isEmpty) return;
    _currentRouteName = routeName;
    _currentRouteFullName = fullName == null || fullName.isEmpty
        ? routeName
        : fullName;
  }

  /// 设置模块上下文，对应 `context.module.*`。
  void setModule({String? name, String? scene}) {
    _currentModuleName = name;
    _currentScene = scene;
  }

  /// 清理模块上下文。
  void clearModule() {
    _currentModuleName = null;
    _currentScene = null;
  }

  /// 设置发布/灰度上下文，对应 `context.release.*`。
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

  /// 清理发布/灰度上下文。
  void clearRelease() {
    _runtimeRelease = null;
  }

  /// 设置网络上下文，对应 `context.network.*`。
  void setNetwork({String? type, bool? isWeakNetwork}) {
    _runtimeNetwork = NetworkContext(type: type, isWeakNetwork: isWeakNetwork);
  }

  /// 清理网络上下文。
  void clearNetwork() {
    _runtimeNetwork = null;
  }

  /// 更新 lifecycle context。
  ///
  /// Reporter 会在 lifecycle 事件进入 pipeline 前调用它，保证该事件和后续事件
  /// 都能看到最新的前后台状态。
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
