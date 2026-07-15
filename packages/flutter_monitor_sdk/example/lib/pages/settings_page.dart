import 'package:example/data/demo_api.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.api});

  final DemoApi api;

  Future<void> _logout(BuildContext context) async {
    try {
      await api.logout();
    } catch (_) {}
    api.setToken(null);
    AppSession.clear();
    FlutterMonitorSDK.clearContext(scopes: {MonitorContextScope.user});
    if (!context.mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.settings,
      moduleName: 'me',
      moduleScene: 'settings',
      child: Scaffold(
        appBar: AppBar(title: const Text('设置')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PulseCard(
              child: Text('当前用户：${AppSession.displayName ?? '-'}'),
            ),
            const SizedBox(height: 10),
            PulseCard(
              onTap: () => AppNavigation.openLab(context),
              child: const Row(
                children: [
                  Expanded(
                    child: Text(
                      '网络异常演练',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  Icon(Icons.chevron_right),
                ],
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => _logout(context),
                child: const Text('退出登录'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
