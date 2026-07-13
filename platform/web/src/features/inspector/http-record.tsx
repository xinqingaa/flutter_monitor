import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Copy, FileJson, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../components/ui/empty';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CopyableId } from '../../components/common/copyable-id';
import { useToast } from '../../components/common/toast';
import type { HttpCatalogItem, MonitorEvent } from '../../shared/datasource/types';
import { readPath } from '../../shared/event-model/accessors';
import { copyText } from '../../shared/formatting/download';
import { formatDuration } from '../../shared/formatting/format';
import { JsonViewer } from './json-viewer';
import { RecordShell } from './record-shell';

export function HttpRecord({
  open,
  item,
  event,
  loading,
  error,
  onOpenChange,
}: {
  open: boolean;
  item?: HttpCatalogItem;
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const failed = item?.success === false || event?.status === 'error';
  const state = loading ? 'loading' : error ? 'error' : !event ? 'notFound' : item?.detailDropped ? 'partial' : 'ready';
  return (
    <RecordShell
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `${item.method ?? 'HTTP'} ${pathOnly(item.url)}` : 'HTTP 详情'}
      description={item?.url}
      state={state}
      summary={item ? <RecordSummary item={item} /> : undefined}
    >
      {loading ? (
        <RecordLoading />
      ) : error ? (
        <RecordState icon={AlertCircle} title="HTTP 详情加载失败" description="请检查 Monitor Service 后重试。" />
      ) : !event ? (
        <RecordState icon={Network} title="找不到该事件" description="事件可能已超过本地保留上限。" />
      ) : (
        <Tabs
          key={event.eventId}
          defaultValue={failed ? 'response' : 'request'}
          className="flex h-full min-h-0 flex-col gap-4 p-6"
        >
          <TabsList className="w-fit shrink-0">
            <TabsTrigger value="request">请求</TabsTrigger>
            <TabsTrigger value="response">响应</TabsTrigger>
            <TabsTrigger value="context">上下文</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>
          <RecordTab value="request"><HttpSide event={event} side="request" /></RecordTab>
          <RecordTab value="response"><HttpSide event={event} side="response" /></RecordTab>
          <RecordTab value="context"><Context event={event} /></RecordTab>
          <RecordTab value="raw"><JsonViewer value={event} collapsed={2} /></RecordTab>
        </Tabs>
      )}
    </RecordShell>
  );
}

function RecordSummary({ item }: { item: HttpCatalogItem }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.success === false ? 'destructive' : 'secondary'}>
          {item.statusCode ?? (item.success === false ? '失败' : '成功')}
        </Badge>
        <Badge variant="outline">{item.businessCode ?? businessCodeLabel(item)}</Badge>
        <span className="font-mono text-sm font-medium">{item.method ?? 'HTTP'}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{formatDuration(item.durationMs)}</span>
        {item.route ? <span className="text-sm text-muted-foreground">{item.route}</span> : null}
      </div>
      {item.detailDropped ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>请求详情不可用</AlertTitle>
          <AlertDescription>SDK 已剥离本次请求详情，摘要和索引字段仍然可用。</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function RecordTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="h-full pr-4">{children}</ScrollArea>
    </TabsContent>
  );
}

function HttpSide({ event, side }: { event: MonitorEvent; side: 'request' | 'response' }) {
  const detail = readPath(event, ['payload', 'http.detail', side]) ?? readPath(event, ['payload', 'http', 'detail', side]);
  const dropped = readPath(event, ['payload', 'http.detail_dropped']) === true;
  if (!isRecord(detail)) {
    return (
      <RecordState
        icon={Network}
        title={side === 'request' ? '没有请求详情' : '没有响应详情'}
        description={dropped ? 'SDK 在队列压力下剥离了 HTTP 详情。' : '本次事件没有可展示的详情。'}
      />
    );
  }
  const headers = detail.headers;
  const query = side === 'request'
    ? detail.query ?? readPath(event, ['payload', 'http.query']) ?? readPath(event, ['payload', 'http', 'query'])
    : undefined;
  return (
    <div className="flex flex-col gap-6 pb-6">
      {side === 'request' ? <DataSection title="Query" value={query} /> : null}
      <DataSection title="Headers" value={headers} />
      <Separator />
      <BodySection
        body={detail.body}
        truncated={detail.body_truncated === true}
        format={typeof detail.body_format === 'string' ? detail.body_format : undefined}
      />
    </div>
  );
}

function BodySection({ body, truncated, format }: { body: unknown; truncated: boolean; format?: string }) {
  const { showToast } = useToast();
  const [formatted, setFormatted] = useState(true);
  const parsed = useMemo(() => parseJson(body), [body]);
  if (body === undefined || body === null || body === '') {
    return <RecordState icon={FileJson} title="没有 Body" description="可能是空响应，或未开启对应详情采集。" compact />;
  }
  const shown = formatted && parsed.ok ? parsed.value : typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Body</h3>
          <p className="text-sm text-muted-foreground">
            {format ?? (parsed.ok ? 'json' : 'text')}{truncated ? ' · 已截断' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setFormatted((value) => !value)} disabled={!parsed.ok}>
            {formatted ? '查看原文' : '格式化'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="复制 body"
            onClick={() => void copyText(typeof shown === 'string' ? shown : JSON.stringify(shown)).then(
              () => showToast({ tone: 'success', title: '已复制 body' }),
              () => showToast({ tone: 'danger', title: 'body 复制失败' }),
            )}
          >
            <Copy data-icon="inline-start" />
          </Button>
        </div>
      </header>
      {truncated ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Body 已截断</AlertTitle>
          <AlertDescription>当前内容不是完整响应，仅用于诊断参考。</AlertDescription>
        </Alert>
      ) : null}
      {typeof shown === 'string' ? (
        <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-4 text-xs leading-5">
          {shown}
        </pre>
      ) : (
        <JsonViewer value={shown as Record<string, unknown>} collapsed={3} />
      )}
    </section>
  );
}

function Context({ event }: { event: MonitorEvent }) {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <section className="flex flex-col gap-3">
        <Id label="Event ID" value={event.eventId} />
        <Id label="Session ID" value={event.sessionId} />
        <Id label="Trace ID" value={event.traceId} />
        <Id label="Span ID" value={event.spanId} />
        <Id label="Request ID" value={stringValue(readPath(event, ['attributes', 'http.request_id']))} />
      </section>
      <Separator />
      <DataSection title="Context" value={event.context} />
      <DataSection title="Resource" value={event.resource} />
    </div>
  );
}

function DataSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {value === undefined ? (
        <p className="text-sm text-muted-foreground">没有可用数据。</p>
      ) : (
        <JsonViewer value={value as Record<string, unknown>} collapsed={2} />
      )}
    </section>
  );
}

function Id({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <CopyableId value={value} short={false} />
    </div>
  );
}

function RecordLoading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="min-h-64 flex-1 w-full" />
    </div>
  );
}

function RecordState({
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  icon: typeof Network;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <Empty className={compact ? 'min-h-40 border-0' : 'h-full border-0'}>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function pathOnly(url?: string) {
  if (!url) return '请求';
  try { return new URL(url).pathname; } catch { return url; }
}

function businessCodeLabel(item: HttpCatalogItem) {
  return item.businessCodeState === 'parse_failed'
    ? '业务码解析失败'
    : item.businessCodeState === 'detail_unavailable'
      ? '业务码不可用'
      : '无业务码';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function parseJson(value: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof value !== 'string') return isRecord(value) || Array.isArray(value) ? { ok: true, value } : { ok: false };
  try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false }; }
}
