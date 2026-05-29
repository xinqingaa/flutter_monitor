import { Link } from '@tanstack/react-router';
import { AlertTriangle, Gauge, Globe2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';

export function ProblemSessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <div className="divide-y divide-zinc-100">
      {sessions.map((session) => (
        <Link
          key={session.sessionId}
          to="/sessions/$sessionId"
          params={{ sessionId: session.sessionId }}
          className="block px-3 py-2 hover:bg-teal-50"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <strong className="min-w-0 truncate text-[12px] text-zinc-950">{session.sessionId}</strong>
            <Badge tone={session.status === 'error' ? 'danger' : 'neutral'}>{session.status ?? 'ok'}</Badge>
          </div>
          <div className="mt-1 truncate text-[11px] text-zinc-500">
            {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" />error {session.errorCount}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="size-3" />jank {session.jankCount}</span>
            <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />http_fail {session.failedHttpCount}</span>
            <span>{session.route ?? '-'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
