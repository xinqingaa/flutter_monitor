import 'package:example/data/demo_api.dart';
import 'package:example/pages/app_shell.dart';
import 'package:example/pages/coach_page.dart';
import 'package:example/pages/course_detail_page.dart';
import 'package:example/pages/lab_page.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/pages/membership_page.dart';
import 'package:example/pages/notices_page.dart';
import 'package:example/pages/settings_page.dart';
import 'package:example/pages/splash_page.dart';
import 'package:example/pages/vitals_page.dart';
import 'package:example/pages/workout_detail_page.dart';
import 'package:example/pages/workout_session_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class AppRoutes {
  const AppRoutes._();

  static const splash = '/';
  static const login = '/login';
  static const app = '/app';
  static const workoutDetail = '/workout_detail';
  static const workoutSession = '/workout_session';
  static const courseDetail = '/course_detail';
  static const coach = '/coach';
  static const membership = '/membership';
  static const vitals = '/vitals';
  static const notices = '/notices';
  static const settings = '/settings';
  static const lab = '/lab';
}

class AppRouter {
  const AppRouter._();

  static Map<String, WidgetBuilder> routes({required DemoApi api}) {
    return <String, WidgetBuilder>{
      for (final route in routeDefinitions(api: api)) route.name: route.build,
    };
  }

  static List<AppRoute> routeDefinitions({required DemoApi api}) {
    return <AppRoute>[
      AppRoute(
        name: AppRoutes.splash,
        moduleName: 'launch',
        moduleScene: 'splash',
        builder: (_) => SplashPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.login,
        moduleName: 'auth',
        moduleScene: 'login',
        builder: (_) => LoginPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.app,
        moduleName: 'home',
        moduleScene: 'tabs',
        builder: (_) => AppShell(api: api),
      ),
      AppRoute(
        name: AppRoutes.workoutDetail,
        moduleName: 'train',
        moduleScene: 'workout_detail',
        builder: (context) {
          final id = ModalRoute.of(context)?.settings.arguments as String? ?? '';
          return WorkoutDetailPage(api: api, workoutId: id);
        },
      ),
      AppRoute(
        name: AppRoutes.workoutSession,
        moduleName: 'train',
        moduleScene: 'workout_session',
        builder: (context) {
          final args =
              ModalRoute.of(context)?.settings.arguments as WorkoutSessionArgs?;
          return WorkoutSessionPage(api: api, args: args);
        },
      ),
      AppRoute(
        name: AppRoutes.courseDetail,
        moduleName: 'discover',
        moduleScene: 'course_detail',
        builder: (context) {
          final id = ModalRoute.of(context)?.settings.arguments as String? ?? '';
          return CourseDetailPage(api: api, courseId: id);
        },
      ),
      AppRoute(
        name: AppRoutes.coach,
        moduleName: 'discover',
        moduleScene: 'coach',
        builder: (context) {
          final id = ModalRoute.of(context)?.settings.arguments as String? ?? '';
          return CoachPage(api: api, coachId: id);
        },
      ),
      AppRoute(
        name: AppRoutes.membership,
        moduleName: 'me',
        moduleScene: 'membership',
        builder: (_) => MembershipPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.vitals,
        moduleName: 'me',
        moduleScene: 'vitals',
        builder: (_) => VitalsPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.notices,
        moduleName: 'me',
        moduleScene: 'notices',
        builder: (_) => NoticesPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.settings,
        moduleName: 'me',
        moduleScene: 'settings',
        builder: (_) => SettingsPage(api: api),
      ),
      AppRoute(
        name: AppRoutes.lab,
        moduleName: 'debug',
        moduleScene: 'lab',
        builder: (_) => LabPage(api: api),
      ),
    ];
  }
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
