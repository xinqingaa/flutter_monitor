import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { WorkbenchShell } from './workbench-shell';

type RootSearch = {
  appKey?: string;
  packageName?: string;
  environment?: string;
  appVersion?: string;
  devicePlatform?: string;
  from?: string;
  to?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
};

export type HttpSearch = RootSearch & {
  sessionId?: string;
  route?: string;
  url?: string;
  method?: string;
  result?: string;
  requestId?: string;
  statusCode?: string;
  businessCode?: string;
  host?: string;
  slowOnly?: boolean;
  slowThresholdMs?: number;
  sortBy?: 'timestamp' | 'durationMs';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: 25 | 50 | 100;
  eventId?: string;
  detail?: string;
};

export type DomainSearch = RootSearch & {
  sessionId?: string;
  route?: string;
  action?: string;
  result?: string;
  errorType?: string;
  mechanism?: string;
  fatal?: boolean;
  handled?: boolean;
  businessOnly?: boolean;
  sortBy?: 'timestamp';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: 25 | 50 | 100;
  eventId?: string;
  detail?: string;
};

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): RootSearch => cleanSearch({
    appKey: stringListSearchParam(search.appKey),
    packageName: stringListSearchParam(search.packageName),
    environment: stringListSearchParam(search.environment),
    appVersion: stringListSearchParam(search.appVersion),
    devicePlatform: stringListSearchParam(search.devicePlatform),
    from: stringSearch(search.from),
    to: stringSearch(search.to),
    userId: stringListSearchParam(search.userId),
    sessionId: stringListSearchParam(search.sessionId),
    route: stringListSearchParam(search.route),
  }),
  component: WorkbenchShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../routes/dashboard/dashboard-route'), 'DashboardRoute'),
});

export type SessionsSearch = RootSearch & {
  selected?: string;
  detail?: string;
  page?: number;
  pageSize?: 25 | 50 | 100;
};

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  validateSearch: (search: Record<string, unknown>): SessionsSearch => cleanSearch({
    appKey: stringListSearchParam(search.appKey),
    packageName: stringListSearchParam(search.packageName),
    environment: stringListSearchParam(search.environment),
    appVersion: stringListSearchParam(search.appVersion),
    devicePlatform: stringListSearchParam(search.devicePlatform),
    from: stringSearch(search.from),
    to: stringSearch(search.to),
    userId: stringListSearchParam(search.userId),
    sessionId: stringListSearchParam(search.sessionId),
    route: stringListSearchParam(search.route),
    selected: stringSearch(search.selected),
    detail: stringSearch(search.detail),
    page: integerSearch(search.page, 1),
    pageSize: enumNumberSearch(search.pageSize, [25, 50, 100]) as 25 | 50 | 100 | undefined,
  }),
  component: lazyRouteComponent(() => import('../routes/sessions/sessions-route'), 'SessionsRoute'),
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  validateSearch: (search: Record<string, unknown>): { eventId?: string; traceId?: string } => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
    traceId: typeof search.traceId === 'string' ? search.traceId : undefined,
  }),
  component: lazyRouteComponent(() => import('../routes/session/session-workspace-route'), 'SessionWorkspaceRoute'),
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  beforeLoad: () => { throw redirect({ to: '/http' }); },
});

const httpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/http',
  validateSearch: (search: Record<string, unknown>): HttpSearch => cleanSearch({
    appKey: stringListSearchParam(search.appKey),
    packageName: stringListSearchParam(search.packageName),
    environment: stringListSearchParam(search.environment),
    appVersion: stringListSearchParam(search.appVersion),
    devicePlatform: stringListSearchParam(search.devicePlatform),
    from: stringSearch(search.from),
    to: stringSearch(search.to),
    userId: stringListSearchParam(search.userId),
    sessionId: stringListSearchParam(search.sessionId),
    route: stringListSearchParam(search.route),
    url: stringSearch(search.url),
    method: stringListSearchParam(search.method),
    result: stringListSearchParam(search.result),
    requestId: stringListSearchParam(search.requestId),
    statusCode: numericListSearchParam(search.statusCode),
    businessCode: stringListSearchParam(search.businessCode),
    host: stringListSearchParam(search.host),
    slowOnly: booleanSearch(search.slowOnly),
    slowThresholdMs: enumNumberSearch(search.slowThresholdMs, [500, 1000, 2000, 3000, 5000]),
    sortBy: enumSearch(search.sortBy, ['timestamp', 'durationMs']),
    sortDir: enumSearch(search.sortDir, ['asc', 'desc']),
    page: integerSearch(search.page, 1),
    pageSize: enumNumberSearch(search.pageSize, [25, 50, 100]) as 25 | 50 | 100 | undefined,
    eventId: stringSearch(search.eventId),
    detail: stringSearch(search.detail),
  }),
  component: lazyRouteComponent(() => import('../routes/http/http-foundation-route'), 'HttpFoundationRoute'),
});

const httpDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/http/$eventId',
  component: lazyRouteComponent(() => import('../routes/http/http-detail-route'), 'HttpDetailRoute'),
});

const businessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/business',
  validateSearch: domainSearch,
  component: lazyRouteComponent(() => import('../routes/domain/domain-catalog-route'), 'BusinessCatalogRoute'),
});

const businessDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/business/$eventId',
  component: lazyRouteComponent(() => import('../routes/domain/domain-detail-route'), 'BusinessDetailRoute'),
});

const errorCatalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  validateSearch: domainSearch,
  component: lazyRouteComponent(() => import('../routes/domain/domain-catalog-route'), 'ErrorCatalogRoute'),
});

const errorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors/$eventId',
  component: lazyRouteComponent(() => import('../routes/domain/domain-detail-route'), 'ErrorDetailRoute'),
});

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  beforeLoad: () => { throw redirect({ to: '/' }); },
});

const startupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/startup',
  beforeLoad: () => { throw redirect({ to: '/' }); },
});

const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pages',
  beforeLoad: () => { throw redirect({ to: '/' }); },
});

const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/network',
  beforeLoad: () => { throw redirect({ to: '/http' }); },
});

const jankRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jank',
  beforeLoad: () => { throw redirect({ to: '/' }); },
});

const legacyErrorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/legacy/errors',
  beforeLoad: () => { throw redirect({ to: '/errors' }); },
});

const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/traces/$traceId',
  component: lazyRouteComponent(() => import('../routes/trace-detail/trace-detail-route'), 'TraceDetailRoute'),
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  sessionsRoute,
  sessionRoute,
  eventsRoute,
  httpRoute,
  httpDetailRoute,
  businessRoute,
  businessDetailRoute,
  errorCatalogRoute,
  errorDetailRoute,
  eventRoute,
  startupRoute,
  pagesRoute,
  networkRoute,
  jankRoute,
  legacyErrorsRoute,
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

function cleanSearch<T extends Record<string, unknown>>(search: T): T {
  return Object.fromEntries(
    Object.entries(search).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    }),
  ) as T;
}

function enumSearch<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  const candidate = stringSearch(value);
  return candidate && values.includes(candidate as T) ? candidate as T : undefined;
}

function booleanSearch(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function integerSearch(value: unknown, min: number): number | undefined {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : undefined;
}

function enumNumberSearch(value: unknown, values: readonly number[]): number | undefined {
  const parsed = integerSearch(value, 1);
  return parsed !== undefined && values.includes(parsed) ? parsed : undefined;
}

function numericListSearchParam(value: unknown): string | undefined {
  const values = stringListSearch(value).filter((item) => /^\d+$/.test(item));
  return values.length ? values.join(',') : undefined;
}

function domainSearch(search: Record<string, unknown>): DomainSearch {
  return cleanSearch({
    appKey: stringListSearchParam(search.appKey), packageName: stringListSearchParam(search.packageName), environment: stringListSearchParam(search.environment), appVersion: stringListSearchParam(search.appVersion), devicePlatform: stringListSearchParam(search.devicePlatform), from: stringSearch(search.from), to: stringSearch(search.to), userId: stringListSearchParam(search.userId), sessionId: stringListSearchParam(search.sessionId), route: stringListSearchParam(search.route),
    action: stringSearch(search.action), result: stringListSearchParam(search.result), errorType: stringSearch(search.errorType), mechanism: stringListSearchParam(search.mechanism), fatal: booleanSearch(search.fatal), handled: booleanSearch(search.handled), businessOnly: booleanSearch(search.businessOnly), sortBy: enumSearch(search.sortBy, ['timestamp']), sortDir: enumSearch(search.sortDir, ['asc', 'desc']), page: integerSearch(search.page, 1), pageSize: enumNumberSearch(search.pageSize, [25, 50, 100]) as 25 | 50 | 100 | undefined, eventId: stringSearch(search.eventId), detail: stringSearch(search.detail),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
