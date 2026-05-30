import { Link } from '@tanstack/react-router';
import { AlertTriangle, Gauge, Globe2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';
import { statusLabel } from '../../shared/event-model/status';

export function SessionList({
  sessions,
  selectedSessionId,
  dense = false,
  title,
  description,
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  dense?: boolean;
  title?: string;
  description?: string;
}) {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>{title ?? '全部会话'}</CardTitle>
        {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        <SessionRows sessions={sessions} selectedSessionId={selectedSessionId} dense={dense} />
      </CardContent>
    </Card>
  );
}

export function SessionRows({
  sessions,
  selectedSessionId,
  dense = false,
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  dense?: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <div className="p-3">
        <EmptyState title="暂无会话" description="运行 example 后，本地实时数据会出现在这里。" />
      </div>
    );
  }

  return (
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
            <ShortSessionId value={session.sessionId} />
            <Badge tone={session.status === 'error' ? 'danger' : 'neutral'}>{statusLabel(session.status)}</Badge>
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500">
            {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            <span>事件 {session.count}</span>
            <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" />错误 {session.errorCount}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="size-3" />卡顿 {session.jankCount}</span>
            <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />失败请求 {session.failedHttpCount}</span>
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500">
            {session.userId ?? '-'} · {session.route ?? '-'} · {session.appVersion ?? '-'}
          </div>
        </Link>
      ))}
    </div>
  );
}

function ShortSessionId({ value }: { value: string }) {
  const display = value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
  return <code className="min-w-0 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{display}</code>;
}
