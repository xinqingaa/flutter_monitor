import { Braces, Clipboard, FileText, GitBranch, Info, MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/toast';
import type { JsonObject, MonitorEvent } from '../../shared/datasource/types';
import { routeOf, userIdOf } from '../../shared/event-model/accessors';
import { eventDisplay } from '../../shared/event-model/display';
import { readCanonicalPath } from '../../shared/event-model/field-path';
import { copyJson } from '../../shared/formatting/download';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { JsonViewer } from './json-viewer';

interface HttpDetail {
  request?: {
    headers?: JsonObject;
    body?: unknown;
  };
  response?: {
    headers?: JsonObject;
    body?: unknown;
  };
}

export function HttpInspector({
  event,
  panelAction,
}: {
  event: MonitorEvent;
  panelAction?: React.ReactNode;
}) {
  const { showToast } = useToast();
  const summary = httpSummary(event);

  async function copyEventJson() {
    try {
      await copyJson(event);
      showToast({ tone: 'success', title: '已复制原始数据', description: '完整 HTTP EventEnvelope 已写入剪贴板。' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入，请在原始数据页手动复制。' });
    }
  }

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>HTTP Inspector</CardTitle>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge tone={summary.failed ? 'danger' : 'good'}>{summary.statusLabel}</Badge>
            {summary.detailDropped ? <Badge tone="warn">详情剥离</Badge> : <Badge tone="teal">详情完整</Badge>}
            {summary.bodyTruncated ? <Badge tone="warn">body truncated</Badge> : null}
            {summary.source ? <Badge tone="neutral">{summary.source}</Badge> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 pr-1">
          <IconTooltipButton type="button" variant="secondary" size="icon" label="复制原始数据" icon={Clipboard} onClick={() => void copyEventJson()} />
          <CopyableId value={event.eventId} />
          {panelAction}
        </div>
      </CardHeader>
      <CardContent className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3">
        <section className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="min-w-0 truncate text-base font-semibold text-zinc-950">
            {[summary.method, summary.url].filter(Boolean).join(' ') || 'HTTP 请求'}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-blue-800">
            <span>{summary.statusLabel}</span>
            <span>{formatDuration(event.durationMs)}</span>
            {summary.responseSizeLabel ? <span>response {summary.responseSizeLabel}</span> : null}
            {summary.requestSizeLabel ? <span>request {summary.requestSizeLabel}</span> : null}
            {summary.route ? <span>route {summary.route}</span> : null}
            {summary.requestId ? <span>requestId {summary.requestId}</span> : null}
          </div>
        </section>

        <Tabs defaultValue="summary" className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
          <TabsList className="w-fit">
            <IconTab value="summary" label="摘要" icon={Info} />
            <IconTab value="request" label="请求" icon={Send} />
            <IconTab value="response" label="响应" icon={MessageSquare} />
            <IconTab value="context" label="上下文" icon={GitBranch} />
            <IconTab value="raw" label="原始数据" icon={Braces} />
          </TabsList>

          <TabsContent value="summary" className="min-h-0 overflow-auto">
            <SummaryPanel event={event} summary={summary} />
          </TabsContent>
          <TabsContent value="request" className="min-h-0 overflow-auto">
            <RequestPanel event={event} summary={summary} />
          </TabsContent>
          <TabsContent value="response" className="min-h-0 overflow-auto">
            <ResponsePanel summary={summary} />
          </TabsContent>
          <TabsContent value="context" className="min-h-0 overflow-auto">
            <ContextPanel event={event} />
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

function IconTab({ value, label, icon: Icon }: { value: string; label: string; icon: typeof Info }) {
  return (
    <TabsTrigger value={value} aria-label={label} title={label} className="h-8 gap-1.5 px-2">
      <Icon className="size-3.5" />
      <span>{label}</span>
    </TabsTrigger>
  );
}

function SummaryPanel({ event, summary }: { event: MonitorEvent; summary: ReturnType<typeof httpSummary> }) {
  return (
    <div className="grid gap-3">
      <Section title="请求概况">
        <Fact label="method" value={summary.method} />
        <Fact label="url" value={summary.url} />
        <Fact label="status" value={summary.statusLabel} />
        <Fact label="duration" value={formatDuration(event.durationMs)} />
        <Fact label="success" value={summary.success === undefined ? undefined : String(summary.success)} />
        <Fact label="error type" value={summary.errorType} />
      </Section>
      <Section title="数据规模">
        <Fact label="request size" value={summary.requestSizeLabel} />
        <Fact label="response size" value={summary.responseSizeLabel} />
        <Fact label="body original" value={summary.bodyOriginalLength === undefined ? undefined : byteLabel(summary.bodyOriginalLength)} />
        <Fact label="body sha256" value={summary.bodySha256} />
      </Section>
      <Section title="详情状态">
        <Fact label="query" value={summary.hasQuery ? '已采集' : '无 query'} />
        <Fact label="request headers" value={summary.hasRequestHeaders ? '已采集' : '无 headers'} />
        <Fact label="request body" value={summary.hasRequestBody ? '已采集' : requestBodyEmptyReason(summary)} />
        <Fact label="response headers" value={summary.hasResponseHeaders ? '已采集' : responseEmptyReason(summary)} />
        <Fact label="response body" value={summary.hasResponseBody ? '已采集' : responseEmptyReason(summary)} />
        <Fact label="detail dropped" value={summary.detailDropped ? 'true' : 'false'} />
      </Section>
    </div>
  );
}

function RequestPanel({ event, summary }: { event: MonitorEvent; summary: ReturnType<typeof httpSummary> }) {
  return (
    <div className="grid gap-3">
      <Section title="URL 与 Query">
        <Fact label="url" value={summary.url} />
        <JsonBlock title="query" value={summary.query} empty="本次请求没有 query，或 SDK 没有采集到 query 字段。" />
      </Section>
      <Section title="Request Headers">
        <KeyValueTable value={summary.detail?.request?.headers} empty="本次事件没有 request headers。旧数据或接入方未开启 header 采集时会为空。" />
      </Section>
      <Section title="Request Body">
        <BodyBlock value={summary.detail?.request?.body} empty={requestBodyEmptyReason(summary)} />
      </Section>
      <Section title="Request Raw Fields">
        <KeyValueTable
          value={{
            method: summary.method,
            requestSizeBytes: summary.requestSize,
            source: summary.source,
            requestId: summary.requestId,
            traceId: event.traceId,
          }}
        />
      </Section>
    </div>
  );
}

function ResponsePanel({ summary }: { summary: ReturnType<typeof httpSummary> }) {
  return (
    <div className="grid gap-3">
      <Section title="Response Status">
        <Fact label="status code" value={summary.statusCode === undefined ? undefined : String(summary.statusCode)} />
        <Fact label="success" value={summary.success === undefined ? undefined : String(summary.success)} />
        <Fact label="error type" value={summary.errorType} />
      </Section>
      <Section title="Response Headers">
        <KeyValueTable value={summary.detail?.response?.headers} empty={responseEmptyReason(summary)} />
      </Section>
      <Section title="Response Body">
        <BodyBlock value={summary.detail?.response?.body} empty={responseEmptyReason(summary)} />
        {summary.bodyTruncated || summary.bodyOriginalLength !== undefined || summary.bodySha256 ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {summary.bodyTruncated ? '响应 body 已按 SDK 策略截断。' : '响应 body 未标记截断。'}
            {summary.bodyOriginalLength !== undefined ? ` 原始长度 ${byteLabel(summary.bodyOriginalLength)}。` : ''}
            {summary.bodySha256 ? ` SHA-256 ${summary.bodySha256}。` : ''}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function ContextPanel({ event }: { event: MonitorEvent }) {
  const display = eventDisplay(event);
  return (
    <div className="grid gap-3">
      <Section title="链路位置">
        <Fact label="sessionId" value={<CopyableId value={event.sessionId} />} />
        <Fact label="traceId" value={<CopyableId value={event.traceId} />} />
        <Fact label="spanId" value={<CopyableId value={event.spanId} />} />
        <Fact label="eventId" value={<CopyableId value={event.eventId} />} />
        <Fact label="route" value={routeOf(event)} />
      </Section>
      <Section title="影响上下文">
        <Fact label="userId" value={userIdOf(event)} />
        <Fact label="timestamp" value={formatDateTime(event.timestamp)} />
        <Fact label="signalType" value={event.signalType} />
        <Fact label="name" value={event.name} />
        <Fact label="status" value={event.status} />
      </Section>
      <Section title="关键字段">
        <KeyValueTable
          value={{
            ...Object.fromEntries(display.primaryFields.map((field) => [field.path, field.value])),
            ...Object.fromEntries(display.secondaryFields.map((field) => [field.path, field.value])),
          }}
          empty="没有额外关键字段。"
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-700">{title}</div>
      <div className="grid gap-2 p-2">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-zinc-900">{value === undefined || value === '' ? '-' : value}</span>
    </div>
  );
}

function KeyValueTable({ value, empty }: { value?: JsonObject; empty?: string }) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== undefined);
  if (entries.length === 0) {
    return <EmptyLine text={empty ?? '没有可展示字段。'} />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200">
      {entries.map(([key, item]) => (
        <div key={key} className="grid grid-cols-[minmax(110px,0.45fr)_minmax(0,1fr)] border-b border-zinc-100 last:border-b-0">
          <div className="min-w-0 break-all bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-500">{key}</div>
          <div className="min-w-0 break-words px-2 py-1.5 text-xs text-zinc-900">{formatValue(item)}</div>
        </div>
      ))}
    </div>
  );
}

function JsonBlock({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  if (!hasContent(value)) return <EmptyLine text={empty} />;
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
        <FileText className="size-3.5" />
        {title}
      </div>
      <BodyBlock value={value} empty={empty} />
    </div>
  );
}

function BodyBlock({ value, empty }: { value: unknown; empty: string }) {
  const [mode, setMode] = useState<'formatted' | 'raw'>('formatted');
  if (!hasContent(value)) return <EmptyLine text={empty} />;
  const body = parseBody(value);
  const canFormat = body.jsonValue !== undefined || body.formattedText !== undefined;
  const showFormatted = canFormat && mode === 'formatted';
  return (
    <div className="grid gap-2">
      {canFormat ? (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant={mode === 'formatted' ? 'default' : 'secondary'} className="h-7 px-2" onClick={() => setMode('formatted')}>
            格式化
          </Button>
          <Button type="button" size="sm" variant={mode === 'raw' ? 'default' : 'secondary'} className="h-7 px-2" onClick={() => setMode('raw')}>
            原文
          </Button>
        </div>
      ) : null}
      {showFormatted && body.jsonValue !== undefined ? (
        <div className="h-[360px] min-h-0">
          <JsonViewer value={body.jsonValue} />
        </div>
      ) : showFormatted ? (
        <pre className="max-h-[360px] whitespace-pre-wrap break-words overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
          {body.formattedText}
        </pre>
      ) : (
        <pre className="max-h-[360px] whitespace-pre-wrap break-words overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
          {body.raw}
        </pre>
      )}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-500">
      {text}
    </div>
  );
}

function httpSummary(event: MonitorEvent) {
  const detail = readCanonicalPath(event, 'payload.http.detail') as HttpDetail | undefined;
  const query = readCanonicalPath(event, 'payload.http.query');
  const method = readString(event, 'attributes.http.method');
  const url = readString(event, 'attributes.http.url.normalized') ?? readString(event, 'payload.url');
  const statusCode = readNumber(event, 'attributes.http.status_code');
  const success = readBoolean(event, 'attributes.http.success');
  const failed = event.status === 'error' || success === false;
  const requestSize = readNumber(event, 'attributes.http.request_content_length') ?? readNumber(event, 'attributes.http.request.size_bytes');
  const responseSize = readNumber(event, 'attributes.http.response_content_length') ?? readNumber(event, 'attributes.http.response.size_bytes');
  const bodyOriginalLength = readNumber(event, 'payload.body_original_length') ?? readNumber(event, 'payload.http.body_original_length');
  const bodySha256 = readString(event, 'payload.body_sha256') ?? readString(event, 'payload.http.body_sha256');
  const statusLabel = statusCode ? `${statusCode} ${failed ? 'Failed' : 'OK'}` : failed ? '请求失败' : '状态未知';

  return {
    method,
    url,
    statusCode,
    statusLabel,
    success,
    failed,
    requestSize,
    responseSize,
    requestSizeLabel: requestSize === undefined ? undefined : byteLabel(requestSize),
    responseSizeLabel: responseSize === undefined ? undefined : byteLabel(responseSize),
    errorType: readString(event, 'attributes.http.error_type') ?? readString(event, 'payload.error_type'),
    source: readString(event, 'attributes.http.source') ?? readString(event, 'payload.source'),
    requestId: readString(event, 'attributes.http.request_id') ?? readString(event, 'payload.request_id'),
    route: routeOf(event) === '-' ? undefined : routeOf(event),
    detail,
    query,
    hasQuery: hasContent(query),
    hasRequestHeaders: hasContent(detail?.request?.headers),
    hasRequestBody: hasContent(detail?.request?.body),
    hasResponseHeaders: hasContent(detail?.response?.headers),
    hasResponseBody: hasContent(detail?.response?.body),
    detailDropped: readBoolean(event, 'payload.http.detail_dropped') === true,
    bodyTruncated: readBoolean(event, 'payload.body_truncated') ?? readBoolean(event, 'payload.http.body_truncated'),
    bodyOriginalLength,
    bodySha256,
  };
}

function requestBodyEmptyReason(summary: ReturnType<typeof httpSummary>): string {
  if (summary.detailDropped) return 'HTTP 详情被 SDK 降级剥离，raw envelope 中 payload["http.detail_dropped"] = true。';
  if (summary.method === 'GET' || summary.method === 'HEAD') return `${summary.method} 请求通常没有 request body。`;
  return '本次事件没有 request body，可能为空 body、旧数据，或接入方未开启 body 采集。';
}

function responseEmptyReason(summary: ReturnType<typeof httpSummary>): string {
  if (summary.detailDropped) return 'HTTP 详情被 SDK 降级剥离，raw envelope 中 payload["http.detail_dropped"] = true。';
  if (summary.failed && summary.statusCode === undefined) return '请求在连接、DNS、超时或取消阶段失败，因此没有 response。';
  return '本次事件没有 response 详情，可能为空响应、旧数据，或接入方未开启对应采集。';
}

function readString(event: MonitorEvent, path: string): string | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(event: MonitorEvent, path: string): number | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(event: MonitorEvent, path: string): boolean | undefined {
  const value = readCanonicalPath(event, path);
  return typeof value === 'boolean' ? value : undefined;
}

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function parseBody(value: unknown): { raw: string; jsonValue?: unknown; formattedText?: string } {
  if (typeof value !== 'string') {
    return { raw: JSON.stringify(value, null, 2), jsonValue: value };
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { raw: value, jsonValue: JSON.parse(trimmed) };
    } catch {
      return { raw: value, formattedText: formatLooseJson(trimmed) };
    }
  }
  return { raw: value };
}

function formatLooseJson(value: string): string {
  let output = '';
  let indent = 0;
  let inString = false;
  let escaping = false;

  for (const char of value) {
    if (inString) {
      output += char;
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '{' || char === '[') {
      output += `${char}\n${'  '.repeat(++indent)}`;
      continue;
    }

    if (char === '}' || char === ']') {
      indent = Math.max(0, indent - 1);
      output += `\n${'  '.repeat(indent)}${char}`;
      continue;
    }

    if (char === ',') {
      output += `,\n${'  '.repeat(indent)}`;
      continue;
    }

    if (char === ':') {
      output += ': ';
      continue;
    }

    output += char;
  }

  return output;
}

function byteLabel(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${Math.round(value)}B`;
}
