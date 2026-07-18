import type {
  DimensionSummary,
  BusinessAnalytics,
  BusinessCatalogQuery,
  BusinessCatalogResult,
  ErrorAnalytics,
  ErrorCatalogQuery,
  ErrorCatalogResult,
  EventListResult,
  HttpAnalytics,
  HttpCatalogQuery,
  HttpCatalogResult,
  MonitorEvent,
  OverviewAnalytics,
  PerformanceOverview,
  FailureTimeseries,
  BusinessActionSummary,
  TimeseriesBucket,
  SessionAnalytics,
  SessionConsoleResult,
  SessionFilters,
  SessionListResult,
  WorkbenchDatasource,
} from './types';

export class LocalWorkbenchDatasource implements WorkbenchDatasource {
  async health(): Promise<Record<string, unknown>> {
    return this.getJson('/api/monitor/v1/health');
  }

  async recent(limit = 50, offset = 0, filters: SessionFilters = {}): Promise<EventListResult> {
    const data = await this.getJson(`/api/monitor/v1/recent?${toParams({ ...filters, limit, offset })}`);
    return {
      events: Array.isArray(data.events) ? (data.events as MonitorEvent[]) : [],
      limit: typeof data.limit === 'number' ? data.limit : limit,
      offset: typeof data.offset === 'number' ? data.offset : offset,
      hasMore: Boolean(data.hasMore),
    };
  }

  async httpCatalog(query: HttpCatalogQuery): Promise<HttpCatalogResult> {
    const data = await this.getJson(`/api/monitor/v1/catalog/http?${toParams(query)}`);
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
      limit: typeof data.limit === 'number' ? data.limit : (query.limit ?? 50),
      offset: typeof data.offset === 'number' ? data.offset : (query.offset ?? 0),
      slowThresholdMs: typeof data.slowThresholdMs === 'number' ? data.slowThresholdMs : 1000,
    };
  }

  async businessCatalog(query: BusinessCatalogQuery): Promise<BusinessCatalogResult> {
    const data = await this.getJson(`/api/monitor/v1/catalog/business?${toParams(query)}`);
    return { items: Array.isArray(data.items) ? data.items : [], total: typeof data.total === 'number' ? data.total : 0, limit: typeof data.limit === 'number' ? data.limit : (query.limit ?? 50), offset: typeof data.offset === 'number' ? data.offset : (query.offset ?? 0) };
  }

  async errorCatalog(query: ErrorCatalogQuery): Promise<ErrorCatalogResult> {
    const data = await this.getJson(`/api/monitor/v1/catalog/errors?${toParams(query)}`);
    return { items: Array.isArray(data.items) ? data.items : [], total: typeof data.total === 'number' ? data.total : 0, limit: typeof data.limit === 'number' ? data.limit : (query.limit ?? 50), offset: typeof data.offset === 'number' ? data.offset : (query.offset ?? 0) };
  }

  async dimensions(filters: SessionFilters, options?: { q?: string; limit?: number }): Promise<DimensionSummary> {
    const data = await this.getJson(`/api/monitor/v1/dimensions?${toParams({ ...filters, q: options?.q, limit: options?.limit })}`);
    return {
      apps: Array.isArray(data.apps) ? data.apps : [],
      appNames: Array.isArray(data.appNames) ? data.appNames : [],
      packageNames: Array.isArray(data.packageNames) ? data.packageNames : [],
      environments: Array.isArray(data.environments) ? data.environments : [],
      appVersions: Array.isArray(data.appVersions) ? data.appVersions : [],
      buildNumbers: Array.isArray(data.buildNumbers) ? data.buildNumbers : [],
      channels: Array.isArray(data.channels) ? data.channels : [],
      flavors: Array.isArray(data.flavors) ? data.flavors : [],
      devicePlatforms: Array.isArray(data.devicePlatforms) ? data.devicePlatforms : [],
      deviceModels: Array.isArray(data.deviceModels) ? data.deviceModels : [],
      deviceTiers: Array.isArray(data.deviceTiers) ? data.deviceTiers : [],
      osVersions: Array.isArray(data.osVersions) ? data.osVersions : [],
      nativePlatforms: Array.isArray(data.nativePlatforms) ? data.nativePlatforms : [],
      routes: Array.isArray(data.routes) ? data.routes : [],
      statuses: Array.isArray(data.statuses) ? data.statuses : [],
      names: Array.isArray(data.names) ? data.names : [],
      signalTypes: Array.isArray(data.signalTypes) ? data.signalTypes : [],
      userIds: Array.isArray(data.userIds) ? data.userIds : [],
      sessionIds: Array.isArray(data.sessionIds) ? data.sessionIds : [],
      requestIds: Array.isArray(data.requestIds) ? data.requestIds : [],
      httpMethods: Array.isArray(data.httpMethods) ? data.httpMethods : [],
      httpStatusCodes: Array.isArray(data.httpStatusCodes) ? data.httpStatusCodes : [],
      httpBusinessCodes: Array.isArray(data.httpBusinessCodes) ? data.httpBusinessCodes : [],
      httpHosts: Array.isArray(data.httpHosts) ? data.httpHosts : [],
    };
  }

  async listSessions(filters: SessionFilters): Promise<SessionListResult> {
    const data = await this.getJson(`/api/monitor/v1/sessions?${toParams(filters)}`);
    return {
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      userIdAvailable: Boolean(data.userIdAvailable),
      userIdQueryAvailable: data.userIdQueryAvailable as boolean | undefined,
      limit: typeof data.limit === 'number' ? data.limit : (filters.limit ?? 50),
      offset: typeof data.offset === 'number' ? data.offset : (filters.offset ?? 0),
      hasMore: Boolean(data.hasMore),
    };
  }

  async getSessionConsole(sessionId: string): Promise<SessionConsoleResult> {
    return this.getJson(`/api/monitor/v1/sessions/${encodeURIComponent(sessionId)}/console`) as Promise<SessionConsoleResult>;
  }

  async getSession(sessionId: string): Promise<MonitorEvent[]> {
    const data = await this.getJson(`/api/monitor/v1/sessions/${encodeURIComponent(sessionId)}`);
    return Array.isArray(data.events) ? data.events : [];
  }

  async getTrace(traceId: string): Promise<MonitorEvent[]> {
    const data = await this.getJson(`/api/monitor/v1/traces/${encodeURIComponent(traceId)}`);
    return Array.isArray(data.events) ? data.events : [];
  }

  async getEvent(eventId: string): Promise<MonitorEvent | undefined> {
    const data = await this.getJson(`/api/monitor/v1/events/${encodeURIComponent(eventId)}`);
    return data.event as MonitorEvent | undefined;
  }

  async performanceOverview(filters: SessionFilters): Promise<PerformanceOverview> {
    return this.getJson(`/api/monitor/v1/performance/overview?${toParams(filters)}`) as Promise<PerformanceOverview>;
  }

  async failureTimeseries(filters: SessionFilters, bucket?: TimeseriesBucket): Promise<FailureTimeseries> {
    return this.getJson(`/api/monitor/v1/performance/timeseries?${toParams({ ...filters, bucket })}`) as Promise<FailureTimeseries>;
  }

  async businessActionSummary(filters: SessionFilters, limit = 8): Promise<BusinessActionSummary> {
    return this.getJson(`/api/monitor/v1/dashboard/business-actions?${toParams({ ...filters, limit })}`) as Promise<BusinessActionSummary>;
  }

  async analyticsOverview(filters: SessionFilters): Promise<OverviewAnalytics> {
    return this.getJson(`/api/monitor/v1/analytics/overview?${toParams(filters)}`) as Promise<OverviewAnalytics>;
  }

  async analyticsSessions(filters: SessionFilters): Promise<SessionAnalytics> {
    return this.getJson(`/api/monitor/v1/analytics/sessions?${toParams(filters)}`) as Promise<SessionAnalytics>;
  }

  async analyticsHttp(query: HttpCatalogQuery): Promise<HttpAnalytics> {
    return this.getJson(`/api/monitor/v1/analytics/http?${toParams(query)}`) as Promise<HttpAnalytics>;
  }

  async analyticsBusiness(query: BusinessCatalogQuery): Promise<BusinessAnalytics> {
    return this.getJson(`/api/monitor/v1/analytics/business?${toParams(query)}`) as Promise<BusinessAnalytics>;
  }

  async analyticsErrors(query: ErrorCatalogQuery): Promise<ErrorAnalytics> {
    return this.getJson(`/api/monitor/v1/analytics/errors?${toParams(query)}`) as Promise<ErrorAnalytics>;
  }

  async searchEvents(query: string, filters: SessionFilters): Promise<MonitorEvent[]> {
    const params = toParams({ ...filters, query });
    const data = await this.getJson(`/api/monitor/v1/search?${params}`);
    return Array.isArray(data.events) ? data.events : [];
  }

  subscribeEvents(onEvent: (event: MonitorEvent) => void): () => void {
    const source = new EventSource('/api/monitor/v1/stream');
    source.addEventListener('monitor.event', (message) => {
      onEvent(JSON.parse((message as MessageEvent).data) as MonitorEvent);
    });
    return () => source.close();
  }

  private async getJson(path: string): Promise<any> {
    const response = await fetch(path);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? response.statusText);
    return data;
  }
}

function toParams(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== '') params.append(key, String(item));
      }
    } else if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
