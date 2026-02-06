# Flutter Monitor SDK - API 协议文档

本文档详细描述了 Flutter Monitor SDK 与后端服务器之间的数据交互协议。

---

## 目录

- [概述](#概述)
- [请求格式](#请求格式)
- [事件类型](#事件类型)
- [数据结构](#数据结构)
- [错误处理](#错误处理)
- [安全规范](#安全规范)
- [示例](#示例)

---

## 概述

### 通信方式

- **协议**: HTTP/HTTPS
- **方法**: POST
- **Content-Type**: application/json
- **编码**: UTF-8

### 数据上报策略

SDK 支持三种上报策略：

1. **批量上报**: 当队列中事件数量达到 `batchReportSize`（默认 10）时触发
2. **定时上报**: 每隔 `periodicReportDuration`（默认 20 秒）触发
3. **应用退出上报**: 应用进入后台或关闭时触发

---

## 请求格式

### 请求 URL

```
POST https://your-domain.com/api/monitor/report
```

### 请求头

| Header | 值 | 必需 | 描述 |
|--------|-----|------|------|
| Content-Type | application/json | 是 | 内容类型 |
| User-Agent | FlutterMonitorSDK/1.0.0 | 否 | SDK 版本信息 |
| X-App-Key | {appKey} | 是 | 应用唯一标识 |
| X-App-Version | {appVersion} | 否 | 应用版本号 |
| X-Device-ID | {deviceId} | 否 | 设备唯一标识 |

### 请求体结构

```json
{
  "events": [
    {
      "category": "string",
      "data": { object },
      "timestamp": "string",
      "appInfo": { object },
      "userInfo": { object },
      "customData": { object },
      "platform": "string",
      "deviceInfo": { object }
    }
  ]
}
```

---

## 事件类型

SDK 上报四种主要类型的事件：

### 1. 错误事件 (error)

### 2. 性能事件 (performance)

### 3. 行为事件 (behavior)

### 4. 自定义事件 (custom)

---

## 数据结构

### 通用字段

#### category
- **类型**: `string`
- **描述**: 事件大类
- **可选值**: `error`, `performance`, `behavior`, `custom`
- **示例**: `"error"`

#### timestamp
- **类型**: `string`
- **描述**: 事件发生的本地时间
- **格式**: `YYYY-MM-DD HH:mm:ss`
- **示例**: `"2026-02-06 15:30:45"`

#### platform
- **类型**: `string`
- **描述**: 运行平台
- **可选值**: `android`, `ios`, `web`, `windows`, `macos`, `linux`
- **示例**: `"android"`

---

### appInfo 对象

应用元数据信息。

```json
{
  "appInfo": {
    "appKey": "string",        // 应用唯一标识（必需）
    "appVersion": "string",    // 应用版本号，如 "1.0.0"
    "buildNumber": "string",   // 构建号，如 "100"
    "packageName": "string",   // 包名，如 "com.example.app"
    "appName": "string",       // 应用名称
    "channel": "string",       // 渠道标识，如 "official", "huawei"
    "environment": "string"    // 环境，如 "production", "development"
  }
}
```

#### 字段说明

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| appKey | string | 是 | 应用唯一标识，用于区分不同应用 |
| appVersion | string | 否 | 应用版本号 |
| buildNumber | string | 否 | 构建号 |
| packageName | string | 否 | 应用包名 |
| appName | string | 否 | 应用名称 |
| channel | string | 否 | 发布渠道 |
| environment | string | 否 | 运行环境 |

---

### userInfo 对象

用户上下文信息，支持运行时动态更新。

```json
{
  "userInfo": {
    "userId": "string",           // 用户ID
    "userType": "string",         // 用户类型
    "userTags": ["string"],       // 用户标签数组
    "userProperties": {           // 用户自定义属性
      "key": "value"
    }
  }
}
```

#### 字段说明

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| userId | string | 否 | 用户唯一标识 |
| userType | string | 否 | 用户类型，如 "vip", "guest" |
| userTags | array | 否 | 用户标签列表 |
| userProperties | object | 否 | 自定义用户属性 |

---

### customData 对象

全局附加的自定义数据。

```json
{
  "customData": {
    "key": "value",    // 自定义键值对
    "region": "us-east-1",
    "experiment": "A"
  }
}
```

---

### deviceInfo 对象

设备硬件和系统信息。

#### Android 设备

```json
{
  "deviceInfo": {
    "device": "string",           // 设备型号，如 "Pixel 7"
    "model": "string",            // 型号，如 "Pixel 7"
    "version": "string",          // Android 版本，如 "13"
    "isPhysicalDevice": boolean   // 是否为真机
  }
}
```

#### iOS 设备

```json
{
  "deviceInfo": {
    "name": "string",             // 设备名称，如 "iPhone 14 Pro"
    "model": "string",            // 型号，如 "iPhone15,3"
    "systemVersion": "string",    // iOS 版本，如 "16.1"
    "isPhysicalDevice": boolean   // 是否为真机
  }
}
```

#### Web 平台

```json
{
  "deviceInfo": {
    "browserName": "string",      // 浏览器名称
    "appVersion": "string",       // 浏览器版本
    "platform": "string"          // 操作系统
  }
}
```

---

## 事件数据详情

### 1. 错误事件 (error)

#### Flutter 框架错误

```json
{
  "category": "error",
  "data": {
    "type": "flutter_error",
    "exception": "string",        // 异常信息
    "stack": "string",            // 堆栈跟踪
    "library": "string",          // 发生异常的库
    "context": "string"           // 上下文描述
  },
  // ... 通用字段
}
```

#### Dart 错误

```json
{
  "category": "error",
  "data": {
    "type": "dart_error",
    "error": "string",            // 错误信息
    "stack": "string",            // 堆栈跟踪
    "timestamp": "string"         // ISO 8601 格式时间戳
  },
  // ... 通用字段
}
```

---

### 2. 性能事件 (performance)

#### 应用启动性能

```json
{
  "category": "performance",
  "data": {
    "type": "app_launch",
    "duration_ms": 1500           // 启动耗时（毫秒）
  },
  // ... 通用字段
}
```

#### 页面加载性能

```json
{
  "category": "performance",
  "data": {
    "type": "page_load",
    "page": "string",             // 页面名称
    "duration_ms": 250            // 页面加载耗时（毫秒）
  },
  // ... 通用字段
}
```

#### API 请求性能 (Dio)

```json
{
  "category": "performance",
  "data": {
    "type": "api",
    "url": "string",              // 请求 URL
    "method": "string",           // HTTP 方法 (GET, POST, etc.)
    "status": 200,                // HTTP 状态码
    "duration_ms": 350,           // 请求耗时（毫秒）
    "success": true               // 是否成功
  },
  // ... 通用字段
}
```

#### API 请求失败 (Dio)

```json
{
  "category": "performance",
  "data": {
    "type": "api",
    "url": "string",
    "method": "string",
    "status": null,               // 失败时为 null
    "duration_ms": 5000,
    "success": false,
    "error": "string"             // 错误信息
  },
  // ... 通用字段
}
```

#### UI 卡顿事件

```json
{
  "category": "performance",
  "data": {
    "type": "jank_sequence",
    "page": "string",                    // 当前页面
    "jank_count": 4,                     // 连续卡顿帧数
    "max_duration_ms": 45.2,             // 最慢帧耗时
    "average_duration_ms": 38.5,         // 平均帧耗时
    "frame_budget_ms": 16.67,            // 帧预算（60fps = 16.67ms）
    "jank_threshold_ms": 41.68,          // 卡顿阈值（2.5倍帧预算）
    "device_performance": {
      "average_frame_time_ms": 16.8,     // 平均帧时间
      "frame_time_variance": 2.3,        // 帧时间方差
      "fps": 59.5,                       // 实际帧率
      "stability": 0.92,                 // 稳定性指标 (0-1)
      "percentiles": {                   // 帧时间百分位数
        "p50": 16.2,
        "p90": 18.5,
        "p95": 20.1,
        "p99": 25.3
      },
      "anomalous_frame_count": 2,        // 异常帧数量
      "device_level": "medium",          // 设备性能等级 (high/medium/low)
      "recent_frame_count": 30           // 采样帧数
    }
  },
  // ... 通用字段
}
```

**字段说明**

| 字段 | 类型 | 描述 |
|------|------|------|
| jank_count | int | 连续卡顿帧数 |
| max_duration_ms | double | 卡顿序列中最慢的一帧耗时 |
| average_duration_ms | double | 卡顿序列的平均帧耗时 |
| frame_budget_ms | double | 理想状态下每帧的预算时间 |
| jank_threshold_ms | double | 判断为卡顿的阈值 |
| stability | double | 帧时间稳定性，越接近 1 越稳定 |
| device_level | string | 设备性能等级评估 |
| percentiles | object | 帧时间的 P50, P90, P95, P99 值 |

---

### 3. 行为事件 (behavior)

#### 页面浏览 (PV)

```json
{
  "category": "behavior",
  "data": {
    "type": "pv",
    "page": "string"              // 页面名称
  },
  // ... 通用字段
}
```

#### 页面停留时长

```json
{
  "category": "behavior",
  "data": {
    "type": "page_stay",
    "page": "string",             // 页面名称
    "duration_ms": 30000          // 停留时长（毫秒）
  },
  // ... 通用字段
}
```

#### 元素点击

```json
{
  "category": "behavior",
  "data": {
    "type": "click",
    "identifier": "string"        // 元素唯一标识
  },
  // ... 通用字段
}
```

---

### 4. 自定义事件 (custom)

开发者可以上报自定义的业务事件。

```json
{
  "category": "custom",
  "data": {
    "event_name": "string",       // 事件名称
    "key1": "value1",             // 自定义字段
    "key2": 123
  },
  // ... 通用字段
}
```

---

## HTTP 响应格式

### 成功响应

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Events received successfully",
  "processed": 10                 // 处理的事件数量
}
```

### 错误响应

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid event format"
  }
}
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 描述 | 处理方式 |
|--------|------|----------|
| 200-299 | 成功 | 事件已接收 |
| 400 | 请求格式错误 | 丢弃事件 |
| 401 | 认证失败 | 检查 appKey |
| 403 | 无权限 | 检查权限配置 |
| 413 | 请求体过大 | 减少批量大小 |
| 429 | 请求过于频繁 | 实现退避重试 |
| 500-599 | 服务器错误 | 保留事件，稍后重试 |

### SDK 重试策略

- **重试条件**: 网络错误或 5xx 错误
- **最大重试次数**: 3 次
- **重试间隔**: 指数退避（1s, 2s, 4s）
- **应用退出时**: 不重试，尽力发送

---

## 安全规范

### 数据加密

建议在生产环境中使用 **HTTPS** 协议进行数据传输。

### 敏感数据处理

**不要在事件数据中包含**：
- 密码
- API 密钥
- 信用卡信息
- 个人身份信息（PII）除非有明确授权

**建议的敏感字段处理**：
```dart
// SDK 配置中添加敏感字段过滤
final config = MonitorConfig(
  sensitiveFields: ['password', 'token', 'secret'],
  // ...
);
```

### 认证

后端应验证 `X-App-Key` 和其他标识信息的有效性。

---

## 最佳实践

### 1. 批量大小配置

根据应用场景调整批量大小：

```dart
// 高流量应用
HttpOutput(
  batchReportSize: 50,  // 减少请求次数
  // ...
);

// 实时性要求高的应用
HttpOutput(
  batchReportSize: 5,   // 更快上报
  // ...
);
```

### 2. 后端存储建议

- 使用时序数据库（如 InfluxDB）存储性能数据
- 使用 Elasticsearch 或 ClickHouse 分析日志
- 定期聚合原始数据，保留统计信息

### 3. 数据保留策略

- 原始事件数据：保留 7-30 天
- 聚合统计数据：保留 6-12 个月
- 错误日志：保留 90 天

---

## 版本历史

### v1.0.0 (2026-02-06)
- 初始版本
- 支持错误、性能、行为事件
- 支持批量上报和定时上报

---

## 附录

### A. 完整示例

```json
{
  "events": [
    {
      "category": "error",
      "data": {
        "type": "dart_error",
        "error": "NoSuchMethodError: The method 'hello' was called on null.",
        "stack": "#0      Object.noSuchMethod...",
        "timestamp": "2026-02-06T15:30:45.123Z"
      },
      "timestamp": "2026-02-06 15:30:45",
      "appInfo": {
        "appKey": "my_app_123",
        "appVersion": "1.0.0",
        "buildNumber": "100",
        "packageName": "com.example.myapp",
        "appName": "MyApp",
        "channel": "official",
        "environment": "production"
      },
      "userInfo": {
        "userId": "user_abc_123",
        "userType": "vip",
        "userTags": ["premium", "active"]
      },
      "customData": {
        "region": "us-east-1",
        "experiment": "A"
      },
      "platform": "android",
      "deviceInfo": {
        "device": "Pixel 7",
        "model": "Pixel 7",
        "version": "13",
        "isPhysicalDevice": true
      }
    }
  ]
}
```

### B. 数据量估算

单个事件大小（JSON）：
- 错误事件：~2-5 KB
- 性能事件：~0.5-2 KB
- 行为事件：~0.3-1 KB

批量上报（10 个事件）：
- 总大小：~5-50 KB
- 建议 GZIP 压缩

### C. 服务端接收示例 (Node.js)

```javascript
const express = require('express');
const app = express();

app.use(express.json({ limit: '1mb' }));

app.post('/api/monitor/report', async (req, res) => {
  try {
    const { events } = req.body;

    // 验证
    if (!Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Events must be an array' }
      });
    }

    // 处理事件
    for (const event of events) {
      await processEvent(event);
    }

    res.json({
      success: true,
      message: 'Events received successfully',
      processed: events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

async function processEvent(event) {
  // 存储到数据库或消息队列
  console.log(`Processing ${event.category} event:`, event.data);
}

app.listen(3000, () => {
  console.log('Monitor server listening on port 3000');
});
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-06
**维护者**: Flutter Monitor SDK Team
