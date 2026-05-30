import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import type { PerformanceMetricEvent, PerformanceMetricSummary } from '../../shared/datasource/types';
import { formatDuration } from '../../shared/formatting/format';
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
    <div className="grid min-h-full grid-cols-1 gap-2 overflow-auto p-2 xl:h-full xl:min-h-0 xl:grid-cols-[340px_minmax(760px,1fr)] xl:overflow-hidden">
      <aside className="grid content-start gap-2 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
        <MetricCard title={title} icon={icon} summary={metric} emphasis={emphasis} />
        <SignalSummary title="字段口径" description={description} events={events} issueCount={metric?.errorCount ?? 0} />
        <PrinciplesCard />
      </aside>

      <section className="min-h-[620px] overflow-visible xl:overflow-auto">
        <KindContent kind={kind} events={events} />
      </section>
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
  const pageLoad = chronological(events.filter((event) => event.name === 'page.load' && hasDuration(event)));
  const pageFirstFrame = chronological(events.filter((event) => event.name === 'page.first_frame'));
  const pageStay = chronological(events.filter((event) => event.name === 'page.stay' && hasDuration(event)));
  const routeRows = groupByRoute([...pageLoad, ...pageFirstFrame, ...pageStay]);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 2xl:grid-cols-2">
        <LineChartPanel
          title="页面加载耗时"
          description="只读取 page.load 的 durationMs，不把 route.push 或 page.view 纳入页面性能。"
          source="name=page.load · value=durationMs"
          points={pageLoad.map((event) => durationPoint(event, routePointLabel(event)))}
        />
        <LineChartPanel
          title="页面首帧耗时"
          description="只在 page.first_frame 事件携带 page.first_frame_ms 时展示。"
          source={'name=page.first_frame · value=attributes["page.first_frame_ms"]'}
          points={pageFirstFrame.map((event) => attributePoint(event, 'page.first_frame_ms', routePointLabel(event)))}
        />
      </div>
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <LineChartPanel
          title="页面停留时长"
          description="page.stay 的 durationMs 用于观察真实停留窗口。"
          source="name=page.stay · value=durationMs"
          points={pageStay.map((event) => durationPoint(event, routePointLabel(event)))}
        />
        <BarChartPanel
          title="页面事件分布"
          description="按 context.route.name 分组。"
          source="context.route.name"
          data={routeRows}
        />
      </div>
      <EventTablePanel
        title="页面记录"
        description="页面加载、首帧、停留记录，点击回到对应 session。"
        source={'name / durationMs / context.route.name / attributes["page.from"] / attributes["page.to"]'}
        events={chronological([...pageLoad, ...pageFirstFrame, ...pageStay]).reverse()}
        columns={[
          { key: 'route', label: '页面', render: (event) => event.route ?? '-' },
          { key: 'from', label: '来源', render: (event) => attrString(event, 'page.from') ?? '-' },
          { key: 'to', label: '去向', render: (event) => attrString(event, 'page.to') ?? '-' },
          { key: 'duration', label: '耗时', align: 'right', render: (event) => formatDuration(event.durationMs ?? attrNumber(event, 'page.load_ms') ?? attrNumber(event, 'page.first_frame_ms')) },
        ]}
      />
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
