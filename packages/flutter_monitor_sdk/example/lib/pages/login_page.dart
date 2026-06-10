import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneController = TextEditingController(text: '13800000000');
  final _codeController = TextEditingController();
  var _isRegister = false;
  var _submitting = false;
  var _message = '请输入验证码 1234';

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _toggleMode(bool value) {
    setState(() {
      _isRegister = value;
      _message = value ? '注册模式会写入新用户上下文' : '请输入验证码 1234';
    });
    FlutterMonitorSDK.track(
      action: 'auth.mode.switch',
      result: MonitorTrackResult.success,
      target: 'auth_mode_switch',
      properties: <String, Object?>{'auth.register': value},
    );
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final measure = FlutterMonitorSDK.measure(
      action: _isRegister ? 'auth.register.submit' : 'auth.login.submit',
      mode: MonitorMeasureMode.stage,
      target: 'auth_submit_button',
    );
    setState(() {
      _submitting = true;
      _message = '正在验证';
    });
    await Future<void>.delayed(const Duration(milliseconds: 360));
    if (!mounted) {
      measure.cancel(reason: 'page_disposed');
      return;
    }
    if (_codeController.text.trim() != '1234') {
      setState(() {
        _submitting = false;
        _message = '验证码错误';
      });
      FlutterMonitorSDK.track(
        action: _isRegister ? 'auth.register.submit' : 'auth.login.submit',
        result: MonitorTrackResult.failed,
        level: MonitorEventLevel.warning,
        target: 'auth_submit_button',
        error: 'invalid_code',
      );
      measure.cancel(reason: 'invalid_code');
      return;
    }

    FlutterMonitorSDK.setContext(
      userId: _isRegister ? 'new_user_1001' : 'qa_user_001',
      userType: _isRegister ? 'new' : 'member',
      userTags: _isRegister ? const ['new_user'] : const ['qa', 'member'],
      cohort: _isRegister ? 'register_flow' : 'login_flow',
    );
    FlutterMonitorSDK.track(
      action: _isRegister ? 'auth.register.submit' : 'auth.login.submit',
      result: MonitorTrackResult.success,
      target: 'auth_submit_button',
      properties: <String, Object?>{
        'auth.register': _isRegister,
        'phone.masked': _maskedPhone,
      },
    );
    measure.finish(properties: const <String, Object?>{'result': 'success'});
    setState(() {
      _submitting = false;
      _message = _isRegister ? '注册成功，用户上下文已写入' : '登录成功，用户上下文已写入';
    });
  }

  String get _maskedPhone {
    final value = _phoneController.text;
    if (value.length < 7) return 'invalid';
    return '${value.substring(0, 3)}****${value.substring(value.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.login,
      moduleName: 'auth',
      moduleScene: _isRegister ? 'register' : 'login',
      child: Scaffold(
        appBar: AppBar(title: const Text('登录注册')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSection(
              title: _isRegister ? '注册账号' : '登录账号',
              subtitle: '成功后写入 context.user，失败会留下业务足迹。',
              children: [
                SwitchListTile(
                  value: _isRegister,
                  onChanged: _toggleMode,
                  title: const Text('注册新用户'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '验证码',
                    hintText: '1234',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Text(_message),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.verified_user_outlined),
                  label: Text(_submitting ? '处理中' : '提交'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
