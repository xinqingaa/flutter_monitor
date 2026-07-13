import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';

class NoticesPage extends StatefulWidget {
  const NoticesPage({super.key, required this.api});

  final DemoApi api;

  @override
  State<NoticesPage> createState() => _NoticesPageState();
}

class _NoticesPageState extends State<NoticesPage> {
  List<NoticeItem> _items = const [];
  Object? _error;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await widget.api.notices();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.notices,
      moduleName: 'me',
      moduleScene: 'notices',
      child: Scaffold(
        appBar: AppBar(title: const Text('消息通知')),
        body: AsyncBody(
          loading: _loading,
          error: _error,
          onRetry: _load,
          empty: !_loading && _items.isEmpty,
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _items.length,
            itemBuilder: (context, index) {
              final item = _items[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: PulseCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (!item.read)
                            ToneBadge(label: '未读', tone: 'rose'),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(item.body),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
