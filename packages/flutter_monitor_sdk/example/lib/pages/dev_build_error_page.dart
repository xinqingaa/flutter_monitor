import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// 在 build 中抛错，走 FlutterError.onError。
class DevBuildErrorPage extends StatefulWidget {
  const DevBuildErrorPage({super.key});

  @override
  State<DevBuildErrorPage> createState() => _DevBuildErrorPageState();
}

class _DevBuildErrorPageState extends State<DevBuildErrorPage> {
  var _armed = false;

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devBuildError,
      moduleName: 'debug',
      moduleScene: 'dev_build_error',
      child: Scaffold(
        appBar: AppBar(title: const Text('Build 期 FlutterError')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text(
                '点击下方按钮后会 setState，并在下次 build 中抛出异常，'
                '模拟 framework 布局/构建失败。',
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => setState(() => _armed = true),
                child: const Text('武装下一次 build 抛错'),
              ),
            ),
            const SizedBox(height: 12),
            if (_armed) const _ExplodingCard(),
          ],
        ),
      ),
    );
  }
}

class _ExplodingCard extends StatelessWidget {
  const _ExplodingCard();

  @override
  Widget build(BuildContext context) {
    throw FlutterError(
      'DevBuildErrorPage intentionally failed during build '
      '(module=debug scene=dev_build_error)',
    );
  }
}
