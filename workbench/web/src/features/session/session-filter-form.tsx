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
      <Input placeholder="用户 ID" value={filters.userId ?? ''} onChange={(e) => onChange({ ...filters, userId: e.target.value })} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Input placeholder="环境" value={filters.environment ?? ''} onChange={(e) => onChange({ ...filters, environment: e.target.value })} />
        <Input placeholder="App 版本" value={filters.appVersion ?? ''} onChange={(e) => onChange({ ...filters, appVersion: e.target.value })} />
        <Input placeholder="页面路径" value={filters.route ?? ''} onChange={(e) => onChange({ ...filters, route: e.target.value })} />
        <Input placeholder="状态" value={filters.status ?? ''} onChange={(e) => onChange({ ...filters, status: e.target.value })} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input placeholder="返回数量" value={filters.limit ?? ''} onChange={(e) => onChange({ ...filters, limit: Number.parseInt(e.target.value, 10) || undefined })} />
        <Button type="submit" variant="default">
          <Search className="size-4" />
          查询会话
        </Button>
      </div>
    </form>
  );
}
