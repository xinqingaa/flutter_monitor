import 'dart:async';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:flutter_monitor_sdk/src/core/reporter.dart';
import 'package:flutter_monitor_sdk/src/utils/http_detail_builder.dart';

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
  /// 启用响应体采集时，通过 tee 包装响应流，只缓冲前 N 字节，业务消费不受影响；
  /// 事件在响应流结束时发出，耗时语义仍为“到响应头”。
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final startTime = DateTime.now();
    final requestBinding = _reporter.currentHttpRequestBinding();
    final requestBody = request is http.Request && request.body.isNotEmpty
        ? request.bodyBytes
        : null;

    try {
      final response = await _inner.send(request);
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);
      final success = response.statusCode >= 200 && response.statusCode < 400;
      final completionBinding = _reporter.currentHttpCompletionBinding();

      void record({Object? responseBody}) {
        _reporter.recordHttpClient(
          url: request.url.toString(),
          method: request.method,
          statusCode: response.statusCode,
          durationMs: duration.inMilliseconds,
          success: success,
          errorType: success ? null : HttpErrorTypes.httpStatus,
          responseSizeBytes: response.contentLength,
          requestHeaders: request.headers.isEmpty ? null : request.headers,
          requestBody: requestBody,
          responseHeaders: response.headers.isEmpty ? null : response.headers,
          responseBody: responseBody,
          source: SignalSources.sdkHttp,
          startTime: startTime,
          endTime: endTime,
          requestBinding: requestBinding,
          completionBinding: completionBinding,
          payload: const <String, Object?>{
            PayloadKeys.httpSource: HttpPayloadSources.packageHttp,
          },
        );
      }

      if (!_reporter.httpConfig.captureResponseBody) {
        record();
        return response;
      }
      return _teeResponse(
        response,
        onBody: (bytes) => record(responseBody: bytes),
      );
    } catch (e) {
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);
      _reporter.recordHttpClient(
        url: request.url.toString(),
        method: request.method,
        durationMs: duration.inMilliseconds,
        success: false,
        error: e.toString(),
        requestHeaders: request.headers.isEmpty ? null : request.headers,
        requestBody: requestBody,
        source: SignalSources.sdkHttp,
        startTime: startTime,
        endTime: endTime,
        requestBinding: requestBinding,
        completionBinding: _reporter.currentHttpCompletionBinding(),
        payload: const <String, Object?>{
          PayloadKeys.httpSource: HttpPayloadSources.packageHttp,
        },
      );
      // 必须把异常重新抛出，让调用方能正确处理
      rethrow;
    }
  }

  /// tee 包装响应流：原样向业务转发数据，同时只缓冲前 N 字节用于监控；
  /// 全文长度和 SHA-256 增量计算，不额外占用内存。
  /// 流结束（done/error）时触发一次 [onBody]。
  http.StreamedResponse _teeResponse(
    http.StreamedResponse response, {
    required void Function(CapturedHttpBody body) onBody,
  }) {
    final maxBytes = _reporter.httpMaxBodyBytes;
    final buffer = <int>[];
    var totalLength = 0;
    final digestSink = _DigestCollector();
    final hashSink = sha256.startChunkedConversion(digestSink);
    var reported = false;

    void reportOnce() {
      if (reported) return;
      reported = true;
      hashSink.close();
      onBody(
        CapturedHttpBody(
          bytes: List<int>.unmodifiable(buffer),
          originalLength: totalLength,
          sha256Hex: digestSink.digest?.toString() ?? '',
        ),
      );
    }

    final teed = response.stream.transform<List<int>>(
      StreamTransformer<List<int>, List<int>>.fromHandlers(
        handleData: (chunk, sink) {
          totalLength += chunk.length;
          hashSink.add(chunk);
          if (buffer.length < maxBytes) {
            final remaining = maxBytes - buffer.length;
            buffer.addAll(
              chunk.length <= remaining ? chunk : chunk.sublist(0, remaining),
            );
          }
          sink.add(chunk);
        },
        handleError: (error, stackTrace, sink) {
          reportOnce();
          sink.addError(error, stackTrace);
        },
        handleDone: (sink) {
          reportOnce();
          sink.close();
        },
      ),
    );

    return http.StreamedResponse(
      http.ByteStream(teed),
      response.statusCode,
      contentLength: response.contentLength,
      request: response.request,
      headers: response.headers,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
      reasonPhrase: response.reasonPhrase,
    );
  }

  /// 关闭底层业务 client。
  @override
  void close() {
    _inner.close();
  }
}

class _DigestCollector implements Sink<Digest> {
  Digest? digest;

  @override
  void add(Digest data) {
    digest = data;
  }

  @override
  void close() {}
}
