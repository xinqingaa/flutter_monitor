# Flutter Monitor SDK Example

这个 example 是一个模拟真实业务的 Flutter App，用来验证 SDK 在启动、页面、网络、业务动作、交互性能、卡顿、内存和错误场景下的事件链路。

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
- 页面监控封装在 `lib/widgets/app_page.dart`，业务页面只传 `routeName`，按需传 `moduleName` 和 `moduleScene`。
- 启动页：模拟启动恢复和首屏闭合。
- 首页：tab 首页，支持左右滑动，加载 GitHub 和 JSONPlaceholder 公开接口。
- 我的：用户、网络上下文切换，反馈失败和 Flutter error 场景。
- 登录注册：验证码输入、登录成功、注册成功和用户上下文写入。
- 内容详情：收藏、分享半屏弹层、优惠券失败和订单入口。
- 订单结算：校验失败、替换优惠券、重试成功。
- 数据同步中心：Dio/http 成功、404、timeout 和本地慢请求。
- 视频频道：真实远程 mp4、横滑 PageView、播放暂停、评论半屏弹层和播放器释放。
- 内容创作中心：交互性能、复杂内容流卡顿和 retained memory。

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
