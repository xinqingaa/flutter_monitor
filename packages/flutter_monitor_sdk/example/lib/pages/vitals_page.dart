import 'package:example/data/api_client.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/pulse_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_track.dart';
import 'package:example/widgets/pulse_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class VitalsPage extends StatefulWidget {
  const VitalsPage({super.key, required this.api});

  final DemoApi api;

  @override
  State<VitalsPage> createState() => _VitalsPageState();
}

class _VitalsPageState extends State<VitalsPage> {
  VitalLatest? _latest;
  List<VitalHistoryItem> _history = const [];
  final _weight = TextEditingController(text: '63.0');
  Object? _error;
  var _loading = true;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _weight.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>([
        widget.api.vitalsLatest(),
        widget.api.vitalsHistory(),
      ]);
      if (!mounted) return;
      setState(() {
        _latest = results[0] as VitalLatest;
        _history = results[1] as List<VitalHistoryItem>;
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

  Future<void> _submit() async {
    final weight = double.tryParse(_weight.text.trim());
    if (weight == null) return;
    setState(() => _busy = true);
    try {
      await widget.api.submitVital(weightKg: weight, restingHr: 62, sleepHours: 7);
      if (!mounted) return;
      appTrack(
        context,
        action: 'vital.submit',
        message: '体征已上报',
        properties: {'result': 'success', 'weight_kg': weight},
      );
      _load();
    } on ApiEnvelopeException catch (error) {
      if (!mounted) return;
      appTrack(
        context,
        action: 'vital.submit',
        result: MonitorTrackResult.failed,
        error: error.message,
        message: error.message,
        properties: {'result': 'failed', 'biz_code': error.code},
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final latest = _latest;
    return AppPage(
      routeName: AppRoutes.vitals,
      moduleName: 'me',
      moduleScene: 'vitals',
      child: Scaffold(
        appBar: AppBar(title: const Text('体征与睡眠')),
        body: AsyncBody(
          loading: _loading && latest == null,
          error: _error,
          onRetry: _load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (latest != null)
                PulseCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '最近一次',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '体重 ${latest.weightKg.toStringAsFixed(1)} kg · 静息心率 ${latest.restingHr} · 睡眠 ${latest.sleepHours.toStringAsFixed(1)} h',
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              PulseCard(
                child: Column(
                  children: [
                    TextField(
                      controller: _weight,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(labelText: '体重 (kg)'),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: const Text('提交体征'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                '近 7 日',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              ..._history.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PulseCard(
                    child: Text(
                      '${item.date} · ${item.weightKg.toStringAsFixed(1)} kg · HR ${item.restingHr} · 睡 ${item.sleepHours.toStringAsFixed(1)}h',
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
