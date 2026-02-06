import 'dart:async';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

/// Reporter 是 SDK 的数据心脏，负责收集、丰富、缓存和发送所有监控事件。
class Reporter {
  final MonitorConfig _config;

  /// 缓存的设备信息，避免每次上报都重新获取。
  Map<String, dynamic>? _deviceInfo;

  /// 运行时用户信息（可动态更新）
  UserInfo? _runtimeUserInfo;

  /// 运行时自定义数据（可动态更新）
  Map<String, dynamic>? _runtimeCustomData;

  Reporter(this._config) {
    _init();
  }

  /// 获取最大队列大小
  int get maxQueueSize => _config.effectiveQueueConfig.maxQueueSize;

  void _init() {
    // 初始化所有在配置中提供的输出器
    for (final output in _config.effectiveOutputs) {
      output.init();
    }
  }

  /// 异步初始化，确保设备信息获取完成
  Future<void> initAsync() async {
    // 异步获取设备信息，确保在第一次上报前完成
    await _fetchDeviceInfo();
  }

  /// 使用 'device_info_plus' 插件异步获取设备信息。
  /// 可以在这里自定义需要收集的设备字段。
  Future<void> _fetchDeviceInfo() async {
    debugPrint("🔍 开始获取设备信息");
    final deviceInfoPlugin = DeviceInfoPlugin();
    try {
      if (kIsWeb) {
        final info = await deviceInfoPlugin.webBrowserInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'browserName': info.browserName.name,
          'appVersion': info.appVersion,
          'platform': info.platform,
        };
      } else if (Platform.isAndroid) {
        final info = await deviceInfoPlugin.androidInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'device': info.device,
          'model': info.model,
          'version': info.version.release,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      } else if (Platform.isIOS) {
        final info = await deviceInfoPlugin.iosInfo;
        _deviceInfo = {
          // 来源: device_info_plus
          'name': info.name,
          'model': info.model,
          'systemVersion': info.systemVersion,
          'isPhysicalDevice': info.isPhysicalDevice,
        };
      }
    } catch (e) {
      debugPrint("Failed to get device info: $e");
    }
  }

  /// 核心方法：添加一个事件到队列。
  /// 这是所有监控器与Reporter交互的入口。
  void addEvent(String eventCategory, Map<String, dynamic> data) {
    // --- 数据丰富 (Data Enrichment) ---
    // 这是关键步骤。Reporter 在这里将通用信息附加到每个事件上。
    final event = {
      // 'category': 事件的大分类 (e.g., 'error', 'performance', 'behavior')。
      // 来源: 由调用者（各个Monitor）传入。
      'category': eventCategory,

      // 'data': 事件的详细、特有数据。
      // 来源: 由调用者（各个Monitor）传入。
      'data': data,

      // --- 以下是 Reporter 自动附加的通用字段 ---
      // 'timestamp': 事件在客户端被捕获的时间 (本地时间，格式化为 YYYY-MM-DD HH:MM:ss)。
      // 来源: Dart 核心库。
      'timestamp': _formatTimestamp(DateTime.now()),

      // 应用信息（包含 appKey）
      'appInfo': {
        'appKey': _config.appInfo.appKey,
        'appVersion': _config.appInfo.appVersion,
        'buildNumber': _config.appInfo.buildNumber,
        'packageName': _config.appInfo.packageName,
        'appName': _config.appInfo.appName,
        'channel': _config.appInfo.channel,
        'environment': _config.appInfo.environment,
      },

      // 用户信息（优先使用运行时用户信息，否则使用配置中的用户信息）
      'userInfo': _getEffectiveUserInfo(),

      // 'customData': 开发者设置的自定义全局数据（优先使用运行时数据）。
      // 来源: 运行时数据 > MonitorConfig 配置。
      'customData': _getEffectiveCustomData(),

      // 'platform': 应用运行的平台 (e.g., 'web', 'android', 'ios')。
      // 来源: Flutter 核心库 (kIsWeb, Platform)。
      'platform': kIsWeb ? 'web' : Platform.operatingSystem,

      // 'deviceInfo': 从 'device_info_plus' 插件获取的设备信息。
      // 来源: _fetchDeviceInfo() 方法。
      'deviceInfo': _deviceInfo,
    };
    // 将丰富后的事件分发给每一个输出器。
    for (final output in _config.effectiveOutputs) {
      try {
        output.add(event);
      } catch (e) {
        debugPrint("Error while dispatching event to ${output.runtimeType}: $e");
      }
    }
  }


  /// 格式化时间戳为 YYYY-MM-DD HH:MM:ss 格式
  String _formatTimestamp(DateTime dateTime) {
    final year = dateTime.year.toString();
    final month = dateTime.month.toString().padLeft(2, '0');
    final day = dateTime.day.toString().padLeft(2, '0');
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    final second = dateTime.second.toString().padLeft(2, '0');
    
    return '$year-$month-$day $hour:$minute:$second';
  }

  /// 获取有效的用户信息（优先使用运行时数据）
  Map<String, dynamic>? _getEffectiveUserInfo() {
    final userInfo = _runtimeUserInfo ?? _config.userInfo;
    if (userInfo == null) return null;
    
    return {
      'userId': userInfo.userId,
      'userType': userInfo.userType,
      'userTags': userInfo.userTags,
      'userProperties': userInfo.userProperties,
    };
  }

  /// 获取有效的自定义数据（优先使用运行时数据）
  Map<String, dynamic>? _getEffectiveCustomData() {
    if (_runtimeCustomData != null) {
      return _runtimeCustomData;
    }
    return _config.customData;
  }

  /// 动态设置用户信息（运行时更新）
  void setUserInfo(UserInfo userInfo) {
    _runtimeUserInfo = userInfo;
    debugPrint("✅ 用户信息已更新: ${userInfo.userId}");
  }

  /// 动态设置用户ID（简化方法）
  void setUserId(String userId) {
    _runtimeUserInfo = UserInfo(userId: userId);
    debugPrint("✅ 用户ID已更新: $userId");
  }

  /// 动态设置自定义数据（运行时更新）
  void setCustomData(Map<String, dynamic> data) {
    _runtimeCustomData = data;
    debugPrint("✅ 自定义数据已更新: $data");
  }

  /// 清除用户信息（用户登出时调用）
  void clearUserInfo() {
    _runtimeUserInfo = null;
    debugPrint("✅ 用户信息已清除");
  }

  /// 清除自定义数据
  void clearCustomData() {
    _runtimeCustomData = null;
    debugPrint("✅ 自定义数据已清除");
  }

  /// 清理资源，在应用关闭时调用。
  void dispose() {
    // 调用所有输出器的 dispose 方法，让它们清理自己的资源。
    for (final output in _config.effectiveOutputs) {
      output.dispose();
    }
  }
}
