import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/router/app_navigation.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key, required this.dio});

  final Dio dio;

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  late final DemoApi _api;
  String _status = '正在启动监控 SDK';

  @override
  void initState() {
    super.initState();
    _api = DemoApi(
      dio: widget.dio,
      httpClient: FlutterMonitorSDK.createHttpClient(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _enterLogin();
    });
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _enterLogin() async {
    try {
      final bootstrap = await _api.fetchBootstrap();
      if (!mounted) return;
      setState(() {
        _status = '已加载 ${bootstrap.release} 配置';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _status = '启动配置暂不可用，继续进入登录';
      });
    }
    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (!mounted) return;
    AppNavigation.replaceToLogin(context);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return AppPage(
      routeName: AppRoutes.splash,
      moduleName: 'launch',
      moduleScene: 'splash',
      child: Scaffold(
        backgroundColor: colorScheme.surface,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.monitor_heart,
                      size: 64,
                      color: colorScheme.primary,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Flutter Monitor Shop',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _status,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 28),
                    const LinearProgressIndicator(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
