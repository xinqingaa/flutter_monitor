import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:example/models/demo_models.dart';
import 'package:http/http.dart' as http;

class DemoApi {
  DemoApi({required Dio dio, required http.Client httpClient})
    : _dio = dio,
      _httpClient = httpClient;

  final Dio _dio;
  final http.Client _httpClient;

  static const serviceBaseUrl = String.fromEnvironment(
    'FM_EXAMPLE_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3700',
  );

  Future<AppBootstrap> fetchBootstrap({String scene = 'launch'}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/app/bootstrap',
      queryParameters: <String, Object?>{'scene': scene},
    );
    return AppBootstrap.fromJson(_requireMap(response.data));
  }

  Future<AuthOptions> fetchAuthOptions() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/auth/options',
    );
    return AuthOptions.fromJson(_requireMap(response.data));
  }

  Future<LoginResult> login({required String userId}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/auth/login',
      data: <String, Object?>{
        'userId': userId,
        'device': 'example_flutter_app',
      },
    );
    return LoginResult.fromJson(_requireMap(response.data));
  }

  Future<HomeFeedState> loadHomeFeed({String? userId}) async {
    final feedUri = _uri(
      '/api/example/home/feed',
      queryParameters: <String, String>{'userId': userId ?? 'guest'},
    );
    final recommendationsUri = _uri(
      '/api/example/home/recommendations',
      queryParameters: <String, String>{'userId': userId ?? 'guest'},
    );
    final results = await Future.wait<Map<String, dynamic>>([
      _getJsonWithHttp(feedUri),
      _getJsonWithHttp(recommendationsUri),
    ]);
    return HomeFeedState.fromJson(results[0], results[1]);
  }

  Future<UserProfile> fetchUserProfile(String userId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/users/$userId/profile',
    );
    return UserProfile.fromJson(_requireMap(response.data));
  }

  Future<void> updatePreferences(
    String userId, {
    required bool premium,
    required bool weakNetwork,
  }) async {
    await _dio.put<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/users/$userId/preferences',
      data: <String, Object?>{
        'premium': premium,
        'weakNetwork': weakNetwork,
        'updatedFrom': 'profile_tab',
      },
    );
  }

  Future<CartState> fetchCart({String? userId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/checkout/cart',
      queryParameters: <String, Object?>{'userId': userId ?? 'guest'},
    );
    return CartState.fromJson(_requireMap(response.data));
  }

  Future<CouponResult> validateCoupon(String coupon) async {
    final response = await _httpClient.post(
      _uri('/api/example/checkout/coupons/validate'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode(<String, Object?>{'coupon': coupon}),
    );
    _throwForStatus(response.statusCode);
    return CouponResult.fromJson(_decodeMap(response.body));
  }

  Future<OrderResult> submitOrder({
    required String userId,
    required String coupon,
    required List<String> itemIds,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/checkout/orders',
      data: <String, Object?>{
        'userId': userId,
        'coupon': coupon,
        'itemIds': itemIds,
      },
    );
    return OrderResult.fromJson(_requireMap(response.data));
  }

  Future<void> deleteCartItem(String itemId) async {
    final response = await _httpClient.delete(
      _uri('/api/example/checkout/cart/items/$itemId'),
    );
    _throwForStatus(response.statusCode);
  }

  Future<SyncSummary> fetchSyncSummary() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/ops/sync/summary',
    );
    return SyncSummary.fromJson(_requireMap(response.data));
  }

  Future<void> syncOrders() async {
    final response = await _httpClient.post(
      _uri('/api/example/ops/sync/orders'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode(<String, Object?>{'source': 'ops_page'}),
    );
    _throwForStatus(response.statusCode);
  }

  Future<void> updatePricingRule() async {
    await _dio.put<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/ops/pricing/rules/default_discount',
      data: <String, Object?>{'discount': 0.9, 'scope': 'qa'},
    );
  }

  Future<void> deleteDraft() async {
    final response = await _httpClient.delete(
      _uri('/api/example/ops/drafts/draft_legacy_001'),
    );
    _throwForStatus(response.statusCode);
  }

  Future<void> fetchDailyReport({bool fail = false}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$serviceBaseUrl/api/example/ops/reports/daily',
      queryParameters: <String, Object?>{'fail': fail},
    );
    if ((response.statusCode ?? 0) >= 400) {
      throw StateError('HTTP ${response.statusCode}');
    }
  }

  void close() {
    _httpClient.close();
  }

  Uri _uri(String path, {Map<String, String>? queryParameters}) {
    return Uri.parse(
      '$serviceBaseUrl$path',
    ).replace(queryParameters: queryParameters);
  }

  Future<Map<String, dynamic>> _getJsonWithHttp(Uri uri) async {
    final response = await _httpClient.get(uri);
    _throwForStatus(response.statusCode);
    return _decodeMap(response.body);
  }

  Map<String, dynamic> _decodeMap(String body) {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw StateError('Example API response is not an object');
  }

  Map<String, dynamic> _requireMap(Map<String, dynamic>? data) {
    if (data == null) throw StateError('Example API response is empty');
    return data;
  }

  void _throwForStatus(int statusCode) {
    if (statusCode >= 400) {
      throw StateError('HTTP $statusCode');
    }
  }
}
