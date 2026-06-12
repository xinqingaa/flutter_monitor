import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { dirname, join, resolve } from 'node:path';
import { SseHub } from '../stream/sse-hub';
import type { MonitorStore } from './monitor-store';
import { SqliteMonitorStore } from './sqlite-monitor-store';
import { MONITOR_STORE, SSE_HUB } from './store.tokens';

@Injectable()
class StoreLifecycle implements OnModuleDestroy {
  constructor(
    private readonly store: MonitorStore,
    private readonly sseHub: SseHub,
  ) {}

  onModuleDestroy(): void {
    this.sseHub.close();
    this.store.close?.();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: SSE_HUB,
      useFactory: () => new SseHub(),
    },
    {
      provide: MONITOR_STORE,
      useFactory: async (): Promise<MonitorStore> => {
        const sqlitePath = process.env.FM_WORKBENCH_SQLITE_PATH || defaultSqlitePath();
        const maxEvents = Number.parseInt(process.env.FM_WORKBENCH_MAX_EVENTS || '5000', 10);
        return SqliteMonitorStore.open(sqlitePath, { maxEvents });
      },
    },
    {
      provide: StoreLifecycle,
      useFactory: (store: MonitorStore, sseHub: SseHub) => new StoreLifecycle(store, sseHub),
      inject: [MONITOR_STORE, SSE_HUB],
    },
  ],
  exports: [MONITOR_STORE, SSE_HUB],
})
export class StoreModule implements OnModuleDestroy {
  constructor(private readonly lifecycle: StoreLifecycle) {}

  onModuleDestroy(): void {
    this.lifecycle.onModuleDestroy();
  }
}

function platformRootFromCompiledStore(): string {
  return resolve(dirname(__filename), '..', '..', '..', '..');
}

export function defaultSqlitePath(): string {
  return resolve(platformRootFromCompiledStore(), '.data', 'events.sqlite');
}

export function resolveWebDistDir(): string {
  return resolve(platformRootFromCompiledStore(), 'web', 'dist');
}

export function resolvePublicDir(): string {
  return join(resolve(dirname(__filename), '..', '..'), 'public');
}
