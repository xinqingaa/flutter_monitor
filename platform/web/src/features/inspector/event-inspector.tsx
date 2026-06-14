import { Link } from '@tanstack/react-router';
import { AlertTriangle, Braces, ChevronDown, ChevronRight, Clipboard, ExternalLink, GitBranch, Info, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { useToast } from '../../components/ui/toast';
import type { JsonObject, MonitorEvent } from '../../shared/datasource/types';
import {
  appVersionOf,
  breadcrumbsOf,
  deviceOf,
  environmentOf,
  httpStatusOf,
  issueLabels,
  moduleOf,
  networkOf,
  releaseOf,
  routeOf,
  sceneOf,
  userIdOf,
} from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration, formatTime } from '../../shared/formatting/format';
import { EventKindBadge } from '../timeline/status-badge';
import { JsonViewer } from './json-viewer';
import { copyJson } from '../../shared/formatting/download';
import { statusLabel } from '../../shared/event-model/status';
import { cn } from '../../shared/formatting/cn';
import { eventDisplay, formatCompactField } from '../../shared/event-model/display';
import { HttpInspector } from './http-inspector';
import { readCanonicalPath } from '../../shared/event-model/field-path';

export function EventInspector({
  event,
  traceEvents = [],
  onSelectEvent,
  panelAction,
}: {
  event?: MonitorEvent;
  traceEvents?: MonitorEvent[];
  onSelectEvent?: (event: MonitorEvent) => void;
  panelAction?: React.ReactNode;
}) {
  const { showToast } = useToast();

  if (!event) {
    return (
      <Card className="h-full min-h-0">
        <CardContent className="p-3">
          <EmptyState title="未选择链路节点" description="从会话链路中选择启动、页面、请求、错误或行为节点。" />
        </CardContent>
      </Card>
    );
  }

  if (event.name === 'http.client') {
    return (
      <HttpInspector
        event={event}
        panelAction={panelAction}
        relatedEvents={traceEvents}
        onSelectEvent={onSelectEvent}
      />
    );
  }

  const breadcrumbs = breadcrumbsOf(event);
  const labels = issueLabels(event);
  const display = eventDisplay(event);
  const profile = inspectorProfile(event);

  async function copyEventJson() {
    try {
      await copyJson(event);
      showToast({ tone: 'success', title: '已复制原始数据', description: '完整 EventEnvelope 已写入剪贴板。' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入，请在原始数据页手动复制。' });
    }
  }

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>{profile.title}</CardTitle>
          <div className="mt-1 flex items-center gap-1">
            <EventKindBadge event={event} />
            {display.status ? <Badge tone={display.status.value === 'error' ? 'danger' : 'neutral'}>{formatCompactField(display.status)}</Badge> : null}
            {labels.map((label) => <Badge key={label} tone="warn">{label}</Badge>)}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 pr-1">
          <IconTooltipButton type="button" variant="secondary" size="icon" label="复制原始数据" icon={Clipboard} onClick={() => void copyEventJson()} />
          <CopyableId value={event.eventId} />
          {panelAction}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden p-3">
        <Tabs defaultValue="summary" className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
          <TabsList className="w-fit">
            <IconTab value="summary" label="诊断摘要" icon={Info} />
            <IconTab value="trace" label="关联链路" icon={GitBranch} />
            <IconTab value="raw" label="原始数据" icon={Braces} />
          </TabsList>

          <TabsContent value="summary" className="min-h-0 overflow-auto">
            <Summary event={event} />
          </TabsContent>
          <TabsContent value="trace" className="min-h-0 overflow-auto">
            <TracePanel event={event} traceEvents={traceEvents} breadcrumbs={breadcrumbs} onSelectEvent={onSelectEvent} />
          </TabsContent>
          <TabsContent value="raw" className="min-h-0 overflow-hidden">
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
              <div className="flex justify-end">
                <IconTooltipButton type="button" variant="secondary" size="icon" label="复制完整 JSON" icon={Clipboard} onClick={() => void copyEventJson()} />
              </div>
              <JsonViewer value={event} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function IconTab({ value, label, icon: Icon }: { value: string; label: string; icon: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabsTrigger
          value={value}
          aria-label={label}
          title={label}
          className="h-8 w-9 border border-transparent px-0 text-zinc-500 data-[state=active]:border-zinc-900 data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-white"
        >
          <Icon className="size-3.5" />
        </TabsTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Summary({ event }: { event: MonitorEvent }) {
  const labels = issueLabels(event);
  const display = eventDisplay(event);
  const profile = inspectorProfile(event);
  return (
    <div className="grid gap-2">
      <section className="rounded-md border border-teal-200 bg-teal-50 p-3">
        <div className="text-xs text-teal-700">{profile.eyebrow}</div>
        <div className="mt-1 text-lg font-semibold text-zinc-950">{display.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-teal-800">
          <span>{display.signalType}</span>
          {display.nameDescription ? <><span>·</span><span>{display.nameDescription}</span></> : null}
          {display.phase ? <><span>·</span><span>{formatCompactField(display.phase)}</span></> : null}
          {display.status ? <><span>·</span><span>{formatCompactField(display.status)}</span></> : null}
          {display.duration ? <><span>·</span><span>{formatCompactField(display.duration)}</span></> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.length > 0 ? labels.map((label) => <Badge key={label} tone="warn">{label}</Badge>) : <Badge tone="good">暂无明显问题</Badge>}
        </div>
      </section>
      <TypedDetails event={event} kind={profile.kind} />
      <Section title="一眼看懂">
        <Fact label="发生时间" value={formatTime(event.timestamp)} />
        <Fact label="页面" value={routeOf(event)} />
        <Fact label="耗时" value={formatDuration(event.durationMs)} />
        <Fact label="状态" value={statusLabel(event.status)} />
        <Fact label="HTTP 状态码" value={httpStatusOf(event)} />
      </Section>
      <Section title="链路位置">
        <Fact label="模块" value={moduleOf(event)} />
        <Fact label="场景" value={sceneOf(event)} />
      </Section>
      <Section title="影响上下文">
        <Fact label="用户" value={userIdOf(event)} />
        <Fact label="App" value={`${appVersionOf(event)} · ${environmentOf(event)}`} />
        <Fact label="设备" value={deviceOf(event)} />
        <Fact label="网络" value={networkOf(event)} />
        <Fact label="发布" value={releaseOf(event)} />
      </Section>
      <Section title="关键字段">
        <FieldGroup
          title="基础字段"
          fields={[display.phase, display.status, display.duration].filter((field): field is NonNullable<typeof field> => Boolean(field))}
        />
        <FieldGroup title="事件字段" fields={[...display.primaryFields, ...display.secondaryFields]} emptyText="该节点没有额外 attributes/context 摘要字段。" />
      </Section>
      <Section title="定位信息">
        <Fact label="sessionId" value={<CopyableId value={display.debugIds.sessionId} />} />
        <Fact label="traceId" value={<CopyableId value={display.debugIds.traceId} />} />
        <Fact label="spanId" value={<CopyableId value={display.debugIds.spanId} />} />
        <Fact label="eventId" value={<CopyableId value={display.debugIds.eventId} />} />
        <Fact label="signalType" value={display.debugIds.signalType ?? '-'} />
      </Section>
    </div>
  );
}

type InspectorKind = 'startup' | 'page' | 'interaction' | 'business' | 'problem' | 'memory' | 'sdk' | 'generic';

function inspectorProfile(event: MonitorEvent): { kind: InspectorKind; title: string; eyebrow: string } {
  const name = event.name ?? '';
  if (name === 'app.cold_start' || name === 'app.hot_start' || name === 'sdk.init') {
    return { kind: 'startup', title: '启动 Inspector', eyebrow: '启动链路' };
  }
  if (name.startsWith('page.') || name === 'route.push' || name === 'route.pop') {
    return { kind: 'page', title: '页面 Inspector', eyebrow: '页面节点' };
  }
  if (name === 'interaction.measure' || readCanonicalPath(event, 'attributes.interaction.mode') !== undefined) {
    return { kind: 'interaction', title: '交互性能 Inspector', eyebrow: '交互性能节点' };
  }
  if (name.startsWith('business.') || readCanonicalPath(event, 'attributes.business.action') !== undefined) {
    return { kind: 'business', title: '业务埋点 Inspector', eyebrow: '业务埋点节点' };
  }
  if (name.startsWith('memory.') || name.startsWith('native.memory.')) {
    return { kind: 'memory', title: '内存 Inspector', eyebrow: '内存证据节点' };
  }
  if (event.signalType === 'sdk' || name.startsWith('sdk.')) {
    return { kind: 'sdk', title: 'SDK Inspector', eyebrow: 'SDK 自监控节点' };
  }
  if (event.status === 'error' || event.level === 'error' || name.includes('jank')) {
    return { kind: 'problem', title: '问题 Inspector', eyebrow: '问题节点' };
  }
  return { kind: 'generic', title: '节点诊断', eyebrow: '当前节点' };
}

function TypedDetails({ event, kind }: { event: MonitorEvent; kind: InspectorKind }) {
  if (kind === 'startup') return <StartupDetails event={event} />;
  if (kind === 'page') return <PageDetails event={event} />;
  if (kind === 'interaction') return <InteractionDetails event={event} />;
  if (kind === 'business') return <BusinessDetails event={event} />;
  if (kind === 'problem') return <ProblemDetails event={event} />;
  if (kind === 'memory') return <MemoryDetails event={event} />;
  if (kind === 'sdk') return <SdkDetails event={event} />;
  return null;
}

function StartupDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="启动证据">
      <Fact label="启动类型" value={textValue(event, 'attributes.app.start.type')} />
      <Fact label="闭合口径" value={textValue(event, 'attributes.app.start.end_reason')} />
      <Fact label="总耗时" value={formatDuration(event.durationMs)} />
      <Fact label="首帧" value={durationField(event, 'attributes.app.first_frame_ms') ?? durationField(event, 'attributes.page.first_frame_ms')} />
      <Fact label="可交互" value={durationField(event, 'attributes.app.interactive_ms') ?? durationField(event, 'attributes.app.time_to_interactive_ms')} />
      <Fact label="RSS 变化" value={memoryDelta(event)} />
    </Section>
  );
}

function PageDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="页面证据">
      <Fact label="路由" value={routeOf(event)} />
      <Fact label="阶段" value={textValue(event, 'attributes.event.phase')} />
      <Fact label="加载" value={durationField(event, 'attributes.page.load_ms')} />
      <Fact label="首帧" value={durationField(event, 'attributes.page.first_frame_ms')} />
      <Fact label="停留" value={event.name === 'page.stay' ? formatDuration(event.durationMs) : undefined} />
      <Fact label="跳转" value={[textValue(event, 'attributes.page.from'), textValue(event, 'attributes.page.to')].filter(Boolean).join(' -> ')} />
      <Fact label="帧表现" value={frameSummary(event)} />
      <Fact label="RSS 变化" value={memoryDelta(event)} />
    </Section>
  );
}

function InteractionDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="交互性能">
      <Fact label="业务动作" value={textValue(event, 'attributes.business.action')} />
      <Fact label="交互模式" value={textValue(event, 'attributes.interaction.mode')} />
      <Fact label="活跃耗时" value={durationField(event, 'attributes.interaction.active_ms')} />
      <Fact label="稳定耗时" value={durationField(event, 'attributes.interaction.settle_ms')} />
      <Fact label="总耗时" value={formatDuration(event.durationMs)} />
      <Fact label="帧表现" value={frameSummary(event)} />
    </Section>
  );
}

function BusinessDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="业务埋点">
      <Fact label="业务动作" value={textValue(event, 'attributes.business.action')} />
      <Fact label="状态" value={statusLabel(event.status)} />
      <Fact label="耗时" value={formatDuration(event.durationMs)} />
      <Fact label="业务结果" value={textValue(event, 'attributes.business.result') ?? textValue(event, 'payload.result')} />
    </Section>
  );
}

function ProblemDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="问题证据">
      <Fact label="状态" value={statusLabel(event.status)} />
      <Fact label="级别" value={event.level} />
      <Fact label="错误类型" value={textValue(event, 'attributes.error.type') ?? textValue(event, 'payload.error_type')} />
      <Fact label="机制" value={textValue(event, 'attributes.error.mechanism') ?? textValue(event, 'payload.mechanism')} />
      <Fact label="帧表现" value={frameSummary(event)} />
    </Section>
  );
}

function MemoryDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="内存证据">
      <Fact label="RSS" value={mbField(event, 'attributes.memory.rss_mb') ?? mbField(event, 'attributes.memory.current_rss_mb')} />
      <Fact label="增长" value={mbDeltaField(event, 'attributes.memory.growth_mb')} />
      <Fact label="压力级别" value={textValue(event, 'attributes.memory.pressure_level') ?? textValue(event, 'attributes.native.memory.pressure_level')} />
      <Fact label="Native 使用" value={mbField(event, 'attributes.native.memory.used_mb') ?? mbField(event, 'attributes.memory.native_used_mb')} />
      <Fact label="证据说明" value={textValue(event, 'payload.assertion') ?? textValue(event, 'payload.evidence.reason')} />
    </Section>
  );
}

function SdkDetails({ event }: { event: MonitorEvent }) {
  return (
    <Section title="SDK 采集健康">
      <Fact label="输出模式" value={textValue(event, 'attributes.sdk.output.mode') ?? textValue(event, 'payload.output_mode')} />
      <Fact label="队列" value={queueSummary(event)} />
      <Fact label="重试" value={retrySummary(event)} />
      <Fact label="丢弃" value={dropSummary(event)} />
      <Fact label="Flush" value={flushSummary(event)} />
      <Fact label="Batch" value={numberValue(event, 'attributes.sdk.batch.size')} />
    </Section>
  );
}

function TracePanel({
  event,
  traceEvents,
  breadcrumbs,
  onSelectEvent,
}: {
  event: MonitorEvent;
  traceEvents: MonitorEvent[];
  breadcrumbs: JsonObject[];
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  return (
    <div className="grid gap-3">
      <Section title="同一链路内的节点">
        {event.traceId && traceEvents.length === 0 ? (
          <EmptyState title="没有关联节点" />
        ) : (
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {traceEvents.map((item) => (
              <TraceEventRow key={item.eventId} item={item} current={item.eventId === event.eventId} onSelectEvent={onSelectEvent} />
            ))}
          </div>
        )}
      </Section>
      <Section title="上下文足迹">
        {breadcrumbs.length === 0 ? (
          <EmptyState title="无上下文足迹" />
        ) : (
          <div className="grid gap-2">
            {breadcrumbs.map((breadcrumb, index) => <BreadcrumbCard key={index} breadcrumb={breadcrumb} index={index} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

function TraceEventRow({
  item,
  current,
  onSelectEvent,
}: {
  item: MonitorEvent;
  current: boolean;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const display = eventDisplay(item);
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-1.5', current && 'bg-teal-50')}>
      <button type="button" onClick={() => onSelectEvent?.(item)} className="min-w-0 text-left">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatTime(item.startTime ?? item.timestamp)}</span>
          <EventKindBadge event={item} />
          <span className="min-w-0 truncate font-medium text-zinc-900">{display.name}</span>
          {display.nameDescription ? <span className="shrink-0 text-xs text-zinc-500">{display.nameDescription}</span> : null}
          {current ? <Badge tone="teal" className="shrink-0 rounded-md px-1.5 py-0">当前</Badge> : null}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          {display.phase ? <span>{formatCompactField(display.phase)}</span> : null}
          {display.status ? <span>{formatCompactField(display.status)}</span> : null}
          {display.duration ? <span>{formatCompactField(display.duration)}</span> : null}
          {display.primaryFields.slice(0, 2).map((field) => <span key={field.path} className="min-w-0 truncate">{formatCompactField(field)}</span>)}
        </div>
      </button>
      {display.debugIds.eventId ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/events/$eventId"
              params={{ eventId: display.debugIds.eventId }}
              className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white hover:text-teal-700"
              aria-label="打开 Event 详情"
              title="打开 Event 详情"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>打开 Event 详情</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-700">{title}</div>
      <div className="grid gap-1.5 p-2">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-900">{value === undefined || value === '' ? '-' : value}</span>
    </div>
  );
}

function textValue(event: MonitorEvent, path: string): string | undefined {
  const value = readCanonicalPath(event, path);
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function numberValue(event: MonitorEvent, path: string): string | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}

function numberField(event: MonitorEvent, path: string): number | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function durationField(event: MonitorEvent, path: string): string | undefined {
  const value = numberField(event, path);
  return value === undefined ? undefined : formatDuration(value);
}

function mbField(event: MonitorEvent, path: string): string | undefined {
  const value = numberField(event, path);
  if (value === undefined) return undefined;
  return `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}MB`;
}

function mbDeltaField(event: MonitorEvent, path: string): string | undefined {
  const value = numberField(event, path);
  if (value === undefined) return undefined;
  return `${value > 0 ? '+' : ''}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}MB`;
}

function memoryDelta(event: MonitorEvent): string | undefined {
  const delta = mbDeltaField(event, 'attributes.memory.delta_rss_mb') ??
    mbDeltaField(event, 'attributes.memory.delta_mb') ??
    mbDeltaField(event, 'attributes.memory.growth_mb');
  if (delta) return delta;
  const start = mbField(event, 'attributes.memory.start_rss_mb') ?? mbField(event, 'attributes.memory.enter_rss_mb');
  const end = mbField(event, 'attributes.memory.end_rss_mb') ?? mbField(event, 'attributes.memory.exit_rss_mb');
  return [start, end].filter(Boolean).join(' -> ') || undefined;
}

function frameSummary(event: MonitorEvent): string | undefined {
  const slow = numberField(event, 'attributes.frame.slow_count');
  const sample = numberField(event, 'attributes.frame.sample_count');
  const max = numberField(event, 'attributes.frame.max_ms');
  const fps = numberField(event, 'attributes.frame.fps');
  const parts = [
    slow !== undefined ? `慢帧 ${slow}${sample !== undefined ? `/${sample}` : ''}` : undefined,
    max !== undefined ? `最大 ${Math.round(max)}ms` : undefined,
    fps !== undefined ? `${Math.round(fps)}fps` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function queueSummary(event: MonitorEvent): string | undefined {
  const length = numberField(event, 'attributes.sdk.queue.length');
  const bytes = numberField(event, 'attributes.sdk.queue.bytes');
  return [length !== undefined ? `${length} 条` : undefined, bytesLabel(bytes)].filter(Boolean).join(' / ') || undefined;
}

function retrySummary(event: MonitorEvent): string | undefined {
  const count = numberField(event, 'attributes.sdk.retry.count') ?? numberField(event, 'attributes.sdk.health.retry_count');
  const delay = durationField(event, 'attributes.sdk.retry.delay_ms');
  const reason = textValue(event, 'attributes.sdk.retry.reason');
  return [count !== undefined ? `${count} 次` : undefined, delay, reason].filter(Boolean).join(' / ') || undefined;
}

function dropSummary(event: MonitorEvent): string | undefined {
  const count = numberField(event, 'attributes.sdk.drop.count') ?? numberField(event, 'attributes.sdk.health.dropped_count');
  const reason = textValue(event, 'attributes.sdk.drop.reason') ?? textValue(event, 'payload.reason');
  return [count !== undefined ? `${count} 条` : undefined, reason].filter(Boolean).join(' / ') || undefined;
}

function flushSummary(event: MonitorEvent): string | undefined {
  const result = textValue(event, 'attributes.sdk.flush.result') ?? (event.name?.includes('flush') ? statusLabel(event.status) : undefined);
  const sent = numberField(event, 'attributes.sdk.flush.sent_count') ?? numberField(event, 'attributes.sdk.health.sent_count');
  const reason = textValue(event, 'attributes.sdk.flush.reason');
  return [result, sent !== undefined ? `${sent} sent` : undefined, reason].filter(Boolean).join(' / ') || undefined;
}

function bytesLabel(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${Math.round(value)}B`;
}

type InspectorField = NonNullable<ReturnType<typeof eventDisplay>['phase']>;

function FieldGroup({ title, fields, emptyText }: { title: string; fields: InspectorField[]; emptyText?: string }) {
  if (fields.length === 0) {
    return emptyText ? (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-500">{emptyText}</div>
    ) : null;
  }

  return (
    <div className="rounded-md bg-zinc-50/80 px-2 py-2">
      <div className="px-1 pb-1.5 text-xs font-semibold text-zinc-600">{title}</div>
      <div className="grid gap-1.5">
        {fields.map((field) => <FieldRow key={field.path} field={field} />)}
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: InspectorField }) {
  if (!field) return null;
  return (
    <div className="grid gap-1 rounded-md bg-white px-2 py-1.5 text-xs shadow-sm shadow-zinc-200/40 sm:grid-cols-[minmax(128px,0.8fr)_minmax(96px,0.55fr)_minmax(0,1fr)] sm:items-start sm:gap-2">
      <div className="break-all font-mono font-medium text-zinc-500">{field.path}</div>
      <div className="break-words font-semibold text-zinc-950">{field.value}</div>
      {field.description ? <div className="break-words leading-relaxed text-zinc-500">{field.description}</div> : <div className="hidden sm:block text-zinc-400">-</div>}
    </div>
  );
}

function BreadcrumbCard({ breadcrumb, index }: { breadcrumb: JsonObject; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const summary = breadcrumbSummary(breadcrumb);

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 px-2 py-2 text-left hover:bg-zinc-50">
        <span className={cn(
          'mt-0.5 inline-flex size-7 items-center justify-center rounded-md border',
          summary.tone === 'danger' && 'border-red-200 bg-red-50 text-red-700',
          summary.tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
          summary.tone === 'neutral' && 'border-zinc-200 bg-zinc-50 text-zinc-500',
        )}>
          <AlertTriangle className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-zinc-900">足迹 #{index + 1}</span>
            <Badge tone={summary.tone} className="rounded-md px-1.5 py-0">{summary.type}</Badge>
            {summary.status ? <Badge tone={summary.status === 'error' ? 'danger' : 'neutral'} className="rounded-md px-1.5 py-0">{summary.status}</Badge> : null}
          </span>
          <span className="mt-1 block truncate text-xs text-zinc-600">{summary.title}</span>
          <span className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500">
            {summary.time ? <span>{summary.time}</span> : null}
            {summary.route ? <span>页面 {summary.route}</span> : null}
            {summary.duration ? <span>耗时 {summary.duration}</span> : null}
          </span>
        </span>
        {expanded ? <ChevronDown className="mt-1 size-4 text-zinc-400" /> : <ChevronRight className="mt-1 size-4 text-zinc-400" />}
      </button>
      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50 p-2">
          <div className="max-h-[320px] min-h-[120px] overflow-hidden">
            <JsonViewer value={breadcrumb} collapsed={1} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function breadcrumbSummary(breadcrumb: JsonObject) {
  const type = readBreadcrumbText(breadcrumb, ['type', 'signalType', 'category', 'name']) ?? 'breadcrumb';
  const name = readBreadcrumbText(breadcrumb, ['name', 'action', 'message', 'event']);
  const route = readBreadcrumbText(breadcrumb, ['route', 'routeName', 'page', 'screen', 'context.route.name']);
  const status = readBreadcrumbText(breadcrumb, ['status', 'level']);
  const timestamp = readBreadcrumbText(breadcrumb, ['timestamp', 'time', 'occurredAt']);
  const duration = readBreadcrumbNumber(breadcrumb, ['durationMs', 'duration_ms']);
  const title = name ?? route ?? type;
  const tone = status === 'error' || type.includes('error') || type.includes('fail')
    ? 'danger'
    : type.includes('jank') || type.includes('warning') || status === 'warning'
      ? 'warn'
      : 'neutral';

  return {
    type,
    title,
    route,
    status,
    tone: tone as 'neutral' | 'warn' | 'danger',
    time: timestamp ? formatDateTime(timestamp) : undefined,
    duration: typeof duration === 'number' ? formatDuration(duration) : undefined,
  };
}

function readBreadcrumbText(object: JsonObject, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = readObjectPath(object, path);
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

function readBreadcrumbNumber(object: JsonObject, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = readObjectPath(object, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readObjectPath(object: JsonObject, path: string): unknown {
  if (path in object) return object[path];
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as JsonObject)[key];
    }
    return undefined;
  }, object);
}
