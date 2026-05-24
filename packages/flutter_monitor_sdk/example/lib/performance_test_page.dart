import 'package:flutter/material.dart';

/// 性能测试页面
/// 用于测试优化后的卡顿监控功能
class PerformanceTestPage extends StatefulWidget {
  const PerformanceTestPage({super.key});

  @override
  State<PerformanceTestPage> createState() => _PerformanceTestPageState();
}

class _PerformanceTestPageState extends State<PerformanceTestPage> 
    with TickerProviderStateMixin {
  final List<String> _testResults = [];
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('性能测试页面'),
        backgroundColor: Colors.blue,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 测试说明
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '性能测试说明',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '这个页面用于测试优化后的卡顿监控功能。\n\n'
                      '📊 监控数据说明：\n'
                      '• jank_count: 连续卡顿帧数\n'
                      '• max_duration_ms: 最严重一帧耗时\n'
                      '• average_duration_ms: 平均每帧耗时\n'
                      '• fps: 实际帧率\n'
                      '• stability: 稳定性指标(0-1)\n'
                      '• device_level: 设备性能等级\n\n'
                      '🎯 测试说明：\n'
                      '• 轻微卡顿(22ms): 应该被抖动容忍机制忽略\n'
                      '• 中等卡顿(32ms): 可能被检测到\n'
                      '• 严重卡顿(55ms): 应该被检测到\n'
                      '• 连续卡顿: 测试连续检测能力',
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _clearResults,
                      child: const Text('清空测试结果'),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // 测试按钮组
            _buildTestSection(
              '基础性能测试',
              [
                _buildTestButton(
                  '轻微卡顿测试 (22ms)',
                  '预期：被抖动容忍机制忽略，不输出日志',
                  () => _triggerMildJank(),
                  Colors.orange,
                ),
                _buildTestButton(
                  '中等卡顿测试 (32ms)',
                  '预期：可能被检测到，输出少量日志',
                  () => _triggerModerateJank(),
                  Colors.red,
                ),
                _buildTestButton(
                  '严重卡顿测试 (55ms)',
                  '预期：肯定被检测到，输出详细日志',
                  () => _triggerSevereJank(),
                  Colors.purple,
                ),
                _buildTestButton(
                  '简单卡顿测试 (模仿HomePage)',
                  '使用与HomePage相同的方法，肯定有日志',
                  () => _triggerSimpleJank(),
                  Colors.green,
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            _buildTestSection(
              '连续卡顿测试',
              [
                _buildTestButton(
                  '连续轻微卡顿 (3次22ms)',
                  '预期：可能被检测到，测试连续检测',
                  () => _triggerConsecutiveMildJank(),
                  Colors.amber,
                ),
                _buildTestButton(
                  '连续严重卡顿 (5次55ms)',
                  '预期：肯定被检测到，输出详细日志',
                  () => _triggerConsecutiveSevereJank(),
                  Colors.deepPurple,
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            _buildTestSection(
              '性能压力测试',
              [
                _buildTestButton(
                  '高频操作测试',
                  '模拟高频操作，测试采样机制',
                  () => _triggerHighFrequencyOperations(),
                  Colors.teal,
                ),
                _buildTestButton(
                  '内存压力测试',
                  '模拟内存压力场景',
                  () => _triggerMemoryPressure(),
                  Colors.indigo,
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // 测试结果
            if (_testResults.isNotEmpty) ...[
              const Text(
                '测试结果',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: _testResults.map((result) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2.0),
                      child: Text(result),
                    )).toList(),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTestSection(String title, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildTestButton(
    String title,
    String description,
    VoidCallback onPressed,
    Color color,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
        ),
        onPressed: () {
          onPressed();
          _addTestResult('✅ $title - $description');
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text(description, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  void _addTestResult(String result) {
    setState(() {
      _testResults.add('${DateTime.now().toString().substring(11, 19)}: $result');
    });
  }

  void _clearResults() {
    setState(() {
      _testResults.clear();
    });
  }

  // 测试方法实现 - 使用 AnimationController 触发真正的帧渲染
  void _triggerMildJank() {
    // 轻微卡顿：20-25ms，应该被抖动容忍机制忽略
    _triggerJankWithAnimation(22, '轻微卡顿');
  }

  void _triggerModerateJank() {
    // 中等卡顿：30-35ms，可能被检测到
    _triggerJankWithAnimation(32, '中等卡顿');
  }

  void _triggerSevereJank() {
    // 严重卡顿：50ms+，应该被检测到
    _triggerJankWithAnimation(55, '严重卡顿');
  }

  /// 简单卡顿测试 - 完全模仿 HomePage 的 JankTriggerButton 实现
  void _triggerSimpleJank() {
    
    // 这是一个非常耗时的同步操作，会阻塞UI线程，导致严重卡顿
    final startTime = DateTime.now();
    while (DateTime.now().difference(startTime).inMilliseconds < 1000) {
      // 空循环，消耗CPU时间
    }
    
    debugPrint("✅ 简单卡顿测试完成");
  }

  /// 使用 AnimationController 触发真正的帧渲染卡顿
  void _triggerJankWithAnimation(int durationMs, String testName) {
    
    // 创建一个临时的 AnimationController 来触发帧渲染
    final controller = AnimationController(
      duration: Duration(milliseconds: 2000), // 固定2秒动画，确保有足够时间
      vsync: this,
    );
  
    
    // 添加监听器，在每一帧都执行耗时操作
    controller.addListener(() {
      if (controller.isAnimating) {
        // 在动画的每一帧执行耗时操作
        final startTime = DateTime.now();
        while (DateTime.now().difference(startTime).inMilliseconds < durationMs) {
          // 耗时操作
        }
        
        // 强制重建UI，确保触发帧渲染
        setState(() {});
      }
    });
    
    // 启动动画
    controller.forward().then((_) {
      controller.dispose();
    });
  }

  void _triggerConsecutiveMildJank() {
    // 连续轻微卡顿 - 使用单个动画控制器
    _triggerConsecutiveJank(22, 3, '连续轻微卡顿');
  }

  void _triggerConsecutiveSevereJank() {
    // 连续严重卡顿 - 使用单个动画控制器
    _triggerConsecutiveJank(55, 5, '连续严重卡顿');
  }

  /// 触发连续卡顿
  void _triggerConsecutiveJank(int durationMs, int frameCount, String testName) {
    debugPrint("🚀 开始连续测试: $testName (${durationMs}ms x $frameCount 帧)");
    
    final controller = AnimationController(
      duration: Duration(milliseconds: 3000), // 固定3秒动画
      vsync: this,
    );
    
    int frameCounter = 0;
    controller.addListener(() {
      if (controller.isAnimating && frameCounter < frameCount) {
        frameCounter++;
        debugPrint("📊 连续第 $frameCounter 帧开始，执行 ${durationMs}ms 耗时操作");
        
        final startTime = DateTime.now();
        while (DateTime.now().difference(startTime).inMilliseconds < durationMs) {
          // 耗时操作
        }
        
        final actualDuration = DateTime.now().difference(startTime).inMilliseconds;
        debugPrint("⏱️ 实际耗时: ${actualDuration}ms");
        
        // 强制重建UI，确保触发帧渲染
        setState(() {});
      }
    });
    
    controller.forward().then((_) {
      debugPrint("✅ 连续测试完成: $testName，共执行 $frameCounter 帧");
      controller.dispose();
    });
  }

  void _triggerHighFrequencyOperations() {
    // 高频操作测试 - 使用动画控制器
    final controller = AnimationController(
      duration: const Duration(milliseconds: 2000), // 2秒高频操作
      vsync: this,
    );
    
    controller.addListener(() {
      if (controller.isAnimating) {
        // 快速操作，测试采样机制
        final startTime = DateTime.now();
        while (DateTime.now().difference(startTime).inMilliseconds < 5) {
          // 快速操作
        }
      }
    });
    
    controller.forward().then((_) {
      controller.dispose();
    });
  }

  void _triggerMemoryPressure() {
    // 内存压力测试 - 使用动画控制器
    final controller = AnimationController(
      duration: const Duration(milliseconds: 3000), // 3秒内存压力测试
      vsync: this,
    );
    
    final List<List<int>> memoryChunks = [];
    int operationCount = 0;
    
    controller.addListener(() {
      if (controller.isAnimating) {
        // 创建内存压力
        memoryChunks.add(List.filled(1000, operationCount));
        operationCount++;
        
        // 每100次操作后触发一次卡顿
        if (operationCount % 100 == 0) {
          final startTime = DateTime.now();
          while (DateTime.now().difference(startTime).inMilliseconds < 40) {
            // 内存压力导致的卡顿
          }
        }
      }
    });
    
    controller.forward().then((_) {
      controller.dispose();
      // 清理内存
      memoryChunks.clear();
    });
  }
}
