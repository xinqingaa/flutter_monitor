import {
  Activity,
  AlertTriangle,
  BadgeAlert,
  ChartNoAxesColumn,
  Gauge,
  Globe2,
  HardDrive,
  Layers3,
  Radio,
  ServerCog,
  Timer,
} from 'lucide-react';
import type { BadgeProps } from '../../components/common/status-badge';
import type { SessionConsoleRow } from '../../shared/datasource/types';

export function rowIcon(row: SessionConsoleRow) {
  if (row.group === 'http') return Globe2;
  if (row.group === 'sdk') return ServerCog;
  if (row.group === 'business') return BadgeAlert;
  if (row.group === 'interaction') return ChartNoAxesColumn;
  if (row.group === 'startup') return Timer;
  if (row.group === 'page') return Layers3;
  if (row.group === 'memory') return HardDrive;
  if (row.group === 'lifecycle') return Radio;
  if (row.issueLabels.length > 0 || row.group === 'problem') return AlertTriangle;
  if (row.group === 'performance') return Gauge;
  return Activity;
}

export function iconClass(row: SessionConsoleRow): string {
  if (row.issueLabels.some((label) => label.includes('失败') || label === '错误' || label.includes('丢弃'))) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (row.issueLabels.length > 0) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (row.group === 'http') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (row.group === 'sdk') return 'border-zinc-200 bg-zinc-50 text-zinc-600';
  if (row.group === 'business') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (row.group === 'interaction') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (row.group === 'memory') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-teal-200 bg-teal-50 text-teal-700';
}

export function groupLabel(group: SessionConsoleRow['group']): string {
  const labels: Record<SessionConsoleRow['group'], string> = {
    startup: '启动',
    page: '页面',
    http: 'HTTP',
    interaction: '交互',
    business: '埋点',
    problem: '异常',
    performance: '性能',
    lifecycle: '生命周期',
    memory: '内存',
    sdk: 'SDK',
    event: '事件',
  };
  return labels[group];
}

export function groupTone(group: SessionConsoleRow['group']): BadgeProps['tone'] {
  if (group === 'http') return 'info';
  if (group === 'interaction') return 'teal';
  if (group === 'business') return 'neutral';
  if (group === 'memory') return 'good';
  if (group === 'problem') return 'warn';
  if (group === 'sdk') return 'neutral';
  return 'neutral';
}

export function issueTone(label: string): BadgeProps['tone'] {
  if (label.includes('失败') || label === '错误' || label.includes('丢弃')) return 'danger';
  return 'warn';
}

export function primaryStatusBadge(row: SessionConsoleRow): { label: string; tone: BadgeProps['tone'] } | undefined {
  if (row.group === 'http') {
    if (typeof row.statusCode === 'number') {
      const failed = row.success === false || row.status === 'error' || row.statusCode >= 400;
      return { label: String(row.statusCode), tone: failed ? 'danger' : 'good' };
    }
    if (row.errorType) {
      return { label: row.errorType, tone: 'danger' };
    }
  }
  return undefined;
}
