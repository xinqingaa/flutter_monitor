import { Link } from '@tanstack/react-router';
import { AlertTriangle, Braces, GitBranch, Info, ListTree } from 'lucide-react';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import type { JsonObject, MonitorEvent } from '../../shared/datasource/types';
import {
  appVersionOf,
  breadcrumbsOf,
  deviceOf,
  environmentOf,
  eventKind,
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
import { FieldExplanation } from './field-explanation';
import { JsonViewer } from './json-viewer';

export function EventInspector({
  event,
  traceEvents = [],
}: {
  event?: MonitorEvent;
  traceEvents?: MonitorEvent[];
}) {
  if (!event) {
    return (
      <Card className="h-full min-h-0">
        <CardContent className="p-3">
          <EmptyState title="未选择事件" description="从 timeline 或 recent 列表中选择事件后查看解释。" />
        </CardContent>
      </Card>
    );
  }

  const breadcrumbs = breadcrumbsOf(event);
  const labels = issueLabels(event);

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Event Inspector</CardTitle>
          <div className="mt-1 flex items-center gap-1">
            <EventKindBadge event={event} />
            {labels.map((label) => <Badge key={label} tone="warn">{label}</Badge>)}
          </div>
        </div>
        <CopyableId value={event.eventId} />
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden p-3">
        <Tabs defaultValue="summary" className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
          <TabsList>
            <TabsTrigger value="summary"><Info className="mr-1 size-3.5" />Summary</TabsTrigger>
            <TabsTrigger value="trace"><GitBranch className="mr-1 size-3.5" />Trace</TabsTrigger>
            <TabsTrigger value="fields"><ListTree className="mr-1 size-3.5" />Fields</TabsTrigger>
            <TabsTrigger value="raw"><Braces className="mr-1 size-3.5" />Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="min-h-0 overflow-auto">
            <Summary event={event} />
          </TabsContent>
          <TabsContent value="trace" className="min-h-0 overflow-auto">
            <TracePanel event={event} traceEvents={traceEvents} breadcrumbs={breadcrumbs} />
          </TabsContent>
          <TabsContent value="fields" className="min-h-0 overflow-hidden">
            <FieldExplanation event={event} />
          </TabsContent>
          <TabsContent value="raw" className="min-h-0 overflow-hidden">
            <JsonViewer value={event} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Summary({ event }: { event: MonitorEvent }) {
  return (
    <div className="grid gap-3">
      <Section title="事件语义">
        <Fact label="类型" value={eventKind(event)} />
        <Fact label="名称" value={event.name ?? '-'} />
        <Fact label="时间" value={formatTime(event.timestamp)} />
        <Fact label="耗时" value={formatDuration(event.durationMs)} />
        <Fact label="状态" value={event.status ?? '-'} />
        <Fact label="级别" value={event.level ?? '-'} />
        <Fact label="优先级" value={event.priority ?? '-'} />
        <Fact label="HTTP 状态码" value={httpStatusOf(event)} />
      </Section>
      <Section title="发生位置">
        <Fact label="Session" value={<CopyableId value={event.sessionId} />} />
        <Fact label="Trace" value={event.traceId ? <Link className="text-teal-700 hover:underline" to="/traces/$traceId" params={{ traceId: event.traceId }}>{event.traceId}</Link> : '-'} />
        <Fact label="Span" value={<CopyableId value={event.spanId} />} />
        <Fact label="Route" value={routeOf(event)} />
        <Fact label="Module" value={moduleOf(event)} />
        <Fact label="Scene" value={sceneOf(event)} />
      </Section>
      <Section title="影响上下文">
        <Fact label="User" value={userIdOf(event)} />
        <Fact label="App" value={`${appVersionOf(event)} · ${environmentOf(event)}`} />
        <Fact label="Device" value={deviceOf(event)} />
        <Fact label="Network" value={networkOf(event)} />
        <Fact label="Release" value={releaseOf(event)} />
      </Section>
    </div>
  );
}

function TracePanel({
  event,
  traceEvents,
  breadcrumbs,
}: {
  event: MonitorEvent;
  traceEvents: MonitorEvent[];
  breadcrumbs: JsonObject[];
}) {
  return (
    <div className="grid gap-3">
      <Section title="同 Trace 事件">
        {event.traceId && traceEvents.length === 0 ? (
          <EmptyState title="没有 trace 事件" />
        ) : (
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {traceEvents.map((item) => (
              <Link
                key={item.eventId}
                to="/events/$eventId"
                params={{ eventId: item.eventId ?? '-' }}
                className="grid grid-cols-[76px_1fr_70px] gap-2 px-2 py-1.5 text-[12px] hover:bg-teal-50"
              >
                <span className="text-zinc-500">{formatTime(item.timestamp)}</span>
                <span className="truncate text-zinc-900">{item.name ?? '-'}</span>
                <span className="text-right text-zinc-500">{formatDuration(item.durationMs)}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>
      <Section title="Breadcrumbs">
        {breadcrumbs.length === 0 ? (
          <EmptyState title="无 breadcrumb 快照" />
        ) : (
          <div className="grid gap-2">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={index} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-zinc-600">
                  <AlertTriangle className="size-3.5" />
                  Breadcrumb #{index + 1}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[12px] font-semibold text-zinc-700">{title}</div>
      <div className="grid gap-1.5 p-2">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2 text-[12px]">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 text-zinc-900">{value}</span>
    </div>
  );
}
