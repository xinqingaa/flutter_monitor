import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import type { SessionFilters } from '../../shared/datasource/types';

export interface ScopeFilters {
  appKey?: string[];
  environment?: string[];
  appVersion?: string[];
  devicePlatform?: string[];
  from?: string;
  to?: string;
  userId?: string;
  route?: string;
  status?: string;
  problemType?: string;
}

const SCOPE_KEYS: Array<keyof ScopeFilters> = [
  'appKey',
  'environment',
  'appVersion',
  'devicePlatform',
  'from',
  'to',
  'route',
  'userId',
  'status',
  'problemType',
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
          if (Array.isArray(value) && value.length > 0) (merged as Record<string, unknown>)[key] = value.join(',');
          else if (value !== undefined && value !== '') (merged as Record<string, unknown>)[key] = value;
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
  return cleanFilters({ ...filters });
}

function readScopeFilters(search: unknown): ScopeFilters {
  if (!isRecord(search)) return {};
  return cleanFilters({
    appKey: stringListValue(search.appKey),
    environment: stringListValue(search.environment),
    appVersion: stringListValue(search.appVersion),
    devicePlatform: stringListValue(search.devicePlatform),
    from: stringValue(search.from),
    to: stringValue(search.to),
    route: stringValue(search.route),
    userId: stringValue(search.userId),
    status: stringValue(search.status),
    problemType: stringValue(search.problemType),
  });
}

function cleanFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    }),
  ) as T;
}

function stringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return stringValue(value[0]);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringListValue(value: unknown): string[] | undefined {
  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => stringParts(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? [...new Set(values)].sort((a, b) => a.localeCompare(b)) : undefined;
}

function stringParts(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return value.split(',');
    }
  }
  return value.split(',');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
