import 'package:example/data/demo_api.dart';
import 'package:example/models/demo_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  late Future<HomeFeedState> _feedFuture;
  var _refreshCount = 0;

  @override
  void initState() {
    super.initState();
    _feedFuture = _loadFeed(reason: 'initial');
  }

  Future<HomeFeedState> _loadFeed({required String reason}) async {
    FlutterMonitorSDK.track(
      action: 'home.feed.load',
      result: MonitorTrackResult.started,
      target: 'home_feed',
      properties: <String, Object?>{'reason': reason},
    );
    try {
      final state = await widget.api.loadHomeFeed();
      FlutterMonitorSDK.track(
        action: 'home.feed.load',
        result: MonitorTrackResult.success,
        target: 'home_feed',
        properties: <String, Object?>{
          'reason': reason,
          'repo.count': state.repos.length,
          'post.count': state.posts.length,
        },
      );
      return state;
    } catch (error, stackTrace) {
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'home_feed_load_failed',
        properties: <String, Object?>{'reason': reason},
      );
      rethrow;
    }
  }

  Future<void> _refreshFeed() async {
    final measure = FlutterMonitorSDK.measure(
      action: 'home.feed.refresh',
      mode: MonitorMeasureMode.stage,
      target: 'feed_refresh',
      properties: <String, Object?>{'refresh.count': _refreshCount + 1},
    );
    setState(() {
      _refreshCount += 1;
      _feedFuture = _loadFeed(reason: 'pull_refresh');
    });
    try {
      await _feedFuture;
      measure.finish(properties: <String, Object?>{'result': 'success'});
    } catch (error) {
      measure.cancel(reason: 'request_failed');
    }
  }

  void _openItem(DemoFeedItem item) {
    FlutterMonitorSDK.track(
      action: 'home.feed.item.open',
      result: MonitorTrackResult.success,
      target: 'feed_card',
      properties: <String, Object?>{
        'feed.item_id': item.id,
        'feed.source': item.source,
      },
    );
    AppNavigation.openFeedDetail(context, item);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('首页'),
        actions: [
          IconButton(
            tooltip: '数据中心',
            onPressed: () => AppNavigation.openApiLab(context),
            icon: const Icon(Icons.sync_alt),
          ),
          IconButton(
            tooltip: '视频',
            onPressed: () => AppNavigation.openVideo(context),
            icon: const Icon(Icons.play_circle_outline),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshFeed,
        child: FutureBuilder<HomeFeedState>(
          future: _feedFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const _LoadingFeed();
            }
            if (snapshot.hasError) {
              return _FeedError(onRetry: _refreshFeed);
            }
            final feed = snapshot.requireData;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _HeroPanel(profile: feed.profile),
                AppSection(
                  title: '今日推荐',
                  subtitle: '公开 API 数据混排，用于验证真实请求、列表和详情链路。',
                  children: [
                    for (final item in feed.items)
                      _FeedCard(item: item, onTap: () => _openItem(item)),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({required this.profile});

  final GithubProfile profile;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundImage: profile.avatarUrl.isEmpty
                ? null
                : NetworkImage(profile.avatarUrl),
            child: profile.avatarUrl.isEmpty ? const Icon(Icons.code) : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.name,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text('@${profile.login} · ${profile.publicRepos} repos'),
                const SizedBox(height: 8),
                Text('${profile.followers} followers on GitHub'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedCard extends StatelessWidget {
  const _FeedCard({required this.item, required this.onTap});

  final DemoFeedItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  item.source == 'GitHub'
                      ? Icons.data_object
                      : Icons.article_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    item.metricLabel,
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                  Text(
                    item.metricValue,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadingFeed extends StatelessWidget {
  const _LoadingFeed();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: const [
        SizedBox(height: 120),
        Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

class _FeedError extends StatelessWidget {
  const _FeedError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 100),
        const Icon(Icons.cloud_off, size: 48),
        const SizedBox(height: 16),
        Text(
          '首页数据加载失败',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: onRetry, child: const Text('重试')),
      ],
    );
  }
}
