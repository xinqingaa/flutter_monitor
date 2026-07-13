class BootstrapInfo {
  const BootstrapInfo({
    required this.appName,
    required this.release,
    required this.featureFlags,
  });

  final String appName;
  final String release;
  final List<String> featureFlags;

  factory BootstrapInfo.fromJson(Map<String, dynamic> json) {
    return BootstrapInfo(
      appName: json['appName'] as String? ?? 'PulseFit',
      release: json['release'] as String? ?? '-',
      featureFlags: _strings(json['featureFlags']),
    );
  }
}

class AuthOptions {
  const AuthOptions({required this.notice, required this.supportContact});

  final String notice;
  final String supportContact;

  factory AuthOptions.fromJson(Map<String, dynamic> json) {
    return AuthOptions(
      notice: json['notice'] as String? ?? '请输入 userId',
      supportContact: json['supportContact'] as String? ?? '-',
    );
  }
}

class LoginResult {
  const LoginResult({
    required this.token,
    required this.userId,
    required this.name,
    required this.tier,
  });

  final String token;
  final String userId;
  final String name;
  final String tier;

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    final user = _map(json['user']);
    return LoginResult(
      token: json['token'] as String? ?? '',
      userId: user['userId'] as String? ?? '',
      name: user['name'] as String? ?? '用户',
      tier: user['tier'] as String? ?? 'free',
    );
  }
}

class HomeDashboard {
  const HomeDashboard({
    required this.greeting,
    required this.userName,
    required this.tier,
    required this.steps,
    required this.stepsGoal,
    required this.activeMin,
    required this.activeGoal,
    required this.kcal,
    required this.streakDays,
    required this.nextWorkoutId,
  });

  final String greeting;
  final String userName;
  final String tier;
  final int steps;
  final int stepsGoal;
  final int activeMin;
  final int activeGoal;
  final int kcal;
  final int streakDays;
  final String nextWorkoutId;

  factory HomeDashboard.fromJson(Map<String, dynamic> json) {
    final today = _map(json['today']);
    final user = _map(json['user']);
    return HomeDashboard(
      greeting: json['greeting'] as String? ?? '你好',
      userName: user['name'] as String? ?? '用户',
      tier: user['tier'] as String? ?? 'free',
      steps: _int(today['steps']),
      stepsGoal: _int(today['stepsGoal'], fallback: 8000),
      activeMin: _int(today['activeMin']),
      activeGoal: _int(today['activeGoal'], fallback: 45),
      kcal: _int(today['kcal']),
      streakDays: _int(json['streakDays']),
      nextWorkoutId: json['nextWorkoutId'] as String? ?? '',
    );
  }
}

class RecommendItem {
  const RecommendItem({
    required this.type,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.tone,
  });

  final String type;
  final String id;
  final String title;
  final String subtitle;
  final String tone;

  factory RecommendItem.fromJson(Map<String, dynamic> json) {
    return RecommendItem(
      type: json['type'] as String? ?? '',
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      tone: json['tone'] as String? ?? 'teal',
    );
  }
}

class WorkoutSummary {
  const WorkoutSummary({
    required this.id,
    required this.title,
    required this.level,
    required this.durationMin,
    required this.kcal,
    required this.coverTone,
    required this.focus,
    required this.description,
  });

  final String id;
  final String title;
  final String level;
  final int durationMin;
  final int kcal;
  final String coverTone;
  final List<String> focus;
  final String description;

  factory WorkoutSummary.fromJson(Map<String, dynamic> json) {
    return WorkoutSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      level: json['level'] as String? ?? '',
      durationMin: _int(json['durationMin']),
      kcal: _int(json['kcal']),
      coverTone: json['coverTone'] as String? ?? 'teal',
      focus: _strings(json['focus']),
      description: json['description'] as String? ?? '',
    );
  }
}

class WorkoutDetail extends WorkoutSummary {
  const WorkoutDetail({
    required super.id,
    required super.title,
    required super.level,
    required super.durationMin,
    required super.kcal,
    required super.coverTone,
    required super.focus,
    required super.description,
    required this.segments,
    required this.checkedInToday,
  });

  final List<WorkoutSegment> segments;
  final bool checkedInToday;

  factory WorkoutDetail.fromJson(Map<String, dynamic> json) {
    final base = WorkoutSummary.fromJson(json);
    final rawSegments = json['segments'];
    final segments = <WorkoutSegment>[];
    if (rawSegments is List) {
      for (final item in rawSegments) {
        if (item is Map<String, dynamic>) {
          segments.add(WorkoutSegment.fromJson(item));
        }
      }
    }
    return WorkoutDetail(
      id: base.id,
      title: base.title,
      level: base.level,
      durationMin: base.durationMin,
      kcal: base.kcal,
      coverTone: base.coverTone,
      focus: base.focus,
      description: base.description,
      segments: segments,
      checkedInToday: json['checkedInToday'] == true,
    );
  }
}

class WorkoutSegment {
  const WorkoutSegment({required this.name, required this.minutes});

  final String name;
  final int minutes;

  factory WorkoutSegment.fromJson(Map<String, dynamic> json) {
    return WorkoutSegment(
      name: json['name'] as String? ?? '',
      minutes: _int(json['minutes']),
    );
  }
}

class WorkoutSession {
  const WorkoutSession({
    required this.sessionId,
    required this.workoutId,
    required this.title,
    required this.startedAt,
  });

  final String sessionId;
  final String workoutId;
  final String title;
  final String startedAt;

  factory WorkoutSession.fromJson(Map<String, dynamic> json) {
    return WorkoutSession(
      sessionId: json['sessionId'] as String? ?? '',
      workoutId: json['workoutId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      startedAt: json['startedAt'] as String? ?? '',
    );
  }
}

class WorkoutCompleteResult {
  const WorkoutCompleteResult({
    required this.kcal,
    required this.durationMin,
    required this.badge,
  });

  final int kcal;
  final int durationMin;
  final String badge;

  factory WorkoutCompleteResult.fromJson(Map<String, dynamic> json) {
    return WorkoutCompleteResult(
      kcal: _int(json['kcal']),
      durationMin: _int(json['durationMin']),
      badge: json['badge'] as String? ?? '完成',
    );
  }
}

class CourseSummary {
  const CourseSummary({
    required this.id,
    required this.title,
    required this.category,
    required this.seatsLeft,
    required this.price,
    required this.coachId,
    required this.startAt,
    required this.durationMin,
    required this.coverTone,
    required this.summary,
  });

  final String id;
  final String title;
  final String category;
  final int seatsLeft;
  final int price;
  final String coachId;
  final String startAt;
  final int durationMin;
  final String coverTone;
  final String summary;

  factory CourseSummary.fromJson(Map<String, dynamic> json) {
    return CourseSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? '',
      seatsLeft: _int(json['seatsLeft']),
      price: _int(json['price']),
      coachId: json['coachId'] as String? ?? '',
      startAt: json['startAt'] as String? ?? '',
      durationMin: _int(json['durationMin']),
      coverTone: json['coverTone'] as String? ?? 'teal',
      summary: json['summary'] as String? ?? '',
    );
  }
}

class CourseDetail extends CourseSummary {
  const CourseDetail({
    required super.id,
    required super.title,
    required super.category,
    required super.seatsLeft,
    required super.price,
    required super.coachId,
    required super.startAt,
    required super.durationMin,
    required super.coverTone,
    required super.summary,
    required this.coachName,
    required this.coachTitle,
  });

  final String coachName;
  final String coachTitle;

  factory CourseDetail.fromJson(Map<String, dynamic> json) {
    final base = CourseSummary.fromJson(json);
    final coach = _map(json['coach']);
    return CourseDetail(
      id: base.id,
      title: base.title,
      category: base.category,
      seatsLeft: base.seatsLeft,
      price: base.price,
      coachId: base.coachId,
      startAt: base.startAt,
      durationMin: base.durationMin,
      coverTone: base.coverTone,
      summary: base.summary,
      coachName: coach['name'] as String? ?? '',
      coachTitle: coach['title'] as String? ?? '',
    );
  }
}

class CoachProfile {
  const CoachProfile({
    required this.id,
    required this.name,
    required this.title,
    required this.years,
    required this.rating,
    required this.tags,
    required this.bio,
    required this.courseIds,
  });

  final String id;
  final String name;
  final String title;
  final int years;
  final double rating;
  final List<String> tags;
  final String bio;
  final List<String> courseIds;

  factory CoachProfile.fromJson(Map<String, dynamic> json) {
    final courses = json['courses'];
    final ids = <String>[];
    if (courses is List) {
      for (final item in courses) {
        if (item is Map && item['id'] is String) ids.add(item['id'] as String);
      }
    }
    return CoachProfile(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      title: json['title'] as String? ?? '',
      years: _int(json['years']),
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      tags: _strings(json['tags']),
      bio: json['bio'] as String? ?? '',
      courseIds: ids,
    );
  }
}

class BookingResult {
  const BookingResult({
    required this.bookingId,
    required this.courseId,
    required this.startAt,
    required this.status,
  });

  final String bookingId;
  final String courseId;
  final String startAt;
  final String status;

  factory BookingResult.fromJson(Map<String, dynamic> json) {
    return BookingResult(
      bookingId: json['bookingId'] as String? ?? '',
      courseId: json['courseId'] as String? ?? '',
      startAt: json['startAt'] as String? ?? '',
      status: json['status'] as String? ?? '',
    );
  }
}

class VitalLatest {
  const VitalLatest({
    required this.measuredAt,
    required this.weightKg,
    required this.restingHr,
    required this.sleepHours,
    required this.mood,
  });

  final String measuredAt;
  final double weightKg;
  final int restingHr;
  final double sleepHours;
  final String mood;

  factory VitalLatest.fromJson(Map<String, dynamic> json) {
    return VitalLatest(
      measuredAt: json['measuredAt'] as String? ?? '',
      weightKg: (json['weightKg'] as num?)?.toDouble() ?? 0,
      restingHr: _int(json['restingHr']),
      sleepHours: (json['sleepHours'] as num?)?.toDouble() ?? 0,
      mood: json['mood'] as String? ?? 'ok',
    );
  }
}

class VitalHistoryItem {
  const VitalHistoryItem({
    required this.date,
    required this.weightKg,
    required this.restingHr,
    required this.sleepHours,
  });

  final String date;
  final double weightKg;
  final int restingHr;
  final double sleepHours;

  factory VitalHistoryItem.fromJson(Map<String, dynamic> json) {
    return VitalHistoryItem(
      date: json['date'] as String? ?? '',
      weightKg: (json['weightKg'] as num?)?.toDouble() ?? 0,
      restingHr: _int(json['restingHr']),
      sleepHours: (json['sleepHours'] as num?)?.toDouble() ?? 0,
    );
  }
}

class MembershipInfo {
  const MembershipInfo({
    required this.tier,
    required this.expiresAt,
    required this.benefits,
    required this.plans,
  });

  final String tier;
  final String? expiresAt;
  final List<String> benefits;
  final List<MemberPlan> plans;

  factory MembershipInfo.fromJson(Map<String, dynamic> json) {
    final plans = <MemberPlan>[];
    final raw = json['plans'];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) plans.add(MemberPlan.fromJson(item));
      }
    }
    return MembershipInfo(
      tier: json['tier'] as String? ?? 'free',
      expiresAt: json['expiresAt'] as String?,
      benefits: _strings(json['benefits']),
      plans: plans,
    );
  }
}

class MemberPlan {
  const MemberPlan({
    required this.id,
    required this.name,
    required this.price,
    required this.period,
  });

  final String id;
  final String name;
  final int price;
  final String period;

  factory MemberPlan.fromJson(Map<String, dynamic> json) {
    return MemberPlan(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      price: _int(json['price']),
      period: json['period'] as String? ?? '',
    );
  }
}

class MeProfile {
  const MeProfile({
    required this.userId,
    required this.name,
    required this.tier,
    required this.city,
    required this.stepsGoal,
    required this.activeMinGoal,
    required this.workoutsPerWeek,
  });

  final String userId;
  final String name;
  final String tier;
  final String city;
  final int stepsGoal;
  final int activeMinGoal;
  final int workoutsPerWeek;

  factory MeProfile.fromJson(Map<String, dynamic> json) {
    final user = _map(json['user']);
    final goals = _map(json['goals']);
    return MeProfile(
      userId: user['userId'] as String? ?? '',
      name: user['name'] as String? ?? '',
      tier: user['tier'] as String? ?? 'free',
      city: user['city'] as String? ?? '',
      stepsGoal: _int(goals['steps'], fallback: 8000),
      activeMinGoal: _int(goals['activeMin'], fallback: 45),
      workoutsPerWeek: _int(goals['workoutsPerWeek'], fallback: 4),
    );
  }
}

class NoticeItem {
  const NoticeItem({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.read,
  });

  final String id;
  final String title;
  final String body;
  final String createdAt;
  final bool read;

  factory NoticeItem.fromJson(Map<String, dynamic> json) {
    return NoticeItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      read: json['read'] == true,
    );
  }
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  return <String, dynamic>{};
}

List<String> _strings(Object? value) {
  if (value is! List) return const <String>[];
  return value.whereType<String>().toList(growable: false);
}

int _int(Object? value, {int fallback = 0}) {
  if (value is num) return value.toInt();
  return fallback;
}
