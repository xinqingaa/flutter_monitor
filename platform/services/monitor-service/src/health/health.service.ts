import { Inject, Injectable } from '@nestjs/common';
import type { MonitorStore } from '../store/monitor-store';
import { MONITOR_STORE } from '../store/store.tokens';
import { SseHub } from '../stream/sse-hub';
import { SSE_HUB } from '../store/store.tokens';

@Injectable()
export class HealthService {
  constructor(
    @Inject(MONITOR_STORE) private readonly store: MonitorStore,
    @Inject(SSE_HUB) private readonly sseHub: SseHub,
  ) {}

  health() {
    return {
      ok: true,
      service: 'flutter_monitor_monitor_service',
      sseClients: this.sseHub.clientCount(),
      ...this.store.health(),
    };
  }
}
