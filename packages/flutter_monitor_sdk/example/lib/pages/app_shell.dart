import 'package:dio/dio.dart';
import 'package:example/data/workbench_api.dart';
import 'package:example/pages/home_tab.dart';
import 'package:example/pages/profile_tab.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

enum _TabSwitchSource { tap, swipe }

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.dio});

  final Dio dio;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late final WorkbenchApi _workbenchApi;
  late final PageController _pageController;
  var _currentIndex = 0;
  var _animatingToIndex = -1;

  @override
  void initState() {
    super.initState();
    _workbenchApi = WorkbenchApi(dio: widget.dio);
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _selectTab(int index, {required _TabSwitchSource source}) {
    if (_currentIndex == index && _animatingToIndex != index) return;

    if (source == _TabSwitchSource.tap) {
      _animatingToIndex = index;
      _pageController
          .animateToPage(
            index,
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
          )
          .whenComplete(() {
            if (mounted) _animatingToIndex = -1;
          });
      if (_currentIndex != index) {
        setState(() => _currentIndex = index);
        _updateModuleContext(index);
      }
      return;
    }

    if (_currentIndex != index) {
      setState(() => _currentIndex = index);
      _updateModuleContext(index);
    }
  }

  void _updateModuleContext(int index) {
    FlutterMonitorSDK.setContext(
      moduleName: index == 0 ? 'home' : 'profile',
      moduleScene: index == 0 ? 'feed' : 'dashboard',
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
          physics: const BouncingScrollPhysics(),
          onPageChanged: (index) => _selectTab(index, source: _TabSwitchSource.swipe),
          children: [
            HomeTab(api: _workbenchApi),
            const ProfileTab(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) =>
              _selectTab(index, source: _TabSwitchSource.tap),
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
