import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HttpSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { FilterSelect } from '../../components/common/filter-select';
import { MultiCombobox } from '../../components/common/multi-combobox';
import { MultiSelect } from '../../components/common/multi-select';
import type { DimensionSummary } from '../../shared/datasource/types';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import { resultFilterLabel, resultFilterOptions } from '../../shared/formatting/filter-labels';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { dimensionOptions } from '../scope/filter-options';

const HTTP_KEYS: Array<keyof HttpSearch> = [
  'url',
  'method',
  'result',
  'requestId',
  'statusCode',
  'businessCode',
  'host',
  'slowOnly',
  'slowThresholdMs',
];

const SLOW_THRESHOLD_OPTIONS = [500, 1000, 2000, 3000, 5000];
const FALLBACK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function HttpFilterBar({
  search,
  dimensions,
  slowThresholdMs,
  fullUrl,
  onFullUrlChange,
  onPatch,
  onResetHttp,
}: {
  search: HttpSearch;
  dimensions?: DimensionSummary;
  slowThresholdMs?: number;
  fullUrl: boolean;
  onFullUrlChange: (value: boolean) => void;
  onPatch: (patch: Partial<HttpSearch>, resetPage?: boolean) => void;
  onResetHttp: () => void;
}) {
  const [url, setUrl] = useState(search.url ?? '');
  const [requestQuery, setRequestQuery] = useState('');
  const debouncedUrl = useDebouncedValue(url, 300);
  const debouncedRequest = useDebouncedValue(requestQuery, 250);
  const effectiveThreshold = search.slowThresholdMs ?? slowThresholdMs ?? 1000;
  const requestIds = list(search.requestId);

  const scope = {
    appKey: list(search.appKey),
    packageName: list(search.packageName),
    environment: list(search.environment),
    appVersion: list(search.appVersion),
    from: search.from,
    to: search.to,
    userId: list(search.userId),
    sessionId: list(search.sessionId),
    route: list(search.route),
  };
  const suggestions = useDimensionsQuery(scope, debouncedRequest);

  useEffect(() => setUrl(search.url ?? ''), [search.url]);
  useEffect(() => {
    if (requestIds?.length === 1) setRequestQuery(requestIds[0]);
    else if (!requestIds?.length) setRequestQuery('');
  }, [search.requestId]);
  useEffect(() => {
    const next = debouncedUrl.trim() || undefined;
    if (next !== search.url) onPatch({ url: next }, true);
  }, [debouncedUrl]);

  function patchList(key: keyof HttpSearch, values?: string[]) {
    onPatch({ [key]: values?.length ? values.join(',') : undefined } as Partial<HttpSearch>, true);
  }

  const methodOptions = (dimensions?.httpMethods?.length
    ? dimensionOptions(dimensions.httpMethods)
    : FALLBACK_METHODS.map((value) => ({ value, label: value })));

  const slowValue = search.slowOnly
    ? String(effectiveThreshold)
    : undefined;

  return (
    <section aria-label="HTTP 筛选" className="border-b px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          aria-label="URL 模糊筛选"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (!event.target.value) onPatch({ url: undefined }, true);
          }}
          onKeyDown={(event) => event.key === 'Enter' && onPatch({ url: url.trim() || undefined }, true)}
          placeholder="筛选 URL"
          className="w-56 max-w-full shrink-0"
        />
        <MultiSelect
          ariaLabel="方法"
          placeholder="方法"
          values={list(search.method)}
          options={methodOptions}
          onChange={(values) => patchList('method', values)}
          className="w-32"
        />
        <MultiSelect
          ariaLabel="结果"
          placeholder="结果"
          values={list(search.result)}
          options={resultFilterOptions}
          onChange={(values) => patchList('result', values)}
          className="w-32"
        />
        <MultiSelect
          ariaLabel="状态码"
          placeholder="状态码"
          values={list(search.statusCode)}
          options={dimensionOptions(dimensions?.httpStatusCodes)}
          onChange={(values) => patchList('statusCode', values)}
          className="w-36"
        />
        <MultiSelect
          ariaLabel="业务码"
          placeholder="业务码"
          values={list(search.businessCode)}
          options={dimensionOptions(dimensions?.httpBusinessCodes)}
          onChange={(values) => patchList('businessCode', values)}
          className="w-40"
        />
        <MultiSelect
          ariaLabel="Host"
          placeholder="Host"
          values={list(search.host)}
          options={dimensionOptions(dimensions?.httpHosts)}
          onChange={(values) => patchList('host', values)}
          className="w-44"
        />
        <FilterSelect
          ariaLabel="慢请求阈值"
          value={slowValue}
          placeholder="慢请求"
          options={SLOW_THRESHOLD_OPTIONS.map((value) => ({
            value: String(value),
            label: `≥ ${value}ms`,
          }))}
          onChange={(value) => {
            if (!value) {
              onPatch({ slowOnly: undefined, slowThresholdMs: undefined }, true);
              return;
            }
            const parsed = Number.parseInt(value, 10);
            onPatch({
              slowOnly: true,
              slowThresholdMs: parsed === 1000 ? undefined : parsed,
            }, true);
          }}
          className="w-36"
        />
        <MultiCombobox
          label="Request ID"
          values={requestIds}
          query={requestQuery}
          options={suggestions.data?.requestIds ?? []}
          loading={suggestions.isFetching}
          error={suggestions.isError}
          onQueryChange={setRequestQuery}
          onChange={(values) => patchList('requestId', values)}
          className="w-44"
        />
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="http-full-url" className="whitespace-nowrap text-sm text-muted-foreground">
            完整 URL
          </Label>
          <Switch
            id="http-full-url"
            checked={fullUrl}
            onCheckedChange={onFullUrlChange}
            aria-label="显示完整 URL"
          />
          <Button variant="ghost" size="sm" onClick={onResetHttp}>
            <RotateCcw data-icon="inline-start" />
            重置筛选
          </Button>
        </div>
      </div>
      {HTTP_KEYS.some((key) => search[key] !== undefined) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {HTTP_KEYS.flatMap((key) => (
            search[key] !== undefined
              ? [<Badge key={key} variant="secondary">{httpFilterLabel(key, search[key], effectiveThreshold)}</Badge>]
              : []
          ))}
        </div>
      ) : null}
    </section>
  );
}

function list(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

function httpFilterLabel(key: keyof HttpSearch, value: unknown, threshold: number): string {
  const labels: Partial<Record<keyof HttpSearch, string>> = {
    url: 'URL',
    method: '方法',
    result: '结果',
    requestId: 'Request ID',
    statusCode: '状态码',
    businessCode: '业务码',
    host: 'Host',
    slowOnly: '慢请求',
    slowThresholdMs: '慢阈值',
  };
  if (key === 'result') {
    return `${labels[key]}: ${String(value).split(',').map(resultFilterLabel).join('、')}`;
  }
  if (key === 'slowOnly') return `慢请求 ≥ ${threshold}ms`;
  if (key === 'slowThresholdMs') return `慢阈值: ${value}ms`;
  return `${labels[key] ?? key}: ${String(value)}`;
}
