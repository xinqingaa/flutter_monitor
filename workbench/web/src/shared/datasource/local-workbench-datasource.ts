import type {
  EventListResult,
  MonitorEvent,
  PerformanceOverview,
  SessionFilters,
  SessionListResult,
  WorkbenchDatasource,
} from './types';

export class LocalWorkbenchDatasource implements WorkbenchDatasource {
  async health(): Promise<Record<string, unknown>> {
    return this.getJson('/api/monitor/v1/health');
  }

  async recent(limit = 50, offset = 0): Promise<EventListResult> {
    const data = await this.getJson(`/api/monitor/v1/recent?${toParams({ limit, offset })}`);
    return {
      events: Array.isArray(data.events) ? (data.events as MonitorEvent[]) : [],
      limit: typeof data.limit === 'number' ? data.limit : limit,
      offset: typeof data.offset === 'number' ? data.offset : offset,
      hasMore: Boolean(data.hasMore),
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
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}
