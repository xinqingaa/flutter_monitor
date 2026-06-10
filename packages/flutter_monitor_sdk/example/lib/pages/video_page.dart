import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:video_player/video_player.dart';

class VideoPage extends StatefulWidget {
  const VideoPage({super.key});

  @override
  State<VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends State<VideoPage> {
  final _pageController = PageController(viewportFraction: 0.88);
  final _commentController = TextEditingController();
  VideoPlayerController? _videoController;
  var _currentIndex = 0;
  var _initializing = false;
  var _playbackError = '';

  static final _videos = <_VideoItem>[
    _VideoItem(
      id: 'bee_remote',
      title: 'Flutter Bee Sample',
      duration: '00:09',
      url: Uri.parse(
        'https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4',
      ),
    ),
    _VideoItem(
      id: 'bee_remote_repeat',
      title: '重复初始化压力',
      duration: '00:09',
      url: Uri.parse(
        'https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4',
      ),
    ),
    _VideoItem(
      id: 'bee_remote_sheet',
      title: '弹层评论场景',
      duration: '00:09',
      url: Uri.parse(
        'https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4',
      ),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _prepareVideo(0, reason: 'initial');
  }

  @override
  void dispose() {
    _disposeVideoController(reason: 'page_dispose');
    _pageController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _prepareVideo(int index, {required String reason}) async {
    final video = _videos[index];
    setState(() {
      _initializing = true;
      _playbackError = '';
    });
    FlutterMonitorSDK.track(
      action: 'video.controller.prepare',
      result: MonitorTrackResult.started,
      target: 'video_player',
      properties: <String, Object?>{
        'video.id': video.id,
        'video.reason': reason,
      },
    );

    _disposeVideoController(reason: 'switch_prepare');
    final controller = VideoPlayerController.networkUrl(video.url);
    _videoController = controller;

    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (!mounted || _videoController != controller) {
        await controller.dispose();
        return;
      }
      setState(() {
        _initializing = false;
      });
      FlutterMonitorSDK.track(
        action: 'video.controller.prepare',
        result: MonitorTrackResult.success,
        target: 'video_player',
        properties: <String, Object?>{
          'video.id': video.id,
          'video.duration_ms': controller.value.duration.inMilliseconds,
          'video.url': video.url.toString(),
        },
      );
    } catch (error, stackTrace) {
      if (_videoController == controller) {
        _videoController = null;
      }
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _playbackError = error.toString();
      });
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'video_prepare_failed',
        handled: true,
        properties: <String, Object?>{
          'video.id': video.id,
          'video.url': video.url.toString(),
        },
      );
    }
  }

  void _disposeVideoController({required String reason}) {
    final controller = _videoController;
    if (controller == null) return;
    final video = _videos[_currentIndex];
    FlutterMonitorSDK.track(
      action: 'video.controller.dispose',
      result: MonitorTrackResult.success,
      target: 'video_player',
      properties: <String, Object?>{
        'video.id': video.id,
        'video.reason': reason,
        'video.position_ms': controller.value.position.inMilliseconds,
      },
    );
    _videoController = null;
    controller.dispose();
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
    setState(() => _currentIndex = index);
    _prepareVideo(index, reason: 'page_switch');
  }

  Future<void> _togglePlay() async {
    final controller = _videoController;
    if (controller == null || !controller.value.isInitialized) return;
    final video = _videos[_currentIndex];
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }
    if (!mounted) return;
    setState(() {});
    FlutterMonitorSDK.track(
      action: controller.value.isPlaying ? 'video.play' : 'video.pause',
      result: MonitorTrackResult.success,
      target: 'video_player',
      properties: <String, Object?>{
        'video.id': video.id,
        'video.position_ms': controller.value.position.inMilliseconds,
      },
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
        return AnimatedPadding(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
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
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _videoController;
    final isReady = controller != null && controller.value.isInitialized;
    final isPlaying = isReady && controller.value.isPlaying;
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
                    controller: index == _currentIndex ? controller : null,
                    initializing: index == _currentIndex && _initializing,
                    error: index == _currentIndex ? _playbackError : '',
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
                      onPressed: isReady ? _togglePlay : null,
                      icon: Icon(isPlaying ? Icons.pause : Icons.play_arrow),
                      label: Text(isPlaying ? '暂停' : '播放'),
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
  const _VideoItem({
    required this.id,
    required this.title,
    required this.duration,
    required this.url,
  });

  final String id;
  final String title;
  final String duration;
  final Uri url;
}

class _VideoCard extends StatelessWidget {
  const _VideoCard({
    required this.video,
    required this.active,
    required this.controller,
    required this.initializing,
    required this.error,
  });

  final _VideoItem video;
  final bool active;
  final VideoPlayerController? controller;
  final bool initializing;
  final String error;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final value = controller?.value;
    final isReady = value != null && value.isInitialized;
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
                child: _buildVideoSurface(context, isReady),
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
                  const SizedBox(height: 6),
                  Text(
                    video.url.toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoSurface(BuildContext context, bool isReady) {
    final colorScheme = Theme.of(context).colorScheme;
    if (initializing) {
      return const SizedBox.square(
        dimension: 36,
        child: CircularProgressIndicator(strokeWidth: 3),
      );
    }
    if (error.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          '视频加载失败',
          style: TextStyle(color: colorScheme.onInverseSurface),
        ),
      );
    }
    if (!isReady || controller == null) {
      return Icon(
        Icons.smart_display_outlined,
        size: 80,
        color: colorScheme.onInverseSurface,
      );
    }
    return AspectRatio(
      aspectRatio: controller!.value.aspectRatio,
      child: VideoPlayer(controller!),
    );
  }
}
