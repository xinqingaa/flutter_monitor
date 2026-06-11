import 'package:example/main.dart';
import 'package:example/models/demo_models.dart';
import 'package:example/pages/checkout_page.dart';
import 'package:example/pages/feed_detail_page.dart';
import 'package:example/pages/login_page.dart';
import 'package:example/pages/performance_gallery_page.dart';
import 'package:example/pages/video_page.dart';
import 'package:example/router/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    await _initSdk();
  });

  testWidgets('renders splash and enters swipeable tab app after SDK init', (
    tester,
  ) async {
    await tester.pumpWidget(const MyApp());
    expect(find.text('Flutter Monitor Shop'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();

    expect(find.text('首页'), findsWidgets);
    expect(find.text('我的'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    expect(find.text('用户状态'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1300));
  });

  test('app router keeps route module metadata beside builders', () {
    final routes = AppRouter.routeDefinitions(dio: dio);
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
    expect(byName[AppRoutes.feedDetail]?.moduleName, 'content');
    expect(byName[AppRoutes.feedDetail]?.moduleScene, 'detail');
  });

  testWidgets('feed detail renders business actions and share sheet', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        initialRoute: AppRoutes.feedDetail,
        onGenerateRoute: _feedDetailRoute,
      ),
    );
    await tester.pump();

    expect(find.text('内容详情'), findsOneWidget);
    expect(find.text('收藏'), findsOneWidget);
    expect(find.text('分享'), findsOneWidget);
    expect(find.text('基于内容创建订单'), findsOneWidget);

    await tester.tap(find.text('分享'));
    await tester.pumpAndSettle();
    expect(find.text('分享备注'), findsOneWidget);
    expect(find.text('复制链接'), findsOneWidget);
  });

  testWidgets('checkout page renders submit flow', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: CheckoutPage()));
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

  testWidgets('login page writes auth context through form flow', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: LoginPage()));
    await tester.pump();

    expect(find.text('登录注册'), findsOneWidget);
    await tester.enterText(find.byType(TextField).last, '1234');
    await tester.tap(find.text('提交'));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('登录成功，用户上下文已写入'), findsOneWidget);
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

Route<void> _feedDetailRoute(RouteSettings settings) {
  if (settings.name == AppRoutes.checkout) {
    return MaterialPageRoute<void>(builder: (_) => const CheckoutPage());
  }
  if (settings.name == AppRoutes.performanceGallery) {
    return MaterialPageRoute<void>(
      builder: (_) => const PerformanceGalleryPage(),
    );
  }
  return MaterialPageRoute<void>(
    settings: RouteSettings(
      name: AppRoutes.feedDetail,
      arguments: const DemoFeedItem(
        id: 'repo_1',
        title: 'flutter',
        subtitle: 'flutter/flutter',
        description: 'Flutter makes it easy and fast to build beautiful apps.',
        source: 'GitHub',
        metricLabel: 'Stars',
        metricValue: '1',
      ),
    ),
    builder: (_) => const FeedDetailPage(),
  );
}
