import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/monitor_event_models.dart';

class WorkbenchConnectionException implements Exception {
  WorkbenchConnectionException(this.message);

  final String message;

  @override
  String toString() => message;
}

class WorkbenchApi {
  WorkbenchApi({required Dio dio}) : _dio = dio;

  final Dio _dio;

  static const baseUrl = DemoApi.testApiBaseUrl;

  Future<WorkbenchHealth> fetchHealth() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$baseUrl/api/monitor/v1/health',
      );
      final data = response.data;
      if (data == null) {
        throw WorkbenchConnectionException('Workbench health 响应为空');
      }
      return WorkbenchHealth.fromJson(data);
    } on DioException catch (error) {
      throw _wrapConnectionError(error);
    }
  }

  Future<List<MonitorEventItem>> fetchRecentEvents({int limit = 50}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$baseUrl/api/monitor/v1/recent',
        queryParameters: <String, dynamic>{'limit': limit},
      );
      final data = response.data;
      if (data == null) {
        throw WorkbenchConnectionException('Workbench recent 响应为空');
      }
      final events = data['events'];
      if (events is! List) return const <MonitorEventItem>[];
      return events
          .whereType<Map<String, dynamic>>()
          .map(MonitorEventItem.fromJson)
          .where((event) => event.eventId.isNotEmpty)
          .toList(growable: false);
    } on DioException catch (error) {
      throw _wrapConnectionError(error);
    }
  }

  Future<MonitorHomeState> loadHomeState({
    required bool showMineOnly,
    String? currentUserId,
    int limit = 50,
  }) async {
    final results = await Future.wait<Object>([
      fetchHealth(),
      fetchRecentEvents(limit: limit),
    ]);
    return MonitorHomeState(
      health: results[0] as WorkbenchHealth,
      events: results[1] as List<MonitorEventItem>,
      showMineOnly: showMineOnly,
      currentUserId: currentUserId,
    );
  }

  WorkbenchConnectionException _wrapConnectionError(DioException error) {
    return WorkbenchConnectionException(
      '无法连接 Workbench service（$baseUrl）。'
      '请先运行：bash scripts/workbench.sh',
    );
  }
}
