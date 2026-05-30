import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { Home, ListTree, Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
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
          <Link to="/" className={`${performanceRoute ? 'h-8 w-8' : 'h-9 w-9'} inline-flex items-center justify-center rounded-md bg-zinc-950 text-white`}>
            <Home className="size-4" />
          </Link>
          {!performanceRoute ? (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight">Flutter Monitor 工作台</h1>
              <p className="truncate text-xs text-zinc-500">本地实时数据 · 会话链路排查 · SQLite 持久化</p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/sessions">
              <ListTree className="size-4" />
              Sessions
            </Link>
          </Button>
          <Button variant={live ? 'default' : 'secondary'} onClick={() => setLive((value) => !value)}>
            {live ? <Pause className="size-4" /> : <Play className="size-4" />}
            {live ? '实时中' : '已暂停'}
          </Button>
          <Button variant="secondary" onClick={() => void router.invalidate()}>
            <RefreshCw className="size-4" />
            刷新
          </Button>
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
