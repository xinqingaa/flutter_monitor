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
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
import { Badge } from '../../components/ui/badge';
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
import { pickDimensionScopeSearch, readScopeFilters, scopeToSessionFilters } from '../../features/scope/scope-filters';
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

const experienceConfig = {
  coldStarts: { label: '冷启动', color: 'var(--chart-1)' },
  pageLoads: { label: '页面进入', color: 'var(--chart-2)' },
  coldAverageMs: { label: '冷启动耗时', color: 'var(--chart-4)' },
  pageAverageMs: { label: '页面加载耗时', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const statusColors = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-3)'];

const healthConfig = {
  value: { label: 'Session', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const rankConfig = {
  count: { label: '总量', color: 'var(--chart-3)' },
  failed: { label: '失败', color: 'var(--destructive)' },
} satisfies ChartConfig;

const radarConfig = {
  value: { label: '质量风险', color: 'var(--chart-1)' },
} satisfies ChartConfig;

type CatalogPath = '/sessions' | '/http' | '/business' | '/errors';

export function OverviewRoute() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const queryClient = useQueryClient();
  const rawScope = scopeToSessionFilters(readScopeFilters(search));
  const scope = { ...rawScope, from: undefined, to: undefined };
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
  const catalogSearch = pickDimensionScopeSearch(search);

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
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={(patch) => void navigate({ search: (current) => ({ ...current, ...patch }) })} showTime={false} />
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
              tone="blue"
              icon={Rocket}
              label="启动质量"
              value={compactNumber(data?.startup.count)}
              detail={`冷启动 ${formatDuration(data?.startup.coldStart.averageMs)} · 热启动 ${formatDuration(data?.startup.hotResume.averageMs)}`}
              trend={data?.startup.coldStart.maxMs ? `最慢 ${formatDuration(data.startup.coldStart.maxMs)}` : '等待启动数据'}
              spark={durationSpark(data?.startup.events)}
              onClick={() => openSession(data?.startup.coldStart.maxEventId ? data.startup.events.find((event) => event.eventId === data.startup.coldStart.maxEventId) : data?.startup.events[0])}
            />
            <DashboardKpiCard
              tone="violet"
              icon={Globe2}
              label="HTTP 请求"
              value={compactNumber(data?.http.total)}
              detail={`${compactNumber(data?.http.failed)} 失败 · ${compactNumber(data?.http.slow)} 慢请求`}
              trend={`P95 ${formatDuration(data?.http.p95Ms)}`}
              spark={numberSpark(data?.points, 'httpTotal')}
              onClick={() => openCatalog('/http')}
              issue={Boolean(data?.http.failed)}
            />
            <DashboardKpiCard
              tone="amber"
              icon={Layers3}
              label="页面体验"
              value={compactNumber(data?.pages.count)}
              detail={`首帧 ${formatDuration(data?.pages.firstFrame.averageMs)} · 停留 ${formatDuration(data?.pages.stay.averageMs)}`}
              trend={`最慢 ${formatDuration(data?.pages.load.maxMs)}`}
              spark={durationSpark(data?.pages.events)}
              onClick={() => openCatalog('/sessions')}
            />
            <DashboardKpiCard
              tone="coral"
              icon={ShieldAlert}
              label="稳定性"
              value={compactNumber(data?.errorsSummary.total)}
              detail={`${compactNumber(data?.errorsSummary.affectedSessions)} 个受影响 Session · ${compactNumber(data?.errorsSummary.fatal)} 致命`}
              trend={`${compactNumber(data?.business.failed)} 个业务失败`}
              spark={numberSpark(data?.points, 'errors')}
              onClick={() => openCatalog('/errors')}
              issue={Boolean(data?.errorsSummary.total)}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="overview-panel xl:col-span-8">
              <CardHeader>
                <CardTitle>启动与页面体验</CardTitle>
                <CardDescription>冷启动、页面进入和加载耗时的同轴观察</CardDescription>
              </CardHeader>
              <CardContent>
                <ExperienceChart query={overview} data={data} onBucket={(point) => openCatalog('/sessions', { from: point.from, to: point.to })} onSession={openSession} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>HTTP 状态分布</CardTitle>
                <CardDescription>点击状态码直接查看请求</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusDonut query={overview} items={data?.http.statuses ?? []} onSelect={(status) => openCatalog('/http', { statusCode: status })} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-8">
              <CardHeader>
                <CardTitle>HTTP 耗时分布</CardTitle>
                <CardDescription>悬停查看数量，点击进入请求排查</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBars query={overview} items={data?.http.durationDistribution ?? []} config={rankConfig} onSelect={(key) => openCatalog('/http', key.startsWith('>=') ? { slowOnly: true, slowThresholdMs: 3000 } : { sortBy: 'durationMs', sortDir: 'desc' })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>Session 健康</CardTitle>
                <CardDescription>问题会话与正常会话</CardDescription>
              </CardHeader>
              <CardContent>
                <HealthDonut query={overview} items={data?.sessions.health ?? []} onSelect={(key) => openCatalog('/sessions', key === '有问题' ? { problemType: 'error' } : {})} />
              </CardContent>
            </Card>

            <Card className="overview-panel xl:col-span-6">
              <CardHeader>
                <CardTitle>埋点动作排行</CardTitle>
                <CardDescription>总量与失败动作并列展示</CardDescription>
              </CardHeader>
              <CardContent>
                <RankBars query={overview} items={data?.business.actions ?? []} config={rankConfig} onSelect={(key) => openCatalog('/business', { action: key })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-6">
              <CardHeader>
                <CardTitle>页面路由排行</CardTitle>
                <CardDescription>访问量和平均加载耗时</CardDescription>
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
                <RankBars query={overview} items={data?.errorsSummary.types ?? []} config={{ count: { label: '次数', color: 'var(--chart-4)' } }} onSelect={(key) => openCatalog('/errors', { errorType: key })} />
              </CardContent>
            </Card>
            <Card className="overview-panel xl:col-span-4">
              <CardHeader>
                <CardTitle>质量雷达</CardTitle>
                <CardDescription>当前维度下的风险轮廓</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityRadar query={overview} data={data} />
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

          <p className="px-1 text-xs text-muted-foreground">图表是当前维度的查询快照。点击后的时间桶只作为 Catalog 的一次性排查条件，不改变概览状态。</p>
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
  onClick,
  issue,
}: {
  tone: 'blue' | 'violet' | 'amber' | 'coral';
  icon: typeof Rocket;
  label: string;
  value: string;
  detail: string;
  trend: string;
  spark: Array<{ value: number }>;
  onClick: () => void;
  issue?: boolean;
}) {
  return (
    <button type="button" className="overview-kpi-card text-left" data-tone={tone} onClick={onClick}>
      <div className="overview-kpi-icon"><Icon /></div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{label}</span>
          <strong className="text-3xl font-semibold tabular-nums">{value}</strong>
        </div>
        <Badge variant={issue ? 'destructive' : 'secondary'}>{issue ? '关注' : '稳定'}</Badge>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <span className="text-xs opacity-75">{detail}</span>
        <Sparkline values={spark} />
      </div>
      <span className="mt-2 flex items-center gap-1 text-xs font-medium"><ArrowUpRight />{trend}</span>
    </button>
  );
}

function Sparkline({ values }: { values: Array<{ value: number }> }) {
  if (!values.length) return <span className="h-10 w-20 text-xs opacity-60">暂无</span>;
  return (
    <ChartContainer config={{ value: { label: '值', color: 'currentColor' } }} className="h-10 w-20 shrink-0 text-current">
      <AreaChart data={values} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
        <Area dataKey="value" type="natural" fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth={2} />
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator />} />
      </AreaChart>
    </ChartContainer>
  );
}

function ExperienceChart({ query, data, onBucket, onSession }: { query: QueryLike; data?: OverviewAnalytics; onBucket: (point: AnalyticsPoint) => void; onSession: (event?: PerformanceMetricEvent) => void }) {
  const points = experiencePoints(data);
  if (!points.some((point) => point.coldStarts + point.pageLoads > 0)) return <ChartState query={query} emptyDescription="当前维度暂无启动或页面事件" />;
  return (
    <ChartContainer config={experienceConfig} className="h-72 w-full">
      <ComposedChart accessibilityLayer data={points} onClick={(state) => {
        const point = points.find((item) => item.bucket === state?.activeLabel);
        if (!point) return;
        if (point.startupEvent) onSession(point.startupEvent);
        else if (data?.points) onBucket(data.points.find((item) => item.from === point.from) ?? data.points[0]);
      }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="count" tickLine={false} axisLine={false} width={30} />
        <YAxis yAxisId="duration" orientation="right" tickLine={false} axisLine={false} width={38} tickFormatter={(value) => `${value}ms`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="count" dataKey="coldStarts" fill="var(--color-coldStarts)" radius={4} />
        <Bar yAxisId="count" dataKey="pageLoads" fill="var(--color-pageLoads)" radius={4} />
        <Line yAxisId="duration" dataKey="coldAverageMs" type="natural" stroke="var(--color-coldAverageMs)" strokeWidth={2} dot={false} />
        <Line yAxisId="duration" dataKey="pageAverageMs" type="natural" stroke="var(--color-pageAverageMs)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function StatusDonut({ query, items, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无 HTTP 状态数据" />;
  const chartData = items.slice(0, 6).map((item) => ({ name: item.key, value: item.count }));
  return (
    <ChartContainer config={healthConfig} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2} onClick={(entry) => onSelect(String(entry?.name ?? ''))}>
          {chartData.map((item, index) => <Cell key={item.name} fill={statusColors[index % statusColors.length]} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function HealthDonut({ query, items, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无 Session 数据" />;
  const chartData = items.map((item) => ({ name: item.key, value: item.count }));
  return (
    <ChartContainer config={healthConfig} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={94} onClick={(entry) => onSelect(String(entry?.name ?? ''))}>
          {chartData.map((item, index) => <Cell key={item.name} fill={statusColors[index % statusColors.length]} />)}
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
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无埋点结果" />;
  return (
    <ChartContainer config={healthConfig} className="h-72 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={items} dataKey="value" nameKey="name" innerRadius={56} outerRadius={94} onClick={(entry) => onSelect(String(entry?.key ?? ''))}>
          {items.map((item, index) => <Cell key={item.key} fill={statusColors[index % statusColors.length]} />)}
        </Pie>
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  );
}

function RankBars({ query, items, config, onSelect }: { query: QueryLike; items: AnalyticsGroupItem[]; config: ChartConfig; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无排行数据" />;
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart accessibilityLayer data={items.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 12 }} onClick={(state) => {
        if (typeof state?.activeLabel === 'string') onSelect(state.activeLabel);
      }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={112} tickFormatter={(value) => String(value).slice(0, 16)} />
        <XAxis type="number" hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
        <Bar dataKey="failed" fill="var(--color-failed)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

function RouteBars({ query, items, onSelect }: { query: QueryLike; items: MetricGroupSummary[]; onSelect: (value: string) => void }) {
  if (!items.length) return <ChartState query={query} emptyDescription="当前维度暂无页面路由数据" />;
  const data = items.slice(0, 8).map((item) => ({ key: item.key, count: item.count, averageMs: item.averageMs ?? 0 }));
  return (
    <ChartContainer config={{ count: { label: '进入次数', color: 'var(--chart-3)' }, averageMs: { label: '平均加载', color: 'var(--chart-4)' } }} className="h-72 w-full">
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 8, right: 12 }} onClick={(state) => {
        if (typeof state?.activeLabel === 'string') onSelect(state.activeLabel);
      }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} width={120} tickFormatter={(value) => String(value).slice(0, 16)} />
        <XAxis type="number" hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

function QualityRadar({ query, data }: { query: QueryLike; data?: OverviewAnalytics }) {
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
      <RadarChart data={chartData} outerRadius="68%">
        <ChartTooltip content={<ChartTooltipContent />} />
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

function experiencePoints(data?: OverviewAnalytics) {
  if (!data?.points.length) return [];
  return data.points.map((point) => {
    const startup = data.startup.events.filter((event) => inBucket(event, point));
    const pages = data.pages.events.filter((event) => inBucket(event, point));
    const cold = startup.filter((event) => event.name === 'app.cold_start');
    const pageLoads = pages.filter((event) => event.name === 'page.load');
    return {
      bucket: bucketLabel(point.from),
      from: point.from,
      coldStarts: cold.length,
      pageLoads: pageLoads.length,
      coldAverageMs: average(cold.map((event) => event.durationMs)),
      pageAverageMs: average(pageLoads.map((event) => numberAttribute(event, 'page.load_ms') ?? event.durationMs)),
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
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : 0;
}

function ratio(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}
