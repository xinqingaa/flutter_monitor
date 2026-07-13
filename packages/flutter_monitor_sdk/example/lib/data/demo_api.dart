import 'package:example/data/api_client.dart';
import 'package:example/models/pulse_models.dart';

class DemoApi {
  DemoApi(this._client);

  final ApiClient _client;

  static const _v1 = '/api/example/v1';

  void setToken(String? token) => _client.setToken(token);

  Future<BootstrapInfo> bootstrap() {
    return _client.get(
      '$_v1/bootstrap',
      parse: (data) => BootstrapInfo.fromJson(_asMap(data)),
    );
  }

  Future<AuthOptions> authOptions() {
    return _client.get(
      '$_v1/auth/options',
      parse: (data) => AuthOptions.fromJson(_asMap(data)),
    );
  }

  Future<LoginResult> login(String userId) {
    return _client.post(
      '$_v1/auth/login',
      body: <String, Object?>{'userId': userId, 'device': 'pulsefit_flutter'},
      parse: (data) => LoginResult.fromJson(_asMap(data)),
    );
  }

  Future<void> logout() {
    return _client.post('$_v1/auth/logout', parse: (_) {});
  }

  Future<HomeDashboard> dashboard() {
    return _client.get(
      '$_v1/home/dashboard',
      parse: (data) => HomeDashboard.fromJson(_asMap(data)),
    );
  }

  Future<List<RecommendItem>> recommendations() {
    return _client.get(
      '$_v1/home/recommendations',
      parse: (data) {
        final map = _asMap(data);
        final items = map['items'];
        if (items is! List) return const <RecommendItem>[];
        return items
            .whereType<Map<String, dynamic>>()
            .map(RecommendItem.fromJson)
            .toList(growable: false);
      },
    );
  }

  Future<List<WorkoutSummary>> workouts() {
    return _client.get(
      '$_v1/workouts',
      parse: (data) {
        final items = _asMap(data)['items'];
        if (items is! List) return const <WorkoutSummary>[];
        return items
            .whereType<Map<String, dynamic>>()
            .map(WorkoutSummary.fromJson)
            .toList(growable: false);
      },
    );
  }

  Future<WorkoutDetail> workoutDetail(String id) {
    return _client.get(
      '$_v1/workouts/$id',
      parse: (data) => WorkoutDetail.fromJson(_asMap(data)),
    );
  }

  Future<WorkoutSession> startWorkout(String id) {
    return _client.post(
      '$_v1/workouts/$id/start',
      parse: (data) => WorkoutSession.fromJson(_asMap(data)),
    );
  }

  Future<WorkoutCompleteResult> completeWorkout({
    required String id,
    required String sessionId,
  }) {
    return _client.post(
      '$_v1/workouts/$id/complete',
      body: <String, Object?>{'sessionId': sessionId},
      parse: (data) => WorkoutCompleteResult.fromJson(_asMap(data)),
    );
  }

  Future<void> checkin(String id) {
    return _client.post('$_v1/workouts/$id/checkin', parse: (_) {});
  }

  Future<({List<CourseSummary> items, List<String> categories})> courses({
    String? category,
  }) {
    return _client.get(
      '$_v1/courses',
      query: category == null ? null : <String, dynamic>{'category': category},
      parse: (data) {
        final map = _asMap(data);
        final items = map['items'];
        final list = items is List
            ? items
                  .whereType<Map<String, dynamic>>()
                  .map(CourseSummary.fromJson)
                  .toList(growable: false)
            : const <CourseSummary>[];
        final categories = map['categories'];
        return (
          items: list,
          categories: categories is List
              ? categories.whereType<String>().toList(growable: false)
              : const <String>[],
        );
      },
    );
  }

  Future<CourseDetail> courseDetail(String id) {
    return _client.get(
      '$_v1/courses/$id',
      parse: (data) => CourseDetail.fromJson(_asMap(data)),
    );
  }

  Future<CoachProfile> coach(String id) {
    return _client.get(
      '$_v1/coaches/$id',
      parse: (data) => CoachProfile.fromJson(_asMap(data)),
    );
  }

  Future<BookingResult> bookCourse(String id) {
    return _client.post(
      '$_v1/courses/$id/book',
      parse: (data) => BookingResult.fromJson(_asMap(data)),
    );
  }

  Future<VitalLatest> vitalsLatest() {
    return _client.get(
      '$_v1/vitals/latest',
      parse: (data) => VitalLatest.fromJson(_asMap(data)),
    );
  }

  Future<List<VitalHistoryItem>> vitalsHistory() {
    return _client.get(
      '$_v1/vitals/history',
      parse: (data) {
        final items = _asMap(data)['items'];
        if (items is! List) return const <VitalHistoryItem>[];
        return items
            .whereType<Map<String, dynamic>>()
            .map(VitalHistoryItem.fromJson)
            .toList(growable: false);
      },
    );
  }

  Future<void> submitVital({
    required double weightKg,
    int? restingHr,
    double? sleepHours,
  }) {
    return _client.post(
      '$_v1/vitals',
      body: <String, Object?>{
        'weightKg': weightKg,
        'restingHr': restingHr,
        'sleepHours': sleepHours,
      },
      parse: (_) {},
    );
  }

  Future<MembershipInfo> membership() {
    return _client.get(
      '$_v1/membership',
      parse: (data) => MembershipInfo.fromJson(_asMap(data)),
    );
  }

  Future<void> orderMembership(String planId) {
    return _client.post(
      '$_v1/membership/orders',
      body: <String, Object?>{'planId': planId},
      parse: (_) {},
    );
  }

  Future<MeProfile> me() {
    return _client.get(
      '$_v1/me',
      parse: (data) => MeProfile.fromJson(_asMap(data)),
    );
  }

  Future<void> updateProfile({required String name, required String city}) {
    return _client.put(
      '$_v1/me/profile',
      body: <String, Object?>{'name': name, 'city': city},
      parse: (_) {},
    );
  }

  Future<void> updateGoals({
    required int steps,
    required int activeMin,
    required int workoutsPerWeek,
  }) {
    return _client.put(
      '$_v1/me/goals',
      body: <String, Object?>{
        'steps': steps,
        'activeMin': activeMin,
        'workoutsPerWeek': workoutsPerWeek,
      },
      parse: (_) {},
    );
  }

  Future<List<NoticeItem>> notices() {
    return _client.get(
      '$_v1/notices',
      parse: (data) {
        final items = _asMap(data)['items'];
        if (items is! List) return const <NoticeItem>[];
        return items
            .whereType<Map<String, dynamic>>()
            .map(NoticeItem.fromJson)
            .toList(growable: false);
      },
    );
  }

  Future<void> labSlow() => _client.get('$_v1/lab/slow', parse: (_) {});

  Future<void> labNotFound() =>
      _client.get('$_v1/lab/not-found', parse: (_) {});

  Future<void> labUnavailable() =>
      _client.get('$_v1/lab/unavailable', parse: (_) {});
}

Map<String, dynamic> _asMap(Object? data) {
  if (data is Map<String, dynamic>) return data;
  throw ApiEnvelopeException(code: -1, message: 'data 不是对象');
}
