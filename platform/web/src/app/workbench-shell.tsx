import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import {
  AlertTriangle,
  GitBranch,
  LayoutDashboard,
  MousePointerClick,
  Network,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../components/ui/sidebar';
import { Switch } from '../components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useLiveInvalidation } from '../shared/datasource/queries';
import { pickScopeSearch } from '../features/scope/scope-filters';
import { LiveContext } from './live-context';

const nav: Array<{
  to: '/' | '/sessions' | '/http' | '/business' | '/errors';
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}> = [
  { to: '/', label: '大屏', icon: LayoutDashboard, match: (pathname) => pathname === '/' },
  { to: '/sessions', label: 'Session', icon: GitBranch, match: (pathname) => pathname === '/sessions' || pathname.startsWith('/sessions/') },
  { to: '/http', label: 'HTTP', icon: Network, match: (pathname) => pathname === '/http' || pathname.startsWith('/http/') },
  { to: '/business', label: '埋点', icon: MousePointerClick, match: (pathname) => pathname === '/business' || pathname.startsWith('/business/') },
  { to: '/errors', label: '异常', icon: AlertTriangle, match: (pathname) => pathname === '/errors' || pathname.startsWith('/errors/') },
];

export function WorkbenchShell() {
  const router = useRouter();
  const location = useLocation();
  const [live, setLive] = useState(true);
  useLiveInvalidation(live);
  const page = pageMeta(location.pathname);

  return (
    <SidebarProvider
      className="h-full min-h-0"
      defaultOpen={window.matchMedia('(min-width: 1280px)').matches}
      style={
        {
          '--sidebar-width': '12rem',
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
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map(({ to, label, icon: Icon, match }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={match(location.pathname)}
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
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden">
        <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger aria-label="切换导航" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/" search={(current) => pickScopeSearch(current)}>
                    Workbench
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="min-w-0">
                {page.listTo && page.detail ? (
                  <BreadcrumbLink asChild className="truncate">
                    <Link to={page.listTo} search={(current) => pickScopeSearch(current)}>
                      {page.title}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{page.title}</BreadcrumbPage>
                )}
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

function pageMeta(pathname: string): { title: string; detail?: string; listTo?: '/' | '/sessions' | '/http' | '/business' | '/errors' } {
  if (pathname === '/') return { title: '大屏' };
  if (pathname === '/sessions') return { title: 'Session' };
  if (pathname.startsWith('/sessions/')) {
    return {
      title: 'Session',
      detail: decodeURIComponent(pathname.slice('/sessions/'.length)),
      listTo: '/sessions',
    };
  }
  if (pathname.startsWith('/http/')) {
    return {
      title: 'HTTP',
      detail: decodeURIComponent(pathname.slice('/http/'.length)),
      listTo: '/http',
    };
  }
  if (pathname.startsWith('/http')) return { title: 'HTTP' };
  if (pathname.startsWith('/business/')) {
    return {
      title: '埋点',
      detail: decodeURIComponent(pathname.slice('/business/'.length)),
      listTo: '/business',
    };
  }
  if (pathname.startsWith('/business')) return { title: '埋点' };
  if (pathname.startsWith('/errors/')) {
    return {
      title: '异常',
      detail: decodeURIComponent(pathname.slice('/errors/'.length)),
      listTo: '/errors',
    };
  }
  if (pathname.startsWith('/errors')) return { title: '异常' };
  if (pathname.startsWith('/traces/')) {
    return { title: 'Trace', detail: decodeURIComponent(pathname.slice('/traces/'.length)) };
  }
  return { title: 'Workbench' };
}
