import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { isoToLocalInput, localInputToIso } from '../../shared/formatting/format';
import type { SessionFilters } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';

export interface SessionFilterOptions {
  environments: string[];
  appVersions: string[];
  routes: string[];
  statuses: string[];
}

export function SessionFilterForm({
  filters,
  options,
  onChange,
  onSubmit,
}: {
  filters: SessionFilters;
  options: SessionFilterOptions;
  onChange: (filters: SessionFilters) => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Input placeholder="用户 ID" value={filters.userId ?? ''} onChange={(e) => onChange({ ...filters, userId: e.target.value })} />
        <DateTimeBox label="起始时间" value={filters.from} onChange={(value) => onChange({ ...filters, from: value })} />
        <DateTimeBox label="结束时间" value={filters.to} onChange={(value) => onChange({ ...filters, to: value })} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect label="环境" value={filters.environment} values={options.environments} onChange={(environment) => onChange({ ...filters, environment })} />
        <FilterSelect label="App 版本" value={filters.appVersion} values={options.appVersions} onChange={(appVersion) => onChange({ ...filters, appVersion })} />
        <FilterSelect label="页面路径" value={filters.route} values={options.routes} onChange={(route) => onChange({ ...filters, route })} />
        <FilterSelect label="状态" value={filters.status} values={options.statuses} onChange={(status) => onChange({ ...filters, status })} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="default">
          <Search className="size-4" />
          查询会话
        </Button>
      </div>
    </form>
  );
}

function DateTimeBox({ label, value, onChange }: { label: string; value?: string; onChange: (value?: string) => void }) {
  return (
    <label className="grid cursor-pointer gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
      <span>{label}</span>
      <input
        type="datetime-local"
        className="min-w-0 cursor-pointer bg-transparent text-sm text-zinc-900 outline-none"
        value={isoToLocalInput(value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onChange={(event) => onChange(localInputToIso(event.target.value))}
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value?: string;
  values: string[];
  onChange: (value?: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-zinc-500">
      {label}
      <select
        className={cn(
          'h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100',
          !value && 'text-zinc-500',
        )}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">全部</option>
        {values.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
