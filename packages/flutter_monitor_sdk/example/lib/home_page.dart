// example/lib/home_page.dart
import 'package:http/http.dart' as http;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class HomePage extends StatelessWidget {
  final Dio dio;
  const HomePage({super.key, required this.dio});

  void _showSnackBar(BuildContext context, String message) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final http.Client monitoredHttpClient = FlutterMonitorSDK.httpClient;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Monitor SDK Demo'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Text("页面与性能监控",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/detail'),
                child: const Text('跳转详情页 (监控PV和页面加载)'),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                onPressed: () async {
                  try {
                    await dio.get('https://api.github.com/users/flutter');
                    if (!context.mounted) return;
                    _showSnackBar(context, 'API 调用成功! 请查看后端日志。');
                  } catch (e) {
                    if (!context.mounted) return;
                    _showSnackBar(context, 'API 调用失败: $e');
                  }
                },
                child: const Text('发起成功的API请求'),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade200),
                onPressed: () async {
                  try {
                    await dio.get('https://api.github.com/non-existent-path');
                  } catch (e) {
                    if (!context.mounted) return;
                    _showSnackBar(context, 'API 调用失败 (预期)! 请查看后端日志。');
                  }
                },
                child: const Text('发起失败的API请求'),
              ),
              const SizedBox(height: 24),

              // --- http 包监控 ---
              const Text("原生 http 包监控",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
                onPressed: () async {
                  try {
                    await monitoredHttpClient.get(Uri.parse(
                        'https://jsonplaceholder.typicode.com/posts/1'));
                    if (!context.mounted) return;
                    _showSnackBar(context, 'http API 调用成功! 请查看后端日志。');
                  } catch (e) {
                    if (!context.mounted) return;
                    _showSnackBar(context, 'http API 调用失败: $e');
                  }
                },
                child: const Text('发起成功的 http 请求'),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal.shade200),
                onPressed: () async {
                  try {
                    await monitoredHttpClient.get(Uri.parse(
                        'https://jsonplaceholder.typicode.com/non-existent'));
                  } catch (e) {
                    if (!context.mounted) return;
                    _showSnackBar(context, 'http API 调用失败 (预期)! 请查看后端日志。');
                  }
                },
                child: const Text('发起失败的 http 请求'),
              ),
              const SizedBox(height: 24),

              // ---  UI卡顿 ---
              const Text("UI卡顿", style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () {
                  // 这是一个非常耗时的同步操作，会阻塞UI线程，导致严重卡顿
                  final startTime = DateTime.now();
                  while (DateTime.now().difference(startTime).inMilliseconds <
                      1000) {
                    // 空循环，消耗CPU时间
                  }
                  _showSnackBar(context, 'UI 线程已阻塞 300ms，卡顿事件已上报!');
                },
                child: const Text('触发 UI 卡顿'),
              ),

              const SizedBox(height: 10),
              const JankTriggerButton(),
              const SizedBox(height: 10),

              const Text("真实场景卡顿监控",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amberAccent),
                onPressed: () => Navigator.pushNamed(context, '/complex_list'),
                child: const Text('进入复杂列表页面 (测试滑动卡顿)'),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.cyan),
                onPressed:() => Navigator.pushNamed(context, '/performance_test'),
               
                child: const Text('进入性能测试页面 (测试优化效果)'),
              ),

              const Text("错误监控", style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                onPressed: () {
                  dynamic a;
                  a.hello(); // 这会触发一个 NoSuchMethodError
                },
                child: const Text('触发 Dart 异步错误'),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange.shade200),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => const AlertDialog(
                      title: Text("布局错误"),
                      content: Row(children: [
                        Text(
                            "这段文字非常非常长，它会超出行的宽度限制，从而导致一个经典的布局溢出错误，这个错误会被FlutterError捕获。")
                      ]),
                    ),
                  );
                },
                child: const Text('触发 Flutter 布局错误'),
              ),
              const SizedBox(height: 24),

              const Text("行为与自定义事件监控",
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),

              // 案例1: 使用 MonitoredGestureDetector 监控关键点击
              MonitoredGestureDetector(
                identifier: 'set-user-id-button',
                onTap: () {
                  FlutterMonitorSDK.instance.setUserInfo(
                    const UserInfo(
                      userId: "user_007_bond",
                      userType: "premium",
                      userTags: ["vip", "beta"],
                      userProperties: {
                        "age": 30,
                        "city": "Beijing",
                        "subscription": "premium"
                      }
                    )
                  );
                  _showSnackBar(context, '用户信息已设置为 user_007_bond (Premium用户)');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text('设置用户ID (监控点击)',
                      style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),

              // 案例2: 简单设置用户ID
              MonitoredGestureDetector(
                identifier: 'set-simple-user-id-button',
                onTap: () {
                  FlutterMonitorSDK.instance.setUserId("user_simple_123");
                  _showSnackBar(context, '用户ID已设置为 user_simple_123');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.green,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text('设置简单用户ID',
                      style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),

              // 案例3: 清除用户信息
              MonitoredGestureDetector(
                identifier: 'clear-user-info-button',
                onTap: () {
                  FlutterMonitorSDK.instance.clearUserInfo();
                  _showSnackBar(context, '用户信息已清除');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text('清除用户信息',
                      style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),

              // 案例4: 设置自定义数据
              MonitoredGestureDetector(
                identifier: 'set-custom-data-button',
                onTap: () {
                  FlutterMonitorSDK.instance.setCustomData({
                    'sessionId': 'session_${DateTime.now().millisecondsSinceEpoch}',
                    'featureFlags': ['new_ui', 'beta_features', 'analytics'],
                    'appVersion': '1.0.0',
                    'deviceType': 'mobile',
                  });
                  _showSnackBar(context, '自定义数据已设置');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.purple,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text('设置自定义数据',
                      style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),

              // 案例5: 手动上报一个自定义事件
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple.shade100),
                onPressed: () {
                  FlutterMonitorSDK.instance.reportEvent(
                      'user_share', // 自定义事件分类
                      {
                        // 自定义事件的数据
                        'content_id': 'article_123',
                        'content_type': 'article',
                        'content_platform': 'wechat_timeline',
                      });
                  _showSnackBar(context, '已手动上报“分享”事件，请查看后端日志。');
                },
                child: const Text('手动上报“分享”事件'),
              ),
              const SizedBox(height: 10),

              // 案例3: 另一个 MonitoredGestureDetector 示例，包裹更复杂的组件
              MonitoredGestureDetector(
                identifier: 'subscribe-newsletter-click',
                onTap: () {
                  _showSnackBar(context, '“订阅”点击已记录！');
                },
                child: Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.mail_outline,
                            color: Theme.of(context).primaryColor),
                        const SizedBox(width: 8),
                        const Text("订阅我们的 Newsletter (监控点击)"),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 一个专门用于触发连续 UI 卡顿的按钮 (正确实现)
/// 使用 AnimationController 来确保在每一帧都执行耗时操作。
// 点击按钮: onPressed 被调用，它执行 _controller.forward(from: 0.0)，这会启动一个从头开始的、持续 2 秒的动画。
// 动画开始: AnimationController 开始工作。它会与屏幕的刷新率同步，在接下来的 2 秒内，在每一帧即将渲染前发出一个“tick”（滴答）信号。
// 监听器触发: 我们用 _controller.addListener(() { setState(() {}); }); 添加的监听器会在每一个“tick”信号上被调用。
// 强制重建: setState({}) 的调用会告诉 Flutter：“这个 Widget 的状态变了，你必须在下一帧重新执行它的 build 方法！”
// 慢 build 方法: 在下一帧，build 方法被调用。代码执行到 if (_controller.isAnimating)，条件为真，于是进入 while 循环，同步地消耗掉 45ms 的时间。这使得这一帧的构建过程变得非常缓慢。
// 循环往复: 在下一帧，AnimationController 再次发出“tick”，监听器再次调用 setState，build 方法再次被调用并消耗 45ms... 这个过程会持续 2 秒。
class JankTriggerButton extends StatefulWidget {
  const JankTriggerButton({super.key});

  @override
  State<JankTriggerButton> createState() => _JankTriggerButtonState();
}

// 1. 添加 SingleTickerProviderStateMixin
//    这是使用 AnimationController 的必要条件，它让 Widget 能接收到屏幕的垂直同步信号 (vsync)。
class _JankTriggerButtonState extends State<JankTriggerButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // 2. 初始化 AnimationController，设置一个2秒的持续时间
    _controller = AnimationController(
      vsync: this, // 关联 vsync
      duration: const Duration(seconds: 2),
    );

    // 3. (关键!) 添加一个监听器，在动画的每一“帧”都调用 setState
    //    这个操作会强制 Flutter 在动画的每一帧都重建这个 Widget 的 UI。
    //    这就是我们制造连续慢帧的核心机制。
    _controller.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    // 4. 必须在 dispose 中释放控制器，以防止内存泄露
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 5. 在 build 方法中，检查动画是否正在运行
    if (_controller.isAnimating) {
      // 在动画的每一帧，都执行这个同步的、耗时的操作
      final startTime = DateTime.now();
      // 将耗时减少到 40-50ms。这个时间点很关键：
      // - 它远大于一帧的预算时间 (16.7ms)，足以触发卡顿。
      // - 它又没有长到让 App 完全冻结，只是变得非常卡顿。
      while (DateTime.now().difference(startTime).inMilliseconds < 45) {
        // 消耗 CPU 时间，模拟一个复杂的 build 方法
      }
    }

    // 6. 返回按钮，其状态和行为与控制器关联
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        // 当动画运行时，按钮变灰，表示不可点击
        backgroundColor: _controller.isAnimating ? Colors.grey : Colors.red,
      ),
      // 当动画运行时，禁用按钮的点击事件
      onPressed: _controller.isAnimating
          ? null
          : () {
              // 点击时，从头开始播放动画
              _controller.forward(from: 0.0);
            },
      child: const Text('触发连续UI卡顿 (新方法)'),
    );
  }
}
