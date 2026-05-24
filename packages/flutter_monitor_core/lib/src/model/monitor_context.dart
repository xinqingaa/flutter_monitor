import 'json_utils.dart';

class UserContext {
  const UserContext({this.userId, this.userType, this.userTags, this.cohort});

  final String? userId;
  final String? userType;
  final List<String>? userTags;
  final String? cohort;

  factory UserContext.fromJson(Map<String, Object?> json) {
    return UserContext(
      userId: json['userId'] as String?,
      userType: json['userType'] as String?,
      userTags: stringList(json['userTags']),
      cohort: json['cohort'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'userId': userId,
    'userType': userType,
    'userTags': userTags,
    'cohort': cohort,
  });
}

class RouteContext {
  const RouteContext({this.name, this.stack, this.source});

  final String? name;
  final List<String>? stack;
  final String? source;

  factory RouteContext.fromJson(Map<String, Object?> json) {
    return RouteContext(
      name: json['name'] as String?,
      stack: stringList(json['stack']),
      source: json['source'] as String?,
    );
  }

  Map<String, Object?> toJson() =>
      jsonMap({'name': name, 'stack': stack, 'source': source});
}

class ModuleContext {
  const ModuleContext({this.name, this.scene});

  final String? name;
  final String? scene;

  factory ModuleContext.fromJson(Map<String, Object?> json) {
    return ModuleContext(
      name: json['name'] as String?,
      scene: json['scene'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({'name': name, 'scene': scene});
}

class NetworkContext {
  const NetworkContext({this.type, this.isWeakNetwork});

  final String? type;
  final bool? isWeakNetwork;

  factory NetworkContext.fromJson(Map<String, Object?> json) {
    return NetworkContext(
      type: json['type'] as String?,
      isWeakNetwork: json['isWeakNetwork'] as bool?,
    );
  }

  Map<String, Object?> toJson() =>
      jsonMap({'type': type, 'isWeakNetwork': isWeakNetwork});
}

class ReleaseContext {
  const ReleaseContext({this.releaseId, this.featureFlags, this.experiments});

  final String? releaseId;
  final List<String>? featureFlags;
  final Map<String, Object?>? experiments;

  factory ReleaseContext.fromJson(Map<String, Object?> json) {
    return ReleaseContext(
      releaseId: json['releaseId'] as String?,
      featureFlags: json['featureFlags'] is Iterable
          ? (json['featureFlags'] as Iterable).whereType<String>().toList(
              growable: false,
            )
          : json['featureFlags'] is Map
          ? objectMap(json['featureFlags']).keys.toList(growable: false)
          : null,
      experiments: json['experiments'] is Map
          ? objectMap(json['experiments'])
          : null,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'releaseId': releaseId,
    'featureFlags': featureFlags,
    'experiments': experiments,
  });
}

class LifecycleContext {
  const LifecycleContext({this.state, this.previousState, this.isForeground});

  final String? state;
  final String? previousState;
  final bool? isForeground;

  factory LifecycleContext.fromJson(Map<String, Object?> json) {
    return LifecycleContext(
      state: json['state'] as String?,
      previousState: json['previousState'] as String?,
      isForeground: json['isForeground'] as bool?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'state': state,
    'previousState': previousState,
    'isForeground': isForeground,
  });
}

class NativeRuntimeContext {
  const NativeRuntimeContext({
    this.available,
    this.platform,
    this.bridgeVersion,
    this.signalSource,
    this.processId,
  });

  final bool? available;
  final String? platform;
  final String? bridgeVersion;
  final String? signalSource;
  final num? processId;

  factory NativeRuntimeContext.fromJson(Map<String, Object?> json) {
    return NativeRuntimeContext(
      available: json['available'] as bool?,
      platform: json['platform'] as String?,
      bridgeVersion: json['bridgeVersion'] as String?,
      signalSource: json['signalSource'] as String?,
      processId: json['processId'] as num?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'available': available,
    'platform': platform,
    'bridgeVersion': bridgeVersion,
    'signalSource': signalSource,
    'processId': processId,
  });
}

class MonitorContext {
  const MonitorContext({
    this.user,
    this.route,
    this.module,
    this.network,
    this.release,
    this.lifecycle,
    this.native,
    this.missing,
    this.missingReason,
  });

  const MonitorContext.empty()
    : user = null,
      route = null,
      module = null,
      network = null,
      release = null,
      lifecycle = null,
      native = null,
      missing = null,
      missingReason = null;

  final UserContext? user;
  final RouteContext? route;
  final ModuleContext? module;
  final NetworkContext? network;
  final ReleaseContext? release;
  final LifecycleContext? lifecycle;
  final NativeRuntimeContext? native;
  final bool? missing;
  final String? missingReason;

  factory MonitorContext.fromJson(Map<String, Object?> json) {
    return MonitorContext(
      user: json['user'] is Map
          ? UserContext.fromJson(objectMap(json['user']))
          : null,
      route: json['route'] is Map
          ? RouteContext.fromJson(objectMap(json['route']))
          : null,
      module: json['module'] is Map
          ? ModuleContext.fromJson(objectMap(json['module']))
          : null,
      network: json['network'] is Map
          ? NetworkContext.fromJson(objectMap(json['network']))
          : null,
      release: json['release'] is Map
          ? ReleaseContext.fromJson(objectMap(json['release']))
          : null,
      lifecycle: json['lifecycle'] is Map
          ? LifecycleContext.fromJson(objectMap(json['lifecycle']))
          : null,
      native: json['native'] is Map
          ? NativeRuntimeContext.fromJson(objectMap(json['native']))
          : null,
      missing: json['missing'] as bool?,
      missingReason: json['missingReason'] as String?,
    );
  }

  Map<String, Object?> toJson() => jsonMap({
    'user': user?.toJson(),
    'route': route?.toJson(),
    'module': module?.toJson(),
    'network': network?.toJson(),
    'release': release?.toJson(),
    'lifecycle': lifecycle?.toJson(),
    'native': native?.toJson(),
    'missing': missing,
    'missingReason': missingReason,
  });
}
