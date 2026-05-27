import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:http/http.dart' as http;

enum _ScenarioAction {
  dioSuccess,
  dioFailure,
  dioSlow,
  dioTimeout,
  httpSuccess,
  httpFailure,
  httpSlow,
  httpTimeout,
  checkoutAction,
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.dio});

  final Dio dio;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static final Uri _githubUserUri = Uri.parse(
    'https://api.github.com/users/flutter',
  );
  static final Uri _githubFailureUri = Uri.parse(
    'https://api.github.com/non-existent-path',
  );
  static const String _testApiBaseUrl = String.fromEnvironment(
    'FM_TEST_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3000',
  );
  static final Uri _timeoutUri = Uri.parse(
    'https://10.255.255.1/flutter-monitor-timeout',
  );

  late final http.Client _monitoredHttpClient;
  final Set<_ScenarioAction> _loading = <_ScenarioAction>{};

  @override
  void initState() {
    super.initState();
    _monitoredHttpClient = FlutterMonitorSDK.httpClient;
    FlutterMonitorSDK.setModule(name: 'example', scene: 'home');
  }

  @override
  void dispose() {
    _monitoredHttpClient.close();
    super.dispose();
  }

  Future<void> _runScenario(
    _ScenarioAction action, {
    required Future<void> Function() run,
    required String done,
  }) async {
    if (_loading.contains(action)) return;
    setState(() {
      _loading.add(action);
    });

    try {
      await run();
      if (mounted) _show(done);
    } catch (error) {
      if (mounted) _show('$done: $error');
    } finally {
      if (mounted) {
        setState(() {
          _loading.remove(action);
        });
      }
    }
  }

  void _show(String message) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  bool _isLoading(_ScenarioAction action) => _loading.contains(action);

  Widget _section(String title, List<Widget> children) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }

  Widget _button({
    required String label,
    required VoidCallback? onPressed,
    _ScenarioAction? action,
    Color? color,
  }) {
    final loading = action != null && _isLoading(action);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(backgroundColor: color),
        onPressed: loading ? null : onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading) ...[
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(width: 8),
            ],
            Flexible(child: Text(loading ? 'Running...' : label)),
          ],
        ),
      ),
    );
  }

  Future<void> _runDio(Uri uri) async {
    final response = await widget.dio.getUri(uri);
    if ((response.statusCode ?? 0) >= 400) {
      throw StateError('HTTP ${response.statusCode}');
    }
  }

  Uri get _localSlowUri =>
      Uri.parse('$_testApiBaseUrl/api/test/slow?delayMs=1500&bytes=256');

  Future<void> _runHttp(Uri uri) async {
    final response = await _monitoredHttpClient.get(uri);
    if (response.statusCode >= 400) {
      throw StateError('HTTP ${response.statusCode}');
    }
  }

  Future<void> _runCheckoutAction() async {
    FlutterMonitorSDK.track(
      action: 'checkout.submit',
      result: MonitorTrackResult.started,
      target: 'checkout_button',
      properties: const <String, Object?>{
        'cart.items': 3,
        'scenario': 'example_checkout',
      },
    );
    await Future<void>.delayed(const Duration(milliseconds: 80));
    FlutterMonitorSDK.track(
      action: 'checkout.validate_cart',
      result: MonitorTrackResult.success,
      target: 'checkout_form',
      properties: const <String, Object?>{'cart.items': 3},
    );
    await Future<void>.delayed(const Duration(milliseconds: 120));
    FlutterMonitorSDK.track(
      action: 'checkout.submit',
      result: MonitorTrackResult.success,
      target: 'checkout_button',
      properties: const <String, Object?>{
        'order.mock': true,
        'scenario': 'example_checkout',
      },
    );
  }

  void _triggerHandledBusinessError() {
    FlutterMonitorSDK.track(
      action: 'profile.save',
      result: MonitorTrackResult.failed,
      level: MonitorEventLevel.warning,
      error: 'validation_failed',
      target: 'profile_save_button',
      properties: const <String, Object?>{'field': 'phone'},
    );
    _show('Business validation failure tracked.');
  }

  void _triggerLayoutOverflow() {
    showDialog(
      context: context,
      builder: (context) => const AlertDialog(
        title: Text('Layout Overflow'),
        content: Row(
          children: [
            Text(
              'This long text intentionally overflows the dialog width and is captured by FlutterError.',
            ),
          ],
        ),
      ),
    );
  }

  void _triggerMemoryPressureHint() {
    FlutterMonitorSDK.track(
      action: 'memory.pressure.test',
      result: MonitorTrackResult.started,
      target: 'memory_pressure_button',
      properties: const <String, Object?>{
        'scenario': 'memory_pressure_hint',
        'claim': 'suspect_only',
      },
    );
    final chunks = <List<int>>[];
    for (var index = 0; index < 64; index++) {
      chunks.add(List<int>.filled(32 * 1024, index));
    }
    scheduleMicrotask(chunks.clear);
    _show('Memory pressure hint recorded as breadcrumb.');
  }

  Future<void> _simulateLifecycle() async {
    await FlutterMonitorSDK.handleLifecycleState('paused');
    await Future<void>.delayed(const Duration(milliseconds: 300));
    await FlutterMonitorSDK.handleLifecycleState('resumed');
    _show('Lifecycle paused/resumed simulated.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Flutter Monitor Example'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _section('Page And Route', [
              _button(
                label: 'Push /detail',
                onPressed: () => Navigator.pushNamed(context, '/detail'),
              ),
              _button(
                label: 'Push /performance_test',
                onPressed: () =>
                    Navigator.pushNamed(context, '/performance_test'),
              ),
              _button(
                label: 'Push /complex_list',
                onPressed: () => Navigator.pushNamed(context, '/complex_list'),
              ),
            ]),
            _section('HTTP: Dio', [
              _button(
                label: 'Dio 200 GitHub user',
                action: _ScenarioAction.dioSuccess,
                color: Colors.green,
                onPressed: () => _runScenario(
                  _ScenarioAction.dioSuccess,
                  run: () => _runDio(_githubUserUri),
                  done: 'Dio success scenario finished.',
                ),
              ),
              _button(
                label: 'Dio 404 GitHub path',
                action: _ScenarioAction.dioFailure,
                color: Colors.green.shade200,
                onPressed: () => _runScenario(
                  _ScenarioAction.dioFailure,
                  run: () => _runDio(_githubFailureUri),
                  done: 'Dio failure scenario finished.',
                ),
              ),
              _button(
                label: 'Dio slow local request',
                action: _ScenarioAction.dioSlow,
                color: Colors.lightGreen,
                onPressed: () => _runScenario(
                  _ScenarioAction.dioSlow,
                  run: () => _runDio(_localSlowUri),
                  done: 'Dio slow scenario finished.',
                ),
              ),
              _button(
                label: 'Dio timeout',
                action: _ScenarioAction.dioTimeout,
                color: Colors.red.shade200,
                onPressed: () => _runScenario(
                  _ScenarioAction.dioTimeout,
                  run: () => _runDio(_timeoutUri),
                  done: 'Dio timeout scenario finished.',
                ),
              ),
            ]),
            _section('HTTP: package:http', [
              _button(
                label: 'http 200 GitHub user',
                action: _ScenarioAction.httpSuccess,
                color: Colors.teal,
                onPressed: () => _runScenario(
                  _ScenarioAction.httpSuccess,
                  run: () => _runHttp(_githubUserUri),
                  done: 'http success scenario finished.',
                ),
              ),
              _button(
                label: 'http 404 GitHub path',
                action: _ScenarioAction.httpFailure,
                color: Colors.teal.shade200,
                onPressed: () => _runScenario(
                  _ScenarioAction.httpFailure,
                  run: () => _runHttp(_githubFailureUri),
                  done: 'http failure scenario finished.',
                ),
              ),
              _button(
                label: 'http slow local request',
                action: _ScenarioAction.httpSlow,
                color: Colors.cyan,
                onPressed: () => _runScenario(
                  _ScenarioAction.httpSlow,
                  run: () => _runHttp(_localSlowUri),
                  done: 'http slow scenario finished.',
                ),
              ),
              _button(
                label: 'http timeout',
                action: _ScenarioAction.httpTimeout,
                color: Colors.red.shade100,
                onPressed: () => _runScenario(
                  _ScenarioAction.httpTimeout,
                  run: () =>
                      _runHttp(_timeoutUri).timeout(const Duration(seconds: 2)),
                  done: 'http timeout scenario finished.',
                ),
              ),
            ]),
            _section('Jank', [const JankTriggerButton()]),
            _section('Errors', [
              _button(
                label: 'Flutter layout overflow',
                color: Colors.orange.shade200,
                onPressed: _triggerLayoutOverflow,
              ),
              _button(
                label: 'Track business failure',
                color: Colors.orange,
                onPressed: _triggerHandledBusinessError,
              ),
            ]),
            _section('Memory And Lifecycle', [
              _button(
                label: 'Memory pressure hint',
                color: Colors.indigo.shade200,
                onPressed: _triggerMemoryPressureHint,
              ),
              if (kDebugMode)
                _button(
                  label: 'Simulate pause/resume',
                  color: Colors.blueGrey.shade200,
                  onPressed: () => unawaited(_simulateLifecycle()),
                ),
            ]),
            _section('User And Business Context', [
              _button(
                label: 'Set premium user context',
                color: Theme.of(context).colorScheme.primary,
                onPressed: () {
                  FlutterMonitorSDK.instance.setUserInfo(
                    const UserInfo(
                      userId: 'user_007_bond',
                      userType: 'premium',
                      userTags: ['vip', 'beta'],
                      userProperties: {
                        'age': 30,
                        'city': 'Beijing',
                        'subscription': 'premium',
                      },
                    ),
                  );
                  _show('User context updated.');
                },
              ),
              _button(
                label: 'Track checkout action',
                action: _ScenarioAction.checkoutAction,
                color: Colors.purple.shade100,
                onPressed: () => _runScenario(
                  _ScenarioAction.checkoutAction,
                  run: _runCheckoutAction,
                  done: 'Checkout action tracked.',
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class JankTriggerButton extends StatefulWidget {
  const JankTriggerButton({super.key});

  @override
  State<JankTriggerButton> createState() => _JankTriggerButtonState();
}

class _JankTriggerButtonState extends State<JankTriggerButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller =
        AnimationController(vsync: this, duration: const Duration(seconds: 2))
          ..addListener(() {
            setState(() {});
          });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller.isAnimating) {
      final startTime = DateTime.now();
      while (DateTime.now().difference(startTime).inMilliseconds < 45) {}
    }

    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: _controller.isAnimating ? Colors.grey : Colors.red,
      ),
      onPressed: _controller.isAnimating
          ? null
          : () {
              FlutterMonitorSDK.track(
                action: 'ui.tap.trigger_jank',
                result: MonitorTrackResult.started,
                target: 'trigger_jank_button',
              );
              _controller.forward(from: 0);
            },
      child: const Text('Trigger continuous 45ms frame jank'),
    );
  }
}
