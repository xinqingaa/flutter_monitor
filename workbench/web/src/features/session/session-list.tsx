import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import type { SessionSummary } from '../../shared/datasource/types';
import { SessionCard, type SessionCardVariant } from './session-summary-card';

export function SessionList({
  sessions,
  selectedSessionId,
  dense = false,
  title,
  description,
  panelAction,
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  dense?: boolean;
  title?: string;
  description?: string;
  panelAction?: React.ReactNode;
}) {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title ?? '全部会话'}</CardTitle>
          {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
        </div>
        {panelAction}
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        <SessionRows sessions={sessions} selectedSessionId={selectedSessionId} variant={dense ? 'compact' : 'compact'} />
      </CardContent>
    </Card>
  );
}

export function SessionRows({
  sessions,
  selectedSessionId,
  variant = 'row',
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  variant?: SessionCardVariant;
}) {
  if (sessions.length === 0) {
    return (
      <div className="p-3">
        <EmptyState title="暂无会话" description="运行 example 后，本地实时数据会出现在这里。" />
      </div>
    );
  }

  return (
    <div className="grid gap-2 p-2">
      {sessions.map((session) => (
        <SessionCard
          key={session.sessionId}
          session={session}
          selected={selectedSessionId === session.sessionId}
          variant={variant}
        />
      ))}
    </div>
  );
}
