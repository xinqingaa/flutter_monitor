import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/pages/home_tab.dart';
import 'package:example/pages/profile_tab.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.dio});

  final Dio dio;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late final DemoApi _api;
  late final PageController _pageController;
  var _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _api = DemoApi(
      dio: widget.dio,
      httpClient: FlutterMonitorSDK.createHttpClient(),
    );
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _api.close();
    super.dispose();
  }

  void _switchTab(int index) {
    if (_currentIndex == index) return;
    _measureTabSwitch(index);
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  void _handlePageChanged(int index) {
    if (_currentIndex == index) return;
    _measureTabSwitch(index);
    setState(() => _currentIndex = index);
  }

  void _measureTabSwitch(int index) {
    FlutterMonitorSDK.measure(
      action: 'app.tab.switch',
      target: index == 0 ? 'home_tab' : 'profile_tab',
      properties: <String, Object?>{
        'tab.from': _currentIndex == 0 ? 'home' : 'profile',
        'tab.to': index == 0 ? 'home' : 'profile',
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.app,
      moduleName: _currentIndex == 0 ? 'home' : 'profile',
      moduleScene: _currentIndex == 0 ? 'feed' : 'dashboard',
      child: Scaffold(
        body: PageView(
          controller: _pageController,
          onPageChanged: _handlePageChanged,
          children: [
            HomeTab(api: _api),
            ProfileTab(api: _api),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _switchTab,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), label: '首页'),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              label: '我的',
            ),
          ],
        ),
      ),
    );
  }
}
