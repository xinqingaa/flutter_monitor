import 'package:example/router/app_routes.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key});

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  var _submitting = false;
  var _coupon = 'DEMO_EXPIRED';
  var _message = '订单待提交';

  Future<void> _submitOrder() async {
    if (_submitting) return;
    appTrack(
      context,
      action: 'checkout.submit',
      result: MonitorTrackResult.started,
      target: 'submit_order_button',
      properties: <String, Object?>{'coupon.code': _coupon},
      message: '已记录订单提交行为',
    );
    setState(() {
      _submitting = true;
      _message = '正在校验订单';
    });
    await Future<void>.delayed(const Duration(milliseconds: 280));
    if (!mounted) {
      return;
    }
    if (_coupon == 'DEMO_EXPIRED') {
      setState(() {
        _submitting = false;
        _message = '优惠券已过期，请更换后重试';
      });
      appTrack(
        context,
        action: 'checkout.submit',
        result: MonitorTrackResult.failed,
        level: MonitorEventLevel.warning,
        target: 'submit_order_button',
        error: 'coupon_expired',
        properties: <String, Object?>{'coupon.code': _coupon},
        message: '已记录优惠券过期',
      );
      return;
    }

    await Future<void>.delayed(const Duration(milliseconds: 420));
    if (!mounted) {
      return;
    }
    setState(() {
      _submitting = false;
      _message = '订单提交成功';
    });
    appTrack(
      context,
      action: 'checkout.submit',
      result: MonitorTrackResult.success,
      target: 'submit_order_button',
      properties: const <String, Object?>{'result': 'success'},
      message: '已记录订单提交成功',
    );
  }

  void _replaceCoupon() {
    setState(() {
      _coupon = 'DEMO_OK';
      _message = '优惠券已替换';
    });
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      routeName: AppRoutes.checkout,
      moduleName: 'commerce',
      moduleScene: 'checkout',
      child: Scaffold(
        appBar: AppBar(title: const Text('订单结算')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSection(
              title: '订单商品',
              subtitle: '模拟校验、失败、重试、成功链路。',
              children: const [
                _OrderRow(name: 'Flutter 专题内容包', price: '¥128'),
                _OrderRow(name: '离线性能报告', price: '¥36'),
                _OrderRow(name: 'QA 复现资料包', price: '¥18'),
              ],
            ),
            AppSection(
              title: '支付信息',
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('优惠券'),
                  subtitle: Text(_coupon),
                  trailing: OutlinedButton(
                    onPressed: _replaceCoupon,
                    child: const Text('替换'),
                  ),
                ),
                const SizedBox(height: 8),
                Text(_message),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submitOrder,
                  icon: _submitting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.lock_outline),
                  label: Text(_submitting ? '提交中' : '提交订单'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.name, required this.price});

  final String name;
  final String price;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(name)),
          Text(price, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}
