import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { MonitorEvent } from './event-types.js';
import {
  appVersionOf,
  environmentOf,
  eventTimeValue,
  nameOf,
  routeOf,
  signalTypeOf,
  statusOf,
  userIdOf,
} from './event-accessors.js';
import { MemoryMonitorStore } from './memory-monitor-store.js';
import type { MonitorStoreHealth } from './monitor-store.js';

export class SqliteMonitorStore extends MemoryMonitorStore {
  private loading = false;

  private constructor(
    private readonly sqlite: SqlJsStatic,
    private readonly db: Database,
    private readonly filePath: string,
    options: { maxEvents?: number },
  ) {
    super(options);
    this.initializeSchema();
    this.loadExistingEvents();
  }

  static async open(filePath: string, options: { maxEvents?: number } = {}): Promise<SqliteMonitorStore> {
    const sqlite = await initSqlJs();
    const db = existsSync(filePath)
      ? new sqlite.Database(readFileSync(filePath))
      : new sqlite.Database();
    return new SqliteMonitorStore(sqlite, db, filePath, options);
  }

  override addEvents(incoming: MonitorEvent[]): MonitorEvent[] {
    const accepted = super.addEvents(incoming);
    if (!this.loading && accepted.length > 0) {
      this.persistEvents(accepted);
      this.flushToDisk();
    }
    return accepted;
  }

  override health(): MonitorStoreHealth {
    return {
      ...super.health(),
      storageMode: 'sqlite',
    };
  }

  private initializeSchema(): void {
    this.db.run(`
      create table if not exists events (
        event_id text primary key,
        session_id text,
        trace_id text,
        span_id text,
        timestamp_ms integer,
        user_id text,
        route text,
        app_version text,
        environment text,
        signal_type text,
        name text,
        status text,
        envelope_json text not null
      );
      create index if not exists idx_events_session on events(session_id, timestamp_ms);
      create index if not exists idx_events_trace on events(trace_id, timestamp_ms);
      create index if not exists idx_events_user_time on events(user_id, timestamp_ms);
      create index if not exists idx_events_route_time on events(route, timestamp_ms);
      create index if not exists idx_events_app_time on events(app_version, environment, timestamp_ms);
      create index if not exists idx_events_name_time on events(name, signal_type, status, timestamp_ms);
    `);
  }

  private loadExistingEvents(): void {
    this.loading = true;
    try {
      const result = this.db.exec('select envelope_json from events order by timestamp_ms asc');
      const rows = result[0]?.values ?? [];
      const events = rows
        .map((row) => row[0])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => JSON.parse(value) as MonitorEvent);
      super.addEvents(events);
    } finally {
      this.loading = false;
    }
  }

  private persistEvents(events: MonitorEvent[]): void {
    const statement = this.db.prepare(`
      insert or replace into events (
        event_id,
        session_id,
        trace_id,
        span_id,
        timestamp_ms,
        user_id,
        route,
        app_version,
        environment,
        signal_type,
        name,
        status,
        envelope_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    try {
      this.db.run('begin');
      for (const event of events) {
        statement.run([
          event.eventId ?? null,
          event.sessionId ?? null,
          event.traceId ?? null,
          event.spanId ?? null,
          eventTimeValue(event),
          userIdOf(event) ?? null,
          routeOf(event) ?? null,
          appVersionOf(event) ?? null,
          environmentOf(event) ?? null,
          signalTypeOf(event) ?? null,
          nameOf(event) ?? null,
          statusOf(event) ?? null,
          JSON.stringify(event),
        ]);
      }
      this.db.run('commit');
    } catch (error) {
      this.db.run('rollback');
      throw error;
    } finally {
      statement.free();
    }
  }

  private flushToDisk(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, Buffer.from(this.db.export()));
  }
}
