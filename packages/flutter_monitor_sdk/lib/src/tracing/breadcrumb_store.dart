import 'package:flutter_monitor_core/flutter_monitor_core.dart';

class BreadcrumbStore {
  BreadcrumbStore({this.capacity = 50});

  final int capacity;
  final List<Breadcrumb> _items = <Breadcrumb>[];

  void add(Breadcrumb breadcrumb) {
    _items.add(breadcrumb);
    while (_items.length > capacity) {
      _items.removeAt(0);
    }
  }

  List<Breadcrumb> snapshot({int? limit}) {
    if (limit == null || limit >= _items.length) {
      return List<Breadcrumb>.unmodifiable(_items);
    }
    if (limit <= 0) return const <Breadcrumb>[];
    return List<Breadcrumb>.unmodifiable(_items.skip(_items.length - limit));
  }

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
