import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { MultiSelect } from '../../components/common/multi-select';
import type { DimensionSummary } from '../../shared/datasource/types';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { dimensionOptions, problemLabel, problemOptions } from '../scope/filter-options';
import type { SessionListFilters } from './session-list-filters';

const SESSION_KEYS: Array<keyof SessionListFilters> = ['sessionId', 'route', 'status', 'problemType'];

export function SessionFilterBar({
  filters,
  dimensions,
  onChange,
  onReset,
}: {
  filters: SessionListFilters;
  dimensions?: DimensionSummary;
  onChange: (patch: Partial<SessionListFilters>, resetPage?: boolean) => void;
  onReset: () => void;
}) {
  const [sessionId, setSessionId] = useState(filters.sessionId ?? '');
  const debouncedSessionId = useDebouncedValue(sessionId, 300);

  useEffect(() => setSessionId(filters.sessionId ?? ''), [filters.sessionId]);
  useEffect(() => {
    const next = debouncedSessionId.trim() || undefined;
    if (next !== filters.sessionId) onChange({ sessionId: next }, true);
  }, [debouncedSessionId]);

  function patchList(key: 'route' | 'status' | 'problemType', values?: string[]) {
    onChange({ [key]: values?.length ? values.join(',') : undefined }, true);
  }

  const active = SESSION_KEYS.some((key) => filters[key] !== undefined);

  return (
    <section aria-label="Session 筛选" className="border-b px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          aria-label="Session ID 模糊筛选"
          value={sessionId}
          onChange={(event) => {
            setSessionId(event.target.value);
            if (!event.target.value) onChange({ sessionId: undefined }, true);
          }}
          onKeyDown={(event) => event.key === 'Enter' && onChange({ sessionId: sessionId.trim() || undefined }, true)}
          placeholder="筛选 Session ID"
          className="w-56 max-w-full shrink-0"
        />
        <MultiSelect
          ariaLabel="页面"
          placeholder="页面"
          values={list(filters.route)}
          options={dimensionOptions(dimensions?.routes)}
          onChange={(values) => patchList('route', values)}
          className="w-44"
        />
        <MultiSelect
          ariaLabel="状态"
          placeholder="状态"
          values={list(filters.status)}
          options={dimensionOptions(dimensions?.statuses)}
          onChange={(values) => patchList('status', values)}
          className="w-36"
        />
        <MultiSelect
          ariaLabel="问题类型"
          placeholder="问题类型"
          values={list(filters.problemType)}
          options={problemOptions()}
          onChange={(values) => patchList('problemType', values)}
          className="w-40"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!active}>
            <RotateCcw data-icon="inline-start" />
            重置筛选
          </Button>
        </div>
      </div>
      {active ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {SESSION_KEYS.flatMap((key) => (
            filters[key] !== undefined
              ? [<Badge key={key} variant="secondary">{sessionFilterLabel(key, filters[key]!)}</Badge>]
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

function sessionFilterLabel(key: keyof SessionListFilters, value: string): string {
  if (key === 'sessionId') return `Session: ${value}`;
  if (key === 'route') return `页面: ${value}`;
  if (key === 'status') return `状态: ${value}`;
  if (key === 'problemType') return `问题: ${value.split(',').map(problemLabel).join('、')}`;
  return `${key}: ${value}`;
}
