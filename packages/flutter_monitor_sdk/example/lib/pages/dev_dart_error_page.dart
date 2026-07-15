import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// 按钮触发各类 Dart 同步异常。
class DevDartErrorPage extends StatelessWidget {
  const DevDartErrorPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devDartError,
      moduleName: 'debug',
      moduleScene: 'dev_dart_error',
      child: Scaffold(
        appBar: AppBar(title: const Text('Dart 运行时异常')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text('点击按钮会在同步调用栈中抛错，由 ErrorMonitor 捕获。'),
            ),
            const SizedBox(height: 12),
            _button(
              label: 'Null check / NoSuchMethodError',
              onPressed: () {
                final Object? value = null;
                // ignore: avoid_dynamic_calls
                (value as dynamic).missingMethod();
              },
            ),
            _button(
              label: 'RangeError',
              onPressed: () {
                const items = <String>['a'];
                // ignore: unnecessary_statements
                items[3];
              },
            ),
            _button(
              label: 'TypeError / FormatException',
              onPressed: () {
                int.parse('not-a-number');
              },
            ),
            _button(
              label: 'StateError',
              onPressed: () {
                throw StateError('dev options forced StateError');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _button({required String label, required VoidCallback onPressed}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton(onPressed: onPressed, child: Text(label)),
      ),
    );
  }
}
