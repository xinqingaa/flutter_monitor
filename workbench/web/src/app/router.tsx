import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router';
import { WorkbenchShell } from './workbench-shell';

type RootSearch = {
  appKey?: string;
  environment?: string;
  appVersion?: string;
  devicePlatform?: string;
  deviceModel?: string;
  deviceTier?: string;
  from?: string;
  to?: string;
  route?: string;
  userId?: string;
  status?: string;
  problemType?: string;
  nativeAvailable?: boolean;
  nativePlatform?: string;
};

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): RootSearch => cleanSearch({
    appKey: stringListSearchParam(search.appKey),
    environment: stringListSearchParam(search.environment),
    appVersion: stringListSearchParam(search.appVersion),
    devicePlatform: stringListSearchParam(search.devicePlatform),
    deviceModel: stringSearch(search.deviceModel),
    deviceTier: stringSearch(search.deviceTier),
    from: stringSearch(search.from),
    to: stringSearch(search.to),
    route: stringSearch(search.route),
    userId: stringSearch(search.userId),
    status: stringSearch(search.status),
    problemType: stringSearch(search.problemType),
    nativeAvailable: booleanSearch(search.nativeAvailable),
    nativePlatform: stringSearch(search.nativePlatform),
  }),
  component: WorkbenchShell,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../routes/overview/overview-route'), 'OverviewRoute'),
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: lazyRouteComponent(() => import('../routes/sessions/sessions-route'), 'SessionsRoute'),
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  validateSearch: (search: Record<string, unknown>): { eventId?: string; traceId?: string } => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
    traceId: typeof search.traceId === 'string' ? search.traceId : undefined,
  }),
  component: lazyRouteComponent(() => import('../routes/session-detail/session-detail-route'), 'SessionDetailRoute'),
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  component: lazyRouteComponent(() => import('../routes/events/events-route'), 'EventsRoute'),
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: lazyRouteComponent(() => import('../routes/event-detail/event-detail-route'), 'EventDetailRoute'),
});

const startupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/startup',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'StartupRoute'),
});

const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pages',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'PagesRoute'),
});

const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/network',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'NetworkRoute'),
});

const jankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jank',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'JankRoute'),
});

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  component: lazyRouteComponent(() => import('../routes/performance/performance-routes'), 'ErrorsRoute'),
});

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces/$traceId',
  component: lazyRouteComponent(() => import('../routes/trace-detail/trace-detail-route'), 'TraceDetailRoute'),
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  sessionsRoute,
  sessionRoute,
  eventsRoute,
  eventRoute,
  startupRoute,
  pagesRoute,
  networkRoute,
  jankRoute,
  errorsRoute,
  traceRoute,
]);

export const router = createRouter({ routeTree });

function stringSearch(value: unknown): string | undefined {
  if (Array.isArray(value)) return stringSearch(value[0]);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringListSearchParam(value: unknown): string | undefined {
  const values = stringListSearch(value);
  return values.length > 0 ? values.join(',') : undefined;
}

function stringListSearch(value: unknown): string[] {
  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => stringParts(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function stringParts(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return value.split(',');
    }
  }
  return value.split(',');
}

function booleanSearch(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function cleanSearch<T extends Record<string, unknown>>(search: T): T {
  return Object.fromEntries(
    Object.entries(search).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    }),
  ) as T;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
