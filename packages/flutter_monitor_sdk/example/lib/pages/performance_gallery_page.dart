import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class PerformanceGalleryPage extends StatefulWidget {
  const PerformanceGalleryPage({super.key});

  @override
  State<PerformanceGalleryPage> createState() => _PerformanceGalleryPageState();
}

class _PerformanceGalleryPageState extends State<PerformanceGalleryPage>
    with TickerProviderStateMixin {
  late final AnimationController _jankController;
  late final AnimationController _chartController;
  final List<Uint8List> _retainedReports = <Uint8List>[];
  var _retainedMb = 0;
  var _chartExpanded = false;
  var _selectedSegment = 0;
  var _chartValues = const <double>[42, 58, 36, 74, 52];
  var _memoryBusy = false;

  @override
  void initState() {
    super.initState();
    _jankController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    _chartController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
    );
  }

  @override
  void dispose() {
    _jankController.dispose();
    _chartController.dispose();
    _retainedReports.clear();
    super.dispose();
  }

  void _blockMainThreadBriefly() {
    final start = DateTime.now();
    while (DateTime.now().difference(start).inMilliseconds < 45) {}
  }

  void _refreshImageWall() {
    if (_jankController.isAnimating) return;
    _blockMainThreadBriefly();
    appTrack(
      context,
      action: 'gallery.image_wall.refresh',
      target: 'image_wall',
      message: '已触发图片墙卡顿场景',
    );
    _jankController.forward(from: 0);
  }

  Future<void> _refreshReport() async {
    appTrack(
      context,
      action: 'gallery.report.refresh',
      target: 'report_chart',
      properties: <String, Object?>{'segment': _selectedSegment},
      result: MonitorTrackResult.started,
      message: '已记录报表刷新行为',
    );
    await Future<void>.delayed(const Duration(milliseconds: 120));
    if (!mounted) {
      return;
    }
    setState(() {
      _chartValues = _nextChartValues();
    });
    await _chartController.forward(from: 0);
    if (!mounted) return;
    appTrack(
      context,
      action: 'gallery.report.refresh',
      target: 'report_chart',
      result: MonitorTrackResult.success,
      properties: <String, Object?>{'point.count': _chartValues.length},
      message: '已记录报表刷新完成',
    );
  }

  void _switchSegment(int index) {
    if (_selectedSegment == index) return;
    setState(() {
      _selectedSegment = index;
      _chartValues = _valuesForSegment(index);
    });
    _chartController.forward(from: 0);
  }

  void _toggleReportPanel() {
    setState(() => _chartExpanded = !_chartExpanded);
  }

  Future<void> _generateOfflineReports() async {
    if (_memoryBusy) return;
    setState(() => _memoryBusy = true);
    const mb = 24;
    for (var index = 0; index < mb; index++) {
      final chunk = Uint8List(1024 * 1024);
      chunk.fillRange(0, chunk.length, index % 255);
      _retainedReports.add(chunk);
    }
    if (!mounted) return;
    setState(() {
      _retainedMb += mb;
      _memoryBusy = false;
    });
    appTrack(
      context,
      action: 'gallery.offline_report.generate',
      target: 'offline_report_button',
      properties: <String, Object?>{
        'allocated_mb': mb,
        'retained_mb': _retainedMb,
      },
      message: '已分配 ${mb}MB；内存事件需初始化开启',
    );
  }

  void _releaseOfflineReports() {
    if (_retainedReports.isEmpty || _memoryBusy) return;
    final released = _retainedMb;
    _retainedReports.clear();
    setState(() => _retainedMb = 0);
    appTrack(
      context,
      action: 'gallery.offline_report.release',
      target: 'release_report_button',
      properties: <String, Object?>{'released_mb': released},
      message: '已释放 ${released}MB',
    );
  }

  List<double> _valuesForSegment(int index) {
    return switch (index) {
      1 => const <double>[54, 72, 68, 86, 74],
      2 => const <double>[78, 64, 70, 61, 83],
      _ => const <double>[42, 58, 36, 74, 52],
    };
  }

  List<double> _nextChartValues() {
    final base = _valuesForSegment(_selectedSegment);
    final offset = _chartExpanded ? 8 : 0;
    return [
      for (var i = 0; i < base.length; i++)
        (base[i] + offset + (i.isEven ? 9 : -6)).clamp(18, 96).toDouble(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.performanceGallery,
      moduleName: 'content',
      moduleScene: 'performance_gallery',
      child: Scaffold(
        appBar: AppBar(title: const Text('内容创作中心')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSection(
              title: '内容表现',
              subtitle: '图表切换和刷新只记录业务埋点；交互诊断需在 SDK 初始化时开启。',
              children: [
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 0, label: Text('概览')),
                    ButtonSegment(value: 1, label: Text('收入')),
                    ButtonSegment(value: 2, label: Text('留存')),
                  ],
                  selected: {_selectedSegment},
                  onSelectionChanged: (values) => _switchSegment(values.first),
                ),
                const SizedBox(height: 12),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 240),
                  height: _chartExpanded ? 280 : 200,
                  child: RepaintBoundary(
                    child: AnimatedBuilder(
                      animation: _chartController,
                      builder: (context, _) {
                        return _MetricChart(
                          values: _animatedChartValues,
                          expanded: _chartExpanded,
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: _refreshReport,
                      icon: const Icon(Icons.refresh),
                      label: const Text('刷新报表'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _toggleReportPanel,
                      icon: Icon(
                        _chartExpanded ? Icons.unfold_less : Icons.unfold_more,
                      ),
                      label: Text(_chartExpanded ? '收起报表' : '展开报表'),
                    ),
                  ],
                ),
              ],
            ),
            AppSection(
              title: '复杂内容流',
              subtitle: '刷新图片墙会制造帧阻塞；卡顿/帧事件需在 SDK 初始化时开启。',
              children: [
                FilledButton.icon(
                  onPressed: _jankController.isAnimating
                      ? null
                      : _refreshImageWall,
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(_jankController.isAnimating ? '刷新中' : '刷新图片墙'),
                ),
                const SizedBox(height: 12),
                AnimatedBuilder(
                  animation: _jankController,
                  builder: (context, _) {
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: 18,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                          ),
                      itemBuilder: (context, index) => _GalleryTile(
                        index: index,
                        progress: _jankController.value,
                      ),
                    );
                  },
                ),
              ],
            ),
            AppSection(
              title: '离线报表缓存',
              subtitle: '模拟 retained memory 和释放行为；内存事件需在 SDK 初始化时开启。',
              children: [
                Text('当前保留 $_retainedMb MB'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: _memoryBusy ? null : _generateOfflineReports,
                      icon: const Icon(Icons.save_alt),
                      label: Text(_memoryBusy ? '分配中…' : '生成离线报表'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _retainedReports.isEmpty || _memoryBusy
                          ? null
                          : _releaseOfflineReports,
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('释放缓存'),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<double> get _animatedChartValues {
    final progress = Curves.easeOutCubic.transform(_chartController.value);
    return _chartValues
        .map((value) => max(4, value * (0.65 + 0.35 * progress)).toDouble())
        .toList(growable: false);
  }
}

class _GalleryTile extends StatelessWidget {
  const _GalleryTile({required this.index, required this.progress});

  final int index;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: Color.lerp(
          colorScheme.primaryContainer,
          colorScheme.tertiaryContainer,
          ((index % 6) / 5 + progress * 0.2).clamp(0.0, 1.0),
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Stack(
        children: [
          Center(
            child: Icon(
              index.isEven ? Icons.image_outlined : Icons.play_circle_outline,
              size: 34,
            ),
          ),
          Positioned(
            left: 8,
            bottom: 6,
            child: Text(
              '#${index + 1}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricChart extends StatelessWidget {
  const _MetricChart({required this.values, required this.expanded});

  final List<double> values;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: CustomPaint(
        painter: _BarChartPainter(
          values: values,
          color: colorScheme.primary,
          guideColor: colorScheme.outlineVariant,
        ),
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
        const Radius.circular(5),
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
