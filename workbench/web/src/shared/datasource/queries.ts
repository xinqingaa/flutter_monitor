import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { LocalWorkbenchDatasource } from './local-workbench-datasource';
import type { MonitorEvent, SessionFilters } from './types';

export const datasource = new LocalWorkbenchDatasource();

export const queryKeys = {
  health: ['health'] as const,
  recent: (limit: number) => ['recent', limit] as const,
  sessions: (filters: SessionFilters) => ['sessions', filters] as const,
  session: (sessionId: string | undefined) => ['session', sessionId] as const,
  trace: (traceId: string | undefined) => ['trace', traceId] as const,
  event: (eventId: string | undefined) => ['event', eventId] as const,
  performance: (filters: SessionFilters) => ['performance', filters] as const,
  search: (query: string, filters: SessionFilters) => ['search', query, filters] as const,
};

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => datasource.health(),
  });
}

export function useRecentQuery(limit = 80) {
  return useQuery({
    queryKey: queryKeys.recent(limit),
    queryFn: () => datasource.recent(limit),
  });
}

export function useSessionsQuery(filters: SessionFilters) {
  return useQuery({
    queryKey: queryKeys.sessions(filters),
    queryFn: () => datasource.listSessions(filters),
  });
}

export function useSessionQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => (sessionId ? datasource.getSession(sessionId) : Promise.resolve([])),
    enabled: Boolean(sessionId),
  });
}

export function useTraceQuery(traceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trace(traceId),
    queryFn: () => (traceId ? datasource.getTrace(traceId) : Promise.resolve([])),
    enabled: Boolean(traceId),
  });
}

export function useEventQuery(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => (eventId ? datasource.getEvent(eventId) : Promise.resolve(undefined)),
    enabled: Boolean(eventId),
  });
}

export function usePerformanceQuery(filters: SessionFilters) {
  return useQuery({
    queryKey: queryKeys.performance(filters),
    queryFn: () => datasource.performanceOverview(filters),
  });
}

export function useSearchMutation() {
  return useMutation({
    mutationFn: ({ query, filters }: { query: string; filters: SessionFilters }) =>
      datasource.searchEvents(query, filters),
  });
}

export function useLiveInvalidation(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return undefined;
    return datasource.subscribeEvents((event: MonitorEvent) => {
      queryClient.setQueryData<MonitorEvent[]>(queryKeys.recent(80), (current) => {
        const next = [event, ...(current ?? [])];
        return next.slice(0, 80);
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.health });
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      if (event.sessionId) void queryClient.invalidateQueries({ queryKey: queryKeys.session(event.sessionId) });
      if (event.traceId) void queryClient.invalidateQueries({ queryKey: queryKeys.trace(event.traceId) });
      if (event.eventId) queryClient.setQueryData(queryKeys.event(event.eventId), event);
    });
  }, [enabled, queryClient]);
}
