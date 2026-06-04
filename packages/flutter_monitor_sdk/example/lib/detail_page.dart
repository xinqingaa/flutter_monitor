import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  var _pageDepth = 1;

  @override
  void initState() {
    super.initState();
    // 在页面第一帧渲染后，上报页面加载完成事件
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pageName = ModalRoute.of(context)?.settings.name;
      FlutterMonitorSDK.onPageRendered(pageName);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map) {
      final depth = arguments['depth'];
      if (depth is int && depth > 0) {
        _pageDepth = depth;
      }
    }
    FlutterMonitorSDK.setModule(name: 'example', scene: 'detail');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Detail Page #$_pageDepth')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Current route name is still /detail. This page uses arguments only to show instance depth: $_pageDepth.',
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(
                context,
                '/detail',
                arguments: <String, Object?>{'depth': _pageDepth + 1},
              );
            },
            child: const Text('Push another /detail'),
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
