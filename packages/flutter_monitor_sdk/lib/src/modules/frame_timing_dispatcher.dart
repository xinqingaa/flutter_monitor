import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

/// Flutter frame timing 的统一分发器。
///
/// Flutter 只需要注册一次 `SchedulerBinding.addTimingsCallback`，该类把回调结果
/// 分发给 jank monitor、page frame window collector 等多个内部消费者，避免各模块
/// 重复注册或忘记移除回调。
class FrameTimingDispatcher {
  final List<void Function(List<FrameTiming> timings)> _listeners =
      <void Function(List<FrameTiming> timings)>[];
  var _isCallbackAdded = false;

  /// 添加一个帧耗时监听器。
  ///
  /// 监听器会在每批 [FrameTiming] 到达时被调用。调用方应在自身 dispose 时通过
  /// 本 dispatcher 的 [dispose] 统一清理。
  void addListener(void Function(List<FrameTiming> timings) listener) {
    _listeners.add(listener);
  }

  /// 注册 Flutter frame timing 回调。
  ///
  /// 重复调用会被忽略，确保整个 SDK 只向 Flutter binding 注册一次。
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

  /// 移除 frame timing 回调并清空监听器。
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
