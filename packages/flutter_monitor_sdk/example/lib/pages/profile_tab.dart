import 'package:example/router/app_navigation.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_section.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab>
    with AutomaticKeepAliveClientMixin {
  var _premium = false;
  var _weakNetwork = false;

  @override
  bool get wantKeepAlive => true;

  void _togglePremium(bool value) {
    setState(() => _premium = value);
    FlutterMonitorSDK.setContext(
      userType: value ? 'premium' : 'qa',
      userTags: value ? const ['vip', 'qa'] : const ['qa'],
      cohort: value ? 'example_premium' : 'example_session',
    );
  }

  void _toggleNetwork(bool value) {
    setState(() => _weakNetwork = value);
    FlutterMonitorSDK.setContext(
      networkType: value ? 'cellular' : 'wifi',
      isWeakNetwork: value,
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

  void _switchAccount() {
    AppNavigation.openLogin(context);
  }

  void _logout() {
    setState(() {
      _premium = false;
      _weakNetwork = false;
    });
    AppSession.clearUser();
    FlutterMonitorSDK.clearContext(scopes: {MonitorContextScope.user});
    appTrack(
      context,
      action: 'profile.logout',
      target: 'logout_button',
      message: '已退出登录',
    );
    AppNavigation.openLogin(context);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final userId = AppSession.userId ?? '未登录';
    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text('userId: $userId'),
              subtitle: Text(_premium ? 'premium · qa' : 'qa · free tier'),
            ),
          ),
          const SizedBox(height: 8),
          AppSection(
            title: '上下文模拟',
            subtitle: '仅 setContext，不产生额外 track。',
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _premium,
                onChanged: _togglePremium,
                title: const Text('会员用户'),
                subtitle: Text(_premium ? 'premium / vip' : 'qa / free'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _weakNetwork,
                onChanged: _toggleNetwork,
                title: const Text('弱网状态'),
                subtitle: Text(_weakNetwork ? 'cellular weak' : 'wifi normal'),
              ),
            ],
          ),
          AppSection(
            title: '监控场景',
            children: [
              _ScenarioTile(
                icon: Icons.shopping_bag_outlined,
                label: '订单结算',
                onTap: () => AppNavigation.openCheckout(context),
              ),
              _ScenarioTile(
                icon: Icons.query_stats,
                label: '内容创作中心',
                onTap: () => AppNavigation.openPerformanceGallery(context),
              ),
              _ScenarioTile(
                icon: Icons.sync_alt,
                label: '数据同步中心',
                onTap: () => AppNavigation.openApiLab(context),
              ),
              _ScenarioTile(
                icon: Icons.smart_display_outlined,
                label: '视频频道',
                onTap: () => AppNavigation.openVideo(context),
              ),
            ],
          ),
          AppSection(
            title: '账号',
            children: [
              FilledButton.icon(
                onPressed: _switchAccount,
                icon: const Icon(Icons.switch_account),
                label: const Text('切换账号'),
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
            title: '异常演示',
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

class _ScenarioTile extends StatelessWidget {
  const _ScenarioTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
