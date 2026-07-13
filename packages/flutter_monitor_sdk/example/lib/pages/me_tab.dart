import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class MeTab extends StatefulWidget {
  const MeTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<MeTab> createState() => _MeTabState();
}

class _MeTabState extends State<MeTab> with AutomaticKeepAliveClientMixin {
  MeProfile? _profile;
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
      final profile = await widget.api.me();
      if (!mounted) return;
      setState(() {
        _profile = profile;
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
    final profile = _profile;
    return RefreshIndicator(
      onRefresh: _load,
      child: AsyncBody(
        loading: _loading && profile == null,
        error: _error,
        onRetry: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            PulseHeader(
              title: profile?.name ?? AppSession.displayName ?? '我的',
              subtitle: profile == null
                  ? null
                  : '${profile.city} · ${profile.tier == 'premium' ? '高级会员' : '免费用户'}',
            ),
            if (profile != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    MetricTile(
                      label: '步数目标',
                      value: '${profile.stepsGoal}',
                    ),
                    const SizedBox(width: 10),
                    MetricTile(
                      label: '每周训练',
                      value: '${profile.workoutsPerWeek}',
                      unit: '次',
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            _tile(
              context,
              Icons.workspace_premium_outlined,
              '会员中心',
              () => AppNavigation.openMembership(context),
            ),
            _tile(
              context,
              Icons.monitor_heart_outlined,
              '体征与睡眠',
              () => AppNavigation.openVitals(context),
            ),
            _tile(
              context,
              Icons.notifications_outlined,
              '消息通知',
              () => AppNavigation.openNotices(context),
            ),
            _tile(
              context,
              Icons.settings_outlined,
              '设置',
              () => AppNavigation.openSettings(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(
    BuildContext context,
    IconData icon,
    String title,
    VoidCallback onTap,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: PulseCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
