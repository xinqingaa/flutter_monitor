import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
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

const nav = [
  { to: '/', label: '大屏', match: (pathname: string) => pathname === '/' },
  { to: '/sessions', label: 'Session', match: (pathname: string) => pathname === '/sessions' || pathname.startsWith('/sessions/') },
  { to: '/http', label: 'HTTP', match: (pathname: string) => pathname === '/http' || pathname.startsWith('/http/') },
  { to: '/business', label: '埋点', match: (pathname: string) => pathname === '/business' || pathname.startsWith('/business/') },
  { to: '/errors', label: '异常', match: (pathname: string) => pathname === '/errors' || pathname.startsWith('/errors/') },
] as const;

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
      <Sidebar collapsible="offcanvas" variant="inset">
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
                {nav.map(({ to, label, match }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={match(location.pathname)}
                      tooltip={label}
                    >
                      <Link to={to} search={(current) => pickScopeSearch(current)}>
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

function pageMeta(pathname: string): { title: string; detail?: string } {
  if (pathname === '/') return { title: '大屏' };
  if (pathname === '/sessions') return { title: 'Session' };
  if (pathname.startsWith('/sessions/')) {
    return { title: 'Session 链路', detail: decodeURIComponent(pathname.slice('/sessions/'.length)) };
  }
  if (pathname.startsWith('/http/')) {
    return { title: 'HTTP 详情', detail: decodeURIComponent(pathname.slice('/http/'.length)) };
  }
  if (pathname.startsWith('/http')) return { title: 'HTTP' };
  if (pathname.startsWith('/business/')) {
    return { title: '埋点详情', detail: decodeURIComponent(pathname.slice('/business/'.length)) };
  }
  if (pathname.startsWith('/business')) return { title: '埋点' };
  if (pathname.startsWith('/errors/')) {
    return { title: '异常详情', detail: decodeURIComponent(pathname.slice('/errors/'.length)) };
  }
  if (pathname.startsWith('/errors')) return { title: '异常' };
  if (pathname.startsWith('/traces/')) {
    return { title: 'Trace', detail: decodeURIComponent(pathname.slice('/traces/'.length)) };
  }
  return { title: 'Workbench' };
}
