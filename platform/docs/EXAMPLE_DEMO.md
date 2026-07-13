# Example Demo（体育健康 App + Mock API）

- App：`packages/flutter_monitor_sdk/example`
- Mock：`platform/services/monitor-service` → `/api/example/v1/*`

Example 是**真实商业 App 演示**，不是 Monitor / Workbench 客户端。

## 硬约束

1. Example **禁止**调用 Monitor Service 查询 API（`/api/monitor/v1/health`、`/recent` 等）。
2. 业务 HTTP **仅 Dio** + SDK Dio interceptor；禁止业务路径使用 `package:http`。
3. Mock 响应统一：`{ "code": number, "message": string, "data": T | null }`。
4. 成功码：`code === 0`。
5. 业务告知失败：`HTTP 200` + `code !== 0`（如约满、重复打卡、会员支付失败）。
6. `401` / `404` / `503` / 超时仅用于真实传输、鉴权、宕机、慢网演练（调试入口）。
7. SDK `localLive` 写入 ingest **允许**（旁路配置，不是业务 API）。
8. `track` 仅关键业务结果；禁止 Tab/曝光/纯导航狂打点。

## 信息架构

```text
Splash → Login
→ Tabs: 首页 | 训练 | 发现 | 我的
二级:
  训练详情 → 训练进行中 → 完成结果
  课程详情 → 教练 → 预约确认 / 结果
  会员中心 → 开通确认
  体征上报 / 历史
  消息通知（可选）
  设置
隐藏: 网络异常演练（lab）
```

## 信封与错误码

```json
{ "code": 0, "message": "ok", "data": {}, "requestId": "..." }
```

| code | 含义 | HTTP |
| --- | --- | --- |
| 0 | 成功 | 200 |
| 40001 | 重复打卡 / 训练不可完成 | 200 |
| 40002 | 课程约满 | 200 |
| 40003 | 会员支付失败 | 200 |
| 40004 | 参数不合法（业务侧） | 200 |
| 40100 | （保留）业务未登录语义；本 demo 真未登录用 HTTP 401 | 401 |
| — | 资源不存在 | 404 |
| — | 服务不可用 | 503 |

## API 前缀

`/api/example/v1`

| 方法 | 路径 | 页面 |
| --- | --- | --- |
| GET | `/bootstrap` | Splash |
| GET | `/auth/options` | Login |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | 设置 |
| GET | `/home/dashboard` | 首页 |
| GET | `/home/recommendations` | 首页 |
| GET | `/workouts` | 训练 Tab |
| GET | `/workouts/:id` | 训练详情 |
| POST | `/workouts/:id/start` | 进行中 |
| POST | `/workouts/:id/complete` | 完成 |
| POST | `/workouts/:id/checkin` | 打卡 |
| GET | `/courses` | 发现 |
| GET | `/courses/:id` | 课程详情 |
| GET | `/coaches/:id` | 教练 |
| POST | `/courses/:id/book` | 预约 |
| GET | `/vitals/latest` | 我的 / 体征 |
| GET | `/vitals/history` | 体征历史 |
| POST | `/vitals` | 上报 |
| GET | `/membership` | 会员 |
| POST | `/membership/orders` | 开通 |
| GET | `/me` | 我的 |
| PUT | `/me/profile` | 资料 |
| PUT | `/me/goals` | 目标 |
| GET | `/notices` | 消息 |
| GET | `/lab/slow` | 调试 |
| GET | `/lab/not-found` | 调试 404 |
| GET | `/lab/unavailable` | 调试 503 |

鉴权：除 bootstrap / auth/options / auth/login / lab 外，请求头 `Authorization: Bearer <token>`；缺失返回 HTTP 401。

## 埋点白名单（仅这些可 `track`）

| name | 时机 |
| --- | --- |
| `auth.login` | 登录成功或业务失败结果 |
| `workout.start` | 开始训练结果 |
| `workout.complete` | 完成训练结果 |
| `workout.checkin` | 打卡结果 |
| `course.book` | 预约结果 |
| `membership.order` | 会员下单结果 |
| `vital.submit` | 体征提交结果 |

属性建议：`result`=`success|failed`，失败带 `biz_code` / `message`。  
HTTP 证据靠 Dio interceptor，不对每个请求再 `track`。

## 范围与约束

Example **不做**：

- 调用 Monitor 查询 API、首页 recent 事件流、或自建 Workbench 客户端
- 业务路径混用 `package:http`（仅 Dio + SDK interceptor）
- 旧商店 / checkout / ops mock 叙事；API Lab / Performance Gallery / Video 不作主产品页

Example **保留**：

- SDK init、`MonitorMode`、routeObserver、Dio interceptor
- Splash → Login → 主壳流程
- `appTrack` 封装（仅白名单调用）

## 演示路径

1. 登录（2–3 位 userId）→ 首页双接口  
2. 训练列表 → 详情 → 开始 → 完成（成功 `track`）  
3. 发现 → 课程 → 预约（可选约满：200 + 40002 + `track` failed）  
4. 会员开通（可用失败码演练 40003）  
5. Workbench 仅人工查看链路；App 不依赖其查询 API  
