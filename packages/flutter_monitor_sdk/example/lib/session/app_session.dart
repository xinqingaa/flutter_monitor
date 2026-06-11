class AppSession {
  AppSession._();

  static String? userId;

  static void setUserId(String value) => userId = value;

  static void clearUser() => userId = null;
}
