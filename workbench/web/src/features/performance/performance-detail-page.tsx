import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ListTree } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { PerformanceMetricEvent, PerformanceMetricSummary } from '../../shared/datasource/types';
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

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <PerformanceTabs />
      <div className="grid min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[340px_minmax(760px,1fr)] xl:overflow-hidden">
        <aside className="grid content-start gap-2 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
          <MetricCard title={title} icon={icon} summary={metric} emphasis={emphasis} />
          <SignalSummary title="字段口径" description={description} events={events} issueCount={metric?.errorCount ?? 0} />
          <PrinciplesCard />
        </aside>

        <section className="min-h-[620px] overflow-visible xl:overflow-auto">
          <KindContent kind={kind} events={events} />
        </section>
      </div>
    </div>
  );
}

function KindContent({ kind, events }: { kind: PerformanceKind; events: PerformanceMetricEvent[] }) {
  if (kind === 'startup') return <StartupContent events={events} />;
  if (kind === 'pages') return <PagesContent events={events} />;
  if (kind === 'network') return <NetworkContent events={events} />;
  if (kind === 'jank') return <JankContent events={events} />;
  return <ErrorsContent events={events} />;
}

function StartupContent({ events }: { events: PerformanceMetricEvent[] }) {
  const coldStarts = chronological(events.filter((event) => event.name === 'app.cold_start' && hasDuration(event)));
  const hotStarts = chronological(events.filter((event) => event.name === 'app.hot_start' && hasDuration(event)));
  const sdkInit = chronological(events.filter((event) => event.name === 'sdk.init' && attrNumber(event, 'sdk.init.duration_ms') !== undefined));
  const firstFrame = chronological(events.filter((event) => event.name === 'app.first_frame' && attrNumber(event, 'app.first_frame_ms') !== undefined));
  const records = chronological([...coldStarts, ...hotStarts, ...sdkInit, ...firstFrame]).reverse();

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 2xl:grid-cols-2">
        <LineChartPanel
          title="冷启动耗时"
          description="每个点对应一次 app.cold_start completed trace。"
          source="name=app.cold_start · value=durationMs"
          points={coldStarts.map((event) => durationPoint(event, startPointLabel(event)))}
        />
        <LineChartPanel
          title="热启动现有口径"
          description="当前 SDK 的 app.hot_start 表示 lifecycle resumed 关联的恢复区间，暂不与冷启动混合判断。"
          source="name=app.hot_start · value=durationMs"
          points={hotStarts.map((event) => durationPoint(event, startPointLabel(event)))}
        />
      </div>
      <div className="grid gap-2 2xl:grid-cols-2">
        <LineChartPanel
          title="SDK 初始化阶段"
          description="只在 sdk.init 事件携带 sdk.init.duration_ms 时展示。"
          source={'name=sdk.init · value=attributes["sdk.init.duration_ms"]'}
          points={sdkInit.map((event) => attributePoint(event, 'sdk.init.duration_ms', startPointLabel(event)))}
        />
        <LineChartPanel
          title="启动首帧"
          description="只在 app.first_frame 事件携带 app.first_frame_ms 时展示。"
          source={'name=app.first_frame · value=attributes["app.first_frame_ms"]'}
          points={firstFrame.map((event) => attributePoint(event, 'app.first_frame_ms', startPointLabel(event)))}
        />
      </div>
      <EventTablePanel
        title="启动记录"
        description="冷启动、热启动、SDK 初始化和首帧事件按时间排列。"
        source={'name / durationMs / attributes["app.start.type"] / attributes["app.first_frame_ms"] / attributes["sdk.init.duration_ms"]'}
        events={records}
        columns={[
          { key: 'type', label: '类型', render: (event) => startTypeLabel(event) },
          { key: 'duration', label: '耗时', align: 'right', render: (event) => formatDuration(event.durationMs) },
          { key: 'firstFrame', label: '首帧', align: 'right', render: (event) => formatDuration(attrNumber(event, 'app.first_frame_ms')) },
          { key: 'sdkInit', label: 'SDK 初始化', align: 'right', render: (event) => formatDuration(attrNumber(event, 'sdk.init.duration_ms')) },
        ]}
      />
    </div>
  );
}

function PagesContent({ events }: { events: PerformanceMetricEvent[] }) {
  const pageRecords = buildPageRecords(events);
  const routeRows = summarizePageRoutes(pageRecords);

  return (
    <div className="grid gap-2">
      <PagePerformanceMatrix records={pageRecords} routeRows={routeRows} />
      <PageTrendChart records={pageRecords} />
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

function PagePerformanceMatrix({ records, routeRows }: { records: PageRecord[]; routeRows: PageRouteSummary[] }) {
  const option = pageMatrixOption(routeRows);
  return (
    <EchartsPanel
      title="页面性能矩阵"
      description="按页面汇总加载耗时、首帧耗时和停留时长，先看哪个页面慢。"
      source={'context.route.name / durationMs / attributes["page.load_ms"] / attributes["page.first_frame_ms"]'}
      option={option}
      empty={records.length === 0 || routeRows.length === 0}
      height={320}
    />
  );
}

function PageTrendChart({ records }: { records: PageRecord[] }) {
  const option = pageTrendOption(records);
  return (
    <EchartsPanel
      title="页面复现趋势"
      description="每个点都是一次页面记录，tooltip 会显示页面、加载、首帧、停留和 session。"
      source={'timestamp / context.route.name / durationMs / attributes["page.load_ms"] / attributes["page.first_frame_ms"]'}
      option={option}
      empty={!records.some((record) => hasAnyDuration(record))}
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
          <Link to="/sessions/$sessionId" params={{ sessionId: record.sessionId }} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900">
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

function NetworkContent({ events }: { events: PerformanceMetricEvent[] }) {
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
      <LineChartPanel
        title="请求耗时"
        description="每个点对应一条 http.client span。"
        source="name=http.client · value=durationMs"
        points={http.map((event) => durationPoint(event, httpPointLabel(event)))}
      />
      <div className="grid gap-2 2xl:grid-cols-3">
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

function JankContent({ events }: { events: PerformanceMetricEvent[] }) {
  const jank = chronological(events.filter((event) => event.name === 'ui.jank.sequence'));
  const jankRecent = [...jank].reverse();
  const routes = groupCount(jank.map((event) => event.route), '未知页面');

  return (
    <div className="grid gap-2">
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

function ErrorsContent({ events }: { events: PerformanceMetricEvent[] }) {
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

function pageMatrixOption(rows: PageRouteSummary[]): WorkbenchChartOption | undefined {
  if (rows.length === 0) return undefined;
  return {
    color: ['#0f766e', '#2563eb', '#d97706'],
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
          `停留平均：${formatDuration(row.averageStayMs)} · 样本 ${row.staySampleCount} · 最长 ${formatDuration(row.maxStayMs)}`,
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
        name: '停留平均',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: rows.map((row) => row.averageStayMs),
      },
    ],
  };
}

function pageTrendOption(records: PageRecord[]): WorkbenchChartOption | undefined {
  const drawable = records.filter(hasAnyDuration);
  if (drawable.length === 0) return undefined;
  const xLabels = drawable.map((record) => axisDateTimeLabel(record.timestamp));
  return {
    color: ['#0f766e', '#2563eb', '#d97706'],
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
          `加载：${formatDuration(record.loadMs)}`,
          `首帧：${formatDuration(record.firstFrameMs)}`,
          `停留：${formatDuration(record.stayMs)}`,
          record.sessionId ? `Session：${record.sessionId}` : undefined,
          record.traceId ? `Trace：${record.traceId}` : undefined,
          '来源：page.load / page.first_frame / page.stay',
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
        name: '加载',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: drawable.map((record) => record.loadMs),
      },
      {
        name: '首帧',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: drawable.map((record) => record.firstFrameMs),
      },
      {
        name: '停留',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: drawable.map((record) => record.stayMs),
      },
    ],
  };
}

function hasAnyDuration(record: PageRecord): boolean {
  return [record.loadMs, record.firstFrameMs, record.stayMs].some((value) => typeof value === 'number' && Number.isFinite(value));
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

function startTypeLabel(event: PerformanceMetricEvent): string {
  const type = attrString(event, 'app.start.type');
  if (type === 'cold') return '冷启动';
  if (type === 'hot') return '热启动';
  if (event.name === 'sdk.init') return 'SDK 初始化';
  if (event.name === 'app.first_frame') return '首帧';
  return type ?? '-';
}

function startPointLabel(event: PerformanceMetricEvent): string {
  return `${startTypeLabel(event)} · ${event.name ?? '启动事件'}`;
}

function routePointLabel(event: PerformanceMetricEvent): string {
  return `${event.route ?? '未知页面'} · ${event.name ?? '页面事件'}`;
}

function httpPointLabel(event: PerformanceMetricEvent): string {
  return `${attrString(event, 'http.method') ?? 'HTTP'} ${attrString(event, 'http.url.normalized') ?? event.name ?? '请求'}`;
}

function groupByRoute(events: PerformanceMetricEvent[]): BarDatum[] {
  return groupCount(events.map((event) => event.route), '未知页面');
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
