import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/demo_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class ApiLabPage extends StatefulWidget {
  const ApiLabPage({super.key, required this.dio});

  final Dio dio;

  @override
  State<ApiLabPage> createState() => _ApiLabPageState();
}

class _ApiLabPageState extends State<ApiLabPage> {
  late final DemoApi _api;
  final List<String> _logs = <String>[];
  final Set<String> _running = <String>{};
  SyncSummary? _summary;

  @override
  void initState() {
    super.initState();
    _api = DemoApi(
      dio: widget.dio,
      httpClient: FlutterMonitorSDK.createHttpClient(),
    );
    _loadSummary();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _run(String key, Future<void> Function() task) async {
    if (_running.contains(key)) return;
    setState(() => _running.add(key));
    try {
      await task();
      _append('$key success');
      FlutterMonitorSDK.track(
        action: 'api.sync.run',
        result: MonitorTrackResult.success,
        target: key,
        properties: <String, Object?>{'api.case': key},
      );
    } catch (error, stackTrace) {
      _append('$key failed: $error');
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'api_lab_case_failed',
        handled: true,
        properties: <String, Object?>{'api.case': key},
      );
      FlutterMonitorSDK.track(
        action: 'api.sync.run',
        result: MonitorTrackResult.failed,
        level: MonitorEventLevel.warning,
        target: key,
        error: error.runtimeType.toString(),
        properties: <String, Object?>{'api.case': key},
      );
    } finally {
      if (mounted) setState(() => _running.remove(key));
    }
  }

  Future<void> _loadSummary() async {
    try {
      final summary = await _api.fetchSyncSummary();
      if (!mounted) return;
      setState(() => _summary = summary);
      _append('sync summary loaded');
    } catch (error, stackTrace) {
      _append('sync summary failed: $error');
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'ops_sync_summary_failed',
        handled: true,
      );
    }
  }

  void _append(String message) {
    if (!mounted) return;
    setState(() {
      _logs.insert(
        0,
        '${DateTime.now().toIso8601String().substring(11, 19)}  $message',
      );
      if (_logs.length > 12) _logs.removeLast();
    });
  }

  Widget _button(String key, String label, Future<void> Function() task) {
    final running = _running.contains(key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: FilledButton.tonalIcon(
        onPressed: running ? null : () => _run(key, task),
        icon: running
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.cloud_sync_outlined),
        label: Text(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.apiLab,
      moduleName: 'ops',
      moduleScene: 'api_lab',
      child: Scaffold(
        appBar: AppBar(title: const Text('运营同步中心')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSection(
              title: '待处理摘要',
              children: [
                Text('待同步订单：${_summary?.pendingOrders ?? '-'}'),
                Text('库存任务：${_summary?.inventoryTasks ?? '-'}'),
                Text('上次同步：${_summary?.lastSyncAt?.toIso8601String() ?? '-'}'),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _loadSummary,
                  icon: const Icon(Icons.refresh),
                  label: const Text('刷新摘要'),
                ),
              ],
            ),
            AppSection(
              title: '运营动作',
              subtitle: '覆盖 GET、POST、PUT、DELETE；慢同步只留在 HTTP tab。',
              children: [
                _button('sync_orders', 'POST · 同步订单（慢请求）', _api.syncOrders),
                _button(
                  'update_pricing',
                  'PUT · 更新价格规则',
                  _api.updatePricingRule,
                ),
                _button('delete_draft', 'DELETE · 删除过期草稿', _api.deleteDraft),
                _button(
                  'daily_report',
                  'GET · 拉取日报',
                  () => _api.fetchDailyReport(),
                ),
                _button(
                  'daily_report_503',
                  'GET · 拉取日报异常 503',
                  () => _api.fetchDailyReport(fail: true),
                ),
              ],
            ),
            AppSection(
              title: '最近结果',
              children: [
                if (_logs.isEmpty)
                  const Text('还没有执行同步')
                else
                  for (final log in _logs) Text(log),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
