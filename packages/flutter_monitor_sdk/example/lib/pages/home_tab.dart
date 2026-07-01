import 'package:example/data/demo_api.dart';
import 'package:example/data/workbench_api.dart';
import 'package:example/models/demo_models.dart';
import 'package:example/models/monitor_event_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.workbenchApi, required this.demoApi});

  final WorkbenchApi workbenchApi;
  final DemoApi demoApi;

  @override
  State<HomeTab> createState() => HomeTabState();
}

class HomeTabState extends State<HomeTab>
    with AutomaticKeepAliveClientMixin, WidgetsBindingObserver {
  MonitorHomeState? _cachedState;
  HomeFeedState? _feedState;
  Object? _error;
  var _loading = false;
  var _showMineOnly = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (_cachedState == null) {
      _load(force: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        (_error != null || _cachedState == null)) {
      _load(force: true);
    }
  }

  Future<void> _load({bool force = false}) async {
    if (_loading) return;
    if (!force && _cachedState != null && _error == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait<Object>([
        widget.workbenchApi.loadHomeState(
          showMineOnly: _showMineOnly,
          currentUserId: AppSession.userId,
        ),
        widget.demoApi.loadHomeFeed(userId: AppSession.userId),
      ]);
      final state = results[0] as MonitorHomeState;
      final feedState = results[1] as HomeFeedState;
      if (!mounted) return;
      setState(() {
        _cachedState = state.copyWith(showMineOnly: _showMineOnly);
        _feedState = feedState;
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

  Future<void> _refresh() => _load(force: true);

  void _toggleFilter(bool mineOnly) {
    if (_showMineOnly == mineOnly) return;
    setState(() {
      _showMineOnly = mineOnly;
      if (_cachedState != null) {
        _cachedState = _cachedState!.copyWith(showMineOnly: mineOnly);
      }
    });
  }

  void _openEvent(MonitorEventItem item) {
    AppNavigation.openEventDetail(context, item);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final colorScheme = Theme.of(context).colorScheme;
    final state = _cachedState;

    return Scaffold(
      appBar: AppBar(
        title: const Text('监控事件'),
        actions: [
          IconButton(
            tooltip: '打开 Workbench Web',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Workbench Web: http://localhost:4700'),
                ),
              );
            },
            icon: const Icon(Icons.open_in_browser),
          ),
          IconButton(
            tooltip: '刷新',
            onPressed: _loading ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: _buildBody(context, colorScheme, state),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ColorScheme colorScheme,
    MonitorHomeState? state,
  ) {
    if (_loading && state == null) {
      return const CustomScrollView(
        slivers: [
          SliverFillRemaining(
            child: Center(child: CircularProgressIndicator()),
          ),
        ],
      );
    }

    if (_error != null && state == null) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverFillRemaining(
            child: _ConnectionError(
              message: _error.toString(),
              onRetry: _refresh,
            ),
          ),
        ],
      );
    }

    if (state == null) {
      return const SizedBox.shrink();
    }

    final events = state.visibleEvents;
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _HealthBanner(health: state.health)),
        if (_feedState != null)
          SliverToBoxAdapter(child: _BusinessFeedSection(feed: _feedState!)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('我的事件')),
                ButtonSegment(value: false, label: Text('全部事件')),
              ],
              selected: {_showMineOnly},
              onSelectionChanged: (values) => _toggleFilter(values.first),
            ),
          ),
        ),
        if (events.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Text(
                _showMineOnly ? '当前 userId 暂无事件，去其它页面操作后再刷新' : 'Workbench 暂无事件',
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverList.builder(
              itemCount: events.length,
              itemBuilder: (context, index) {
                final item = events[index];
                return _EventCard(item: item, onTap: () => _openEvent(item));
              },
            ),
          ),
      ],
    );
  }
}

class _HealthBanner extends StatelessWidget {
  const _HealthBanner({required this.health});

  final WorkbenchHealth health;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final lastIngest = health.lastIngestAt;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Card(
        color: health.ok
            ? colorScheme.primaryContainer
            : colorScheme.errorContainer,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(
                health.ok ? Icons.cloud_done : Icons.cloud_off,
                color: health.ok
                    ? colorScheme.onPrimaryContainer
                    : colorScheme.onErrorContainer,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      health.ok ? 'Workbench 已连接' : 'Workbench 异常',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      '${health.eventCount} events · ${health.sessionCount} sessions'
                      '${lastIngest != null ? ' · ${_formatRelative(lastIngest)}' : ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BusinessFeedSection extends StatelessWidget {
  const _BusinessFeedSection({required this.feed});

  final HomeFeedState feed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: AppSection(
        title: '首页推荐',
        subtitle: '${feed.userId} · ${feed.unreadCount} 条未读',
        children: [
          for (final item in feed.items.take(4))
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.title),
              subtitle: Text(item.subtitle),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    item.metricValue,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(
                    item.metricLabel,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.item, required this.onTap});

  final MonitorEventItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final accent = _signalColor(colorScheme, item.signalType);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: accent, width: 4)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name ?? '(unnamed)',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.signalType ?? '-'} · ${item.status ?? '-'} · ${_formatRelative(item.timestamp)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (item.routeName != null)
                        _ChipLabel(text: item.routeName!),
                      if (item.userId != null) _ChipLabel(text: item.userId!),
                      _ChipLabel(text: _truncate(item.eventId, 18)),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChipLabel extends StatelessWidget {
  const _ChipLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text, style: Theme.of(context).textTheme.labelSmall),
    );
  }
}

class _ConnectionError extends StatelessWidget {
  const _ConnectionError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.dns_outlined, size: 48),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            'Workbench API :3700 · Web :4700',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('重试')),
        ],
      ),
    );
  }
}

Color _signalColor(ColorScheme colorScheme, String? signalType) {
  return switch (signalType) {
    'trace' => colorScheme.primary,
    'span' => colorScheme.secondary,
    'error' => colorScheme.error,
    'breadcrumb' => colorScheme.tertiary,
    'metric' => colorScheme.outline,
    _ => colorScheme.outlineVariant,
  };
}

String _formatRelative(DateTime? time) {
  if (time == null) return '-';
  final diff = DateTime.now().difference(time);
  if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}

String _truncate(String value, int maxLength) {
  if (value.length <= maxLength) return value;
  return '${value.substring(0, maxLength)}…';
}
