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

  static final Uri githubUserUri = Uri.parse(
    'https://api.github.com/users/flutter',
  );
  static final Uri githubReposUri = Uri.parse(
    'https://api.github.com/orgs/flutter/repos?per_page=8&sort=updated',
  );
  static final Uri githubFailureUri = Uri.parse(
    'https://api.github.com/non-existent-flutter-monitor-path',
  );
  static final Uri postsUri = Uri.parse(
    'https://jsonplaceholder.typicode.com/posts?_limit=8',
  );
  static final Uri commentsUri = Uri.parse(
    'https://jsonplaceholder.typicode.com/comments?postId=1',
  );
  static final Uri httpFailureUri = Uri.parse(
    'https://jsonplaceholder.typicode.com/non-existent-path',
  );
  static final Uri timeoutUri = Uri.parse(
    'https://10.255.255.1/flutter-monitor-timeout',
  );
  static const testApiBaseUrl = String.fromEnvironment(
    'FM_TEST_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3700',
  );

  Future<GithubProfile> fetchGithubProfile() async {
    final response = await _dio.getUri<Map<String, dynamic>>(githubUserUri);
    final data = response.data;
    if (data == null) {
      throw StateError('GitHub profile response is empty');
    }
    return GithubProfile.fromJson(data);
  }

  Future<List<GithubRepo>> fetchGithubRepos() async {
    final response = await _dio.getUri<List<dynamic>>(githubReposUri);
    final data = response.data ?? const <dynamic>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(GithubRepo.fromJson)
        .toList(growable: false);
  }

  Future<List<DemoPost>> fetchPosts() async {
    final response = await _httpClient.get(postsUri);
    _throwForStatus(response.statusCode);
    final decoded = jsonDecode(response.body) as List<dynamic>;
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(DemoPost.fromJson)
        .toList(growable: false);
  }

  Future<List<DemoComment>> fetchComments() async {
    final response = await _httpClient.get(commentsUri);
    _throwForStatus(response.statusCode);
    final decoded = jsonDecode(response.body) as List<dynamic>;
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(DemoComment.fromJson)
        .toList(growable: false);
  }

  Future<void> fetchDioFailure() async {
    final response = await _dio.getUri<Object>(githubFailureUri);
    if ((response.statusCode ?? 0) >= 400) {
      throw StateError('HTTP ${response.statusCode}');
    }
  }

  Future<void> fetchHttpFailure() async {
    final response = await _httpClient.get(httpFailureUri);
    _throwForStatus(response.statusCode);
  }

  Future<void> fetchDioTimeout() async {
    await _dio.getUri<Object>(timeoutUri).timeout(const Duration(seconds: 3));
  }

  Future<void> fetchHttpTimeout() async {
    await _httpClient.get(timeoutUri).timeout(const Duration(seconds: 3));
  }

  Future<void> fetchLocalSlowWithDio() async {
    final uri = Uri.parse(
      '$testApiBaseUrl/api/test/slow?delayMs=1500&bytes=256',
    );
    final response = await _dio.getUri<Object>(uri);
    if ((response.statusCode ?? 0) >= 400) {
      throw StateError('HTTP ${response.statusCode}');
    }
  }

  Future<void> fetchLocalSlowWithHttp() async {
    final uri = Uri.parse(
      '$testApiBaseUrl/api/test/slow?delayMs=1500&bytes=256',
    );
    final response = await _httpClient.get(uri);
    _throwForStatus(response.statusCode);
  }

  void close() {
    _httpClient.close();
  }

  void _throwForStatus(int statusCode) {
    if (statusCode >= 400) {
      throw StateError('HTTP $statusCode');
    }
  }
}
