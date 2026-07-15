import 'dart:async';

import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// 触发异步未捕获异常，走 PlatformDispatcher.onError。
class DevAsyncErrorPage extends StatelessWidget {
  const DevAsyncErrorPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.devAsyncError,
      moduleName: 'debug',
      moduleScene: 'dev_async_error',
      child: Scaffold(
        appBar: AppBar(title: const Text('异步未捕获异常')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const PulseCard(
              child: Text(
                '这些异常发生在异步回调中，且没有 await/catch，'
                '应由 SDK 的 Dart error 通道捕获。',
              ),
            ),
            const SizedBox(height: 12),
            _button(
              label: 'Future 中抛错',
              onPressed: () {
                Future<void>(() {
                  throw Exception('dev async Future exception');
                });
              },
            ),
            _button(
              label: 'microtask 中抛错',
              onPressed: () {
                scheduleMicrotask(() {
                  throw Exception('dev async microtask exception');
                });
              },
            ),
            _button(
              label: '未 await 的 async 函数抛错',
              onPressed: () {
                // ignore: unawaited_futures
                _boomAsync();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _boomAsync() async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    throw Exception('dev unawaited async function exception');
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
