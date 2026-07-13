import 'package:dio/dio.dart';

class ApiEnvelopeException implements Exception {
  ApiEnvelopeException({
    required this.code,
    required this.message,
    this.requestId,
    this.httpStatus,
  });

  final int code;
  final String message;
  final String? requestId;
  final int? httpStatus;

  bool get isBusinessFailure => httpStatus == null || httpStatus == 200;

  @override
  String toString() => 'ApiEnvelopeException($code): $message';
}

/// Single Dio client for PulseFit demo APIs (`code` / `message` / `data`).
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  static const baseUrl = String.fromEnvironment(
    'FM_EXAMPLE_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3700',
  );

  String? _token;

  void setToken(String? token) {
    _token = token;
    if (token == null || token.isEmpty) {
      _dio.options.headers.remove('Authorization');
    } else {
      _dio.options.headers['Authorization'] = 'Bearer $token';
    }
  }

  String? get token => _token;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(Object? data) parse,
  }) {
    return _send(
      () => _dio.get<Map<String, dynamic>>(
        '$baseUrl$path',
        queryParameters: query,
      ),
      parse: parse,
    );
  }

  Future<T> post<T>(
    String path, {
    Object? body,
    required T Function(Object? data) parse,
  }) {
    return _send(
      () => _dio.post<Map<String, dynamic>>('$baseUrl$path', data: body),
      parse: parse,
    );
  }

  Future<T> put<T>(
    String path, {
    Object? body,
    required T Function(Object? data) parse,
  }) {
    return _send(
      () => _dio.put<Map<String, dynamic>>('$baseUrl$path', data: body),
      parse: parse,
    );
  }

  Future<T> _send<T>(
    Future<Response<Map<String, dynamic>>> Function() call, {
    required T Function(Object? data) parse,
  }) async {
    try {
      final response = await call();
      return _unwrap(response.data, parse, response.statusCode);
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      final data = error.response?.data;
      if (data is Map<String, dynamic>) {
        throw ApiEnvelopeException(
          code: (data['code'] as num?)?.toInt() ?? status ?? -1,
          message: data['message'] as String? ?? error.message ?? '请求失败',
          requestId: data['requestId'] as String?,
          httpStatus: status,
        );
      }
      throw ApiEnvelopeException(
        code: status ?? -1,
        message: error.message ?? '网络异常',
        httpStatus: status,
      );
    }
  }

  T _unwrap<T>(
    Map<String, dynamic>? body,
    T Function(Object? data) parse,
    int? httpStatus,
  ) {
    if (body == null) {
      throw ApiEnvelopeException(
        code: -1,
        message: '空响应',
        httpStatus: httpStatus,
      );
    }
    final code = (body['code'] as num?)?.toInt() ?? -1;
    final message = body['message'] as String? ?? 'unknown';
    if (code != 0) {
      throw ApiEnvelopeException(
        code: code,
        message: message,
        requestId: body['requestId'] as String?,
        httpStatus: httpStatus ?? 200,
      );
    }
    return parse(body['data']);
  }
}
