import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

type RecordValue = Record<string, unknown>;

const products = [
  { id: 'sku_report', name: '离线性能报告', price: 36, quantity: 1 },
  { id: 'sku_course', name: 'Flutter 专题内容包', price: 128, quantity: 1 },
  { id: 'sku_qa', name: 'QA 复现资料包', price: 18, quantity: 2 },
];

@ApiTags('example')
@Controller('api/example')
export class ExampleBusinessController {
  @Get('app/bootstrap')
  @ApiOperation({ summary: 'example 启动配置 mock' })
  bootstrap(@Query('scene') scene = 'launch') {
    return {
      ok: true,
      scene,
      featureFlags: ['home_feed', 'checkout_coupon', 'profile_preferences'],
      release: 'example-2026.06',
      serverTime: new Date().toISOString(),
    };
  }

  @Get('auth/options')
  @ApiOperation({ summary: 'example 登录页配置 mock' })
  authOptions() {
    return {
      ok: true,
      methods: ['user_id', 'guest'],
      notice: 'QA 环境允许 2-3 位数字 userId 登录',
      supportContact: 'qa@example.local',
    };
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'example 登录 mock' })
  async login(@Body() body: RecordValue, @Res() res: Response): Promise<void> {
    await delay(180);
    const userId = stringValue(body.userId);
    if (!userId || !/^\d{2,3}$/.test(userId)) {
      res.status(422).send({
        ok: false,
        code: 'INVALID_USER_ID',
        message: 'userId must be 2-3 digits',
      });
      return;
    }
    res.send({
      ok: true,
      user: {
        userId,
        name: `QA 用户 ${userId}`,
        tier: Number(userId) % 2 === 0 ? 'premium' : 'free',
      },
      token: `mock-token-${userId}`,
      expiresIn: 3600,
    });
  }

  @Get('home/feed')
  @ApiOperation({ summary: 'example 首页 feed mock' })
  async homeFeed(@Query('userId') userId = 'guest') {
    await delay(220);
    return {
      ok: true,
      userId,
      unreadCount: 3,
      items: [
        {
          id: 'feed_launch',
          title: '启动链路体检',
          subtitle: '冷启动、首帧、页面进入',
          description: '进入详情可查看本次 session 的启动 trace 和页面节点。',
          source: 'monitor',
          metricLabel: '耗时',
          metricValue: '812ms',
        },
        {
          id: 'feed_http',
          title: 'HTTP 详情采集',
          subtitle: 'headers / query / body',
          description: '本地 Workbench 可查看完整请求上下文和 cURL。',
          source: 'network',
          metricLabel: '接口',
          metricValue: '8',
        },
      ],
    };
  }

  @Get('home/recommendations')
  @ApiOperation({ summary: 'example 首页推荐 mock' })
  async recommendations(@Query('userId') userId = 'guest') {
    await delay(160);
    return {
      ok: true,
      userId,
      items: [
        {
          id: 'rec_checkout',
          title: '订单结算演练',
          subtitle: '业务失败不会自动算异常',
          description: '优惠券过期会返回 HTTP 200 + 业务 code，需要业务埋点表达失败。',
          source: 'commerce',
          metricLabel: '状态',
          metricValue: '可用',
        },
        {
          id: 'rec_profile',
          title: '用户画像更新',
          subtitle: 'PUT 偏好设置',
          description: '切换会员和弱网会更新 context，同时发起资料偏好请求。',
          source: 'profile',
          metricLabel: '偏好',
          metricValue: '2',
        },
      ],
    };
  }

  @Get('users/:userId/profile')
  @ApiOperation({ summary: 'example 用户资料 mock' })
  @ApiParam({ name: 'userId' })
  async profile(@Param('userId') userId: string) {
    await delay(180);
    return {
      ok: true,
      user: {
        userId,
        name: `QA 用户 ${userId}`,
        tier: Number(userId) % 2 === 0 ? 'premium' : 'free',
        tags: Number(userId) % 2 === 0 ? ['vip', 'qa'] : ['qa'],
      },
      preferences: {
        weakNetwork: false,
        notifications: true,
      },
    };
  }

  @Put('users/:userId/preferences')
  @ApiOperation({ summary: 'example 用户偏好更新 mock' })
  @ApiParam({ name: 'userId' })
  async updatePreferences(@Param('userId') userId: string, @Body() body: RecordValue) {
    await delay(140);
    return {
      ok: true,
      userId,
      preferences: body,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('checkout/cart')
  @ApiOperation({ summary: 'example 购物车 mock' })
  async cart(@Query('userId') userId = 'guest') {
    await delay(210);
    return cartPayload(userId, 'DEMO_EXPIRED');
  }

  @Post('checkout/coupons/validate')
  @ApiOperation({ summary: 'example 优惠券校验 mock，业务失败使用 HTTP 200' })
  async validateCoupon(@Body() body: RecordValue) {
    await delay(260);
    const coupon = stringValue(body.coupon) ?? '';
    if (coupon === 'DEMO_EXPIRED') {
      return {
        ok: false,
        code: 'COUPON_EXPIRED',
        message: '优惠券已过期，请更换后重试',
      };
    }
    return {
      ok: true,
      code: 'COUPON_ACCEPTED',
      message: '优惠券可用',
      discount: 20,
    };
  }

  @Post('checkout/orders')
  @ApiOperation({ summary: 'example 订单提交 mock' })
  async submitOrder(@Body() body: RecordValue, @Res() res: Response): Promise<void> {
    await delay(420);
    const coupon = stringValue(body.coupon);
    if (coupon === 'DEMO_EXPIRED') {
      res.send({
        ok: false,
        code: 'COUPON_EXPIRED',
        message: '优惠券已过期，请更换后重试',
      });
      return;
    }
    res.send({
      ok: true,
      orderId: `ord_${Date.now()}`,
      status: 'created',
      payable: 162,
    });
  }

  @Delete('checkout/cart/items/:itemId')
  @ApiOperation({ summary: 'example 删除购物车商品 mock' })
  @ApiParam({ name: 'itemId' })
  async deleteCartItem(@Param('itemId') itemId: string) {
    await delay(130);
    return {
      ok: true,
      deletedItemId: itemId,
      remainingCount: Math.max(0, products.length - 1),
    };
  }

  @Get('ops/sync/summary')
  @ApiOperation({ summary: 'example 运营同步摘要 mock' })
  async syncSummary() {
    await delay(150);
    return {
      ok: true,
      pendingOrders: 7,
      inventoryTasks: 3,
      lastSyncAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    };
  }

  @Post('ops/sync/orders')
  @ApiOperation({ summary: 'example 慢订单同步 mock' })
  async syncOrders() {
    await delay(1250);
    return {
      ok: true,
      synced: 7,
      skipped: 1,
    };
  }

  @Put('ops/pricing/rules/:ruleId')
  @ApiOperation({ summary: 'example 价格规则更新 mock' })
  @ApiParam({ name: 'ruleId' })
  async updatePricingRule(@Param('ruleId') ruleId: string, @Body() body: RecordValue) {
    await delay(240);
    return {
      ok: true,
      ruleId,
      body,
      updatedAt: new Date().toISOString(),
    };
  }

  @Delete('ops/drafts/:draftId')
  @ApiOperation({ summary: 'example 删除草稿 mock' })
  @ApiParam({ name: 'draftId' })
  async deleteDraft(@Param('draftId') draftId: string) {
    await delay(190);
    return {
      ok: true,
      draftId,
      deleted: true,
    };
  }

  @Get('ops/reports/daily')
  @ApiOperation({ summary: 'example 报表异常 mock' })
  @ApiQuery({ name: 'fail', required: false })
  async dailyReport(@Query('fail') fail: string | undefined, @Res() res: Response): Promise<void> {
    await delay(280);
    if (fail === 'true') {
      res.status(503).send({
        ok: false,
        code: 'REPORT_SERVICE_UNAVAILABLE',
        message: '日报服务暂不可用',
      });
      return;
    }
    res.send({
      ok: true,
      date: new Date().toISOString().slice(0, 10),
      orders: 42,
      revenue: 8536,
    });
  }
}

function cartPayload(userId: string, coupon: string) {
  const total = products.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    ok: true,
    userId,
    coupon,
    items: products,
    total,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
