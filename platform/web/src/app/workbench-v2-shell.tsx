import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { AlertTriangle, LayoutDashboard, MousePointerClick, Network, Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/breadcrumb';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger } from '../components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useLiveInvalidation, useSessionsQuery } from '../shared/datasource/queries';
import { formatDateTime } from '../shared/formatting/format';
import { LiveContext } from './live-context';

const STORAGE_KEY = 'flutter-monitor.workbench.sidebar-expanded';
const nav = [
  { to: '/', label: '大屏', icon: LayoutDashboard },
  { to: '/http', label: 'HTTP', icon: Network },
  { to: '/business', label: '埋点', icon: MousePointerClick },
  { to: '/errors', label: '异常', icon: AlertTriangle },
] as const;

export function WorkbenchV2Shell() {
  const router = useRouter();
  const location = useLocation();
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false');
  useLiveInvalidation(live);
  const recentSessions = useSessionsQuery({ limit: 5 });
  const page = pageMeta(location.pathname);
  return <SidebarProvider open={expanded} onOpenChange={(open) => { setExpanded(open); localStorage.setItem(STORAGE_KEY, String(open)); }} className="h-full min-h-0 bg-canvas">
    <Sidebar collapsible="icon" className="border-border-default bg-surface">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-2">
        <Link to="/" className="flex min-w-0 items-center gap-2 px-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-control border border-border-default bg-surface"><img src="/logo.png" alt="Flutter Monitor" className="size-6" /></span>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">Flutter Monitor</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ to, label, icon: Icon }) => <SidebarMenuItem key={to}><SidebarMenuButton asChild isActive={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)} tooltip={label}><Link to={to}><Icon /><span>{label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>最近 Session</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenuSub>
              {(recentSessions.data?.sessions ?? []).map((session) => <SidebarMenuSubItem key={session.sessionId}><SidebarMenuSubButton asChild isActive={location.pathname === `/sessions/${session.sessionId}`}><Link to="/sessions/$sessionId" params={{ sessionId: session.sessionId }} search={{ eventId: session.lastEventId }} title={`${session.sessionId} · ${formatDateTime(session.lastTimestamp)}`}><span className="truncate font-mono">{shortId(session.sessionId)}</span><span className="ml-auto text-[10px] tabular-nums text-text-muted">{session.errorCount + session.failedHttpCount + (session.businessFailureCount ?? 0)}</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
            </SidebarMenuSub>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton tooltip={live ? '暂停实时更新' : '恢复实时更新'} onClick={() => setLive((value) => !value)}>{live ? <Pause /> : <Play />}<span>{live ? '暂停实时更新' : '恢复实时更新'}</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton tooltip="刷新数据" onClick={() => void router.invalidate()}><RefreshCw /><span>刷新数据</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-default bg-surface px-3">
        <SidebarTrigger aria-label="切换导航" />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb className="min-w-0 flex-1"><BreadcrumbList className="flex-nowrap text-xs text-text-secondary"><BreadcrumbItem><span>Workbench</span></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate text-sm font-medium text-text-primary">{page.title}</BreadcrumbPage></BreadcrumbItem>{page.detail ? <><BreadcrumbSeparator /><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate font-mono text-xs">{page.detail}</BreadcrumbPage></BreadcrumbItem></> : null}</BreadcrumbList></Breadcrumb>
        <span className="hidden items-center gap-1 text-xs text-text-secondary sm:inline-flex"><span className={live ? 'size-1.5 rounded-full bg-status-success' : 'size-1.5 rounded-full bg-status-neutral'} />{live ? 'Live' : 'Paused'}</span>
        <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label="刷新数据" onClick={() => void router.invalidate()}><RefreshCw /></Button></TooltipTrigger><TooltipContent>刷新数据</TooltipContent></Tooltip>
      </header>
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden"><LiveContext.Provider value={live}><Outlet /></LiveContext.Provider></main>
    </SidebarInset>
  </SidebarProvider>;
}

function shortId(value: string) { return value.length <= 18 ? value : `${value.slice(0, 9)}...${value.slice(-6)}`; }

function pageMeta(pathname: string): { title: string; detail?: string } {
  if (pathname === '/') return { title: '大屏' };
  if (pathname.startsWith('/http')) return { title: 'HTTP' };
  if (pathname.startsWith('/business')) return { title: '埋点' };
  if (pathname.startsWith('/errors')) return { title: '异常' };
  if (pathname.startsWith('/sessions/')) return { title: 'Session 链路', detail: decodeURIComponent(pathname.slice('/sessions/'.length)) };
  return { title: 'Workbench' };
}
