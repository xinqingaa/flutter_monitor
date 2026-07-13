import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/theme/app_theme.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class DiscoverTab extends StatefulWidget {
  const DiscoverTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<DiscoverTab> createState() => _DiscoverTabState();
}

class _DiscoverTabState extends State<DiscoverTab>
    with AutomaticKeepAliveClientMixin {
  List<CourseSummary> _items = const [];
  List<String> _categories = const [];
  String? _category;
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
      final result = await widget.api.courses(category: _category);
      if (!mounted) return;
      setState(() {
        _items = result.items;
        _categories = result.categories;
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
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const PulseHeader(title: '发现课程', subtitle: '预约线下/直播团课'),
            if (_categories.isNotEmpty)
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: const Text('全部'),
                        selected: _category == null,
                        onSelected: (_) {
                          setState(() => _category = null);
                          _load();
                        },
                      ),
                    ),
                    ..._categories.map(
                      (category) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(category),
                          selected: _category == category,
                          onSelected: (_) {
                            setState(() => _category = category);
                            _load();
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            ..._items.map((item) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: PulseCard(
                  onTap: () => AppNavigation.openCourse(context, item.id),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          ToneBadge(label: item.category, tone: item.coverTone),
                          const Spacer(),
                          Text(
                            item.seatsLeft > 0 ? '剩 ${item.seatsLeft} 席' : '已满',
                            style: TextStyle(
                              color: item.seatsLeft > 0
                                  ? AppTheme.seed
                                  : Theme.of(context).colorScheme.error,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        item.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(item.summary),
                      const SizedBox(height: 10),
                      Text(
                        '¥${item.price} · ${item.durationMin} 分钟',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
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
