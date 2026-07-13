import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { DateRangePicker } from '../../components/ui/date-range-picker';
import { IdCombobox } from '../../components/ui/id-combobox';
import { Select } from '../../components/ui/select';
import { Sheet } from '../../components/ui/sheet';
import { useIsMobile } from '../../shared/hooks/use-mobile';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import type { DimensionSummary } from '../../shared/datasource/types';

type ScopeSearch = { from?: string; to?: string; userId?: string; sessionId?: string; appVersion?: string; environment?: string; route?: string };

export function ScopeFilterBar({ search, dimensions, onPatch }: { search: ScopeSearch; dimensions?: DimensionSummary; onPatch: (patch: Partial<ScopeSearch>, resetPage?: boolean) => void }) {
  const mobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userQuery, setUserQuery] = useState(search.userId ?? '');
  const [sessionQuery, setSessionQuery] = useState(search.sessionId ?? '');
  const debouncedUser = useDebouncedValue(userQuery, 250);
  const debouncedSession = useDebouncedValue(sessionQuery, 250);
  const scope = { from: search.from, to: search.to, appVersion: search.appVersion, environment: search.environment, route: search.route };
  const userSuggestions = useDimensionsQuery(scope, debouncedUser);
  const sessionSuggestions = useDimensionsQuery(scope, debouncedSession);
  useEffect(() => setUserQuery(search.userId ?? ''), [search.userId]);
  useEffect(() => setSessionQuery(search.sessionId ?? ''), [search.sessionId]);

  const controls = <>
    <IdCombobox value={search.userId} label="用户 ID" query={userQuery} options={userSuggestions.data?.userIds ?? []} loading={userSuggestions.isFetching} error={userSuggestions.isError} onQueryChange={setUserQuery} onChange={(userId) => onPatch({ userId }, true)} className="w-full sm:w-40" />
    <IdCombobox value={search.sessionId} label="Session ID" query={sessionQuery} options={sessionSuggestions.data?.sessionIds ?? []} loading={sessionSuggestions.isFetching} error={sessionSuggestions.isError} onQueryChange={setSessionQuery} onChange={(sessionId) => onPatch({ sessionId }, true)} className="w-full sm:w-44" />
    <Select value={search.appVersion} placeholder="全部版本" options={options(dimensions?.appVersions)} onChange={(appVersion) => onPatch({ appVersion }, true)} className="w-full sm:w-36" />
    <Select value={search.environment} placeholder="全部环境" options={options(dimensions?.environments)} onChange={(environment) => onPatch({ environment }, true)} className="w-full sm:w-32" />
    <Select value={search.route} placeholder="全部路由" options={options(dimensions?.routes)} onChange={(route) => onPatch({ route }, true)} className="w-full sm:w-40" />
  </>;

  return <section aria-label="范围筛选" className="flex min-w-0 items-center gap-2 border-b border-border-default bg-surface px-3 py-2">
    <DateRangePicker from={search.from} to={search.to} onChange={(value) => onPatch(value, true)} className="shrink-0" />
    {mobile ? <><Button variant="outline" className="ml-auto" onClick={() => setSheetOpen(true)}><SlidersHorizontal />筛选</Button><Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="范围筛选" description="用户、Session、版本、环境与路由"><div className="flex flex-col gap-3 p-4">{controls}<Button variant="ghost" onClick={() => { onPatch({ userId: undefined, sessionId: undefined, appVersion: undefined, environment: undefined, route: undefined }, true); setSheetOpen(false); }}><X />清除范围筛选</Button></div></Sheet></> : <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">{controls}</div>}
  </section>;
}

function options(items?: Array<{ value: string; count: number }>) { return (items ?? []).map((item) => ({ value: item.value, label: `${item.value} (${item.count})` })); }
