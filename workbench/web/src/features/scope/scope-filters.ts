import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import type { SessionFilters } from '../../shared/datasource/types';

export type ScopeFilters = Pick<
  SessionFilters,
  | 'appKey'
  | 'environment'
  | 'appVersion'
  | 'devicePlatform'
  | 'deviceModel'
  | 'deviceTier'
  | 'route'
  | 'userId'
  | 'problemType'
  | 'nativeAvailable'
  | 'nativePlatform'
>;

const SCOPE_KEYS: Array<keyof ScopeFilters> = [
  'appKey',
  'environment',
  'appVersion',
  'devicePlatform',
  'deviceModel',
  'deviceTier',
  'route',
  'userId',
  'problemType',
  'nativeAvailable',
  'nativePlatform',
];

export function useScopeFilters(): {
  filters: ScopeFilters;
  setFilters: (next: ScopeFilters) => void;
  patchFilters: (patch: Partial<ScopeFilters>) => void;
  clearFilters: () => void;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readScopeFilters(location.search), [location.search]);

  const setFilters = useCallback((next: ScopeFilters) => {
    void navigate({
      to: location.pathname,
      search: (current) => {
        const merged = { ...current };
        for (const key of SCOPE_KEYS) delete merged[key];
        for (const [key, value] of Object.entries(next)) {
          if (value !== undefined && value !== '') {
            (merged as Record<string, unknown>)[key] = value;
          }
        }
        return merged;
      },
    });
  }, [location.pathname, navigate]);

  const patchFilters = useCallback((patch: Partial<ScopeFilters>) => {
    setFilters(cleanFilters({ ...filters, ...patch }));
  }, [filters, setFilters]);

  const clearFilters = useCallback(() => setFilters({}), [setFilters]);

  return { filters, setFilters, patchFilters, clearFilters };
}

export function scopeToSessionFilters(filters: ScopeFilters): SessionFilters {
  return cleanFilters(filters);
}

function readScopeFilters(search: unknown): ScopeFilters {
  if (!isRecord(search)) return {};
  return cleanFilters({
    appKey: stringValue(search.appKey),
    environment: stringValue(search.environment),
    appVersion: stringValue(search.appVersion),
    devicePlatform: stringValue(search.devicePlatform),
    deviceModel: stringValue(search.deviceModel),
    deviceTier: stringValue(search.deviceTier),
    route: stringValue(search.route),
    userId: stringValue(search.userId),
    problemType: stringValue(search.problemType),
    nativeAvailable: booleanValue(search.nativeAvailable),
    nativePlatform: stringValue(search.nativePlatform),
  });
}

function cleanFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as T;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
