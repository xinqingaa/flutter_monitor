import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
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

  /// 创建受监控的 `package:http` client。
  ///
  /// [_inner] 是实际发起请求的业务 client，本类只负责在请求前后补充监控事件。
  MonitoredHttpClient(this._reporter, this._inner);

  /// 发送请求并在完成或异常时记录 `http.client` span。
  ///
  /// 该方法不会吞掉业务响应或异常；异常会在记录失败 span 后继续抛给调用方。
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final startTime = DateTime.now();

    try {
      final response = await _inner.send(request);
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);

      // 异步读取响应体大小，不阻塞主流程
      // 注意：这会消耗掉 response body stream，如果外部还需要读取，需要更复杂的处理。
      // 对于大多数监控场景，我们只关心元数据，所以这里可以简化。
      // final contentLength = response.contentLength; // 有时候 header 里没有
      final success = response.statusCode >= 200 && response.statusCode < 400;

      _reporter.recordHttpClient(
        url: request.url.toString(),
        method: request.method,
        statusCode: response.statusCode,
        durationMs: duration.inMilliseconds,
        success: success,
        errorType: success ? null : HttpErrorTypes.httpStatus,
        responseSizeBytes: response.contentLength,
        source: SignalSources.sdkHttp,
        startTime: startTime,
        endTime: endTime,
        payload: const <String, Object?>{
          PayloadKeys.httpSource: HttpPayloadSources.packageHttp,
        },
      );

      return response;
    } catch (e) {
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);
      _reporter.recordHttpClient(
        url: request.url.toString(),
        method: request.method,
        durationMs: duration.inMilliseconds,
        success: false,
        error: e.toString(),
        source: SignalSources.sdkHttp,
        startTime: startTime,
        endTime: endTime,
        payload: const <String, Object?>{
          PayloadKeys.httpSource: HttpPayloadSources.packageHttp,
        },
      );
      // 必须把异常重新抛出，让调用方能正确处理
      rethrow;
    }
  }

  /// 关闭底层业务 client。
  @override
  void close() {
    _inner.close();
  }
}
