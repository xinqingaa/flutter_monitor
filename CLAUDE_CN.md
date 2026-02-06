# CLAUDE_CN.md

本文件为 Claude Code (claude.ai/code) 提供在此代码库中工作的指导。

## 项目概述

Flutter Monitor SDK 是一个轻量级的 Flutter 应用监控 SDK，用于收集和上报错误、性能指标、用户行为和 UI 卡顿数据。

## 开发命令

### 构建和测试
- `flutter pub get` - 安装依赖
- `flutter test` - 运行所有测试
- `flutter analyze` - 运行静态分析
- `cd example && flutter pub get && flutter run` - 运行示例应用

### 测试特定功能
- 示例应用 (`example/`) 展示了所有 SDK 功能，包括错误监控、性能追踪、卡顿检测和用户行为监控

## 架构

### 核心组件

**入口点: `FlutterMonitorSDK` (lib/flutter_monitor_sdk.dart)**
- 提供公共 API 的单例门面
- 必须在使用前通过 `FlutterMonitorSDK.init()` 初始化
- 提供 `routeObserver`、`dioInterceptor` 和 `httpClient` 的访问
- 运行时用户管理方法: `setUserInfo()`、`clearUserInfo()`、`setCustomData()`

**中央枢纽: `MonitorBinding` (lib/src/core/monitor_binding.dart)**
- 协调所有监控模块的内部单例
- 按特定顺序初始化模块 (Reporter → ErrorMonitor → PerformanceMonitor → BehaviorMonitor → JankMonitor)
- 管理模块生命周期和依赖关系
- 跟踪当前页面为卡顿监控提供上下文

**数据管道: `Reporter` (lib/src/core/reporter.dart)**
- 中央事件收集和分发系统
- 为所有事件丰富信息: 应用信息、用户信息、设备信息、时间戳、平台
- 支持运行时更新用户信息和自定义数据
- 将事件分发到所有配置的输出器
- 使用 `device_info_plus` 插件异步获取设备信息

### 监控模块

**ErrorMonitor** (`lib/src/modules/error_monitor.dart`)
- 通过 `FlutterError.onError` 和 `PlatformDispatcher.instance.onError` 捕获未处理的异常

**PerformanceMonitor** (`lib/src/modules/performance_monitor.dart`)
- 跟踪应用启动时间 (从 `main()` 到首帧)
- 使用 `RouteObserver` + `PageRenderMonitor` 组件跟踪页面加载时间
- 提供 `routeObserver` 用于导航跟踪

**JankMonitor** (`lib/src/modules/jank_monitor.dart)`
- 使用 `SchedulerBinding.instance.addTimingsCallback` 进行智能 UI 卡顿检测
- 基于设备刷新率的自适应阈值
- 连续帧检测 (仅在超过阈值时上报)
- 抖动容忍和防抖以减少误报
- 智能采样 (每 3 帧) 以最小化性能影响
- 计算详细的设备性能指标 (FPS、稳定性、百分位数、设备等级)

**BehaviorMonitor** (`lib/src/modules/behavior_monitor.dart)`
- 跟踪用户行为事件

### 输出系统

**抽象基类: `MonitorOutput`** (lib/src/outputs/monitor_output.dart)
- 定义接口: `init()`、`add()`、`flush()`、`dispose()`

**实现类:**
- `LogMonitorOutput` - 打印到控制台 (调试模式)
- `HttpOutput` - 批量发送到 HTTP 服务器，支持定期/应用生命周期刷新
- `CustomLogOutput` - 用户自定义回调处理器

### 网络监控

- **Dio**: 使用 `FlutterMonitorSDK.dioInterceptor` (包装 reporter 的拦截器)
- **http 包**: 使用 `FlutterMonitorSDK.httpClient` (MonitoredHttpClient 装饰器)

### 配置

**MonitorConfig** (`lib/src/core/monitor_config.dart`)
- `AppInfo`: 应用元数据 (支持通过 `AppInfo.fromPackageInfo()` 自动获取)
- `UserInfo`: 用户上下文 (可选，可在运行时更新)
- 功能开关: `enableErrorMonitor`、`enablePerformanceMonitor`、`enableBehaviorMonitor`、`enableJankMonitor`
- `JankConfig`: 可调的卡顿检测阈值 (严格/宽松/默认预设)
- `outputs`: 输出目标列表

**JankConfig**
- `jankFrameTimeMultiplier`: 帧预算乘数，用于确定卡顿阈值
- `consecutiveJankThreshold`: 上报前的连续慢帧数
- `jitterToleranceMs`: 正常帧时间变化的容差
- `debounceMs`: 卡顿报告之间的最小时间间隔

### 工具类

- `MonitoredGestureDetector`: 包装器，用于跟踪带标识符的点击事件
- `PageRenderMonitor`: 检测页面渲染完成时间的组件
- `MonitoredHttpClient`: http.Client 监控的装饰器模式
- `PerformanceUtils`: 计算帧统计和设备性能指标

## 重要实现细节

### 模块初始化顺序
MonitorBinding 按以下顺序初始化模块:
1. Reporter (必须是第一个 - 所有模块都依赖它)
2. ErrorMonitor
3. PerformanceMonitor (设置 route observer 供 JankMonitor 使用)
4. BehaviorMonitor
5. JankMonitor (需要 PerformanceMonitor 的 route observer)

### 数据流
```
用户操作/监控模块 → Reporter.addEvent() → 数据丰富 → 所有 MonitorOutput 实例
```

### 事件数据结构
每个事件包含:
- `category`: 'error'、'performance'、'behavior' 或自定义
- `data`: 模块特定的事件详情
- `timestamp`: 格式化为 YYYY-MM-DD HH:MM:ss
- `appInfo`: 从配置获取 (appKey、版本等)
- `userInfo`: 运行时值 > 配置值
- `customData`: 运行时值 > 配置值
- `platform`: 'web'、'android'、'ios'
- `deviceInfo`: 从 device_info_plus 插件获取

### 卡顿检测策略
- 仅检测 CPU 密集型卡顿 (慢 build/layout/paint)
- 线程阻塞操作 (同步 I/O、长循环) 会冻结回调，无法被检测到
- 使用连续帧计数来过滤单帧异常
- 实现采样以减少开销

### 命名约定
- 注意: 目录 `lib/src/utils/` 已重命名（原来是 `utIls/`，已修正）。
- `lib/flutter_monitor_sdk.dart` 中的导出路径使用正确的命名
