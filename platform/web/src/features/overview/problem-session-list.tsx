import { Link } from '@tanstack/react-router';
import { AlertTriangle, BadgeAlert, Gauge, Globe2 } from 'lucide-react';
import { Badge } from '../../components/common/status-badge';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';

export function ProblemSessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <div className="divide-y divide-zinc-100">
      {sessions.map((session) => (
        <Link
          key={session.sessionId}
          to="/sessions/$sessionId"
          params={{ sessionId: session.sessionId }}
          className="block px-3 py-2.5 hover:bg-teal-50"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <strong className="min-w-0 truncate text-sm text-zinc-950">{session.sessionId}</strong>
            <Badge tone={statusTone(session.status)}>{statusLabel(session.status)}</Badge>
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500">
            {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" />错误 {session.errorCount}</span>
            <span className="inline-flex items-center gap-1"><BadgeAlert className="size-3" />业务失败 {session.businessFailureCount ?? 0}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="size-3" />卡顿 {session.jankCount}</span>
            <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />失败请求 {session.failedHttpCount}</span>
            <span>{session.route ?? '-'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function statusTone(status?: string): 'neutral' | 'danger' | 'warn' {
  if (status === 'error') return 'danger';
  if (status === 'warning' || status === 'warn') return 'warn';
  return 'neutral';
}
