export type EvidenceEvent = {
  name?: string;
  durationMs?: number;
  timestamp?: string;
  attributes?: Record<string, unknown>;
};

export type FrameEvidence = {
  sampleCount?: number;
  slowCount?: number;
  droppedCount?: number;
  fps?: number;
  stability?: number;
  maxMs?: number;
  avgMs?: number;
  p90Ms?: number;
  p99Ms?: number;
};

export type RssEvidence = {
  startRssMb?: number;
  endRssMb?: number;
  deltaRssMb?: number;
};

export type RssEvidenceMode = 'startup' | 'page';

export function extractFrameEvidence(event: EvidenceEvent): FrameEvidence {
  return {
    sampleCount: attrNumber(event, 'frame.sample_count'),
    slowCount: attrNumber(event, 'frame.slow_count'),
    droppedCount: attrNumber(event, 'frame.dropped_count'),
    fps: attrNumber(event, 'frame.fps'),
    stability: attrNumber(event, 'frame.stability'),
    maxMs: attrNumber(event, 'frame.max_ms'),
    avgMs: attrNumber(event, 'frame.avg_ms'),
    p90Ms: attrNumber(event, 'frame.p90_ms'),
    p99Ms: attrNumber(event, 'frame.p99_ms'),
  };
}

export function extractRssEvidence(event: EvidenceEvent, mode: RssEvidenceMode): RssEvidence {
  if (mode === 'startup') {
    return {
      startRssMb: attrNumber(event, 'memory.start_rss_mb'),
      endRssMb: attrNumber(event, 'memory.end_rss_mb'),
      deltaRssMb: attrNumber(event, 'memory.delta_rss_mb'),
    };
  }
  return {
    startRssMb: attrNumber(event, 'memory.enter_rss_mb'),
    endRssMb: attrNumber(event, 'memory.exit_rss_mb'),
    deltaRssMb: attrNumber(event, 'memory.delta_rss_mb'),
  };
}

export function hasFrameEvidence(frame: FrameEvidence): boolean {
  return [
    frame.sampleCount,
    frame.slowCount,
    frame.droppedCount,
    frame.fps,
    frame.stability,
    frame.maxMs,
    frame.avgMs,
    frame.p90Ms,
    frame.p99Ms,
  ].some(isFiniteNumber);
}

export function hasRssEvidence(rss: RssEvidence): boolean {
  return [rss.startRssMb, rss.endRssMb, rss.deltaRssMb].some(isFiniteNumber);
}

export function isTraceEnd(event: EvidenceEvent): boolean {
  return attrString(event, 'event.phase') === 'end';
}

export function isStartupTraceEnd(event: EvidenceEvent): boolean {
  return (event.name === 'app.cold_start' || event.name === 'app.hot_start') && isTraceEnd(event);
}

export function isPageVisitEnd(event: EvidenceEvent): boolean {
  return event.name === 'page.visit' && isTraceEnd(event);
}

export function formatFps(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  return `${formatNumber(value, 1)} FPS`;
}

export function formatStability(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  const percent = value <= 1 ? value * 100 : value;
  return `${formatNumber(percent, 1)}%`;
}

export function formatFrameMs(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  return `${formatNumber(value, 1)}ms`;
}

export function formatRssMb(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  return `${formatNumber(value, 1)}MB`;
}

export function formatRssDelta(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, 1)}MB`;
}

export function formatSlowSample(frame: FrameEvidence): string {
  if (!isFiniteNumber(frame.slowCount) && !isFiniteNumber(frame.sampleCount)) return '-';
  return `${formatCount(frame.slowCount)}/${formatCount(frame.sampleCount)}`;
}

export function frameSummaryLabel(frame: FrameEvidence): string | undefined {
  if (isFiniteNumber(frame.fps) || isFiniteNumber(frame.stability)) {
    return [isFiniteNumber(frame.fps) ? formatFps(frame.fps) : undefined, isFiniteNumber(frame.stability) ? formatStability(frame.stability) : undefined]
      .filter(Boolean)
      .join(' / ');
  }
  if (isFiniteNumber(frame.maxMs)) return `最大帧 ${formatFrameMs(frame.maxMs)}`;
  return undefined;
}

function attrNumber(event: EvidenceEvent, key: string): number | undefined {
  const value = event.attributes?.[key];
  return isFiniteNumber(value) ? value : undefined;
}

function attrString(event: EvidenceEvent, key: string): string | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function formatNumber(value: number, fractionDigits: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits);
}

function formatCount(value?: number): string {
  if (!isFiniteNumber(value)) return '-';
  return String(Math.round(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
