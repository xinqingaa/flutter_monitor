import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class VideoPage extends StatefulWidget {
  const VideoPage({super.key});

  @override
  State<VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends State<VideoPage> {
  final _pageController = PageController(viewportFraction: 0.88);
  final _commentController = TextEditingController();
  var _currentIndex = 0;
  var _playing = false;

  static const _videos = <_VideoItem>[
    _VideoItem('launch_review', '启动链路复盘', '02:48'),
    _VideoItem('jank_case', '复杂列表卡顿分析', '04:12'),
    _VideoItem('release_check', '灰度发布检查', '03:36'),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    FlutterMonitorSDK.measure(
      action: 'video.page.switch',
      target: 'video_page_view',
      properties: <String, Object?>{
        'video.from': _videos[_currentIndex].id,
        'video.to': _videos[index].id,
      },
    );
    setState(() {
      _currentIndex = index;
      _playing = false;
    });
  }

  void _togglePlay() {
    setState(() => _playing = !_playing);
    FlutterMonitorSDK.track(
      action: _playing ? 'video.play' : 'video.pause',
      result: MonitorTrackResult.success,
      target: 'video_card',
      properties: <String, Object?>{'video.id': _videos[_currentIndex].id},
    );
  }

  void _openCommentSheet() {
    FlutterMonitorSDK.track(
      action: 'video.comment.open',
      result: MonitorTrackResult.started,
      target: 'comment_sheet',
      properties: <String, Object?>{'video.id': _videos[_currentIndex].id},
    );
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('发表评论', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              TextField(
                controller: _commentController,
                autofocus: true,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: '评论内容',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () {
                  final text = _commentController.text.trim();
                  FlutterMonitorSDK.track(
                    action: 'video.comment.submit',
                    result: text.isEmpty
                        ? MonitorTrackResult.failed
                        : MonitorTrackResult.success,
                    level: text.isEmpty ? MonitorEventLevel.warning : null,
                    target: 'comment_submit_button',
                    error: text.isEmpty ? 'empty_comment' : null,
                    properties: <String, Object?>{
                      'video.id': _videos[_currentIndex].id,
                      'comment.length': text.length,
                    },
                  );
                  if (text.isNotEmpty) {
                    _commentController.clear();
                    Navigator.pop(context);
                  }
                },
                icon: const Icon(Icons.send_outlined),
                label: const Text('提交评论'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.video,
      moduleName: 'content',
      moduleScene: 'video',
      child: Scaffold(
        appBar: AppBar(title: const Text('视频频道')),
        body: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: _onPageChanged,
                itemCount: _videos.length,
                itemBuilder: (context, index) {
                  final video = _videos[index];
                  return _VideoCard(
                    video: video,
                    active: index == _currentIndex,
                    playing: index == _currentIndex && _playing,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _togglePlay,
                      icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
                      label: Text(_playing ? '暂停' : '播放'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _openCommentSheet,
                      icon: const Icon(Icons.comment_outlined),
                      label: const Text('评论'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoItem {
  const _VideoItem(this.id, this.title, this.duration);

  final String id;
  final String title;
  final String duration;
}

class _VideoCard extends StatelessWidget {
  const _VideoCard({
    required this.video,
    required this.active,
    required this.playing,
  });

  final _VideoItem video;
  final bool active;
  final bool playing;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AnimatedScale(
      duration: const Duration(milliseconds: 220),
      scale: active ? 1 : 0.94,
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colorScheme.inverseSurface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(8),
                  ),
                ),
                child: Icon(
                  playing ? Icons.pause_circle_filled : Icons.play_circle_fill,
                  size: 80,
                  color: colorScheme.onInverseSurface,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 6),
                  Text('视频时长 ${video.duration} · ${video.id}'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
