import type { MonitorEvent, PerformanceOverview, SessionSummary } from './types';

export interface SessionFilters {
  userId?: string;
  from?: string;
  to?: string;
  appVersion?: string;
  environment?: string;
  route?: string;
  status?: string;
  limit?: number;
}

export class LocalWorkbenchDatasource {
  async health(): Promise<Record<string, unknown>> {
    return this.getJson('/api/monitor/v1/health');
  }

  async recent(limit = 50): Promise<MonitorEvent[]> {
    const data = await this.getJson(`/api/monitor/v1/recent?limit=${limit}`);
    return Array.isArray(data.events) ? (data.events as MonitorEvent[]) : [];
  }

  async listSessions(filters: SessionFilters): Promise<{
    sessions: SessionSummary[];
    userIdAvailable: boolean;
    userIdQueryAvailable?: boolean;
  }> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const data = await this.getJson(`/api/monitor/v1/sessions?${params}`);
    return {
      sessions: Array.isArray(data.sessions) ? (data.sessions as SessionSummary[]) : [],
      userIdAvailable: Boolean(data.userIdAvailable),
      userIdQueryAvailable: data.userIdQueryAvailable as boolean | undefined,
    };
  }

  async getSession(sessionId: string): Promise<MonitorEvent[]> {
    const data = await this.getJson(`/api/monitor/v1/sessions/${encodeURIComponent(sessionId)}`);
    return Array.isArray(data.events) ? (data.events as MonitorEvent[]) : [];
  }

  async getTrace(traceId: string): Promise<MonitorEvent[]> {
    const data = await this.getJson(`/api/monitor/v1/traces/${encodeURIComponent(traceId)}`);
    return Array.isArray(data.events) ? (data.events as MonitorEvent[]) : [];
  }

  async performanceOverview(filters: SessionFilters): Promise<PerformanceOverview> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    return this.getJson(`/api/monitor/v1/performance/overview?${params}`) as Promise<PerformanceOverview>;
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
