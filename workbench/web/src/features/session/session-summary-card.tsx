import { Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, CalendarClock, Cpu, Gauge, Globe2, Radio, Smartphone, UserRound } from 'lucide-react';
import type * as React from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { pickScopeSearch } from '../scope/scope-filters';
import type { SessionSummary } from '../../shared/datasource/types';
import { statusLabel } from '../../shared/event-model/status';
import { cn } from '../../shared/formatting/cn';
import { formatDateTime } from '../../shared/formatting/format';

export type SessionCardVariant = 'featured' | 'row' | 'compact';

export function SessionSummaryCard({
  session,
  live = false,
  title = '最近 / 实时 Session',
  className,
  panelAction,
}: {
  session?: SessionSummary;
  live?: boolean;
  title?: string;
  className?: string;
  panelAction?: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live ? (
            <Badge tone="teal" className="shrink-0">
              <Radio className="size-3" />
              实时中
            </Badge>
          ) : null}
          {panelAction}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!session ? (
          <EmptyState title="暂无会话" description="运行 example 后，最新一次 App 使用过程会出现在这里。" />
        ) : (
          <SessionCard session={session} variant="featured" />
        )}
      </CardContent>
    </Card>
  );
}

export function SessionCard({
  session,
  variant = 'row',
  selected = false,
  className,
}: {
  session: SessionSummary;
  variant?: SessionCardVariant;
  selected?: boolean;
  className?: string;
}) {
  const featured = variant === 'featured';
  const compact = variant === 'compact';

  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.sessionId }}
      search={(current) => pickScopeSearch(current)}
      className={cn(
        'group block min-w-0 rounded-md border bg-white text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40',
        selected ? 'border-teal-400 bg-teal-50/70' : 'border-zinc-200',
        featured ? 'p-3 shadow-sm shadow-zinc-200/60' : compact ? 'p-2' : 'p-3',
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[3px_minmax(0,1fr)] gap-2">
        <span className={cn(
          'rounded-full',
          session.status === 'error' ? 'bg-red-500' : session.nativeAvailable ? 'bg-teal-500' : 'bg-zinc-300',
        )} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <code className={cn('min-w-0 truncate text-xs font-semibold text-zinc-950', featured && 'text-sm')}>
              {session.sessionId}
            </code>
            <div className="flex shrink-0 items-center gap-1">
              <Badge tone={session.status === 'error' ? 'danger' : 'neutral'} className="rounded-md px-1.5 py-0">
                {statusLabel(session.status)}
              </Badge>
              <NativeBadge session={session} />
            </div>
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs tabular-nums text-zinc-500">
            <CalendarClock className="size-3.5 shrink-0 text-teal-600" />
            <span className="min-w-0 truncate">{formatDateTime(session.firstTimestamp)} - {formatDateTime(session.lastTimestamp)}</span>
          </div>

          {compact ? (
            <div className="mt-2">
              <SessionIssueInline session={session} />
            </div>
          ) : (
            <>
              <SessionContext session={session} compact={!featured} />
              <SessionIssueSummary session={session} compact={!featured} />
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export function NativeBadge({ session }: { session: SessionSummary }) {
  const label = session.nativeAvailable ? 'Native on' : 'Native off';
  const detail = session.nativeAvailable
    ? [session.nativePlatform, session.nativeVersion].filter(Boolean).join(' · ')
    : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge tone={session.nativeAvailable ? 'teal' : 'neutral'} className="rounded-md px-1.5 py-0">
          <Cpu className="size-3" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{detail || label}</TooltipContent>
    </Tooltip>
  );
}

export function SessionContext({ session, compact = false }: { session: SessionSummary; compact?: boolean }) {
  const items = [
    { label: '应用', value: appLabel(session) },
    { label: '用户', value: session.userId ?? '无登录', icon: UserRound },
    { label: '页面', value: session.route, },
    { label: '版本', value: session.appVersion },
    { label: '环境', value: session.environment },
    { label: '设备', value: deviceLabel(session), icon: Smartphone, tooltip: deviceTierHint(session.deviceTier) },
  ].filter((item) => Boolean(item.value));

  if (items.length === 0) {
    return <div className="mt-2 text-xs text-zinc-400">暂无用户、页面、版本或环境上下文</div>;
  }

  return (
    <div className={cn('mt-2 flex flex-wrap gap-1.5', compact ? 'text-xs' : '')}>
      {items.map((item) => {
        const Icon = item.icon;
        const chip = (
          <span key={item.label} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
            {Icon ? <Icon className="size-3 shrink-0 text-zinc-400" /> : <span className="shrink-0 text-zinc-400">{item.label}</span>}
            <span className="min-w-0 truncate font-medium text-zinc-800">{item.value}</span>
          </span>
        );
        if (!item.tooltip) return chip;
        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>{chip}</TooltipTrigger>
            <TooltipContent>{item.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function appLabel(session: SessionSummary): string | undefined {
  if (!session.appKey && !session.appName) return undefined;
  if (session.appName && session.appKey) return `${session.appName} · ${session.appKey}`;
  return session.appName ?? session.appKey;
}

function deviceLabel(session: SessionSummary): string | undefined {
  const model = [session.deviceManufacturer, session.deviceModel].filter(Boolean).join(' ');
  const platform = [session.devicePlatform, session.deviceTier ? `设备 ${session.deviceTier}` : undefined].filter(Boolean).join(' · ');
  return [model, platform].filter(Boolean).join(' · ') || undefined;
}

function deviceTierHint(tier?: string): string | undefined {
  if (!tier) return undefined;
  return `用于性能指标分组对比，不代表问题严重程度。`;
}

export function SessionMetadataLine({ session }: { session: SessionSummary }) {
  return <SessionContext session={session} compact />;
}

export function SessionIssueSummary({ session, compact = false }: { session: SessionSummary; compact?: boolean }) {
  return (
    <div className={cn('mt-2 grid gap-1.5 text-xs', compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
      <IssuePill label="事件" value={session.count} compact={compact} />
      <IssuePill label="错误" value={session.errorCount} icon={AlertTriangle} tone={session.errorCount > 0 ? 'danger' : 'neutral'} compact={compact} />
      <IssuePill label="卡顿" value={session.jankCount} icon={Gauge} tone={session.jankCount > 0 ? 'warn' : 'neutral'} compact={compact} />
      <IssuePill label="网络" value={session.failedHttpCount} icon={Globe2} tone={session.failedHttpCount > 0 ? 'danger' : 'neutral'} compact={compact} />
    </div>
  );
}

export function SessionIssueInline({ session }: { session: SessionSummary }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-600">
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
            'inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 tabular-nums',
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
  compact = false,
}: {
  label: string;
  value: number;
  icon?: typeof AlertTriangle;
  tone?: 'neutral' | 'warn' | 'danger';
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border px-2 py-1',
        tone === 'neutral' && 'border-zinc-100 bg-zinc-50 text-zinc-600',
        tone === 'warn' && 'border-amber-100 bg-amber-50 text-amber-800',
        tone === 'danger' && 'border-red-100 bg-red-50 text-red-700',
      )}
    >
      <div className="flex items-center gap-1 text-[11px]">
        {Icon ? <Icon className="size-3" /> : null}
        {!compact ? label : <span className="truncate">{label}</span>}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
