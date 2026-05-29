import type { MonitorEvent } from '../store/event-types.js';

export function normalizeEvents(body: unknown): MonitorEvent[] {
  if (!body) return [];
  if (Array.isArray(body)) return body.filter(isObject) as MonitorEvent[];
  if (isObject(body)) {
    const events = body.events;
    if (Array.isArray(events)) return events.filter(isObject) as MonitorEvent[];
    if (typeof body.eventId === 'string') return [body as MonitorEvent];
  }
  return [];
}

export function ensureEventId(event: MonitorEvent, sequence: number): void {
  if (!event.eventId) {
    event.eventId = `evt_server_${Date.now()}_${sequence}`;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
