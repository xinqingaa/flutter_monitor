import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { DateRangePicker } from '../../components/common/date-range-picker';
import { MultiCombobox } from '../../components/common/multi-combobox';
import { MultiSelect } from '../../components/common/multi-select';
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

/** Resource / user dims shown in the global Scope bar (excludes sessionId / route). */
const GLOBAL_SCOPE_UI_KEYS = [
  'from',
  'to',
  'appKey',
  'packageName',
  'userId',
  'appVersion',
  'environment',
  'devicePlatform',
] as const;

export function ScopeFilterBar({
  search,
  dimensions,
  onPatch,
}: {
  search: ScopeSearch;
  dimensions?: DimensionSummary;
  onPatch: (patch: Partial<ScopeSearch>, resetPage?: boolean) => void;
}) {
  const [userQuery, setUserQuery] = useState('');
  const hydrated = useRef(false);
  const debouncedUser = useDebouncedValue(userQuery, 250);

  const appKey = list(search.appKey);
  const packageName = list(search.packageName);
  const userId = list(search.userId);
  const appVersion = list(search.appVersion);
  const environment = list(search.environment);
  const devicePlatform = list(search.devicePlatform);

  const dimensionScope = {
    from: search.from,
    to: search.to,
    appKey,
    packageName,
    appVersion,
    environment,
    devicePlatform,
    route: list(search.route),
  };
  const userSuggestions = useDimensionsQuery(dimensionScope, debouncedUser);

  useEffect(() => {
    persistScopeFilters(search);
  }, [search]);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (hasActiveScope(readScopeFilters(search))) return;
    const stored = loadPersistedScopeSearch();
    if (Object.keys(stored).length === 0) return;
    onPatch(stored as Partial<ScopeSearch>, true);
  }, [onPatch, search]);

  useEffect(() => {
    if (userId?.length === 1) setUserQuery(userId[0]);
    else if (!userId?.length) setUserQuery('');
  }, [search.userId]);

  function patchList(key: keyof ScopeSearch, values?: string[]) {
    onPatch({ [key]: values?.length ? values.join(',') : undefined } as Partial<ScopeSearch>, true);
  }

  const globalActive = GLOBAL_SCOPE_UI_KEYS.some((key) => {
    const value = search[key];
    return value !== undefined && value !== '';
  });

  return (
    <section aria-label="总范围筛选" className="scope-filter-bar border-b bg-background px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DateRangePicker
          from={search.from}
          to={search.to}
          onChange={(value) => onPatch(value, true)}
          className="shrink-0"
        />
        <MultiSelect
          ariaLabel="应用"
          placeholder="应用"
          values={appKey}
          options={(dimensions?.apps ?? []).map(appOption)}
          onChange={(values) => patchList('appKey', values)}
          className="w-32"
        />
        <MultiSelect
          ariaLabel="版本"
          placeholder="版本"
          values={appVersion}
          options={dimensionOptions(dimensions?.appVersions)}
          onChange={(values) => patchList('appVersion', values)}
          className="w-28"
        />
        <MultiSelect
          ariaLabel="环境"
          placeholder="环境"
          values={environment}
          options={dimensionOptions(dimensions?.environments)}
          onChange={(values) => patchList('environment', values)}
          className="w-28"
        />
        <MultiSelect
          ariaLabel="包名"
          placeholder="包名"
          values={packageName}
          options={dimensionOptions(dimensions?.packageNames)}
          onChange={(values) => patchList('packageName', values)}
          className="w-36"
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
          className="w-32"
        />
        <MultiSelect
          ariaLabel="平台"
          placeholder="平台"
          values={devicePlatform}
          options={dimensionOptions(dimensions?.devicePlatforms)}
          onChange={(values) => patchList('devicePlatform', values)}
          className="w-28"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={!globalActive}
            onClick={() => onPatch({
              from: undefined,
              to: undefined,
              appKey: undefined,
              packageName: undefined,
              userId: undefined,
              appVersion: undefined,
              environment: undefined,
              devicePlatform: undefined,
            }, true)}
          >
            <RotateCcw data-icon="inline-start" />
            重置筛选
          </Button>
        </div>
      </div>
    </section>
  );
}

function list(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}
