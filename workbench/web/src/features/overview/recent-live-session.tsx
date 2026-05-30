import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowRight, Gauge, Globe2, Radio } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';

export function RecentLiveSession({ session, live, compact = false }: { session?: SessionSummary; live: boolean; compact?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>最近 / 实时 Session</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">{compact ? '刚复现的链路会自动浮出。' : '刚复现的链路自动浮在这里，便于本地实时自调试。'}</p>
        </div>
        {live ? (
          <Badge tone="teal" className="shrink-0">
            <Radio className="size-3" />
            实时中
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {!session ? (
          <EmptyState title="暂无会话" description="运行 example 后，最新一次 App 使用过程会出现在这里。" />
        ) : (
          <div className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'}>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <CopyableId value={session.sessionId} />
                <Badge tone={session.status === 'error' ? 'danger' : 'good'}>{statusLabel(session.status)}</Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
                <span>{session.userId ?? '-'}</span>
                <span className="text-zinc-300">·</span>
                <span>{session.route ?? '-'}</span>
                <span className="text-zinc-300">·</span>
                <span>{session.appVersion ?? '-'} / {session.environment ?? '-'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>事件 {session.count}</span>
                <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" />错误 {session.errorCount}</span>
                <span className="inline-flex items-center gap-1"><Gauge className="size-3" />卡顿 {session.jankCount}</span>
                <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />失败请求 {session.failedHttpCount}</span>
              </div>
            </div>
            <Button asChild variant="secondary" className={compact ? 'w-full justify-self-stretch' : 'w-full justify-self-stretch md:w-auto md:justify-self-end'}>
              <Link to="/sessions/$sessionId" params={{ sessionId: session.sessionId }} className="justify-center">
                进入排查
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
