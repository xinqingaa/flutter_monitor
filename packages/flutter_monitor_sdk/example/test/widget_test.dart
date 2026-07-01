import 'package:example/main.dart';
import 'package:example/models/monitor_event_models.dart';
import 'package:example/pages/checkout_page.dart';
import 'package:example/pages/event_detail_page.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/pages/performance_gallery_page.dart';
import 'package:example/pages/video_page.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    AppSession.clearUser();
  });

  setUpAll(() async {
    await _initSdk();
  });

  testWidgets('renders splash and enters login after SDK init', (tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.text('Flutter Monitor Shop'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();

    expect(find.text('输入 QA 用户 ID 进入监控工作台'), findsOneWidget);
    expect(find.text('进入首页'), findsOneWidget);
  });

  test('app router keeps route module metadata beside builders', () {
    final routes = AppRouter.routeDefinitions(
      monitoredDio: monitoredDio,
      workbenchDio: workbenchDio,
    );
    final byName = <String, AppRoute>{
      for (final route in routes) route.name: route,
    };

    expect(byName[AppRoutes.splash]?.moduleName, 'launch');
    expect(byName[AppRoutes.splash]?.moduleScene, 'splash');
    expect(byName[AppRoutes.app]?.moduleName, 'home');
    expect(byName[AppRoutes.app]?.moduleScene, 'feed');
    expect(byName[AppRoutes.apiLab]?.moduleName, 'ops');
    expect(byName[AppRoutes.apiLab]?.moduleScene, 'api_lab');
    expect(byName[AppRoutes.checkout]?.moduleName, 'commerce');
    expect(byName[AppRoutes.checkout]?.moduleScene, 'checkout');
    expect(byName[AppRoutes.performanceGallery]?.moduleName, 'content');
    expect(
      byName[AppRoutes.performanceGallery]?.moduleScene,
      'performance_gallery',
    );
    expect(byName[AppRoutes.video]?.moduleName, 'content');
    expect(byName[AppRoutes.video]?.moduleScene, 'video');
    expect(byName[AppRoutes.login]?.moduleName, 'auth');
    expect(byName[AppRoutes.login]?.moduleScene, 'login');
    expect(byName[AppRoutes.eventDetail]?.moduleName, 'content');
    expect(byName[AppRoutes.eventDetail]?.moduleScene, 'event_detail');
  });

  testWidgets('event detail renders envelope fields and json toggle', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        initialRoute: AppRoutes.eventDetail,
        onGenerateRoute: _eventDetailRoute,
      ),
    );
    await tester.pump();

    expect(find.text('事件详情'), findsOneWidget);
    expect(find.text('app.cold_start'), findsOneWidget);
    expect(find.text('Raw Envelope JSON'), findsOneWidget);

    await tester.tap(find.text('Raw Envelope JSON'));
    await tester.pumpAndSettle();
    expect(find.textContaining('"eventId"'), findsOneWidget);
  });

  testWidgets('checkout page renders submit flow', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: CheckoutPage(dio: monitoredDio, loadCartOnStart: false),
      ),
    );
    await tester.pump();

    expect(find.text('订单结算'), findsOneWidget);
    expect(find.text('提交订单'), findsOneWidget);
    expect(find.text('DEMO_EXPIRED'), findsOneWidget);
  });

  testWidgets('performance gallery renders monitoring scenarios', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: PerformanceGalleryPage()));
    await tester.pump();

    expect(find.text('内容创作中心'), findsOneWidget);
    expect(find.text('刷新报表'), findsOneWidget);
    expect(find.text('刷新图片墙'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('生成离线报表'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('生成离线报表'), findsOneWidget);
  });

  testWidgets('login page accepts userId and enters home', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          AppRoutes.login: (_) => LoginPage(
            dio: monitoredDio,
            loadAuthOptionsOnStart: false,
            remoteLogin: false,
          ),
          AppRoutes.app: (_) =>
              Scaffold(appBar: AppBar(title: const Text('监控事件'))),
        },
        initialRoute: AppRoutes.login,
      ),
    );
    await tester.pump();

    expect(find.text('进入首页'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '42');
    await tester.tap(find.text('进入首页'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('监控事件'), findsOneWidget);
    expect(AppSession.userId, '42');
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('video page supports page view and comment sheet', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: VideoPage()));
    await tester.pump();

    expect(find.text('视频频道'), findsOneWidget);
    expect(find.text('Flutter Bee Sample'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pump(const Duration(milliseconds: 320));
    expect(find.text('重复初始化压力'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1300));

    await tester.tap(find.text('评论'));
    await tester.pump(const Duration(milliseconds: 320));
    expect(find.text('评论内容'), findsOneWidget);
    expect(find.text('提交评论'), findsOneWidget);
  });
}

Future<void> _initSdk() async {
  final monitorConfig = MonitorConfig(
    appInfo: const AppInfo(appKey: 'TEST_APP_KEY'),
    mode: MonitorMode.consoleOnly(logMode: LogMonitorOutputMode.silent),
  );

  await FlutterMonitorSDK.init(
    config: monitorConfig,
    appStartTime: DateTime.now(),
  );
}

Route<void> _eventDetailRoute(RouteSettings settings) {
  if (settings.name == AppRoutes.checkout) {
    return MaterialPageRoute<void>(
      builder: (_) => CheckoutPage(dio: monitoredDio, loadCartOnStart: false),
    );
  }
  if (settings.name == AppRoutes.performanceGallery) {
    return MaterialPageRoute<void>(
      builder: (_) => const PerformanceGalleryPage(),
    );
  }
  return MaterialPageRoute<void>(
    settings: RouteSettings(
      name: AppRoutes.eventDetail,
      arguments: MonitorEventItem(
        eventId: 'evt_test_001',
        raw: const <String, dynamic>{
          'eventId': 'evt_test_001',
          'name': 'app.cold_start',
          'signalType': 'trace',
          'status': 'ok',
        },
        name: 'app.cold_start',
        signalType: 'trace',
        status: 'ok',
      ),
    ),
    builder: (_) => const EventDetailPage(),
  );
}
