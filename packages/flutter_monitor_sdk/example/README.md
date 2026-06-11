# Flutter Monitor SDK Example

这个 example 是一个模拟真实业务的 Flutter App，用来验证 SDK 在启动、页面、网络、业务动作、交互性能、卡顿、内存和错误场景下的事件链路。

## 启动流程

```text
Splash → Login（输入 2-3 位 userId 或随机生成）→ 首页 Tab App
```

登录成功后会写入 `context.user.userId`，首页默认展示「我的事件」，可切换到「全部事件」。

## Workbench 依赖

首页从本地 Workbench service 读取原始 envelope：

- `GET http://127.0.0.1:3700/api/monitor/v1/health`
- `GET http://127.0.0.1:3700/api/monitor/v1/recent?limit=50`

请先启动 Workbench：

```sh
bash scripts/workbench.sh
```

- Web 入口：`http://localhost:4700`
- API 入口：`http://localhost:3700/api/monitor/v1/*`

## Output 模式

输出模式集中在 `lib/main.dart` 的 `buildMonitorMode()` 中。

每次只保留一个 `final monitorMode = ...`，切换注释后重新运行 App：

- `MonitorMode.consoleOnly()`
- `MonitorMode.localLive(endpoint: Uri.parse(monitorServerUrl))`
- `MonitorMode.production(...)`

`production` 示例中保留了默认策略、灰度策略、鉴权策略和压测策略，按需要取消注释即可。

## 页面结构

- 路由集中在 `lib/router/app_routes.dart`。
- 页面跳转集中在 `lib/router/app_navigation.dart`。
- 页面监控封装在 `lib/widgets/app_page.dart`。
- 业务埋点反馈使用 `lib/widgets/app_track.dart` 的 `appTrack(...)`。
- 启动页：SDK 冷启动后进入登录。
- 登录页：userId 输入 / 随机，写入用户上下文后进入首页。
- 首页：Workbench health + recent 事件列表，点击进入事件详情。
- 我的：上下文模拟、监控场景入口、切换账号 / 退出登录。
- 订单结算：校验失败、替换优惠券、重试成功（measure）。
- 数据同步中心：Dio/http 成功、404、timeout 和本地慢请求。
- 视频频道：横滑 PageView、播放暂停、评论（appTrack）。
- 内容创作中心：图表交互、故意卡顿、retained memory。

## 运行

```sh
fvm flutter run packages/flutter_monitor_sdk/example
```

本地 Workbench live 模式默认写入：

```text
http://127.0.0.1:3700/api/monitor/v1/events
```

如需替换地址：

```sh
fvm flutter run packages/flutter_monitor_sdk/example \
  --dart-define=FM_SERVER_URL=http://127.0.0.1:3700/api/monitor/v1/events
```

## 测试

```sh
fvm flutter test packages/flutter_monitor_sdk/example/test
```
