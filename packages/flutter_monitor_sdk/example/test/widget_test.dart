import 'package:example/main.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(AppSession.clear);

  setUpAll(() async {
    await FlutterMonitorSDK.init(
      config: MonitorConfig(
        appInfo: const AppInfo(appKey: 'TEST_APP_KEY'),
        mode: MonitorMode.consoleOnly(logMode: LogMonitorOutputMode.silent),
      ),
      appStartTime: DateTime.now(),
    );
  });

  test('router keeps module metadata for main flows', () {
    final routes = AppRouter.routeDefinitions(api: demoApi);
    final byName = {for (final route in routes) route.name: route};
    expect(byName[AppRoutes.splash]?.moduleName, 'launch');
    expect(byName[AppRoutes.login]?.moduleName, 'auth');
    expect(byName[AppRoutes.app]?.moduleName, 'home');
    expect(byName[AppRoutes.workoutDetail]?.moduleName, 'train');
    expect(byName[AppRoutes.courseDetail]?.moduleName, 'discover');
    expect(byName[AppRoutes.membership]?.moduleName, 'me');
  });

  testWidgets('login page accepts local userId without remote', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          AppRoutes.login: (_) => LoginPage(
            api: demoApi,
            loadAuthOptionsOnStart: false,
            remoteLogin: false,
          ),
          AppRoutes.app: (_) =>
              const Scaffold(body: Center(child: Text('首页'))),
        },
        initialRoute: AppRoutes.login,
      ),
    );
    await tester.pump();
    expect(find.text('进入 App'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '42');
    await tester.tap(find.text('进入 App'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('首页'), findsOneWidget);
    expect(AppSession.userId, '42');
    await tester.pump(const Duration(seconds: 2));
  });
}
