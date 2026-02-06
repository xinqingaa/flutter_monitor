# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flutter Monitor SDK is a lightweight monitoring SDK for Flutter applications that collects and reports errors, performance metrics, user behavior, and UI jank data.

## Development Commands

### Building and Testing
- `flutter pub get` - Install dependencies
- `flutter test` - Run all tests
- `flutter analyze` - Run static analysis
- `cd example && flutter pub get && flutter run` - Run the example app

### Testing Specific Features
- The example app (`example/`) demonstrates all SDK features including error monitoring, performance tracking, jank detection, and user behavior monitoring

## Architecture

### Core Components

**Entry Point: `FlutterMonitorSDK` (lib/flutter_monitor_sdk.dart)**
- Singleton facade that provides public API
- Must be initialized via `FlutterMonitorSDK.init()` before use
- Provides access to `routeObserver`, `dioInterceptor`, and `httpClient`
- Methods for runtime user management: `setUserInfo()`, `clearUserInfo()`, `setCustomData()`

**Central Hub: `MonitorBinding` (lib/src/core/monitor_binding.dart)**
- Internal singleton that coordinates all monitoring modules
- Initializes modules in specific order (Reporter → ErrorMonitor → PerformanceMonitor → BehaviorMonitor → JankMonitor)
- Manages module lifecycle and dependencies
- Tracks current page for jank monitoring context

**Data Pipeline: `Reporter` (lib/src/core/reporter.dart)**
- Central event collection and distribution system
- Enriches all events with: app info, user info, device info, timestamp, platform
- Supports runtime updates of user info and custom data
- Dispatches events to all configured outputs
- Asynchronously fetches device info using `device_info_plus` plugin

### Monitoring Modules

**ErrorMonitor** (`lib/src/modules/error_monitor.dart`)
- Captures unhandled exceptions via `FlutterError.onError` and `PlatformDispatcher.instance.onError`

**PerformanceMonitor** (`lib/src/modules/performance_monitor.dart`)
- Tracks app startup time (from `main()` to first frame)
- Tracks page load time using `RouteObserver` + `PageRenderMonitor` widget
- Provides `routeObserver` for navigation tracking

**JankMonitor** (`lib/src/modules/jank_monitor.dart`)
- Intelligent UI jank detection using `SchedulerBinding.instance.addTimingsCallback`
- Adaptive thresholds based on device refresh rate
- Consecutive frame detection (reports only when threshold exceeded)
- Jitter tolerance and debouncing to reduce false positives
- Smart sampling (every 3 frames) to minimize performance impact
- Calculates detailed device performance metrics (FPS, stability, percentiles, device level)

**BehaviorMonitor** (`lib/src/modules/behavior_monitor.dart`)
- Tracks user behavior events

### Output System

**Abstract Base: `MonitorOutput`** (lib/src/outputs/monitor_output.dart)
- Defines interface: `init()`, `add()`, `flush()`, `dispose()`

**Implementations:**
- `LogMonitorOutput` - Prints to console (debug mode)
- `HttpOutput` - Batches and sends to HTTP server with periodic/app-lifecycle flush
- `CustomLogOutput` - User-defined callback handler

### Network Monitoring

- **Dio**: Use `FlutterMonitorSDK.dioInterceptor` (Interceptor wrapping reporter)
- **http package**: Use `FlutterMonitorSDK.httpClient` (MonitoredHttpClient decorator)

### Configuration

**MonitorConfig** (`lib/src/core/monitor_config.dart`)
- `AppInfo`: Application metadata (supports auto-fetch via `AppInfo.fromPackageInfo()`)
- `UserInfo`: User context (optional, can be updated at runtime)
- Feature flags: `enableErrorMonitor`, `enablePerformanceMonitor`, `enableBehaviorMonitor`, `enableJankMonitor`
- `JankConfig`: Tunable jank detection thresholds (strict/lenient/default presets)
- `outputs`: List of output targets

**JankConfig**
- `jankFrameTimeMultiplier`: Multiplier for frame budget to determine jank threshold
- `consecutiveJankThreshold`: Number of consecutive slow frames before reporting
- `jitterToleranceMs`: Allowance for normal frame time variance
- `debounceMs`: Minimum time between jank reports

### Utilities

- `MonitoredGestureDetector`: Wrapper for tracking tap events with identifiers
- `PageRenderMonitor`: Widget that detects when page rendering completes
- `MonitoredHttpClient`: Decorator pattern for http.Client monitoring
- `PerformanceUtils`: Calculates frame statistics and device performance metrics

## Important Implementation Details

### Module Initialization Order
MonitorBinding initializes modules in this order:
1. Reporter (must be first - all modules depend on it)
2. ErrorMonitor
3. PerformanceMonitor (sets up route observer for JankMonitor)
4. BehaviorMonitor
5. JankMonitor (needs route observer from PerformanceMonitor)

### Data Flow
```
User Action/Monitor Module → Reporter.addEvent() → Data Enrichment → All MonitorOutput instances
```

### Event Data Structure
Every event includes:
- `category`: 'error', 'performance', 'behavior', or custom
- `data`: Module-specific event details
- `timestamp`: Formatted YYYY-MM-DD HH:MM:ss
- `appInfo`: From config (appKey, version, etc.)
- `userInfo`: Runtime > Config values
- `customData`: Runtime > Config values
- `platform`: 'web', 'android', 'ios'
- `deviceInfo`: From device_info_plus plugin

### Jank Detection Strategy
- Only CPU-intensive jank (slow builds/layout/paint) is detected
- Thread-blocking operations (sync I/O, long loops) freeze the callback and cannot be detected
- Uses consecutive frame counting to filter out single-frame anomalies
- Implements sampling to reduce overhead

### Naming Conventions
- The directory `lib/src/utils/` was previously `lib/src/utIls/` (typo) and has been corrected.
- Export paths in `lib/flutter_monitor_sdk.dart` use the correct naming
