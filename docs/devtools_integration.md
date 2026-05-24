# DevTools 集成

## 目标

DevTools 集成服务于本地复现、性能优化和 QA 交接。它不承担长期历史分析职责。

DevTools 能力应基于统一事件模型，不应定义另一套事件结构。

## 能力范围

### Flutter Timeline 标记

SDK 应将关键 trace/span 写入 Flutter Timeline。

建议标记：

- app cold start
- app hot start
- route push/pop
- page first frame
- page interactive
- http client request
- custom trace/span
- jank sequence
- long task

Timeline 标记应使用稳定 name，并在 arguments 中携带必要上下文。

### Session Timeline 面板

DevTools extension 应展示当前 session timeline。

事件展示顺序：

```text
timestamp
  route.enter
  ui.tap
  http.client
  page.load
  ui.jank.sequence
  error.dart
```

每条事件应展示：

- event name
- signal type
- timestamp
- duration
- route/module
- trace/span
- status
- key attributes

### 事件详情

事件详情应展示：

- envelope
- resource
- context
- attributes
- payload
- breadcrumbs
- related trace/spans

敏感字段应在展示前经过同一套 privacy filtering。

### QA 导出与开发导入

DevTools 应支持导出当前 session。

导出内容：

- session metadata
- event envelopes
- breadcrumbs
- SDK self-monitoring events
- schema version

导入后应能查看 session timeline 和事件详情。

导出文件不应包含未经脱敏的敏感字段。

## 本地诊断场景

DevTools 应支持以下场景：

- 页面加载慢：查看 page trace 下的 first frame、interactive、API、jank。
- 点击后卡顿：查看 action trace、点击 breadcrumb、后续 span 和 jank。
- 请求慢：查看 http span 是否影响页面 trace。
- QA 复现：导出 session 给开发。
- 自定义业务流程优化：比较 custom trace 的 span 耗时。

## SDK 自监控展示

DevTools 应展示 SDK 自身状态：

- event queue size
- dropped event count
- flush success/failure
- sampling state
- privacy filtering state
- offline cache size
- active session id
- active trace count

## 边界

DevTools 不负责：

- 跨用户历史查询；
- 长期趋势；
- 告警；
- 影响用户数统计；
- 多版本聚合对比。

这些能力由服务端承担。
