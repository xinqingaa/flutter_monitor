import 'dart:math';

import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _userIdController = TextEditingController();
  var _submitting = false;
  String? _errorText;

  @override
  void dispose() {
    _userIdController.dispose();
    super.dispose();
  }

  bool _isValidUserId(String value) => RegExp(r'^\d{2,3}$').hasMatch(value);

  void _fillRandomUserId() {
    final value = (Random().nextInt(900) + 100).toString();
    _userIdController.text = value;
    setState(() => _errorText = null);
  }

  Future<void> _enterHome() async {
    if (_submitting) return;
    final userId = _userIdController.text.trim();
    if (!_isValidUserId(userId)) {
      setState(() => _errorText = '请输入 2-3 位数字 userId');
      return;
    }

    setState(() {
      _submitting = true;
      _errorText = null;
    });
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;

    AppSession.setUserId(userId);
    FlutterMonitorSDK.setContext(
      userId: userId,
      userType: 'qa',
      userTags: const ['qa'],
      cohort: 'example_session',
    );
    appTrack(
      context,
      action: 'auth.login.submit',
      target: 'login_enter_button',
      properties: <String, Object?>{'user.id': userId},
      message: '已登录 userId=$userId，可在 Workbench 按用户筛选',
    );

    if (!mounted) return;
    await AppNavigation.replaceToApp(context);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AppPage(
      routeName: AppRoutes.login,
      moduleName: 'auth',
      moduleScene: 'login',
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Icon(
                          Icons.monitor_heart,
                          size: 56,
                          color: colorScheme.primary,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Flutter Monitor Shop',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '输入 QA 用户 ID 进入监控工作台',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _userIdController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(3),
                          ],
                          decoration: InputDecoration(
                            labelText: '用户 ID',
                            hintText: '例如 42',
                            errorText: _errorText,
                            prefixIcon: const Icon(Icons.person_outline),
                          ),
                          onChanged: (_) {
                            if (_errorText != null) {
                              setState(() => _errorText = null);
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _submitting ? null : _fillRandomUserId,
                          icon: const Icon(Icons.casino_outlined),
                          label: const Text('随机生成'),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: _submitting ? null : _enterHome,
                          icon: _submitting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.login),
                          label: Text(_submitting ? '进入中…' : '进入首页'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
