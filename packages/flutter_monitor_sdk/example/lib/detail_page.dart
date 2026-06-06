import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  Object? _detailId = 1;

  @override
  void initState() {
    super.initState();
    // 在页面第一帧渲染后，上报页面加载完成事件
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pageName = ModalRoute.of(context)?.settings.name;
      if (pageName != null) {
        FlutterMonitorSDK.markPageRendered(pageName);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map) {
      _detailId = arguments['id'] ?? _detailId;
    }
    FlutterMonitorSDK.setContext(moduleName: 'example', moduleScene: 'detail');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Detail Page #$_detailId')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Current route name is /detail. The business route is /detail?id=$_detailId.',
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => Navigator.pushNamed(context, '/complex_list'),
            child: const Text('Push /complex_list'),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => Navigator.maybePop(context),
            child: const Text('Pop current page'),
          ),
        ],
      ),
    );
  }
}
