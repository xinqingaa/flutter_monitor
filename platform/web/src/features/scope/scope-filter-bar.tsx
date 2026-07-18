import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { DateRangePicker } from '../../components/common/date-range-picker';
import { MultiCombobox } from '../../components/common/multi-combobox';
import { MultiSelect } from '../../components/common/multi-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { useIsMobile } from '../../shared/hooks/use-mobile';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { useDimensionsQuery } from '../../shared/datasource/queries';
import type { DimensionSummary } from '../../shared/datasource/types';
import { appOption, dimensionOptions } from './filter-options';
import { hasActiveScope, loadPersistedScopeSearch, persistScopeFilters, readScopeFilters } from './scope-filters';

export type ScopeSearch = {
  from?: string;
  to?: string;
  appKey?: string;
  packageName?: string;
  userId?: string;
  sessionId?: string;
  appVersion?: string;
  environment?: string;
  devicePlatform?: string;
  route?: string;
};

export function ScopeFilterBar({
  search,
  dimensions,
  onPatch,
  showTime = true,
}: {
  search: ScopeSearch;
  dimensions?: DimensionSummary;
  onPatch: (patch: Partial<ScopeSearch>, resetPage?: boolean) => void;
  showTime?: boolean;
}) {
  const mobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [sessionQuery, setSessionQuery] = useState('');
  const hydrated = useRef(false);
  const debouncedUser = useDebouncedValue(userQuery, 250);
  const debouncedSession = useDebouncedValue(sessionQuery, 250);

  const appKey = list(search.appKey);
  const packageName = list(search.packageName);
  const userId = list(search.userId);
  const sessionId = list(search.sessionId);
  const appVersion = list(search.appVersion);
  const environment = list(search.environment);
  const devicePlatform = list(search.devicePlatform);
  const route = list(search.route);

  const scope = {
    from: showTime ? search.from : undefined,
    to: showTime ? search.to : undefined,
    appKey,
    packageName,
    appVersion,
    environment,
    devicePlatform,
    route,
  };
  const userSuggestions = useDimensionsQuery(scope, debouncedUser);
  const sessionSuggestions = useDimensionsQuery(scope, debouncedSession);

  useEffect(() => {
    persistScopeFilters(showTime ? search : { ...search, from: undefined, to: undefined });
  }, [search, showTime]);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (hasActiveScope(readScopeFilters(search))) return;
    const stored = loadPersistedScopeSearch();
    if (!showTime) {
      delete stored.from;
      delete stored.to;
    }
    if (Object.keys(stored).length === 0) return;
    onPatch(stored as Partial<ScopeSearch>, true);
  }, [onPatch, search, showTime]);

  useEffect(() => {
    if (userId?.length === 1) setUserQuery(userId[0]);
    else if (!userId?.length) setUserQuery('');
  }, [search.userId]);
  useEffect(() => {
    if (sessionId?.length === 1) setSessionQuery(sessionId[0]);
    else if (!sessionId?.length) setSessionQuery('');
  }, [search.sessionId]);

  function patchList(key: keyof ScopeSearch, values?: string[]) {
    onPatch({ [key]: values?.length ? values.join(',') : undefined } as Partial<ScopeSearch>, true);
  }

  const primaryControls = (
    <>
      <MultiSelect
        ariaLabel="应用"
        placeholder="全部应用"
        values={appKey}
        options={(dimensions?.apps ?? []).map(appOption)}
        onChange={(values) => patchList('appKey', values)}
        className="w-full sm:w-40"
      />
      <MultiSelect
        ariaLabel="版本"
        placeholder="全部版本"
        values={appVersion}
        options={dimensionOptions(dimensions?.appVersions)}
        onChange={(values) => patchList('appVersion', values)}
        className="w-full sm:w-36"
      />
      <MultiSelect
        ariaLabel="环境"
        placeholder="全部环境"
        values={environment}
        options={dimensionOptions(dimensions?.environments)}
        onChange={(values) => patchList('environment', values)}
        className="w-full sm:w-32"
      />
    </>
  );

  const secondaryControls = (
    <>
      <MultiSelect
        ariaLabel="包名"
        placeholder="全部包名"
        values={packageName}
        options={dimensionOptions(dimensions?.packageNames)}
        onChange={(values) => patchList('packageName', values)}
        className="w-full"
      />
      <MultiCombobox
        label="用户 ID"
        values={userId}
        query={userQuery}
        options={userSuggestions.data?.userIds ?? []}
        loading={userSuggestions.isFetching}
        error={userSuggestions.isError}
        onQueryChange={setUserQuery}
        onChange={(values) => patchList('userId', values)}
        className="w-full"
      />
      <MultiCombobox
        label="Session ID"
        values={sessionId}
        query={sessionQuery}
        options={sessionSuggestions.data?.sessionIds ?? []}
        loading={sessionSuggestions.isFetching}
        error={sessionSuggestions.isError}
        onQueryChange={setSessionQuery}
        onChange={(values) => patchList('sessionId', values)}
        className="w-full"
      />
      <MultiSelect
        ariaLabel="平台"
        placeholder="全部平台"
        values={devicePlatform}
        options={dimensionOptions(dimensions?.devicePlatforms)}
        onChange={(values) => patchList('devicePlatform', values)}
        className="w-full"
      />
      <MultiSelect
        ariaLabel="路由"
        placeholder="全部路由"
        values={route}
        options={dimensionOptions(dimensions?.routes)}
        onChange={(values) => patchList('route', values)}
        className="w-full"
      />
    </>
  );
  const secondaryCount = [packageName, userId, sessionId, devicePlatform, route]
    .filter((values) => values?.length).length;

  return (
    <section aria-label="范围筛选" className="flex min-w-0 items-center gap-2 border-b bg-background px-3 py-2">
      {showTime ? (
        <DateRangePicker
          from={search.from}
          to={search.to}
          onChange={(value) => onPatch(value, true)}
          className="shrink-0"
        />
      ) : null}
      {mobile ? (
        <Button variant="outline" className="ml-auto" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal data-icon="inline-start" />
          筛选{secondaryCount ? ` (${secondaryCount})` : ''}
        </Button>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {primaryControls}
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal data-icon="inline-start" />
            更多筛选{secondaryCount ? ` (${secondaryCount})` : ''}
          </Button>
        </>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
          <SheetTitle>{showTime ? '总范围筛选' : '维度筛选'}</SheetTitle>
          <SheetDescription>{showTime ? '总筛选会持续作用于列表与详情。' : '概览按应用、版本、环境与链路维度观察。'}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            {mobile ? primaryControls : null}
            {secondaryControls}
            <Button
              variant="ghost"
              onClick={() => {
                onPatch({
                  appKey: undefined,
                  packageName: undefined,
                  userId: undefined,
                  sessionId: undefined,
                  appVersion: undefined,
                  environment: undefined,
                  devicePlatform: undefined,
                  route: undefined,
                }, true);
                setSheetOpen(false);
              }}
            >
              <X data-icon="inline-start" />
              清除维度筛选
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function list(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}
