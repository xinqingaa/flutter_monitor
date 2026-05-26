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

  List<Breadcrumb> snapshot() => List<Breadcrumb>.unmodifiable(_items);
}
