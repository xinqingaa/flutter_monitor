class WorkbenchHealth {
  const WorkbenchHealth({
    required this.ok,
    required this.eventCount,
    required this.sessionCount,
    this.lastIngestAt,
  });

  final bool ok;
  final int eventCount;
  final int sessionCount;
  final DateTime? lastIngestAt;

  factory WorkbenchHealth.fromJson(Map<String, dynamic> json) {
    return WorkbenchHealth(
      ok: json['ok'] as bool? ?? false,
      eventCount: json['eventCount'] as int? ?? 0,
      sessionCount: json['sessionCount'] as int? ?? 0,
      lastIngestAt: DateTime.tryParse(json['lastIngestAt'] as String? ?? ''),
    );
  }
}

class MonitorEventItem {
  const MonitorEventItem({
    required this.eventId,
    required this.raw,
    this.name,
    this.signalType,
    this.status,
    this.timestamp,
    this.sessionId,
    this.traceId,
    this.routeName,
    this.userId,
  });

  final String eventId;
  final Map<String, dynamic> raw;
  final String? name;
  final String? signalType;
  final String? status;
  final DateTime? timestamp;
  final String? sessionId;
  final String? traceId;
  final String? routeName;
  final String? userId;

  factory MonitorEventItem.fromJson(Map<String, dynamic> json) {
    final context = json['context'];
    final route = context is Map ? context['route'] : null;
    final user = context is Map ? context['user'] : null;

    return MonitorEventItem(
      eventId: json['eventId'] as String? ?? '',
      raw: Map<String, dynamic>.from(json),
      name: json['name'] as String?,
      signalType: json['signalType'] as String?,
      status: json['status'] as String?,
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? ''),
      sessionId: json['sessionId'] as String?,
      traceId: json['traceId'] as String?,
      routeName: route is Map ? route['name'] as String? : null,
      userId: user is Map ? user['userId'] as String? : null,
    );
  }
}

class MonitorHomeState {
  const MonitorHomeState({
    required this.health,
    required this.events,
    required this.showMineOnly,
    this.currentUserId,
  });

  final WorkbenchHealth health;
  final List<MonitorEventItem> events;
  final bool showMineOnly;
  final String? currentUserId;

  List<MonitorEventItem> get visibleEvents {
    if (!showMineOnly || currentUserId == null || currentUserId!.isEmpty) {
      return events;
    }
    return events
        .where((event) => event.userId == currentUserId)
        .toList(growable: false);
  }

  MonitorHomeState copyWith({
    WorkbenchHealth? health,
    List<MonitorEventItem>? events,
    bool? showMineOnly,
    String? currentUserId,
  }) {
    return MonitorHomeState(
      health: health ?? this.health,
      events: events ?? this.events,
      showMineOnly: showMineOnly ?? this.showMineOnly,
      currentUserId: currentUserId ?? this.currentUserId,
    );
  }
}
