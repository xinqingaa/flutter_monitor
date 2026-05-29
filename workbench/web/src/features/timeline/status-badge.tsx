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
  return <Badge tone={toneByKind[kind] ?? 'neutral'}>{kind}</Badge>;
}
