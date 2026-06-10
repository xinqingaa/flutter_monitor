import 'package:example/data/demo_api.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/widgets/app_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key, required this.api});

  final DemoApi api;

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  var _premium = false;
  var _weakNetwork = false;

  void _togglePremium() {
    setState(() => _premium = !_premium);
    FlutterMonitorSDK.setContext(
      userId: _premium ? 'qa_premium_001' : 'qa_free_001',
      userType: _premium ? 'premium' : 'free',
      userTags: _premium ? const ['vip', 'qa'] : const ['qa'],
      cohort: _premium ? 'example_premium' : 'example_free',
    );
    FlutterMonitorSDK.track(
      action: 'profile.membership.toggle',
      result: MonitorTrackResult.success,
      target: 'membership_switch',
      properties: <String, Object?>{'membership.premium': _premium},
    );
  }

  void _toggleNetwork() {
    setState(() => _weakNetwork = !_weakNetwork);
    FlutterMonitorSDK.setContext(
      networkType: _weakNetwork ? 'cellular' : 'wifi',
      isWeakNetwork: _weakNetwork,
    );
    FlutterMonitorSDK.track(
      action: 'profile.network.toggle',
      result: MonitorTrackResult.success,
      target: 'network_switch',
      properties: <String, Object?>{'network.weak': _weakNetwork},
    );
  }

  void _recordHandledError() {
    try {
      throw StateError('profile feedback submit failed');
    } catch (error, stackTrace) {
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'feedback_submit_failed',
        handled: true,
        properties: const <String, Object?>{'feedback.type': 'bug_report'},
      );
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('已记录一次业务侧捕获错误')));
    }
  }

  void _triggerLayoutError() {
    FlutterMonitorSDK.track(
      action: 'profile.debug.layout_overflow',
      result: MonitorTrackResult.started,
      target: 'layout_dialog',
    );
    showDialog<void>(
      context: context,
      builder: (context) => const AlertDialog(
        title: Text('订单备注'),
        content: Row(
          children: [
            Text('这是一段故意不换行的超长备注文本，用于验证 Flutter framework error 是否进入统一事件模型。'),
          ],
        ),
      ),
    );
  }

  void _logout() {
    setState(() => _premium = false);
    FlutterMonitorSDK.clearContext(scopes: {MonitorContextScope.user});
    FlutterMonitorSDK.track(
      action: 'profile.logout',
      result: MonitorTrackResult.success,
      target: 'logout_button',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppSection(
            title: '用户状态',
            subtitle: '切换后影响后续事件携带的 context.user 和 context.network。',
            children: [
              SwitchListTile(
                value: _premium,
                onChanged: (_) => _togglePremium(),
                title: const Text('会员用户'),
                subtitle: Text(_premium ? 'premium / vip' : 'free / qa'),
              ),
              SwitchListTile(
                value: _weakNetwork,
                onChanged: (_) => _toggleNetwork(),
                title: const Text('弱网状态'),
                subtitle: Text(_weakNetwork ? 'cellular weak' : 'wifi normal'),
              ),
            ],
          ),
          AppSection(
            title: '业务流程',
            children: [
              FilledButton.icon(
                onPressed: () => AppNavigation.openCheckout(context),
                icon: const Icon(Icons.shopping_bag_outlined),
                label: const Text('进入订单结算'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => AppNavigation.openPerformanceGallery(context),
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('打开内容创作中心'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => AppNavigation.openApiLab(context),
                icon: const Icon(Icons.sync_alt),
                label: const Text('打开数据同步中心'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => AppNavigation.openVideo(context),
                icon: const Icon(Icons.smart_display_outlined),
                label: const Text('打开视频频道'),
              ),
            ],
          ),
          AppSection(
            title: '账号',
            children: [
              FilledButton.icon(
                onPressed: () => AppNavigation.openLogin(context),
                icon: const Icon(Icons.login),
                label: const Text('登录或注册'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _logout,
                icon: const Icon(Icons.logout),
                label: const Text('退出登录'),
              ),
            ],
          ),
          AppSection(
            title: '异常和反馈',
            children: [
              OutlinedButton.icon(
                onPressed: _recordHandledError,
                icon: const Icon(Icons.report_problem_outlined),
                label: const Text('提交反馈失败'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _triggerLayoutError,
                icon: const Icon(Icons.warning_amber_outlined),
                label: const Text('打开异常备注弹窗'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
