import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// 开发者选项入口：集中跳转到故意制造异常的测试页。
class DevOptionsPage extends StatelessWidget {
  const DevOptionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devOptions,
      moduleName: 'debug',
      moduleScene: 'dev_options',
      child: Scaffold(
        appBar: AppBar(title: const Text('开发者选项')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text(
                '以下页面故意制造异常，用于验证 Monitor SDK 的错误采集、'
                'fingerprint 去重与 Workbench 异常列表。请勿当作产品功能。',
              ),
            ),
            const SizedBox(height: 12),
            _tile(
              context,
              icon: Icons.view_quilt_outlined,
              title: '布局约束错误',
              subtitle: '进入即触发 BoxConstraints infinite width',
              onTap: () => AppNavigation.openDevLayoutBug(context),
            ),
            _tile(
              context,
              icon: Icons.bug_report_outlined,
              title: 'Dart 运行时异常',
              subtitle: '空指针 / RangeError / TypeError',
              onTap: () => AppNavigation.openDevDartError(context),
            ),
            _tile(
              context,
              icon: Icons.build_outlined,
              title: 'Build 期 FlutterError',
              subtitle: '在 build 中抛错，模拟 framework error',
              onTap: () => AppNavigation.openDevBuildError(context),
            ),
            _tile(
              context,
              icon: Icons.schedule_outlined,
              title: '异步未捕获异常',
              subtitle: 'Future / microtask 中抛错',
              onTap: () => AppNavigation.openDevAsyncError(context),
            ),
            _tile(
              context,
              icon: Icons.report_outlined,
              title: '手动 recordError',
              subtitle: '调用 FlutterMonitorSDK.recordError',
              onTap: () => AppNavigation.openDevManualError(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: PulseCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
