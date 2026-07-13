import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/theme/app_theme.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class TrainTab extends StatefulWidget {
  const TrainTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<TrainTab> createState() => _TrainTabState();
}

class _TrainTabState extends State<TrainTab> with AutomaticKeepAliveClientMixin {
  List<WorkoutSummary> _items = const [];
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
      final items = await widget.api.workouts();
      if (!mounted) return;
      setState(() {
        _items = items;
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
    return RefreshIndicator(
      onRefresh: _load,
      child: AsyncBody(
        loading: _loading && _items.isEmpty,
        error: _error,
        onRetry: _load,
        empty: !_loading && _items.isEmpty,
        emptyLabel: '暂无训练计划',
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(0, 0, 0, 24),
          itemCount: _items.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) {
              return const PulseHeader(
                title: '训练计划',
                subtitle: '选择一项开始今日运动',
              );
            }
            final item = _items[index - 1];
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: PulseCard(
                onTap: () => AppNavigation.openWorkout(context, item.id),
                child: Row(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.tone(item.coverTone),
                            AppTheme.tone(item.coverTone).withValues(alpha: 0.7),
                          ],
                        ),
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${item.durationMin} 分钟 · ${item.kcal} kcal · ${item.level}',
                            style: TextStyle(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            children: item.focus
                                .map(
                                  (tag) => ToneBadge(
                                    label: tag,
                                    tone: item.coverTone,
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
