import 'json_utils.dart';

class SdkResource {
  const SdkResource({
    this.name,
    this.version,
    this.coreVersion,
    this.nativeVersion,
  });

  final String? name;
  final String? version;
  final String? coreVersion;
  final String? nativeVersion;

  factory SdkResource.fromJson(Map<String, Object?> json) {
    return SdkResource(
      name: json['name'] as String?,
      version: json['version'] as String?,
      coreVersion: json['coreVersion'] as String?,
      nativeVersion: json['nativeVersion'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'name': name,
    'version': version,
    'coreVersion': coreVersion,
    'nativeVersion': nativeVersion,
  });
}

class AppResource {
  const AppResource({
    this.appKey,
    this.appName,
    this.appVersion,
    this.buildNumber,
    this.packageName,
    this.environment,
    this.channel,
    this.flavor,
  });

  final String? appKey;
  final String? appName;
  final String? appVersion;
  final String? buildNumber;
  final String? packageName;
  final String? environment;
  final String? channel;
  final String? flavor;

  factory AppResource.fromJson(Map<String, Object?> json) {
    return AppResource(
      appKey: json['appKey'] as String?,
      appName: json['appName'] as String?,
      appVersion: json['appVersion'] as String?,
      buildNumber: json['buildNumber'] as String?,
      packageName: json['packageName'] as String?,
      environment: json['environment'] as String?,
      channel: json['channel'] as String?,
      flavor: json['flavor'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'appKey': appKey,
    'appName': appName,
    'appVersion': appVersion,
    'buildNumber': buildNumber,
    'packageName': packageName,
    'environment': environment,
    'channel': channel,
    'flavor': flavor,
  });
}

class DeviceResource {
  const DeviceResource({
    this.platform,
    this.model,
    this.manufacturer,
    this.osVersion,
    this.isPhysicalDevice,
    this.refreshRate,
    this.deviceTier,
  });

  final String? platform;
  final String? model;
  final String? manufacturer;
  final String? osVersion;
  final bool? isPhysicalDevice;
  final num? refreshRate;
  final String? deviceTier;

  factory DeviceResource.fromJson(Map<String, Object?> json) {
    return DeviceResource(
      platform: json['platform'] as String?,
      model: json['model'] as String?,
      manufacturer: json['manufacturer'] as String?,
      osVersion: json['osVersion'] as String?,
      isPhysicalDevice: json['isPhysicalDevice'] as bool?,
      refreshRate: json['refreshRate'] as num?,
      deviceTier: json['deviceTier'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'platform': platform,
    'model': model,
    'manufacturer': manufacturer,
    'osVersion': osVersion,
    'isPhysicalDevice': isPhysicalDevice,
    'refreshRate': refreshRate,
    'deviceTier': deviceTier,
  });
}

class RuntimeResource {
  const RuntimeResource({this.flutterVersion, this.dartVersion, this.isDebug});

  final String? flutterVersion;
  final String? dartVersion;
  final bool? isDebug;

  factory RuntimeResource.fromJson(Map<String, Object?> json) {
    return RuntimeResource(
      flutterVersion: json['flutterVersion'] as String?,
      dartVersion: json['dartVersion'] as String?,
      isDebug: json['isDebug'] as bool?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'flutterVersion': flutterVersion,
    'dartVersion': dartVersion,
    'isDebug': isDebug,
  });
}

class MonitorResource {
  const MonitorResource({this.sdk, this.app, this.device, this.runtime});

  const MonitorResource.empty()
    : sdk = null,
      app = null,
      device = null,
      runtime = null;

  final SdkResource? sdk;
  final AppResource? app;
  final DeviceResource? device;
  final RuntimeResource? runtime;

  factory MonitorResource.fromJson(Map<String, Object?> json) {
    return MonitorResource(
      sdk: json['sdk'] is Map
          ? SdkResource.fromJson(objectMap(json['sdk']))
          : null,
      app: json['app'] is Map
          ? AppResource.fromJson(objectMap(json['app']))
          : null,
      device: json['device'] is Map
          ? DeviceResource.fromJson(objectMap(json['device']))
          : null,
      runtime: json['runtime'] is Map
          ? RuntimeResource.fromJson(objectMap(json['runtime']))
          : null,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'sdk': sdk?.toJson(),
    'app': app?.toJson(),
    'device': device?.toJson(),
    'runtime': runtime?.toJson(),
  });
}
