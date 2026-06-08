import type { DimensionAppOption, DimensionOption } from '../../shared/datasource/types';

const PROBLEM_TYPES: DimensionOption[] = [
  { value: 'error', count: 0 },
  { value: 'business_failure', count: 0 },
  { value: 'failed_http', count: 0 },
  { value: 'jank', count: 0 },
  { value: 'slow_startup', count: 0 },
  { value: 'slow_page', count: 0 },
  { value: 'memory_pressure', count: 0 },
  { value: 'memory_growth', count: 0 },
  { value: 'memory_leak_suspect', count: 0 },
];

export function appOption(app: DimensionAppOption): { value: string; label: string } {
  const name = app.appName ? `${app.appName} ` : '';
  return {
    value: app.appKey,
    label: `${name}${app.appKey} (${app.eventCount})`,
  };
}

export function dimensionOptions(options?: DimensionOption[]): Array<{ value: string; label: string }> {
  return (options ?? []).map((option) => ({
    value: option.value,
    label: `${option.value} (${option.count})`,
  }));
}

export function problemOptions(): Array<{ value: string; label: string }> {
  return PROBLEM_TYPES.map((option) => ({
    value: option.value,
    label: problemLabel(option.value),
  }));
}

export function problemLabel(value: string): string {
  const labels: Record<string, string> = {
    error: '错误',
    business_failure: '业务失败',
    failed_http: '失败请求',
    jank: '卡顿',
    slow_startup: '慢启动',
    slow_page: '慢页面',
    memory_pressure: '内存压力',
    memory_growth: '内存增长',
    memory_leak_suspect: '疑似泄漏',
  };
  return labels[value] ?? value;
}
