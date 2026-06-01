import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ListTree, PanelLeft } from 'lucide-react';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type {
  ErrorPerformanceSummary,
  HttpPerformanceSummary,
  JankPerformanceSummary,
  MetricGroupSummary,
  PagePerformanceSummary,
  PerformanceMetricEvent,
  PerformanceMetricSummary,
  StartupPerformanceSummary,
} from '../../shared/datasource/types';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { MetricCard } from './metric-card';
import {
  attrBool,
  attrNumber,
  attrString,
  attributePoint,
  BarChartPanel,
  durationPoint,
  EchartsPanel,
  EventTablePanel,
  groupCount,
  LineChartPanel,
  pieOption,
  SignalSummary,
  type BarDatum,
} from './performance-charts';
import type { WorkbenchChartOption } from './echarts-panel';
import { PerformanceTabs } from './performance-tabs';

export type PerformanceKind = 'startup' | 'pages' | 'network' | 'jank' | 'errors';

export function PerformanceDetailPage({
  kind,
  title,
  description,
  icon,
  metric,
  emphasis,
}: {
  kind: PerformanceKind;
  title: string;
  description: string;
  icon: LucideIcon;
  metric?: PerformanceMetricSummary;
  emphasis?: string;
}) {
  const events = metric?.events ?? [];
  const fieldSummary = fieldSummaryFor(kind, metric);
  const leftPanel = useCollapsiblePanel(`workbench.performance.${kind}.left`);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <PerformanceTabs />
      <div
        className={`grid min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden ${
          leftPanel.collapsed ? 'xl:grid-cols-[40px_minmax(760px,1fr)]' : 'xl:grid-cols-[380px_minmax(760px,1fr)]'
        }`}
      >
        <aside className="xl:min-h-0">
          <CollapsiblePanel
            storageKey={`workbench.performance.${kind}.left`}
            title="指标说明"
            icon={PanelLeft}
            side="left"
            collapsed={leftPanel.collapsed}
            onToggleCollapsed={leftPanel.toggleCollapsed}
          >
            <div className="grid content-start gap-2 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
              <MetricCard
                kind={kind}
                title={title}
                icon={icon}
                summary={metric}
                emphasis={emphasis}
                panelAction={
                  <CollapsiblePanelAction
                    side="left"
                    title="指标说明"
                    collapsed={leftPanel.collapsed}
                    onToggleCollapsed={leftPanel.toggleCollapsed}
                  />
                }
              />
              <SignalSummary
                title="字段口径"
                description={description}
                events={events}
                issueCount={metric?.errorCount ?? 0}
                sampleLabel={fieldSummary.label}
                sampleCount={fieldSummary.count}
                sampleField={fieldSummary.field}
                sampleHint={fieldSummary.hint}
              />
              <PrinciplesCard />
            </div>
          </CollapsiblePanel>
        </aside>

        <section className="min-h-[620px] overflow-visible xl:overflow-auto">
          <KindContent kind={kind} events={events} metric={metric} />
        </section>
      </div>
    </div>
  );
}

function fieldSummaryFor(kind: PerformanceKind, metric?: PerformanceMetricSummary) {
  if (kind === 'startup') {
    const startup = metric as StartupPerformanceSummary | undefined;
    return {
      label: '启动统计样本',
      count: (startup?.coldStart.sampleCount ?? 0) + (startup?.sdkInit.sampleCount ?? 0) + (startup?.backgroundInterval.sampleCount ?? 0) + (startup?.hotResume.sampleCount ?? 0),
      field: 'app.cold_start.durationMs / sdk.init.duration_ms / app.background_duration.durationMs / app.hot_start.durationMs',
      hint: '冷启动当前表示到首帧的总耗时；app.first_frame_ms 是同一启动链路的终点口径，不再作为独立阶段重复累加。',
    };
  }
  if (kind === 'pages') {
    const pages = metric as PagePerformanceSummary | undefined;
    return {
      label: '加载样本',
      count: (pages?.load.sampleCount ?? 0) + (pages?.firstFrame.sampleCount ?? 0),
      field: 'page.load_ms / page.first_frame_ms',
      hint: '页面加载与首帧样本数；page.stay 停留时长单独展示。',
    };
  }
  if (kind === 'jank') {
    const jank = metric as JankPerformanceSummary | undefined;
    return {
      label: '帧样本',
      count: jank?.maxFrame.sampleCount ?? 0,
      field: 'frame.max_ms / frame.avg_ms / jank.count',
      hint: '卡顿序列携带的帧指标样本数，卡顿事件本身通常不提供顶层 durationMs。',
    };
  }
  if (kind === 'errors') {
    const errors = metric as ErrorPerformanceSummary | undefined;
    return {
      label: '错误记录',
      count: errors?.count ?? 0,
      field: 'signalType=error / status=error',
      hint: '错误记录不以 durationMs 为主指标；HTTP 失败的耗时请在网络页查看。',
    };
  }
  return {
    label: '耗时事件',
    count: metric?.durationSummary?.sampleCount,
    field: 'http.client.durationMs',
    hint: 'HTTP 请求 span 提供的 durationMs 样本数。',
  };
}

function KindContent({
  kind,
  events,
  metric,
}: {
  kind: PerformanceKind;
  events: PerformanceMetricEvent[];
  metric?: PerformanceMetricSummary;
}) {
  if (kind === 'startup') return <StartupContent events={events} metric={metric as StartupPerformanceSummary | undefined} />;
  if (kind === 'pages') return <PagesContent events={events} metric={metric as PagePerformanceSummary | undefined} />;
  if (kind === 'network') return <NetworkContent events={events} metric={metric as HttpPerformanceSummary | undefined} />;
  if (kind === 'jank') return <JankContent events={events} metric={metric as JankPerformanceSummary | undefined} />;
  return <ErrorsContent events={events} metric={metric as ErrorPerformanceSummary | undefined} />;
}

function StartupContent({ events, metric }: { events: PerformanceMetricEvent[]; metric?: StartupPerformanceSummary }) {
  const coldStarts = chronological(events.filter((event) => event.name === 'app.cold_start' && hasDuration(event)));
  const backgroundIntervals = selectBackgroundIntervalEvents(events);
  const hotResumes = chronological(events.filter((event) => event.name === 'app.hot_start' && hasDuration(event)));
  const sdkInit = chronological(events.filter((event) => event.name === 'sdk.init' && (
    attrNumber(event, 'sdk.init.duration_ms') !== undefined ||
    hasDuration(event)
  )));
  const firstFrame = chronological(events.filter((event) => event.name === 'app.first_frame' && (
    attrNumber(event, 'app.first_frame_ms') !== undefined ||
    hasDuration(event)
  )));
  const records = buildStartupRecords([...coldStarts, ...backgroundIntervals, ...hotResumes, ...sdkInit, ...firstFrame]);

  return (
    <div className="grid gap-2">
      <StartupScatterChart records={records} />
      <BackgroundIntervalChart events={backgroundIntervals} />
      <StartupFieldCard metric={metric} />
      <StartupRecordTable records={records} />
    </div>
  );
}

function PagesContent({ events, metric: _metric }: { events: PerformanceMetricEvent[]; metric?: PagePerformanceSummary }) {
  const pageRecords = buildPageRecords(events);
  const routeRows = summarizePageRoutes(pageRecords);

  return (
    <div className="grid gap-2">
      <PagePerformanceMatrix records={pageRecords} routeRows={routeRows} />
      <PageStayChart records={pageRecords} />
      <PageRecordTable
        title="页面记录"
        description="按 traceId、page.instance_id 和 route 合并页面加载、首帧、停留记录。"
        source={'context.route.name / name / traceId / attributes["page.instance_id"] / durationMs / attributes["page.load_ms"] / attributes["page.first_frame_ms"]'}
        records={pageRecords}
      />
    </div>
  );
}

type PageRecord = {
  key: string;
  route: string;
  timestamp?: string;
  sessionId?: string;
  traceId?: string;
  pageInstanceId?: string;
  loadEventId?: string;
  firstFrameEventId?: string;
  stayEventId?: string;
  loadMs?: number;
  firstFrameMs?: number;
  stayMs?: number;
  from?: string;
  to?: string;
};

type PageRouteSummary = {
  route: string;
  visits: number;
  loadSampleCount: number;
  firstFrameSampleCount: number;
  staySampleCount: number;
  averageLoadMs?: number;
  averageFirstFrameMs?: number;
  averageStayMs?: number;
  maxLoadMs?: number;
  maxFirstFrameMs?: number;
  maxStayMs?: number;
};

type StartupRecord = {
  key: string;
  kind: 'cold' | 'background' | 'hot';
  timestamp?: string;
  sessionId?: string;
  traceId?: string;
  route?: string;
  coldStartEventId?: string;
  firstFrameEventId?: string;
  sdkInitEventId?: string;
  backgroundEventId?: string;
  coldStartToFirstFrameMs?: number;
  firstFrameMs?: number;
  sdkInitMs?: number;
  backgroundIntervalMs?: number;
  hotResumeMs?: number;
  completedAt?: string;
};

type StartupScatterPoint = {
  value: [number, string];
  metricLabel: string;
  durationMs: number;
  timestamp?: string;
  sessionId?: string;
  traceId?: string;
};

function PagePerformanceMatrix({ records, routeRows }: { records: PageRecord[]; routeRows: PageRouteSummary[] }) {
  const option = pageMatrixOption(routeRows);
  return (
    <EchartsPanel
      title="页面性能矩阵"
      description="按页面汇总加载耗时和首帧耗时，停留时长单独展示，避免长停留压扁加载数据。"
      source={'context.route.name / durationMs / attributes["page.load_ms"] / attributes["page.first_frame_ms"]'}
      option={option}
      empty={records.length === 0 || routeRows.length === 0}
      height={320}
    />
  );
}

function PageStayChart({ records }: { records: PageRecord[] }) {
  const option = pageStayOption(records);
  return (
    <EchartsPanel
      title="页面停留时长"
      description="停留时长单独看，用于判断用户在哪些页面停留更久，不参与页面加载性能坐标轴。"
      source="page.stay.durationMs"
      option={option}
      empty={!records.some((record) => typeof record.stayMs === 'number')}
      height={320}
    />
  );
}

function PageRecordTable({
  title,
  description,
  source,
  records,
}: {
  title: string;
  description: string;
  source: string;
  records: PageRecord[];
}) {
  const sorted = [...records].sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp));
  return (
    <Card className="grid min-h-[360px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="inline-flex items-center gap-2"><ListTree className="size-4" />{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">来源字段</span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-[360px] text-zinc-300">{source}</div>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {sorted.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无记录" description="当前筛选范围内还没有页面性能记录。" />
          </div>
        ) : (
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[minmax(14rem,1.5fr)_9rem_8rem_8rem_8rem_8rem_8rem_5rem] gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
              <span>页面</span>
              <span>时间</span>
              <span className="text-right">加载</span>
              <span className="text-right">首帧</span>
              <span className="text-right">停留</span>
              <span>来源</span>
              <span>去向</span>
              <span className="text-right">回查</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {sorted.map((record) => (
                <PageRecordRow key={record.key} record={record} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageRecordRow({ record }: { record: PageRecord }) {
  const eventId = record.loadEventId ?? record.firstFrameEventId ?? record.stayEventId;
  return (
    <div className="grid grid-cols-[minmax(14rem,1.5fr)_9rem_8rem_8rem_8rem_8rem_8rem_5rem] items-center gap-3 px-3 py-2 text-xs hover:bg-teal-50">
      <div className="min-w-0">
        <strong className="block truncate text-zinc-950">{record.route}</strong>
        <div className="mt-0.5 truncate text-zinc-500">
          {record.pageInstanceId ?? '-'} · {record.traceId ?? '-'}
        </div>
      </div>
      <span className="text-zinc-500 tabular-nums">{formatDateTime(record.timestamp)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.loadMs)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.firstFrameMs)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.stayMs)}</span>
      <span className="min-w-0 truncate text-zinc-600">{record.from ?? '-'}</span>
      <span className="min-w-0 truncate text-zinc-600">{record.to ?? '-'}</span>
      <span className="text-right">
        {record.sessionId ? (
          <Link
            to="/sessions/$sessionId"
            params={{ sessionId: record.sessionId }}
            search={{ eventId, traceId: eventId ? undefined : record.traceId }}
            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
          >
            Session <ArrowRight className="size-3" />
          </Link>
        ) : eventId ? (
          <Link to="/events/$eventId" params={{ eventId }} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900">
            Event <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </span>
    </div>
  );
}

function StartupScatterChart({ records }: { records: StartupRecord[] }) {
  const coldRecords = records.filter((record) => record.kind === 'cold' && typeof startupTotalMs(record) === 'number');
  const option = startupScatterOption(coldRecords);
  return (
    <EchartsPanel
      title="启动阶段散点"
      description="不连线、不做时间桶聚合；每个点对应一条启动链路里的已采集指标，冷启动当前以首帧为终点。"
      source={'app.cold_start.durationMs / attributes["app.first_frame_ms"] / attributes["sdk.init.duration_ms"]'}
      option={option}
      empty={coldRecords.length === 0}
      height={320}
    />
  );
}

function BackgroundIntervalChart({ events }: { events: PerformanceMetricEvent[] }) {
  const option = backgroundIntervalOption(events);
  return (
    <EchartsPanel
      title="后台间隔"
      description="单独展示后台停留到 resumed 的间隔，可能是分钟或小时，不与冷启动毫秒级指标同轴。"
      source="app.background_duration.durationMs"
      option={option}
      empty={events.length === 0}
      height={280}
    />
  );
}

function StartupFieldCard({ metric }: { metric?: StartupPerformanceSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>启动口径</CardTitle>
        <CardDescription>当前冷启动耗时以首帧为终点；后台间隔是 lifecycle 信息，不和毫秒级启动耗时混轴。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-zinc-600 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs font-medium text-zinc-500">冷启动到首帧</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{formatDuration(metric?.coldStart.latestMs)}</div>
          <div className="mt-1 text-xs leading-relaxed">来源：`app.cold_start.durationMs`。当前 SDK 的 `app.first_frame_ms` 与它同口径，用于确认首帧终点。</div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs font-medium text-zinc-500">后台间隔</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{formatDuration(metric?.backgroundInterval.latestMs)}</div>
          <div className="mt-1 text-xs leading-relaxed">来源：`app.background_duration.durationMs`，表示 App 在后台停留到 resumed 的间隔。</div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="text-xs font-medium text-zinc-500">热恢复耗时</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{formatDuration(metric?.hotResume.latestMs)}</div>
          <div className="mt-1 text-xs leading-relaxed">来源：`app.hot_start.durationMs`，只表示 resumed 后到首帧或可交互的恢复耗时。</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StartupRecordTable({ records }: { records: StartupRecord[] }) {
  const sorted = [...records].sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp));
  return (
    <Card className="grid min-h-[360px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="inline-flex items-center gap-2"><ListTree className="size-4" />启动记录</CardTitle>
          <CardDescription>按 trace 合并冷启动、SDK 初始化和首帧终点；后台间隔和热恢复耗时分别作为独立记录展示。</CardDescription>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">来源字段</span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-[360px] text-zinc-300">
              app.cold_start.durationMs / attributes["app.first_frame_ms"] / attributes["sdk.init.duration_ms"] / app.background_duration.durationMs / app.hot_start.durationMs
            </div>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {sorted.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无记录" description="当前筛选范围内还没有启动链路记录。" />
          </div>
        ) : (
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[minmax(14rem,1.5fr)_9rem_8rem_8rem_8rem_8rem_8rem_5rem] gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
              <span>链路</span>
              <span>时间</span>
              <span className="text-right">冷启到首帧</span>
              <span className="text-right">SDK 初始化</span>
              <span className="text-right">首帧前其他</span>
              <span className="text-right">后台间隔</span>
              <span className="text-right">热恢复</span>
              <span className="text-right">回查</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {sorted.map((record) => (
                <StartupRecordRow key={record.key} record={record} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StartupRecordRow({ record }: { record: StartupRecord }) {
  const eventId = record.backgroundEventId ?? record.coldStartEventId ?? record.firstFrameEventId ?? record.sdkInitEventId;
  const typeLabel = record.kind === 'background' ? '后台间隔' : record.kind === 'hot' ? '热恢复' : '冷启动';
  return (
    <div className="grid grid-cols-[minmax(14rem,1.5fr)_9rem_8rem_8rem_8rem_8rem_8rem_5rem] items-center gap-3 px-3 py-2 text-xs hover:bg-teal-50">
      <div className="min-w-0">
        <strong className="block truncate text-zinc-950">{typeLabel}</strong>
        <div className="mt-0.5 truncate text-zinc-500">
          {record.route ?? '-'} · {record.traceId ?? record.key}
        </div>
      </div>
      <span className="text-zinc-500 tabular-nums">{formatDateTime(record.timestamp)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(startupTotalMs(record))}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.sdkInitMs)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(startupOtherMs(record))}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.backgroundIntervalMs)}</span>
      <span className="text-right text-zinc-600 tabular-nums">{formatDuration(record.hotResumeMs)}</span>
      <span className="text-right">
        {record.sessionId ? (
          <Link
            to="/sessions/$sessionId"
            params={{ sessionId: record.sessionId }}
            search={{ eventId, traceId: eventId ? undefined : record.traceId }}
            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
          >
            Session <ArrowRight className="size-3" />
          </Link>
        ) : eventId ? (
          <Link to="/events/$eventId" params={{ eventId }} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900">
            Event <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </span>
    </div>
  );
}

function RouteHeatPanel({
  title,
  description,
  source,
  rows,
  valueLabel,
}: {
  title: string;
  description: string;
  source: string;
  rows: MetricGroupSummary[];
  valueLabel: string;
}) {
  return (
    <EchartsPanel
      title={title}
      description={description}
      source={source}
      option={routeHeatOption(rows, valueLabel)}
      empty={rows.length === 0}
      height={300}
    />
  );
}

function NetworkContent({ events, metric }: { events: PerformanceMetricEvent[]; metric?: HttpPerformanceSummary }) {
  const http = chronological(events.filter((event) => event.name === 'http.client'));
  const httpRecent = [...http].reverse();
  const statuses = groupCount(http.map((event) => attrNumber(event, 'http.status_code')?.toString()), '无状态码').map((item) => ({
    ...item,
    tone: item.label.startsWith('5') || item.label.startsWith('4') ? 'danger' as const : 'good' as const,
  }));
  const successData: BarDatum[] = groupCount(http.map((event) => {
    const value = attrBool(event, 'http.success');
    if (value === true) return '成功';
    if (value === false) return '失败';
    return undefined;
  }), '未知').map((item) => ({ ...item, tone: item.label === '失败' ? 'danger' : item.label === '成功' ? 'good' : 'normal' }));
  const errorTypes = groupCount(http.map((event) => attrString(event, 'http.error_type')), '无错误类型');
  const urls = groupCount(http.map((event) => attrString(event, 'http.url.normalized')), '未知接口');

  return (
    <div className="grid gap-2">
      <RouteHeatPanel
        title="请求页面热区"
        description="按 route 汇总请求量和最慢请求，先定位哪个页面触发问题。"
        source="context.route.name / http.client.durationMs"
        rows={metric?.routeSummaries ?? []}
        valueLabel="最慢请求"
      />
      <div className="grid gap-2 2xl:grid-cols-3">
        <LineChartPanel
          title="请求耗时趋势"
          description="每个点对应一条 http.client span。"
          source="name=http.client · value=durationMs"
          points={http.map((event) => durationPoint(event, httpPointLabel(event)))}
        />
        <BarChartPanel title="状态码分布" description="按 http.status_code 分组。" source={'attributes["http.status_code"]'} data={statuses} />
        <EchartsPanel
          title="成功失败分布"
          description="按 http.success 分组。"
          source={'attributes["http.success"]'}
          option={pieOption(successData)}
          empty={successData.length === 0}
          height={260}
        />
        <BarChartPanel title="接口分布" description="按 http.url.normalized 分组。" source={'attributes["http.url.normalized"]'} data={urls} />
      </div>
      <BarChartPanel title="失败类型" description="仅失败请求通常会携带 http.error_type。" source={'attributes["http.error_type"]'} data={errorTypes} />
      <EventTablePanel
        title="网络记录"
        description="HTTP span 原始字段记录。"
        source={'durationMs / attributes["http.method"] / attributes["http.url.normalized"] / attributes["http.status_code"] / attributes["http.success"]'}
        events={httpRecent}
        columns={[
          { key: 'method', label: '方法', render: (event) => attrString(event, 'http.method') ?? '-' },
          { key: 'url', label: '接口', render: (event) => attrString(event, 'http.url.normalized') ?? '-' },
          { key: 'status', label: '状态码', align: 'right', render: (event) => attrNumber(event, 'http.status_code')?.toString() ?? '-' },
          { key: 'duration', label: '耗时', align: 'right', render: (event) => formatDuration(event.durationMs) },
        ]}
      />
    </div>
  );
}

function JankContent({ events, metric }: { events: PerformanceMetricEvent[]; metric?: JankPerformanceSummary }) {
  const jank = chronological(events.filter((event) => event.name === 'ui.jank.sequence'));
  const jankRecent = [...jank].reverse();
  const routes = groupCount(jank.map((event) => event.route), '未知页面');

  return (
    <div className="grid gap-2">
      <RouteHeatPanel
        title="卡顿页面热区"
        description="按 route 汇总卡顿次数和最慢帧。"
        source={'context.route.name / attributes["frame.max_ms"]'}
        rows={metric?.routeSummaries ?? []}
        valueLabel="最慢帧"
      />
      <div className="grid gap-2 2xl:grid-cols-2">
        <LineChartPanel
          title="最大帧耗时"
          description="卡顿序列里最严重的一帧耗时。"
          source={'name=ui.jank.sequence · value=attributes["frame.max_ms"]'}
          points={jank.map((event) => attributePoint(event, 'frame.max_ms', routePointLabel(event)))}
          thresholds={budgetThresholds(jank)}
        />
        <LineChartPanel
          title="平均帧耗时"
          description="卡顿序列内慢帧平均耗时。"
          source={'name=ui.jank.sequence · value=attributes["frame.avg_ms"]'}
          points={jank.map((event) => attributePoint(event, 'frame.avg_ms', routePointLabel(event)))}
          thresholds={budgetThresholds(jank)}
        />
      </div>
      <div className="grid gap-2 2xl:grid-cols-3">
        <LineChartPanel
          title="卡顿帧数"
          description="连续卡顿帧数量。"
          source={'attributes["jank.count"]'}
          points={jank.map((event) => attributePoint(event, 'jank.count', routePointLabel(event)))}
        />
        <LineChartPanel
          title="FPS"
          description="SDK 提供 frame.fps 时展示。"
          source={'attributes["frame.fps"]'}
          points={jank.map((event) => attributePoint(event, 'frame.fps', routePointLabel(event)))}
        />
        <BarChartPanel title="卡顿页面分布" description="按 context.route.name 分组。" source="context.route.name" data={routes} />
      </div>
      <EventTablePanel
        title="卡顿记录"
        description="卡顿序列携带的帧指标。"
        source={'attributes["jank.count"] / attributes["frame.max_ms"] / attributes["frame.avg_ms"] / attributes["frame.budget_ms"] / attributes["frame.fps"]'}
        events={jankRecent}
        columns={[
          { key: 'route', label: '页面', render: (event) => event.route ?? '-' },
          { key: 'frames', label: '帧数', align: 'right', render: (event) => attrNumber(event, 'jank.count')?.toString() ?? '-' },
          { key: 'max', label: '最大帧', align: 'right', render: (event) => formatDuration(attrNumber(event, 'frame.max_ms')) },
          { key: 'avg', label: '平均帧', align: 'right', render: (event) => formatDuration(attrNumber(event, 'frame.avg_ms')) },
        ]}
      />
    </div>
  );
}

function ErrorsContent({ events, metric }: { events: PerformanceMetricEvent[]; metric?: ErrorPerformanceSummary }) {
  const errors = chronological(events.filter((event) => event.signalType === 'error' || event.status === 'error'));
  const errorRecent = [...errors].reverse();
  const errorTypes = groupCount(errors.map((event) => attrString(event, 'error.type')), '未知类型').map((item) => ({ ...item, tone: 'danger' as const }));
  const mechanisms = groupCount(errors.map((event) => attrString(event, 'error.mechanism')), '未知机制');
  const fatalData = groupCount(errors.map((event) => {
    const value = attrBool(event, 'error.fatal');
    if (value === true) return 'fatal';
    if (value === false) return 'non-fatal';
    return undefined;
  }), '未知').map((item) => ({ ...item, tone: item.label === 'fatal' ? 'danger' as const : 'normal' as const }));
  const routes = groupCount(errors.map((event) => event.route), '未知页面').map((item) => ({ ...item, tone: 'warn' as const }));

  return (
    <div className="grid gap-2">
      <RouteHeatPanel
        title="错误页面热区"
        description="按 route 汇总错误次数。"
        source="context.route.name"
        rows={metric?.routeSummaries ?? []}
        valueLabel="错误数"
      />
      <div className="grid gap-2 2xl:grid-cols-2">
        <BarChartPanel title="错误类型" description="按 error.type 分组。" source={'attributes["error.type"]'} data={errorTypes} />
        <BarChartPanel title="错误机制" description="按 error.mechanism 分组。" source={'attributes["error.mechanism"]'} data={mechanisms} />
      </div>
      <div className="grid gap-2 2xl:grid-cols-2">
        <EchartsPanel
          title="Fatal 分布"
          description="按 error.fatal 分组。"
          source={'attributes["error.fatal"]'}
          option={pieOption(fatalData)}
          empty={fatalData.length === 0}
          height={260}
        />
        <BarChartPanel title="错误页面分布" description="按 context.route.name 分组。" source="context.route.name" data={routes} />
      </div>
      <EventTablePanel
        title="错误记录"
        description="错误 envelope 及 status=error 的记录。"
        source={'signalType / status / attributes["error.type"] / attributes["error.mechanism"] / attributes["error.fatal"]'}
        events={errorRecent}
        columns={[
          { key: 'type', label: '类型', render: (event) => attrString(event, 'error.type') ?? event.name ?? '-' },
          { key: 'mechanism', label: '机制', render: (event) => attrString(event, 'error.mechanism') ?? '-' },
          { key: 'fatal', label: 'Fatal', render: (event) => boolLabel(attrBool(event, 'error.fatal')) },
          { key: 'handled', label: 'Handled', render: (event) => boolLabel(attrBool(event, 'error.handled')) },
        ]}
      />
    </div>
  );
}

function PrinciplesCard() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>展示原则</CardTitle>
        <CardDescription>只展示 SDK 已提供字段；服务端仅负责存储、筛选、分组和排序。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-xs text-zinc-600">
        <p>图表为空时代表当前 SDK 没有提供对应字段，Workbench 不补造指标。</p>
        <p>Raw JSON 仍可在 Session Detail 或 Event Detail 中查看。</p>
      </CardContent>
    </Card>
  );
}

function chronological(events: PerformanceMetricEvent[]): PerformanceMetricEvent[] {
  return [...events].sort((a, b) => timeValue(a.timestamp) - timeValue(b.timestamp));
}

function buildPageRecords(events: PerformanceMetricEvent[]): PageRecord[] {
  const records = new Map<string, PageRecord>();
  const standaloneCounters = new Map<string, number>();
  const pageEvents = chronological(events.filter((event) => (
    event.name === 'page.load' ||
    event.name === 'page.first_frame' ||
    event.name === 'page.stay'
  )));

  for (const event of pageEvents) {
    const route = event.route ?? '未知页面';
    const instanceId = attrString(event, 'page.instance_id');
    const key = pageRecordKey(event, route, instanceId, standaloneCounters);
    const record = records.get(key) ?? {
      key,
      route,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      traceId: event.traceId,
      pageInstanceId: instanceId,
      from: attrString(event, 'page.from'),
      to: attrString(event, 'page.to'),
    };

    record.timestamp = earliestTimestamp(record.timestamp, event.timestamp);
    record.sessionId = record.sessionId ?? event.sessionId;
    record.traceId = record.traceId ?? event.traceId;
    record.pageInstanceId = record.pageInstanceId ?? instanceId;
    record.from = record.from ?? attrString(event, 'page.from');
    record.to = record.to ?? attrString(event, 'page.to');

    if (event.name === 'page.load') {
      record.loadEventId = event.eventId;
      record.loadMs = event.durationMs ?? attrNumber(event, 'page.load_ms');
    }
    if (event.name === 'page.first_frame') {
      record.firstFrameEventId = event.eventId;
      record.firstFrameMs = attrNumber(event, 'page.first_frame_ms') ?? event.durationMs;
    }
    if (event.name === 'page.stay') {
      record.stayEventId = event.eventId;
      record.stayMs = event.durationMs;
    }

    records.set(key, record);
  }

  return [...records.values()].sort((a, b) => timeValue(a.timestamp) - timeValue(b.timestamp));
}

function pageRecordKey(
  event: PerformanceMetricEvent,
  route: string,
  instanceId: string | undefined,
  standaloneCounters: Map<string, number>,
): string {
  if (event.traceId) return `trace:${event.traceId}`;
  if (instanceId) return `instance:${instanceId}`;
  const base = `event:${event.name ?? 'page'}:${route}:${event.eventId ?? event.timestamp ?? 'unknown'}`;
  const count = standaloneCounters.get(base) ?? 0;
  standaloneCounters.set(base, count + 1);
  return count === 0 ? base : `${base}:${count}`;
}

function earliestTimestamp(current: string | undefined, next: string | undefined): string | undefined {
  if (!current) return next;
  if (!next) return current;
  return timeValue(next) < timeValue(current) ? next : current;
}

function summarizePageRoutes(records: PageRecord[]): PageRouteSummary[] {
  const groups = new Map<string, PageRecord[]>();
  for (const record of records) {
    const list = groups.get(record.route) ?? [];
    list.push(record);
    groups.set(record.route, list);
  }

  return [...groups.entries()]
    .map(([route, routeRecords]) => {
      const loadValues = numbers(routeRecords.map((record) => record.loadMs));
      const firstFrameValues = numbers(routeRecords.map((record) => record.firstFrameMs));
      const stayValues = numbers(routeRecords.map((record) => record.stayMs));
      return {
        route,
        visits: routeRecords.length,
        loadSampleCount: loadValues.length,
        firstFrameSampleCount: firstFrameValues.length,
        staySampleCount: stayValues.length,
        averageLoadMs: average(loadValues),
        averageFirstFrameMs: average(firstFrameValues),
        averageStayMs: average(stayValues),
        maxLoadMs: max(loadValues),
        maxFirstFrameMs: max(firstFrameValues),
        maxStayMs: max(stayValues),
      };
    })
    .sort((a, b) => (
      (b.averageLoadMs ?? 0) +
      (b.averageFirstFrameMs ?? 0) -
      ((a.averageLoadMs ?? 0) + (a.averageFirstFrameMs ?? 0))
    ))
    .slice(0, 12);
}

function buildStartupRecords(events: PerformanceMetricEvent[]): StartupRecord[] {
  const records = new Map<string, StartupRecord>();
  const sorted = chronological(events);

  for (const event of sorted) {
    const isBackgroundInterval = event.name === 'app.background_duration';
    const isHotResume = event.name === 'app.hot_start';
    const fallbackKey = `${event.name ?? 'startup'}:${event.eventId ?? event.timestamp ?? records.size}`;
    const key = isBackgroundInterval
      ? fallbackKey
      : event.traceId ?? fallbackKey;
    const record = records.get(key) ?? {
      key,
      kind: isBackgroundInterval ? 'background' : isHotResume ? 'hot' : 'cold',
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      traceId: event.traceId,
      route: event.route,
    };

    record.timestamp = earliestTimestamp(record.timestamp, event.timestamp);
    record.sessionId = record.sessionId ?? event.sessionId;
    record.traceId = record.traceId ?? event.traceId;
    record.route = record.route ?? event.route;

    if (event.name === 'app.cold_start') {
      record.coldStartEventId = event.eventId;
      record.coldStartToFirstFrameMs = event.durationMs;
      record.firstFrameMs = record.firstFrameMs ?? attrNumber(event, 'app.first_frame_ms');
      record.completedAt = event.timestamp ?? record.completedAt;
    }
    if (event.name === 'app.first_frame') {
      record.firstFrameEventId = event.eventId;
      record.firstFrameMs = attrNumber(event, 'app.first_frame_ms') ?? event.durationMs;
      record.completedAt = record.completedAt ?? event.timestamp;
    }
    if (event.name === 'sdk.init') {
      record.sdkInitEventId = event.eventId;
      record.sdkInitMs = attrNumber(event, 'sdk.init.duration_ms') ?? event.durationMs;
    }
    if (isBackgroundInterval) {
      record.backgroundEventId = event.eventId;
      record.backgroundIntervalMs = event.durationMs;
      record.completedAt = event.timestamp ?? record.completedAt;
    }
    if (isHotResume) {
      record.backgroundEventId = event.eventId;
      record.hotResumeMs = event.durationMs;
      record.completedAt = event.timestamp ?? record.completedAt;
    }

    records.set(key, record);
  }

  return [...records.values()]
    .filter((record) => [
      record.coldStartToFirstFrameMs,
      record.firstFrameMs,
      record.sdkInitMs,
      record.backgroundIntervalMs,
      record.hotResumeMs,
    ].some((value) => typeof value === 'number'))
    .sort((a, b) => timeValue(a.timestamp) - timeValue(b.timestamp));
}

function selectBackgroundIntervalEvents(events: PerformanceMetricEvent[]): PerformanceMetricEvent[] {
  return chronological(events.filter((event) => event.name === 'app.background_duration' && hasDuration(event)));
}

function startupScatterOption(records: StartupRecord[]): WorkbenchChartOption | undefined {
  const rows = ['冷启到首帧', '首帧前其他', 'SDK 初始化'];
  const totalPoints = records
    .map((record, index) => startupScatterPoint(record, index, '冷启到首帧', startupTotalMs(record)))
    .filter(isStartupScatterPoint);
  const otherPoints = records
    .map((record, index) => startupScatterPoint(record, index, '首帧前其他', startupOtherMs(record)))
    .filter(isStartupScatterPoint);
  const sdkPoints = records
    .map((record, index) => startupScatterPoint(record, index, 'SDK 初始化', record.sdkInitMs))
    .filter(isStartupScatterPoint);
  const allPoints = [...totalPoints, ...otherPoints, ...sdkPoints];
  if (allPoints.length === 0) return undefined;

  return {
    color: ['#0f766e', '#2563eb', '#7c3aed'],
    legend: { top: 0, textStyle: { color: '#52525b' } },
    grid: { left: 96, right: 28, top: 48, bottom: 44 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const point = startupPointMeta(params);
        if (!point) return '';
        return [
          point.metricLabel,
          `耗时：${formatDuration(point.durationMs)}`,
          `时间：${formatFullDateTime(point.timestamp)}`,
          point.sessionId ? `Session：${point.sessionId}` : undefined,
          point.traceId ? `Trace：${point.traceId}` : undefined,
          point.metricLabel === '冷启到首帧' ? '口径：当前冷启动 trace 结束在首帧。' : undefined,
        ].filter(Boolean).join('<br />');
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#71717a', formatter: (value: number) => formatDuration(value) },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    yAxis: {
      type: 'category',
      data: rows,
      axisLabel: { color: '#71717a' },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
      axisTick: { show: false },
    },
    series: [
      {
        name: '冷启到首帧',
        type: 'scatter',
        symbolSize: 11,
        data: totalPoints as never[],
      },
      {
        name: '首帧前其他',
        type: 'scatter',
        symbolSize: 10,
        data: otherPoints as never[],
      },
      {
        name: 'SDK 初始化',
        type: 'scatter',
        symbolSize: 10,
        data: sdkPoints as never[],
      },
    ],
  };
}

function backgroundIntervalOption(events: PerformanceMetricEvent[]): WorkbenchChartOption | undefined {
  const drawable = chronological(events.filter(hasDuration));
  if (drawable.length === 0) return undefined;
  return {
    color: ['#d97706'],
    grid: { left: 72, right: 28, top: 28, bottom: drawable.length > 8 ? 62 : 42 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const index = typeof item?.dataIndex === 'number' ? item.dataIndex : 0;
        const event = drawable[index];
        if (!event) return '';
        return [
          '后台间隔',
          `时间：${formatFullDateTime(event.timestamp)}`,
          `间隔：${formatDuration(event.durationMs)}`,
          event.sessionId ? `Session：${event.sessionId}` : undefined,
          '说明：当前点表示后台停留到 resumed 的间隔，不是真正热恢复耗时。',
        ].filter(Boolean).join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: drawable.map((event) => axisDateTimeLabel(event.timestamp)),
      axisLabel: { color: '#71717a', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#71717a', formatter: (value: number) => formatDuration(value) },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    dataZoom: drawable.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 24 }] : undefined,
    series: [
      {
        name: '后台间隔',
        type: 'bar',
        data: drawable.map((event) => event.durationMs),
        barMaxWidth: 36,
      },
    ],
  };
}

function routeHeatOption(rows: MetricGroupSummary[], valueLabel: string): WorkbenchChartOption | undefined {
  if (rows.length === 0) return undefined;
  return {
    color: ['#0f766e', '#d97706'],
    legend: { top: 0, textStyle: { color: '#52525b' } },
    grid: { left: 72, right: 28, top: 42, bottom: rows.length > 6 ? 72 : 48 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const index = typeof items[0]?.dataIndex === 'number' ? items[0].dataIndex : 0;
        const row = rows[index];
        if (!row) return '';
        return [
          row.key,
          `次数：${row.count}`,
          row.maxMs !== undefined ? `${valueLabel}：${formatDuration(row.maxMs)}` : undefined,
          row.averageMs !== undefined ? `平均：${formatDuration(row.averageMs)}` : undefined,
          row.sessionId ? `Session：${row.sessionId}` : undefined,
          row.eventId ? `Event：${row.eventId}` : undefined,
        ].filter(Boolean).join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.key),
      axisLabel: { color: '#71717a', hideOverlap: true, rotate: rows.length > 4 ? 28 : 0 },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '次数',
        axisLabel: { color: '#71717a' },
        splitLine: { lineStyle: { color: '#f4f4f5' } },
      },
      {
        type: 'value',
        name: valueLabel,
        axisLabel: { color: '#71717a', formatter: (value: number) => formatDuration(value) },
        splitLine: { show: false },
      },
    ],
    dataZoom: rows.length > 8 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 24 }] : undefined,
    series: [
      {
        name: '次数',
        type: 'bar',
        data: rows.map((row) => row.count),
        barMaxWidth: 32,
      },
      {
        name: valueLabel,
        type: 'line',
        yAxisIndex: 1,
        symbolSize: 8,
        data: rows.map((row) => row.maxMs),
      },
    ],
  };
}

function pageMatrixOption(rows: PageRouteSummary[]): WorkbenchChartOption | undefined {
  if (rows.length === 0) return undefined;
  return {
    color: ['#0f766e', '#2563eb', '#ef4444'],
    legend: {
      top: 0,
      textStyle: { color: '#52525b' },
    },
    grid: { left: 64, right: 28, top: 42, bottom: 72 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const index = typeof items[0]?.dataIndex === 'number' ? items[0].dataIndex : 0;
        const row = rows[index];
        if (!row) return '';
        return [
          row.route,
          `访问记录：${row.visits}`,
          `加载平均：${formatDuration(row.averageLoadMs)} · 样本 ${row.loadSampleCount} · 最慢 ${formatDuration(row.maxLoadMs)}`,
          `首帧平均：${formatDuration(row.averageFirstFrameMs)} · 样本 ${row.firstFrameSampleCount} · 最慢 ${formatDuration(row.maxFirstFrameMs)}`,
          '来源：context.route.name / durationMs / page.load_ms / page.first_frame_ms',
        ].join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.route),
      axisLabel: { color: '#71717a', hideOverlap: true, rotate: rows.length > 4 ? 28 : 0 },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#71717a', formatter: (value: number) => formatDuration(value) },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    dataZoom: rows.length > 6 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 24 }] : undefined,
    series: [
      {
        name: '加载平均',
        type: 'bar',
        data: rows.map((row) => row.averageLoadMs),
        barMaxWidth: 30,
      },
      {
        name: '首帧平均',
        type: 'bar',
        data: rows.map((row) => row.averageFirstFrameMs),
        barMaxWidth: 30,
      },
      {
        name: '最慢加载',
        type: 'line',
        symbolSize: 8,
        data: rows.map((row) => row.maxLoadMs),
      },
    ],
  };
}

function pageStayOption(records: PageRecord[]): WorkbenchChartOption | undefined {
  const drawable = records.filter((record) => typeof record.stayMs === 'number' && Number.isFinite(record.stayMs));
  if (drawable.length === 0) return undefined;
  const xLabels = drawable.map((record) => axisDateTimeLabel(record.timestamp));
  return {
    color: ['#d97706'],
    legend: {
      top: 0,
      textStyle: { color: '#52525b' },
    },
    grid: { left: 64, right: 28, top: 42, bottom: drawable.length > 8 ? 72 : 48 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const index = typeof items[0]?.dataIndex === 'number' ? items[0].dataIndex : 0;
        const record = drawable[index];
        if (!record) return '';
        return [
          record.route,
          `时间：${formatFullDateTime(record.timestamp)}`,
          `停留：${formatDuration(record.stayMs)}`,
          record.sessionId ? `Session：${record.sessionId}` : undefined,
          record.traceId ? `Trace：${record.traceId}` : undefined,
          '来源：page.stay.durationMs',
        ].filter(Boolean).join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: { color: '#71717a', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#71717a', formatter: (value: number) => formatDuration(value) },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    dataZoom: drawable.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 24 }] : undefined,
    series: [
      {
        name: '停留时长',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: drawable.map((record) => record.stayMs),
      },
    ],
  };
}

function axisDateTimeLabel(timestamp?: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFullDateTime(timestamp?: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(date);
}

function numbers(values: Array<number | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number | undefined {
  return values.length > 0 ? Math.max(...values) : undefined;
}

function hasDuration(event: PerformanceMetricEvent): boolean {
  return typeof event.durationMs === 'number' && Number.isFinite(event.durationMs);
}

function timeValue(timestamp?: string): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function startupRecordTime(record: StartupRecord): string | undefined {
  return record.completedAt ?? record.timestamp;
}

function startupTotalMs(record: StartupRecord): number | undefined {
  return record.coldStartToFirstFrameMs ?? record.firstFrameMs;
}

function startupScatterPoint(
  record: StartupRecord,
  index: number,
  label: string,
  value: number | undefined,
): StartupScatterPoint | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return {
    value: [value, label],
    metricLabel: label,
    durationMs: value,
    timestamp: startupRecordTime(record),
    sessionId: record.sessionId,
    traceId: record.traceId ?? `${record.key}-${index}`,
  };
}

function isStartupScatterPoint(point: StartupScatterPoint | undefined): point is StartupScatterPoint {
  return Boolean(point);
}

function startupPointMeta(params: unknown): StartupScatterPoint | undefined {
  const data = (params as { data?: unknown })?.data;
  if (!data || typeof data !== 'object') return undefined;
  const point = data as Partial<StartupScatterPoint>;
  if (!Array.isArray(point.value) || typeof point.durationMs !== 'number' || typeof point.metricLabel !== 'string') return undefined;
  return point as StartupScatterPoint;
}

function startupOtherMs(record: StartupRecord): number | undefined {
  const total = startupTotalMs(record);
  if (typeof total !== 'number') return undefined;
  if (typeof record.sdkInitMs !== 'number') return undefined;
  return Math.max(0, total - record.sdkInitMs);
}

function routePointLabel(event: PerformanceMetricEvent): string {
  return `${event.route ?? '未知页面'} · ${event.name ?? '页面事件'}`;
}

function httpPointLabel(event: PerformanceMetricEvent): string {
  return `${attrString(event, 'http.method') ?? 'HTTP'} ${attrString(event, 'http.url.normalized') ?? event.name ?? '请求'}`;
}

function budgetThresholds(events: PerformanceMetricEvent[]): Array<{ label: string; value: number }> {
  const values = events
    .map((event) => attrNumber(event, 'frame.budget_ms'))
    .filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return [];
  const first = values[0];
  return values.every((value) => value === first) ? [{ label: '帧预算', value: first }] : [];
}

function boolLabel(value: boolean | undefined): string {
  if (value === true) return '是';
  if (value === false) return '否';
  return '-';
}
