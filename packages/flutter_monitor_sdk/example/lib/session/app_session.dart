class AppSession {
  AppSession._();

  static String? userId;
  static String? token;
  static String? displayName;
  static String? tier;

  static bool get isLoggedIn =>
      token != null && token!.isNotEmpty && userId != null && userId!.isNotEmpty;

  static void applyLogin({
    required String userId,
    required String token,
    required String displayName,
    required String tier,
  }) {
    AppSession.userId = userId;
    AppSession.token = token;
    AppSession.displayName = displayName;
    AppSession.tier = tier;
  }

  static void clear() {
    userId = null;
    token = null;
    displayName = null;
    tier = null;
  }

  @Deprecated('Use clear')
  static void clearUser() => clear();

  @Deprecated('Use applyLogin')
  static void setUserId(String value) => userId = value;
}
