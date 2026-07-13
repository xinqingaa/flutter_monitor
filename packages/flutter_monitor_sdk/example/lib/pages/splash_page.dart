import 'package:example/data/demo_api.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key, required this.api});

  final DemoApi api;

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    try {
      final info = await widget.api.bootstrap();
      FlutterMonitorSDK.setContext(
        releaseId: info.release,
        featureFlags: info.featureFlags,
      );
    } catch (_) {
      // bootstrap 失败仍进入登录，避免卡死启动。
    }
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    final next = AppSession.isLoggedIn ? AppRoutes.app : AppRoutes.login;
    Navigator.of(context).pushReplacementNamed(next);
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.splash,
      moduleName: 'launch',
      moduleScene: 'splash',
      child: Scaffold(
        body: Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0F766E), Color(0xFF134E4A)],
            ),
          ),
          child: const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.favorite, color: Colors.white, size: 64),
              SizedBox(height: 16),
              Text(
                'PulseFit',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 8),
              Text(
                '训练 · 课程 · 健康',
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              SizedBox(height: 40),
              CircularProgressIndicator(color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
