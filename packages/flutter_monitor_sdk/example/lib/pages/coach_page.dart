import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class CoachPage extends StatefulWidget {
  const CoachPage({super.key, required this.api, required this.coachId});

  final DemoApi api;
  final String coachId;

  @override
  State<CoachPage> createState() => _CoachPageState();
}

class _CoachPageState extends State<CoachPage> {
  CoachProfile? _coach;
  Object? _error;
  var _loading = true;

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
      final coach = await widget.api.coach(widget.coachId);
      if (!mounted) return;
      setState(() {
        _coach = coach;
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
    final coach = _coach;
    return AppPage(
      routeName: AppRoutes.coach,
      moduleName: 'discover',
      moduleScene: 'coach',
      child: Scaffold(
        appBar: AppBar(title: Text(coach?.name ?? '教练')),
        body: AsyncBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          child: coach == null
              ? const SizedBox.shrink()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    PulseCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            coach.name,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(coach.title),
                          const SizedBox(height: 8),
                          Text(
                            '${coach.years} 年经验 · 评分 ${coach.rating.toStringAsFixed(1)}',
                          ),
                          const SizedBox(height: 12),
                          Text(coach.bio),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 6,
                            children: coach.tags
                                .map(
                                  (tag) => ToneBadge(label: tag, tone: 'teal'),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '相关课程',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...coach.courseIds.map(
                      (id) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: PulseCard(
                          onTap: () => AppNavigation.openCourse(context, id),
                          child: Row(
                            children: [
                              Expanded(child: Text(id)),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
