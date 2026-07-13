import { useMemo, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { RecordShell } from './record-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/common/status-badge';
import { CopyableId } from '../../components/common/copyable-id';
import { JsonViewer } from './json-viewer';
import type { HttpCatalogItem, MonitorEvent } from '../../shared/datasource/types';
import { readPath } from '../../shared/event-model/accessors';
import { formatDuration } from '../../shared/formatting/format';
import { copyText } from '../../shared/formatting/download';
import { useToast } from '../../components/common/toast';

export function HttpRecord({ open, item, event, loading, error, onOpenChange }: {
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
    <RecordShell open={open} onOpenChange={onOpenChange} title={item ? `${item.method ?? 'HTTP'} ${pathOnly(item.url)}` : 'HTTP 详情'} state={state} summary={item ? <RecordSummary item={item} /> : undefined}>
      {loading ? <StateMessage>正在加载原始事件</StateMessage> : error ? <StateMessage>HTTP 详情加载失败</StateMessage> : !event ? <StateMessage>找不到该事件，可能已超过本地保留上限。</StateMessage> : (
        <Tabs defaultValue={failed ? 'response' : 'request'} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <TabsList className="w-fit">
            <TabsTrigger value="request">请求</TabsTrigger><TabsTrigger value="response">响应</TabsTrigger><TabsTrigger value="context">上下文</TabsTrigger><TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>
          <TabsContent value="request" className="overflow-auto"><HttpSide event={event} side="request" /></TabsContent>
          <TabsContent value="response" className="overflow-auto"><HttpSide event={event} side="response" /></TabsContent>
          <TabsContent value="context" className="overflow-auto"><Context event={event} /></TabsContent>
          <TabsContent value="raw" className="overflow-auto"><JsonViewer value={event} collapsed={2} /></TabsContent>
        </Tabs>
      )}
    </RecordShell>
  );
}

function RecordSummary({ item }: { item: HttpCatalogItem }) {
  return <div className="grid gap-2"><div className="flex flex-wrap items-center gap-2"><Badge tone={item.success === false ? 'danger' : 'good'}>{item.statusCode ?? (item.success === false ? '失败' : '成功')}</Badge><strong className="font-mono text-sm">{item.method}</strong><span className="tabular-nums text-xs text-text-secondary">{formatDuration(item.durationMs)}</span></div><p className="break-all font-mono text-xs text-text-primary">{item.url}</p>{item.detailDropped ? <p className="flex items-center gap-1 text-xs text-status-warning"><AlertTriangle className="size-3.5" />详情已被 SDK 剥离</p> : null}</div>;
}

function HttpSide({ event, side }: { event: MonitorEvent; side: 'request' | 'response' }) {
  const detail = readPath(event, ['payload', 'http.detail', side]) ?? readPath(event, ['payload', 'http', 'detail', side]);
  const dropped = readPath(event, ['payload', 'http.detail_dropped']) === true;
  if (!isRecord(detail)) return <StateMessage>{dropped ? 'SDK 在队列压力下剥离了 HTTP 详情。' : `本次事件没有 ${side === 'request' ? 'request' : 'response'} 详情。`}</StateMessage>;
  const headers = detail.headers;
  const body = detail.body;
  return <div className="grid gap-4"><DataSection title={side === 'request' ? 'Headers / Query' : 'Headers'} value={headers ?? (side === 'request' ? readPath(event, ['payload', 'http.query']) : undefined)} /><BodySection body={body} truncated={detail.body_truncated === true} format={typeof detail.body_format === 'string' ? detail.body_format : undefined} /></div>;
}

function BodySection({ body, truncated, format }: { body: unknown; truncated: boolean; format?: string }) {
  const { showToast } = useToast();
  const [formatted, setFormatted] = useState(true);
  const parsed = useMemo(() => parseJson(body), [body]);
  if (body === undefined || body === null || body === '') return <StateMessage>本次事件没有 body，可能为空响应或未开启对应采集。</StateMessage>;
  const shown = formatted && parsed.ok ? parsed.value : typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return <section className="grid gap-2"><header className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-text-primary">Body</h3><p className="text-xs text-text-secondary">{format ?? (parsed.ok ? 'json' : 'text')}{truncated ? ' · 已截断' : ''}</p></div><div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => setFormatted((value) => !value)} disabled={!parsed.ok}>{formatted ? '原文' : '格式化'}</Button><Button size="icon" variant="ghost" aria-label="复制 body" onClick={() => void copyText(typeof shown === 'string' ? shown : JSON.stringify(shown)).then(() => showToast({ tone: 'success', title: '已复制 body' }))}><Copy /></Button></div></header>{typeof shown === 'string' ? <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-all rounded-panel border border-border-default bg-subtle p-3 text-xs leading-5 text-text-code">{shown}</pre> : <JsonViewer value={shown as Record<string, unknown>} collapsed={3} />}</section>;
}

function Context({ event }: { event: MonitorEvent }) { return <div className="grid gap-4"><section className="grid gap-2"><Id label="Event ID" value={event.eventId} /><Id label="Session ID" value={event.sessionId} /><Id label="Trace ID" value={event.traceId} /><Id label="Span ID" value={event.spanId} /><Id label="Request ID" value={stringValue(readPath(event, ['attributes', 'http.request_id']))} /></section><DataSection title="Context" value={event.context} /><DataSection title="Resource" value={event.resource} /></div>; }
function DataSection({ title, value }: { title: string; value: unknown }) { return <section className="grid gap-2"><h3 className="text-sm font-semibold text-text-primary">{title}</h3>{value === undefined ? <p className="text-xs text-text-secondary">没有可用数据。</p> : <JsonViewer value={value as Record<string, unknown>} collapsed={2} />}</section>; }
function Id({ label, value }: { label: string; value?: string }) { return <div className="flex items-center justify-between gap-3 border-b border-border-muted pb-2 text-xs"><span className="text-text-secondary">{label}</span><CopyableId value={value} short={false} /></div>; }
function StateMessage({ children }: { children: React.ReactNode }) { return <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-text-secondary">{children}</div>; }
function pathOnly(url?: string) { if (!url) return '请求'; try { return new URL(url).pathname; } catch { return url; } }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stringValue(value: unknown) { return typeof value === 'string' ? value : undefined; }
function parseJson(value: unknown): { ok: true; value: unknown } | { ok: false } { if (typeof value !== 'string') return isRecord(value) || Array.isArray(value) ? { ok: true, value } : { ok: false }; try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false }; } }
