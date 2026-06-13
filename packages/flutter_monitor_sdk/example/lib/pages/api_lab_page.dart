import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
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

  @override
  void initState() {
    super.initState();
    _api = DemoApi(
      dio: widget.dio,
      httpClient: FlutterMonitorSDK.createHttpClient(),
    );
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
        appBar: AppBar(title: const Text('数据同步中心')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSection(
              title: '服务层接口',
              subtitle: '本地 service 的成功、慢响应、大响应和状态码场景。',
              children: [
                _button(
                  'dio_service_fast',
                  'Dio · service fast',
                  _api.fetchLocalFastWithDio,
                ),
                _button(
                  'dio_service_payload',
                  'Dio · service 32KB',
                  _api.fetchLocalPayloadWithDio,
                ),
                _button(
                  'dio_local_slow',
                  'Dio · service slow',
                  _api.fetchLocalSlowWithDio,
                ),
                _button(
                  'http_local_slow',
                  'http · service slow',
                  _api.fetchLocalSlowWithHttp,
                ),
                _button(
                  'dio_service_503',
                  'Dio · service 503',
                  () => _api.fetchLocalStatusWithDio(503),
                ),
                _button(
                  'http_service_429',
                  'http · service 429',
                  () => _api.fetchLocalStatusWithHttp(429),
                ),
              ],
            ),
            AppSection(
              title: '公开接口',
              subtitle: 'Dio 和 package:http 都会进入 SDK HTTP span。',
              children: [
                _button('dio_github_profile', 'Dio · GitHub profile', () async {
                  await _api.fetchGithubProfile();
                }),
                _button('dio_github_repos', 'Dio · GitHub repos', () async {
                  await _api.fetchGithubRepos();
                }),
                _button('http_posts', 'http · JSONPlaceholder posts', () async {
                  await _api.fetchPosts();
                }),
                _button(
                  'http_comments',
                  'http · JSONPlaceholder comments',
                  () async {
                    await _api.fetchComments();
                  },
                ),
              ],
            ),
            AppSection(
              title: '失败和慢请求',
              children: [
                _button('dio_404', 'Dio · GitHub 404', _api.fetchDioFailure),
                _button(
                  'http_404',
                  'http · JSONPlaceholder 404',
                  _api.fetchHttpFailure,
                ),
                _button('dio_timeout', 'Dio · timeout', _api.fetchDioTimeout),
                _button(
                  'http_timeout',
                  'http · timeout',
                  _api.fetchHttpTimeout,
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
