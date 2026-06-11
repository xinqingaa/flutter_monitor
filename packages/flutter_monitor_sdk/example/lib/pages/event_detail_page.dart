import 'dart:convert';

import 'package:example/models/monitor_event_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:flutter/material.dart';

class EventDetailPage extends StatefulWidget {
  const EventDetailPage({super.key});

  @override
  State<EventDetailPage> createState() => _EventDetailPageState();
}

class _EventDetailPageState extends State<EventDetailPage> {
  MonitorEventItem? _item;
  var _jsonExpanded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is MonitorEventItem && _item == null) {
      _item = arguments;
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    final colorScheme = Theme.of(context).colorScheme;
    return AppPage(
      routeName: AppRoutes.eventDetail,
      moduleName: 'content',
      moduleScene: 'event_detail',
      child: Scaffold(
        appBar: AppBar(title: const Text('事件详情')),
        body: item == null
            ? const Center(child: Text('缺少事件参数'))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _FieldCard(
                    title: item.name ?? '(unnamed)',
                    subtitle: '${item.signalType ?? '-'} · ${item.status ?? '-'}',
                    accent: _signalColor(colorScheme, item.signalType),
                    children: [
                      _InfoRow(label: 'eventId', value: item.eventId),
                      _InfoRow(
                        label: 'timestamp',
                        value: item.timestamp?.toIso8601String() ?? '-',
                      ),
                      _InfoRow(label: 'sessionId', value: item.sessionId ?? '-'),
                      _InfoRow(label: 'traceId', value: item.traceId ?? '-'),
                      _InfoRow(label: 'route', value: item.routeName ?? '-'),
                      _InfoRow(label: 'userId', value: item.userId ?? '-'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ListTile(
                          title: const Text('Raw Envelope JSON'),
                          trailing: Icon(
                            _jsonExpanded
                                ? Icons.expand_less
                                : Icons.expand_more,
                          ),
                          onTap: () =>
                              setState(() => _jsonExpanded = !_jsonExpanded),
                        ),
                        if (_jsonExpanded)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: SelectableText(
                              const JsonEncoder.withIndent(
                                '  ',
                              ).convert(item.raw),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '完整 timeline 请打开 Workbench：http://localhost:4700',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.children,
  });

  final String title;
  final String subtitle;
  final Color accent;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(width: 4, height: 40, color: accent),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(subtitle),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}

Color _signalColor(ColorScheme colorScheme, String? signalType) {
  return switch (signalType) {
    'trace' => colorScheme.primary,
    'span' => colorScheme.secondary,
    'error' => colorScheme.error,
    'breadcrumb' => colorScheme.tertiary,
    'metric' => colorScheme.outline,
    _ => colorScheme.outlineVariant,
  };
}
