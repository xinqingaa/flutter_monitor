import { Filter, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HttpSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';

const HTTP_KEYS: Array<keyof HttpSearch> = ['url', 'method', 'result', 'requestId', 'statusCode', 'businessCode', 'host', 'slowOnly'];

export function HttpFilterBar({ search, total, slowThresholdMs, onPatch, onResetHttp, onClearAll }: {
  search: HttpSearch;
  total: number;
  slowThresholdMs?: number;
  onPatch: (patch: Partial<HttpSearch>, resetPage?: boolean) => void;
  onResetHttp: () => void;
  onClearAll: () => void;
}) {
  const [url, setUrl] = useState(search.url ?? '');
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setUrl(search.url ?? ''), [search.url]);
  const activeMore = [search.requestId, search.statusCode, search.businessCode, search.host, search.slowOnly].filter(Boolean).length;

  return (
    <section aria-label="HTTP 筛选" className="border-b border-border-default bg-surface px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input aria-label="URL 模糊筛选" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onPatch({ url: url.trim() || undefined }, true)} placeholder="筛选 URL，回车应用" className="h-8 min-w-[220px] flex-1 text-xs" />
        <Select value={search.method} placeholder="全部方法" options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value }))} onChange={(value) => onPatch({ method: value }, true)} className="w-28" />
        <Select value={search.result} placeholder="全部结果" options={[{ value: 'success', label: '成功' }, { value: 'failed', label: '失败' }, { value: 'unknown', label: '未知' }]} onChange={(value) => onPatch({ result: value as HttpSearch['result'] }, true)} className="w-28" />
        <Button size="sm" variant={moreOpen || activeMore ? 'default' : 'secondary'} onClick={() => setMoreOpen((value) => !value)}><Filter />更多{activeMore ? ` ${activeMore}` : ''}</Button>
        <span className="text-xs tabular-nums text-text-secondary">{total} 条</span>
        <Button size="sm" variant="ghost" onClick={onResetHttp}><RotateCcw />重置 HTTP</Button>
        <Button size="sm" variant="ghost" onClick={onClearAll}><X />清除全部</Button>
      </div>
      {moreOpen ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-panel border border-border-default bg-subtle p-2">
          <MoreText label="Request ID" value={search.requestId} onCommit={(value) => onPatch({ requestId: value }, true)} />
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
  useEffect(() => setDraft(value ?? ''), [value]);
  return <label className="grid gap-0.5 text-[11px] text-text-secondary"><span>{label}</span><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onCommit(draft.trim() || undefined)} onBlur={() => onCommit(draft.trim() || undefined)} className="h-8 w-36 text-xs" /></label>;
}

function numericList(value?: string): string | undefined {
  const valid = (value ?? '').split(',').map((item) => item.trim()).filter((item) => /^\d+$/.test(item));
  return valid.length ? [...new Set(valid)].sort().join(',') : undefined;
}
