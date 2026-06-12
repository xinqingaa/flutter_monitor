export type JsonObject = Record<string, unknown>;

export interface EventEnvelopeJson extends JsonObject {
  eventId?: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  signalType?: string;
  name?: string;
  level?: string;
  status?: string;
  priority?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  resource?: JsonObject;
  context?: JsonObject;
  attributes?: JsonObject;
  payload?: JsonObject;
}
