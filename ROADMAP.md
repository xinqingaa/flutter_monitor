# Flutter Monitor SDK - 发展路线图

本文档记录了 SDK 的待优化项目、功能规划和未来发展方向。

---

## 🔴 重要改进 (Should Fix)

### 1. 日期格式化性能优化
- **文件**: `lib/src/core/reporter.dart` (第 135-144 行)
- **问题**: 手动日期格式化效率较低
- **优化方案**: 使用 `intl` 包的 `DateFormat` 类
- **优先级**: 中
- **预计工作量**: 1 小时

```dart
// 当前实现
String _formatTimestamp(DateTime dateTime) {
  final year = dateTime.year.toString();
  final month = dateTime.month.toString().padLeft(2, '0');
  // ... 手动拼接
}

// 建议优化
import 'package:intl/intl.dart';
final _dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
String _formatTimestamp(DateTime dateTime) => _dateFormat.format(dateTime);
```

### 2. Zone 错误捕获增强
- **文件**: `lib/src/modules/error_monitor.dart`
- **问题**: 仅捕获 Flutter 和 Dart 错误，缺少 Zone 级别的错误捕获
- **优化方案**: 添加 runZonedGuarded 监听
- **优先级**: 高
- **预计工作量**: 2-3 小时

```dart
// 建议添加
void init() {
  // 现有的 FlutterError.onError 和 PlatformDispatcher.instance.onError

  // 添加 Zone 错误捕获
  runZonedGuarded(() {
    // 应用的主逻辑
  }, (error, stack) {
    _reportDartError(error, stack);
  });
}
```

### 3. HTTP 负载大小跟踪
- **文件**: `lib/src/modules/performance_monitor.dart`
- **问题**: 网络监控未记录请求和响应的 payload 大小
- **优化方案**: 在 Dio 拦截器和 HTTP 客户端中添加大小统计
- **优先级**: 中
- **预计工作量**: 2 小时

```dart
// 建议添加字段
'data': {
  'type': 'api',
  'request_size_bytes': requestBody.length,
  'response_size_bytes': response.contentLength,
  // ... 现有字段
}
```

### 4. 配置验证
- **文件**: `lib/src/core/monitor_config.dart`
- **问题**: 缺少配置参数的验证逻辑
- **优化方案**: 添加配置验证方法
- **优先级**: 中
- **预计工作量**: 2-3 小时

```dart
// 建议添加
class MonitorConfig {
  // 验证配置
  void validate() {
    if (appInfo.appKey.isEmpty) {
      throw ArgumentError('appKey 不能为空');
    }
    if (batchReportSize <= 0) {
      throw ArgumentError('batchReportSize 必须大于 0');
    }
    // 更多验证...
  }
}
```

---

## 🟡 功能增强 (Could Fix)

### 1. 增强设备信息收集
- **当前**: 仅收集基本信息（型号、版本等）
- **建议**: 添加以下信息
  - 内存使用情况（通过 `dart:io` 的 `ProcessInfo`）
  - CPU 核心数
  - 电池状态（需要插件）
  - 网络类型（WiFi/蜂窝网络）
- **优先级**: 中
- **预计工作量**: 4-5 小时

### 2. 性能采样率可配置
- **文件**: `lib/src/modules/jank_monitor.dart`
- **当前**: 采样率固定为每 3 帧
- **建议**: 根据设备性能动态调整采样率
- **优先级**: 低
- **预计工作量**: 2 小时

```dart
class JankConfig {
  final int samplingRate; // 新增配置项

  // 根据设备性能推荐采样率
  static int recommendSamplingRate(DevicePerformanceLevel level) {
    switch (level) {
      case DevicePerformanceLevel.high: return 2;
      case DevicePerformanceLevel.medium: return 3;
      case DevicePerformanceLevel.low: return 5;
    }
  }
}
```

### 3. 性能摘要和统计 API
- **文件**: `lib/src/core/reporter.dart`
- **建议**: 添加方法获取统计信息
- **优先级**: 中
- **预计工作量**: 3-4 小时

```dart
class Reporter {
  // 获取错误统计
  ErrorStats getErrorStats();

  // 获取性能摘要
  PerformanceSummary getPerformanceSummary();

  // 重置统计数据
  void resetStats();
}
```

### 4. 自定义文档注释
- **范围**: 所有公共 API
- **当前**: 部分文档注释不完整
- **建议**: 为所有公共类和方法添加详细的文档注释
- **优先级**: 中
- **预计工作量**: 6-8 小时

### 5. 示例代码改进
- **文件**: `example/` 目录
- **建议**:
  - 添加更多使用场景的示例
  - 修复 `use_build_context_synchronously` 警告
  - 移除示例代码中的 `print()` 语句
- **优先级**: 低
- **预计工作量**: 4 小时

---

## 🔒 安全改进

### 1. 敏感数据过滤
- **文件**: `lib/src/outputs/log_monitor_output.dart`, `lib/src/outputs/http_output.dart`
- **问题**: 可能记录敏感信息（密码、token 等）
- **建议**: 添加数据脱敏配置
- **优先级**: 高
- **预计工作量**: 3-4 小时

```dart
class MonitorConfig {
  // 敏感字段列表
  final List<String> sensitiveFields;

  // 敏感数据过滤器
  String filterSensitiveData(String key, dynamic value) {
    if (sensitiveFields.contains(key)) {
      return '***FILTERED***';
    }
    return value.toString();
  }
}
```

### 2. HTTPS 强制和证书固定
- **文件**: `lib/src/outputs/http_output.dart`
- **建议**:
  - 添加 HTTPS-only 模式
  - 支持证书固定 (Certificate Pinning)
- **优先级**: 高
- **预计工作量**: 5-6 小时

```dart
class HttpOutput {
  final bool enforceHttps; // 强制 HTTPS
  final String? certificateSha256; // 证书固定

  // 验证 URL 协议
  void _validateUrl(String url) {
    if (enforceHttps && !url.startsWith('https://')) {
      throw ArgumentError('仅允许 HTTPS URL');
    }
  }
}
```

---

## 🚀 未来功能规划

### 1. 离线缓存
- **描述**: 在网络不可用时缓存数据，恢复后重新上传
- **优先级**: 高
- **预计工作量**: 8-10 小时
- **技术方案**:
  - 使用 `shared_preferences` 或 `sqflite` 存储未发送的事件
  - 实现队列管理和重试机制
  - 添加存储上限和清理策略

### 2. 内存泄漏监控
- **描述**: 检测和报告潜在的内存泄漏
- **优先级**: 中
- **预计工作量**: 10-12 小时
- **技术方案**:
  - 定期采集内存快照
  - 分析对象生命周期
  - 报告持续增长的内存使用

### 3. 崩溃恢复
- **描述**: 应用崩溃后保留未发送的数据
- **优先级**: 中
- **预计工作量**: 6-8 小时
- **技术方案**:
  - 使用文件系统持久化关键数据
  - 应用重启后自动恢复

### 4. 自定义监控指标
- **描述**: 允许用户定义和监控自定义业务指标
- **优先级**: 低
- **预计工作量**: 8-10 小时
- **技术方案**:
  - 提供指标注册 API
  - 支持计数器、仪表盘、直方图等指标类型
  - 自动聚合和上报

### 5. Web 平台增强
- **描述**: 优化 Web 平台的监控体验
- **优先级**: 低
- **预计工作量**: 6-8 小时
- **改进内容**:
  - Web 特有的性能指标（FCP, LCP, CLS 等）
  - 浏览器兼容性优化
  - Web Worker 支持

### 6. 可视化仪表盘
- **描述**: 提供简单的数据可视化界面
- **优先级**: 低
- **预计工作量**: 20-30 小时
- **功能**:
  - 实时错误监控
  - 性能趋势图表
  - 用户行为热力图

---

## 📊 性能优化

### 1. 事件批处理优化
- **当前**: 批量大小固定
- **建议**: 根据网络状况动态调整批量大小
- **优先级**: 中
- **预计工作量**: 3-4 小时

### 2. 采样策略优化
- **建议**:
  - 高频事件自动降采样
  - 重要事件保证上报
  - 可配置的采样规则
- **优先级**: 中
- **预计工作量**: 5-6 小时

### 3. 内存优化
- **建议**:
  - 限制事件队列大小
  - 定期清理过期数据
  - 优化数据结构减少内存占用
- **优先级**: 中
- **预计工作量**: 4-5 小时

---

## 🧪 测试改进

### 1. 单元测试
- **当前**: 测试覆盖率几乎为 0
- **目标**: 达到 80% 以上的测试覆盖率
- **优先级**: 高
- **预计工作量**: 20-30 小时
- **测试范围**:
  - 所有核心模块的单元测试
  - 模拟各种错误场景
  - 边界条件测试

### 2. 集成测试
- **建议**: 添加端到端测试
- **优先级**: 中
- **预计工作量**: 10-15 小时

### 3. 性能测试
- **建议**: 添加性能基准测试
- **优先级**: 低
- **预计工作量**: 8-10 小时

---

## 📚 文档改进

### 1. API 文档
- **目标**: 完善所有公共 API 的文档注释
- **优先级**: 中
- **预计工作量**: 8-10 小时

### 2. 使用指南
- **建议**: 添加更多使用场景和最佳实践
- **优先级**: 中
- **预计工作量**: 6-8 小时

### 3. 故障排查指南
- **建议**: 添加常见问题和解决方案
- **优先级**: 低
- **预计工作量**: 4-6 小时

---

## 🔄 版本规划

### v1.1.0 (下一个版本)
- 重要改进 #1-4
- 安全改进 #1-2
- 测试改进 #1

### v1.2.0
- 功能增强 #1-3
- 性能优化

### v2.0.0
- 离线缓存
- 内存泄漏监控
- 自定义监控指标
- Web 平台增强

---

## 🤝 贡献指南

欢迎社区贡献！如果你想参与这些改进：

1. 在 GitHub Issues 中讨论你的计划
2. Fork 项目并创建分支
3. 编写代码和测试
4. 提交 Pull Request

详细的贡献指南请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)

---

**最后更新**: 2026-02-06
