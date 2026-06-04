import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

class FrameTimingDispatcher {
  final List<void Function(List<FrameTiming> timings)> _listeners =
      <void Function(List<FrameTiming> timings)>[];
  var _isCallbackAdded = false;

  void addListener(void Function(List<FrameTiming> timings) listener) {
    _listeners.add(listener);
  }

  void init() {
    if (_isCallbackAdded) return;
    try {
      SchedulerBinding.instance.addTimingsCallback(_onTimings);
      _isCallbackAdded = true;
      debugPrint("✅ FrameTimingDispatcher 回调已注册");
    } catch (e) {
      debugPrint("错误: FrameTimingDispatcher 回调注册失败: $e");
    }
  }

  void dispose() {
    if (!_isCallbackAdded) return;
    try {
      SchedulerBinding.instance.removeTimingsCallback(_onTimings);
      _isCallbackAdded = false;
      _listeners.clear();
      debugPrint("✅ FrameTimingDispatcher 回调已移除");
    } catch (e) {
      debugPrint("错误: FrameTimingDispatcher dispose 失败: $e");
    }
  }

  void _onTimings(List<FrameTiming> timings) {
    for (final listener in List.of(_listeners)) {
      listener(timings);
    }
  }
}
