import { Filter, MoreHorizontal, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HttpSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { FilterSelect } from '../../components/common/filter-select';
import { IdCombobox } from '../../components/common/id-combobox';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import { resultFilterLabel, resultFilterOptions } from '../../shared/formatting/filter-labels';
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
    <section aria-label="HTTP 筛选" className="border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Input aria-label="URL 模糊筛选" value={url} onChange={(event) => { setUrl(event.target.value); if (!event.target.value) onPatch({ url: undefined }, true); }} onKeyDown={(event) => event.key === 'Enter' && onPatch({ url: url.trim() || undefined }, true)} placeholder="筛选 URL，自动查询" className="min-w-[260px] flex-1" />
        <FilterSelect value={search.method} placeholder="全部方法" options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value }))} onChange={(value) => onPatch({ method: value }, true)} className="w-28" />
        <FilterSelect value={search.result} placeholder="全部结果" options={resultFilterOptions} onChange={(value) => onPatch({ result: value as HttpSearch['result'] }, true)} className="w-28" />
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild><Button variant="outline"><Filter data-icon="inline-start" />更多筛选{activeMore ? ` (${activeMore})` : ''}</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-96">
            <FieldGroup>
              <Field><FieldLabel>Request ID</FieldLabel><IdCombobox value={search.requestId} label="Request ID" query={requestQuery} options={suggestions.data?.requestIds ?? []} loading={suggestions.isFetching} error={suggestions.isError} onQueryChange={setRequestQuery} onChange={(requestId) => onPatch({ requestId }, true)} className="w-full" /></Field>
              <div className="grid grid-cols-2 gap-3"><MoreText label="状态码" value={search.statusCode} onCommit={(value) => onPatch({ statusCode: numericList(value) }, true)} /><MoreText label="业务码" value={search.businessCode} onCommit={(value) => onPatch({ businessCode: value }, true)} /><MoreText label="Host" value={search.host} onCommit={(value) => onPatch({ host: value }, true)} /></div>
              <Field orientation="horizontal"><Checkbox id="slow-only" checked={search.slowOnly === true} onCheckedChange={(checked) => onPatch({ slowOnly: checked === true || undefined }, true)} /><FieldLabel htmlFor="slow-only">慢请求{slowThresholdMs ? ` ≥ ${slowThresholdMs}ms` : ''}</FieldLabel></Field>
            </FieldGroup>
          </PopoverContent>
        </Popover>
        <span className="whitespace-nowrap text-sm text-muted-foreground">{total} 条</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="HTTP 视图与筛选操作"><MoreHorizontal data-icon="inline-start" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuCheckboxItem checked={fullUrl} onCheckedChange={(checked) => onFullUrlChange(checked === true)}>显示完整 URL</DropdownMenuCheckboxItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem onSelect={onResetHttp}><RotateCcw />重置 HTTP 筛选</DropdownMenuItem><DropdownMenuItem onSelect={onClearAll}><X />清除全部筛选</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {HTTP_KEYS.some((key) => search[key] !== undefined) ? <div className="mt-2 flex flex-wrap gap-2">{HTTP_KEYS.flatMap((key) => search[key] ? [<Badge key={key} variant="secondary">{httpFilterLabel(key, search[key])}</Badge>] : [])}</div> : null}
    </section>
  );
}

function MoreText({ label, value, onCommit }: { label: string; value?: string; onCommit: (value?: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const debounced = useDebouncedValue(draft, 300);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => { const next = debounced.trim() || undefined; if (next !== value) onCommit(next); }, [debounced]);
  return <Field><FieldLabel>{label}</FieldLabel><Input value={draft} onChange={(event) => { setDraft(event.target.value); if (!event.target.value) onCommit(undefined); }} onKeyDown={(event) => event.key === 'Enter' && onCommit(draft.trim() || undefined)} /></Field>;
}

function numericList(value?: string): string | undefined {
  const valid = (value ?? '').split(',').map((item) => item.trim()).filter((item) => /^\d+$/.test(item));
  return valid.length ? [...new Set(valid)].sort().join(',') : undefined;
}
function list(value?: string) { return value?.split(',').map((item) => item.trim()).filter(Boolean); }

function httpFilterLabel(key: keyof HttpSearch, value: unknown): string {
  const labels: Partial<Record<keyof HttpSearch, string>> = {
    url: 'URL',
    method: '方法',
    result: '结果',
    requestId: 'Request ID',
    statusCode: '状态码',
    businessCode: '业务码',
    host: 'Host',
    slowOnly: '慢请求',
  };
  if (key === 'result') return `${labels[key]}: ${resultFilterLabel(String(value))}`;
  if (key === 'slowOnly') return '仅慢请求';
  return `${labels[key] ?? key}: ${String(value)}`;
}
