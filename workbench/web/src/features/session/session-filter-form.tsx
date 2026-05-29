import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import type { SessionFilters } from '../../shared/datasource/types';

export function SessionFilterForm({
  filters,
  onChange,
  onSubmit,
}: {
  filters: SessionFilters;
  onChange: (filters: SessionFilters) => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <Input placeholder="userId" value={filters.userId ?? ''} onChange={(e) => onChange({ ...filters, userId: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="environment" value={filters.environment ?? ''} onChange={(e) => onChange({ ...filters, environment: e.target.value })} />
        <Input placeholder="appVersion" value={filters.appVersion ?? ''} onChange={(e) => onChange({ ...filters, appVersion: e.target.value })} />
      </div>
      <Input placeholder="route" value={filters.route ?? ''} onChange={(e) => onChange({ ...filters, route: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="status" value={filters.status ?? ''} onChange={(e) => onChange({ ...filters, status: e.target.value })} />
        <Input placeholder="limit" value={filters.limit ?? ''} onChange={(e) => onChange({ ...filters, limit: Number.parseInt(e.target.value, 10) || undefined })} />
      </div>
      <Button type="submit" variant="default">
        <Search className="size-4" />
        查询
      </Button>
    </form>
  );
}
