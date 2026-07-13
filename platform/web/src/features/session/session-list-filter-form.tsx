import { FilterX, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FilterSelect } from '../../components/common/filter-select';
import { dimensionOptions, problemOptions } from '../scope/filter-options';
import type { DimensionSummary } from '../../shared/datasource/types';
import type { SessionListFilters } from './session-list-filters';

export function SessionListFilterForm({
  filters,
  dimensions,
  onChange,
  onClear,
}: {
  filters: SessionListFilters;
  dimensions?: DimensionSummary;
  onChange: (patch: Partial<SessionListFilters>) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(filters.sessionId || filters.route || filters.status || filters.problemType);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.1fr)_minmax(180px,1.1fr)_140px_140px_auto]">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          aria-label="Session ID"
          className="h-8 pl-7"
          placeholder="Session ID"
          value={filters.sessionId ?? ''}
          onChange={(event) => onChange({ sessionId: event.target.value || undefined })}
        />
      </div>
      <FilterSelect
        ariaLabel="页面"
        placeholder="全部页面"
        value={filters.route}
        onChange={(route) => onChange({ route })}
        options={dimensionOptions(dimensions?.routes)}
      />
      <FilterSelect
        ariaLabel="会话状态"
        placeholder="全部状态"
        value={filters.status}
        onChange={(status) => onChange({ status })}
        options={dimensionOptions(dimensions?.statuses)}
      />
      <FilterSelect
        ariaLabel="问题类型"
        placeholder="全部问题"
        value={filters.problemType}
        onChange={(problemType) => onChange({ problemType })}
        options={problemOptions()}
      />
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={!hasFilters} onClick={onClear}>
        <FilterX className="size-4" />
        清空
      </Button>
    </div>
  );
}
