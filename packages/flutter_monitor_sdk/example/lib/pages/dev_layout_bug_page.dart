import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// 复现会员页同类布局错误：Row 内按钮被主题最小宽 Infinity 撑爆。
///
/// 进入页面即布局失败，适合验证 error.fingerprint 去重与刷屏收敛。
class DevLayoutBugPage extends StatelessWidget {
  const DevLayoutBugPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devLayoutBug,
      moduleName: 'debug',
      moduleScene: 'dev_layout_bug',
      child: Scaffold(
        appBar: AppBar(title: const Text('布局约束错误')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text(
                '下方卡片故意使用 Size.fromHeight 风格的无限最小宽按钮放进 Row，'
                '应触发 BoxConstraints forces an infinite width。',
              ),
            ),
            const SizedBox(height: 12),
            PulseCard(
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      '故意炸掉的套餐卡',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: () {},
                    child: const Text('开通'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
