import { Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowRight, Gauge, Globe2, Radio, UserRound } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CopyableId } from '../../components/common/copyable-id';
import { EmptyState } from '../../components/common/empty-state';
import type { SessionSummary } from '../../shared/datasource/types';
import { formatDateTime } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';
import { cn } from '../../shared/formatting/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

export function SessionSummaryCard({
  session,
  live = false,
  title = '最近 / 实时 Session',
  description = '刚复现的链路会自动浮出。',
  actionLabel = '进入排查',
  className,
}: {
  session?: SessionSummary;
  live?: boolean;
  title?: string;
  description?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
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
          <div className="grid gap-3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <CopyableId value={session.sessionId} />
              <Badge tone={session.status === 'error' ? 'danger' : 'good'}>{statusLabel(session.status)}</Badge>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs tabular-nums text-zinc-600">
              {formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}
            </div>
            <SessionContext session={session} />
            <SessionIssueSummary session={session} />
            <Button asChild variant="default" className="w-full">
              <Link to="/sessions/$sessionId" params={{ sessionId: session.sessionId }} className="justify-center">
                {actionLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionContext({ session, compact = false }: { session: SessionSummary; compact?: boolean }) {
  const items = [
    { label: '用户', value: session.userId, icon: UserRound },
    { label: '页面', value: session.route, icon: Globe2 },
    { label: '版本', value: session.appVersion },
    { label: '环境', value: session.environment },
  ].filter((item) => Boolean(item.value));

  if (items.length === 0) {
    return <div className="text-xs text-zinc-400">暂无用户、页面、版本或环境上下文</div>;
  }

  return (
    <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1">
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              {Icon ? <Icon className="size-3" /> : null}
              {item.label}
            </div>
            <div className="mt-0.5 truncate text-xs font-medium text-zinc-900">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function SessionMetadataLine({ session }: { session: SessionSummary }) {
  const items = [
    { label: '用户', value: session.userId },
    { label: '页面', value: session.route },
    { label: '版本', value: session.appVersion },
    { label: '环境', value: session.environment },
  ].filter((item) => Boolean(item.value));

  if (items.length === 0) {
    return <div className="truncate text-xs text-zinc-400">暂无用户、页面、版本或环境上下文</div>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
      {items.map((item, index) => (
        <span key={item.label} className="inline-flex min-w-0 items-center gap-2">
          {index > 0 ? <span className="text-zinc-300">·</span> : null}
          <span className="shrink-0 text-zinc-400">{item.label}</span>
          <span className="min-w-0 truncate font-medium text-zinc-700">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export function SessionIssueSummary({ session }: { session: SessionSummary }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
      <IssuePill label="事件" value={session.count} />
      <IssuePill label="错误" value={session.errorCount} icon={AlertTriangle} tone={session.errorCount > 0 ? 'danger' : 'neutral'} />
      <IssuePill label="卡顿" value={session.jankCount} icon={Gauge} tone={session.jankCount > 0 ? 'warn' : 'neutral'} />
      <IssuePill label="失败请求" value={session.failedHttpCount} icon={Globe2} tone={session.failedHttpCount > 0 ? 'danger' : 'neutral'} />
    </div>
  );
}

export function SessionIssueInline({ session }: { session: SessionSummary }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-600">
      <InlineMetric label="事件数" value={session.count} icon={Activity} />
      <InlineMetric label="错误数" value={session.errorCount} icon={AlertTriangle} tone={session.errorCount > 0 ? 'danger' : 'neutral'} />
      <InlineMetric label="卡顿数" value={session.jankCount} icon={Gauge} tone={session.jankCount > 0 ? 'warn' : 'neutral'} />
      <InlineMetric label="失败请求数" value={session.failedHttpCount} icon={Globe2} tone={session.failedHttpCount > 0 ? 'danger' : 'neutral'} />
    </div>
  );
}

function InlineMetric({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon?: typeof AlertTriangle;
  tone?: 'neutral' | 'warn' | 'danger';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${label} ${value}`}
          className={cn(
            'inline-flex h-6 min-w-0 items-center gap-1 rounded-full px-1.5 tabular-nums',
            tone === 'neutral' && 'text-zinc-600',
            tone === 'warn' && 'text-amber-700',
            tone === 'danger' && 'text-red-700',
          )}
        >
          {Icon ? <Icon className="size-3.5" /> : null}
          <span className="font-semibold">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IssuePill({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon?: typeof AlertTriangle;
  tone?: 'neutral' | 'warn' | 'danger';
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border px-2 py-1',
        tone === 'neutral' && 'border-zinc-200 bg-zinc-50 text-zinc-600',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'danger' && 'border-red-200 bg-red-50 text-red-700',
      )}
    >
      <div className="flex items-center gap-1 text-[11px]">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
