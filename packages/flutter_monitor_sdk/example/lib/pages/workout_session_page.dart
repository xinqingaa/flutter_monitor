import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class WorkoutSessionArgs {
  const WorkoutSessionArgs({
    required this.workoutId,
    required this.sessionId,
    required this.title,
  });

  final String workoutId;
  final String sessionId;
  final String title;
}

class WorkoutSessionPage extends StatefulWidget {
  const WorkoutSessionPage({super.key, required this.api, required this.args});

  final DemoApi api;
  final WorkoutSessionArgs? args;

  @override
  State<WorkoutSessionPage> createState() => _WorkoutSessionPageState();
}

class _WorkoutSessionPageState extends State<WorkoutSessionPage> {
  var _step = 0;
  var _busy = false;

  Future<void> _complete() async {
    final args = widget.args;
    if (args == null) return;
    setState(() => _busy = true);
    try {
      final result = await widget.api.completeWorkout(
        id: args.workoutId,
        sessionId: args.sessionId,
      );
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.complete',
        message: result.badge,
        properties: {
          'result': 'success',
          'workout_id': args.workoutId,
          'kcal': result.kcal,
        },
      );
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(result.badge),
          content: Text('消耗 ${result.kcal} kcal · ${result.durationMin} 分钟'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('好的'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.pop(context);
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.complete',
        result: MonitorTrackResult.failed,
        error: error.message,
        message: error.message,
        properties: {'result': 'failed', 'biz_code': error.code},
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final args = widget.args;
    final steps = ['热身', '主课', '拉伸'];
    return AppPage(
      routeName: AppRoutes.workoutSession,
      moduleName: 'train',
      moduleScene: 'workout_session',
      child: Scaffold(
        appBar: AppBar(title: Text(args?.title ?? '训练中')),
        body: args == null
            ? const Center(child: Text('缺少训练会话'))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  PulseCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '当前阶段：${steps[_step.clamp(0, steps.length - 1)]}',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 12),
                        LinearProgressIndicator(
                          value: (_step + 1) / steps.length,
                          minHeight: 8,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        const SizedBox(height: 12),
                        Text('会话 ${args.sessionId}'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ...List.generate(steps.length, (index) {
                    final done = index < _step;
                    final current = index == _step;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: PulseCard(
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            done
                                ? Icons.check_circle
                                : current
                                ? Icons.radio_button_checked
                                : Icons.circle_outlined,
                            color: done || current
                                ? Theme.of(context).colorScheme.primary
                                : null,
                          ),
                          title: Text(steps[index]),
                        ),
                      ),
                    );
                  }),
                ],
              ),
        bottomNavigationBar: args == null
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: FilledButton(
                    onPressed: _busy
                        ? null
                        : () {
                            if (_step < steps.length - 1) {
                              setState(() => _step += 1);
                            } else {
                              _complete();
                            }
                          },
                    child: Text(
                      _step < steps.length - 1 ? '完成当前阶段' : '结束并提交',
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}
