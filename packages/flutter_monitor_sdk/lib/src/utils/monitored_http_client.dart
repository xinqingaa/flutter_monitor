import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_sdk/src/core/reporter.dart';

/// 一个实现了 http.BaseClient 的装饰器类，用于监控使用 `http` 包发出的网络请求。
///
/// 使用方法:
/// ```dart
/// final client = MonitoredHttpClient(
///   MonitorBinding.instance.reporter,
///   http.Client(), // 传入一个原始的 http client
/// );
///
/// // 使用这个 client 发起请求
/// client.get(Uri.parse('https://example.com'));
/// ```
class MonitoredHttpClient extends http.BaseClient {
  final Reporter _reporter;
  final http.Client _inner; // 被装饰的原始 client

  MonitoredHttpClient(this._reporter, this._inner);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final startTime = DateTime.now();

    try {
      final response = await _inner.send(request);
      final duration = DateTime.now().difference(startTime);

      // 异步读取响应体大小，不阻塞主流程
      // 注意：这会消耗掉 response body stream，如果外部还需要读取，需要更复杂的处理。
      // 对于大多数监控场景，我们只关心元数据，所以这里可以简化。
      // final contentLength = response.contentLength; // 有时候 header 里没有

      _reporter.addEvent('performance', {
        'type': 'api',
        'sub_type': 'http', // 标明来源
        'url': request.url.toString(),
        'method': request.method,
        'status': response.statusCode,
        'duration_ms': duration.inMilliseconds,
        'success': true,
      });

      return response;
    } catch (e) {
      final duration = DateTime.now().difference(startTime);
      _reporter.addEvent('performance', {
        'type': 'api',
        'sub_type': 'http', // 标明来源
        'url': request.url.toString(),
        'method': request.method,
        'status': null, // 请求失败，没有状态码
        'duration_ms': duration.inMilliseconds,
        'success': false,
        'error': e.toString(),
      });
      // 必须把异常重新抛出，让调用方能正确处理
      rethrow;
    }
  }

  @override
  void close() {
    _inner.close();
  }
}
