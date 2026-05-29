export function formatTime(timestamp?: string): string {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(date);
}

export function formatDateTime(timestamp?: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatDuration(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatPercent(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

export function compactNumber(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('zh-CN', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value);
}
