import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import type { SessionFilters } from '../../shared/datasource/types';

export interface SessionListFilters {
  sessionId?: string;
  route?: string;
  status?: string;
  problemType?: string;
}

const SESSION_FILTER_KEYS: Array<keyof SessionListFilters> = ['sessionId', 'route', 'status', 'problemType'];

export function useSessionListFilters(): {
  filters: SessionListFilters;
  patchFilters: (patch: Partial<SessionListFilters>) => void;
  clearFilters: () => void;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readSessionListFilters(location.search), [location.search]);

  const setFilters = useCallback((next: SessionListFilters) => {
    void navigate({
      to: location.pathname,
      search: (current) => {
        const merged: Record<string, unknown> = { ...current };
        for (const key of SESSION_FILTER_KEYS) delete merged[key];
        for (const [key, value] of Object.entries(cleanFilters({ ...next }))) {
          merged[key] = value;
        }
        return merged;
      },
    });
  }, [location.pathname, navigate]);

  const patchFilters = useCallback((patch: Partial<SessionListFilters>) => {
    setFilters(cleanFilters({ ...filters, ...patch }));
  }, [filters, setFilters]);

  const clearFilters = useCallback(() => setFilters({}), [setFilters]);

  return { filters, patchFilters, clearFilters };
}

export function sessionListToSessionFilters(filters: SessionListFilters): SessionFilters {
  return cleanFilters({ ...filters });
}

function readSessionListFilters(search: unknown): SessionListFilters {
  if (!isRecord(search)) return {};
  return cleanFilters({
    sessionId: stringValue(search.sessionId),
    route: stringValue(search.route),
    status: stringValue(search.status),
    problemType: stringValue(search.problemType),
  });
}

function cleanFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as T;
}

function stringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return stringValue(value[0]);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
