import 'package:dio/dio.dart';
import 'package:example/pages/api_lab_page.dart';
import 'package:example/pages/app_shell.dart';
import 'package:example/pages/checkout_page.dart';
import 'package:example/pages/event_detail_page.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/pages/performance_gallery_page.dart';
import 'package:example/pages/splash_page.dart';
import 'package:example/pages/video_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class AppRoutes {
  const AppRoutes._();

  static const splash = '/';
  static const app = '/app';
  static const eventDetail = '/event_detail';
  static const apiLab = '/api_lab';
  static const checkout = '/checkout';
  static const performanceGallery = '/performance_gallery';
  static const login = '/login';
  static const video = '/video';

  @Deprecated('Use eventDetail')
  static const feedDetail = eventDetail;
}

class AppRouter {
  const AppRouter._();

  static Map<String, WidgetBuilder> routes({
    required Dio monitoredDio,
    required Dio workbenchDio,
  }) {
    return <String, WidgetBuilder>{
      for (final route in routeDefinitions(
        monitoredDio: monitoredDio,
        workbenchDio: workbenchDio,
      ))
        route.name: route.build,
    };
  }

  static List<AppRoute> routeDefinitions({
    required Dio monitoredDio,
    required Dio workbenchDio,
  }) {
    return <AppRoute>[
      AppRoute(
        name: AppRoutes.splash,
        moduleName: 'launch',
        moduleScene: 'splash',
        builder: (_) => SplashPage(dio: monitoredDio),
      ),
      AppRoute(
        name: AppRoutes.app,
        moduleName: 'home',
        moduleScene: 'feed',
        builder: (_) =>
            AppShell(monitoredDio: monitoredDio, workbenchDio: workbenchDio),
      ),
      AppRoute(
        name: AppRoutes.eventDetail,
        moduleName: 'content',
        moduleScene: 'event_detail',
        builder: _buildEventDetail,
      ),
      AppRoute(
        name: AppRoutes.apiLab,
        moduleName: 'ops',
        moduleScene: 'api_lab',
        builder: (_) => ApiLabPage(dio: monitoredDio),
      ),
      AppRoute(
        name: AppRoutes.checkout,
        moduleName: 'commerce',
        moduleScene: 'checkout',
        builder: (_) => CheckoutPage(dio: monitoredDio),
      ),
      AppRoute(
        name: AppRoutes.performanceGallery,
        moduleName: 'content',
        moduleScene: 'performance_gallery',
        builder: _buildPerformanceGallery,
      ),
      AppRoute(
        name: AppRoutes.login,
        moduleName: 'auth',
        moduleScene: 'login',
        builder: (_) => LoginPage(dio: monitoredDio),
      ),
      const AppRoute(
        name: AppRoutes.video,
        moduleName: 'content',
        moduleScene: 'video',
        builder: _buildVideo,
      ),
    ];
  }

  static Widget _buildEventDetail(BuildContext context) =>
      const EventDetailPage();

  static Widget _buildPerformanceGallery(BuildContext context) =>
      const PerformanceGalleryPage();

  static Widget _buildVideo(BuildContext context) => const VideoPage();
}

class AppRoute {
  const AppRoute({
    required this.name,
    required this.builder,
    this.moduleName,
    this.moduleScene,
  });

  final String name;
  final String? moduleName;
  final String? moduleScene;
  final WidgetBuilder builder;

  Widget build(BuildContext context) {
    if (moduleName != null || moduleScene != null) {
      FlutterMonitorSDK.setContext(
        moduleName: moduleName,
        moduleScene: moduleScene,
      );
    }
    return builder(context);
  }
}
