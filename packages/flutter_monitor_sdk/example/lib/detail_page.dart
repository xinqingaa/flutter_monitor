import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> with TickerProviderStateMixin {
  Object? _detailId = 1;
  var _isFavorite = false;
  var _cartCount = 0;
  var _couponMessage = '暂无可用优惠券';
  var _shareMessage = '分享面板未打开';
  var _selectedTab = 0;
  int? _measuredTabIndex;
  var _chartExpanded = false;
  var _chartLoading = false;
  late final TabController _tabController;
  late final AnimationController _chartAnimationController;
  List<double> _chartValues = const <double>[42, 58, 36, 74, 52];

  static const _tabLabels = <String>['概览', '收入', '留存'];
  static const _tabKeys = <String>['overview', 'revenue', 'retention'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabLabels.length, vsync: this)
      ..addListener(_handleTabChanged);
    _chartAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
    );
    // 在页面第一帧渲染后，上报页面加载完成事件
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pageName = ModalRoute.of(context)?.settings.name;
      if (pageName != null) {
        FlutterMonitorSDK.markPageRendered(pageName);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map) {
      _detailId = arguments['id'] ?? _detailId;
    }
    FlutterMonitorSDK.setContext(moduleName: 'example', moduleScene: 'detail');
  }

  @override
  void dispose() {
    _tabController
      ..removeListener(_handleTabChanged)
      ..dispose();
    _chartAnimationController.dispose();
    super.dispose();
  }

  bool get _isTrackDemo => _detailId == 1;

  bool get _isMeasureDemo => _detailId == 2;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('详情页 #$_detailId')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_isTrackDemo) _buildTrackDemo(context),
          if (_isMeasureDemo) _buildMeasureDemo(context),
          if (!_isTrackDemo && !_isMeasureDemo)
            const Text('当前 detail id 暂未配置示例场景。'),
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),
          Text(
            '当前 Flutter 路由是 /detail，业务路由是 /detail?id=$_detailId。'
            '这些 track 和 measure 事件会归属当前会话、当前路由和当前页面实例。',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          if (_isTrackDemo)
            Text(
              '本页用于验证业务埋点 track：它记录发生过的关键业务动作，'
              '后续错误、卡顿或失败请求可以携带这些足迹帮助复现用户路径。',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          if (_isMeasureDemo)
            Text(
              '本页用于验证交互性能 measure：Tab 切换使用 common 窗口，'
              '图表刷新和面板展开使用 stage 窗口，事件会带 frame.* 性能摘要。',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const SizedBox(height: 16),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => Navigator.pushNamed(context, '/complex_list'),
            child: const Text('进入复杂列表页'),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => Navigator.maybePop(context),
            child: const Text('返回上一页'),
          ),
        ],
      ),
    );
  }

  Widget _buildTrackDemo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionTitle('业务埋点 track 示例'),
        Text('收藏状态：${_isFavorite ? '已收藏' : '未收藏'}  购物车数量：$_cartCount'),
        const SizedBox(height: 8),
        Text(_couponMessage),
        Text(_shareMessage),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton(
              onPressed: _toggleFavorite,
              child: Text(_isFavorite ? '取消收藏' : '加入收藏'),
            ),
            FilledButton.tonal(
              onPressed: _addToCart,
              child: const Text('加入购物车'),
            ),
            OutlinedButton(
              onPressed: _applyExpiredCoupon,
              child: const Text('使用过期优惠券'),
            ),
            OutlinedButton(onPressed: _cancelShare, child: const Text('取消分享')),
          ],
        ),
      ],
    );
  }

  Widget _buildMeasureDemo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionTitle('交互性能 measure 示例'),
        TabBar(
          controller: _tabController,
          tabs: [for (final label in _tabLabels) Tab(text: label)],
          onTap: _measureTabTap,
        ),
        const SizedBox(height: 12),
        AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          height: _chartExpanded ? 360 : 280,
          child: TabBarView(
            controller: _tabController,
            children: [
              for (var index = 0; index < _tabLabels.length; index++)
                _buildMeasureTab(index),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMeasureTab(int index) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: AnimatedBuilder(
            animation: _chartAnimationController,
            builder: (context, _) {
              return _MetricChart(
                title: '${_tabLabels[index]}图表',
                values: index == _selectedTab
                    ? _animatedChartValues
                    : _valuesForTab(index),
                expanded: _chartExpanded,
                loading: _chartLoading && index == _selectedTab,
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton(
              onPressed: index == _selectedTab ? _refreshChart : null,
              child: const Text('刷新图表'),
            ),
            FilledButton.tonal(
              onPressed: index == _selectedTab ? _toggleChartPanel : null,
              child: Text(_chartExpanded ? '收起图表' : '展开图表'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium),
    );
  }

  List<double> get _animatedChartValues {
    final progress = Curves.easeOutCubic.transform(
      _chartAnimationController.value,
    );
    return _chartValues
        .map((value) => max(4, value * (0.65 + 0.35 * progress)).toDouble())
        .toList(growable: false);
  }

  void _toggleFavorite() {
    final nextValue = !_isFavorite;
    setState(() => _isFavorite = nextValue);
    FlutterMonitorSDK.track(
      action: 'detail.favorite.toggle',
      result: MonitorTrackResult.success,
      target: 'favorite_button',
      properties: <String, Object?>{
        'detail.variant': 'track_demo',
        'favorite.enabled': nextValue,
      },
    );
  }

  void _addToCart() {
    setState(() => _cartCount += 1);
    FlutterMonitorSDK.track(
      action: 'detail.cart.add',
      result: MonitorTrackResult.success,
      target: 'add_to_cart_button',
      properties: <String, Object?>{
        'detail.variant': 'track_demo',
        'cart.count': _cartCount,
      },
    );
  }

  void _applyExpiredCoupon() {
    setState(() => _couponMessage = '优惠券 DEMO_EXPIRED 校验失败');
    FlutterMonitorSDK.track(
      action: 'detail.coupon.apply',
      result: MonitorTrackResult.failed,
      target: 'coupon_button',
      error: 'invalid_coupon',
      properties: const <String, Object?>{
        'detail.variant': 'track_demo',
        'coupon.type': 'expired_demo',
      },
    );
  }

  void _cancelShare() {
    FlutterMonitorSDK.track(
      action: 'detail.share.open',
      result: MonitorTrackResult.started,
      target: 'share_button',
      properties: const <String, Object?>{'detail.variant': 'track_demo'},
    );
    setState(() => _shareMessage = '分享面板已打开，并被用户取消');
    FlutterMonitorSDK.track(
      action: 'detail.share.cancel',
      result: MonitorTrackResult.cancelled,
      target: 'share_sheet',
      properties: const <String, Object?>{'detail.variant': 'track_demo'},
    );
  }

  void _measureTabTap(int index) {
    if (index == _selectedTab) return;
    _measuredTabIndex = index;
    _measureTabSwitch(index, trigger: 'tap');
  }

  void _handleTabChanged() {
    final index = _tabController.index;
    if (index == _selectedTab) return;
    if (_measuredTabIndex != index) {
      _measureTabSwitch(index, trigger: 'swipe');
    }
    setState(() {
      _selectedTab = index;
      _chartValues = _valuesForTab(index);
    });
    _chartAnimationController.forward(from: 0);
    if (!_tabController.indexIsChanging) {
      _measuredTabIndex = null;
    }
  }

  void _measureTabSwitch(int index, {required String trigger}) {
    FlutterMonitorSDK.measure(
      action: 'detail.tab.switch',
      target: '${_tabKeys[index]}_tab',
      properties: <String, Object?>{
        'detail.variant': 'measure_demo',
        'tab.trigger': trigger,
        'tab.from': _tabKeys[_selectedTab],
        'tab.to': _tabKeys[index],
      },
    );
  }

  Future<void> _refreshChart() async {
    if (_chartLoading) return;
    final measure = FlutterMonitorSDK.measure(
      action: 'detail.chart.refresh',
      mode: MonitorMeasureMode.stage,
      target: 'metric_chart',
      properties: <String, Object?>{
        'detail.variant': 'measure_demo',
        'chart.tab': _tabKeys[_selectedTab],
      },
    );
    setState(() => _chartLoading = true);
    await Future<void>.delayed(const Duration(milliseconds: 180));
    if (!mounted) {
      measure.cancel(reason: 'page_disposed');
      return;
    }
    setState(() {
      _chartValues = _nextChartValues();
      _chartLoading = false;
    });
    await _chartAnimationController.forward(from: 0);
    measure.finish(
      properties: <String, Object?>{
        'chart.point_count': _chartValues.length,
        'chart.expanded': _chartExpanded,
      },
    );
  }

  Future<void> _toggleChartPanel() async {
    final nextExpanded = !_chartExpanded;
    final measure = FlutterMonitorSDK.measure(
      action: 'detail.chart.panel',
      mode: MonitorMeasureMode.stage,
      target: 'metric_chart_panel',
      properties: <String, Object?>{
        'detail.variant': 'measure_demo',
        'chart.next_state': nextExpanded ? 'expanded' : 'collapsed',
      },
    );
    setState(() => _chartExpanded = nextExpanded);
    await Future<void>.delayed(const Duration(milliseconds: 240));
    if (!mounted) {
      measure.cancel(reason: 'page_disposed');
      return;
    }
    measure.finish(
      properties: <String, Object?>{'chart.expanded': _chartExpanded},
    );
  }

  List<double> _valuesForTab(int index) {
    return switch (index) {
      1 => const <double>[54, 72, 68, 86, 74],
      2 => const <double>[78, 64, 70, 61, 83],
      _ => const <double>[42, 58, 36, 74, 52],
    };
  }

  List<double> _nextChartValues() {
    final base = _valuesForTab(_selectedTab);
    final offset = _cartCount * 3 + (_chartExpanded ? 8 : 0);
    return [
      for (var i = 0; i < base.length; i++)
        (base[i] + offset + (i.isEven ? 7 : -5)).clamp(18, 96).toDouble(),
    ];
  }
}

class _MetricChart extends StatelessWidget {
  const _MetricChart({
    required this.title,
    required this.values,
    required this.expanded,
    required this.loading,
  });

  final String title;
  final List<double> values;
  final bool expanded;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      height: expanded ? 260 : 180,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              if (loading)
                const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: CustomPaint(
              painter: _BarChartPainter(
                values: values,
                color: colorScheme.primary,
                guideColor: colorScheme.outlineVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  const _BarChartPainter({
    required this.values,
    required this.color,
    required this.guideColor,
  });

  final List<double> values;
  final Color color;
  final Color guideColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty || size.width <= 0 || size.height <= 0) return;
    final guidePaint = Paint()
      ..color = guideColor
      ..strokeWidth = 1;
    final barPaint = Paint()..color = color;
    for (var i = 0; i < 4; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), guidePaint);
    }
    final gap = size.width / (values.length * 2 + 1);
    final barWidth = gap;
    for (var i = 0; i < values.length; i++) {
      final normalized = (values[i] / 100).clamp(0.0, 1.0);
      final barHeight = max(4.0, size.height * normalized);
      final left = gap + i * gap * 2;
      final top = size.height - barHeight;
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(left, top, barWidth, barHeight),
        const Radius.circular(6),
      );
      canvas.drawRRect(rect, barPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) {
    return oldDelegate.values != values ||
        oldDelegate.color != color ||
        oldDelegate.guideColor != guideColor;
  }
}
