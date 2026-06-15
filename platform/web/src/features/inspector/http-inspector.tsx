import { Braces, ChevronLeft, ChevronRight, Clipboard, Eye, EyeOff, FileText, GitBranch, Info, Maximize2, MessageSquare, Search, Send, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/toast';
import type { JsonObject, MonitorEvent } from '../../shared/datasource/types';
import { routeOf, userIdOf } from '../../shared/event-model/accessors';
import { eventDisplay } from '../../shared/event-model/display';
import { readCanonicalPath } from '../../shared/event-model/field-path';
import { cn } from '../../shared/formatting/cn';
import { copyJson } from '../../shared/formatting/download';
import { formatDateTime, formatDuration, formatTime } from '../../shared/formatting/format';
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

type Layout = 'horizontal' | 'vertical';

export function HttpInspector({
  event,
  panelAction,
  relatedEvents,
  onSelectEvent,
}: {
  event: MonitorEvent;
  panelAction?: React.ReactNode;
  relatedEvents?: MonitorEvent[];
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const { showToast } = useToast();
  const [maximized, setMaximized] = useState(false);
  const summary = useMemo(() => httpSummary(event), [event]);

  async function copyEventJson() {
    try {
      await copyJson(event);
      showToast({ tone: 'success', title: '已复制原始数据', description: '完整 HTTP EventEnvelope 已写入剪贴板。' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入，请在原始数据页手动复制。' });
    }
  }

  return (
    <>
      <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>HTTP Inspector</CardTitle>
            <SummaryBadges summary={summary} />
          </div>
          <div className="flex min-w-0 items-center gap-2 pr-1">
            <IconTooltipButton type="button" variant="secondary" size="icon" label="放大查看" icon={Maximize2} onClick={() => setMaximized(true)} />
            <IconTooltipButton type="button" variant="secondary" size="icon" label="复制原始数据" icon={Clipboard} onClick={() => void copyEventJson()} />
            <CopyableId value={event.eventId} />
            {panelAction}
          </div>
        </CardHeader>
        <CardContent className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3">
          <HttpHeroBlock event={event} summary={summary} />
          <HttpInspectorBody event={event} summary={summary} layout="horizontal" />
        </CardContent>
      </Card>

      <HttpInspectorDialog
        open={maximized}
        event={event}
        relatedEvents={relatedEvents}
        onSelectEvent={onSelectEvent}
        onClose={() => setMaximized(false)}
      />
    </>
  );
}

export function HttpInspectorDialog({
  open,
  event,
  relatedEvents,
  onSelectEvent,
  onClose,
}: {
  open: boolean;
  event?: MonitorEvent;
  relatedEvents?: MonitorEvent[];
  onSelectEvent?: (event: MonitorEvent) => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const summary = useMemo(() => event ? httpSummary(event) : undefined, [event]);
  const siblings = useMemo(() => {
    const list = (relatedEvents ?? []).filter((item) => item.name === 'http.client');
    return list.sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
      const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
      return aTime - bTime;
    });
  }, [relatedEvents]);
  const siblingIndex = event ? siblings.findIndex((item) => item.eventId === event.eventId) : -1;
  const previous = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined;
  const next = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : undefined;

  async function copyEventJson() {
    if (!event) return;
    try {
      await copyJson(event);
      showToast({ tone: 'success', title: '已复制原始数据', description: '完整 HTTP EventEnvelope 已写入剪贴板。' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入，请在原始数据页手动复制。' });
    }
  }

  if (!event || !summary) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="h-[86vh] w-full max-w-[1800px]"
      contentClassName="p-0"
      title={(
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold text-zinc-950">HTTP Inspector</h2>
          <SummaryBadges summary={summary} />
        </div>
      )}
      description={(
        <div className="grid min-w-0 gap-1">
          <div className="min-w-0 truncate text-xs font-medium text-zinc-700">
            {[summary.method, summary.url].filter(Boolean).join(' ') || 'HTTP 请求'}
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-500">
            <span>{summary.statusLabel}</span>
            <span>{formatDuration(event.durationMs)}</span>
            {summary.responseSizeLabel ? <span>response {summary.responseSizeLabel}</span> : null}
            {summary.requestSizeLabel ? <span>request {summary.requestSizeLabel}</span> : null}
            {summary.route ? <span>route {summary.route}</span> : null}
            {summary.requestId ? <span>requestId {summary.requestId}</span> : null}
          </div>
        </div>
      )}
      headerExtra={(
        <div className="flex items-center gap-1">
          <IconTooltipButton
            type="button"
            variant="ghost"
            size="icon"
            label={previous ? `上一条 ${formatTime(previous.timestamp)}` : '没有上一条'}
            icon={ChevronLeft}
            disabled={!previous}
            onClick={() => previous && onSelectEvent?.(previous)}
          />
          <span className="px-1 text-[11px] tabular-nums text-zinc-500">
            {siblings.length === 0 ? '-' : `${siblingIndex + 1}/${siblings.length}`}
          </span>
          <IconTooltipButton
            type="button"
            variant="ghost"
            size="icon"
            label={next ? `下一条 ${formatTime(next.timestamp)}` : '没有下一条'}
            icon={ChevronRight}
            disabled={!next}
            onClick={() => next && onSelectEvent?.(next)}
          />
          <IconTooltipButton type="button" variant="ghost" size="icon" label="复制原始数据" icon={Clipboard} onClick={() => void copyEventJson()} />
        </div>
      )}
    >
      <div className="h-full min-h-0 overflow-hidden p-4">
        <HttpInspectorBody event={event} summary={summary} layout="vertical" />
      </div>
    </Dialog>
  );
}

function SummaryBadges({ summary }: { summary: HttpSummary }) {
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge tone={summary.failed ? 'danger' : 'good'}>{summary.statusLabel}</Badge>
      {summary.detailDropped ? <Badge tone="warn">详情剥离</Badge> : <Badge tone="teal">详情完整</Badge>}
      {summary.bodyTruncated ? <Badge tone="warn">body truncated</Badge> : null}
      {summary.source ? <Badge tone="neutral">{summary.source}</Badge> : null}
    </div>
  );
}

function HttpHeroBlock({ event, summary, compact = false }: { event: MonitorEvent; summary: HttpSummary; compact?: boolean }) {
  return (
    <section
      className={cn(
        'rounded-md border border-blue-200 bg-blue-50 p-3',
        compact && 'border-none bg-transparent p-0',
      )}
    >
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
  );
}

function HttpInspectorBody({ event, summary, layout }: { event: MonitorEvent; summary: HttpSummary; layout: Layout }) {
  const { showToast } = useToast();
  const indicators = useMemo(() => computeTabIndicators(summary), [summary]);
  const defaultTab = useMemo(() => smartDefaultTab(summary), [summary]);

  async function copyEventJson() {
    try {
      await copyJson(event);
      showToast({ tone: 'success', title: '已复制原始数据', description: '完整 HTTP EventEnvelope 已写入剪贴板。' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入，请在原始数据页手动复制。' });
    }
  }

  if (layout === 'vertical') {
    return (
      <Tabs
        defaultValue={defaultTab}
        orientation="vertical"
        className="grid h-full min-h-0 grid-cols-[160px_minmax(0,1fr)] gap-4"
      >
        <TabsList className="flex h-fit min-h-full flex-col items-stretch gap-1 p-1">
          <VerticalIconTab value="summary" label="摘要" icon={Info} indicator={indicators.summary} />
          <VerticalIconTab value="request" label="请求" icon={Send} indicator={indicators.request} />
          <VerticalIconTab value="response" label="响应" icon={MessageSquare} indicator={indicators.response} />
          <VerticalIconTab value="context" label="上下文" icon={GitBranch} indicator={indicators.context} />
          <VerticalIconTab value="raw" label="原始数据" icon={Braces} indicator={indicators.raw} />
        </TabsList>
        <BodyTabsContent
          event={event}
          summary={summary}
          onCopyEvent={() => void copyEventJson()}
          contentClassName="min-h-0 overflow-auto pr-1"
          maxBodyHeight="46vh"
        />
      </Tabs>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
      <TabsList className="w-fit">
        <IconTab value="summary" label="摘要" icon={Info} indicator={indicators.summary} />
        <IconTab value="request" label="请求" icon={Send} indicator={indicators.request} />
        <IconTab value="response" label="响应" icon={MessageSquare} indicator={indicators.response} />
        <IconTab value="context" label="上下文" icon={GitBranch} indicator={indicators.context} />
        <IconTab value="raw" label="原始数据" icon={Braces} indicator={indicators.raw} />
      </TabsList>
      <BodyTabsContent
        event={event}
        summary={summary}
        onCopyEvent={() => void copyEventJson()}
        contentClassName="min-h-0 overflow-auto"
        maxBodyHeight="420px"
      />
    </Tabs>
  );
}

type TabIndicatorTone = 'danger' | 'warn' | 'info';

type TabKey = 'summary' | 'request' | 'response' | 'context' | 'raw';

function computeTabIndicators(summary: HttpSummary): Partial<Record<TabKey, TabIndicatorTone>> {
  const result: Partial<Record<TabKey, TabIndicatorTone>> = {};
  if (summary.failed) {
    result.summary = 'danger';
    result.response = 'danger';
  }
  if (summary.bodyTruncated) {
    result.response = result.response ?? 'warn';
  }
  if (summary.detailDropped) {
    result.summary = result.summary ?? 'warn';
  }
  if (hasSensitiveHeaders(summary.detail?.request?.headers)) {
    result.request = result.request ?? 'info';
  }
  if (hasSensitiveHeaders(summary.detail?.response?.headers)) {
    result.response = result.response ?? 'info';
  }
  return result;
}

function smartDefaultTab(summary: HttpSummary): TabKey {
  if (summary.failed) return 'response';
  const writeMethod = summary.method === 'POST' || summary.method === 'PUT' || summary.method === 'PATCH' || summary.method === 'DELETE';
  if (writeMethod && summary.hasRequestBody) return 'request';
  if (summary.hasResponseBody) return 'response';
  return 'summary';
}

function hasSensitiveHeaders(headers?: JsonObject): boolean {
  if (!headers) return false;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

function BodyTabsContent({
  event,
  summary,
  onCopyEvent,
  contentClassName,
  maxBodyHeight,
}: {
  event: MonitorEvent;
  summary: HttpSummary;
  onCopyEvent: () => void;
  contentClassName: string;
  maxBodyHeight: string;
}) {
  return (
    <>
      <TabsContent value="summary" className={contentClassName}>
        <SummaryPanel event={event} summary={summary} />
      </TabsContent>
      <TabsContent value="request" className={contentClassName}>
        <RequestPanel event={event} summary={summary} maxBodyHeight={maxBodyHeight} />
      </TabsContent>
      <TabsContent value="response" className={contentClassName}>
        <ResponsePanel summary={summary} maxBodyHeight={maxBodyHeight} />
      </TabsContent>
      <TabsContent value="context" className={contentClassName}>
        <ContextPanel event={event} />
      </TabsContent>
      <TabsContent value="raw" className="min-h-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          <div className="flex justify-end">
            <IconTooltipButton type="button" variant="secondary" size="icon" label="复制完整 JSON" icon={Clipboard} onClick={onCopyEvent} />
          </div>
          <JsonViewer value={event} collapsed={2} showControls={false} />
        </div>
      </TabsContent>
    </>
  );
}

function IconTab({ value, label, icon: Icon, indicator }: { value: string; label: string; icon: typeof Info; indicator?: TabIndicatorTone }) {
  return (
    <TabsTrigger value={value} aria-label={label} title={indicatorTitle(label, indicator)} className="h-8 gap-1.5 px-2">
      <Icon className="size-3.5" />
      <span>{label}</span>
      {indicator ? <IndicatorDot tone={indicator} /> : null}
    </TabsTrigger>
  );
}

function VerticalIconTab({ value, label, icon: Icon, indicator }: { value: string; label: string; icon: typeof Info; indicator?: TabIndicatorTone }) {
  return (
    <TabsTrigger
      value={value}
      aria-label={label}
      title={indicatorTitle(label, indicator)}
      className="h-9 w-full justify-start gap-2 px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm"
    >
      <Icon className="size-4" />
      <span className="flex-1 text-left">{label}</span>
      {indicator ? <IndicatorDot tone={indicator} /> : null}
    </TabsTrigger>
  );
}

function IndicatorDot({ tone }: { tone: TabIndicatorTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 rounded-full',
        tone === 'danger' && 'bg-red-500',
        tone === 'warn' && 'bg-amber-500',
        tone === 'info' && 'bg-blue-500',
      )}
    />
  );
}

function indicatorTitle(label: string, tone?: TabIndicatorTone): string {
  if (!tone) return label;
  if (tone === 'danger') return `${label}（存在错误）`;
  if (tone === 'warn') return `${label}（存在警告 / 截断）`;
  return `${label}（含敏感字段）`;
}

function SummaryPanel({ event, summary }: { event: MonitorEvent; summary: HttpSummary }) {
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

function RequestPanel({ event, summary, maxBodyHeight }: { event: MonitorEvent; summary: HttpSummary; maxBodyHeight: string }) {
  const requestContentType = pickContentType(summary.detail?.request?.headers);
  return (
    <div className="grid gap-3">
      <Section title="URL 与 Query">
        <Fact label="url" value={summary.url} />
        <JsonBlock title="query" value={summary.query} empty="本次请求没有 query，或 SDK 没有采集到 query 字段。" maxHeight={maxBodyHeight} />
      </Section>
      <Section title="Request Headers">
        <HeadersBlock value={summary.detail?.request?.headers} empty="本次事件没有 request headers。旧数据或接入方未开启 header 采集时会为空。" />
      </Section>
      <Section title="Request Body">
        <BodyBlock
          value={summary.detail?.request?.body}
          empty={requestBodyEmptyReason(summary)}
          maxHeight={maxBodyHeight}
          contentType={requestContentType}
        />
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

function ResponsePanel({ summary, maxBodyHeight }: { summary: HttpSummary; maxBodyHeight: string }) {
  const responseContentType = pickContentType(summary.detail?.response?.headers);
  return (
    <div className="grid gap-3">
      <Section title="Response Status">
        <Fact label="status code" value={summary.statusCode === undefined ? undefined : String(summary.statusCode)} />
        <Fact label="success" value={summary.success === undefined ? undefined : String(summary.success)} />
        <Fact label="error type" value={summary.errorType} />
      </Section>
      <Section title="Response Headers">
        <HeadersBlock value={summary.detail?.response?.headers} empty={responseEmptyReason(summary)} />
      </Section>
      <Section title="Response Body">
        <BodyBlock
          value={summary.detail?.response?.body}
          empty={responseEmptyReason(summary)}
          maxHeight={maxBodyHeight}
          contentType={responseContentType}
          truncated={summary.bodyTruncated}
          originalLength={summary.bodyOriginalLength}
          sha256={summary.bodySha256}
        />
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

function JsonBlock({ title, value, empty, maxHeight }: { title: string; value: unknown; empty: string; maxHeight: string }) {
  if (!hasContent(value)) return <EmptyLine text={empty} />;
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
        <FileText className="size-3.5" />
        {title}
      </div>
      <BodyBlock value={value} empty={empty} maxHeight={maxHeight} />
    </div>
  );
}

function BodyBlock({
  value,
  empty,
  maxHeight,
  contentType,
  truncated,
  originalLength,
  sha256,
}: {
  value: unknown;
  empty: string;
  maxHeight: string;
  contentType?: string;
  truncated?: boolean;
  originalLength?: number;
  sha256?: string;
}) {
  const [mode, setMode] = useState<'formatted' | 'raw'>('formatted');
  if (!hasContent(value)) return <EmptyLine text={empty} />;
  const body = parseBody(value, { truncated });
  const canFormat = body.jsonValue !== undefined || body.formattedText !== undefined;
  const showFormatted = canFormat && mode === 'formatted';
  const wrapperStyle = { maxHeight, minHeight: '120px' } as const;
  const hasBanner = truncated || originalLength !== undefined || sha256 || contentType;

  return (
    <div className="grid gap-2">
      {hasBanner ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1.5 text-[11px]',
            truncated ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-zinc-200 bg-zinc-50 text-zinc-600',
          )}
        >
          {truncated ? <span className="font-medium">已截断</span> : null}
          {body.repaired && truncated ? (
            <span className="rounded-full bg-amber-200/70 px-2 py-[1px] text-amber-900">已尝试补齐结构</span>
          ) : null}
          {!body.jsonValue && truncated ? (
            <span className="rounded-full bg-zinc-200 px-2 py-[1px] text-zinc-700">无法解析为 JSON</span>
          ) : null}
          {contentType ? (
            <Chip label="content-type" value={contentType} />
          ) : null}
          {originalLength !== undefined ? (
            <Chip label="原始长度" value={byteLabel(originalLength)} />
          ) : null}
          {sha256 ? (
            <Chip label="sha256" value={shortHash(sha256)} title={sha256} />
          ) : null}
        </div>
      ) : null}
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
        <div className="overflow-hidden" style={wrapperStyle}>
          <JsonViewer value={body.jsonValue} collapsed={2} showControls={false} />
        </div>
      ) : showFormatted ? (
        <pre
          className="whitespace-pre-wrap break-words overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100"
          style={wrapperStyle}
        >
          {body.formattedText}
        </pre>
      ) : (
        <pre
          className="whitespace-pre-wrap break-words overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100"
          style={wrapperStyle}
        >
          {body.raw}
        </pre>
      )}
    </div>
  );
}

function Chip({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-[1px] text-zinc-700">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-700">{value}</span>
    </span>
  );
}

function shortHash(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function pickContentType(headers?: JsonObject): string | undefined {
  if (!headers) return undefined;
  for (const [key, raw] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      if (typeof raw === 'string') return raw;
      if (Array.isArray(raw)) {
        const first = raw.find((item) => typeof item === 'string');
        if (typeof first === 'string') return first;
      }
    }
  }
  return undefined;
}

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-access-token',
]);

function HeadersBlock({ value, empty }: { value?: JsonObject; empty: string }) {
  const entries = useMemo(
    () => Object.entries(value ?? {}).filter(([, item]) => item !== undefined),
    [value],
  );
  const [filter, setFilter] = useState('');
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  if (entries.length === 0) {
    return <EmptyLine text={empty} />;
  }

  const normalizedFilter = filter.trim().toLowerCase();
  const filtered = normalizedFilter
    ? entries.filter(([key, item]) =>
        key.toLowerCase().includes(normalizedFilter) ||
        formatHeaderValue(item).toLowerCase().includes(normalizedFilter),
      )
    : entries;

  const sensitiveCount = entries.filter(([key]) => SENSITIVE_HEADER_KEYS.has(key.toLowerCase())).length;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="筛选 header 名或值"
            className="h-7 pl-7 text-xs"
          />
        </label>
        <span className="text-[11px] text-zinc-500 tabular-nums">
          {filtered.length}/{entries.length}
        </span>
        {sensitiveCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => setRevealAll((v) => !v)}
            title={revealAll ? '重新遮蔽敏感 header' : '展示敏感 header 原文'}
          >
            {revealAll ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            <span>{revealAll ? '隐藏敏感' : `查看敏感 ${sensitiveCount}`}</span>
          </Button>
        ) : null}
      </div>
      <div className="max-h-[360px] overflow-auto rounded-md border border-zinc-200">
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-center text-[11px] text-zinc-500">没有匹配的 header。</div>
        ) : (
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] text-zinc-500">
              <tr>
                <th className="w-[36%] border-b border-zinc-200 px-2 py-1.5 font-medium">Header</th>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(([key, item]) => {
                const lower = key.toLowerCase();
                const sensitive = SENSITIVE_HEADER_KEYS.has(lower);
                const itemRevealed = sensitive ? (revealAll || revealed[key]) : true;
                return (
                  <HeaderRow
                    key={key}
                    name={key}
                    value={item}
                    sensitive={sensitive}
                    revealed={itemRevealed}
                    onToggleReveal={() => setRevealed((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HeaderRow({
  name,
  value,
  sensitive,
  revealed,
  onToggleReveal,
}: {
  name: string;
  value: unknown;
  sensitive: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const valueText = formatHeaderValue(value);
  const decoded = useMemo(() => tryDecodeHeaderValue(valueText), [valueText]);
  const [decodeOpen, setDecodeOpen] = useState(false);
  const masked = sensitive && !revealed;
  const display = masked ? maskHeaderValue(valueText) : valueText;

  return (
    <>
      <tr className="border-b border-zinc-100 last:border-b-0 align-top">
        <td className="break-all bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-700">
          <div className="flex items-center gap-1">
            <span>{name}</span>
            {sensitive ? (
              <Badge tone="warn" className="rounded px-1 py-0 text-[10px]">敏感</Badge>
            ) : null}
          </div>
        </td>
        <td className="break-all bg-white px-2 py-1.5 font-mono text-[11px] text-zinc-800">
          <div className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 break-all">{display}</span>
            <div className="flex shrink-0 items-center gap-1">
              {sensitive ? (
                <button
                  type="button"
                  onClick={onToggleReveal}
                  className="inline-flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  title={revealed ? '隐藏' : '显示'}
                >
                  {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              ) : null}
              {decoded ? (
                <button
                  type="button"
                  onClick={() => setDecodeOpen((v) => !v)}
                  className="inline-flex h-5 items-center gap-1 rounded border border-zinc-200 px-1 text-[10px] text-zinc-600 hover:bg-zinc-100"
                  title={decodeOpen ? '收起解码' : `解码 ${decoded.kind}`}
                >
                  <Unlock className="size-3" />
                  <span>{decoded.kind}</span>
                </button>
              ) : null}
            </div>
          </div>
        </td>
      </tr>
      {decoded && decodeOpen ? (
        <tr className="border-b border-zinc-100 align-top">
          <td colSpan={2} className="bg-zinc-50 px-2 py-1.5">
            <DecodedHeaderView decoded={decoded} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DecodedHeaderView({ decoded }: { decoded: DecodedHeader }) {
  if (decoded.kind === 'JWT') {
    return (
      <div className="grid gap-2 text-[11px] text-zinc-700">
        <div>
          <div className="text-zinc-500">header</div>
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <JsonViewer value={decoded.header} collapsed={1} showControls={false} />
          </div>
        </div>
        <div>
          <div className="text-zinc-500">payload</div>
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <JsonViewer value={decoded.payload} collapsed={1} showControls={false} />
          </div>
        </div>
        <div className="font-mono text-[10px] text-zinc-500">
          签名：{decoded.signature || '<空>'}（前端不验签，仅展示原文。）
        </div>
      </div>
    );
  }
  // base64
  return (
    <div className="grid gap-1 text-[11px] text-zinc-700">
      <div className="text-zinc-500">decoded text</div>
      <pre className="max-h-[180px] overflow-auto rounded-md border border-zinc-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-zinc-800">
        {decoded.text}
      </pre>
    </div>
  );
}

type DecodedHeader =
  | { kind: 'JWT'; header: unknown; payload: unknown; signature: string }
  | { kind: 'Base64'; text: string };

function tryDecodeHeaderValue(value: string): DecodedHeader | undefined {
  const trimmed = value.replace(/^Bearer\s+/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    try {
      const header = JSON.parse(decodeBase64Url(parts[0]));
      const payload = JSON.parse(decodeBase64Url(parts[1]));
      return { kind: 'JWT', header, payload, signature: parts[2] };
    } catch {
      // not a JWT, fall through to base64 detection
    }
  }
  if (trimmed.length >= 8 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    try {
      const text = decodeBase64Url(trimmed);
      if (/^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]+$/.test(text) && text !== trimmed) {
        return { kind: 'Base64', text };
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

function decodeBase64Url(value: string): string {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) normalized += '=';
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(normalized);
    try {
      return decodeURIComponent(
        Array.from(binary)
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      );
    } catch {
      return binary;
    }
  }
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function maskHeaderValue(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function formatHeaderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => formatHeaderValue(item)).join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-500">
      {text}
    </div>
  );
}

type HttpSummary = ReturnType<typeof httpSummary>;

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

function requestBodyEmptyReason(summary: HttpSummary): string {
  if (summary.detailDropped) return 'HTTP 详情被 SDK 降级剥离，raw envelope 中 payload["http.detail_dropped"] = true。';
  if (summary.method === 'GET' || summary.method === 'HEAD') return `${summary.method} 请求通常没有 request body。`;
  return '本次事件没有 request body，可能为空 body、旧数据，或接入方未开启 body 采集。';
}

function responseEmptyReason(summary: HttpSummary): string {
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

function parseBody(
  value: unknown,
  options: { truncated?: boolean } = {},
): { raw: string; jsonValue?: unknown; formattedText?: string; repaired?: boolean } {
  if (typeof value !== 'string') {
    return { raw: JSON.stringify(value, null, 2), jsonValue: value };
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { raw: value, jsonValue: JSON.parse(trimmed) };
    } catch {
      const repaired = repairTruncatedJson(trimmed);
      if (repaired !== undefined) {
        try {
          return { raw: value, jsonValue: JSON.parse(repaired), repaired: true };
        } catch {
          // fall through to loose-format text view
        }
      }
      return {
        raw: value,
        formattedText: formatLooseJson(trimmed),
        repaired: options.truncated ? false : undefined,
      };
    }
  }
  return { raw: value };
}

/**
 * Best-effort 修复被截断的 JSON：
 * - 跳过字符串 / 转义内的字符
 * - 记录 {/[ 栈
 * - 末尾如果在字符串内部，先补一个 "
 * - 末尾如果存在悬挂的 ":"、","、键名等，截断到最近的可关闭点
 * - 然后按栈顺序补齐 } / ]
 * 不保证语义正确，仅尽力让 JSON.parse 不抛错。
 */
function repairTruncatedJson(input: string): string | undefined {
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escaping = false;
  let lastSafe = 0;
  let expectValue = false;
  let inKey = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
        if (inKey) {
          inKey = false;
        } else if (expectValue) {
          expectValue = false;
          lastSafe = i + 1;
        }
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      const top = stack[stack.length - 1];
      if (top === '{' && !expectValue) {
        inKey = true;
      }
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      expectValue = ch === '[';
      continue;
    }
    if (ch === '}' || ch === ']') {
      stack.pop();
      expectValue = false;
      lastSafe = i + 1;
      continue;
    }
    if (ch === ':') {
      expectValue = true;
      continue;
    }
    if (ch === ',') {
      expectValue = stack[stack.length - 1] === '[';
      lastSafe = i;
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (!inString && (expectValue || stack[stack.length - 1] === '[')) {
      // primitive value (number / true / false / null) — when terminated by , or ] / } it will be safe
      // mark progress conservatively
      if (i + 1 === input.length) {
        // primitive may be partial (e.g. "12" -> ok, "tru" -> bad). We won't include the partial.
        break;
      }
    }
  }

  let candidate = input;
  if (inString) {
    candidate += '"';
    if (inKey) {
      // dangling key without value, drop trailing partial entry
      candidate = input.slice(0, lastSafe);
    }
  } else {
    candidate = input.slice(0, lastSafe || input.length);
  }

  // strip trailing comma / colon / partial key
  candidate = candidate.replace(/[,:\s]+$/u, '');

  // close remaining stack
  for (let i = stack.length - 1; i >= 0; i--) {
    candidate += stack[i] === '{' ? '}' : ']';
  }

  if (candidate === input) return undefined;
  return candidate;
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
