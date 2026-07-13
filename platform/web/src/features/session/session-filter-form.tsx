import { FilterX } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FilterSelect } from '../../components/common/filter-select';
import { dimensionOptions, problemOptions } from '../../features/scope/filter-options';
import { isoToLocalInput, localInputToIso } from '../../shared/formatting/format';
import type { DimensionSummary, SessionFilters } from '../../shared/datasource/types';

export function SessionFilterForm({
  filters,
  dimensions,
  onChange,
  onClear,
}: {
  filters: SessionFilters;
  dimensions?: DimensionSummary;
  onChange: (filters: SessionFilters) => void;
  onClear: () => void;
}) {
  const hasFilters = Boolean(filters.from || filters.to || stringFilterValue(filters.status) || stringFilterValue(filters.problemType));

  function patch(patchFilters: SessionFilters) {
    onChange(cleanFilters({ ...filters, ...patchFilters }));
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_auto]">
      <DateTimeBox ariaLabel="起始时间" value={filters.from} onChange={(from) => patch({ from })} />
      <DateTimeBox ariaLabel="结束时间" value={filters.to} onChange={(to) => patch({ to })} />
      <FilterSelect
        ariaLabel="会话状态"
        placeholder="全部状态"
        value={stringFilterValue(filters.status)}
        onChange={(status) => patch({ status })}
        options={dimensionOptions(dimensions?.statuses)}
      />
      <FilterSelect
        ariaLabel="问题类型"
        placeholder="全部问题"
        value={stringFilterValue(filters.problemType)}
        onChange={(problemType) => patch({ problemType })}
        options={problemOptions()}
      />
      <div className="flex justify-start">
        <Button type="button" variant="ghost" disabled={!hasFilters} onClick={onClear}>
          <FilterX className="size-4" />
          清空
        </Button>
      </div>
    </div>
  );
}

function DateTimeBox({ ariaLabel, value, onChange }: { ariaLabel: string; value?: string; onChange: (value?: string) => void }) {
  return (
    <label className="grid cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
      <input
        type="datetime-local"
        aria-label={ariaLabel}
        className="min-w-0 cursor-pointer bg-transparent text-sm text-zinc-900 outline-none"
        value={isoToLocalInput(value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => onChange(localInputToIso(event.target.value))}
      />
    </label>
  );
}

function cleanFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    }),
  ) as T;
}

function stringFilterValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
