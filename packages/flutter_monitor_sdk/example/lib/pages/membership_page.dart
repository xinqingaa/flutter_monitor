import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class MembershipPage extends StatefulWidget {
  const MembershipPage({super.key, required this.api});

  final DemoApi api;

  @override
  State<MembershipPage> createState() => _MembershipPageState();
}

class _MembershipPageState extends State<MembershipPage> {
  MembershipInfo? _info;
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
      final info = await widget.api.membership();
      if (!mounted) return;
      setState(() {
        _info = info;
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

  Future<void> _order(String planId) async {
    setState(() => _busy = true);
    try {
      await widget.api.orderMembership(planId);
      if (!mounted) return;
      appTrack(
        context,
        action: 'membership.order',
        message: '开通成功',
        properties: {'result': 'success', 'plan_id': planId},
      );
      _load();
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'membership.order',
        result: MonitorTrackResult.failed,
        error: error.message,
        message: error.message,
        properties: {
          'result': 'failed',
          'biz_code': error.code,
          'plan_id': planId,
        },
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;
    return AppPage(
      routeName: AppRoutes.membership,
      moduleName: 'me',
      moduleScene: 'membership',
      child: Scaffold(
        appBar: AppBar(title: const Text('会员中心')),
        body: AsyncBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          child: info == null
              ? const SizedBox.shrink()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    PulseCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            info.tier == 'premium' ? '高级会员' : '免费用户',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (info.expiresAt != null) ...[
                            const SizedBox(height: 6),
                            Text('到期：${info.expiresAt}'),
                          ],
                          const SizedBox(height: 12),
                          ...info.benefits.map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Text('· $item'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    ...info.plans.map(
                      (plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: PulseCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      plan.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    Text('¥${plan.price} / ${plan.period}'),
                                  ],
                                ),
                              ),
                              FilledButton(
                                onPressed: _busy
                                    ? null
                                    : () => _order(plan.id),
                                child: const Text('开通'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
