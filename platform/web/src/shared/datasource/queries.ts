import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { LocalWorkbenchDatasource } from './local-workbench-datasource';
import type {
  BusinessCatalogQuery,
  ErrorCatalogQuery,
  EventListResult,
  HttpCatalogQuery,
  MonitorEvent,
  SessionFilters,
  SessionListResult,
  TimeseriesBucket,
} from './types';

export const datasource = new LocalWorkbenchDatasource();

export const queryKeys = {
  health: ['health'] as const,
  dimensions: (filters: SessionFilters, q?: string) => ['dimensions', filters, q] as const,
  recent: (limit: number, offset = 0, filters: SessionFilters = {}) => ['recent', limit, offset, filters] as const,
  httpCatalog: (query: HttpCatalogQuery) => ['httpCatalog', query] as const,
  businessCatalog: (query: BusinessCatalogQuery) => ['businessCatalog', query] as const,
  errorCatalog: (query: ErrorCatalogQuery) => ['errorCatalog', query] as const,
  sessions: (filters: SessionFilters) => ['sessions', filters] as const,
  session: (sessionId: string | undefined) => ['session', sessionId] as const,
  sessionConsole: (sessionId: string | undefined) => ['sessionConsole', sessionId] as const,
  trace: (traceId: string | undefined) => ['trace', traceId] as const,
  event: (eventId: string | undefined) => ['event', eventId] as const,
  performance: (filters: SessionFilters) => ['performance', filters] as const,
  timeseries: (filters: SessionFilters, bucket?: TimeseriesBucket) => ['timeseries', filters, bucket] as const,
  businessActions: (filters: SessionFilters, limit: number) => ['businessActions', filters, limit] as const,
  analyticsOverview: (filters: SessionFilters) => ['analyticsOverview', filters] as const,
  analyticsSessions: (filters: SessionFilters) => ['analyticsSessions', filters] as const,
  analyticsHttp: (query: HttpCatalogQuery) => ['analyticsHttp', query] as const,
  analyticsBusiness: (query: BusinessCatalogQuery) => ['analyticsBusiness', query] as const,
  analyticsErrors: (query: ErrorCatalogQuery) => ['analyticsErrors', query] as const,
  search: (query: string, filters: SessionFilters) => ['search', query, filters] as const,
};

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => datasource.health(),
  });
}

export function useDimensionsQuery(filters: SessionFilters, q?: string) {
  return useQuery({
    queryKey: queryKeys.dimensions(filters, q),
    queryFn: () => datasource.dimensions(filters, { q, limit: 30 }),
  });
}

export function useRecentQuery(limit = 80, offset = 0, filters: SessionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.recent(limit, offset, filters),
    queryFn: () => datasource.recent(limit, offset, filters),
  });
}

export function useHttpCatalogQuery(query: HttpCatalogQuery) {
  return useQuery({
    queryKey: queryKeys.httpCatalog(query),
    queryFn: () => datasource.httpCatalog(query),
  });
}

export function useBusinessCatalogQuery(query: BusinessCatalogQuery) { return useQuery({ queryKey: queryKeys.businessCatalog(query), queryFn: () => datasource.businessCatalog(query) }); }
export function useErrorCatalogQuery(query: ErrorCatalogQuery) { return useQuery({ queryKey: queryKeys.errorCatalog(query), queryFn: () => datasource.errorCatalog(query) }); }

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

export function useSessionConsoleQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessionConsole(sessionId),
    queryFn: () => (sessionId ? datasource.getSessionConsole(sessionId) : Promise.resolve(undefined)),
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

export function useFailureTimeseriesQuery(filters: SessionFilters, bucket?: TimeseriesBucket) {
  return useQuery({ queryKey: queryKeys.timeseries(filters, bucket), queryFn: () => datasource.failureTimeseries(filters, bucket) });
}

export function useBusinessActionSummaryQuery(filters: SessionFilters, limit = 8) {
  return useQuery({ queryKey: queryKeys.businessActions(filters, limit), queryFn: () => datasource.businessActionSummary(filters, limit) });
}

export function useAnalyticsOverviewQuery(filters: SessionFilters) {
  return useQuery({
    queryKey: queryKeys.analyticsOverview(filters),
    queryFn: () => datasource.analyticsOverview(filters),
  });
}

export function useAnalyticsSessionsQuery(filters: SessionFilters) {
  return useQuery({
    queryKey: queryKeys.analyticsSessions(filters),
    queryFn: () => datasource.analyticsSessions(filters),
  });
}

export function useAnalyticsHttpQuery(query: HttpCatalogQuery) {
  return useQuery({
    queryKey: queryKeys.analyticsHttp(query),
    queryFn: () => datasource.analyticsHttp(query),
  });
}

export function useAnalyticsBusinessQuery(query: BusinessCatalogQuery) {
  return useQuery({
    queryKey: queryKeys.analyticsBusiness(query),
    queryFn: () => datasource.analyticsBusiness(query),
  });
}

export function useAnalyticsErrorsQuery(query: ErrorCatalogQuery) {
  return useQuery({
    queryKey: queryKeys.analyticsErrors(query),
    queryFn: () => datasource.analyticsErrors(query),
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
      queryClient.setQueriesData<SessionListResult>({ queryKey: ['sessions'] }, (current) => current ? { ...current } : current);
      void queryClient.invalidateQueries({ queryKey: queryKeys.health });
      void queryClient.invalidateQueries({ queryKey: ['dimensions'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['httpCatalog'] });
      void queryClient.invalidateQueries({ queryKey: ['businessCatalog'] });
      void queryClient.invalidateQueries({ queryKey: ['errorCatalog'] });
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['performance'] });
      void queryClient.invalidateQueries({ queryKey: ['timeseries'] });
      void queryClient.invalidateQueries({ queryKey: ['businessActions'] });
      void queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
      void queryClient.invalidateQueries({ queryKey: ['analyticsSessions'] });
      void queryClient.invalidateQueries({ queryKey: ['analyticsHttp'] });
      void queryClient.invalidateQueries({ queryKey: ['analyticsBusiness'] });
      void queryClient.invalidateQueries({ queryKey: ['analyticsErrors'] });
      if (event.sessionId) void queryClient.invalidateQueries({ queryKey: queryKeys.session(event.sessionId) });
      if (event.sessionId) void queryClient.invalidateQueries({ queryKey: queryKeys.sessionConsole(event.sessionId) });
      if (event.traceId) void queryClient.invalidateQueries({ queryKey: queryKeys.trace(event.traceId) });
      if (event.eventId) queryClient.setQueryData(queryKeys.event(event.eventId), event);
    });
  }, [enabled, queryClient]);
}
