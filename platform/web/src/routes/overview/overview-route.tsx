import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Globe2,
  Layers3,
  Rocket,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Label as RechartsLabel,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../components/ui/chart';
import {
  AnalyticsAttentionList,
  ChartState,
  type QueryLike,
} from '../../features/analytics/analytics-ui';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { pickScopeSearch, readScopeFilters, scopeToSessionFilters } from '../../features/scope/scope-filters';
import {
  useAnalyticsBusinessQuery,
  useAnalyticsErrorsQuery,
  useAnalyticsHttpQuery,
  useAnalyticsOverviewQuery,
  useAnalyticsSessionsQuery,
  useDimensionsQuery,
  usePerformanceQuery,
} from '../../shared/datasource/queries';
import type {
  AnalyticsGroupItem,
  AnalyticsPoint,
  MetricGroupSummary,
  OverviewAnalytics,
  PerformanceMetricEvent,
} from '../../shared/datasource/types';
import { compactNumber, formatDateTime, formatDuration } from '../../shared/formatting/format';

const startupConfig = {
  coldAverageMs: { label: '冷启动平均耗时', color: 'var(--chart-1)' },
  hotAverageMs: { label: '热启动平均耗时', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const pageConfig = {
  loadAverageMs: { label: '页面加载平均耗时', color: 'var(--chart-2)' },
  firstFrameAverageMs: { label: '首帧平均耗时', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const radarConfig = {
  value: { label: '风险指数', color: 'var(--chart-3)' },
} satisfies ChartConfig;

type CatalogPath = '/sessions' | '/http' | '/business' | '/errors';

export function OverviewRoute() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const queryClient = useQueryClient();
  const scope = scopeToSessionFilters(readScopeFilters(search));
  const dimensions = useDimensionsQuery(scope);
  const overview = useAnalyticsOverviewQuery(scope);
  const performance = usePerformanceQuery(scope);
  const sessionsQuery = useAnalyticsSessionsQuery(scope);
  const httpQuery = useAnalyticsHttpQuery(scope);
  const businessQuery = useAnalyticsBusinessQuery(scope);
  const errorsQuery = useAnalyticsErrorsQuery(scope);
  const data = useMemo<OverviewAnalytics | undefined>(() => {
    const base = overview.data;
    if (!base) return undefined;
    if (base.startup && base.pages && base.sessions && base.http && base.business && base.errorsSummary) return base;
    if (!performance.data || !sessionsQuery.data || !httpQuery.data || !businessQuery.data || !errorsQuery.data) return undefined;
    return {
      ...base,
      startup: base.startup ?? performance.data.startup,
      pages: base.pages ?? performance.data.pages,
      sessions: base.sessions ?? {
        activeSessions: sessionsQuery.data.activeSessions,
        problemSessions: sessionsQuery.data.problemSessions,
        averageDurationMs: sessionsQuery.data.averageDurationMs,
        averageEventCount: sessionsQuery.data.averageEventCount,
        health: sessionsQuery.data.health,
        durationDistribution: sessionsQuery.data.durationDistribution,
        eventCountDistribution: sessionsQuery.data.eventCountDistribution,
        routes: sessionsQuery.data.routes,
      },
      http: base.http ?? {
        total: httpQuery.data.total,
        failed: httpQuery.data.failed,
        slow: httpQuery.data.slow,
        affectedSessions: httpQuery.data.affectedSessions,
        averageMs: httpQuery.data.averageMs,
        p50Ms: httpQuery.data.p50Ms,
        p95Ms: httpQuery.data.p95Ms,
        maxMs: httpQuery.data.maxMs,
        statuses: httpQuery.data.statuses,
        endpoints: httpQuery.data.endpoints,
        routes: httpQuery.data.routes,
        durationDistribution: httpQuery.data.durationDistribution,
      },
      business: base.business ?? {
        total: businessQuery.data.total,
        failed: businessQuery.data.failed,
        cancelled: businessQuery.data.cancelled,
        affectedSessions: businessQuery.data.affectedSessions,
        actions: businessQuery.data.actions,
        routes: businessQuery.data.routes,
      },
      errorsSummary: base.errorsSummary ?? {
        total: errorsQuery.data.total,
        affectedSessions: errorsQuery.data.affectedSessions,
        fatal: errorsQuery.data.fatal,
        handled: errorsQuery.data.handled,
        types: errorsQuery.data.types,
        mechanisms: errorsQuery.data.mechanisms,
        routes: errorsQuery.data.routes,
        groups: errorsQuery.data.groups,
      },
    };
  }, [businessQuery.data, errorsQuery.data, httpQuery.data, overview.data, performance.data, sessionsQuery.data]);
  const catalogSearch = pickScopeSearch(search);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
    void queryClient.invalidateQueries({ queryKey: ['performance'] });
    void queryClient.invalidateQueries({ queryKey: ['analyticsSessions'] });
    void queryClient.invalidateQueries({ queryKey: ['analyticsHttp'] });
    void queryClient.invalidateQueries({ queryKey: ['analyticsBusiness'] });
    void queryClient.invalidateQueries({ queryKey: ['analyticsErrors'] });
  };

  const openCatalog = (to: CatalogPath, extra: Record<string, unknown> = {}) => {
    void navigate({ to, search: { ...catalogSearch, ...extra } });
  };

  const openSession = (event?: PerformanceMetricEvent) => {
    if (event?.sessionId) {
      void navigate({
        to: '/sessions/$sessionId',
        params: { sessionId: event.sessionId },
        search: { ...catalogSearch, eventId: event.eventId, traceId: event.traceId },
      });
      return;
    }
    openCatalog('/sessions');
  };

  const timeText = data?.resolvedRange
    ? `${formatDateTime(data.resolvedRange.from)} 至 ${formatDateTime(data.resolvedRange.to)}`
    : '当前保留数据';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={(patch) => void navigate({ search: (current) => ({ ...current, ...patch }) })} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-5 px-4 py-5 md:px-6 md:py-7 xl:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">Flutter Monitor</p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">运行概况</h1>
              <p className="text-sm text-muted-foreground">启动、页面、网络、埋点和稳定性都在这里汇总。</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>覆盖 {timeText}</span>
              <span aria-hidden="true">·</span>
              <span>快照 {data?.resolvedRange.generatedAt ? formatDateTime(data.resolvedRange.generatedAt) : '-'}</span>
              <Button size="icon" variant="ghost" aria-label="刷新概览" onClick={refresh} disabled={overview.isFetching}>
                <Activity className={overview.isFetching ? 'animate-spin' : undefined} />
              </Button>
            </div>
          </header>

          <section aria-label="核心指标" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              tone="slate"
              icon={Rocket}
              label="启动质量"
              value={compactNumber(data?.startup.count)}
              detail={`冷启动 ${formatDuration(data?.startup.coldStart.averageMs)} · 热启动 ${formatDuration(data?.startup.hotResume.averageMs)}`}
              trend={data?.startup.coldStart.maxMs ? `最慢 ${formatDuration(data.startup.coldStart.maxMs)}` : '等待启动数据'}
              spark={durationSpark(data?.startup.events)}
              sparkLabel="启动耗时"
              sparkKind="duration"
              onClick={() => openSession(data?.startup.coldStart.maxEventId ? data.startup.events.find((event) => event.eventId === data.startup.coldStart.maxEventId) : data?.startup.events[0])}
            />
            <DashboardKpiCard
              tone="amber"
              icon={Globe2}
              label="HTTP 请求"
              value={compactNumber(data?.http.total)}
              detail={`失败 ${compactNumber(data?.http.failed)} · 慢请求 ${compactNumber(data?.http.slow)}`}
              trend={`P95 ${formatDuration(data?.http.p95Ms)}`}
              spark={numberSpark(data?.points, 'httpTotal')}
              sparkLabel="请求数"
              sparkKind="count"
              onClick={() => openCatalog('/http')}
            />
            <DashboardKpiCard
              tone="indigo"
              icon={Layers3}
              label="页面体验"
              value={compactNumber(data?.pages.count)}
              detail={`首帧 ${formatDuration(data?.pages.firstFrame.averageMs)} · 停留 ${formatDuration(data?.pages.stay.averageMs)}`}
              trend={`最慢 ${formatDuration(data?.pages.load.maxMs)}`}
              spark={durationSpark(data?.pages.events)}
              sparkLabel="页面耗时"
              sparkKind="duration"
              onClick={() => openCatalog('/sessions')}
            />
            <DashboardKpiCard
              tone="rose"
              icon={ShieldAlert}
              label="稳定性"
              value={compactNumber(data?.errorsSummary.total)}
              detail={`影响 Session ${compactNumber(data?.errorsSummary.affectedSessions)} · 致命 ${compactNumber(data?.errorsSummary.fatal)}`}
              trend={`${compactNumber(data?.business.failed)} 个业务失败`}
              spark={numberSpark(data?.points, 'errors')}
              sparkLabel="异常数"
              sparkKind="count"
              onClick={() => openCatalog('/errors')}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="overview-panel xl:col-span-7">
              <CardHeader>
                <CardTitle>启动耗时趋势</CardTitle>
                <CardDescription>冷启动与热启动使用同一耗时刻度</CardDescription>
              </CardHeader>
              <CardContent>
                <StartupDurationChart query={overview} data={data} onBucket={(point) => openCatalog('/sessions', { from: point.from, to: point.to })} onSession={openSession} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-5">
              <CardHeader>
                <CardTitle>HTTP 状态分布</CardTitle>
                <CardDescription>点击状态码直接查看请求</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusDonut query={overview} items={data?.http.statuses ?? []} onSelect={(status) => openCatalog('/http', { statusCode: status })} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-7">
              <CardHeader>
                <CardTitle>页面加载耗时趋势</CardTitle>
                <CardDescription>页面加载与首帧均以毫秒或秒展示</CardDescription>
              </CardHeader>
              <CardContent>
                <PageDurationChart query={overview} data={data} onBucket={(point) => openCatalog('/sessions', { from: point.from, to: point.to })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-5">
              <CardHeader>
                <CardTitle>Session 健康</CardTitle>
                <CardDescription>问题会话与正常会话</CardDescription>
              </CardHeader>
              <CardContent>
                <HealthDonut query={overview} items={data?.sessions.health ?? []} onSelect={(key) => openCatalog('/sessions', key === '有问题' ? { problemType: 'error' } : {})} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-7">
              <CardHeader>
                <CardTitle>HTTP 耗时分布</CardTitle>
                <CardDescription>悬停查看数量，点击进入请求排查</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBars query={overview} items={data?.http.durationDistribution ?? []} valueLabel="请求数" color="var(--chart-1)" onSelect={(key) => openCatalog('/http', key.startsWith('>=') ? { slowOnly: true, slowThresholdMs: 3000 } : { sortBy: 'durationMs', sortDir: 'desc' })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-5">
              <CardHeader>
                <CardTitle>埋点动作排行</CardTitle>
                <CardDescription>总量与失败动作并列展示</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBars query={overview} items={data?.business.actions ?? []} valueLabel="埋点次数" failedLabel="失败次数" color="var(--chart-3)" onSelect={(key) => openCatalog('/business', { action: key })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-6">
              <CardHeader>
                <CardTitle>页面进入次数排行</CardTitle>
                <CardDescription>按页面进入次数排序，悬停查看平均加载耗时</CardDescription>
              </CardHeader>
              <CardContent>
                <RouteBars query={overview} items={data?.pages.routeSummaries ?? []} onSelect={(route) => openCatalog('/sessions', { route })} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>异常类型</CardTitle>
                <CardDescription>稳定性错误与业务失败</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBars query={overview} items={data?.errorsSummary.types ?? []} valueLabel="异常次数" color="var(--chart-4)" onSelect={(key) => openCatalog('/errors', { errorType: key })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>质量雷达</CardTitle>
                <CardDescription>当前维度下的风险轮廓</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityRadar query={overview} data={data} onSelect={(subject) => {
                  if (subject === 'HTTP 失败') openCatalog('/http', { result: 'failed' });
                  else if (subject === '慢请求') openCatalog('/http', { slowOnly: true, slowThresholdMs: 1000 });
                  else if (subject === '埋点失败') openCatalog('/business', { result: 'failed' });
                  else if (subject === '首帧风险') openCatalog('/sessions');
                  else openCatalog('/errors', subject === '致命异常' ? { fatal: true } : {});
                }} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>业务结果</CardTitle>
                <CardDescription>成功、失败与取消</CardDescription>
              </CardHeader>
              <CardContent>
                <BusinessDonut query={overview} data={data} onSelect={(result) => openCatalog('/business', { result })} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-7">
              <CardHeader>
                <CardTitle>最近问题</CardTitle>
                <CardDescription>按影响 Session、次数和发生时间排序</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsAttentionList items={data?.attention ?? []} scopeSearch={catalogSearch} emptyDescription="当前维度没有需要优先处理的问题" />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-5">
              <CardHeader>
                <CardTitle>Session 链路时间线</CardTitle>
                <CardDescription>启动、页面和异常事件的代表节点</CardDescription>
              </CardHeader>
              <CardContent>
                <SessionTimeline events={timelineEvents(data)} onSession={openSession} />
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">点击节点进入 Session 工作区或对应 Catalog</CardFooter>
            </Card>
          </section>

          <p className="px-1 text-xs text-muted-foreground">图表是当前总筛选范围的查询快照。点击时间桶会把对应范围带入 Catalog 继续排查。</p>
        </div>
      </div>
    </div>
  );
}

function DashboardKpiCard({
  tone,
  icon: Icon,
  label,
  value,
  detail,
  trend,
  spark,
  sparkLabel,
  sparkKind,
  onClick,
}: {
  tone: 'slate' | 'amber' | 'rose' | 'indigo';
  icon: typeof Rocket;
  label: string;
  value: string;
  detail: string;
  trend: string;
  spark: Array<{ value: number }>;
  sparkLabel: string;
  sparkKind: 'duration' | 'count';
  onClick: () => void;
}) {
  return (
    <button type="button" className="overview-kpi-card text-left" data-tone={tone} onClick={onClick}>
      <div className="overview-kpi-icon"><Icon /></div>
      <div className="flex flex-col gap-2 pr-10">
        <span className="text-sm font-medium">{label}</span>
        <strong className="text-3xl font-semibold tabular-nums">{value}</strong>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="min-w-0 flex-1 text-xs leading-5 opacity-75">{detail}</span>
        <Sparkline values={spark} label={sparkLabel} kind={sparkKind} />
      </div>
      <span className="mt-2 flex items-center gap-1 text-xs font-medium"><ArrowUpRight />{trend}</span>
    </button>
  );
}

function Sparkline({ values, label, kind }: { values: Array<{ value: number }>; label: string; kind: 'duration' | 'count' }) {
  const [tip, setTip] = useState<{ left: number; top: number; text: string } | null>(null);

  if (!values.length) return <span className="h-10 w-20 text-xs opacity-60">暂无</span>;

  return (
    <>
      <div
        className="relative shrink-0"
        onClick={(event) => event.stopPropagation()}
        onMouseLeave={() => setTip(null)}
      >
        <ChartContainer
          config={{ value: { label, color: 'currentColor' } }}
          className="overview-sparkline aspect-auto h-10 w-20 text-current"
        >
          <AreaChart
            data={values}
            margin={{ top: 3, right: 0, bottom: 0, left: 0 }}
            onMouseMove={(state, event) => {
              const raw = state?.activePayload?.[0]?.value;
              const clientX = 'clientX' in event ? Number(event.clientX) : undefined;
              const clientY = 'clientY' in event ? Number(event.clientY) : undefined;
              if (raw == null || typeof raw !== 'number' || clientX == null || clientY == null) {
                setTip(null);
                return;
              }
              setTip({
                left: clientX + 12,
                top: clientY - 36,
                text: kind === 'duration' ? formatDuration(raw) : compactNumber(raw),
              });
            }}
            onMouseLeave={() => setTip(null)}
          >
            <Area dataKey="value" type="natural" fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </div>
      {tip && typeof document !== 'undefined'
        ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: tip.left, top: tip.top }}
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-medium tabular-nums">{tip.text}</span>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}

function StartupDurationChart({ query, data, onBucket, onSession }: { query: QueryLike; data?: OverviewAnalytics; onBucket: (point: AnalyticsPoint) => void; onSession: (event?: PerformanceMetricEvent) => void }) {
  const points = performancePoints(data);
  if (!points.some((point) => point.coldSamples + point.hotSamples > 0)) return <ChartState query={query} emptyDescription="当前范围暂无启动耗时数据" />;
  return (
    <ChartContainer config={startupConfig} className="h-72 w-full">
      <LineChart accessibilityLayer data={points} margin={{ left: 4, right: 12 }} onClick={(state) => {
        const point = points.find((item) => item.bucket === state?.activeLabel);
        if (!point) return;
        if (point.startupEvent) onSession(point.startupEvent);
        else if (data?.points) onBucket(data.points.find((item) => item.from === point.from) ?? data.points[0]);
      }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={durationAxisLabel} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name, item) => {
          const cold = name === 'coldAverageMs';
          const samples = cold ? item.payload.coldSamples : item.payload.hotSamples;
          return durationTooltipRow(cold ? '冷启动平均耗时' : '热启动平均耗时', Number(value), Number(samples));
        }} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="coldAverageMs" type="monotone" stroke="var(--color-coldAverageMs)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
        <Line dataKey="hotAverageMs" type="monotone" stroke="var(--color-hotAverageMs)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}

function PageDurationChart({ query, data, onBucket }: { query: QueryLike; data?: OverviewAnalytics; onBucket: (point: AnalyticsPoint) => void }) {
  const points = performancePoints(data);
  if (!points.some((point) => point.pageSamples > 0)) return <ChartState query={query} emptyDescription="当前范围暂无页面加载耗时数据" />;
  return (
    <ChartContainer config={pageConfig} className="h-72 w-full">
      <LineChart accessibilityLayer data={points} margin={{ left: 4, right: 12 }} onClick={(state) => {
        const point = points.find((item) => item.bucket === state?.activeLabel);
        const bucket = data?.points.find((item) => item.from === point?.from);
        if (bucket) onBucket(bucket);
      }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={durationAxisLabel} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name, item) => durationTooltipRow(
          name === 'loadAverageMs' ? '页面加载平均耗时' : '首帧平均耗时',
          Number(value),
          Number(item.payload.pageSamples),
        )} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="loadAverageMs" type="monotone" stroke="var(--color-loadAverageMs)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
        <Line dataKey="firstFrameAverageMs" type="monotone" stroke="var(--color-firstFrameAverageMs)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}

function StatusDonut({ query, items, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; onSelect: (value: string) => void }) {
  const chartData = items.slice(0, 6).map((item) => ({ name: item.key, value: item.count, color: httpStatusColor(item.key) }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const [active, setActive] = useState<(typeof chartData)[number]>();
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无 HTTP 状态数据" />;
  return (
    <ChartContainer config={{ value: { label: '请求数', color: 'var(--chart-1)' } }} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator formatter={(value, _name, item) => donutTooltipRow(`状态码 ${item.payload.name}`, Number(value), total, '个请求')} />} />
        <Pie
          className="cursor-pointer"
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={96}
          paddingAngle={2}
          onMouseEnter={(_, index) => setActive(chartData[index])}
          onMouseLeave={() => setActive(undefined)}
          onClick={(entry) => onSelect(String(entry?.name ?? ''))}
        >
          {chartData.map((item) => <Cell key={item.name} fill={item.color} strokeWidth={active?.name === item.name ? 4 : 1} />)}
          <RechartsLabel value={active ? `状态码 ${active.name}` : '请求总数'} position="center" dy={-8} className="fill-muted-foreground text-[11px]" />
          <RechartsLabel value={compactNumber(active?.value ?? total)} position="center" dy={14} className="fill-foreground text-lg font-semibold tabular-nums" />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function HealthDonut({ query, items, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; onSelect: (value: string) => void }) {
  const chartData = items.map((item) => ({ key: item.key, name: item.key === '有问题' ? '问题 Session' : '正常 Session', value: item.count, color: item.key === '有问题' ? 'var(--chart-3)' : 'var(--chart-1)' }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const [active, setActive] = useState<(typeof chartData)[number]>();
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无 Session 数据" />;
  return (
    <ChartContainer config={{ value: { label: 'Session 数', color: 'var(--chart-1)' } }} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator formatter={(value, _name, item) => donutTooltipRow(String(item.payload.name), Number(value), total, '个')} />} />
        <Pie
          className="cursor-pointer"
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={94}
          paddingAngle={2}
          onMouseEnter={(_, index) => setActive(chartData[index])}
          onMouseLeave={() => setActive(undefined)}
          onClick={(entry) => onSelect(String(entry?.key ?? ''))}
        >
          {chartData.map((item) => <Cell key={item.key} fill={item.color} strokeWidth={active?.key === item.key ? 4 : 1} />)}
          <RechartsLabel value={active?.name ?? '活跃 Session'} position="center" dy={-8} className="fill-muted-foreground text-[11px]" />
          <RechartsLabel value={compactNumber(active?.value ?? total)} position="center" dy={14} className="fill-foreground text-lg font-semibold tabular-nums" />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function BusinessDonut({ query, data, onSelect }: { query: QueryLike; data?: OverviewAnalytics; onSelect: (value: string) => void }) {
  const items = data ? [
    { name: '成功', value: Math.max(data.business.total - data.business.failed - data.business.cancelled, 0), key: 'success' },
    { name: '失败', value: data.business.failed, key: 'failed' },
    { name: '取消', value: data.business.cancelled, key: 'cancelled' },
  ].filter((item) => item.value > 0) : [];
  const colors: Record<string, string> = { success: 'var(--chart-1)', failed: 'var(--destructive)', cancelled: 'var(--chart-5)' };
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const [active, setActive] = useState<(typeof items)[number]>();
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无埋点结果" />;
  return (
    <ChartContainer config={{ value: { label: '埋点次数', color: 'var(--chart-1)' } }} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator formatter={(value, _name, item) => donutTooltipRow(`${item.payload.name}埋点`, Number(value), total, '次')} />} />
        <Pie
          className="cursor-pointer"
          data={items}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={94}
          paddingAngle={2}
          onMouseEnter={(_, index) => setActive(items[index])}
          onMouseLeave={() => setActive(undefined)}
          onClick={(entry) => onSelect(String(entry?.key ?? ''))}
        >
          {items.map((item) => <Cell key={item.key} fill={colors[item.key]} strokeWidth={active?.key === item.key ? 4 : 1} />)}
          <RechartsLabel value={active ? `${active.name}埋点` : '埋点总数'} position="center" dy={-8} className="fill-muted-foreground text-[11px]" />
          <RechartsLabel value={compactNumber(active?.value ?? total)} position="center" dy={14} className="fill-foreground text-lg font-semibold tabular-nums" />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function RankBars({ query, items, valueLabel, failedLabel, color, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; valueLabel: string; failedLabel?: string; color: string; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无排行数据" />;
  const config = {
    count: { label: valueLabel, color },
    ...(failedLabel ? { failed: { label: failedLabel, color: 'var(--destructive)' } } : {}),
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart className="cursor-pointer" accessibilityLayer data={items.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 18 }} onClick={(state) => {
        if (typeof state?.activeLabel === 'string') onSelect(state.activeLabel);
      }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={112} tickFormatter={(value) => String(value).slice(0, 16)} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value) => compactNumber(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
          <div className="flex w-full items-center justify-between gap-4">
            <span className="text-muted-foreground">{name === 'failed' ? failedLabel : valueLabel}</span>
            <span className="font-mono font-medium tabular-nums">{compactNumber(Number(value))}</span>
          </div>
        )} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} activeBar={{ fillOpacity: 0.72 }} />
        {failedLabel ? <Bar dataKey="failed" fill="var(--color-failed)" radius={4} activeBar={{ fillOpacity: 0.72 }} /> : null}
      </BarChart>
    </ChartContainer>
  );
}

function RouteBars({ query, items, onSelect }: { query: QueryLike; items: MetricGroupSummary[]; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无页面路由数据" />;
  const data = items.slice(0, 8).map((item) => ({ key: item.key, count: item.count, averageMs: item.averageMs ?? 0 }));
  return (
    <ChartContainer config={{ count: { label: '页面进入次数', color: 'var(--chart-2)' } }} className="h-72 w-full">
      <BarChart className="cursor-pointer" accessibilityLayer data={data} layout="vertical" margin={{ left: 8, right: 18 }} onClick={(state) => {
        if (typeof state?.activeLabel === 'string') onSelect(state.activeLabel);
      }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={120} tickFormatter={(value) => String(value).slice(0, 16)} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value) => compactNumber(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, _name, item) => (
          <div className="grid w-full min-w-44 grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">进入次数</span>
            <span className="font-mono font-medium tabular-nums">{compactNumber(Number(value))}</span>
            <span className="text-muted-foreground">平均加载耗时</span>
            <span className="font-mono font-medium tabular-nums">{formatDuration(Number(item.payload.averageMs))}</span>
          </div>
        )} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} activeBar={{ fillOpacity: 0.72 }} />
      </BarChart>
    </ChartContainer>
  );
}

function QualityRadar({ query, data, onSelect }: { query: QueryLike; data?: OverviewAnalytics; onSelect: (subject: string) => void }) {
  if (!data) return <ChartState query={query} emptyDescription="质量指标正在准备" />;
  const httpFailure = ratio(data.http.failed, data.http.total);
  const httpSlow = ratio(data.http.slow, data.http.total);
  const businessFailure = ratio(data.business.failed, data.business.total);
  const errorRate = ratio(data.errorsSummary.affectedSessions, data.sessions.activeSessions);
  const fatalRate = ratio(data.errorsSummary.fatal, data.errorsSummary.total);
  const firstFrameRisk = Math.min(((data.pages.firstFrame.averageMs ?? 0) / 2000) * 100, 100);
  const chartData = [
    { subject: 'HTTP 失败', value: httpFailure },
    { subject: '慢请求', value: httpSlow },
    { subject: '埋点失败', value: businessFailure },
    { subject: '异常 Session', value: errorRate },
    { subject: '致命异常', value: fatalRate },
    { subject: '首帧风险', value: firstFrameRisk },
  ];
  return (
    <ChartContainer config={radarConfig} className="h-72 w-full">
      <RadarChart className="cursor-pointer" data={chartData} outerRadius="68%" onClick={(state) => {
        if (typeof state?.activeLabel === 'string') onSelect(state.activeLabel);
      }}>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => (
          <div className="flex w-full items-center justify-between gap-4">
            <span className="text-muted-foreground">风险指数</span>
            <span className="font-mono font-medium tabular-nums">{Number(value).toFixed(1)}%</span>
          </div>
        )} />} />
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.22} stroke="var(--color-value)" strokeWidth={2} />
      </RadarChart>
    </ChartContainer>
  );
}

function SessionTimeline({ events, onSession }: { events: PerformanceMetricEvent[]; onSession: (event?: PerformanceMetricEvent) => void }) {
  if (!events.length) return <ChartState query={{ isLoading: false, isError: false }} emptyDescription="暂无可回查的 Session 节点" />;
  return (
    <div className="flex flex-col gap-0">
      {events.map((event, index) => (
        <button key={`${event.eventId}-${index}`} type="button" className="overview-timeline-item text-left" onClick={() => onSession(event)}>
          <span className="overview-timeline-dot" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-medium">{eventLabel(event)}</span>
            <span className="truncate text-xs text-muted-foreground">{event.route ?? '未命名路由'} · {formatDateTime(event.timestamp)}{event.durationMs !== undefined ? ` · ${formatDuration(event.durationMs)}` : ''}</span>
          </span>
          <ArrowUpRight className="shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function performancePoints(data?: OverviewAnalytics) {
  if (!data?.points.length) return [];
  return data.points.map((point) => {
    const startup = data.startup.events.filter((event) => inBucket(event, point));
    const pages = data.pages.events.filter((event) => inBucket(event, point));
    const cold = startup.filter((event) => event.name === 'app.cold_start');
    const hot = startup.filter((event) => event.name === 'app.hot_start' && event.durationMs !== undefined);
    const pageLoads = pages.filter((event) => event.name === 'page.load');
    return {
      bucket: bucketLabel(point.from),
      from: point.from,
      coldSamples: cold.length,
      hotSamples: hot.length,
      pageSamples: pageLoads.length,
      coldAverageMs: average(cold.map((event) => event.durationMs)),
      hotAverageMs: average(hot.map((event) => event.durationMs)),
      loadAverageMs: average(pageLoads.map((event) => numberAttribute(event, 'page.load_ms') ?? event.durationMs)),
      firstFrameAverageMs: average(pageLoads.map((event) => numberAttribute(event, 'page.first_frame_ms') ?? event.durationMs)),
      startupEvent: cold[0],
    };
  });
}

function timelineEvents(data?: OverviewAnalytics) {
  if (!data) return [];
  return [
    ...data.startup.events,
    ...data.pages.events,
    ...data.errorsSummary.types.slice(0, 2).map((item) => ({ eventId: item.eventId, sessionId: item.sessionId, traceId: item.traceId, route: item.route, name: item.key, timestamp: undefined })),
  ].filter((event): event is PerformanceMetricEvent => Boolean(event.eventId || event.sessionId))
    .sort((a, b) => Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? ''))
    .slice(0, 6);
}

function durationSpark(events?: PerformanceMetricEvent[]) {
  return (events ?? []).slice(-12).map((event) => ({ value: event.durationMs ?? numberAttribute(event, 'page.load_ms') ?? 0 }));
}

function numberSpark(points: AnalyticsPoint[] | undefined, key: keyof AnalyticsPoint) {
  return (points ?? []).slice(-12).map((point) => ({ value: Number(point[key] ?? 0) }));
}

function inBucket(event: PerformanceMetricEvent, point: AnalyticsPoint) {
  const timestamp = Date.parse(event.timestamp ?? '');
  return Number.isFinite(timestamp) && timestamp >= Date.parse(point.from) && timestamp <= Date.parse(point.to);
}

function bucketLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
}

function eventLabel(event: PerformanceMetricEvent) {
  if (event.name === 'app.cold_start') return '冷启动';
  if (event.name === 'app.hot_start') return '热启动';
  if (event.name === 'page.load') return '页面进入';
  if (event.name === 'page.stay') return '页面停留';
  return event.name ?? event.signalType ?? '监控事件';
}

function numberAttribute(event: PerformanceMetricEvent, key: string) {
  const value = event.attributes?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function average(values: Array<number | undefined>) {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : undefined;
}

function ratio(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function durationAxisLabel(value: number) {
  if (value >= 1000) return `${Number((value / 1000).toFixed(value >= 10000 ? 0 : 1))}s`;
  return `${Math.round(value)}ms`;
}

function durationTooltipRow(label: string, value: number, samples: number) {
  return (
    <div className="grid w-full min-w-48 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{formatDuration(value)}</span>
      <span className="text-muted-foreground">样本数</span>
      <span className="font-mono font-medium tabular-nums">{compactNumber(samples)}</span>
    </div>
  );
}

function donutTooltipRow(label: string, value: number, total: number, suffix: string) {
  return (
    <div className="grid w-full min-w-40 grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      <span className="font-medium">{label}</span>
      <span className="font-mono font-medium tabular-nums">{compactNumber(value)} {suffix}</span>
      <span className="text-muted-foreground">占比</span>
      <span className="font-mono font-medium tabular-nums">{ratio(value, total).toFixed(1)}%</span>
    </div>
  );
}

function httpStatusColor(status: string) {
  const code = Number.parseInt(status, 10);
  if (code >= 500) return 'var(--destructive)';
  if (code >= 400) return 'var(--chart-3)';
  if (code >= 300) return 'var(--chart-4)';
  if (code >= 200) return 'var(--chart-1)';
  return 'var(--chart-5)';
}
