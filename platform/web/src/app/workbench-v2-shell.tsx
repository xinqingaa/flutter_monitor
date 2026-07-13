import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { AlertTriangle, LayoutDashboard, MousePointerClick, Network, RefreshCw } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '../components/ui/sidebar';
import { Switch } from '../components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useLiveInvalidation, useSessionsQuery } from '../shared/datasource/queries';
import { formatDateTime } from '../shared/formatting/format';
import { pickScopeSearch } from '../features/scope/scope-filters';
import { LiveContext } from './live-context';

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
  useLiveInvalidation(live);
  const recentSessions = useSessionsQuery({ limit: 5 });
  const page = pageMeta(location.pathname);

  return (
    <SidebarProvider
      className="h-full min-h-0"
      defaultOpen={window.matchMedia('(min-width: 1280px)').matches}
      style={
        {
          '--sidebar-width': '16rem',
          '--header-height': '3rem',
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Flutter Monitor">
                <Link to="/">
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <img src="/logo.png" alt="Flutter Monitor" className="size-6" />
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Flutter Monitor</span>
                    <span className="truncate text-xs">Workbench</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>工作台</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)}
                      tooltip={label}
                    >
                      <Link to={to} search={(current) => pickScopeSearch(current)}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="mx-0" />

          <SidebarGroup>
            <SidebarGroupLabel>最近 Session</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(recentSessions.data?.sessions ?? []).map((session) => (
                  <SidebarMenuItem key={session.sessionId}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === `/sessions/${session.sessionId}`}
                      tooltip={`${session.sessionId} · ${formatDateTime(session.lastTimestamp)}`}
                    >
                      <Link
                        to="/sessions/$sessionId"
                        params={{ sessionId: session.sessionId }}
                        search={{ eventId: session.lastEventId }}
                      >
                        <span className="truncate font-mono">{shortId(session.sessionId)}</span>
                        <SidebarMenuBadge className="tabular-nums">
                          {session.errorCount + session.failedHttpCount + (session.businessFailureCount ?? 0)}
                        </SidebarMenuBadge>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden">
        <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear">
          <SidebarTrigger aria-label="切换导航" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem className="hidden md:block">
                <span>Workbench</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{page.title}</BreadcrumbPage>
              </BreadcrumbItem>
              {page.detail ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate font-mono text-xs">{page.detail}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2">
            <Label htmlFor="workbench-live" className="min-w-12 text-sm text-muted-foreground">
              {live ? 'Live' : 'Paused'}
            </Label>
            <Switch
              id="workbench-live"
              checked={live}
              onCheckedChange={setLive}
              aria-label={live ? '暂停实时更新' : '恢复实时更新'}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="刷新数据" onClick={() => void router.invalidate()}>
                <RefreshCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新数据</TooltipContent>
          </Tooltip>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <LiveContext.Provider value={live}>
            <Outlet />
          </LiveContext.Provider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 9)}...${value.slice(-6)}`;
}

function pageMeta(pathname: string): { title: string; detail?: string } {
  if (pathname === '/') return { title: '大屏' };
  if (pathname.startsWith('/http')) return { title: 'HTTP' };
  if (pathname.startsWith('/business')) return { title: '埋点' };
  if (pathname.startsWith('/errors')) return { title: '异常' };
  if (pathname.startsWith('/sessions/')) {
    return { title: 'Session 链路', detail: decodeURIComponent(pathname.slice('/sessions/'.length)) };
  }
  return { title: 'Workbench' };
}
