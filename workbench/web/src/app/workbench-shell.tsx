import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { Braces, ListFilter, type LucideIcon, Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useLiveInvalidation } from '../shared/datasource/queries';
import { LiveContext } from './live-context';

export function WorkbenchShell() {
  const [live, setLive] = useState(true);
  const router = useRouter();
  const location = useLocation();
  const performanceRoute = isPerformanceRoute(location.pathname);
  useLiveInvalidation(live);

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] bg-zinc-100 text-zinc-950">
      <header className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white ${performanceRoute ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" className={`${performanceRoute ? 'h-8 w-8' : 'h-9 w-9'} inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white shadow-sm`}>
            <img src="/logo.png" alt="Flutter Monitor" className={`${performanceRoute ? 'size-6' : 'size-7'} rounded`} />
          </Link>
          {!performanceRoute ? (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">Flutter Monitor 工作台</h1>
              <p className="truncate text-xs text-zinc-500">本地实时数据 · 会话链路排查 · SQLite 持久化</p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <HeaderIconButton to="/sessions" icon={ListFilter} tooltip="会话列表" search />
          <HeaderIconButton to="/events" icon={Braces} tooltip="事件列表" />
          <HeaderIconButton
            icon={live ? Pause : Play}
            tooltip={live ? '暂停实时更新' : '恢复实时更新'}
            active={live}
            onClick={() => setLive((value) => !value)}
          />
          <HeaderIconButton icon={RefreshCw} tooltip="刷新数据" onClick={() => void router.invalidate()} />
        </div>
      </header>
      <main className="min-h-0 overflow-hidden">
        <LiveContext.Provider value={live}>
          <Outlet />
        </LiveContext.Provider>
      </main>
    </div>
  );
}

function isPerformanceRoute(pathname: string): boolean {
  return ['/startup', '/pages', '/network', '/jank', '/errors'].includes(pathname);
}

export function HeaderIconButton({
  to,
  icon: Icon,
  tooltip,
  search,
  active = false,
  onClick,
}: {
  to?: '/sessions' | '/events';
  icon: LucideIcon;
  tooltip: string;
  search?: true;
  active?: boolean;
  onClick?: () => void;
}) {
  const button = (
    <Button
      asChild={Boolean(to)}
      type={to ? undefined : 'button'}
      variant={active ? 'default' : 'secondary'}
      size="icon"
      className="h-10 w-10"
      onClick={to ? undefined : onClick}
      aria-label={tooltip}
    >
      {to ? (
        <Link to={to} search={search}>
          <Icon className="size-4" />
        </Link>
      ) : (
        <Icon className="size-4" />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
