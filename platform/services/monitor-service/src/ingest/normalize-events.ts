import type { MonitorEvent } from '../store/event-types';

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

export function hasEventId(event: MonitorEvent): event is MonitorEvent & { eventId: string } {
  return typeof event.eventId === 'string' && event.eventId.length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
