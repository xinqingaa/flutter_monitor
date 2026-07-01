import 'package:dio/dio.dart';
import 'package:example/data/demo_api.dart';
import 'package:example/models/demo_models.dart';
import 'package:example/router/app_routes.dart';
import 'package:example/session/app_session.dart';
import 'package:example/widgets/app_page.dart';
import 'package:example/widgets/app_section.dart';
import 'package:example/widgets/app_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_monitor_sdk/flutter_monitor_sdk.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({
    super.key,
    required this.dio,
    this.loadCartOnStart = true,
  });

  final Dio dio;
  final bool loadCartOnStart;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  late final DemoApi _api;
  CartState? _cart;
  Object? _cartError;
  var _loadingCart = false;
  var _submitting = false;
  var _coupon = 'DEMO_EXPIRED';
  var _message = '订单待提交';

  @override
  void initState() {
    super.initState();
    _api = DemoApi(
      dio: widget.dio,
      httpClient: FlutterMonitorSDK.createHttpClient(),
    );
    if (widget.loadCartOnStart) {
      _loadCart();
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _loadCart() async {
    setState(() {
      _loadingCart = true;
      _cartError = null;
    });
    try {
      final cart = await _api.fetchCart(userId: AppSession.userId);
      if (!mounted) return;
      setState(() {
        _cart = cart;
        _coupon = cart.coupon;
        _loadingCart = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _cartError = error;
        _loadingCart = false;
      });
    }
  }

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
      _message = '正在校验优惠券';
    });
    late final CouponResult couponResult;
    try {
      couponResult = await _api.validateCoupon(_coupon);
    } catch (error, stackTrace) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _message = '订单接口异常：$error';
      });
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'checkout_coupon_validate_failed',
        handled: true,
        properties: <String, Object?>{'coupon.code': _coupon},
      );
      return;
    }
    if (!mounted) {
      return;
    }
    if (!couponResult.ok) {
      setState(() {
        _submitting = false;
        _message = couponResult.message;
      });
      appTrack(
        context,
        action: 'checkout.submit',
        result: MonitorTrackResult.failed,
        level: MonitorEventLevel.warning,
        target: 'submit_order_button',
        error: couponResult.code,
        properties: <String, Object?>{
          'coupon.code': _coupon,
          'business.code': couponResult.code,
        },
        message: '已记录优惠券业务失败',
      );
      return;
    }

    setState(() {
      _message = '正在提交订单';
    });
    late final OrderResult order;
    try {
      order = await _api.submitOrder(
        userId: AppSession.userId ?? 'guest',
        coupon: _coupon,
        itemIds:
            _cart?.items.map((item) => item.id).toList(growable: false) ??
            const <String>[],
      );
    } catch (error, stackTrace) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _message = '订单接口异常：$error';
      });
      FlutterMonitorSDK.recordError(
        error,
        stackTrace: stackTrace,
        type: 'checkout_order_submit_failed',
        handled: true,
        properties: <String, Object?>{'coupon.code': _coupon},
      );
      return;
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _submitting = false;
      _message = order.ok ? '订单提交成功：${order.orderId}' : order.message;
    });
    appTrack(
      context,
      action: 'checkout.submit',
      result: order.ok ? MonitorTrackResult.success : MonitorTrackResult.failed,
      target: 'submit_order_button',
      properties: <String, Object?>{
        'result': order.status,
        'order.id': order.orderId,
      },
      message: order.ok ? '已记录订单提交成功' : '已记录订单提交失败',
    );
  }

  Future<void> _replaceCoupon() async {
    setState(() {
      _coupon = 'DEMO_OK';
      _message = '正在校验新优惠券';
    });
    final result = await _api.validateCoupon(_coupon);
    if (!mounted) return;
    setState(() {
      _message = result.message;
    });
  }

  Future<void> _deleteFirstItem() async {
    final items = _cart?.items ?? const <CartItem>[];
    if (items.isEmpty) return;
    final item = items.first;
    await _api.deleteCartItem(item.id);
    if (!mounted) return;
    appTrack(
      context,
      action: 'checkout.cart.delete_item',
      target: item.id,
      properties: <String, Object?>{'item.name': item.name},
      message: '已删除购物车商品',
    );
    await _loadCart();
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
              title: '购物车接口',
              subtitle: _loadingCart
                  ? '正在读取购物车'
                  : _cartError != null
                  ? '购物车读取失败'
                  : '${_cart?.items.length ?? 0} 件商品 · ¥${(_cart?.total ?? 0).toStringAsFixed(0)}',
              children: [
                for (final item in _cart?.items ?? const <CartItem>[])
                  _OrderRow(
                    name: '${item.name} x${item.quantity}',
                    price:
                        '¥${(item.price * item.quantity).toStringAsFixed(0)}',
                  ),
                OutlinedButton.icon(
                  onPressed: _loadingCart ? null : _loadCart,
                  icon: const Icon(Icons.refresh),
                  label: const Text('刷新购物车'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _cart?.items.isEmpty ?? true
                      ? null
                      : _deleteFirstItem,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('删除第一件商品'),
                ),
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
