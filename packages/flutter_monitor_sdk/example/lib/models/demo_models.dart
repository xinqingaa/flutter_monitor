class AppBootstrap {
  const AppBootstrap({
    required this.release,
    required this.featureFlags,
    required this.serverTime,
  });

  final String release;
  final List<String> featureFlags;
  final DateTime? serverTime;

  factory AppBootstrap.fromJson(Map<String, dynamic> json) {
    return AppBootstrap(
      release: json['release'] as String? ?? '-',
      featureFlags: _stringList(json['featureFlags']),
      serverTime: DateTime.tryParse(json['serverTime'] as String? ?? ''),
    );
  }
}

class AuthOptions {
  const AuthOptions({
    required this.methods,
    required this.notice,
    required this.supportContact,
  });

  final List<String> methods;
  final String notice;
  final String supportContact;

  factory AuthOptions.fromJson(Map<String, dynamic> json) {
    return AuthOptions(
      methods: _stringList(json['methods']),
      notice: json['notice'] as String? ?? '请输入 userId',
      supportContact: json['supportContact'] as String? ?? '-',
    );
  }
}

class LoginResult {
  const LoginResult({
    required this.userId,
    required this.name,
    required this.tier,
    required this.token,
  });

  final String userId;
  final String name;
  final String tier;
  final String token;

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final userMap = user is Map<String, dynamic> ? user : <String, dynamic>{};
    return LoginResult(
      userId: userMap['userId'] as String? ?? '',
      name: userMap['name'] as String? ?? 'QA 用户',
      tier: userMap['tier'] as String? ?? 'free',
      token: json['token'] as String? ?? '',
    );
  }
}

class DemoFeedItem {
  const DemoFeedItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.description,
    required this.source,
    required this.metricLabel,
    required this.metricValue,
  });

  final String id;
  final String title;
  final String subtitle;
  final String description;
  final String source;
  final String metricLabel;
  final String metricValue;

  factory DemoFeedItem.fromJson(Map<String, dynamic> json) {
    return DemoFeedItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      description: json['description'] as String? ?? '',
      source: json['source'] as String? ?? '-',
      metricLabel: json['metricLabel'] as String? ?? '-',
      metricValue: json['metricValue'] as String? ?? '-',
    );
  }
}

class HomeFeedState {
  const HomeFeedState({
    required this.userId,
    required this.unreadCount,
    required this.items,
  });

  final String userId;
  final int unreadCount;
  final List<DemoFeedItem> items;

  factory HomeFeedState.fromJson(
    Map<String, dynamic> feed,
    Map<String, dynamic> recommendations,
  ) {
    return HomeFeedState(
      userId: feed['userId'] as String? ?? 'guest',
      unreadCount: _intValue(feed['unreadCount']),
      items: [..._items(feed['items']), ..._items(recommendations['items'])],
    );
  }
}

class UserProfile {
  const UserProfile({
    required this.userId,
    required this.name,
    required this.tier,
    required this.tags,
    required this.weakNetwork,
    required this.notifications,
  });

  final String userId;
  final String name;
  final String tier;
  final List<String> tags;
  final bool weakNetwork;
  final bool notifications;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    final userMap = user is Map<String, dynamic> ? user : <String, dynamic>{};
    final preferences = json['preferences'];
    final prefs = preferences is Map<String, dynamic>
        ? preferences
        : <String, dynamic>{};
    return UserProfile(
      userId: userMap['userId'] as String? ?? '',
      name: userMap['name'] as String? ?? 'QA 用户',
      tier: userMap['tier'] as String? ?? 'free',
      tags: _stringList(userMap['tags']),
      weakNetwork: prefs['weakNetwork'] as bool? ?? false,
      notifications: prefs['notifications'] as bool? ?? true,
    );
  }
}

class CartItem {
  const CartItem({
    required this.id,
    required this.name,
    required this.price,
    required this.quantity,
  });

  final String id;
  final String name;
  final double price;
  final int quantity;

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      price: _doubleValue(json['price']),
      quantity: _intValue(json['quantity']),
    );
  }
}

class CartState {
  const CartState({
    required this.userId,
    required this.coupon,
    required this.items,
    required this.total,
  });

  final String userId;
  final String coupon;
  final List<CartItem> items;
  final double total;

  factory CartState.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return CartState(
      userId: json['userId'] as String? ?? 'guest',
      coupon: json['coupon'] as String? ?? '',
      items: rawItems is List
          ? rawItems
                .whereType<Map<String, dynamic>>()
                .map(CartItem.fromJson)
                .toList(growable: false)
          : const <CartItem>[],
      total: _doubleValue(json['total']),
    );
  }
}

class CouponResult {
  const CouponResult({
    required this.ok,
    required this.code,
    required this.message,
    required this.discount,
  });

  final bool ok;
  final String code;
  final String message;
  final double discount;

  factory CouponResult.fromJson(Map<String, dynamic> json) {
    return CouponResult(
      ok: json['ok'] as bool? ?? false,
      code: json['code'] as String? ?? '-',
      message: json['message'] as String? ?? '-',
      discount: _doubleValue(json['discount']),
    );
  }
}

class OrderResult {
  const OrderResult({
    required this.ok,
    required this.orderId,
    required this.status,
    required this.message,
    required this.payable,
  });

  final bool ok;
  final String orderId;
  final String status;
  final String message;
  final double payable;

  factory OrderResult.fromJson(Map<String, dynamic> json) {
    return OrderResult(
      ok: json['ok'] as bool? ?? false,
      orderId: json['orderId'] as String? ?? '',
      status: json['status'] as String? ?? '',
      message: json['message'] as String? ?? '',
      payable: _doubleValue(json['payable']),
    );
  }
}

class SyncSummary {
  const SyncSummary({
    required this.pendingOrders,
    required this.inventoryTasks,
    this.lastSyncAt,
  });

  final int pendingOrders;
  final int inventoryTasks;
  final DateTime? lastSyncAt;

  factory SyncSummary.fromJson(Map<String, dynamic> json) {
    return SyncSummary(
      pendingOrders: _intValue(json['pendingOrders']),
      inventoryTasks: _intValue(json['inventoryTasks']),
      lastSyncAt: DateTime.tryParse(json['lastSyncAt'] as String? ?? ''),
    );
  }
}

List<String> _stringList(Object? value) {
  if (value is! List) return const <String>[];
  return value.whereType<String>().toList(growable: false);
}

List<DemoFeedItem> _items(Object? value) {
  if (value is! List) return const <DemoFeedItem>[];
  return value
      .whereType<Map<String, dynamic>>()
      .map(DemoFeedItem.fromJson)
      .toList(growable: false);
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

double _doubleValue(Object? value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? 0;
}
