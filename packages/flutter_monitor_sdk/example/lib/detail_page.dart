import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Page'),
      ),
      body: const Center(
        child: Text('This is the detail page.'),
      ),
    );
  }
}
