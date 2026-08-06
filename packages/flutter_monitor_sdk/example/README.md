# PulseFit Example（Flutter Monitor SDK）

体育健康演示 App：**像真实产品一样只调业务 Mock**，不调用 Monitor 查询 API。

契约见 [`platform/docs/EXAMPLE_DEMO.md`](../../../platform/docs/EXAMPLE_DEMO.md)。

## 依赖

先启动 Platform（托管 `/api/example/v1` mock + 可选 ingest）：

```sh
./scripts/platform.sh
```

真机可补：

```sh
./scripts/platform.sh adb-reverse
```

## 运行

```sh
./scripts/run_example.sh
# 或
fvm flutter run packages/flutter_monitor_sdk/example
```

- Mock / Service：`http://127.0.0.1:3700`
- Workbench Web：`http://localhost:4700`（人工查看链路，App 不调用）

Dart defines：

- `FM_EXAMPLE_API_BASE_URL`：业务 mock 根地址（默认 `http://127.0.0.1:3700`）
- `FM_SERVER_URL`：SDK ingest（默认 `.../api/monitor/v1/events`）

## 产品结构

```text
Splash → Login
→ 首页 | 训练 | 发现 | 我的
二级：训练详情/进行中、课程/教练、会员、体征、消息、设置、网络演练
```

HTTP：**仅 Dio** + SDK interceptor。响应：`{ code, message, data }`，成功 `code=0`；业务失败 HTTP 200。

## 埋点

仅关键业务：`auth.login`、`workout.*`、`course.book`、`membership.order`、`vital.submit`。

## Output 模式

在 `lib/main.dart` 的 `buildMonitorMode()` 中切换 `localLive` / `consoleOnly` / `production`。

## 测试

```sh
fvm flutter test packages/flutter_monitor_sdk/example/test
```
