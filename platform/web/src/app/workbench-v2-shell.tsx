import { Link, Outlet, useRouter } from '@tanstack/react-router';
import { AlertTriangle, ChevronsLeft, ChevronsRight, MousePointerClick, Network, Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { IconTooltipButton } from '../components/ui/icon-tooltip-button';
import { useLiveInvalidation } from '../shared/datasource/queries';
import { LiveContext } from './live-context';

const STORAGE_KEY = 'flutter-monitor.workbench.sidebar-collapsed';

export function WorkbenchV2Shell() {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  useLiveInvalidation(live);

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem(STORAGE_KEY, String(!current));
      return !current;
    });
  }

  return (
    <div className={collapsed ? 'workbench-v2 grid h-full grid-cols-[56px_minmax(0,1fr)]' : 'workbench-v2 grid h-full grid-cols-[216px_minmax(0,1fr)]'}>
      <aside className="flex min-h-0 flex-col border-r border-border-default bg-surface max-[700px]:w-14">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-default px-3">
          <Link to="/http" className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-border-default bg-surface">
            <img src="/logo.png" alt="Flutter Monitor" className="size-6" />
          </Link>
          {collapsed ? null : <span className="min-w-0 truncate text-[13px] font-semibold text-text-primary max-[700px]:hidden">Flutter Monitor</span>}
        </div>
        <nav aria-label="Workbench 主导航" className="min-h-0 flex-1 p-2">
          <NavItem to="/http" label="HTTP" icon={Network} collapsed={collapsed} />
          <NavItem to="/business" label="埋点" icon={MousePointerClick} collapsed={collapsed} />
          <NavItem to="/errors" label="异常" icon={AlertTriangle} collapsed={collapsed} />
        </nav>
        <div className="grid shrink-0 gap-1 border-t border-border-default p-2">
          <IconTooltipButton type="button" variant="ghost" size="icon" label={live ? '暂停实时更新' : '恢复实时更新'} icon={live ? Pause : Play} onClick={() => setLive((value) => !value)} />
          <IconTooltipButton type="button" variant="ghost" size="icon" label="刷新" icon={RefreshCw} onClick={() => void router.invalidate()} />
          <IconTooltipButton type="button" variant="ghost" size="icon" label={collapsed ? '展开侧边栏' : '折叠侧边栏'} icon={collapsed ? ChevronsRight : ChevronsLeft} onClick={toggleCollapsed} />
        </div>
      </aside>
      <main className="min-h-0 min-w-0 overflow-hidden">
        <LiveContext.Provider value={live}><Outlet /></LiveContext.Provider>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, collapsed }: { to: '/http' | '/business' | '/errors'; label: string; icon: typeof Network; collapsed: boolean }) {
  return <Link to={to} activeProps={{ 'aria-current': 'page', className: 'border-border-selected bg-selected text-text-link' }} inactiveProps={{ className: 'border-transparent text-text-secondary hover:bg-subtle' }} className="mb-1 flex h-9 items-center gap-2 rounded-control border px-2 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-interactive-focusRing"><Icon className="size-4 shrink-0" />{collapsed ? null : <span className="truncate max-[700px]:hidden">{label}</span>}</Link>;
}
