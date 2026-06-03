import { FilterX, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { MultiSelect } from '../../components/ui/multi-select';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import { cn } from '../../shared/formatting/cn';
import { isoToLocalInput, localInputToIso } from '../../shared/formatting/format';
import { appOption, dimensionOptions } from './filter-options';
import { hasActiveScope, scopeToSessionFilters, useScopeFilters, type ScopeFilters } from './scope-filters';

export function ScopeBar({ className }: { className?: string }) {
  const { filters, patchFilters, clearFilters } = useScopeFilters();
  const dimensionsQuery = useDimensionsQuery(scopeToSessionFilters(filters));
  const dimensions = dimensionsQuery.data;
  const active = hasActiveScope(filters);

  return (
    <section className={cn('border-b border-zinc-200 bg-white p-2', className)}>
      <ScopeBarFields
        active={active}
        filters={filters}
        dimensions={dimensions}
        patchFilters={patchFilters}
        clearFilters={clearFilters}
        variant="bar"
      />
    </section>
  );
}

export function ScopeBarPanel({
  className,
  onInteractStart,
  onInteractEnd,
}: {
  className?: string;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}) {
  const { filters, patchFilters, clearFilters } = useScopeFilters();
  const dimensionsQuery = useDimensionsQuery(scopeToSessionFilters(filters));
  const dimensions = dimensionsQuery.data;
  return (
    <div className={cn('rounded-md border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/10', className)}>
      <ScopeBarFields
        active={hasActiveScope(filters)}
        filters={filters}
        dimensions={dimensions}
        patchFilters={patchFilters}
        clearFilters={clearFilters}
        variant="panel"
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
    </div>
  );
}

export function ScopeSummaryBadge({ className }: { className?: string }) {
  const { filters } = useScopeFilters();
  const count = scopeItemCount(filters);
  if (count === 0) return null;
  return <Badge tone="teal" className={cn('rounded-md px-1.5 py-0', className)}>{count}</Badge>;
}

function ScopeBarFields({
  active,
  filters,
  dimensions,
  patchFilters,
  clearFilters,
  variant = 'bar',
  onInteractStart,
  onInteractEnd,
}: {
  active: boolean;
  filters: ScopeFilters;
  dimensions: ReturnType<typeof useDimensionsQuery>['data'];
  patchFilters: (patch: Partial<ScopeFilters>) => void;
  clearFilters: () => void;
  variant?: 'bar' | 'panel';
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}) {
  const [openSelect, setOpenSelect] = useState<string>();
  const fieldGrid = (
    <div className={cn(
      'grid min-w-0 gap-2',
      variant === 'panel'
        ? 'min-w-[1240px] grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(150px,1fr))_minmax(180px,1fr)_minmax(180px,1fr)_minmax(150px,1fr)_88px]'
        : 'grid-cols-[minmax(190px,1.25fr)_repeat(3,minmax(126px,1fr))_minmax(160px,1fr)_minmax(160px,1fr)_minmax(136px,1fr)_88px]',
    )}>
      <MultiSelect
        ariaLabel="应用范围"
        placeholder="全部应用"
        values={filters.appKey}
        className="w-full min-w-0"
        open={openSelect === 'appKey'}
        onOpenChange={(open) => setOpenSelect(open ? 'appKey' : undefined)}
        onChange={(appKey) => patchFilters({ appKey })}
        options={(dimensions?.apps ?? []).map(appOption)}
      />
      <MultiSelect
        ariaLabel="环境范围"
        placeholder="全部环境"
        values={filters.environment}
        className="w-full min-w-0"
        open={openSelect === 'environment'}
        onOpenChange={(open) => setOpenSelect(open ? 'environment' : undefined)}
        onChange={(environment) => patchFilters({ environment })}
        options={dimensionOptions(dimensions?.environments)}
      />
      <MultiSelect
        ariaLabel="版本范围"
        placeholder="全部版本"
        values={filters.appVersion}
        className="w-full min-w-0"
        open={openSelect === 'appVersion'}
        onOpenChange={(open) => setOpenSelect(open ? 'appVersion' : undefined)}
        onChange={(appVersion) => patchFilters({ appVersion })}
        options={dimensionOptions(dimensions?.appVersions)}
      />
      <MultiSelect
        ariaLabel="设备平台范围"
        placeholder="全部平台"
        values={filters.devicePlatform}
        className="w-full min-w-0"
        open={openSelect === 'devicePlatform'}
        onOpenChange={(open) => setOpenSelect(open ? 'devicePlatform' : undefined)}
        onChange={(devicePlatform) => patchFilters({ devicePlatform })}
        options={dimensionOptions(dimensions?.devicePlatforms)}
      />
      {/* route/problemType are supported as page-local filters outside the global scope UI. */}
      <DateTimeBox
        ariaLabel="起始时间"
        value={filters.from}
        onChange={(from) => patchFilters({ from })}
        onInteractStart={() => {
          setOpenSelect(undefined);
          onInteractStart?.();
        }}
        onInteractEnd={onInteractEnd}
      />
      <DateTimeBox
        ariaLabel="结束时间"
        value={filters.to}
        onChange={(to) => patchFilters({ to })}
        onInteractStart={() => {
          setOpenSelect(undefined);
          onInteractStart?.();
        }}
        onInteractEnd={onInteractEnd}
      />
      <div className="relative min-w-0">
        <UserRound className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          aria-label="用户 ID"
          className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-7 pr-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          value={filters.userId ?? ''}
          placeholder="全部用户"
          onFocus={() => setOpenSelect(undefined)}
          onChange={(event) => patchFilters({ userId: event.target.value || undefined })}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-[88px] justify-self-start whitespace-nowrap"
        disabled={!active}
        onClick={clearFilters}
      >
        <FilterX className="size-4" />
        清空
      </Button>
    </div>
  );

  return (
    variant === 'panel' ? <div className="scope-panel-scroll overflow-x-auto overflow-y-hidden pb-2">{fieldGrid}</div> : fieldGrid
  );
}

function scopeItemCount(filters: ScopeFilters): number {
  return Object.values(filters).filter((value) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '').length;
}

function DateTimeBox({
  ariaLabel,
  value,
  onChange,
  onInteractStart,
  onInteractEnd,
}: {
  ariaLabel: string;
  value?: string;
  onChange: (value?: string) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}) {
  return (
    <label className="grid h-8 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
      <input
        type="datetime-local"
        aria-label={ariaLabel}
        className="min-w-0 cursor-pointer bg-transparent text-sm text-zinc-900 outline-none"
        value={isoToLocalInput(value)}
        onMouseDown={onInteractStart}
        onFocus={onInteractStart}
        onBlur={() => window.setTimeout(() => onInteractEnd?.(), 250)}
        onClick={(event) => {
          onInteractStart?.();
          event.currentTarget.showPicker?.();
        }}
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
    filters.userId ? ['用户', filters.userId] : undefined,
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
