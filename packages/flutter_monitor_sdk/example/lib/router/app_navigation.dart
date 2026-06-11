import 'package:example/models/monitor_event_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:flutter/material.dart';

class AppNavigation {
  const AppNavigation._();

  static Future<void> replaceToLogin(BuildContext context) {
    return Navigator.of(context).pushReplacementNamed(AppRoutes.login);
  }

  static Future<void> replaceToApp(BuildContext context) {
    return Navigator.of(context).pushReplacementNamed(AppRoutes.app);
  }

  static Future<void> openEventDetail(
    BuildContext context,
    MonitorEventItem item,
  ) {
    return Navigator.of(
      context,
    ).pushNamed(AppRoutes.eventDetail, arguments: item);
  }

  static Future<void> openApiLab(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.apiLab);
  }

  static Future<void> openCheckout(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.checkout);
  }

  static Future<void> openPerformanceGallery(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.performanceGallery);
  }

  static Future<void> openLogin(BuildContext context) {
    return Navigator.of(context).pushReplacementNamed(AppRoutes.login);
  }

  static Future<void> openVideo(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.video);
  }
}
