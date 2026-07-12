import { Filter, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HttpSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { IdCombobox } from '../../components/ui/id-combobox';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';

const HTTP_KEYS: Array<keyof HttpSearch> = ['url', 'method', 'result', 'requestId', 'statusCode', 'businessCode', 'host', 'slowOnly'];

export function HttpFilterBar({ search, total, slowThresholdMs, fullUrl, onFullUrlChange, onPatch, onResetHttp, onClearAll }: {
  search: HttpSearch;
  total: number;
  slowThresholdMs?: number;
  fullUrl: boolean;
  onFullUrlChange: (value: boolean) => void;
  onPatch: (patch: Partial<HttpSearch>, resetPage?: boolean) => void;
  onResetHttp: () => void;
  onClearAll: () => void;
}) {
  const [url, setUrl] = useState(search.url ?? '');
  const [requestQuery, setRequestQuery] = useState(search.requestId ?? '');
  const [moreOpen, setMoreOpen] = useState(false);
  const debouncedUrl = useDebouncedValue(url, 300);
  const debouncedRequest = useDebouncedValue(requestQuery, 250);
  const suggestions = useDimensionsQuery({ appKey: list(search.appKey), environment: list(search.environment), appVersion: list(search.appVersion), from: search.from, to: search.to, userId: search.userId, sessionId: search.sessionId, route: list(search.route) }, debouncedRequest);
  useEffect(() => setUrl(search.url ?? ''), [search.url]);
  useEffect(() => setRequestQuery(search.requestId ?? ''), [search.requestId]);
  useEffect(() => { const next = debouncedUrl.trim() || undefined; if (next !== search.url) onPatch({ url: next }, true); }, [debouncedUrl]);
  const activeMore = [search.requestId, search.statusCode, search.businessCode, search.host, search.slowOnly].filter(Boolean).length;

  return (
    <section aria-label="HTTP 筛选" className="border-b border-border-default bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input aria-label="URL 模糊筛选" value={url} onChange={(event) => { setUrl(event.target.value); if (!event.target.value) onPatch({ url: undefined }, true); }} onKeyDown={(event) => event.key === 'Enter' && onPatch({ url: url.trim() || undefined }, true)} placeholder="筛选 URL，自动查询" className="h-8 min-w-[220px] flex-1 text-xs" />
        <Select value={search.method} placeholder="全部方法" options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value }))} onChange={(value) => onPatch({ method: value }, true)} className="w-28" />
        <Select value={search.result} placeholder="全部结果" options={[{ value: 'success', label: '成功' }, { value: 'failed', label: '失败' }, { value: 'unknown', label: '未知' }]} onChange={(value) => onPatch({ result: value as HttpSearch['result'] }, true)} className="w-28" />
        <Button size="sm" variant={moreOpen || activeMore ? 'default' : 'secondary'} onClick={() => setMoreOpen((value) => !value)}><Filter />更多{activeMore ? ` ${activeMore}` : ''}</Button>
        <label className="inline-flex h-8 items-center gap-2 rounded-control border border-border-default px-2 text-xs text-text-secondary"><input type="checkbox" checked={fullUrl} onChange={(event) => onFullUrlChange(event.target.checked)} />完整 URL</label>
        <span className="text-xs tabular-nums text-text-secondary">{total} 条</span>
        <Button size="sm" variant="ghost" onClick={onResetHttp}><RotateCcw />重置 HTTP</Button>
        <Button size="sm" variant="ghost" onClick={onClearAll}><X />清除全部</Button>
      </div>
      {moreOpen ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-panel border border-border-default bg-subtle p-2">
          <label className="grid gap-0.5 text-[11px] text-text-secondary"><span>Request ID</span><IdCombobox value={search.requestId} label="Request ID" query={requestQuery} options={suggestions.data?.requestIds ?? []} loading={suggestions.isFetching} error={suggestions.isError} onQueryChange={setRequestQuery} onChange={(requestId) => onPatch({ requestId }, true)} /></label>
          <MoreText label="状态码" value={search.statusCode} onCommit={(value) => onPatch({ statusCode: numericList(value) }, true)} />
          <MoreText label="业务码" value={search.businessCode} onCommit={(value) => onPatch({ businessCode: value }, true)} />
          <MoreText label="Host" value={search.host} onCommit={(value) => onPatch({ host: value }, true)} />
          <label className="flex h-8 items-center gap-2 rounded-control border border-border-default bg-surface px-2 text-xs text-text-primary">
            <input type="checkbox" checked={search.slowOnly === true} onChange={(event) => onPatch({ slowOnly: event.target.checked || undefined }, true)} />
            慢请求{slowThresholdMs ? ` ≥ ${slowThresholdMs}ms` : ''}
          </label>
        </div>
      ) : null}
      <div className="mt-1 flex min-h-5 flex-wrap gap-1">
        {HTTP_KEYS.flatMap((key) => search[key] ? [<span key={key} className="rounded border border-border-default bg-subtle px-1.5 py-0.5 text-[11px] text-text-secondary">{key}: {String(search[key])}</span>] : [])}
      </div>
    </section>
  );
}

function MoreText({ label, value, onCommit }: { label: string; value?: string; onCommit: (value?: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const debounced = useDebouncedValue(draft, 300);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => { const next = debounced.trim() || undefined; if (next !== value) onCommit(next); }, [debounced]);
  return <label className="grid gap-0.5 text-[11px] text-text-secondary"><span>{label}</span><Input value={draft} onChange={(event) => { setDraft(event.target.value); if (!event.target.value) onCommit(undefined); }} onKeyDown={(event) => event.key === 'Enter' && onCommit(draft.trim() || undefined)} className="h-8 w-36 text-xs" /></label>;
}

function numericList(value?: string): string | undefined {
  const valid = (value ?? '').split(',').map((item) => item.trim()).filter((item) => /^\d+$/.test(item));
  return valid.length ? [...new Set(valid)].sort().join(',') : undefined;
}
function list(value?: string) { return value?.split(',').map((item) => item.trim()).filter(Boolean); }
