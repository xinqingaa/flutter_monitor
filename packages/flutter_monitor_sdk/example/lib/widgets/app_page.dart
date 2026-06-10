import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class AppPage extends StatelessWidget {
  const AppPage({
    super.key,
    required this.routeName,
    this.moduleName,
    this.moduleScene,
    required this.child,
  });

  final String routeName;
  final String? moduleName;
  final String? moduleScene;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MonitorPageScope(
      routeName: routeName,
      moduleName: moduleName,
      moduleScene: moduleScene,
      child: child,
    );
  }
}
