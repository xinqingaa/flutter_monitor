import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { Braces, Filter, ListFilter, type LucideIcon, Pause, Play, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { ScopeBar, ScopeBarPanel, ScopeSummaryBadge } from '../features/scope/scope-bar';
import { hasActiveScope, pickScopeSearch, useScopeFilters } from '../features/scope/scope-filters';
import { useLiveInvalidation } from '../shared/datasource/queries';
import { LiveContext } from './live-context';
import { WorkbenchV2Shell } from './workbench-v2-shell';

export function WorkbenchShell() {
  const location = useLocation();
  return ['/http', '/business', '/errors'].includes(location.pathname) ? <WorkbenchV2Shell /> : <LegacyWorkbenchShell />;
}

function LegacyWorkbenchShell() {
  const [live, setLive] = useState(true);
  const router = useRouter();
  const location = useLocation();
  const performanceRoute = isPerformanceRoute(location.pathname);
  const headerScopeRoute = isHeaderScopeRoute(location.pathname);
  useLiveInvalidation(live);

  return (
    <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] bg-zinc-100 text-zinc-950">
      <header className={`flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white ${performanceRoute ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" search={(current) => pickScopeSearch(current)} className={`${performanceRoute ? 'h-8 w-8' : 'h-9 w-9'} inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white shadow-sm`}>
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
          {headerScopeRoute ? <HeaderScopeButton /> : null}
          <HeaderIconButton to="/sessions" icon={ListFilter} tooltip="会话列表" />
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
      {headerScopeRoute ? null : <ScopeBar />}
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

function isHeaderScopeRoute(pathname: string): boolean {
  return pathname === '/sessions' || pathname.startsWith('/sessions/');
}

function HeaderScopeButton() {
  const { filters } = useScopeFilters();
  const active = hasActiveScope(filters);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const interactingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const open = hovered || pinned;

  function setInteractionLocked(value: boolean) {
    interactingRef.current = value;
    setInteracting(value);
  }

  function clearCloseTimer() {
    if (closeTimerRef.current === undefined) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      if (interactingRef.current) return;
      setHovered(false);
      setPinned(false);
    }, 180);
  }

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!pinned) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPinned(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinned]);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setHovered(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={active || open ? 'default' : 'secondary'}
            size="icon"
            className="h-10 w-10"
            aria-label="全局范围筛选"
            aria-expanded={open}
            onClick={() => {
              clearCloseTimer();
              if (open) {
                setPinned(false);
                setHovered(false);
                return;
              }
              setPinned(true);
              setHovered(true);
            }}
          >
            <Filter className="size-4" />
            <ScopeSummaryBadge className="absolute -right-1 -top-1" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>全局范围筛选</TooltipContent>
      </Tooltip>
      <div className={open ? 'fixed left-3 right-3 top-[54px] z-40 h-4' : 'hidden'} />
      <div
        className={`fixed left-3 right-3 top-[66px] z-50 origin-top transition-all duration-200 ease-out ${
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        {open ? <ScopeBarPanel onInteractStart={() => setInteractionLocked(true)} onInteractEnd={() => setInteractionLocked(false)} /> : null}
      </div>
    </div>
  );
}

export function HeaderIconButton({
  to,
  icon: Icon,
  tooltip,
  active = false,
  onClick,
}: {
  to?: '/sessions' | '/events';
  icon: LucideIcon;
  tooltip: string;
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
        <Link to={to} search={(current) => pickScopeSearch(current)}>
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
