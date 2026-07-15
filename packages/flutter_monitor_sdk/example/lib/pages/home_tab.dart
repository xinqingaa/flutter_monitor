import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/session/app_session.dart';
import 'package:example/theme/app_theme.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> with AutomaticKeepAliveClientMixin {
  HomeDashboard? _dashboard;
  List<RecommendItem> _recs = const [];
  Object? _error;
  var _loading = true;

  @override
  bool get wantKeepAlive => true;

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
      final results = await Future.wait<Object>([
        widget.api.dashboard(),
        widget.api.recommendations(),
      ]);
      if (!mounted) return;
      setState(() {
        _dashboard = results[0] as HomeDashboard;
        _recs = results[1] as List<RecommendItem>;
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

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final dash = _dashboard;
    return RefreshIndicator(
      onRefresh: _load,
      child: AsyncBody(
        loading: _loading && dash == null,
        error: _error,
        onRetry: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            PulseHeader(
              title: dash?.greeting ?? '你好',
              subtitle: AppSession.displayName ?? 'PulseFit',
              trailing: IconButton(
                onPressed: () => AppNavigation.openNotices(context),
                icon: const Icon(Icons.notifications_none),
              ),
            ),
            if (dash != null) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: PulseCard(
                  color: AppTheme.seed,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '连续打卡 ${dash.streakDays} 天',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${dash.kcal} kcal',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Text(
                        '今日已消耗',
                        style: TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.tonal(
                          onPressed: dash.nextWorkoutId.isEmpty
                              ? null
                              : () => AppNavigation.openWorkout(
                                  context,
                                  dash.nextWorkoutId,
                                ),
                          child: const Text('继续今日训练'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    MetricTile(
                      label: '步数',
                      value: '${dash.steps}',
                      progress: dash.steps / dash.stepsGoal,
                    ),
                    const SizedBox(width: 10),
                    MetricTile(
                      label: '活动',
                      value: '${dash.activeMin}',
                      unit: '分钟',
                      progress: dash.activeMin / dash.activeGoal,
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                '为你推荐',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 8),
            ..._recs.map((item) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: PulseCard(
                  onTap: () {
                    if (item.type == 'workout') {
                      AppNavigation.openWorkout(context, item.id);
                    } else if (item.type == 'course') {
                      AppNavigation.openCourse(context, item.id);
                    }
                  },
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: AppTheme.tone(item.tone).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(
                          item.type == 'workout'
                              ? Icons.fitness_center
                              : Icons.event_available,
                          color: AppTheme.tone(item.tone),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.subtitle,
                              style: TextStyle(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
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
            }),
          ],
        ),
      ),
    );
  }
}
