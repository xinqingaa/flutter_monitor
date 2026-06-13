import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, Download, HardDrive, Info, ListTree, Route, Send, Smartphone, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Dialog } from '../../components/ui/dialog';
import type { JsonObject, MonitorEvent, SessionConsoleResult, SessionSummary } from '../../shared/datasource/types';
import { appVersionOf, environmentOf, readPath, routeOf, stringPath, userIdOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';
import { statusLabel } from '../../shared/event-model/status';
import { FieldExplanation } from '../inspector/field-explanation';
import { summarizeNativeSession } from '../../shared/event-model/native';

export function SessionHeader({
  sessionId,
  events,
  summary,
  consoleData,
  scopeNotice,
  onExport,
}: {
  sessionId: string;
  events: MonitorEvent[];
  summary?: SessionSummary;
  consoleData?: SessionConsoleResult;
  scopeNotice?: string;
  onExport?: () => void;
}) {
  const first = events[0];
  const last = events[events.length - 1];
  const duration = first?.timestamp && last?.timestamp
    ? Date.parse(last.timestamp) - Date.parse(first.timestamp)
    : undefined;
  const contextEvent = events.find((event) => userIdOf(event) !== '-' || routeOf(event) !== '-') ?? first;
  const resource = events.find((event) => event.resource)?.resource;
  const native = summarizeNativeSession(events);
  const consoleSummary = consoleData?.summary;
  const [expanded, setExpanded] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);

  return (
    <Card>
      <CardContent className="grid gap-2 p-2.5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge tone={statusTone(summary?.status)}>{statusLabel(summary?.status)}</Badge>
            <Badge tone={native.available ? 'teal' : 'neutral'}>{native.available ? 'Native on' : 'Native off'}</Badge>
            <h2 className="min-w-0 truncate text-[15px] font-semibold text-zinc-950">{sessionId}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconTooltipButton type="button" variant="secondary" size="icon" label="字段说明" icon={ListTree} onClick={() => setFieldDialogOpen(true)} />
            {onExport ? (
              <IconTooltipButton type="button" variant="secondary" size="icon" label="导出原始 JSON" icon={Download} onClick={onExport} />
            ) : null}
            <IconTooltipButton
              type="button"
              variant="secondary"
              size="icon"
              label={expanded ? '收起会话信息' : '展开会话信息'}
              icon={expanded ? ChevronDown : ChevronRight}
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className="tabular-nums">{formatDateTime(first?.timestamp)} - {formatDateTime(last?.timestamp)}</span>
          <span className="text-zinc-300">·</span>
          <span>持续 {formatDuration(duration)}</span>
          <span className="text-zinc-300">·</span>
          <span>事件 {consoleData?.count ?? events.length}</span>
          <span className="text-zinc-300">·</span>
          <span>错误 {summary?.errorCount ?? 0}</span>
          <span className="text-zinc-300">·</span>
          <span>业务失败 {summary?.businessFailureCount ?? 0}</span>
          <span className="text-zinc-300">·</span>
          <span>失败请求 {summary?.failedHttpCount ?? 0}</span>
          <span className="text-zinc-300">·</span>
          <span>慢 HTTP {consoleSummary?.slowHttpCount ?? 0}</span>
          <span className="text-zinc-300">·</span>
          <span>慢页面 {consoleSummary?.slowPageCount ?? 0}</span>
          <span className="text-zinc-300">·</span>
          <span>SDK 丢弃 {consoleSummary?.sdkDroppedCount ?? 0}</span>
        </div>
        {scopeNotice ? (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            {scopeNotice}
          </div>
        ) : null}
        <div
          className={cn(
            'overflow-hidden border-t border-zinc-100 transition-[max-height,opacity,transform] duration-200 ease-out',
            expanded ? 'max-h-[420px] translate-y-0 opacity-100' : 'max-h-0 -translate-y-1 opacity-0',
          )}
        >
          <SessionEnvironment
            summary={summary}
            consoleData={consoleData}
            contextEvent={contextEvent}
            resource={resource}
            native={native}
            duration={duration}
          />
        </div>
      </CardContent>
      <Dialog
        open={fieldDialogOpen}
        title="字段说明"
        description="当前会话首个可用事件的 canonical 字段说明和值。"
        onClose={() => setFieldDialogOpen(false)}
      >
        <FieldExplanation event={contextEvent} />
      </Dialog>
    </Card>
  );
}

function statusTone(status?: string): 'neutral' | 'danger' | 'warn' {
  if (status === 'error') return 'danger';
  if (status === 'warning' || status === 'warn') return 'warn';
  return 'neutral';
}

function SessionEnvironment({
  summary,
  consoleData,
  contextEvent,
  resource,
  native,
  duration,
}: {
  summary?: SessionSummary;
  consoleData?: SessionConsoleResult;
  contextEvent?: MonitorEvent;
  resource?: JsonObject;
  native: ReturnType<typeof summarizeNativeSession>;
  duration?: number;
}) {
  const consoleSummary = consoleData?.summary;
  const appName = stringPath(resource, ['app', 'appName']) ?? summary?.appName;
  const packageName = stringPath(resource, ['app', 'packageName']) ?? summary?.packageName;
  const dartVersion = stringPath(resource, ['runtime', 'dartVersion']);
  const isDebug = readPath(resource, ['runtime', 'isDebug']);
  const sdkName = stringPath(resource, ['sdk', 'name']);
  const coreVersion = stringPath(resource, ['sdk', 'coreVersion']);
  const refreshRate = readPath(resource, ['device', 'refreshRate']);
  const manufacturer = summary?.deviceManufacturer ?? stringPath(resource, ['device', 'manufacturer']);
  const platform = summary?.devicePlatform ?? stringPath(resource, ['device', 'platform']);
  const model = summary?.deviceModel ?? stringPath(resource, ['device', 'model']);
  const osVersion = summary?.osVersion ?? stringPath(resource, ['device', 'osVersion']);
  const tier = summary?.deviceTier ?? stringPath(resource, ['device', 'deviceTier']);
  const routeText = [consoleSummary?.firstRoute, consoleSummary?.lastRoute ?? summary?.route].filter(Boolean).join(' -> ') || routeOf(contextEvent);
  const longestStay = consoleSummary?.longestPageStay
    ? `最长停留 ${consoleSummary.longestPageStay.route ?? '-'} ${formatDuration(consoleSummary.longestPageStay.durationMs)}`
    : undefined;
  const queue = consoleSummary?.latestQueueLength !== undefined
    ? `队列 ${consoleSummary.latestQueueLength} 条 / ${formatBytes(consoleSummary.latestQueueBytes)}`
    : undefined;
  const nativeText = native.available
    ? `${native.platform ?? 'native'} ${native.version ? `v${native.version}` : '已接入'} · lifecycle ${native.lifecycleCount} · memory ${native.memoryCount}`
    : 'Native 未接入';

  return (
    <div className="grid gap-2 pt-2">
      <div className="text-xs font-medium text-zinc-500">会话环境</div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
        <EnvironmentCard
          icon={User}
          title="用户与版本"
          primary={[summary?.userId ?? userIdOf(contextEvent), summary?.environment ?? environmentOf(contextEvent)].filter(Boolean).join(' · ')}
          secondary={[appName, summary?.appVersion ?? appVersionOf(contextEvent), summary?.buildNumber ? `build ${summary.buildNumber}` : undefined, packageName].filter(Boolean).join(' · ')}
        />
        <EnvironmentCard
          icon={Smartphone}
          title="设备环境"
          primary={[platform, osVersion ? `OS ${osVersion}` : undefined, [manufacturer, model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
          secondary={[tier, typeof refreshRate === 'number' ? `${Math.round(refreshRate)}Hz` : undefined].filter(Boolean).join(' · ')}
        />
        <EnvironmentCard
          icon={Route}
          title="会话路径"
          primary={routeText}
          secondary={[formatDuration(consoleSummary?.durationMs ?? duration), consoleSummary?.routeCount !== undefined ? `${consoleSummary.routeCount} 个页面` : undefined, longestStay].filter(Boolean).join(' · ')}
        />
        <EnvironmentCard
          icon={Send}
          title="采集健康"
          primary={[consoleSummary?.outputModes.join(', '), queue].filter(Boolean).join(' · ')}
          secondary={[
            consoleData ? `flush ${consoleData.sdkHealth.flushCount} 次，失败 ${consoleData.sdkHealth.flushFailureCount}` : undefined,
            `重试 ${consoleSummary?.sdkRetryCount ?? 0}`,
            `丢弃 ${consoleSummary?.sdkDroppedCount ?? 0}`,
            `详情剥离 ${consoleSummary?.detailDroppedCount ?? 0}`,
          ].filter(Boolean).join(' · ')}
        />
        <EnvironmentCard
          icon={Cpu}
          title="运行时"
          primary={[dartVersion ? `Dart ${dartVersion}` : undefined, typeof isDebug === 'boolean' ? (isDebug ? 'debug' : 'release') : undefined].filter(Boolean).join(' · ')}
          secondary={[sdkName, coreVersion ? `core ${coreVersion}` : undefined, nativeText].filter(Boolean).join(' · ')}
        />
      </div>
    </div>
  );
}

function EnvironmentCard({
  icon: Icon,
  title,
  primary,
  secondary,
}: {
  icon: typeof User;
  title: string;
  primary?: string;
  secondary?: string;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="mt-1 truncate text-xs font-medium text-zinc-900">{primary || '-'}</div>
      {secondary ? <div className="mt-0.5 truncate text-[11px] text-zinc-500">{secondary}</div> : null}
    </section>
  );
}

function formatBytes(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${Math.round(value)}B`;
}
