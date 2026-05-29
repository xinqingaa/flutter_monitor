import { Link } from '@tanstack/react-router';
import { AlertTriangle, Gauge, Globe2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';

export function SessionList({
  sessions,
  selectedSessionId,
  dense = false,
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  dense?: boolean;
}) {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {sessions.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无 session" description="运行 example 后，LocalLive 数据会出现在这里。" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                to="/sessions/$sessionId"
                params={{ sessionId: session.sessionId }}
                className={cn(
                  'block px-3 py-2 text-left hover:bg-teal-50',
                  selectedSessionId === session.sessionId && 'bg-teal-50',
                  dense && 'py-1.5',
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-[12px] text-zinc-950">{session.sessionId}</strong>
                  <Badge tone={session.status === 'error' ? 'danger' : 'neutral'}>{session.status ?? 'ok'}</Badge>
                </div>
                <div className="mt-1 truncate text-[11px] text-zinc-500">
                  {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                  <span>events {session.count}</span>
                  <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" />{session.errorCount}</span>
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3" />{session.jankCount}</span>
                  <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />{session.failedHttpCount}</span>
                </div>
                <div className="mt-1 truncate text-[11px] text-zinc-500">
                  {session.userId ?? '-'} · {session.route ?? '-'} · {session.appVersion ?? '-'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
