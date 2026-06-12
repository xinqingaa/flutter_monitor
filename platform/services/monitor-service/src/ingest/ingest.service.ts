import { Inject, Injectable } from '@nestjs/common';
import { hasEventId, normalizeEvents } from '../ingest/normalize-events';
import type { MonitorStore } from '../store/monitor-store';
import { MONITOR_STORE, SSE_HUB } from '../store/store.tokens';
import type { SseHub } from '../stream/sse-hub';

export type IngestResult =
  | { ok: true; status: 202; body: Record<string, unknown> }
  | { ok: false; status: 400 | 500; body: Record<string, unknown> };

@Injectable()
export class IngestService {
  constructor(
    @Inject(MONITOR_STORE) private readonly store: MonitorStore,
    @Inject(SSE_HUB) private readonly sseHub: SseHub,
  ) {}

  ingest(body: unknown): IngestResult {
    const incoming = normalizeEvents(body);
    if (incoming.length === 0) {
      return { ok: false, status: 400, body: { error: 'no_events' } };
    }

    const rejected = incoming.filter((event) => !hasEventId(event)).length;
    let accepted;
    try {
      accepted = this.store.addEvents(incoming);
    } catch (error) {
      console.error('[FM monitor-service] failed to store events', error);
      return {
        ok: false,
        status: 500,
        body: {
          error: 'store_failed',
          accepted: 0,
          rejected: incoming.length,
          errors: [{ code: 'STORE_FAILED', message: 'failed to store events', retryable: true }],
        },
      };
    }
    if (accepted.length === 0) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'missing_event_id',
          accepted: 0,
          rejected,
          errors:
            rejected > 0
              ? [{ code: 'MISSING_EVENT_ID', message: 'eventId is required', retryable: false }]
              : [],
        },
      };
    }

    try {
      this.sseHub.publishEvents(accepted);
    } catch (error) {
      console.error('[FM monitor-service] failed to publish SSE events', error);
    }

    console.log(
      `[FM monitor-service] accepted=${accepted.length} rejected=${rejected} total=${this.store.health().eventCount} ` +
        `time=${new Date().toISOString()}`,
    );

    return {
      ok: true,
      status: 202,
      body: {
        accepted: accepted.length,
        rejected,
        total: this.store.health().eventCount,
        eventIds: accepted.map((event) => event.eventId).filter(Boolean),
        errors:
          rejected > 0
            ? [{ code: 'MISSING_EVENT_ID', message: 'eventId is required', retryable: false }]
            : [],
      },
    };
  }
}
