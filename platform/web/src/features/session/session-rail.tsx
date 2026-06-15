import { Link } from '@tanstack/react-router';
import { PanelLeftOpen, PanelRightOpen, Search, X } from 'lucide-react';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { SessionSummary } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatTime } from '../../shared/formatting/format';
import { pickScopeSearch } from '../scope/scope-filters';

export function SessionRail({
  sessions,
  selectedSessionId,
  title,
  side = 'left',
  onExpand,
  onSearch,
  searchActive = false,
  onClearSearch,
  className,
}: {
  sessions: SessionSummary[];
  selectedSessionId?: string;
  title: string;
  side?: 'left' | 'right';
  onExpand: () => void;
  onSearch?: () => void;
  searchActive?: boolean;
  onClearSearch?: () => void;
  className?: string;
}) {
  const ExpandIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;

  return (
    <section className={cn('hidden h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white xl:grid', className)}>
      <div className="relative flex items-center justify-center gap-1.5 border-b border-zinc-200 px-2 py-2">
        <IconTooltipButton type="button" variant="secondary" size="icon" label={`展开${title}`} icon={ExpandIcon} onClick={onExpand} className="h-8 w-8" />
        {onSearch ? (
          <IconTooltipButton
            type="button"
            variant="secondary"
            size="icon"
            label={searchActive ? '搜索会话（筛选中）' : '搜索会话'}
            icon={Search}
            onClick={onSearch}
            className={cn(
              'h-8 w-8',
              searchActive && 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 [&_*]:text-teal-700',
            )}
          />
        ) : null}
        {searchActive && onClearSearch ? (
          <IconTooltipButton
            type="button"
            variant="secondary"
            size="icon"
            label="清除会话搜索"
            icon={X}
            onClick={onClearSearch}
            className="absolute right-1 top-1 h-5 w-5 rounded-full border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 [&_svg]:size-3"
          />
        ) : null}
      </div>
      <div className="min-h-0 overflow-auto">
        {sessions.length === 0 ? (
          <div className="grid h-full place-items-center px-1 text-center text-[11px] text-zinc-400">
            暂无会话
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {sessions.map((session) => (
              <RailSessionLink
                key={session.sessionId}
                session={session}
                selected={selectedSessionId === session.sessionId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RailSessionLink({ session, selected }: { session: SessionSummary; selected: boolean }) {
  const shortId = shortSessionId(session.sessionId);
  const label = [
    session.sessionId,
    session.route,
    session.userId ? `user ${session.userId}` : undefined,
    `${session.count} events`,
  ].filter(Boolean).join(' · ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId: session.sessionId }}
          search={(current) => pickScopeSearch(current)}
          aria-label={label}
          className={cn(
            'group grid min-w-0 grid-cols-[3px_minmax(0,1fr)] bg-white text-left transition-colors hover:bg-teal-50/50',
            selected && 'bg-teal-500/10',
          )}
        >
          <span className={cn(
            'block',
            session.status === 'error' ? 'bg-red-500' : session.status === 'warning' ? 'bg-amber-500' : session.nativeAvailable ? 'bg-teal-500' : 'bg-zinc-300',
          )} />
          <span className="grid min-h-0 place-items-start gap-0.5 px-2 py-2">
            <span className={cn('max-w-full truncate font-mono text-[11px]', selected ? 'font-semibold text-teal-900' : 'text-zinc-900')}>
              {shortId}
            </span>
            <span className="text-[11px] tabular-nums text-zinc-500">{formatTime(session.lastTimestamp)}</span>
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function shortSessionId(sessionId: string): string {
  if (sessionId.length <= 12) return sessionId;
  return sessionId.slice(0, 12);
}
