import 'package:dio/dio.dart';
import 'package:example/pages/api_lab_page.dart';
import 'package:example/pages/app_shell.dart';
import 'package:example/pages/checkout_page.dart';
import 'package:example/pages/feed_detail_page.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/pages/performance_gallery_page.dart';
import 'package:example/pages/splash_page.dart';
import 'package:example/pages/video_page.dart';
import 'package:flutter/material.dart';

class AppRoutes {
  const AppRoutes._();

  static const splash = '/';
  static const app = '/app';
  static const feedDetail = '/feed_detail';
  static const apiLab = '/api_lab';
  static const checkout = '/checkout';
  static const performanceGallery = '/performance_gallery';
  static const login = '/login';
  static const video = '/video';
}

class AppRouter {
  const AppRouter._();

  static Map<String, WidgetBuilder> routes({required Dio dio}) {
    return <String, WidgetBuilder>{
      AppRoutes.splash: (_) => const SplashPage(),
      AppRoutes.app: (_) => AppShell(dio: dio),
      AppRoutes.feedDetail: (_) => const FeedDetailPage(),
      AppRoutes.apiLab: (_) => ApiLabPage(dio: dio),
      AppRoutes.checkout: (_) => const CheckoutPage(),
      AppRoutes.performanceGallery: (_) => const PerformanceGalleryPage(),
      AppRoutes.login: (_) => const LoginPage(),
      AppRoutes.video: (_) => const VideoPage(),
    };
  }
}
