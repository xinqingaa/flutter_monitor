import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Cpu, Download, HardDrive, Info, ListTree, Package, Route, Send, Smartphone, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Dialog } from '../../components/ui/dialog';
import type { JsonObject, MonitorEvent, SessionConsoleResult, SessionSummary } from '../../shared/datasource/types';
import { appVersionOf, environmentOf, readPath, routeOf, stringPath, userIdOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
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
        {expanded ? (
          <div className="grid gap-3 border-t border-zinc-100 pt-2">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <HeaderMetric icon={User} label="对象" value={summary?.userId ?? userIdOf(contextEvent)} detail={`${summary?.appVersion ?? appVersionOf(contextEvent)} · ${summary?.environment ?? environmentOf(contextEvent)}`} />
              <HeaderMetric icon={Smartphone} label="设备" value={[summary?.devicePlatform, summary?.deviceModel].filter(Boolean).join(' · ') || '-'} detail={summary?.osVersion ?? '-'} />
              <HeaderMetric icon={Route} label="路径" value={`${consoleSummary?.routeCount ?? 0} 个页面`} detail={[consoleSummary?.firstRoute, consoleSummary?.lastRoute].filter(Boolean).join(' -> ') || (summary?.route ?? routeOf(contextEvent))} />
              <HeaderMetric icon={Send} label="采集健康" value={`发送失败 ${consoleSummary?.sdkFlushFailureCount ?? 0}`} detail={`重试 ${consoleSummary?.sdkRetryCount ?? 0} · 丢弃 ${consoleSummary?.sdkDroppedCount ?? 0}`} />
              <HeaderMetric icon={Cpu} label="Native" value={native.available ? `${native.platform ?? 'native'} ${native.version ? `v${native.version}` : 'on'}` : 'off'} detail={native.available ? `lifecycle ${native.lifecycleCount} · memory ${native.memoryCount}` : undefined} />
            </div>
            <ExpandedFacts summary={summary} consoleData={consoleData} contextEvent={contextEvent} duration={duration} />
            {resource ? <ResourceSummary resource={resource} /> : null}
          </div>
        ) : null}
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

function HeaderMetric({ icon: Icon, label, value, detail }: { icon: typeof Clock; label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-zinc-950">{value}</div>
      {detail ? <div className="mt-0.5 truncate text-[11px] text-zinc-500">{detail}</div> : null}
    </div>
  );
}

function ExpandedFacts({
  summary,
  consoleData,
  contextEvent,
  duration,
}: {
  summary?: SessionSummary;
  consoleData?: SessionConsoleResult;
  contextEvent?: MonitorEvent;
  duration?: number;
}) {
  const consoleSummary = consoleData?.summary;
  const appFacts: Array<[string, string | undefined]> = [
    ['userId', summary?.userId ?? userIdOf(contextEvent)],
    ['appVersion', summary?.appVersion ?? appVersionOf(contextEvent)],
    ['environment', summary?.environment ?? environmentOf(contextEvent)],
    ['buildNumber', summary?.buildNumber],
    ['packageName', summary?.packageName],
  ];
  const deviceFacts: Array<[string, string | undefined]> = [
    ['platform', summary?.devicePlatform],
    ['model', summary?.deviceModel],
    ['osVersion', summary?.osVersion],
    ['deviceTier', summary?.deviceTier],
  ];
  const pathFacts: Array<[string, string | undefined]> = [
    ['持续时间', formatDuration(consoleSummary?.durationMs ?? duration)],
    ['首个页面', consoleSummary?.firstRoute],
    ['最后页面', consoleSummary?.lastRoute ?? summary?.route],
    ['页面数', consoleSummary?.routeCount !== undefined ? String(consoleSummary.routeCount) : undefined],
    ['最长停留', consoleSummary?.longestPageStay ? `${consoleSummary.longestPageStay.route ?? '-'} · ${formatDuration(consoleSummary.longestPageStay.durationMs)}` : undefined],
  ];
  const healthFacts: Array<[string, string | undefined]> = [
    ['output mode', consoleSummary?.outputModes.join(', ')],
    ['flush', consoleData ? `${consoleData.sdkHealth.flushCount} 次，失败 ${consoleData.sdkHealth.flushFailureCount}` : undefined],
    ['retry', consoleSummary?.sdkRetryCount !== undefined ? String(consoleSummary.sdkRetryCount) : undefined],
    ['dropped', consoleSummary?.sdkDroppedCount !== undefined ? String(consoleSummary.sdkDroppedCount) : undefined],
    ['queue', consoleSummary?.latestQueueLength !== undefined ? `${consoleSummary.latestQueueLength} events / ${consoleSummary.latestQueueBytes ?? 0} bytes` : undefined],
    ['detail dropped', consoleSummary?.detailDroppedCount !== undefined ? String(consoleSummary.detailDroppedCount) : undefined],
  ];

  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-4">
      <FactGroup icon={User} title="对象" facts={appFacts} />
      <FactGroup icon={Smartphone} title="设备" facts={deviceFacts} />
      <FactGroup icon={Route} title="会话路径" facts={pathFacts} />
      <FactGroup icon={HardDrive} title="采集健康" facts={healthFacts} />
    </div>
  );
}

function FactGroup({
  icon: Icon,
  title,
  facts,
}: {
  icon: typeof User;
  title: string;
  facts: Array<[string, string | undefined]>;
}) {
  return (
    <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="mt-1.5 grid gap-1">
        {facts.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-1 text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className="min-w-0 truncate text-zinc-900">{value && value !== '-' ? value : '-'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourceSummary({ resource }: { resource: JsonObject }) {
  const appName = stringPath(resource, ['app', 'appName']);
  const appVersion = stringPath(resource, ['app', 'appVersion']);
  const buildNumber = stringPath(resource, ['app', 'buildNumber']);
  const packageName = stringPath(resource, ['app', 'packageName']);
  const manufacturer = stringPath(resource, ['device', 'manufacturer']);
  const model = stringPath(resource, ['device', 'model']);
  const platform = stringPath(resource, ['device', 'platform']);
  const osVersion = stringPath(resource, ['device', 'osVersion']);
  const tier = stringPath(resource, ['device', 'deviceTier']);
  const refreshRate = readPath(resource, ['device', 'refreshRate']);
  const dartVersion = stringPath(resource, ['runtime', 'dartVersion']);
  const isDebug = readPath(resource, ['runtime', 'isDebug']);
  const sdkName = stringPath(resource, ['sdk', 'name']);
  const coreVersion = stringPath(resource, ['sdk', 'coreVersion']);

  const groups = [
    {
      label: 'App',
      icon: Package,
      values: [appName, appVersion ? `v${appVersion}` : undefined, buildNumber ? `build ${buildNumber}` : undefined, packageName],
    },
    {
      label: '设备',
      icon: Smartphone,
      values: [
        [manufacturer, model].filter(Boolean).join(' '),
        [platform, osVersion].filter(Boolean).join(' '),
        tier,
        typeof refreshRate === 'number' ? `${Math.round(refreshRate)}Hz` : undefined,
      ],
    },
    {
      label: '运行时',
      icon: Cpu,
      values: [dartVersion ? `Dart ${dartVersion}` : undefined, typeof isDebug === 'boolean' ? (isDebug ? 'debug' : 'release') : undefined],
    },
    {
      label: 'SDK',
      icon: Info,
      values: [sdkName, coreVersion ? `core ${coreVersion}` : undefined],
    },
  ].map((group) => ({ ...group, values: group.values.filter(Boolean) as string[] })).filter((group) => group.values.length > 0);

  if (groups.length === 0) return null;

  return (
    <section className="grid gap-2 border-t border-zinc-100 pt-3">
      <div className="text-xs font-medium text-zinc-500">会话环境</div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.label} className="min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Icon className="size-3.5" />
                {group.label}
              </div>
              <div className="mt-1 truncate text-xs font-medium text-zinc-900">{group.values[0]}</div>
              {group.values.length > 1 ? <div className="mt-0.5 truncate text-[11px] text-zinc-500">{group.values.slice(1).join(' · ')}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
