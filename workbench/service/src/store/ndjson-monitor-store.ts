import { mkdirSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MonitorEvent } from './event-types.js';
import { MemoryMonitorStore } from './memory-monitor-store.js';

export class NdjsonMonitorStore extends MemoryMonitorStore {
  private loading = false;

  constructor(
    private readonly filePath: string,
    options: { maxEvents?: number } = {},
  ) {
    super(options);
    this.loadExistingEvents();
  }

  override addEvents(incoming: MonitorEvent[]): MonitorEvent[] {
    const accepted = super.addEvents(incoming);
    if (!this.loading && accepted.length > 0) {
      mkdirSync(dirname(this.filePath), { recursive: true });
      appendFileSync(
        this.filePath,
        accepted.map((event) => JSON.stringify(event)).join('\n') + '\n',
        'utf8',
      );
    }
    return accepted;
  }

  private loadExistingEvents(): void {
    if (!existsSync(this.filePath)) return;
    this.loading = true;
    try {
      const events = readFileSync(this.filePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as MonitorEvent);
      super.addEvents(events);
    } finally {
      this.loading = false;
    }
  }
}
