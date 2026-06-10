import 'package:example/models/demo_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class FeedDetailPage extends StatefulWidget {
  const FeedDetailPage({super.key});

  @override
  State<FeedDetailPage> createState() => _FeedDetailPageState();
}

class _FeedDetailPageState extends State<FeedDetailPage> {
  DemoFeedItem? _item;
  var _favorite = false;
  var _shareState = '未分享';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is DemoFeedItem && _item == null) {
      _item = arguments;
      FlutterMonitorSDK.track(
        action: 'content.detail.view',
        result: MonitorTrackResult.success,
        target: 'feed_detail',
        properties: <String, Object?>{
          'content.id': arguments.id,
          'content.source': arguments.source,
        },
      );
    }
  }

  void _toggleFavorite() {
    setState(() => _favorite = !_favorite);
    FlutterMonitorSDK.track(
      action: 'content.favorite.toggle',
      result: MonitorTrackResult.success,
      target: 'favorite_button',
      properties: <String, Object?>{
        'content.id': _item?.id,
        'favorite.enabled': _favorite,
      },
    );
  }

  void _share() {
    FlutterMonitorSDK.track(
      action: 'content.share.open',
      result: MonitorTrackResult.started,
      target: 'share_button',
      properties: <String, Object?>{'content.id': _item?.id},
    );
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => _ShareSheet(
        onCancel: () {
          setState(() => _shareState = '分享面板打开后被取消');
          FlutterMonitorSDK.track(
            action: 'content.share.cancel',
            result: MonitorTrackResult.cancelled,
            target: 'share_sheet',
            properties: <String, Object?>{'content.id': _item?.id},
          );
          Navigator.pop(context);
        },
        onSubmit: () {
          setState(() => _shareState = '已复制分享链接');
          FlutterMonitorSDK.track(
            action: 'content.share.copy',
            result: MonitorTrackResult.success,
            target: 'share_sheet',
            properties: <String, Object?>{'content.id': _item?.id},
          );
          Navigator.pop(context);
        },
      ),
    );
  }

  void _applyExpiredCoupon() {
    FlutterMonitorSDK.track(
      action: 'content.coupon.apply',
      result: MonitorTrackResult.failed,
      level: MonitorEventLevel.warning,
      target: 'coupon_banner',
      error: 'invalid_coupon',
      properties: const <String, Object?>{'coupon.code': 'DEMO_EXPIRED'},
    );
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('优惠券 DEMO_EXPIRED 已过期')));
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    return AppPage(
      routeName: AppRoutes.feedDetail,
      moduleName: 'content',
      moduleScene: 'detail',
      child: Scaffold(
        appBar: AppBar(title: const Text('内容详情')),
        body: item == null
            ? const Center(child: Text('缺少详情参数'))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  AppSection(
                    title: item.title,
                    subtitle: '${item.source} · ${item.subtitle}',
                    children: [
                      Text(item.description),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: _toggleFavorite,
                            icon: Icon(
                              _favorite
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                            ),
                            label: Text(_favorite ? '取消收藏' : '收藏'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _share,
                            icon: const Icon(Icons.ios_share),
                            label: const Text('分享'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _applyExpiredCoupon,
                            icon: const Icon(Icons.local_offer_outlined),
                            label: const Text('使用优惠券'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(_shareState),
                    ],
                  ),
                  AppSection(
                    title: '下一步',
                    children: [
                      FilledButton.icon(
                        onPressed: () => AppNavigation.openCheckout(context),
                        icon: const Icon(Icons.shopping_cart_checkout),
                        label: const Text('基于内容创建订单'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () =>
                            AppNavigation.openPerformanceGallery(context),
                        icon: const Icon(Icons.query_stats),
                        label: const Text('查看内容表现'),
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

class _ShareSheet extends StatelessWidget {
  const _ShareSheet({required this.onCancel, required this.onSubmit});

  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('分享内容', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            const TextField(
              decoration: InputDecoration(
                labelText: '分享备注',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onCancel,
                    child: const Text('取消'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: onSubmit,
                    child: const Text('复制链接'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
