import { useNavigate, useSearch } from '@tanstack/react-router';
import { AlertTriangle, ArrowUpRight, Network } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '../../components/ui/item';
import { Skeleton } from '../../components/ui/skeleton';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import {
  useBusinessActionSummaryQuery,
  useBusinessCatalogQuery,
  useDimensionsQuery,
  useErrorCatalogQuery,
  useFailureTimeseriesQuery,
  useHttpCatalogQuery,
  usePerformanceQuery,
} from '../../shared/datasource/queries';
import type { BusinessActionSummaryItem, FailureTimeseriesPoint, SessionFilters } from '../../shared/datasource/types';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

const qualityConfig = {
  failedHttp: { label: '失败 HTTP', color: 'var(--chart-1)' },
  errors: { label: '稳定性错误', color: 'var(--chart-4)' },
  businessFailures: { label: '业务失败', color: 'var(--chart-2)' },
} satisfies ChartConfig;
const httpConfig = {
  httpTotal: { label: '请求量', color: 'var(--chart-2)' },
  failureRate: { label: '失败率', color: 'var(--destructive)' },
} satisfies ChartConfig;
const businessConfig = {
  businessSuccess: { label: '成功', color: 'var(--chart-2)' },
  businessFailures: { label: '失败', color: 'var(--destructive)' },
  businessCancelled: { label: '取消', color: 'var(--chart-3)' },
} satisfies ChartConfig;
const startupConfig = { averageMs: { label: '平均耗时', color: 'var(--chart-1)' } } satisfies ChartConfig;
const actionConfig = {
  total: { label: '总量', color: 'var(--chart-2)' },
  failed: { label: '失败', color: 'var(--destructive)' },
} satisfies ChartConfig;

export function DashboardRoute() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const scope = scopeQuery(search);
  const dimensions = useDimensionsQuery(scope);
  const performance = usePerformanceQuery({ ...scope, limit: 80 });
  const trend = useFailureTimeseriesQuery(scope, bucketFor(scope));
  const actions = useBusinessActionSummaryQuery(scope, 8);
  const business = useBusinessCatalogQuery({ ...scope, limit: 1, offset: 0 });
  const businessFailed = useBusinessCatalogQuery({ ...scope, result: ['failed'], limit: 1, offset: 0 });
  const errors = useErrorCatalogQuery({ ...scope, limit: 6, offset: 0 });
  const failedHttp = useHttpCatalogQuery({ ...scope, result: ['failed'], limit: 6, offset: 0 });
  const overview = performance.data;
  const startupTarget = overview?.startup.events.find((event) => event.sessionId && event.eventId);
  const points = trend.data?.points ?? [];
  const rangeText = trend.data
    ? `${formatDateTime(trend.data.from)} 至 ${formatDateTime(trend.data.to)}`
    : '未选择范围时默认近 24 小时';
  const patchScope = (patch: Record<string, unknown>) => void navigate({
    search: (current) => clean({ ...current, ...patch }),
    replace: true,
  });
  const problems = [
    ...(failedHttp.data?.items ?? []).map((item) => ({
      id: item.eventId,
      title: `${item.method ?? 'HTTP'} ${pathOnly(item.url)}`,
      meta: `失败 HTTP · ${formatDateTime(item.timestamp)}`,
      href: `/http?eventId=${encodeURIComponent(item.eventId)}&detail=${encodeURIComponent(item.eventId)}`,
    })),
    ...(errors.data?.items ?? []).map((item) => ({
      id: item.eventId,
      title: item.message ?? item.type,
      meta: `${item.kind === 'business_failure' ? '业务失败' : '稳定性错误'} · ${formatDateTime(item.timestamp)}`,
      href: `/errors?eventId=${encodeURIComponent(item.eventId)}&detail=${encodeURIComponent(item.eventId)}`,
    })),
  ].slice(0, 8);

  const summaries = [
    {
      label: '启动',
      value: overview?.startup.count ?? 0,
      detail: `冷启动平均 ${formatDuration(overview?.startup.coldStart.averageMs)} · 最慢 ${formatDuration(overview?.startup.coldStart.maxMs)}`,
      target: startupTarget
        ? `/sessions/${encodeURIComponent(startupTarget.sessionId!)}?eventId=${encodeURIComponent(startupTarget.eventId!)}`
        : undefined,
      issue: false,
    },
    {
      label: 'HTTP',
      value: overview?.http.count ?? 0,
      detail: `${overview?.http.failedCount ?? 0} 失败 · ${overview?.http.slowCount ?? 0} 慢请求`,
      target: href('/http', search, { result: 'failed' }),
      issue: Boolean(overview?.http.failedCount),
    },
    {
      label: '埋点',
      value: business.data?.total ?? 0,
      detail: `${businessFailed.data?.total ?? 0} 个失败动作`,
      target: href('/business', search, { result: 'failed' }),
      issue: Boolean(businessFailed.data?.total),
    },
    {
      label: '异常',
      value: errors.data?.total ?? 0,
      detail: `${overview?.errors.affectedSessionCount ?? 0} 个受影响 Session`,
      target: href('/errors', search),
      issue: Boolean(errors.data?.total),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={patchScope} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <section aria-label="核心指标" className="grid gap-4 px-4 md:grid-cols-2 lg:px-6 xl:grid-cols-4">
            {summaries.map(({ label, value, detail, target, issue }) => (
              <Card key={label} className="h-full">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={issue ? 'destructive' : 'secondary'}>{issue ? '异常' : '正常'}</Badge>
                    {target ? (
                      <Button asChild size="icon" variant="ghost" aria-label={`查看${label}`}>
                        <a href={target}><ArrowUpRight data-icon="inline-start" /></a>
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardFooter className="text-sm text-muted-foreground">{detail}</CardFooter>
              </Card>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 px-4 lg:px-6 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHeader>
                <CardTitle>质量趋势</CardTitle>
                <CardDescription>{rangeText}</CardDescription>
              </CardHeader>
              <CardContent><QualityTrend query={trend} points={points} search={search} /></CardContent>
            </Card>
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>HTTP 健康</CardTitle>
                <CardDescription>请求量与失败率</CardDescription>
              </CardHeader>
              <CardContent><HttpHealth query={trend} points={points} search={search} /></CardContent>
            </Card>
            <Card className="xl:col-span-8">
              <CardHeader>
                <CardTitle>埋点结果趋势</CardTitle>
                <CardDescription>成功、失败与取消动作</CardDescription>
              </CardHeader>
              <CardContent><BusinessTrend query={trend} points={points} search={search} /></CardContent>
            </Card>
            <Card className="xl:col-span-4">
              <CardHeader>
                <CardTitle>业务动作排行</CardTitle>
                <CardDescription>按当前范围统计 Top Action</CardDescription>
              </CardHeader>
              <CardContent><ActionRanking query={actions} items={actions.data?.items ?? []} search={search} /></CardContent>
            </Card>
            <Card className="xl:col-span-8">
              <CardHeader>
                <CardTitle>启动趋势</CardTitle>
                <CardDescription>冷启动平均耗时与慢启动次数</CardDescription>
              </CardHeader>
              <CardContent><StartupTrend query={trend} points={points} /></CardContent>
            </Card>
            <Card className="xl:col-span-4">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>最近问题</CardTitle>
                  <CardDescription>失败 HTTP、业务失败与稳定性错误</CardDescription>
                </div>
                <Badge variant={problems.length ? 'destructive' : 'secondary'}>{problems.length}</Badge>
              </CardHeader>
              <CardContent>
                {problems.length ? (
                  <ItemGroup>
                    {problems.map((item, index) => (
                      <div key={item.id}>
                        <Item asChild size="sm">
                          <a href={item.href}>
                            <ItemMedia variant="icon"><AlertTriangle /></ItemMedia>
                            <ItemContent>
                              <ItemTitle className="line-clamp-1">{item.title}</ItemTitle>
                              <ItemDescription>{item.meta}</ItemDescription>
                            </ItemContent>
                            <ItemActions><ArrowUpRight /></ItemActions>
                          </a>
                        </Item>
                        {index < problems.length - 1 ? <ItemSeparator /> : null}
                      </div>
                    ))}
                  </ItemGroup>
                ) : <ChartEmpty title="当前没有问题" description="范围内没有失败 HTTP 或异常" />}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function QualityTrend({ query, points, search }: ChartProps) {
  const data = chartData(points);
  if (!hasPoint(points, (point) => point.failedHttp + point.errors + point.businessFailures)) return <ChartState query={query} />;
  return (
    <>
      <ChartContainer config={qualityConfig} className="h-64 w-full">
        <AreaChart accessibilityLayer data={data} onClick={(state) => drillBucket(state?.activeLabel, points, '/errors', search)}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="failedHttp" type="natural" fill="var(--color-failedHttp)" fillOpacity={0.2} stroke="var(--color-failedHttp)" stackId="quality" />
          <Area dataKey="errors" type="natural" fill="var(--color-errors)" fillOpacity={0.2} stroke="var(--color-errors)" stackId="quality" />
          <Area dataKey="businessFailures" type="natural" fill="var(--color-businessFailures)" fillOpacity={0.2} stroke="var(--color-businessFailures)" stackId="quality" />
        </AreaChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-2 pt-4">
        <Button size="sm" variant="outline" asChild><a href={href('/http', search, { result: 'failed' })}>失败 HTTP</a></Button>
        <Button size="sm" variant="outline" asChild><a href={href('/errors', search)}>查看异常</a></Button>
      </div>
    </>
  );
}

function HttpHealth({ query, points, search }: ChartProps) {
  const data = chartData(points).map((point) => ({
    ...point,
    failureRate: point.httpTotal ? Number(((point.failedHttp / point.httpTotal) * 100).toFixed(1)) : 0,
  }));
  if (!hasPoint(points, (point) => point.httpTotal)) return <ChartState query={query} />;
  return (
    <ChartContainer config={httpConfig} className="h-64 w-full">
      <ComposedChart accessibilityLayer data={data} onClick={(state) => drillBucket(state?.activeLabel, points, '/http', search)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="httpTotal" fill="var(--color-httpTotal)" radius={4} />
        <Line dataKey="failureRate" type="natural" stroke="var(--color-failureRate)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartContainer>
  );
}

function BusinessTrend({ query, points, search }: ChartProps) {
  const data = chartData(points);
  if (!hasPoint(points, (point) => point.businessSuccess + point.businessFailures + point.businessCancelled)) return <ChartState query={query} />;
  return (
    <ChartContainer config={businessConfig} className="h-64 w-full">
      <BarChart accessibilityLayer data={data} onClick={(state) => drillBucket(state?.activeLabel, points, '/business', search)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="businessSuccess" stackId="business" fill="var(--color-businessSuccess)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="businessFailures" stackId="business" fill="var(--color-businessFailures)" />
        <Bar dataKey="businessCancelled" stackId="business" fill="var(--color-businessCancelled)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function ActionRanking({ query, items, search }: { query: QueryLike; items: BusinessActionSummaryItem[]; search: Record<string, unknown> }) {
  if (query.isLoading) return <ChartLoading />;
  if (query.isError) return <ChartEmpty title="排行加载失败" description="请稍后重试" danger />;
  if (!items.length) return <ChartEmpty title="没有业务动作" description="当前范围没有可排行的埋点" />;
  const data = items.slice(0, 6).map((item) => ({ action: item.action, total: item.total, failed: item.failed }));
  return (
    <>
      <ChartContainer config={actionConfig} className="h-52 w-full">
        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid horizontal={false} />
          <YAxis dataKey="action" type="category" tickLine={false} axisLine={false} width={110} tickFormatter={(value) => String(value).slice(0, 16)} />
          <XAxis type="number" hide />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          <Bar dataKey="failed" fill="var(--color-failed)" radius={4} />
        </BarChart>
      </ChartContainer>
      <ItemGroup>
        {items.slice(0, 4).map((item, index) => (
          <div key={item.action}>
            <Item asChild size="sm">
              <a href={href('/business', search, { action: item.action })}>
                <ItemContent><ItemTitle>{item.action}</ItemTitle><ItemDescription>{item.total} 次</ItemDescription></ItemContent>
                <ItemActions><Badge variant={item.failed ? 'destructive' : 'secondary'}>{item.failed} 失败</Badge></ItemActions>
              </a>
            </Item>
            {index < Math.min(items.length, 4) - 1 ? <ItemSeparator /> : null}
          </div>
        ))}
      </ItemGroup>
    </>
  );
}

function StartupTrend({ query, points }: Omit<ChartProps, 'search'>) {
  const data = chartData(points).map((row, index) => ({
    ...row,
    averageMs: points[index].coldStartCount ? Math.round(points[index].coldStartTotalMs / points[index].coldStartCount) : 0,
  }));
  if (!hasPoint(points, (point) => point.coldStartCount)) return <ChartState query={query} />;
  return (
    <>
      <ChartContainer config={startupConfig} className="h-64 w-full">
        <LineChart accessibilityLayer data={data} onClick={(state) => {
          const point = points.find((item) => bucketLabel(item) === state?.activeLabel);
          if (point?.startupEventId && point.startupSessionId) {
            window.location.assign(`/sessions/${encodeURIComponent(point.startupSessionId)}?eventId=${encodeURIComponent(point.startupEventId)}`);
          }
        }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono font-medium">{formatDuration(Number(value))}</span>} />} />
          <Line dataKey="averageMs" type="natural" stroke="var(--color-averageMs)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-2 pt-4">
        {points.filter((point) => point.coldStartSlowCount > 0).slice(-4).map((point) => (
          <Button
            key={point.from}
            size="sm"
            variant="outline"
            disabled={!point.startupEventId || !point.startupSessionId}
            onClick={() => point.startupEventId && point.startupSessionId && window.location.assign(`/sessions/${encodeURIComponent(point.startupSessionId)}?eventId=${encodeURIComponent(point.startupEventId)}`)}
          >
            {bucketLabel(point)} · {point.coldStartSlowCount} 次慢启动
          </Button>
        ))}
      </div>
    </>
  );
}

function ChartState({ query }: { query: QueryLike }) {
  return query.isLoading
    ? <ChartLoading />
    : query.isError
      ? <ChartEmpty title="图表加载失败" description="请检查服务后重试" danger />
      : <ChartEmpty title="当前范围没有数据" description="调整日期或其它范围条件" />;
}

function ChartLoading() {
  return <div className="flex h-64 flex-col gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="w-full flex-1" /></div>;
}

function ChartEmpty({ title, description, danger }: { title: string; description: string; danger?: boolean }) {
  return (
    <Empty className="h-64 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">{danger ? <AlertTriangle className="text-destructive" /> : <Network />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

type QueryLike = { isLoading: boolean; isError: boolean };
type ChartProps = { query: QueryLike; points: FailureTimeseriesPoint[]; search: Record<string, unknown> };

function chartData(points: FailureTimeseriesPoint[]) {
  return points.map((point) => ({ ...point, bucket: bucketLabel(point) }));
}

function hasPoint(points: FailureTimeseriesPoint[], read: (point: FailureTimeseriesPoint) => number) {
  return points.some((point) => read(point) > 0);
}

function drillBucket(label: unknown, points: FailureTimeseriesPoint[], path: string, search: Record<string, unknown>) {
  if (typeof label !== 'string') return;
  const point = points.find((item) => bucketLabel(item) === label);
  if (point) window.location.assign(href(path, search, { from: point.from, to: point.to }));
}

function bucketLabel(point: FailureTimeseriesPoint) {
  return formatDateTime(point.from).slice(5, 16);
}

function scopeQuery(search: Record<string, unknown>): SessionFilters {
  const list = (value: unknown) => typeof value === 'string' ? value.split(',').filter(Boolean) : undefined;
  return {
    appKey: list(search.appKey),
    packageName: list(search.packageName),
    environment: list(search.environment),
    appVersion: list(search.appVersion),
    devicePlatform: list(search.devicePlatform),
    from: typeof search.from === 'string' ? search.from : undefined,
    to: typeof search.to === 'string' ? search.to : undefined,
    userId: list(search.userId),
    sessionId: list(search.sessionId),
    route: list(search.route),
  };
}

function bucketFor(scope: SessionFilters) {
  const span = (Date.parse(scope.to ?? '') || Date.now()) - (Date.parse(scope.from ?? '') || Date.now() - 86400000);
  return span > 7 * 86400000 ? 'day' : 'hour';
}

function pathOnly(url?: string) {
  if (!url) return '未知 URL';
  try { return new URL(url).pathname; } catch { return url; }
}

function href(path: string, search: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...search, ...extra })) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return `${path}${params.size ? `?${params}` : ''}`;
}

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as T;
}
