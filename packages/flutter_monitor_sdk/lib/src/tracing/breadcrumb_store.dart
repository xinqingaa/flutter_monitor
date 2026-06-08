import 'package:flutter_monitor_core/flutter_monitor_core.dart';

/// 近期 breadcrumb 的内存环形存储。
///
/// pipeline 会把业务 track、错误、卡顿、失败 HTTP、memory pressure、native warning
/// 等排障有价值的事件写入这里。后续 error/jank/failed HTTP 等关键事件会从这里取
/// 与当前 trace 或 route 相关的 breadcrumbs，帮助还原问题发生前的上下文。
class BreadcrumbStore {
  /// 创建 breadcrumb store。
  ///
  /// [capacity] 控制最多保留多少条近期 breadcrumb，超过后丢弃最旧项。
  BreadcrumbStore({this.capacity = 50});

  /// 最大保留条数。
  final int capacity;
  final List<Breadcrumb> _items = <Breadcrumb>[];

  /// 添加一条 breadcrumb，并按容量裁剪最早的数据。
  void add(Breadcrumb breadcrumb) {
    _items.add(breadcrumb);
    while (_items.length > capacity) {
      _items.removeAt(0);
    }
  }

  /// 获取最近的 breadcrumb 快照。
  ///
  /// [limit] 为空时返回全部；大于容量时也只返回当前已有数据。
  List<Breadcrumb> snapshot({int? limit}) {
    if (limit == null || limit >= _items.length) {
      return List<Breadcrumb>.unmodifiable(_items);
    }
    if (limit <= 0) return const <Breadcrumb>[];
    return List<Breadcrumb>.unmodifiable(_items.skip(_items.length - limit));
  }

  /// 获取与当前 trace 或 route 优先相关的 breadcrumb 快照。
  ///
  /// 选择顺序为：同 trace -> 同 route -> 其他最近事件，最终仍按时间升序返回。
  List<Breadcrumb> relevantSnapshot({
    int? limit,
    String? traceId,
    String? route,
  }) {
    if (limit == null || limit <= 0) return const <Breadcrumb>[];
    if (_items.isEmpty) return const <Breadcrumb>[];

    final selected = <Breadcrumb>[];
    final seen = <Breadcrumb>{};

    void addMatching(bool Function(Breadcrumb breadcrumb) matches) {
      for (final breadcrumb in _items.reversed) {
        if (selected.length >= limit) return;
        if (seen.contains(breadcrumb)) continue;
        if (!matches(breadcrumb)) continue;
        selected.add(breadcrumb);
        seen.add(breadcrumb);
      }
    }

    if (traceId != null && traceId.isNotEmpty) {
      addMatching((breadcrumb) => breadcrumb.traceId == traceId);
    }
    if (route != null && route.isNotEmpty) {
      addMatching((breadcrumb) => breadcrumb.route == route);
    }
    addMatching((_) => true);

    return List<Breadcrumb>.unmodifiable(selected.reversed);
  }
}
