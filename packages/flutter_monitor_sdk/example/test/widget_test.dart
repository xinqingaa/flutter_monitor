import 'package:flutter_test/flutter_test.dart';

import 'package:example/main.dart';
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

    expect(find.text('Monitor SDK Demo'), findsOneWidget);
  });
}
