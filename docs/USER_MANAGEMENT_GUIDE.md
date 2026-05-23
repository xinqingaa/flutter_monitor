# 用户管理功能使用指南

## 🎯 功能概述

现在监控SDK支持动态用户管理，用户可以在运行时登录、切换账号、登出，所有监控数据都会自动关联到当前用户。

## 🚀 核心功能

### 1. **动态设置用户信息**
```dart
// 设置完整用户信息
FlutterMonitorSDK.instance.setUserInfo(
  const UserInfo(
    userId: "user_123",
    userType: "premium",
    userTags: ["vip", "beta"],
    userProperties: {
      "age": 25,
      "city": "Beijing",
      "subscription": "premium"
    }
  )
);
```

### 2. **简单设置用户ID**
```dart
// 只设置用户ID（最简单的方式）
FlutterMonitorSDK.instance.setUserId("user_123");
```

### 3. **设置自定义数据**
```dart
// 设置会话相关的自定义数据
FlutterMonitorSDK.instance.setCustomData({
  'sessionId': 'session_${DateTime.now().millisecondsSinceEpoch}',
  'featureFlags': ['new_ui', 'beta_features'],
  'appVersion': '1.0.0',
  'deviceType': 'mobile',
});
```

### 4. **清除用户信息**
```dart
// 用户登出时清除信息
FlutterMonitorSDK.instance.clearUserInfo();

// 清除自定义数据
FlutterMonitorSDK.instance.clearCustomData();
```

## 📊 数据优先级

### 用户信息优先级
1. **运行时用户信息** (`_runtimeUserInfo`) - 最高优先级
2. **配置中的用户信息** (`_config.userInfo`) - 默认值

### 自定义数据优先级
1. **运行时自定义数据** (`_runtimeCustomData`) - 最高优先级
2. **配置中的自定义数据** (`_config.customData`) - 默认值

## 🔄 典型使用场景

### 场景1: 用户登录
```dart
// 用户登录成功后
void onUserLogin(User user) {
  FlutterMonitorSDK.instance.setUserInfo(
    UserInfo(
      userId: user.id,
      userType: user.type,
      userTags: user.tags,
      userProperties: {
        'email': user.email,
        'registrationDate': user.registrationDate,
        'lastLogin': DateTime.now().toIso8601String(),
      }
    )
  );
  
  // 设置会话数据
  FlutterMonitorSDK.instance.setCustomData({
    'sessionId': generateSessionId(),
    'loginTime': DateTime.now().toIso8601String(),
    'deviceInfo': getDeviceInfo(),
  });
}
```

### 场景2: 用户切换账号
```dart
// 用户切换账号
void onUserSwitch(User newUser) {
  // 先清除旧用户信息
  FlutterMonitorSDK.instance.clearUserInfo();
  
  // 设置新用户信息
  FlutterMonitorSDK.instance.setUserInfo(
    UserInfo(
      userId: newUser.id,
      userType: newUser.type,
      userTags: newUser.tags,
    )
  );
  
  // 更新会话数据
  FlutterMonitorSDK.instance.setCustomData({
    'sessionId': generateSessionId(),
    'switchTime': DateTime.now().toIso8601String(),
    'previousUserId': oldUser.id,
  });
}
```

### 场景3: 用户登出
```dart
// 用户登出
void onUserLogout() {
  FlutterMonitorSDK.instance.clearUserInfo();
  FlutterMonitorSDK.instance.clearCustomData();
  
  // 可选：设置匿名用户信息
  FlutterMonitorSDK.instance.setUserId("anonymous_${DateTime.now().millisecondsSinceEpoch}");
}
```

### 场景4: 更新用户属性
```dart
// 用户属性发生变化时
void onUserProfileUpdate(User user) {
  FlutterMonitorSDK.instance.setUserInfo(
    UserInfo(
      userId: user.id,
      userType: user.type,
      userTags: user.tags,
      userProperties: {
        'email': user.email,
        'name': user.name,
        'avatar': user.avatar,
        'lastUpdate': DateTime.now().toIso8601String(),
      }
    )
  );
}
```

## 📈 上报数据结构

### 用户信息字段
```json
{
  "userInfo": {
    "userId": "user_123",
    "userType": "premium",
    "userTags": ["vip", "beta"],
    "userProperties": {
      "age": 25,
      "city": "Beijing",
      "subscription": "premium"
    }
  }
}
```

### 自定义数据字段
```json
{
  "customData": {
    "sessionId": "session_1703123456789",
    "featureFlags": ["new_ui", "beta_features"],
    "appVersion": "1.0.0",
    "deviceType": "mobile"
  }
}
```

## 🎯 最佳实践

### 1. **登录时设置完整信息**
```dart
void login(String userId, String userType) {
  FlutterMonitorSDK.instance.setUserInfo(
    UserInfo(
      userId: userId,
      userType: userType,
      userTags: ['authenticated'],
      userProperties: {
        'loginTime': DateTime.now().toIso8601String(),
        'loginMethod': 'email',
      }
    )
  );
}
```

### 2. **登出时清除信息**
```dart
void logout() {
  FlutterMonitorSDK.instance.clearUserInfo();
  FlutterMonitorSDK.instance.clearCustomData();
}
```

### 3. **定期更新会话数据**
```dart
void updateSessionData() {
  FlutterMonitorSDK.instance.setCustomData({
    'lastActivity': DateTime.now().toIso8601String(),
    'sessionDuration': getSessionDuration(),
    'appState': getAppState(),
  });
}
```

### 4. **错误处理**
```dart
void safeSetUserInfo(UserInfo userInfo) {
  try {
    FlutterMonitorSDK.instance.setUserInfo(userInfo);
  } catch (e) {
    print('Failed to set user info: $e');
    // 降级处理：只设置用户ID
    FlutterMonitorSDK.instance.setUserId(userInfo.userId ?? 'unknown');
  }
}
```

## 🔧 技术实现

### 运行时状态管理
- `_runtimeUserInfo`: 运行时用户信息（可动态更新）
- `_runtimeCustomData`: 运行时自定义数据（可动态更新）
- 优先级：运行时数据 > 配置数据

### 数据一致性
- 所有监控事件都会自动包含最新的用户信息
- 用户信息更新后，后续事件立即生效
- 支持用户切换，数据不会混乱

现在你的监控SDK支持完整的用户生命周期管理了！🎉
