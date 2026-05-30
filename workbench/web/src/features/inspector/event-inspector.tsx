import { Link } from '@tanstack/react-router';
import { AlertTriangle, Braces, Clipboard, GitBranch, Info, ListTree } from 'lucide-react';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { useToast } from '../../components/ui/toast';
import type { JsonObject, MonitorEvent } from '../../shared/datasource/types';
import {
  appVersionOf,
  breadcrumbsOf,
  deviceOf,
  environmentOf,
  eventKind,
  eventKindLabel,
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
import { copyJson } from '../../shared/formatting/download';
import { statusLabel } from '../../shared/event-model/status';

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
          <EmptyState title="未选择链路节点" description="从会话链路中选择启动、页面、请求、错误或行为节点。" />
        </CardContent>
      </Card>
    );
  }

  const breadcrumbs = breadcrumbsOf(event);
  const labels = issueLabels(event);
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
          <TabsList>
            <TabsTrigger value="summary"><Info className="mr-1 size-3.5" />诊断摘要</TabsTrigger>
            <TabsTrigger value="trace"><GitBranch className="mr-1 size-3.5" />关联链路</TabsTrigger>
            <TabsTrigger value="fields"><ListTree className="mr-1 size-3.5" />字段说明</TabsTrigger>
            <TabsTrigger value="raw"><Braces className="mr-1 size-3.5" />原始数据</TabsTrigger>
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
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={() => void copyEventJson()}>
                  <Clipboard className="size-4" />
                  复制完整 JSON
                </Button>
              </div>
              <JsonViewer value={event} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Summary({ event }: { event: MonitorEvent }) {
  const labels = issueLabels(event);
  return (
    <div className="grid gap-2">
      <section className="rounded-md border border-teal-200 bg-teal-50 p-3">
        <div className="text-xs text-teal-700">当前节点</div>
        <div className="mt-1 text-lg font-semibold text-zinc-950">{eventKindLabel(event)} · {event.name ?? '-'}</div>
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
        <Fact label="会话" value={<CopyableId value={event.sessionId} />} />
        <Fact label="链路" value={event.traceId ? <Link className="text-teal-700 hover:underline" to="/traces/$traceId" params={{ traceId: event.traceId }}>{event.traceId}</Link> : '-'} />
        <Fact label="阶段" value={<CopyableId value={event.spanId} />} />
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
      <Section title="同一链路内的节点">
        {event.traceId && traceEvents.length === 0 ? (
          <EmptyState title="没有关联节点" />
        ) : (
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {traceEvents.map((item) => (
              <Link
                key={item.eventId}
                to="/events/$eventId"
                params={{ eventId: item.eventId ?? '-' }}
                className="grid grid-cols-[82px_1fr_78px] gap-2 px-2 py-1.5 text-sm hover:bg-teal-50"
              >
                <span className="text-zinc-500">{formatTime(item.timestamp)}</span>
                <span className="truncate text-zinc-900">{item.name ?? '-'}</span>
                <span className="text-right text-zinc-500">{formatDuration(item.durationMs)}</span>
              </Link>
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
      <span className="min-w-0 text-zinc-900">{value}</span>
    </div>
  );
}
