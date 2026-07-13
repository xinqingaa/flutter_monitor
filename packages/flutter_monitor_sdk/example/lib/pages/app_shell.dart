import 'package:example/data/demo_api.dart';
import 'package:example/pages/discover_tab.dart';
import 'package:example/pages/home_tab.dart';
import 'package:example/pages/me_tab.dart';
import 'package:example/pages/train_tab.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.api});

  final DemoApi api;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  var _index = 0;

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.app,
      moduleName: 'home',
      moduleScene: 'tabs',
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: [
            HomeTab(api: widget.api),
            TrainTab(api: widget.api),
            DiscoverTab(api: widget.api),
            MeTab(api: widget.api),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (value) => setState(() => _index = value),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: '首页',
            ),
            NavigationDestination(
              icon: Icon(Icons.fitness_center_outlined),
              selectedIcon: Icon(Icons.fitness_center),
              label: '训练',
            ),
            NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: '发现',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: '我的',
            ),
          ],
        ),
      ),
    );
  }
}
