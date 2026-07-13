import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

type Json = Record<string, unknown>;

const BizCode = {
  OK: 0,
  DUPLICATE_CHECKIN: 40001,
  COURSE_FULL: 40002,
  PAYMENT_FAILED: 40003,
  INVALID_PARAM: 40004,
} as const;

const workouts = [
  {
    id: 'wo_hiit_20',
    title: '燃脂 HIIT 20 分钟',
    level: '中级',
    durationMin: 20,
    kcal: 220,
    coverTone: 'orange',
    focus: ['心肺', '核心'],
    description: '高强度间歇，适合午休快速燃脂。跟练时可分段打卡。',
  },
  {
    id: 'wo_yoga_flow',
    title: '晨间瑜伽流',
    level: '初级',
    durationMin: 30,
    kcal: 110,
    coverTone: 'teal',
    focus: ['柔韧', '呼吸'],
    description: '唤醒肩颈与髋部，适合每日开练。',
  },
  {
    id: 'wo_strength_full',
    title: '全身力量循环',
    level: '进阶',
    durationMin: 45,
    kcal: 320,
    coverTone: 'indigo',
    focus: ['力量', '稳定'],
    description: '哑铃/自重循环，完成后可记录体征。',
  },
  {
    id: 'wo_run_easy',
    title: '轻松有氧跑',
    level: '初级',
    durationMin: 35,
    kcal: 280,
    coverTone: 'green',
    focus: ['有氧'],
    description: '配速可控的户外或跑步机方案。',
  },
];

const courses = [
  {
    id: 'cs_spin_live',
    title: '动感单车 Live',
    category: '有氧',
    seatsLeft: 0,
    price: 49,
    coachId: 'coach_lin',
    startAt: daysFromNow(1, 19),
    durationMin: 45,
    coverTone: 'rose',
    summary: '晚间直播团课，名额有限。',
  },
  {
    id: 'cs_pilates',
    title: '器械普拉提入门',
    category: '塑形',
    seatsLeft: 6,
    price: 79,
    coachId: 'coach_mei',
    startAt: daysFromNow(2, 10),
    durationMin: 50,
    coverTone: 'violet',
    summary: '小班教学，强调核心与体态。',
  },
  {
    id: 'cs_box_basics',
    title: '拳击基础步伐',
    category: '搏击',
    seatsLeft: 12,
    price: 59,
    coachId: 'coach_kai',
    startAt: daysFromNow(3, 18),
    durationMin: 40,
    coverTone: 'amber',
    summary: '步伐与防守组合，适合零基础。',
  },
  {
    id: 'cs_swim_tech',
    title: '自由泳技术课',
    category: '游泳',
    seatsLeft: 4,
    price: 99,
    coachId: 'coach_lin',
    startAt: daysFromNow(4, 9),
    durationMin: 60,
    coverTone: 'sky',
    summary: '水感与划水效率专项。',
  },
];

const coaches: Record<string, Json> = {
  coach_lin: {
    id: 'coach_lin',
    name: '林澈',
    title: '国家一级游泳教练',
    years: 8,
    rating: 4.9,
    tags: ['游泳', '单车', '康复'],
    bio: '专注技术纠正与循序渐进训练计划。',
  },
  coach_mei: {
    id: 'coach_mei',
    name: '美咲',
    title: '普拉提认证教练',
    years: 6,
    rating: 4.8,
    tags: ['普拉提', '体态'],
    bio: '帮助久坐人群重建核心与呼吸模式。',
  },
  coach_kai: {
    id: 'coach_kai',
    name: '凯恩',
    title: '搏击体能教练',
    years: 10,
    rating: 4.7,
    tags: ['拳击', '力量'],
    bio: '从步伐到组合打击的系统课表。',
  },
};

const checkins = new Set<string>();
const sessions = new Map<string, { userId: string; token: string }>();

@Injectable()
class MirrorRequestIdHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap((data) => {
        if (!data || typeof data !== 'object') return;
        const requestId = (data as { requestId?: unknown }).requestId;
        if (typeof requestId !== 'string' || requestId.length === 0) return;
        const res = context.switchToHttp().getResponse<Response>();
        if (!res.headersSent) res.setHeader('x-request-id', requestId);
      }),
    );
  }
}

@ApiTags('example-v1')
@UseInterceptors(MirrorRequestIdHeaderInterceptor)
@Controller('api/example/v1')
export class ExampleBusinessController {
  @Get('bootstrap')
  @ApiOperation({ summary: '启动配置' })
  bootstrap(@Query('scene') scene = 'launch') {
    return envelope({
      scene,
      appName: 'PulseFit',
      release: 'pulsefit-2026.07',
      featureFlags: ['workouts', 'courses', 'membership', 'vitals'],
      minSupportedBuild: 1,
      serverTime: new Date().toISOString(),
    });
  }

  @Get('auth/options')
  @ApiOperation({ summary: '登录页配置' })
  authOptions() {
    return envelope({
      methods: ['user_id'],
      notice: '演示账号请输入 2–3 位数字 userId',
      supportContact: 'support@pulsefit.demo',
      agreements: ['用户协议', '隐私政策'],
    });
  }

  @Post('auth/login')
  @ApiOperation({ summary: '登录；非法 userId 为业务失败 200' })
  async login(@Body() body: Json) {
    await delay(200);
    const userId = str(body.userId);
    if (!userId || !/^\d{2,3}$/.test(userId)) {
      return envelope(null, BizCode.INVALID_PARAM, 'userId 须为 2–3 位数字');
    }
    const token = `pf_${userId}_${randomUUID().slice(0, 8)}`;
    sessions.set(token, { userId, token });
    return envelope({
      token,
      expiresIn: 86400,
      user: userCard(userId),
    });
  }

  @Post('auth/logout')
  @ApiOperation({ summary: '退出登录' })
  @ApiHeader({ name: 'authorization', required: false })
  logout(@Headers('authorization') authorization?: string) {
    const token = bearer(authorization);
    if (token) sessions.delete(token);
    return envelope({ loggedOut: true });
  }

  @Get('home/dashboard')
  @ApiOperation({ summary: '首页今日概览' })
  async dashboard(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(180);
    const steps = 4200 + (Number(auth.userId) % 50) * 37;
    sendJson(res, envelope({
        greeting: greeting(),
        user: userCard(auth.userId),
        today: {
          steps,
          stepsGoal: 8000,
          activeMin: 28 + (Number(auth.userId) % 20),
          activeGoal: 45,
          kcal: 310 + (Number(auth.userId) % 40),
          workoutsDone: Number(auth.userId) % 3,
        },
        streakDays: 3 + (Number(auth.userId) % 10),
        nextWorkoutId: workouts[Number(auth.userId) % workouts.length].id,
      }));
  }

  @Get('home/recommendations')
  @ApiOperation({ summary: '首页推荐' })
  async recommendations(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(140);
    sendJson(res, envelope({
        items: [
          ...workouts.slice(0, 2).map((w) => ({
            type: 'workout',
            id: w.id,
            title: w.title,
            subtitle: `${w.durationMin} 分钟 · ${w.level}`,
            tone: w.coverTone,
          })),
          ...courses.slice(0, 2).map((c) => ({
            type: 'course',
            id: c.id,
            title: c.title,
            subtitle: c.seatsLeft > 0 ? `剩余 ${c.seatsLeft} 席` : '已满员',
            tone: c.coverTone,
          })),
        ],
      }));
  }

  @Get('workouts')
  @ApiOperation({ summary: '训练计划列表' })
  async listWorkouts(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(160);
    sendJson(res, envelope({ items: workouts, total: workouts.length }));
  }

  @Get('workouts/:id')
  @ApiOperation({ summary: '训练详情' })
  @ApiParam({ name: 'id' })
  async workoutDetail(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(150);
    const workout = workouts.find((item) => item.id === id);
    if (!workout) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '训练不存在'), 404);
      return;
    }
    sendJson(res, envelope({
        ...workout,
        segments: [
          { name: '热身', minutes: 5 },
          { name: '主课', minutes: Math.max(10, workout.durationMin - 10) },
          { name: '拉伸', minutes: 5 },
        ],
        checkedInToday: checkins.has(`${auth.userId}:${id}:${dayKey()}`),
      }));
  }

  @Post('workouts/:id/start')
  @ApiOperation({ summary: '开始训练' })
  @ApiParam({ name: 'id' })
  async startWorkout(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(200);
    const workout = workouts.find((item) => item.id === id);
    if (!workout) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '训练不存在'), 404);
      return;
    }
    sendJson(res, envelope({
        sessionId: `ws_${Date.now()}`,
        workoutId: id,
        startedAt: new Date().toISOString(),
        title: workout.title,
      }));
  }

  @Post('workouts/:id/complete')
  @ApiOperation({ summary: '完成训练' })
  @ApiParam({ name: 'id' })
  async completeWorkout(
    @Param('id') id: string,
    @Body() body: Json,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(260);
    const workout = workouts.find((item) => item.id === id);
    if (!workout) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '训练不存在'), 404);
      return;
    }
    const sessionId = str(body.sessionId);
    if (!sessionId) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '缺少 sessionId'));
      return;
    }
    sendJson(res, envelope({
        workoutId: id,
        sessionId,
        completedAt: new Date().toISOString(),
        kcal: workout.kcal,
        durationMin: workout.durationMin,
        badge: '今日训练完成',
      }));
  }

  @Post('workouts/:id/checkin')
  @ApiOperation({ summary: '训练打卡；重复打卡为业务失败 200' })
  @ApiParam({ name: 'id' })
  async checkin(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(180);
    if (!workouts.some((item) => item.id === id)) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '训练不存在'), 404);
      return;
    }
    const key = `${auth.userId}:${id}:${dayKey()}`;
    if (checkins.has(key)) {
      sendJson(res, envelope(null, BizCode.DUPLICATE_CHECKIN, '今日已打卡，请勿重复提交'));
      return;
    }
    checkins.add(key);
    sendJson(res, envelope({ workoutId: id, checkedInAt: new Date().toISOString(), streakDays: 1 }));
  }

  @Get('courses')
  @ApiOperation({ summary: '课程列表' })
  async listCourses(
    @Headers('authorization') authorization: string | undefined,
    @Query('category') category: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(170);
    const items = category ? courses.filter((c) => c.category === category) : courses;
    sendJson(res, envelope({ items, categories: [...new Set(courses.map((c) => c.category))] }));
  }

  @Get('courses/:id')
  @ApiOperation({ summary: '课程详情' })
  @ApiParam({ name: 'id' })
  async courseDetail(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(150);
    const course = courses.find((item) => item.id === id);
    if (!course) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '课程不存在'), 404);
      return;
    }
    sendJson(res, envelope({ ...course, coach: coaches[course.coachId] }));
  }

  @Get('coaches/:id')
  @ApiOperation({ summary: '教练详情' })
  @ApiParam({ name: 'id' })
  async coachDetail(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(120);
    const coach = coaches[id];
    if (!coach) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '教练不存在'), 404);
      return;
    }
    sendJson(res, envelope({
        ...coach,
        courses: courses.filter((c) => c.coachId === id).map((c) => ({ id: c.id, title: c.title })),
      }));
  }

  @Post('courses/:id/book')
  @ApiOperation({ summary: '预约课程；满员为业务失败 200' })
  @ApiParam({ name: 'id' })
  async bookCourse(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(320);
    const course = courses.find((item) => item.id === id);
    if (!course) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '课程不存在'), 404);
      return;
    }
    if (course.seatsLeft <= 0) {
      sendJson(res, envelope(null, BizCode.COURSE_FULL, '课程已满员，请选择其他场次'));
      return;
    }
    course.seatsLeft -= 1;
    sendJson(res, envelope({
        bookingId: `bk_${Date.now()}`,
        courseId: id,
        userId: auth.userId,
        startAt: course.startAt,
        status: 'confirmed',
      }));
  }

  @Get('vitals/latest')
  @ApiOperation({ summary: '最新体征' })
  async vitalsLatest(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(130);
    sendJson(res, envelope({
        measuredAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        weightKg: 62.5 + (Number(auth.userId) % 10) * 0.3,
        restingHr: 58 + (Number(auth.userId) % 8),
        sleepHours: 6.5 + (Number(auth.userId) % 5) * 0.2,
        mood: Number(auth.userId) % 2 === 0 ? 'good' : 'ok',
      }));
  }

  @Get('vitals/history')
  @ApiOperation({ summary: '体征历史' })
  async vitalsHistory(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(160);
    const items = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - index);
      return {
        date: day.toISOString().slice(0, 10),
        weightKg: 62 + index * 0.1,
        restingHr: 60 + index,
        sleepHours: 7 - index * 0.1,
      };
    });
    sendJson(res, envelope({ items }));
  }

  @Post('vitals')
  @ApiOperation({ summary: '上报体征' })
  async submitVital(@Body() body: Json, @Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(200);
    const weightKg = Number(body.weightKg);
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 200) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '体重数值不合法'));
      return;
    }
    sendJson(res, envelope({
        id: `vt_${Date.now()}`,
        userId: auth.userId,
        weightKg,
        restingHr: Number(body.restingHr) || null,
        sleepHours: Number(body.sleepHours) || null,
        recordedAt: new Date().toISOString(),
      }));
  }

  @Get('membership')
  @ApiOperation({ summary: '会员信息' })
  async membership(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(140);
    const premium = Number(auth.userId) % 2 === 0;
    sendJson(res, envelope({
        tier: premium ? 'premium' : 'free',
        expiresAt: premium ? daysFromNow(30, 0) : null,
        benefits: premium
          ? ['全部课程预约', '专属训练计划', '体征周报']
          : ['基础训练', '部分公开课'],
        plans: [
          { id: 'plan_month', name: '月度会员', price: 68, period: 'month' },
          { id: 'plan_year', name: '年度会员', price: 598, period: 'year' },
          { id: 'plan_fail', name: '体验开通（演示失败）', price: 1, period: 'trial' },
        ],
      }));
  }

  @Post('membership/orders')
  @ApiOperation({ summary: '会员下单；plan_fail 业务失败 200' })
  async membershipOrder(
    @Body() body: Json,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(380);
    const planId = str(body.planId);
    if (!planId) {
      sendJson(res, envelope(null, BizCode.INVALID_PARAM, '缺少 planId'));
      return;
    }
    if (planId === 'plan_fail') {
      sendJson(res, envelope(null, BizCode.PAYMENT_FAILED, '支付未完成，请更换支付方式后重试'));
      return;
    }
    sendJson(res, envelope({
        orderId: `mo_${Date.now()}`,
        planId,
        userId: auth.userId,
        status: 'paid',
        paidAt: new Date().toISOString(),
      }));
  }

  @Get('me')
  @ApiOperation({ summary: '当前用户资料' })
  async me(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(120);
    sendJson(res, envelope({
        user: userCard(auth.userId),
        goals: {
          steps: 8000,
          activeMin: 45,
          workoutsPerWeek: 4,
        },
        preferences: {
          reminderHour: 8,
          units: 'metric',
        },
      }));
  }

  @Put('me/profile')
  @ApiOperation({ summary: '更新资料' })
  async updateProfile(
    @Body() body: Json,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(160);
    sendJson(res, envelope({
        user: {
          ...userCard(auth.userId),
          name: str(body.name) ?? userCard(auth.userId).name,
          city: str(body.city) ?? '上海',
        },
        updatedAt: new Date().toISOString(),
      }));
  }

  @Put('me/goals')
  @ApiOperation({ summary: '更新目标' })
  async updateGoals(
    @Body() body: Json,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(140);
    sendJson(res, envelope({
        goals: {
          steps: Number(body.steps) || 8000,
          activeMin: Number(body.activeMin) || 45,
          workoutsPerWeek: Number(body.workoutsPerWeek) || 4,
        },
        updatedAt: new Date().toISOString(),
      }));
  }

  @Get('notices')
  @ApiOperation({ summary: '消息通知' })
  async notices(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const auth = requireAuth(authorization, res);
    if (!auth) return;
    await delay(110);
    sendJson(res, envelope({
        items: [
          {
            id: 'nt_1',
            title: '本周训练提醒',
            body: '你已连续打卡，今晚 19:00 有单车 Live。',
            createdAt: new Date(Date.now() - 3600_000).toISOString(),
            read: false,
          },
          {
            id: 'nt_2',
            title: '会员权益更新',
            body: '高级会员可解锁普拉提小班预约。',
            createdAt: new Date(Date.now() - 86400_000).toISOString(),
            read: true,
          },
        ],
      }));
  }

  @Get('lab/slow')
  @ApiOperation({ summary: '慢请求演练' })
  async labSlow() {
    await delay(1800);
    return envelope({ ok: true, latencyMs: 1800 });
  }

  @Get('lab/not-found')
  @ApiOperation({ summary: '404 演练' })
  labNotFound(@Res() res: Response) {
    sendJson(res, envelope(null, BizCode.INVALID_PARAM, 'lab resource not found'), 404);
  }

  @Get('lab/unavailable')
  @ApiOperation({ summary: '503 演练' })
  labUnavailable(@Res() res: Response) {
    sendJson(res, envelope(null, 50300, 'lab service unavailable'), 503);
  }
}

function envelope(data: unknown, code: number = BizCode.OK, message = 'ok') {
  const requestId = `req_${randomUUID().slice(0, 12)}`;
  return {
    code,
    message,
    data,
    requestId,
  };
}

/** Same requestId in JSON body and x-request-id header. */
function sendJson(res: Response, body: ReturnType<typeof envelope>, statusCode?: number) {
  res.setHeader('x-request-id', body.requestId);
  if (statusCode !== undefined) {
    res.status(statusCode).json(body);
  } else {
    res.json(body);
  }
}

function requireAuth(
  authorization: string | undefined,
  res: Response,
): { userId: string; token: string } | null {
  const token = bearer(authorization);
  if (!token) {
    sendJson(res, envelope(null, 40100, '未登录或 token 无效'), 401);
    return null;
  }
  const session = sessions.get(token);
  if (!session) {
    // Demo convenience: accept pf_<userId>_... even after restart
    const match = /^pf_(\d{2,3})_/.exec(token);
    if (match) {
      const restored = { userId: match[1], token };
      sessions.set(token, restored);
      return restored;
    }
    sendJson(res, envelope(null, 40100, '未登录或 token 无效'), 401);
    return null;
  }
  return session;
}

function bearer(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token;
}

function userCard(userId: string) {
  const premium = Number(userId) % 2 === 0;
  return {
    userId,
    name: `运动达人 ${userId}`,
    tier: premium ? 'premium' : 'free',
    city: '上海',
    avatarTone: premium ? 'amber' : 'teal',
  };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好，准备开练了吗？';
  if (hour < 18) return '下午好，保持活力！';
  return '晚上好，拉伸放松一下吧';
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
