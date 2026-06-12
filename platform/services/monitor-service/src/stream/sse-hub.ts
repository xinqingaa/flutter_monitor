import type { Response } from 'express';
import type { MonitorEvent } from '../store/event-types';

type SseClient = {
  id: number;
  response: Response;
};

export class SseHub {
  private clients = new Map<number, SseClient>();
  private nextClientId = 1;
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(private readonly heartbeatIntervalMs = 15000) {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('monitor.heartbeat', { time: new Date().toISOString() });
    }, heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  connect(response: Response): void {
    const id = this.nextClientId++;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write(': connected\n\n');

    this.clients.set(id, { id, response });
    response.on('close', () => {
      this.clients.delete(id);
    });
  }

  publishEvents(events: MonitorEvent[]): void {
    for (const event of events) {
      this.broadcast('monitor.event', event);
    }
  }

  clientCount(): number {
    return this.clients.size;
  }

  close(): void {
    clearInterval(this.heartbeatTimer);
    for (const client of this.clients.values()) {
      client.response.end();
    }
    this.clients.clear();
  }

  private broadcast(eventName: string, payload: unknown): void {
    const data = JSON.stringify(payload);
    for (const client of this.clients.values()) {
      try {
        client.response.write(`event: ${eventName}\n`);
        client.response.write(`data: ${data}\n\n`);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }
}
