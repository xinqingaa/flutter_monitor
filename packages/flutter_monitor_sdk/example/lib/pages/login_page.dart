import 'dart:math';

import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';


class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.api,
    this.loadAuthOptionsOnStart = true,
    this.remoteLogin = true,
  });

  final DemoApi api;
  final bool loadAuthOptionsOnStart;
  final bool remoteLogin;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _controller = TextEditingController();
  AuthOptions? _options;
  var _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.loadAuthOptionsOnStart) {
      widget.api.authOptions().then((value) {
        if (mounted) setState(() => _options = value);
      }).catchError((_) {});
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final userId = _controller.text.trim();
    if (userId.isEmpty) {
      setState(() => _error = '请输入 userId');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (!widget.remoteLogin) {
        AppSession.applyLogin(
          userId: userId,
          token: 'local_$userId',
          displayName: '运动达人 $userId',
          tier: 'free',
        );
        FlutterMonitorSDK.setContext(userId: userId, userType: 'demo');
        if (!mounted) return;
        appTrack(
          context,
          action: 'auth.login',
          message: '登录成功',
          properties: const {'result': 'success'},
        );
        Navigator.of(context).pushReplacementNamed(AppRoutes.app);
        return;
      }

      final result = await widget.api.login(userId);
      widget.api.setToken(result.token);
      AppSession.applyLogin(
        userId: result.userId,
        token: result.token,
        displayName: result.name,
        tier: result.tier,
      );
      FlutterMonitorSDK.setContext(userId: result.userId, userType: 'demo');
      if (!mounted) return;
      appTrack(
        context,
        action: 'auth.login',
        message: '欢迎回来，${result.name}',
        properties: {'result': 'success', 'tier': result.tier},
      );
      Navigator.of(context).pushReplacementNamed(AppRoutes.app);
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
      appTrack(
        context,
        action: 'auth.login',
        result: MonitorTrackResult.failed,
        level: MonitorEventLevel.warning,
        error: error.message,
        message: error.message,
        properties: {
          'result': 'failed',
          'biz_code': error.code,
        },
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _randomId() {
    final id = (10 + Random().nextInt(90)).toString();
    _controller.text = id;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.login,
      moduleName: 'auth',
      moduleScene: 'login',
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
            children: [
              Text(
                '登录 PulseFit',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _options?.notice ?? '输入 2–3 位数字 userId 开始体验',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: '用户 ID',
                  hintText: '例如 42',
                ),
                onSubmitted: (_) => _login(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _loading ? null : _login,
                  child: Text(_loading ? '登录中…' : '进入 App'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _loading ? null : _randomId,
                  child: const Text('随机生成 userId'),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                '客服：${_options?.supportContact ?? 'support@pulsefit.demo'}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
