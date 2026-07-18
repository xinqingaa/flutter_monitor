import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SessionFilters } from '../../shared/datasource/types';

export interface ScopeFilters {
  appKey?: string[];
  packageName?: string[];
  environment?: string[];
  appVersion?: string[];
  devicePlatform?: string[];
  from?: string;
  to?: string;
  userId?: string[];
  sessionId?: string[];
  route?: string[];
}

const SCOPE_KEYS: Array<keyof ScopeFilters> = [
  'appKey',
  'packageName',
  'environment',
  'appVersion',
  'devicePlatform',
  'from',
  'to',
  'userId',
  'sessionId',
  'route',
];

const STORAGE_KEY = 'flutter-monitor.scope-filters';

const LIST_KEYS = new Set<keyof ScopeFilters>([
  'appKey',
  'packageName',
  'environment',
  'appVersion',
  'devicePlatform',
  'userId',
  'sessionId',
  'route',
]);

export function useScopeFilters(): {
  filters: ScopeFilters;
  setFilters: (next: ScopeFilters) => void;
  patchFilters: (patch: Partial<ScopeFilters>) => void;
  clearFilters: () => void;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readScopeFilters(location.search), [location.search]);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (hasActiveScope(filters)) {
      writeScopeStorage(filters);
      return;
    }
    const stored = readScopeStorage();
    if (!hasActiveScope(stored)) return;
    void navigate({
      to: location.pathname,
      search: (current) => ({ ...current, ...scopeToSearch(stored) }),
      replace: true,
    });
  }, [filters, location.pathname, navigate]);

  const setFilters = useCallback((next: ScopeFilters) => {
    const cleaned = cleanFilters({ ...next } as Record<string, unknown>) as ScopeFilters;
    writeScopeStorage(cleaned);
    void navigate({
      to: location.pathname,
      search: (current) => {
        const merged = { ...current };
        for (const key of SCOPE_KEYS) delete merged[key];
        return { ...merged, ...scopeToSearch(cleaned) };
      },
    });
  }, [location.pathname, navigate]);

  const patchFilters = useCallback((patch: Partial<ScopeFilters>) => {
    setFilters(cleanFilters({ ...filters, ...patch } as Record<string, unknown>) as ScopeFilters);
  }, [filters, setFilters]);

  const clearFilters = useCallback(() => setFilters({}), [setFilters]);

  return { filters, setFilters, patchFilters, clearFilters };
}

export function scopeToSessionFilters(filters: ScopeFilters): SessionFilters {
  return cleanFilters({ ...filters } as Record<string, unknown>) as SessionFilters;
}

export function hasActiveScope(filters: ScopeFilters): boolean {
  return Object.values(filters).some((value) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '');
}

export function pickScopeSearch(search: unknown): Record<string, unknown> {
  const filters = readScopeFilters(search);
  return scopeToSearch(filters);
}

export function pickDimensionScopeSearch(search: unknown): Record<string, unknown> {
  const next = pickScopeSearch(search);
  delete next.from;
  delete next.to;
  return next;
}

export function scopeToSearch(filters: ScopeFilters): Record<string, unknown> {
  const entries = Object.entries(filters).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.join(',') : value,
  ]);
  return cleanFilters(Object.fromEntries(entries));
}

export function readScopeFilters(search: unknown): ScopeFilters {
  if (!isRecord(search)) return {};
  return cleanFilters({
    appKey: stringListValue(search.appKey),
    packageName: stringListValue(search.packageName),
    environment: stringListValue(search.environment),
    appVersion: stringListValue(search.appVersion),
    devicePlatform: stringListValue(search.devicePlatform),
    from: stringValue(search.from),
    to: stringValue(search.to),
    userId: stringListValue(search.userId),
    sessionId: stringListValue(search.sessionId),
    route: stringListValue(search.route),
  } as Record<string, unknown>) as ScopeFilters;
}

export function persistScopeFilters(search: unknown) {
  writeScopeStorage(readScopeFilters(search));
}

export function loadPersistedScopeSearch(): Record<string, unknown> {
  return scopeToSearch(readScopeStorage());
}

function readScopeStorage(): ScopeFilters {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return readScopeFilters(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function writeScopeStorage(filters: ScopeFilters) {
  if (typeof window === 'undefined') return;
  try {
    if (!hasActiveScope(filters)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const key of SCOPE_KEYS) {
      const value = filters[key];
      if (value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      payload[key] = Array.isArray(value) ? value.join(',') : value;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
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

export { LIST_KEYS as SCOPE_LIST_KEYS, SCOPE_KEYS };
