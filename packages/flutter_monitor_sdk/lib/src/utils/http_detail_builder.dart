import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_monitor_core/flutter_monitor_core.dart';

import '../core/monitor_config.dart';

/// 已在流式消费过程中捕获的 body。
///
/// 用于 `StreamedResponse` 等无法整体持有的 body：只缓冲前 N 字节，
/// 但 [originalLength] 与 [sha256Hex] 基于全文增量计算。
class CapturedHttpBody {
  const CapturedHttpBody({
    required this.bytes,
    required this.originalLength,
    required this.sha256Hex,
  });

  /// 缓冲的前缀字节（可能已截断）。
  final List<int> bytes;

  /// 全文字节长度。
  final int originalLength;

  /// 全文 SHA-256。
  final String sha256Hex;

  bool get truncated => originalLength > bytes.length;
}

/// 组装 `http.client` 的详情层 payload section。
///
/// 输出形如：
///
/// ```json
/// {
///   "http.query": {"id": "1"},
///   "http.detail": {
///     "request": {"headers": {...}, "body": "...", "body_truncated": false,
///                 "body_original_length": 12, "body_sha256": "..."},
///     "response": {"headers": {...}, "body_format": "binary",
///                  "body_original_length": 128, "body_sha256": "..."}
///   }
/// }
/// ```
///
/// 文本 body 超过 [maxBodyBytes] 时按字节截断，保留原始长度与全文 SHA-256。
/// 二进制 body 不落文本，只保留格式、content-type、长度和 hash。
/// 配置了 redactor 时在最终组装后调用；redactor 返回 null 表示丢弃详情层。
class HttpDetailBuilder {
  HttpDetailBuilder({required MonitorHttpConfig config, required String mode})
    : _config = config,
      _maxBodyBytes = config.effectiveMaxBodyBytes(mode);

  final MonitorHttpConfig _config;
  final int _maxBodyBytes;

  /// 构建详情层 section。返回的 map 直接 merge 进事件 payload；
  /// 没有可采集内容时返回空 map。
  Map<String, Object?> build({
    Uri? uri,
    Map<String, String>? requestHeaders,
    Object? requestBody,
    Map<String, String>? responseHeaders,
    Object? responseBody,
  }) {
    final section = <String, Object?>{};

    if (_config.captureQuery) {
      final query = uri?.queryParameters;
      if (query != null && query.isNotEmpty) {
        section[PayloadKeys.httpQuery] = Map<String, Object?>.from(query);
      }
    }

    final detail = <String, Object?>{};
    final request = _side(
      headers: requestHeaders,
      body: _config.captureRequestBody ? requestBody : null,
    );
    if (request.isNotEmpty) detail[PayloadKeys.request] = request;
    final response = _side(
      headers: responseHeaders,
      body: _config.captureResponseBody ? responseBody : null,
    );
    if (response.isNotEmpty) detail[PayloadKeys.response] = response;
    if (detail.isNotEmpty) section[PayloadKeys.httpDetail] = detail;

    if (section.isEmpty) return section;
    final redactor = _config.redactor;
    if (redactor == null) return section;
    return redactor(section) ?? const <String, Object?>{};
  }

  Map<String, Object?> _side({Map<String, String>? headers, Object? body}) {
    final side = <String, Object?>{};
    if (_config.captureHeaders && headers != null && headers.isNotEmpty) {
      side[PayloadKeys.headers] = Map<String, Object?>.from(headers);
    }
    final contentType = _contentType(headers);
    if (body is CapturedHttpBody) {
      if (body.originalLength > 0) {
        final visible = body.bytes.length > _maxBodyBytes
            ? body.bytes.sublist(0, _maxBodyBytes)
            : body.bytes;
        if (_shouldTreatAsBinary(contentType, body.bytes)) {
          side[PayloadKeys.bodyFormat] = 'binary';
          if (contentType != null)
            side[PayloadKeys.bodyContentType] = contentType;
          side[PayloadKeys.bodyTruncated] =
              body.truncated || body.originalLength > visible.length;
          side[PayloadKeys.bodyOriginalLength] = body.originalLength;
          side[PayloadKeys.bodySha256] = body.sha256Hex;
          return side;
        }
        side[PayloadKeys.bodyFormat] = 'text';
        if (contentType != null)
          side[PayloadKeys.bodyContentType] = contentType;
        side[PayloadKeys.body] = utf8.decode(visible, allowMalformed: true);
        side[PayloadKeys.bodyTruncated] =
            body.truncated || body.originalLength > visible.length;
        side[PayloadKeys.bodyOriginalLength] = body.originalLength;
        side[PayloadKeys.bodySha256] = body.sha256Hex;
      }
      return side;
    }
    final bodyBytes = _bodyBytes(body);
    if (bodyBytes != null) {
      final truncated = bodyBytes.length > _maxBodyBytes;
      final visible = truncated
          ? bodyBytes.sublist(0, _maxBodyBytes)
          : bodyBytes;
      if (_shouldTreatAsBinary(contentType, bodyBytes)) {
        side[PayloadKeys.bodyFormat] = 'binary';
        if (contentType != null)
          side[PayloadKeys.bodyContentType] = contentType;
        side[PayloadKeys.bodyTruncated] = truncated;
        side[PayloadKeys.bodyOriginalLength] = bodyBytes.length;
        side[PayloadKeys.bodySha256] = sha256.convert(bodyBytes).toString();
        return side;
      }
      side[PayloadKeys.bodyFormat] = 'text';
      if (contentType != null) side[PayloadKeys.bodyContentType] = contentType;
      side[PayloadKeys.body] = utf8.decode(visible, allowMalformed: true);
      side[PayloadKeys.bodyTruncated] = truncated;
      side[PayloadKeys.bodyOriginalLength] = bodyBytes.length;
      side[PayloadKeys.bodySha256] = sha256.convert(bodyBytes).toString();
    }
    return side;
  }

  String? _contentType(Map<String, String>? headers) {
    if (headers == null) return null;
    for (final entry in headers.entries) {
      if (entry.key.toLowerCase() == 'content-type') {
        final value = entry.value.trim();
        return value.isEmpty ? null : value;
      }
    }
    return null;
  }

  bool _shouldTreatAsBinary(String? contentType, List<int> bytes) {
    if (bytes.isEmpty) return false;
    if (contentType != null) {
      final mime = contentType.split(';').first.trim().toLowerCase();
      if (mime.startsWith('text/')) return false;
      if (mime == 'application/json' ||
          mime.endsWith('+json') ||
          mime == 'application/xml' ||
          mime.endsWith('+xml') ||
          mime == 'application/x-www-form-urlencoded') {
        return false;
      }
      if (mime == 'application/octet-stream' ||
          mime == 'application/x-protobuf' ||
          mime == 'application/protobuf' ||
          mime == 'application/grpc' ||
          mime.startsWith('image/') ||
          mime.startsWith('audio/') ||
          mime.startsWith('video/') ||
          mime == 'application/zip' ||
          mime == 'application/gzip' ||
          mime == 'application/x-gzip' ||
          mime == 'application/pdf') {
        return true;
      }
    }
    final sample = bytes.length > 1024 ? bytes.sublist(0, 1024) : bytes;
    final controlCount = sample.where((byte) {
      return byte < 0x09 || (byte > 0x0D && byte < 0x20);
    }).length;
    return controlCount / sample.length > 0.05;
  }

  /// 把任意来源的 body（String / bytes / JSON 结构）转为字节序列。
  /// 不可序列化的对象退化为 toString。
  List<int>? _bodyBytes(Object? body) {
    if (body == null) return null;
    if (body is List<int>) return body;
    if (body is String) {
      return body.isEmpty ? null : utf8.encode(body);
    }
    if (body is Map || body is Iterable) {
      try {
        return utf8.encode(jsonEncode(body));
      } catch (_) {
        return utf8.encode(body.toString());
      }
    }
    return utf8.encode(body.toString());
  }
}

/// 去掉 query 与 fragment 的完整 URL，作为 `payload.url` 的事实层取值。
String urlWithoutQuery(String rawUrl) {
  return rawUrl.split('#').first.split('?').first;
}
