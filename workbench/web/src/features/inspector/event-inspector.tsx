import { Link } from '@tanstack/react-router';
import { AlertTriangle, Braces, Clipboard, ExternalLink, GitBranch, Info, type LucideIcon } from 'lucide-react';
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
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { EventKindBadge } from '../timeline/status-badge';
import { JsonViewer } from './json-viewer';
import { copyJson } from '../../shared/formatting/download';
import { statusLabel } from '../../shared/event-model/status';
import { cn } from '../../shared/formatting/cn';
import { eventDisplay, formatCompactField, formatDisplayField } from '../../shared/event-model/display';

export function EventInspector({
  event,
  traceEvents = [],
  onSelectEvent,
}: {
  event?: MonitorEvent;
  traceEvents?: MonitorEvent[];
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  if (!event) {
    return (
      <Card className="h-full min-h-0">
        <CardContent className="p-3">
          <EmptyState title="未选择链路节点" description="从会话链路中选择启动、页面、请求、错误或行为节点。" />
        </CardContent>
      </Card>
    );
  }

  const breadcrumbs = breadcrumbsOf(event);
  const labels = issueLabels(event);
  const display = eventDisplay(event);
  const { showToast } = useToast();

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
          <CardTitle>节点诊断</CardTitle>
          <div className="mt-1 flex items-center gap-1">
            <EventKindBadge event={event} />
            {display.status ? <Badge tone={display.status.value === 'error' ? 'danger' : 'neutral'}>{formatCompactField(display.status)}</Badge> : null}
            {labels.map((label) => <Badge key={label} tone="warn">{label}</Badge>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconTooltipButton type="button" variant="secondary" size="icon" label="复制原始数据" icon={Clipboard} onClick={() => void copyEventJson()} />
          <CopyableId value={event.eventId} />
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
  return (
    <div className="grid gap-2">
      <section className="rounded-md border border-teal-200 bg-teal-50 p-3">
        <div className="text-xs text-teal-700">当前节点</div>
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
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={index} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-600">
                  <AlertTriangle className="size-3.5" />
                  足迹 #{index + 1}
                </div>
                <JsonViewer value={breadcrumb} />
              </div>
            ))}
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
    <section className="rounded-md border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-700">{title}</div>
      <div className="grid gap-1.5 p-2">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-900">{value}</span>
    </div>
  );
}

type InspectorField = NonNullable<ReturnType<typeof eventDisplay>['phase']>;

function FieldGroup({ title, fields, emptyText }: { title: string; fields: InspectorField[]; emptyText?: string }) {
  if (fields.length === 0) {
    return emptyText ? (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-500">{emptyText}</div>
    ) : null;
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50 px-2 py-1.5 text-xs font-semibold text-zinc-600">{title}</div>
      <div className="divide-y divide-zinc-100">
        {fields.map((field) => <FieldRow key={field.path} field={field} />)}
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: InspectorField }) {
  if (!field) return null;
  return (
    <div className="grid gap-1 px-2 py-1.5 text-xs sm:grid-cols-[minmax(132px,0.85fr)_minmax(96px,0.55fr)_minmax(0,1fr)] sm:items-start sm:gap-2">
      <div className="break-all font-mono font-medium text-zinc-500">{field.path}</div>
      <div className="break-words font-semibold text-zinc-950">{field.value}</div>
      {field.description ? <div className="break-words leading-relaxed text-zinc-500">{field.description}</div> : <div className="hidden sm:block" />}
    </div>
  );
}
