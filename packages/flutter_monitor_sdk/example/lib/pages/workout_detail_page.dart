import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/pages/workout_session_page.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/theme/app_theme.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class WorkoutDetailPage extends StatefulWidget {
  const WorkoutDetailPage({
    super.key,
    required this.api,
    required this.workoutId,
  });

  final DemoApi api;
  final String workoutId;

  @override
  State<WorkoutDetailPage> createState() => _WorkoutDetailPageState();
}

class _WorkoutDetailPageState extends State<WorkoutDetailPage> {
  WorkoutDetail? _detail;
  Object? _error;
  var _loading = true;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await widget.api.workoutDetail(widget.workoutId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      final session = await widget.api.startWorkout(widget.workoutId);
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.start',
        message: '已开始 ${session.title}',
        properties: {
          'result': 'success',
          'workout_id': session.workoutId,
        },
      );
      await Navigator.of(context).pushNamed(
        AppRoutes.workoutSession,
        arguments: WorkoutSessionArgs(
          workoutId: session.workoutId,
          sessionId: session.sessionId,
          title: session.title,
        ),
      );
      _load();
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.start',
        result: MonitorTrackResult.failed,
        error: error.message,
        message: error.message,
        properties: {'result': 'failed', 'biz_code': error.code},
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkin() async {
    setState(() => _busy = true);
    try {
      await widget.api.checkin(widget.workoutId);
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.checkin',
        message: '打卡成功',
        properties: {'result': 'success', 'workout_id': widget.workoutId},
      );
      _load();
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'workout.checkin',
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
    final detail = _detail;
    return AppPage(
      routeName: AppRoutes.workoutDetail,
      moduleName: 'train',
      moduleScene: 'workout_detail',
      child: Scaffold(
        appBar: AppBar(title: Text(detail?.title ?? '训练详情')),
        body: AsyncBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          child: detail == null
              ? const SizedBox.shrink()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      height: 160,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.tone(detail.coverTone),
                            AppTheme.tone(
                              detail.coverTone,
                            ).withValues(alpha: 0.65),
                          ],
                        ),
                      ),
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ToneBadge(label: detail.level, tone: 'amber'),
                          const Spacer(),
                          Text(
                            '${detail.durationMin} 分钟 · ${detail.kcal} kcal',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(detail.description),
                    const SizedBox(height: 16),
                    ...detail.segments.map(
                      (segment) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: PulseCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  segment.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text('${segment.minutes} 分钟'),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
        bottomNavigationBar: detail == null
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy || detail.checkedInToday
                              ? null
                              : _checkin,
                          child: Text(
                            detail.checkedInToday ? '今日已打卡' : '快速打卡',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _busy ? null : _start,
                          child: const Text('开始训练'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}
