import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/theme/app_theme.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class CourseDetailPage extends StatefulWidget {
  const CourseDetailPage({
    super.key,
    required this.api,
    required this.courseId,
  });

  final DemoApi api;
  final String courseId;

  @override
  State<CourseDetailPage> createState() => _CourseDetailPageState();
}

class _CourseDetailPageState extends State<CourseDetailPage> {
  CourseDetail? _detail;
  Object? _error;
  var _loading = true;
  var _busy = false;

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
      final detail = await widget.api.courseDetail(widget.courseId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
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

  Future<void> _book() async {
    setState(() => _busy = true);
    try {
      final result = await widget.api.bookCourse(widget.courseId);
      if (!mounted) return;
      appTrack(
        context,
        action: 'course.book',
        message: '预约成功 ${result.bookingId}',
        properties: {
          'result': 'success',
          'course_id': result.courseId,
          'booking_id': result.bookingId,
        },
      );
      _load();
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'course.book',
        result: MonitorTrackResult.failed,
        error: error.message,
        message: error.message,
        properties: {'result': 'failed', 'biz_code': error.code},
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return AppPage(
      routeName: AppRoutes.courseDetail,
      moduleName: 'discover',
      moduleScene: 'course_detail',
      child: Scaffold(
        appBar: AppBar(title: Text(detail?.title ?? '课程详情')),
        body: AsyncBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          child: detail == null
              ? const SizedBox.shrink()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    PulseCard(
                      color: AppTheme.tone(
                        detail.coverTone,
                      ).withValues(alpha: 0.1),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ToneBadge(
                            label: detail.category,
                            tone: detail.coverTone,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            detail.title,
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(detail.summary),
                          const SizedBox(height: 12),
                          Text(
                            '¥${detail.price} · ${detail.durationMin} 分钟 · 剩余 ${detail.seatsLeft}',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    PulseCard(
                      onTap: () =>
                          AppNavigation.openCoach(context, detail.coachId),
                      child: Row(
                        children: [
                          const CircleAvatar(child: Icon(Icons.person)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  detail.coachName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(detail.coachTitle),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
        bottomNavigationBar: detail == null
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _busy ? null : _book,
                    child: Text(
                      detail.seatsLeft > 0 ? '预约课程' : '已满员（可再试触发业务失败）',
                    ),
                  ),
                ),
                ),
              ),
      ),
    );
  }
}
