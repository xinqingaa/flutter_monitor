import { FilterX, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { MultiSelect } from '../../components/ui/multi-select';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import { cn } from '../../shared/formatting/cn';
import { isoToLocalInput, localInputToIso } from '../../shared/formatting/format';
import { appOption, dimensionOptions, problemLabel } from './filter-options';
import { scopeToSessionFilters, useScopeFilters, type ScopeFilters } from './scope-filters';

export function ScopeBar({ className }: { className?: string }) {
  const { filters, patchFilters, clearFilters } = useScopeFilters();
  const dimensionsQuery = useDimensionsQuery(scopeToSessionFilters(filters));
  const dimensions = dimensionsQuery.data;
  const activeCount = Object.values(filters).filter((value) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '').length;

  return (
    <section className={cn(
      'grid min-w-0 grid-cols-1 gap-2 border-b border-zinc-200 bg-white p-2 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1.25fr)_repeat(3,minmax(126px,1fr))_minmax(160px,1fr)_minmax(160px,1fr)_minmax(136px,1fr)_auto]',
      className,
    )}
    >
      <MultiSelect
        ariaLabel="应用范围"
        placeholder="全部应用"
        values={filters.appKey}
        className="w-full min-w-0"
        onChange={(appKey) => patchFilters({ appKey })}
        options={(dimensions?.apps ?? []).map(appOption)}
      />
      <MultiSelect
        ariaLabel="环境范围"
        placeholder="全部环境"
        values={filters.environment}
        className="w-full min-w-0"
        onChange={(environment) => patchFilters({ environment })}
        options={dimensionOptions(dimensions?.environments)}
      />
      <MultiSelect
        ariaLabel="版本范围"
        placeholder="全部版本"
        values={filters.appVersion}
        className="w-full min-w-0"
        onChange={(appVersion) => patchFilters({ appVersion })}
        options={dimensionOptions(dimensions?.appVersions)}
      />
      <MultiSelect
        ariaLabel="设备平台范围"
        placeholder="全部平台"
        values={filters.devicePlatform}
        className="w-full min-w-0"
        onChange={(devicePlatform) => patchFilters({ devicePlatform })}
        options={dimensionOptions(dimensions?.devicePlatforms)}
      />
      {/* route/problemType are still supported by URL/query logic, but hidden from the home scope UI for now. */}
      <DateTimeBox ariaLabel="起始时间" value={filters.from} onChange={(from) => patchFilters({ from })} />
      <DateTimeBox ariaLabel="结束时间" value={filters.to} onChange={(to) => patchFilters({ to })} />
      <div className="relative min-w-0">
        <UserRound className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          aria-label="用户 ID"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          value={filters.userId ?? ''}
          placeholder="全部用户"
          onChange={(event) => patchFilters({ userId: event.target.value || undefined })}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="justify-self-start"
        disabled={activeCount === 0}
        onClick={clearFilters}
      >
        <FilterX className="size-4" />
        清空
      </Button>
    </section>
  );
}

function DateTimeBox({ ariaLabel, value, onChange }: { ariaLabel: string; value?: string; onChange: (value?: string) => void }) {
  return (
    <label className="grid h-8 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
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

export function ScopeChips({ filters, className }: { filters: ScopeFilters; className?: string }) {
  const items = [
    filters.appKey?.length ? ['应用', filters.appKey.join(', ')] : undefined,
    filters.environment?.length ? ['环境', filters.environment.join(', ')] : undefined,
    filters.appVersion?.length ? ['版本', filters.appVersion.join(', ')] : undefined,
    filters.devicePlatform?.length ? ['平台', filters.devicePlatform.join(', ')] : undefined,
    filters.from ? ['开始', filters.from] : undefined,
    filters.to ? ['结束', filters.to] : undefined,
    filters.route ? ['页面', filters.route] : undefined,
    filters.userId ? ['用户', filters.userId] : undefined,
    filters.status ? ['状态', filters.status] : undefined,
    filters.problemType ? ['问题', problemLabel(filters.problemType)] : undefined,
  ].filter((item): item is string[] => Boolean(item));

  if (items.length === 0) return null;
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {items.map(([label, value]) => (
        <span key={`${label}:${value}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
          <span className="shrink-0 text-zinc-400">{label}</span>
          <span className="min-w-0 truncate font-medium text-zinc-800">{value}</span>
        </span>
      ))}
    </div>
  );
}
