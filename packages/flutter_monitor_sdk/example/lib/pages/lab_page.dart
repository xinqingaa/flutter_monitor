import 'package:example/data/demo_api.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

/// Hidden debug entry — still uses the same Dio + mock prefix.
class LabPage extends StatefulWidget {
  const LabPage({super.key, required this.api});

  final DemoApi api;

  @override
  State<LabPage> createState() => _LabPageState();
}

class _LabPageState extends State<LabPage> {
  String _message = '选择一项网络演练';

  Future<void> _run(String label, Future<void> Function() action) async {
    setState(() => _message = '$label …');
    try {
      await action();
      if (!mounted) return;
      setState(() => _message = '$label 完成');
    } catch (error) {
      if (!mounted) return;
      setState(() => _message = '$label 失败：$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.lab,
      moduleName: 'debug',
      moduleScene: 'lab',
      child: Scaffold(
        appBar: AppBar(title: const Text('网络异常演练')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PulseCard(child: Text(_message)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => _run('慢请求', widget.api.labSlow),
                child: const Text('慢请求 (~1.8s)'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _run('404', widget.api.labNotFound),
                child: const Text('HTTP 404'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _run('503', widget.api.labUnavailable),
                child: const Text('HTTP 503'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
