import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { pickScopeSearch } from '../scope/scope-filters';
import { compactNumber, formatDuration } from '../../shared/formatting/format';
import type {
  DurationSummary,
  ErrorPerformanceSummary,
  HttpPerformanceSummary,
  JankPerformanceSummary,
  PagePerformanceSummary,
  PerformanceMetricSummary,
  StartupPerformanceSummary,
} from '../../shared/datasource/types';
import {
  extractFrameEvidence,
  extractRssEvidence,
  formatFps,
  formatRssDelta,
  isPageVisitEnd,
  isStartupTraceEnd,
} from './performance-evidence';

export type MetricKind = 'startup' | 'pages' | 'network' | 'jank' | 'errors';

export function MetricCard({
  title,
  icon: Icon,
  summary,
  emphasis,
  to,
  kind,
  panelAction,
}: {
  title: string;
  icon: LucideIcon;
  summary?: PerformanceMetricSummary;
  emphasis?: string;
  to?: string;
  kind?: MetricKind;
  panelAction?: React.ReactNode;
}) {
  const errorCount = summary?.errorCount ?? 0;
  const body = (
    <Card className="min-w-0">
      <CardContent className="grid gap-3 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-700">
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {emphasis ? <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{emphasis}</span> : null}
            {panelAction}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricNumber label="事件数" field="events.length" hint="来源：当前筛选范围内匹配该类 signal 的 SDK envelope 数量" value={summary?.count ?? 0} />
          <MetricNumber label="问题数" field="status / signalType" hint="来源：status=error 或 signalType=error 的 SDK envelope 数量" value={errorCount} tone={errorCount > 0 ? 'danger' : 'normal'} />
        </div>
        <KindSummary kind={kind ?? kindFromTitle(title)} summary={summary} />
      </CardContent>
    </Card>
  );

  if (!to) return body;

  return (
    <Link to={to} search={(current) => pickScopeSearch(current)} className="block min-w-0 transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function KindSummary({ kind, summary }: { kind: MetricKind; summary?: PerformanceMetricSummary }) {
  if (kind === 'startup') return <StartupSummary summary={summary as StartupPerformanceSummary | undefined} />;
  if (kind === 'pages') return <PagesSummary summary={summary as PagePerformanceSummary | undefined} />;
  if (kind === 'network') return <NetworkSummary summary={summary as HttpPerformanceSummary | undefined} />;
  if (kind === 'jank') return <JankSummary summary={summary as JankPerformanceSummary | undefined} />;
  return <ErrorsSummary summary={summary as ErrorPerformanceSummary | undefined} />;
}

function StartupSummary({ summary }: { summary?: StartupPerformanceSummary }) {
  const coldAverages = averagePerformanceEvidence((summary?.events ?? []).filter((event) => isStartupTraceEnd(event) && event.name === 'app.cold_start'), 'startup');
  const hotAverages = averagePerformanceEvidence((summary?.events ?? []).filter((event) => isStartupTraceEnd(event) && event.name === 'app.hot_start'), 'startup');
  return (
    <div className="grid gap-2 text-xs">
      <DurationGroup
        label="冷启动"
        source="name=app.cold_start · value=durationMs"
        summary={summary?.coldStart}
        compact
        hintSuffix="当前 SDK 的 app.cold_start 以首帧为结束点，app.first_frame_ms 是同一链路的终点口径。"
      >
        <EvidenceMetrics
          frameField={'app.cold_start end · attributes["frame.fps"]'}
          rssField={'app.cold_start end · attributes["memory.delta_rss_mb"]'}
          averages={coldAverages}
          sourceLabel="冷启动主链路 trace end"
        />
      </DurationGroup>
      <DurationGroup label="热重启" source="app.hot_start.durationMs" summary={summary?.hotResume} compact>
        <EvidenceMetrics
          frameField={'app.hot_start end · attributes["frame.fps"]'}
          rssField={'app.hot_start end · attributes["memory.delta_rss_mb"]'}
          averages={hotAverages}
          sourceLabel="热重启主链路 trace end"
        />
      </DurationGroup>
      <DurationGroup label="后台间隔" source="app.background_duration.durationMs" summary={summary?.backgroundInterval} compact />
      <DurationGroup label="SDK 初始化" source={'name=sdk.init · value=attributes["sdk.init.duration_ms"]'} summary={summary?.sdkInit} compact />
    </div>
  );
}

function PagesSummary({ summary }: { summary?: PagePerformanceSummary }) {
  const averages = averagePerformanceEvidence((summary?.events ?? []).filter(isPageVisitEnd), 'page');
  return (
    <div className="grid gap-2 text-xs">
      <DurationGroup label="页面加载" source={'page.load · attributes["page.load_ms"]'} summary={summary?.load} compact>
        <EvidenceMetrics
          frameField={'page.visit end · attributes["frame.fps"]'}
          rssField={'page.visit end · attributes["memory.delta_rss_mb"]'}
          averages={averages}
          sourceLabel="页面主链路 page.visit end"
        />
      </DurationGroup>
      <DurationGroup label="页面首帧" source={'page.first_frame · attributes["page.first_frame_ms"]'} summary={summary?.firstFrame} compact />
      <DurationGroup label="页面停留" source="page.stay.durationMs · 单独展示，不计入加载耗时" summary={summary?.stay} compact />
    </div>
  );
}

function NetworkSummary({ summary }: { summary?: HttpPerformanceSummary }) {
  return (
    <div className="grid gap-1 text-xs">
      <MetricDuration
        label="平均耗时"
        value={summary?.durationSummary?.averageMs}
        sdkField={'name=http.client · attributes["event.phase"]=instant · durationMs'}
        hint={`HTTP completed single-span 请求耗时平均值。样本数：${summary?.durationSummary?.sampleCount ?? 0}。`}
      />
      <MetricDuration
        label="最慢请求"
        value={summary?.durationSummary?.maxMs}
        sdkField={'name=http.client · attributes["event.phase"]=instant · durationMs'}
        hint="当前范围内 durationMs 最大的 completed single-span HTTP envelope。"
      />
      <MetricPlain label="失败请求" value={compactNumber(summary?.failedCount ?? 0)} />
      <MetricPlain label="高频接口" value={summary?.endpointSummaries[0]?.key ?? '-'} />
    </div>
  );
}

function JankSummary({ summary }: { summary?: JankPerformanceSummary }) {
  return (
    <div className="grid gap-1 text-xs">
      <MetricDuration
        label="最慢帧"
        value={summary?.maxFrame.maxMs}
        sdkField={'attributes["frame.max_ms"]'}
        hint={`卡顿序列中的最大帧耗时。样本数：${summary?.maxFrame.sampleCount ?? 0}。`}
      />
      <MetricDuration
        label="平均慢帧"
        value={summary?.avgFrame.averageMs}
        sdkField={'attributes["frame.avg_ms"]'}
        hint={`卡顿序列慢帧平均耗时的平均值。样本数：${summary?.avgFrame.sampleCount ?? 0}。`}
      />
      <MetricPlain label="卡顿帧数" value={compactNumber(summary?.totalJankFrames ?? 0)} />
      <MetricPlain label="高频页面" value={summary?.routeSummaries[0]?.key ?? '-'} />
    </div>
  );
}

function ErrorsSummary({ summary }: { summary?: ErrorPerformanceSummary }) {
  return (
    <div className="grid gap-1 text-xs">
      <MetricPlain label="错误数" value={compactNumber(summary?.count ?? 0)} />
      <MetricPlain label="影响会话" value={compactNumber(summary?.affectedSessionCount ?? 0)} />
      <MetricPlain label="高频类型" value={summary?.typeSummaries[0]?.key ?? '-'} />
      <MetricPlain label="高频机制" value={summary?.mechanismSummaries[0]?.key ?? '-'} />
      <MetricPlain label="高频页面" value={summary?.routeSummaries[0]?.key ?? '-'} />
    </div>
  );
}

function DurationGroup({
  label,
  source,
  summary,
  compact = false,
  hintSuffix,
  children,
}: {
  label: string;
  source: string;
  summary?: DurationSummary;
  compact?: boolean;
  hintSuffix?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded border border-zinc-100 bg-zinc-50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-600">{label}</span>
        <MetricDuration
          label="次数"
          value={summary?.sampleCount}
          kind="number"
          sdkField={source}
          hint={`筛选口径：${source}。次数表示当前范围内匹配该启动类型的 SDK envelope 数量。`}
        />
      </div>
      <MetricDuration
        label="平均耗时"
        value={summary?.averageMs}
        sdkField={source}
        hint={`筛选口径：${source}。计算口径：对匹配记录做算术平均。样本数：${summary?.sampleCount ?? 0}。${hintSuffix ?? ''}`}
      />
      {compact ? null : (
        <MetricDuration
          label="最慢一次"
          value={summary?.maxMs}
          sdkField={source}
          hint={`筛选口径：${source}。计算口径：取最大值。样本数：${summary?.sampleCount ?? 0}。${hintSuffix ?? ''}`}
        />
      )}
      {children}
    </div>
  );
}

function EvidenceMetrics({
  averages,
  frameField,
  rssField,
  sourceLabel,
}: {
  averages: { avgFps?: number; avgRssDeltaMb?: number; fpsCount: number; rssCount: number };
  frameField: string;
  rssField: string;
  sourceLabel: string;
}) {
  return (
    <>
      <MetricPlainWithHint
        label="平均帧数"
        value={formatFps(averages.avgFps)}
        field={frameField}
        hint={`对${sourceLabel}上的 frame.fps 做算术平均。样本数：${averages.fpsCount}。`}
      />
      <MetricPlainWithHint
        label="平均内存"
        value={formatRssDelta(averages.avgRssDeltaMb)}
        field={rssField}
        hint={`对${sourceLabel}上的 RSS 变化做算术平均。样本数：${averages.rssCount}。`}
      />
    </>
  );
}

function MetricDuration({
  label,
  hint,
  sdkField,
  value,
  kind = 'duration',
}: {
  label: string;
  hint: string;
  sdkField: string;
  value?: number;
  kind?: 'duration' | 'number';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_auto] items-baseline gap-1">
          <span className="text-zinc-400">{label}</span>
          <span className="text-right text-zinc-600 tabular-nums">{kind === 'number' ? formatOptionalNumber(value) : formatDuration(value)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={sdkField} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricPlain({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-1">
      <span className="text-zinc-400">{label}</span>
      <span className="truncate text-right text-zinc-600 tabular-nums">{value}</span>
    </span>
  );
}

function MetricPlainWithHint({
  label,
  value,
  field,
  hint,
}: {
  label: string;
  value: string;
  field: string;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-1">
          <span className="text-zinc-400">{label}</span>
          <span className="truncate text-right text-zinc-600 tabular-nums">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricText({
  label,
  hint,
  field,
  value,
}: {
  label: string;
  hint: string;
  field: string;
  value: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-1 rounded border border-amber-100 bg-amber-50 px-2.5 py-2">
          <span className="text-amber-700">{label}</span>
          <span className="truncate text-right font-medium text-amber-800">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricNumber({
  label,
  field,
  hint,
  value,
  tone = 'normal',
}: {
  label: string;
  field: string;
  hint: string;
  value: number;
  tone?: 'normal' | 'danger';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help gap-1 rounded border border-zinc-100 bg-zinc-50 px-2.5 py-2">
          <span className="text-xs text-zinc-500">{label}</span>
          <strong className={`text-2xl leading-none tabular-nums ${tone === 'danger' ? 'text-red-600' : 'text-zinc-950'}`}>
            {compactNumber(value)}
          </strong>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function FieldHint({ label, field, hint }: { label: string; field: string; hint: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-medium text-zinc-50">{label}</span>
      <span className="text-zinc-400">
        SDK 来源字段 <code className="text-zinc-200">{field}</code> · {hint}
      </span>
    </div>
  );
}

function formatOptionalNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? compactNumber(value) : '-';
}

function averagePerformanceEvidence(
  events: NonNullable<PerformanceMetricSummary['events']>,
  mode: 'startup' | 'page',
): { avgFps?: number; avgRssDeltaMb?: number; fpsCount: number; rssCount: number } {
  const fpsValues = events
    .map((event) => extractFrameEvidence(event).fps)
    .filter(isFiniteNumber);
  const rssValues = events
    .map((event) => extractRssEvidence(event, mode).deltaRssMb)
    .filter(isFiniteNumber);
  return {
    avgFps: average(fpsValues),
    avgRssDeltaMb: average(rssValues),
    fpsCount: fpsValues.length,
    rssCount: rssValues.length,
  };
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function kindFromTitle(title: string): MetricKind {
  if (title.includes('启动')) return 'startup';
  if (title.includes('页面')) return 'pages';
  if (title.includes('网络')) return 'network';
  if (title.includes('卡顿')) return 'jank';
  return 'errors';
}
