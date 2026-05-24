import 'dart:math';
import 'package:flutter/material.dart';

// 模拟的数据模型
class ListItemData {
  final int type; // 0: 纯文本, 1: 图文, 2: 视频模拟
  final String text;
  ListItemData(this.type, this.text);
}

class ComplexListPage extends StatefulWidget {
  const ComplexListPage({super.key});

  @override
  State<ComplexListPage> createState() => _ComplexListPageState();
}

class _ComplexListPageState extends State<ComplexListPage> {
  final List<ListItemData> _items = [];

  @override
  void initState() {
    super.initState();
    // 生成100条随机类型的复杂数据
    final random = Random();
    for (int i = 0; i < 100; i++) {
      _items.add(ListItemData(
        random.nextInt(3),
        '这是第 $i 项，这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的描述文本，用于增加布局计算的复杂度。',
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('复杂列表卡顿测试'),
      ),
      body: ListView.builder(
        itemCount: _items.length,
        itemBuilder: (context, index) {
          // 在这里，我们故意让每个 item 的构建过程变得复杂和耗时
          return ComplexListItem(data: _items[index]);
        },
      ),
    );
  }
}

// ---------------------------------------------------
// 这是关键：一个故意写得性能不佳的列表项 Widget
// ---------------------------------------------------
class ComplexListItem extends StatelessWidget {
  final ListItemData data;

  const ComplexListItem({super.key, required this.data});

  /// 模拟一个耗时的计算，比如解析数据、准备ViewModel等
  void _performExpensiveComputation() {
    // 故意用一个循环来消耗CPU时间，模拟真实的计算开销
    final startTime = DateTime.now();
    while (DateTime.now().difference(startTime).inMilliseconds < 5) {
      // do nothing
    }
  }

  @override
  Widget build(BuildContext context) {
    // 在 build 方法的开头就执行耗时操作
    _performExpensiveComputation();

    // 根据不同的类型，构建不同的、复杂的布局
    switch (data.type) {
      case 1: // 图文
        return _buildTextImage();
      case 2: // 视频
        return _buildVideoImage();
      default: // 纯文本
        return _buildTextImage(isTextOnly: true);
    }
  }

  Widget _buildTextImage({bool isTextOnly = false}) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 嵌套很深的 Row
            const Row(
              children: [
                CircleAvatar(child: Icon(Icons.person)),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [Text('复杂用户名'), Text('一些附加信息')],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (!isTextOnly)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: Colors.grey.shade300,
                  alignment: Alignment.center,
                  child: const Icon(Icons.image, size: 50, color: Colors.grey),
                ),
              ),
            const SizedBox(height: 10),
            // 大段文本会导致布局计算变慢
            Text(data.text),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoImage() {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 4,
      child: Column(
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              color: Colors.black,
              alignment: Alignment.center,
              child: Icon(Icons.play_circle_fill, size: 60, color: Colors.white.withValues(alpha: 0.7)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Text(data.text),
          ),
        ],
      ),
    );
  }
}
