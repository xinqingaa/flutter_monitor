import 'package:example/router/app_routes.dart';
import 'package:flutter/material.dart';

class AppNavigation {
  const AppNavigation._();

  static Future<void> openWorkout(BuildContext context, String id) {
    return Navigator.of(
      context,
    ).pushNamed(AppRoutes.workoutDetail, arguments: id);
  }

  static Future<void> openCourse(BuildContext context, String id) {
    return Navigator.of(
      context,
    ).pushNamed(AppRoutes.courseDetail, arguments: id);
  }

  static Future<void> openCoach(BuildContext context, String id) {
    return Navigator.of(context).pushNamed(AppRoutes.coach, arguments: id);
  }

  static Future<void> openMembership(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.membership);
  }

  static Future<void> openVitals(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.vitals);
  }

  static Future<void> openNotices(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.notices);
  }

  static Future<void> openSettings(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.settings);
  }

  static Future<void> openLab(BuildContext context) {
    return Navigator.of(context).pushNamed(AppRoutes.lab);
  }
}
