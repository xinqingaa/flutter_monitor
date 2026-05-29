import { Badge, type BadgeProps } from '../../components/ui/badge';
import { eventKind } from '../../shared/event-model/accessors';
import type { MonitorEvent } from '../../shared/datasource/types';

export function EventKindBadge({ event }: { event: MonitorEvent }) {
  const kind = eventKind(event);
  const toneByKind: Record<string, BadgeProps['tone']> = {
    error: 'danger',
    http: event.status === 'error' ? 'danger' : 'info',
    jank: 'warn',
    page: 'teal',
    startup: 'good',
    memory: 'purple',
    lifecycle: 'neutral',
    business: 'info',
  };
  return <Badge tone={toneByKind[kind] ?? 'neutral'}>{labelByKind[kind] ?? kind}</Badge>;
}

const labelByKind: Record<string, string> = {
  error: '错误',
  http: '网络',
  jank: '卡顿',
  page: '页面',
  startup: '启动',
  memory: '内存',
  lifecycle: '生命周期',
  business: '业务',
  event: '事件',
  trace: '链路',
  span: '阶段',
  metric: '指标',
  breadcrumb: '足迹',
};
