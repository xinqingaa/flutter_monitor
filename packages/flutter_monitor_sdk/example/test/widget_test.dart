import 'package:flutter_test/flutter_test.dart';

import 'package:example/detail_page.dart';
import 'package:example/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

void main() {
  testWidgets('renders the monitor demo app after SDK init', (tester) async {
    final appStartTime = DateTime.now();
    final monitorConfig = MonitorConfig(
      appInfo: const AppInfo(appKey: 'TEST_APP_KEY'),
      outputs: [LogMonitorOutput()],
    );

    await FlutterMonitorSDK.init(
      config: monitorConfig,
      appStartTime: appStartTime,
    );

    await tester.pumpWidget(const MyApp());
    await tester.pump();

    expect(find.text('Flutter Monitor Example'), findsOneWidget);
  });

  testWidgets('detail id 1 renders track business actions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(initialRoute: '/detail', onGenerateRoute: _detailIdOneRoute),
    );
    await tester.pump();

    expect(find.text('业务埋点 track 示例'), findsOneWidget);
    expect(find.text('加入购物车'), findsOneWidget);
    expect(find.text('使用过期优惠券'), findsOneWidget);
  });

  testWidgets('detail id 2 renders measure interactions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(initialRoute: '/detail', onGenerateRoute: _detailIdTwoRoute),
    );
    await tester.pump();

    expect(find.text('交互性能 measure 示例'), findsOneWidget);
    expect(find.text('概览'), findsOneWidget);
    expect(find.text('刷新图表'), findsOneWidget);
    expect(find.text('展开图表'), findsOneWidget);
  });
}

Route<void> _detailIdOneRoute(RouteSettings settings) {
  return MaterialPageRoute<void>(
    settings: const RouteSettings(
      name: '/detail',
      arguments: <String, Object?>{'id': 1},
    ),
    builder: (_) => const DetailPage(),
  );
}

Route<void> _detailIdTwoRoute(RouteSettings settings) {
  return MaterialPageRoute<void>(
    settings: const RouteSettings(
      name: '/detail',
      arguments: <String, Object?>{'id': 2},
    ),
    builder: (_) => const DetailPage(),
  );
}
