import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileJson, Network, Terminal } from 'lucide-react';
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
import { Label } from '../../components/ui/label';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CopyableId } from '../../components/common/copyable-id';
import { useToast } from '../../components/common/toast';
import type { HttpCatalogItem, JsonObject, MonitorEvent } from '../../shared/datasource/types';
import { readPath } from '../../shared/event-model/accessors';
import { cn } from '../../shared/formatting/cn';
import { copyText } from '../../shared/formatting/download';
import { formatDuration } from '../../shared/formatting/format';
import { buildCurlCommand } from '../../shared/formatting/http-curl';
import { EnvironmentProfile } from './environment-profile';
import { JsonViewer } from './json-viewer';
import { RecordShell } from './record-shell';

export function HttpRecord({
  open,
  item,
  event,
  loading,
  error,
  items = [],
  onOpenChange,
  onNavigate,
  onExpand,
}: {
  open: boolean;
  item?: HttpCatalogItem;
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
  items?: HttpCatalogItem[];
  onOpenChange: (open: boolean) => void;
  onNavigate?: (item: HttpCatalogItem) => void;
  onExpand?: (eventId: string) => void;
}) {
  const { showToast } = useToast();
  const failed = item?.success === false || event?.status === 'error';
  const state = loading ? 'loading' : error ? 'error' : !event ? 'notFound' : item?.detailDropped ? 'partial' : 'ready';
  const index = item ? items.findIndex((entry) => entry.eventId === item.eventId) : -1;
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
  const fromEvent = event ? httpSummaryFromEvent(event) : undefined;
  const summaryItem = item || fromEvent
    ? {
        ...fromEvent,
        ...item,
        userId: item?.userId ?? fromEvent?.userId,
        appVersion: item?.appVersion ?? fromEvent?.appVersion,
        environment: item?.environment ?? fromEvent?.environment,
        devicePlatform: item?.devicePlatform ?? fromEvent?.devicePlatform,
        sessionId: item?.sessionId ?? fromEvent?.sessionId,
        route: item?.route ?? fromEvent?.route,
      }
    : undefined;

  async function copyCurl() {
    try {
      await copyHttpCurl({ item, event });
      showToast({ tone: 'success', title: '已复制 cURL' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '当前 HTTP 事件缺少 URL，无法生成 cURL。' });
    }
  }

  return (
    <RecordShell
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `${item.method ?? 'HTTP'} ${pathOnly(item.url)}` : 'HTTP 详情'}
      description={item?.url}
      state={state}
      summary={summaryItem ? <HttpRecordSummary item={summaryItem} /> : undefined}
      headerActions={(
        <>
          <Button
            size="icon"
            variant="ghost"
            aria-label="上一条"
            disabled={!previous || !onNavigate}
            onClick={() => previous && onNavigate?.(previous)}
          >
            <ChevronLeft data-icon="inline-start" />
          </Button>
          <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
            {items.length === 0 || index < 0 ? '-' : `${index + 1}/${items.length}`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="下一条"
            disabled={!next || !onNavigate}
            onClick={() => next && onNavigate?.(next)}
          >
            <ChevronRight data-icon="inline-start" />
          </Button>
          {onExpand && item?.eventId ? (
            <Button size="sm" variant="outline" onClick={() => onExpand(item.eventId)}>
              <ExternalLink data-icon="inline-start" />
              全屏
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => void copyCurl()} disabled={!item?.url}>
            <Terminal data-icon="inline-start" />
            复制 cURL
          </Button>
        </>
      )}
    >
      <HttpRecordContent event={event} loading={loading} error={error} failed={failed} />
    </RecordShell>
  );
}

export function HttpRecordContent({
  event,
  loading,
  error,
  failed = false,
  className,
}: {
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
  failed?: boolean;
  className?: string;
}) {
  if (loading) return <RecordLoading />;
  if (error) return <RecordState icon={AlertCircle} title="HTTP 详情加载失败" description="请检查 Monitor Service 后重试。" />;
  if (!event) return <RecordState icon={Network} title="找不到该事件" description="事件可能已超过本地保留上限。" />;

  return (
    <Tabs
      key={event.eventId}
      defaultValue={failed ? 'response' : 'request'}
      className={cn('flex h-full min-h-0 flex-col gap-4 p-6', className)}
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
  );
}

export function HttpRecordSummary({ item }: {
  item: {
    success?: boolean;
    statusCode?: number;
    businessCode?: string;
    businessCodeState?: HttpCatalogItem['businessCodeState'];
    method?: string;
    durationMs?: number;
    route?: string;
    detailDropped?: boolean;
    userId?: string;
    appVersion?: string;
    environment?: string;
    devicePlatform?: string;
    sessionId?: string;
  };
}) {
  const contextParts = [
    item.userId ? `用户 ${item.userId}` : undefined,
    item.appVersion ? `版本 ${item.appVersion}` : undefined,
    item.environment ? `环境 ${item.environment}` : undefined,
    item.devicePlatform ? `平台 ${item.devicePlatform}` : undefined,
    item.sessionId ? `Session ${shortId(item.sessionId)}` : undefined,
  ].filter(Boolean);

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
      {contextParts.length ? (
        <p className="text-sm text-muted-foreground" title={item.sessionId}>
          {contextParts.join(' · ')}
        </p>
      ) : null}
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

export async function copyHttpCurl({ item, event }: { item?: Pick<HttpCatalogItem, 'method' | 'url'>; event?: MonitorEvent }) {
  if (!event && !item) throw new Error('missing http event');
  const detail = event
    ? (readPath(event, ['payload', 'http.detail']) ?? readPath(event, ['payload', 'http', 'detail'])) as
      | { request?: { headers?: JsonObject; body?: unknown } }
      | undefined
    : undefined;
  const query = event
    ? readPath(event, ['payload', 'http.query']) ?? readPath(event, ['payload', 'http', 'query'])
    : undefined;
  const url = item?.url ?? stringValue(readPath(event!, ['payload', 'url'])) ?? stringValue(readPath(event!, ['attributes', 'http.url']));
  if (!url) throw new Error('missing url');
  const curl = buildCurlCommand({
    method: item?.method ?? stringValue(readPath(event!, ['attributes', 'http.method'])),
    url,
    query,
    headers: detail?.request?.headers,
    body: detail?.request?.body,
  });
  await copyText(curl);
}

export function httpSummaryFromEvent(event: MonitorEvent): {
  method?: string;
  url?: string;
  statusCode?: number;
  businessCode?: string;
  businessCodeState?: HttpCatalogItem['businessCodeState'];
  success?: boolean;
  durationMs?: number;
  route?: string;
  detailDropped?: boolean;
  sessionId?: string;
  traceId?: string;
  requestId?: string;
  appVersion?: string;
  environment?: string;
  devicePlatform?: string;
  userId?: string;
} {
  const statusCode = numberValue(readPath(event, ['attributes', 'http.status_code']));
  const successAttr = readPath(event, ['attributes', 'http.success']);
  return {
    method: stringValue(readPath(event, ['attributes', 'http.method'])),
    url: stringValue(readPath(event, ['payload', 'url'])) ?? stringValue(readPath(event, ['attributes', 'http.url'])),
    statusCode,
    businessCode: stringValue(readPath(event, ['attributes', 'http.business_code'])),
    success: typeof successAttr === 'boolean' ? successAttr : event.status !== 'error',
    durationMs: event.durationMs,
    route: stringValue(readPath(event, ['context', 'route', 'name']))
      ?? stringValue(readPath(event, ['context', 'route', 'fullName'])),
    detailDropped: readPath(event, ['payload', 'http.detail_dropped']) === true
      || readPath(event, ['payload', 'http', 'detail_dropped']) === true,
    sessionId: event.sessionId,
    traceId: event.traceId,
    requestId: stringValue(readPath(event, ['attributes', 'http.request_id'])),
    appVersion: stringValue(readPath(event, ['resource', 'app', 'appVersion'])),
    environment: stringValue(readPath(event, ['resource', 'app', 'environment'])),
    devicePlatform: stringValue(readPath(event, ['resource', 'device', 'platform'])),
    userId: stringValue(readPath(event, ['context', 'user', 'userId'])),
  };
}

export function pathOnly(url?: string) {
  if (!url) return '请求';
  try { return new URL(url).pathname; } catch { return url; }
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
  const [raw, setRaw] = useState(false);
  const parsed = useMemo(() => parseJson(body), [body]);
  if (body === undefined || body === null || body === '') {
    return <RecordState icon={FileJson} title="没有 Body" description="可能是空响应，或未开启对应详情采集。" compact />;
  }
  const formatted = !raw && parsed.ok;
  const shown = formatted ? parsed.value : typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Body</h3>
          <p className="text-sm text-muted-foreground">
            {format ?? (parsed.ok ? 'json' : 'text')}{truncated ? ' · 已截断' : ''}
          </p>
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
  const requestId = stringValue(readPath(event, ['attributes', 'http.request_id']));
  return (
    <div className="flex flex-col gap-6 pb-6">
      {requestId ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">请求 ID</span>
              <CopyableId value={requestId} short={false} />
            </div>
          </section>
          <Separator />
        </>
      ) : null}
      <EnvironmentProfile event={event} />
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

function businessCodeLabel(item: { businessCodeState?: HttpCatalogItem['businessCodeState'] }) {
  return item.businessCodeState === 'parse_failed'
    ? '业务码解析失败'
    : item.businessCodeState === 'detail_unavailable'
      ? '业务码不可用'
      : '无业务码';
}

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseJson(value: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof value !== 'string') return isRecord(value) || Array.isArray(value) ? { ok: true, value } : { ok: false };
  try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false }; }
}
